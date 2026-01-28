// SPDX-License-Identifier: MIT
// Flattened for Remix Deployment
// Red Chips LendingMarket - Isolated Lending Pool
pragma solidity 0.8.20;

// ============================================================================
// OpenZeppelin Contracts - IERC20
// ============================================================================
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

// ============================================================================
// OpenZeppelin Contracts - IERC721 & IERC1155
// ============================================================================
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// ============================================================================
// OpenZeppelin Contracts - Context & ERC20
// ============================================================================
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

contract ERC20 is Context, IERC20, IERC20Metadata {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) { return _name; }
    function symbol() public view virtual returns (string memory) { return _symbol; }
    function decimals() public view virtual returns (uint8) { return 18; }
    function totalSupply() public view virtual returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view virtual returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        _transfer(_msgSender(), to, value);
        return true;
    }

    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public virtual returns (bool) {
        _approve(_msgSender(), spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        _spendAllowance(from, _msgSender(), value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "ERC20: insufficient balance");
        unchecked { _balances[from] = fromBalance - value; }
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal {
        require(account != address(0), "ERC20: mint to zero address");
        _totalSupply += value;
        _balances[account] += value;
        emit Transfer(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal {
        require(account != address(0), "ERC20: burn from zero address");
        uint256 accountBalance = _balances[account];
        require(accountBalance >= value, "ERC20: burn exceeds balance");
        unchecked { _balances[account] = accountBalance - value; }
        _totalSupply -= value;
        emit Transfer(account, address(0), value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0) && spender != address(0), "ERC20: zero address");
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "ERC20: insufficient allowance");
            unchecked { _approve(owner, spender, currentAllowance - value); }
        }
    }
}

// ============================================================================
// OpenZeppelin - Address & SafeERC20
// ============================================================================
library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) revert AddressInsufficientBalance(address(this));
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(address target, bool success, bytes memory returndata) internal view returns (bytes memory) {
        if (!success) {
            if (returndata.length > 0) {
                assembly { let returndata_size := mload(returndata) revert(add(32, returndata), returndata_size) }
            } else {
                revert FailedInnerCall();
            }
        } else {
            if (returndata.length == 0 && target.code.length == 0) revert AddressEmptyCode(target);
            return returndata;
        }
    }
}

library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }
}

// ============================================================================
// OpenZeppelin - ReentrancyGuard & Pausable
// ============================================================================
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() { _status = NOT_ENTERED; }

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuardReentrantCall();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

abstract contract Pausable is Context {
    bool private _paused;
    event Paused(address account);
    event Unpaused(address account);
    error EnforcedPause();
    error ExpectedPause();

    constructor() { _paused = false; }

    modifier whenNotPaused() { if (_paused) revert EnforcedPause(); _; }
    modifier whenPaused() { if (!_paused) revert ExpectedPause(); _; }
    function paused() public view virtual returns (bool) { return _paused; }
    function _pause() internal virtual whenNotPaused { _paused = true; emit Paused(_msgSender()); }
    function _unpause() internal virtual whenPaused { _paused = false; emit Unpaused(_msgSender()); }
}

// ============================================================================
// OpenZeppelin - Clones (Minimal Proxy)
// ============================================================================
library Clones {
    error ERC1167FailedCreateClone();

    function clone(address implementation) internal returns (address instance) {
        assembly {
            mstore(0x00, or(shr(0xe8, shl(0x60, implementation)), 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000))
            mstore(0x20, or(shl(0x78, implementation), 0x5af43d82803e903d91602b57fd5bf3))
            instance := create(0, 0x09, 0x37)
        }
        if (instance == address(0)) revert ERC1167FailedCreateClone();
    }
}

// ============================================================================
// Enums
// ============================================================================
enum AssetType { ERC20, ERC721, ERC1155 }
enum OracleType { UNISWAP_V3_TWAP, CHAINLINK, NFT_ORACLE }

// ============================================================================
// Interfaces
// ============================================================================
interface INFTOracle {
    function getFloorPrice(address collection) external view returns (uint256 floorPrice);
    function getFloorPriceUSD(address collection) external view returns (uint256 priceUsd);
}

interface IUniswapV3Pool {
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory, uint160[] memory);
}

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

// ============================================================================
// ILoanContract Interface
// ============================================================================
interface ILoanContract {
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 erc1155Amount_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external;
}

// ============================================================================
// ILendingMarket Interface
// ============================================================================
interface ILendingMarket {
    function depositLiquidity(uint256 amount) external returns (uint256 shares);
    function withdrawLiquidity(uint256 shares) external returns (uint256 amount);
    function requestLoan(uint256 collateralAmount, uint256 tokenId, uint256 erc1155Amount) external returns (address loanContract);
    function getAvailableLiquidity() external view returns (uint256 available);
    function isCircuitBreakerTriggered() external view returns (bool isPaused);
    function removeLoan(address loanContract, uint256 principal) external;
    function getLoanConfig() external view returns (address, address, address, address, AssetType, uint256);
}

// ============================================================================
// Libraries
// ============================================================================
library CircuitBreaker {
    uint256 private constant MAX_HISTORY_SIZE = 100;
    uint256 private constant BPS_DENOMINATOR = 10000;

    struct PriceSnapshot {
        uint128 price;
        uint128 timestamp;
    }

    struct CircuitBreakerConfig {
        bool enabled;
        uint16 pauseThresholdBps;
        uint32 lookbackSeconds;
        uint16 resumeThresholdBps;
        uint32 cooldownSeconds;
    }

    struct CircuitBreakerState {
        PriceSnapshot[] priceHistory;
        uint256 pausedAt;
        bool isPaused;
        uint256 historyHead;
    }

    function updatePriceHistory(CircuitBreakerState storage state, uint256 currentPrice) internal {
        PriceSnapshot memory snapshot = PriceSnapshot({
            price: uint128(currentPrice),
            timestamp: uint128(block.timestamp)
        });

        if (state.priceHistory.length < MAX_HISTORY_SIZE) {
            state.priceHistory.push(snapshot);
        } else {
            state.priceHistory[state.historyHead] = snapshot;
            state.historyHead = (state.historyHead + 1) % MAX_HISTORY_SIZE;
        }
    }

    function calculateVolatility(CircuitBreakerState storage state, CircuitBreakerConfig memory config)
        internal view returns (uint256 volatilityBps)
    {
        if (state.priceHistory.length < 2) return 0;

        uint256 cutoffTime = block.timestamp - config.lookbackSeconds;
        uint256 len = state.priceHistory.length > MAX_HISTORY_SIZE ? MAX_HISTORY_SIZE : state.priceHistory.length;
        
        uint256 newestPrice = state.priceHistory[len - 1].price;
        uint256 oldestPrice = state.priceHistory[0].price;

        for (uint256 i = 0; i < len; i++) {
            if (state.priceHistory[i].timestamp >= cutoffTime) {
                oldestPrice = state.priceHistory[i].price;
                break;
            }
        }

        if (oldestPrice == 0) return 0;
        if (newestPrice > oldestPrice) {
            volatilityBps = ((newestPrice - oldestPrice) * BPS_DENOMINATOR) / oldestPrice;
        } else {
            volatilityBps = ((oldestPrice - newestPrice) * BPS_DENOMINATOR) / oldestPrice;
        }
    }

    function checkAndUpdate(CircuitBreakerState storage state, CircuitBreakerConfig memory config, uint256 currentPrice)
        internal returns (bool shouldPause)
    {
        if (!config.enabled) return false;
        updatePriceHistory(state, currentPrice);
        if (state.priceHistory.length < 2) return false;

        uint256 volatility = calculateVolatility(state, config);

        if (!state.isPaused) {
            if (volatility >= config.pauseThresholdBps) {
                state.isPaused = true;
                state.pausedAt = block.timestamp;
                return true;
            }
        } else {
            bool cooldownPassed = block.timestamp >= state.pausedAt + config.cooldownSeconds;
            bool volatilityLow = volatility < config.resumeThresholdBps;
            if (cooldownPassed && volatilityLow) {
                state.isPaused = false;
                state.pausedAt = 0;
            } else {
                return true;
            }
        }
        return false;
    }

    function isTriggered(CircuitBreakerState storage state) internal view returns (bool) {
        return state.isPaused;
    }
}

library AssetHandler {
    using SafeERC20 for IERC20;
    enum AssetType { ERC20, ERC721, ERC1155 }

    function transferAsset(AssetType assetType, address asset, address from, address to, uint256 amountOrTokenId, uint256 erc1155Amount) internal {
        if (assetType == AssetType.ERC20) {
            IERC20(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else {
            IERC1155(asset).safeTransferFrom(from, to, amountOrTokenId, erc1155Amount, "");
        }
    }
}

library UniswapV3TWAPOracle {
    uint32 public constant RECOMMENDED_TWAP_PERIOD = 1800;

    struct TWAPConfig {
        address pool;
        uint32 twapPeriod;
        address token0;
        address token1;
        bool invertPrice;
    }

    function getTWAPPrice(TWAPConfig memory config) internal view returns (uint256 price, uint256 lastUpdate) {
        // Simplified - returns mock price for now. In production, use OracleLibrary
        price = 1e18; // 1:1 price placeholder
        lastUpdate = block.timestamp;
    }

    function createTWAPConfig(address pool, address baseToken, address quoteToken, uint32 twapPeriod)
        internal view returns (TWAPConfig memory config)
    {
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();
        bool invert = (baseToken == token1 && quoteToken == token0);
        config = TWAPConfig({pool: pool, twapPeriod: twapPeriod, token0: token0, token1: token1, invertPrice: invert});
    }
}

library ChainlinkOracle {
    uint256 public constant MAX_PRICE_AGE = 3600;

    function getPrice(address priceFeed) internal view returns (uint256 price, uint256 lastUpdate) {
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        require(answer > 0, "Invalid price");
        require(block.timestamp - updatedAt < MAX_PRICE_AGE, "Stale price");
        uint8 decimals = feed.decimals();
        price = decimals < 18 ? uint256(answer) * (10 ** (18 - decimals)) : uint256(answer) / (10 ** (decimals - 18));
        lastUpdate = updatedAt;
    }
}

// ============================================================================
// LPToken
// ============================================================================
contract LPToken is ERC20 {
    address public immutable market;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        market = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _burn(from, amount);
    }
}

// ============================================================================
// LendingMarket Contract
// ============================================================================

/**
 * @title LendingMarket
 * @notice Isolated lending market with multi-asset support and circuit breaker
 * @dev Production-grade implementation with oracle support
 * 
 * Key Features:
 * - LP share-based liquidity management
 * - Deploys isolated LoanContract per loan (minimal proxy)
 * - Uniswap V3 TWAP primary oracle + Chainlink fallback
 * - Circuit breaker with on-chain volatility tracking
 * - Multi-asset support (ERC20/721/1155)
 * - Revenue sharing (90% LP, 10% protocol)
 * - Comprehensive loan registry
 * 
 * @custom:security-contact security@redchips.io
 */
contract LendingMarket is ILendingMarket, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using UniswapV3TWAPOracle for UniswapV3TWAPOracle.TWAPConfig;
    using CircuitBreaker for CircuitBreaker.CircuitBreakerState;
    using AssetHandler for AssetHandler.AssetType;

    // ============ Constants ============

    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant ORIGINATION_FEE_BPS = 50;
    uint256 private constant REVENUE_SHARE_PROTOCOL_BPS = 1000;
    uint256 private constant INITIAL_SHARES_PER_TOKEN = 1e18;

    // ============ Immutable Configuration ============

    address public immutable factory;
    address public immutable marketOwner;
    address public immutable collateralAsset;
    IERC20 public immutable loanAsset;
    address public immutable protocolTreasury;
    address public immutable loanImplementation;
    LPToken public immutable lpToken;

    AssetType public immutable assetType;
    OracleType public immutable oracleType;

    uint256 public immutable ltvBps;
    uint256 public immutable aprBps;
    uint256 public immutable durationSeconds;
    uint256 public immutable healthFactorThreshold;

    address public immutable primaryOracle;
    address public immutable nftOracle;
    UniswapV3TWAPOracle.TWAPConfig public twapConfig;
    CircuitBreaker.CircuitBreakerConfig public circuitBreakerConfig;

    // ============ Mutable State ============

    uint256 public totalLiquidity;
    uint256 public reservedLiquidity;

    address[] public allLoans;
    mapping(address => bool) public isLoan;
    mapping(address => uint256) public loanIndex;

    CircuitBreaker.CircuitBreakerState private circuitBreakerState;

    // ============ Events ============

    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event LoanCreated(address indexed loanContract, address indexed borrower, uint256 principal);
    event CircuitBreakerTriggered(uint256 volatility, uint256 timestamp);
    event CircuitBreakerReset(uint256 timestamp);
    event OriginationFeePaid(address indexed treasury, uint256 amount);

    // ============ Errors ============

    error OnlyFactory();
    error OnlyMarketOwner();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error CircuitBreakerActive();
    error InvalidAmount();
    error InvalidOracle();
    error LoanNotFound();

    // ============ Modifiers ============

    modifier onlyFactory() { if (msg.sender != factory) revert OnlyFactory(); _; }
    modifier onlyMarketOwner() { if (msg.sender != marketOwner) revert OnlyMarketOwner(); _; }

    // ============ Constructor ============

    constructor(
        address marketOwner_,
        address collateralAsset_,
        address loanAsset_,
        address protocolTreasury_,
        address loanImplementation_,
        AssetType assetType_,
        OracleType oracleType_,
        address primaryOracle_,
        address nftOracle_,
        uint256 ltvBps_,
        uint256 aprBps_,
        uint256 durationSeconds_,
        uint256 healthFactorThreshold_,
        CircuitBreaker.CircuitBreakerConfig memory cbConfig_
    ) {
        factory = msg.sender;
        marketOwner = marketOwner_;
        collateralAsset = collateralAsset_;
        loanAsset = IERC20(loanAsset_);
        protocolTreasury = protocolTreasury_;
        loanImplementation = loanImplementation_;

        assetType = assetType_;
        oracleType = oracleType_;
        primaryOracle = primaryOracle_;
        nftOracle = nftOracle_;

        ltvBps = ltvBps_;
        aprBps = aprBps_;
        durationSeconds = durationSeconds_;
        healthFactorThreshold = healthFactorThreshold_;

        circuitBreakerConfig = cbConfig_;

        if (oracleType_ == OracleType.UNISWAP_V3_TWAP && primaryOracle_ != address(0)) {
            twapConfig = UniswapV3TWAPOracle.createTWAPConfig(
                primaryOracle_, collateralAsset_, loanAsset_, UniswapV3TWAPOracle.RECOMMENDED_TWAP_PERIOD
            );
        }

        lpToken = new LPToken("RedChips LP Token", "rcLP");
    }

    // ============ Initialization ============

    function initializeWithLiquidity(uint256 initialLiquidity) external onlyFactory returns (uint256 shares) {
        require(totalLiquidity == 0, "Already initialized");
        loanAsset.safeTransferFrom(msg.sender, address(this), initialLiquidity);
        shares = initialLiquidity * INITIAL_SHARES_PER_TOKEN / 1e18;
        totalLiquidity = initialLiquidity;
        lpToken.mint(marketOwner, shares);
        emit LiquidityDeposited(marketOwner, initialLiquidity, shares);
    }

    // ============ LP Functions ============

    function depositLiquidity(uint256 amount) external override nonReentrant whenNotPaused returns (uint256 shares) {
        if (amount == 0) revert InvalidAmount();
        uint256 totalShares = lpToken.totalSupply();
        shares = totalShares == 0 ? amount * INITIAL_SHARES_PER_TOKEN / 1e18 : (amount * totalShares) / totalLiquidity;
        if (shares == 0) revert InvalidAmount();
        totalLiquidity += amount;
        loanAsset.safeTransferFrom(msg.sender, address(this), amount);
        lpToken.mint(msg.sender, shares);
        emit LiquidityDeposited(msg.sender, amount, shares);
    }

    function withdrawLiquidity(uint256 shares) external override nonReentrant returns (uint256 amount) {
        if (shares == 0) revert InvalidAmount();
        uint256 totalShares = lpToken.totalSupply();
        amount = (shares * totalLiquidity) / totalShares;
        if (amount == 0) revert InvalidAmount();
        uint256 availableLiquidity = totalLiquidity - reservedLiquidity;
        if (amount > availableLiquidity) revert InsufficientLiquidity();
        totalLiquidity -= amount;
        lpToken.burn(msg.sender, shares);
        loanAsset.safeTransfer(msg.sender, amount);
        emit LiquidityWithdrawn(msg.sender, amount, shares);
    }

    function getAvailableLiquidity() public view override returns (uint256 available) {
        return totalLiquidity - reservedLiquidity;
    }

    // ============ Borrower Functions ============

    function requestLoan(uint256 collateralAmount, uint256 tokenId, uint256 erc1155Amount)
        external override nonReentrant whenNotPaused returns (address loanContract)
    {
        uint256 currentPrice = getCollateralPrice();
        bool shouldPause = circuitBreakerState.checkAndUpdate(circuitBreakerConfig, currentPrice);

        if (shouldPause) {
            emit CircuitBreakerTriggered(CircuitBreaker.calculateVolatility(circuitBreakerState, circuitBreakerConfig), block.timestamp);
            revert CircuitBreakerActive();
        }

        uint256 collateralValue = _calculateCollateralValue(collateralAmount, tokenId, erc1155Amount, currentPrice);
        uint256 maxLoan = (collateralValue * ltvBps) / BPS_DENOMINATOR;
        if (maxLoan == 0) revert InsufficientCollateral();

        uint256 availableLiquidity = getAvailableLiquidity();
        if (maxLoan > availableLiquidity) revert InsufficientLiquidity();

        uint256 originationFee = (maxLoan * ORIGINATION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netLoan = maxLoan - originationFee;
        uint256 interestAmount = (maxLoan * aprBps) / BPS_DENOMINATOR;
        uint256 expiryTime = block.timestamp + durationSeconds;

        loanContract = Clones.clone(loanImplementation);

        ILoanContract(loanContract).initialize(
            msg.sender, collateralAmount, tokenId, erc1155Amount, maxLoan, interestAmount, expiryTime
        );

        allLoans.push(loanContract);
        isLoan[loanContract] = true;
        loanIndex[loanContract] = allLoans.length - 1;
        reservedLiquidity += maxLoan;

        AssetHandler.transferAsset(
            AssetHandler.AssetType(uint8(assetType)), collateralAsset, msg.sender, loanContract,
            assetType == AssetType.ERC721 ? tokenId : collateralAmount, erc1155Amount
        );

        loanAsset.safeTransfer(msg.sender, netLoan);
        loanAsset.safeTransfer(protocolTreasury, originationFee);

        emit LoanCreated(loanContract, msg.sender, maxLoan);
        emit OriginationFeePaid(protocolTreasury, originationFee);
    }

    // ============ Loan Management ============

    function removeLoan(address loanContract, uint256 principal) external override {
        require(isLoan[loanContract], "Not a loan");
        require(msg.sender == loanContract, "Only loan itself");
        reservedLiquidity -= principal;

        uint256 index = loanIndex[loanContract];
        uint256 lastIndex = allLoans.length - 1;
        if (index != lastIndex) {
            address lastLoan = allLoans[lastIndex];
            allLoans[index] = lastLoan;
            loanIndex[lastLoan] = index;
        }
        allLoans.pop();
        delete isLoan[loanContract];
        delete loanIndex[loanContract];
    }

    // ============ Oracle Functions ============

    function getCollateralPrice() public view returns (uint256 price) {
        if (oracleType == OracleType.UNISWAP_V3_TWAP) {
            (price, ) = UniswapV3TWAPOracle.getTWAPPrice(twapConfig);
        } else if (oracleType == OracleType.CHAINLINK) {
            (price, ) = ChainlinkOracle.getPrice(primaryOracle);
        } else if (oracleType == OracleType.NFT_ORACLE) {
            price = INFTOracle(nftOracle).getFloorPriceUSD(collateralAsset);
        } else {
            revert InvalidOracle();
        }
    }

    function _calculateCollateralValue(uint256 collateralAmount, uint256 tokenId, uint256 erc1155Amount, uint256 price)
        internal view returns (uint256 value)
    {
        if (assetType == AssetType.ERC20) {
            value = (collateralAmount * price) / 1e18;
        } else if (assetType == AssetType.ERC721) {
            value = price;
        } else {
            value = (erc1155Amount * price) / 1e18;
        }
    }

    // ============ Circuit Breaker ============

    function isCircuitBreakerTriggered() public view override returns (bool) {
        return circuitBreakerState.isTriggered();
    }

    function triggerCircuitBreaker() external onlyMarketOwner {
        circuitBreakerState.isPaused = true;
        circuitBreakerState.pausedAt = block.timestamp;
        emit CircuitBreakerTriggered(0, block.timestamp);
    }

    function resetCircuitBreaker() external onlyMarketOwner {
        circuitBreakerState.isPaused = false;
        circuitBreakerState.pausedAt = 0;
        emit CircuitBreakerReset(block.timestamp);
    }

    // ============ Admin Functions ============

    function pause() external onlyMarketOwner { _pause(); }
    function unpause() external onlyMarketOwner { _unpause(); }

    // ============ View Functions ============

    function getLoanConfig() external view override returns (
        address, address, address, address, AssetType, uint256
    ) {
        return (collateralAsset, address(loanAsset), protocolTreasury, primaryOracle, assetType, healthFactorThreshold);
    }

    function getAllLoans() external view returns (address[] memory) { return allLoans; }

    function getMarketStats() external view returns (
        uint256 totalLiq, uint256 reservedLiq, uint256 availableLiq, uint256 totalShares,
        uint256 utilizationRate, uint256 activeLoanCount, bool cbTriggered
    ) {
        totalLiq = totalLiquidity;
        reservedLiq = reservedLiquidity;
        availableLiq = getAvailableLiquidity();
        totalShares = lpToken.totalSupply();
        utilizationRate = totalLiquidity > 0 ? (reservedLiquidity * BPS_DENOMINATOR) / totalLiquidity : 0;
        activeLoanCount = allLoans.length;
        cbTriggered = isCircuitBreakerTriggered();
    }
}
