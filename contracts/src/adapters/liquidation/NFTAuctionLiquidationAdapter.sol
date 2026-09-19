// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "../../interfaces/adapters/IAssetAdapter.sol";
import "../../interfaces/adapters/IPositionAdapter.sol";
import "../../interfaces/seaport/ISeaport.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice Read-only slice of LendingMarketV2 used by this adapter.
 * @dev Public getters only â€” `loans().collateralAmount` is the tokenId for ERC721 loans.
 */
interface ILendingMarketV2View {
    function loans(uint256 loanId)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 principal,
            uint256 startTime,
            uint256 expiryTime,
            uint256 frozenInterestAt,
            uint8 status
        );
    function collateralAsset() external view returns (address);
    function lendingAsset() external view returns (address);
    function positionAdapter() external view returns (address);
}

/**
 * @title NFTAuctionLiquidationAdapter
 * @notice Multi-tenant liquidation adapter for indivisible ERC721 collateral with two
 *         simultaneous sale venues:
 *           1. Native on-chain Dutch auction â€” buyers pay in the market's lending asset
 *              (stablecoin); anyone can call buy() at the current decayed price.
 *           2. Seaport (OpenSea) direct sale â€” the keeper posts a stablecoin-denominated
 *              basic order on OpenSea; consideration routes debtOwed to the market and
 *              surplus directly to the holder at fulfillment time.
 * @dev Asynchronous adapter: liquidation flows through LIQUIDATION_CURE â†’ settleLiquidation
 *      (collateral handoff to this adapter) â†’ LIQUIDATION_SETTLING â†’ finalizeRedemptionSettlement
 *      on the market. The market's balance-delta verification covers recovered funds; surplus
 *      is paid by the buyer to the holder directly, mirroring the DEXSwap side-payment pattern.
 *      If the sale lands below debtOwed, the market's existing write-off accounting absorbs
 *      the shortfall (principal > actualRecovery).
 */
contract NFTAuctionLiquidationAdapter is ILiquidationAdapter, ERC721Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Types ============

    struct MarketConfig {
        address assetAdapter;
        // Risk params (recorded via configureRisk; market's oracle still guards minOutput)
        address oracleAdapter;
        uint16 maxSlippageBps;
        // Dutch auction parameters (basis points of debtOwed)
        uint16 startPriceBps;   // e.g. 15000 = 150% of debt; must be >= floor
        uint16 floorPriceBps;   // e.g. 8000 = 80% of debt; < 10000 â†’ allowed shortfall
        uint32 auctionDuration; // seconds
        // Seaport (OpenSea) direct-sale path
        address seaport;
        address seaportConduit; // OpenSea conduit key target that must be approved for listings
        bool isActive;
    }

    enum AuctionStatus { NONE, OPEN, SOLD }

    struct AuctionState {
        uint256 debtOwed;
        uint256 startPrice;
        uint256 floorPrice;
        uint64 startTime;
        uint64 endTime;
        uint256 tokenId;
        AuctionStatus status;
    }

    // ============ Storage ============

    address public immutable factory;
    address public operator;

    mapping(address => MarketConfig) public marketConfigs;
    mapping(address => mapping(uint256 => AuctionState)) public auctions;
    /// @notice OPEN auctions per NFT collection — used to avoid revoking Seaport approval early
    mapping(address => uint256) public openAuctionsByCollection;
    // Seaport order hash â†’ registered (EIP-1271 validity)
    mapping(bytes32 => bool) public registeredOrders;
    // Seaport order hash â†’ cancelled/invalidated
    mapping(bytes32 => bool) public cancelledOrders;
    // (market, loanId) â†’ registered order hash
    mapping(address => mapping(uint256 => bytes32)) public orderForLoan;

    // ============ Constants ============

    uint256 private constant BPS_DENOMINATOR = 10000;
    uint16 public constant MIN_START_BPS = 10000;
    uint16 public constant MAX_START_BPS = 50000;
    uint16 public constant MIN_FLOOR_BPS = 1000;
    uint16 public constant MAX_FLOOR_BPS = 10000;
    uint32 public constant MIN_AUCTION_DURATION = 1 hours;
    uint32 public constant MAX_AUCTION_DURATION = 7 days;
    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 private constant EIP1271_FAIL_VALUE = 0xffffffff;

    // ============ Events ============

    event AuctionListed(address indexed market, uint256 indexed loanId, uint256 startPrice, uint256 floorPrice, uint64 endTime);
    event AuctionSold(address indexed market, uint256 indexed loanId, address indexed buyer, uint256 price, uint256 toMarket, uint256 toHolder);
    event OrderRegistered(address indexed market, uint256 indexed loanId, bytes32 indexed orderHash);
    event OrderCancelled(bytes32 indexed orderHash);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    // ============ Errors ============

    error UnconfiguredMarket();
    error AuctionAlreadyListed();
    error AuctionNotOpen();
    error AuctionAlreadySold();
    error NotOperator();
    error InvalidAuctionParams();
    error InvalidOrder();
    error SaleFailed();
    error SettlementNotReady();

    // ============ Modifiers ============

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyConfiguredMarket() {
        if (!marketConfigs[msg.sender].isActive) revert UnconfiguredMarket();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ============ Construction / Configuration ============

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        operator = msg.sender;
    }

    function setOperator(address newOperator) external {
        require(msg.sender == operator, "Only operator");
        require(newOperator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    /// @inheritdoc ILiquidationAdapter
    function configure(address market, address assetAdapter) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(assetAdapter != address(0), "Invalid asset adapter");
        MarketConfig storage config = marketConfigs[market];
        config.assetAdapter = assetAdapter;
        // Defaults: start at 150% of debt, floor at 80%, 24h auction
        config.startPriceBps = 15000;
        config.floorPriceBps = 8000;
        config.auctionDuration = 24 hours;
        config.isActive = true;
    }

    /// @notice Risk-config hook required by the factory's adapter wiring for handoff-taking
    /// adapters. The NFT path prices sales off the recorded debtOwed (auction decay +
    /// keeper-listed order), so risk params are recorded but not used in sale pricing.
    function configureRisk(address market, address oracleAdapter, uint16 maxSlippageBps) external onlyFactory {
        require(marketConfigs[market].isActive, "Unconfigured market");
        marketConfigs[market].oracleAdapter = oracleAdapter;
        marketConfigs[market].maxSlippageBps = maxSlippageBps;
    }

    /// @notice Set Dutch auction parameters for a market (factory only)
    function setAuctionParams(address market, uint16 startPriceBps, uint16 floorPriceBps, uint32 auctionDuration)
        external
        onlyFactory
    {
        require(marketConfigs[market].isActive, "Unconfigured market");
        if (
            startPriceBps < MIN_START_BPS || startPriceBps > MAX_START_BPS ||
            floorPriceBps < MIN_FLOOR_BPS || floorPriceBps > MAX_FLOOR_BPS ||
            startPriceBps < floorPriceBps ||
            auctionDuration < MIN_AUCTION_DURATION || auctionDuration > MAX_AUCTION_DURATION
        ) revert InvalidAuctionParams();
        marketConfigs[market].startPriceBps = startPriceBps;
        marketConfigs[market].floorPriceBps = floorPriceBps;
        marketConfigs[market].auctionDuration = auctionDuration;
    }

    /// @notice Configure the Seaport (OpenSea) direct-sale path for a market (factory only)
    /// @param seaport Seaport contract address (cancellation + order context)
    /// @param conduit OpenSea conduit address that must hold ERC721 approval for listings
    function setSeaport(address market, address seaport, address conduit) external onlyFactory {
        require(marketConfigs[market].isActive, "Unconfigured market");
        require(seaport != address(0), "Invalid seaport");
        marketConfigs[market].seaport = seaport;
        marketConfigs[market].seaportConduit = conduit; // may be address(0) â†’ approve Seaport itself
    }

    // ============ ILiquidationAdapter ============

    /// @inheritdoc ILiquidationAdapter
    function isAsynchronous() external pure override returns (bool) {
        return true;
    }

    /// @inheritdoc ILiquidationAdapter
    function cureWindowSeconds() external pure override returns (uint256) {
        return 72 hours;
    }

    /// @inheritdoc ILiquidationAdapter
    function requiresCollateralHandoff() external pure override returns (bool) {
        return true;
    }

    /**
     * @notice List the auction after collateral handoff (called via market.settleLiquidation)
     * @dev MUST return (0, 0) and move no lending asset â€” the market verifies isolation.
     *      Starts the native Dutch auction; the Seaport order is posted off-chain by the
     *      keeper and its hash registered via registerOrder().
     */
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyConfiguredMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        MarketConfig storage config = marketConfigs[msg.sender];
        AuctionState storage auctionState = auctions[msg.sender][loanId];
        if (auctionState.status != AuctionStatus.NONE) revert AuctionAlreadyListed();
        if (debtOwed == 0) revert InvalidAuctionParams();

        (uint256 collateralAmount, , , , , ) = ILendingMarketV2View(msg.sender).loans(loanId);
        uint256 startPrice = (debtOwed * config.startPriceBps) / BPS_DENOMINATOR;
        uint256 floorPrice = (debtOwed * config.floorPriceBps) / BPS_DENOMINATOR;

        auctionState.debtOwed = debtOwed;
        auctionState.startPrice = startPrice;
        auctionState.floorPrice = floorPrice;
        auctionState.startTime = uint64(block.timestamp);
        auctionState.endTime = uint64(block.timestamp + config.auctionDuration);
        auctionState.tokenId = collateralAmount;
        auctionState.status = AuctionStatus.OPEN;
        {
            address nftCollection = ILendingMarketV2View(msg.sender).collateralAsset();
            openAuctionsByCollection[nftCollection] += 1;
        }

        // Approve the OpenSea conduit (or Seaport itself) so posted orders are fulfillable
        address spender = config.seaportConduit != address(0) ? config.seaportConduit : config.seaport;
        if (spender != address(0)) {
            address nft = ILendingMarketV2View(msg.sender).collateralAsset();
            try IERC721(nft).setApprovalForAll(spender, true) {
                // approval set
            } catch {
                // Non-standard NFT: Seaport path unavailable, native auction unaffected
            }
        }

        emit AuctionListed(msg.sender, loanId, startPrice, floorPrice, auctionState.endTime);
        return (0, 0);
    }

    // ============ Native Dutch Auction ============

    /**
     * @notice Current Dutch auction price (linear decay from startPrice to floorPrice)
     * @dev Decay window is read from the auction's RECORDED start/end times (snapshot
     *      at listing â€” review M15), so factory-side parameter changes cannot warp an
     *      open auction's curve.
     */
    function currentPrice(address market, uint256 loanId) public view returns (uint256) {
        AuctionState storage auctionState = auctions[market][loanId];
        if (auctionState.status != AuctionStatus.OPEN) revert AuctionNotOpen();
        uint256 duration = auctionState.endTime - auctionState.startTime; // â‰¥ MIN_AUCTION_DURATION
        uint256 elapsed = block.timestamp >= auctionState.endTime ? duration : block.timestamp - auctionState.startTime;
        uint256 range = auctionState.startPrice - auctionState.floorPrice;
        return auctionState.startPrice - (range * elapsed) / duration;
    }

    /**
     * @notice Buy the collateral at the current Dutch auction price
     * @dev Buyer pays the lending asset: debtOwed portion goes to the market (verified by
     *      the engine's finalize balance-delta), any surplus goes directly to the position
     *      holder. If price < debtOwed the whole price goes to the market (shortfall is
     *      written off by the market at finalize).
     * @param market The LendingMarket whose loan is being liquidated
     * @param loanId The loan being liquidated
     */
    function buy(address market, uint256 loanId) external nonReentrant {
        MarketConfig storage config = marketConfigs[market];
        if (!config.isActive) revert UnconfiguredMarket();

        AuctionState storage auctionState = auctions[market][loanId];
        if (auctionState.status != AuctionStatus.OPEN) revert AuctionNotOpen();

        uint256 price = currentPrice(market, loanId);
        uint256 toMarket = price < auctionState.debtOwed ? price : auctionState.debtOwed;
        uint256 toHolder = price - toMarket;

        IERC20 lending = IERC20(ILendingMarketV2View(market).lendingAsset());
        if (toHolder > 0) {
            address holder = ILendingMarketV2View(market).positionAdapter();
            address holderAddress = IPositionAdapter(holder).ownerOf(loanId);
            lending.safeTransferFrom(msg.sender, holderAddress, toHolder);
        }
        lending.safeTransferFrom(msg.sender, market, toMarket);

        IERC721(ILendingMarketV2View(market).collateralAsset())
            .transferFrom(address(this), msg.sender, auctionState.tokenId);

        auctionState.status = AuctionStatus.SOLD;
        emit AuctionSold(market, loanId, msg.sender, price, toMarket, toHolder);

        // Invalidate any registered Seaport order so OpenSea can't double-sell
        bytes32 orderHash = orderForLoan[market][loanId];
        if (orderHash != bytes32(0) && registeredOrders[orderHash]) {
            registeredOrders[orderHash] = false;
            cancelledOrders[orderHash] = true;
            emit OrderCancelled(orderHash);
        }

        // Review H5: revoke the blanket OpenSea conduit approval now that this NFT
        // has left custody â€” the approval is re-granted on the next handoff, so the
        // adapter never holds an unused standing approval across all its NFTs.
        address spender = config.seaportConduit != address(0) ? config.seaportConduit : config.seaport;
        address nftCollection = ILendingMarketV2View(market).collateralAsset();
        // Decrement OPEN count for this collection; only revoke Seaport approval when
        // no sibling OPEN auctions remain (prevents breaking hybrid Seaport sales).
        if (openAuctionsByCollection[nftCollection] > 0) {
            openAuctionsByCollection[nftCollection] -= 1;
        }
        if (spender != address(0) && openAuctionsByCollection[nftCollection] == 0) {
            try IERC721(nftCollection).setApprovalForAll(spender, false) {
                // approval revoked — safe, no other OPEN auctions for this collection
            } catch {
                // Non-standard NFT: keep going; no approval existed or revocation unsupported
            }
        }
    }

    // ============ Seaport (OpenSea) Direct Sale ============

    // Seaport EIP-712 typehashes (Seaport v1.4/v1.5 canonical layout). The order hash
    // is derived ON-CHAIN from the submitted OrderComponents (review H3): the keeper
    // can no longer pair safe-looking components with the hash of a different,
    // underpaying order â€” validity is bound to the verified components themselves.
    bytes32 private constant SEAPORT_ORDER_TYPEHASH = keccak256(
        "Order(address offerer,address zone,OfferItem[] offer,ConsiderationItem[] consideration,uint8 orderType,uint256 startTime,uint256 endTime,bytes32 zoneHash,uint256 salt,bytes32 conduitKey,uint256 totalOriginalConsiderationItems,uint256 counter)"
    );
    bytes32 private constant SEAPORT_OFFER_ITEM_TYPEHASH = keccak256(
        "OfferItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount)"
    );
    bytes32 private constant SEAPORT_CONSIDERATION_ITEM_TYPEHASH = keccak256(
        "ConsiderationItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount,address recipient)"
    );

    /**
     * @notice Register a Seaport order for EIP-1271 signature validation (operator only)
     * @dev The keeper posts the FULL order components; the adapter verifies the proceeds
     *      routing on-chain (offer = exactly the liquidated NFT; consideration entirely
     *      in the lending asset with â‰¥ debtOwed paid to the market and all surplus to
     *      the current position holder), derives the Seaport canonical order hash, and
     *      registers THAT hash. Fulfillment validates via EIP-1271 against the derived
     *      hash, so a registered order's on-chain terms cannot diverge from what Seaport
     *      executes.
     */
    function registerOrder(address market, uint256 loanId, ISeaport.OrderComponents calldata components)
        external
        onlyOperator
    {
        if (!marketConfigs[market].isActive) revert UnconfiguredMarket();
        AuctionState storage auctionState = auctions[market][loanId];
        if (auctionState.status != AuctionStatus.OPEN) revert AuctionNotOpen();

        // Order must be made by this adapter (the offerer whose EIP-1271 we implement)
        if (components.offerer != address(this)) revert InvalidOrder();

        // Offer: exactly the collateral NFT being liquidated
        if (components.offer.length != 1) revert InvalidOrder();
        ISeaport.OfferItem calldata offer = components.offer[0];
        address collateralToken = ILendingMarketV2View(market).collateralAsset();
        if (offer.itemType != ISeaport.ItemType.ERC721) revert InvalidOrder();
        if (offer.token != collateralToken) revert InvalidOrder();
        if (offer.identifierOrCriteria != auctionState.tokenId) revert InvalidOrder();
        if (offer.startAmount != 1 || offer.endAmount != 1) revert InvalidOrder();

        // Consideration: entirely in the lending asset; the market must receive at
        // least debtOwed; every non-market item (surplus) must go to the position
        // holder. Seaport enforces these amounts at fulfillment, so routing is
        // enforced by the protocol, not by operator honesty.
        uint256 considerationCount = components.consideration.length;
        if (considerationCount == 0) revert InvalidOrder();
        address lendingToken = ILendingMarketV2View(market).lendingAsset();
        address holder = IPositionAdapter(ILendingMarketV2View(market).positionAdapter()).ownerOf(loanId);
        uint256 marketPayment = 0;
        for (uint256 i = 0; i < considerationCount; ++i) {
            ISeaport.ConsiderationItem calldata item = components.consideration[i];
            if (item.itemType != ISeaport.ItemType.ERC20) revert InvalidOrder();
            if (item.token != lendingToken) revert InvalidOrder();
            if (item.startAmount != item.endAmount) revert InvalidOrder();
            if (item.recipient == market) {
                marketPayment += item.startAmount;
            } else if (item.recipient != holder) {
                // surplus may only be routed to the current position holder
                revert InvalidOrder();
            }
        }
        if (marketPayment < auctionState.debtOwed) revert InvalidOrder();

        // Derive the Seaport canonical order hash from the verified components
        bytes32 orderHash = _deriveSeaportOrderHash(components);
        registeredOrders[orderHash] = true;
        orderForLoan[market][loanId] = orderHash;
        emit OrderRegistered(market, loanId, orderHash);
    }

    /// @notice Seaport canonical order hash (OrderHasher semantics, Seaport v1.4/v1.5)
    function deriveSeaportOrderHash(ISeaport.OrderComponents calldata components) external pure returns (bytes32) {
        return _deriveSeaportOrderHash(components);
    }

    function _deriveSeaportOrderHash(ISeaport.OrderComponents calldata components) internal pure returns (bytes32) {
        unchecked {
            uint256 offerLength = components.offer.length;
            bytes32[] memory offerHashes = new bytes32[](offerLength);
            for (uint256 i = 0; i < offerLength; ++i) {
                ISeaport.OfferItem calldata item = components.offer[i];
                offerHashes[i] = keccak256(
                    abi.encode(
                        SEAPORT_OFFER_ITEM_TYPEHASH,
                        item.itemType,
                        item.token,
                        item.identifierOrCriteria,
                        item.startAmount,
                        item.endAmount
                    )
                );
            }
            uint256 considerationLength = components.consideration.length;
            bytes32[] memory considerationHashes = new bytes32[](considerationLength);
            for (uint256 i = 0; i < considerationLength; ++i) {
                ISeaport.ConsiderationItem calldata item = components.consideration[i];
                considerationHashes[i] = keccak256(
                    abi.encode(
                        SEAPORT_CONSIDERATION_ITEM_TYPEHASH,
                        item.itemType,
                        item.token,
                        item.identifierOrCriteria,
                        item.startAmount,
                        item.endAmount,
                        item.recipient
                    )
                );
            }
            return keccak256(
                abi.encode(
                    SEAPORT_ORDER_TYPEHASH,
                    components.offerer,
                    components.zone,
                    keccak256(abi.encodePacked(offerHashes)),
                    keccak256(abi.encodePacked(considerationHashes)),
                    components.orderType,
                    components.startTime,
                    components.endTime,
                    components.zoneHash,
                    components.salt,
                    components.conduitKey,
                    components.totalOriginalConsiderationItems,
                    components.counter
                )
            );
        }
    }

    /**
     * @notice Cancel a registered Seaport order on-chain and invalidate locally (operator only)
     * @dev Review H4 fix: previously read `marketConfigs[msg.sender]` â€” but msg.sender is
     *      the operator, never a market, so `config.seaport` was always address(0) and the
     *      on-chain Seaport cancel was silently skipped forever. The market and loan are
     *      passed explicitly, and the hash must be the one registered for that loan.
     */
    function cancelRegisteredOrder(
        address market,
        uint256 loanId,
        bytes32 orderHash,
        ISeaport.OrderComponents calldata components
    ) external onlyOperator {
        if (!registeredOrders[orderHash]) revert InvalidOrder();
        if (orderForLoan[market][loanId] != orderHash) revert InvalidOrder();

        MarketConfig storage config = marketConfigs[market];
        if (config.seaport != address(0)) {
            ISeaport.OrderComponents[] memory orders = new ISeaport.OrderComponents[](1);
            orders[0] = components;
            try ISeaport(config.seaport).cancel(orders) {
                // cancelled on Seaport
            } catch {
                // Order may already be filled/cancelled; local invalidation still applies
            }
        }
        registeredOrders[orderHash] = false;
        cancelledOrders[orderHash] = true;
        emit OrderCancelled(orderHash);
    }

    /**
     * @notice Acknowledge settlement for the market's finalize step (M1 fail-closed)
     * @dev Called by the market during finalizeRedemptionSettlement; msg.sender IS the
     *      market for this loan's auction state. Returns:
     *      - SOLD (native sale) → (0, 0): proceeds already routed atomically in buy()
     *      - OPEN with NFT no longer in custody → (0, 0): Seaport sale landed proceeds
     *        as order consideration atomically
     *      - otherwise revert: no sale happened, so a bare donation of lending asset
    /// to the market must not be finalizable as fake recovery
     */
    function claimSettlement(uint256 loanId) external returns (uint256 claimedRecovered, uint256 claimedReturned) {
        address market = msg.sender;
        AuctionState storage auctionState = auctions[market][loanId];
        if (auctionState.status == AuctionStatus.NONE) revert SettlementNotReady();
        if (auctionState.status == AuctionStatus.OPEN) {
            address nft = ILendingMarketV2View(market).collateralAsset();
            bool saleCompleted;
            try IERC721(nft).ownerOf(auctionState.tokenId) returns (address currentOwner) {
                saleCompleted = currentOwner != address(this);
            } catch {
                // token burned/vanished: treat as a completed settlement path
                saleCompleted = true;
            }
            if (!saleCompleted) revert SettlementNotReady();
        }
        // Nothing to claim — proceeds already landed atomically via buy()/fulfillment.
        // The market finalizes on its measured balance delta; a (0,0) claim signals
        // "use delta only" rather than an explicit cross-check amount.
        return (0, 0);
    }

    /**
     * @notice EIP-1271: validate a Seaport order against the on-chain registry
     * @return magicValue 0x1626ba7e if the order hash is registered and not cancelled
     */
    function isValidSignature(bytes32 orderHash, bytes memory)
        external
        view
        returns (bytes4 magicValue)
    {
        if (registeredOrders[orderHash] && !cancelledOrders[orderHash]) {
            return EIP1271_MAGIC_VALUE;
        }
        return EIP1271_FAIL_VALUE;
    }

    // ============ Views ============

    function auction(address market, uint256 loanId) external view returns (AuctionState memory) {
        return auctions[market][loanId];
    }
}


