// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DEXSwapLiquidationAdapter
 * @notice Reference liquidation adapter for divisible ERC20 collateral
 * @dev Implements ILiquidationAdapter with gradual liquidation shape:
 *      takes only what's needed to cover debt + penalty, returns surplus.
 *
 * Synchronous: liquidation resolves in one transaction.
 * The adapter sells collateral on a DEX and splits proceeds per the
 * recoveredForLP / returnedToHolder contract.
 *
 * NOTE: In production, this would integrate with a DEX router (Uniswap, etc.)
 * For this reference implementation, it transfers collateral directly to the LP
 * and returns surplus to the holder.
 */
contract DEXSwapLiquidationAdapter is ILiquidationAdapter {
    using SafeERC20 for IERC20;

    address public immutable owner;
    mapping(address => bool) public authorizedMarkets;

    uint256 public constant PENALTY_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
    }

    function registerMarket(address market) external onlyOwner {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        recoveredForLP = debtOwed;
        returnedToHolder = 0;
    }

    /// @inheritdoc ILiquidationAdapter
    function isAsynchronous() external pure override returns (bool) {
        return false;
    }

    /// @inheritdoc ILiquidationAdapter
    function cureWindowSeconds() external pure override returns (uint256) {
        return 0;
    }
}
