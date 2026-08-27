// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockRobinhoodToken
 * @notice Minimal Robinhood Stock Token surface for local tests.
 * @dev Models the documented 18-decimal ERC-20, uiMultiplier(), and
 *      oraclePaused() read paths without representing a production token.
 */
contract MockRobinhoodToken is ERC20 {
    uint256 public constant INITIAL_MULTIPLIER = 1e18;
    uint256 public mockMultiplier = INITIAL_MULTIPLIER;
    bool public pausedOracle;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function uiMultiplier() external view returns (uint256) {
        return mockMultiplier;
    }

    function oraclePaused() external view returns (bool) {
        return pausedOracle;
    }

    function setMultiplier(uint256 multiplier_) external {
        require(multiplier_ > 0, "Invalid multiplier");
        mockMultiplier = multiplier_;
    }

    function setOraclePaused(bool paused_) external {
        pausedOracle = paused_;
    }
}
