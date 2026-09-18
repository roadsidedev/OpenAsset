// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface ILendingMarketLiquidationView {
    function collateralAsset() external view returns (address);
    function lendingAsset() external view returns (address);
    function getLoanDetails(uint256 loanId) external view returns (
        uint256 collateralAmount,
        uint256 principal,
        uint256 startTime,
        uint256 expiryTime,
        uint256 frozenInterestAt,
        uint8 status,
        uint256 healthFactor,
        address positionHolder
    );
    function getLiquidationMinOutput(uint256 collateralAmount, uint256 debtOwed, uint16 slippageBps)
        external view returns (uint256 minOutput, bool oracleTrusted);
}

/**
 * @title DEXSwapLiquidationAdapter
 * @notice Multi-tenant Uniswap V3 liquidation adapter for divisible collateral.
 * @dev The adapter pulls collateral from the calling market through its asset
 *      adapter, swaps it for the market lending asset, pays the debt to the
 *      market, and returns swap surplus to the current position holder.
 */
contract DEXSwapLiquidationAdapter is ILiquidationAdapter {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public owner;
    address public router;

    uint24 public constant DEFAULT_POOL_FEE = 3000;

    event AdapterRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event MarketRouterUpdated(address indexed market, address indexed routerOverride);
    event LiquidationExecuted(
        address indexed market,
        uint256 indexed loanId,
        address indexed router,
        uint256 collateralSwapped,
        uint256 amountOut,
        uint256 minOutput,
        uint256 returnedToHolder
    );

    struct MarketConfig {
        address assetAdapter;
        address oracleAdapter;
        // Per-market router override (e.g., Aerodrome Slipstream vs Uniswap V3 on the same chain).
        // address(0) → fall back to the adapter-wide `router`.
        address router;
        uint24 poolFee;
        uint16 maxSlippageBps;
        bool isActive;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyConfiguredMarket() {
        require(marketConfigs[msg.sender].isActive, "Unconfigured market");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        owner = msg.sender;
    }

    function transferOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit AdapterOwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---- Router allowlist (review H2) -----------------------------------------
    // Approving collateral to an arbitrary contract is a total asset-drain
    // authority, so the router must be on the owner-managed allowlist before it
    // can be set as the global default or a per-market override.

    mapping(address => bool) public approvedRouters;

    event RouterApproved(address indexed router);
    event RouterRevoked(address indexed router);
    event AdapterOwnerTransferred(address indexed oldOwner, address indexed newOwner);

    function addApprovedRouter(address routerToApprove) external onlyOwner {
        require(routerToApprove != address(0), "Invalid router");
        require(routerToApprove.code.length > 0, "Invalid router");
        if (!approvedRouters[routerToApprove]) {
            approvedRouters[routerToApprove] = true;
            emit RouterApproved(routerToApprove);
        }
    }

    function removeApprovedRouter(address routerToRevoke) external onlyOwner {
        if (approvedRouters[routerToRevoke]) {
            delete approvedRouters[routerToRevoke];
            emit RouterRevoked(routerToRevoke);
        }
    }

    modifier routerAllowed(address routerAddr) {
        require(routerAddr != address(0) && approvedRouters[routerAddr], "Router not allowlisted");
        _;
    }

    function setRouter(address newRouter) external onlyOwner routerAllowed(newRouter) {
        emit AdapterRouterUpdated(router, newRouter);
        router = newRouter;
    }

    /// @notice Set the swap router for one market (factory or adapter owner)
    /// @dev Enables one adapter instance to serve markets on different venues
    ///      (e.g., B20 stocks → Aerodrome Slipstream, RH stocks → Uniswap V3).
    ///      router == address(0) clears the override (fall back to global router).
    function setMarketRouter(address market, address routerOverride) external {
        require(msg.sender == factory || msg.sender == owner, "Not authorized");
        require(marketConfigs[market].isActive, "Unconfigured market");
        if (routerOverride != address(0)) require(approvedRouters[routerOverride], "Router not allowlisted");
        marketConfigs[market].router = routerOverride;
        emit MarketRouterUpdated(market, routerOverride);
    }

    /// @notice Effective swap routing config for a market (factory validation + monitoring)
    /// @return effectiveRouter Per-market override if set, else the global router
    /// @return poolFee Current per-market pool fee tier
    /// @return maxSlippageBps Current per-market slippage bound
    /// @return isActive Whether the market is configured
    function getMarketLiquidationConfig(address market)
        external
        view
        returns (address effectiveRouter, uint24 poolFee, uint16 maxSlippageBps, bool isActive)
    {
        MarketConfig storage config = marketConfigs[market];
        effectiveRouter = config.router != address(0) ? config.router : router;
        return (effectiveRouter, config.poolFee, config.maxSlippageBps, config.isActive);
    }

    function configure(address market, address assetAdapter) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(assetAdapter != address(0), "Invalid asset adapter");
        marketConfigs[market] = MarketConfig({
            assetAdapter: assetAdapter,
            oracleAdapter: address(0),
            router: address(0), // inherit global router until a per-market override is set
            poolFee: DEFAULT_POOL_FEE,
            maxSlippageBps: 0,
            isActive: true
        });
    }

    function configureRisk(address market, address oracleAdapter, uint16 maxSlippageBps) external onlyFactory {
        require(marketConfigs[market].isActive, "Unconfigured market");
        require(oracleAdapter != address(0), "Invalid oracle adapter");
        require(maxSlippageBps <= 5000, "Slippage too high");
        marketConfigs[market].oracleAdapter = oracleAdapter;
        marketConfigs[market].maxSlippageBps = maxSlippageBps;
    }

    function configurePoolFee(address market, uint24 poolFee) external onlyOwner {
        require(marketConfigs[market].isActive, "Unconfigured market");
        require(poolFee > 0, "Invalid pool fee");
        marketConfigs[market].poolFee = poolFee;
    }

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyConfiguredMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        require(router != address(0), "Router not configured");
        require(debtOwed > 0, "Invalid debt");

        ILendingMarketLiquidationView market = ILendingMarketLiquidationView(msg.sender);
        address collateralToken = market.collateralAsset();
        address lendingToken = market.lendingAsset();
        require(collateralToken != address(0) && lendingToken != address(0), "Invalid market assets");
        require(collateralToken != lendingToken, "Identical market assets");

        // Effective router: per-market override takes precedence over the global default
        address effectiveRouter = marketConfigs[msg.sender].router != address(0)
            ? marketConfigs[msg.sender].router
            : router;
        require(effectiveRouter != address(0), "Router not configured");

        (uint256 collateralAmount,,,,,,, address holder) = market.getLoanDetails(loanId);
        require(collateralAmount > 0 && holder != address(0), "Invalid loan collateral");
        (uint256 minimumOutput, bool oracleTrusted) = market.getLiquidationMinOutput(
            collateralAmount,
            debtOwed,
            marketConfigs[msg.sender].maxSlippageBps
        );
        require(oracleTrusted && minimumOutput > 0, "Liquidation quote unavailable");

        IERC20 collateral = IERC20(collateralToken);
        require(collateral.balanceOf(address(this)) >= collateralAmount, "Collateral not handed off");
        collateral.safeApprove(effectiveRouter, 0);
        collateral.safeApprove(effectiveRouter, collateralAmount);

        // Deadline with 15-minute grace to prevent grief on congested blocks;
        // capped to avoid indefinite pending. minimumOutput already enforces slippage.
        uint256 swapDeadline = block.timestamp + 900;
        uint256 amountOut = IUniswapV3SwapRouter(effectiveRouter).exactInputSingle(
            IUniswapV3SwapRouter.ExactInputSingleParams({
                tokenIn: collateralToken,
                tokenOut: lendingToken,
                fee: marketConfigs[msg.sender].poolFee,
                recipient: address(this),
                deadline: swapDeadline,
                amountIn: collateralAmount,
                amountOutMinimum: minimumOutput,
                sqrtPriceLimitX96: 0
            })
        );

        require(amountOut >= debtOwed, "Insufficient liquidation output");
        IERC20 lending = IERC20(lendingToken);
        lending.safeTransfer(msg.sender, debtOwed);

        returnedToHolder = amountOut - debtOwed;
        if (returnedToHolder > 0) {
            lending.safeTransfer(holder, returnedToHolder);
        }
        recoveredForLP = debtOwed;

        emit LiquidationExecuted(
            msg.sender,
            loanId,
            effectiveRouter,
            collateralAmount,
            amountOut,
            minimumOutput,
            returnedToHolder
        );
    }

    /// @inheritdoc ILiquidationAdapter
    function isAsynchronous() external pure override returns (bool) {
        return false;
    }

    /// @inheritdoc ILiquidationAdapter
    function cureWindowSeconds() external pure override returns (uint256) {
        return 0;
    }

    function requiresCollateralHandoff() external pure override returns (bool) {
        return true;
    }
}
