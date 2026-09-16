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
 * @dev Public getters only — `loans().collateralAmount` is the tokenId for ERC721 loans.
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
 *           1. Native on-chain Dutch auction — buyers pay in the market's lending asset
 *              (stablecoin); anyone can call buy() at the current decayed price.
 *           2. Seaport (OpenSea) direct sale — the keeper posts a stablecoin-denominated
 *              basic order on OpenSea; consideration routes debtOwed to the market and
 *              surplus directly to the holder at fulfillment time.
 * @dev Asynchronous adapter: liquidation flows through LIQUIDATION_CURE → settleLiquidation
 *      (collateral handoff to this adapter) → LIQUIDATION_SETTLING → finalizeRedemptionSettlement
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
        uint16 floorPriceBps;   // e.g. 8000 = 80% of debt; < 10000 → allowed shortfall
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
    // Seaport order hash → registered (EIP-1271 validity)
    mapping(bytes32 => bool) public registeredOrders;
    // Seaport order hash → cancelled/invalidated
    mapping(bytes32 => bool) public cancelledOrders;
    // order hash → raw OrderComponents (for on-chain cancel)
    mapping(bytes32 => bytes) public orderComponents;
    // (market, loanId) → registered order hash
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
        marketConfigs[market].seaportConduit = conduit; // may be address(0) → approve Seaport itself
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
     * @dev MUST return (0, 0) and move no lending asset — the market verifies isolation.
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
        AuctionState storage auction = auctions[msg.sender][loanId];
        if (auction.status != AuctionStatus.NONE) revert AuctionAlreadyListed();
        if (debtOwed == 0) revert InvalidAuctionParams();

        (uint256 collateralAmount, , , , , ) = ILendingMarketV2View(msg.sender).loans(loanId);
        uint256 startPrice = (debtOwed * config.startPriceBps) / BPS_DENOMINATOR;
        uint256 floorPrice = (debtOwed * config.floorPriceBps) / BPS_DENOMINATOR;

        auction.debtOwed = debtOwed;
        auction.startPrice = startPrice;
        auction.floorPrice = floorPrice;
        auction.startTime = uint64(block.timestamp);
        auction.endTime = uint64(block.timestamp + config.auctionDuration);
        auction.tokenId = collateralAmount;
        auction.status = AuctionStatus.OPEN;

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

        emit AuctionListed(msg.sender, loanId, startPrice, floorPrice, auction.endTime);
        return (0, 0);
    }

    // ============ Native Dutch Auction ============

    /**
     * @notice Current Dutch auction price (linear decay from startPrice to floorPrice)
     */
    function currentPrice(address market, uint256 loanId) public view returns (uint256) {
        AuctionState storage auction = auctions[market][loanId];
        if (auction.status != AuctionStatus.OPEN) revert AuctionNotOpen();
        MarketConfig storage config = marketConfigs[market];
        uint256 elapsed = block.timestamp >= auction.endTime
            ? config.auctionDuration
            : block.timestamp - auction.startTime;
        uint256 range = auction.startPrice - auction.floorPrice;
        return auction.startPrice - (range * elapsed) / config.auctionDuration;
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

        AuctionState storage auction = auctions[market][loanId];
        if (auction.status != AuctionStatus.OPEN) revert AuctionNotOpen();

        uint256 price = currentPrice(market, loanId);
        uint256 toMarket = price < auction.debtOwed ? price : auction.debtOwed;
        uint256 toHolder = price - toMarket;

        IERC20 lending = IERC20(ILendingMarketV2View(market).lendingAsset());
        if (toHolder > 0) {
            address holder = ILendingMarketV2View(market).positionAdapter();
            address holderAddress = IPositionAdapter(holder).ownerOf(loanId);
            lending.safeTransferFrom(msg.sender, holderAddress, toHolder);
        }
        lending.safeTransferFrom(msg.sender, market, toMarket);

        IERC721(ILendingMarketV2View(market).collateralAsset())
            .transferFrom(address(this), msg.sender, auction.tokenId);

        auction.status = AuctionStatus.SOLD;
        emit AuctionSold(market, loanId, msg.sender, price, toMarket, toHolder);

        // Invalidate any registered Seaport order so OpenSea can't double-sell
        bytes32 orderHash = orderForLoan[market][loanId];
        if (orderHash != bytes32(0) && registeredOrders[orderHash]) {
            registeredOrders[orderHash] = false;
            cancelledOrders[orderHash] = true;
            emit OrderCancelled(orderHash);
        }
    }

    // ============ Seaport (OpenSea) Direct Sale ============

    /**
     * @notice Register a Seaport order hash for EIP-1271 signature validation (operator only)
     * @dev The keeper constructs the order off-chain (offerer = this adapter, consideration
     *      denominated in the market's lending asset: debtOwed → market, surplus → holder),
     *      computes its hash, registers it here, then posts the signed order to OpenSea.
     *      Fulfillment validates via this adapter's EIP-1271 check; once invalidated (native
     *      sale or cancelRegisteredOrder), Seaport fulfillment reverts at validateOrder.
     * @param orderComponentsBytes Raw abi-encoded Seaport OrderComponents (kept for events/off-chain)
     */
    function registerOrder(address market, uint256 loanId, bytes32 orderHash, bytes calldata orderComponentsBytes)
        external
        onlyOperator
    {
        if (!marketConfigs[market].isActive) revert UnconfiguredMarket();
        if (orderComponentsBytes.length == 0) revert InvalidOrder();
        AuctionState storage auction = auctions[market][loanId];
        if (auction.status != AuctionStatus.OPEN) revert AuctionNotOpen();

        registeredOrders[orderHash] = true;
        orderForLoan[market][loanId] = orderHash;
        emit OrderRegistered(market, loanId, orderHash);
    }

    /**
     * @notice Cancel a registered Seaport order on-chain and invalidate locally (operator only)
     */
    function cancelRegisteredOrder(bytes32 orderHash, ISeaport.OrderComponents calldata components) external onlyOperator {
        if (!registeredOrders[orderHash]) revert InvalidOrder();

        MarketConfig storage config = marketConfigs[msg.sender];
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
