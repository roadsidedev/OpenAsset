// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapter.sol";

/**
 * @title MockPositionAdapter
 * @notice Test-only position adapter for tracking loan positions
 * @dev Implements IPositionAdapter. In mock mode, tracks positions
 *      in a mapping (no ERC721 minting). Useful for testing the core
 *      engine without NFT overhead.
 */
contract MockPositionAdapter is IPositionAdapter {
    // loanId => owner address
    mapping(uint256 => address) public positionOwners;

    // market => authorized
    mapping(address => bool) public authorizedMarkets;

    // Tracking
    uint256 public mintCount;
    uint256 public burnCount;

    event PositionMinted(uint256 indexed loanId, address indexed to);
    event PositionBurned(uint256 indexed loanId);
    event PositionTransferred(uint256 indexed loanId, address indexed from, address indexed to);

    /// @notice Authorize a market to mint/burn positions on this adapter (called by the factory)
    function registerMarket(address market) external {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override {
        positionOwners[loanId] = to;
        mintCount++;
        emit PositionMinted(loanId, to);
    }

    function ownerOf(uint256 loanId) external view override returns (address) {
        return positionOwners[loanId];
    }

    function burn(uint256 loanId) external override {
        delete positionOwners[loanId];
        burnCount++;
        emit PositionBurned(loanId);
    }

    // Helper for testing transfers
    function transferPosition(uint256 loanId, address to) external {
        address from = positionOwners[loanId];
        require(from != address(0), "No position to transfer");
        positionOwners[loanId] = to;
        emit PositionTransferred(loanId, from, to);
    }
}
