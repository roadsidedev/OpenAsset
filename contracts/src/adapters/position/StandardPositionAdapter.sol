// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapter.sol";

/**
 * @title StandardPositionAdapter
 * @notice Reference position adapter — no token, plain mapping
 * @dev Implements IPositionAdapter with minimal gas overhead.
 *      Positions are tracked in a mapping with no ERC721 minting.
 *      Cheapest gas, lowest complexity.
 *
 * Default use case: simple crypto-native markets with no compliance
 * requirement and no need for secondary-market/tooling benefits.
 */
contract StandardPositionAdapter is IPositionAdapter {
    address public immutable factory;
    mapping(address => bool) public authorizedMarkets;

    // loanId => owner
    mapping(uint256 => address) public positionOwners;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    /// @notice Register a market to use this adapter (callable only by factory)
    function registerMarket(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override onlyMarket {
        positionOwners[loanId] = to;
    }

    function ownerOf(uint256 loanId) external view override returns (address) {
        return positionOwners[loanId];
    }

    function burn(uint256 loanId) external override onlyMarket {
        delete positionOwners[loanId];
    }
}
