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

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address collateralToken) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(collateralToken != address(0), "Invalid token");
        marketConfigs[market] = MarketConfig({ token: IERC20(collateralToken) });
    }

    /// @notice Escrow ERC20 collateral from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        IERC20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(from, msg.sender, amountOrId);
    }

    /// @notice Release ERC20 collateral from market to recipient
    function release(address to, uint256 amountOrId) external override {
        IERC20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(msg.sender, to, amountOrId);
    }

    /// @notice Check if ERC20 transfer would succeed
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        IERC20 token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;
        uint256 balance = token.balanceOf(from);
        uint256 allowance = token.allowance(from, address(this));
        return balance >= amountOrId && allowance >= amountOrId;
    }
}
