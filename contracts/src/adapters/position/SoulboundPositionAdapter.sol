// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title SoulboundPositionAdapter
 * @notice Reference position adapter — non-transferable ERC721
 * @dev Implements IPositionAdapter as a soulbound (non-transferable) ERC721.
 *      Transfer always reverts — the position can never change hands.
 *
 * Default for any market with a non-null Compliance Adapter:
 * RWA, tokenized equities, any issuer-permissioned asset.
 *
 * Gets wallet visibility, cross-market enumeration via standard NFT tooling,
 * and third-party/institutional reporting compatibility, with zero
 * compliance-bypass risk since it can never change hands.
 */
contract SoulboundPositionAdapter is ERC721, IPositionAdapter {
    address public immutable factory;
    mapping(address => bool) public authorizedMarkets;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) ERC721("OpenAsset Market Soulbound Position", "rcSBP") {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    /// @notice Register a market to use this adapter (callable only by factory)
    function registerMarket(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override onlyMarket {
        _safeMint(to, loanId);
    }

    function ownerOf(uint256 loanId) public view override(ERC721, IPositionAdapter) returns (address) {
        if (!_exists(loanId)) return address(0);
        return ERC721.ownerOf(loanId);
    }

    function burn(uint256 loanId) external override onlyMarket {
        _burn(loanId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal pure override {
        require(to == address(0), "Soulbound: transfer not allowed");
    }
}
