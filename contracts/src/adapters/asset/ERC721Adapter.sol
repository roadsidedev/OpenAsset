// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * @title ERC721Adapter
 * @notice Reference asset adapter for ERC721 (NFT) collateral
 * @dev Implements IAssetAdapter using ERC721Holder for safe NFT transfers.
 *      Stores the NFT contract address at construction — never uses msg.sender as the token.
 *      Escrow pulls from borrower to market; release pulls from market to recipient.
 */
contract ERC721Adapter is IAssetAdapter, ERC721Holder {

    IERC721 public immutable nft;

    constructor(address _nft) {
        require(_nft != address(0), "Invalid NFT");
        nft = IERC721(_nft);
    }

    /// @notice Escrow ERC721 NFT from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        nft.safeTransferFrom(from, msg.sender, amountOrId);
    }

    /// @notice Release ERC721 NFT from market to recipient
    function release(address to, uint256 amountOrId) external override {
        nft.safeTransferFrom(msg.sender, to, amountOrId);
    }

    /// @notice Check if NFT transfer would succeed (owner + approval check)
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        try nft.ownerOf(amountOrId) returns (address currentOwner) {
            if (currentOwner != from) return false;
            try nft.getApproved(amountOrId) returns (address approved) {
                if (approved == address(this)) return true;
            } catch {
                return false;
            }
            try nft.isApprovedForAll(from, address(this)) returns (bool approved) {
                return approved;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
}
