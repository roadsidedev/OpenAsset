// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ERC20Adapter
 * @notice Multi-tenant asset adapter for ERC20 collateral
 * @dev Implements IAssetAdapter with SafeERC20 for secure transfers.
 *      Uses the multi-tenancy pattern: the factory calls configure() once per market,
 *      storing the market's collateral token address in a mapping keyed by market.
 *      Escrow pulls from borrower to market; release pulls from market to recipient.
 */
contract ERC20Adapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    address public immutable factory;

    struct MarketConfig {
        IERC20 token;
    }

    mapping(address => MarketConfig) public marketConfigs;

    event MarketConfigured(address indexed market, address indexed token);
    event CollateralEscrowed(address indexed market, address indexed from, uint256 amount);
    event CollateralReleased(address indexed market, address indexed to, uint256 amount);

    error NotAnERC20(address token);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address collateralToken) external override onlyFactory {
        require(market != address(0), "Invalid market");
        require(collateralToken != address(0), "Invalid token");
        // Review M7: one-time config — remapping a live market's token would corrupt
        // its escrow/release integrity (factory-key attack surface otherwise).
        require(address(marketConfigs[market].token) == address(0), "Already configured");

        // Fail-closed: reject collateral that doesn't implement ERC20. Low-level probe
        // with explicit returndata-length guard (a plain try/catch on an EOA target
        // panics on empty returndata instead of entering the catch block).
        if (collateralToken.code.length == 0) revert NotAnERC20(collateralToken);
        (bool probeOk, bytes memory probeData) = collateralToken.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        if (!probeOk || probeData.length < 32) revert NotAnERC20(collateralToken);

        marketConfigs[market] = MarketConfig({ token: IERC20(collateralToken) });
        emit MarketConfigured(market, collateralToken);
    }

    /// @notice Escrow ERC20 collateral from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        IERC20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(from, msg.sender, amountOrId);
        emit CollateralEscrowed(msg.sender, from, amountOrId);
    }

    /// @notice Release ERC20 collateral from market to recipient
    function release(address to, uint256 amountOrId) external override {
        IERC20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(msg.sender, to, amountOrId);
        emit CollateralReleased(msg.sender, to, amountOrId);
    }

    /// @notice Check if ERC20 transfer would succeed
    /// @dev Allowance is checked against this adapter (address(this)), which is the
    ///      actual spender in `escrow` (adapter calls token.safeTransferFrom).
    ///      For fee-on-transfer or rebasing tokens, the market additionally verifies
    ///      delivered balance delta in escrow (fail-closed invariant).
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        if (amountOrId == 0) return false;
        IERC20 token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;
        // Fail-closed on token reverts
        try token.balanceOf(from) returns (uint256 balance) {
            if (balance < amountOrId) return false;
            // Spender is this adapter (escrow calls token.transferFrom via adapter)
            try token.allowance(from, address(this)) returns (uint256 allowance) {
                return allowance >= amountOrId;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
}
