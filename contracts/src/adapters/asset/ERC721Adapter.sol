// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * @title ERC721Adapter
 * @notice Multi-tenant asset adapter for ERC721 (NFT) collateral
 * @dev Implements IAssetAdapter using ERC721Holder for safe NFT transfers.
 *      Uses the multi-tenancy pattern: the factory calls configure() once per market,
 *      storing the market's NFT contract address in a mapping keyed by market.
 *      Escrow pulls from borrower to market; release pulls from market to recipient.
 */
contract ERC721Adapter is IAssetAdapter, ERC721Holder {

    address public immutable factory;

    struct MarketConfig {
        IERC721 nft;
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

    function configure(address market, address nftAddress) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(nftAddress != address(0), "Invalid NFT");
        marketConfigs[market] = MarketConfig({ nft: IERC721(nftAddress) });
    }

    /// @notice Escrow ERC721 NFT from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        IERC721 token = marketConfigs[msg.sender].nft;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(from, msg.sender, amountOrId);
    }

    /// @notice Release ERC721 NFT from market to recipient
    function release(address to, uint256 amountOrId) external override {
        IERC721 token = marketConfigs[msg.sender].nft;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(msg.sender, to, amountOrId);
    }

    /// @notice Check if NFT transfer would succeed (owner + approval check)
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        IERC721 token = marketConfigs[msg.sender].nft;
        if (address(token) == address(0)) return false;
        try token.ownerOf(amountOrId) returns (address currentOwner) {
            if (currentOwner != from) return false;
            try token.getApproved(amountOrId) returns (address approved) {
                if (approved == address(this)) return true;
            } catch {
                return false;
            }
            try token.isApprovedForAll(from, address(this)) returns (bool approved) {
                return approved;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
}
