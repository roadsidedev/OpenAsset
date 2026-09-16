// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal mintable ERC721 for tests and local environments.
contract MockERC721 is ERC721, Ownable {
    uint256 public nextTokenId = 1;

    constructor() ERC721("MockNFT", "MNFT") Ownable() {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function mintNext(address to) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }
}
