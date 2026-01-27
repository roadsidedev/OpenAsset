// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title AssetHandler
 * @notice Multi-asset transfer library for ERC20/721/1155
 */
library AssetHandler {
    using SafeERC20 for IERC20;
    
    enum AssetType { ERC20, ERC721, ERC1155 }
    
    error InvalidAsset();
    error TransferFailed();
    
    /**
     * @notice Transfer asset from sender to recipient
     */
    function transferAsset(
        AssetType assetType,
        address asset,
        address from,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (assetType == AssetType.ERC20) {
            IERC20(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else {
            IERC1155(asset).safeTransferFrom(
                from,
                to,
                amountOrTokenId,
                erc1155Amount,
                ""
            );
        }
    }
    
    /**
     * @notice Transfer asset out from contract
     */
    function transferAssetOut(
        AssetType assetType,
        address asset,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (assetType == AssetType.ERC20) {
            IERC20(asset).safeTransfer(to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(address(this), to, amountOrTokenId);
        } else {
            IERC1155(asset).safeTransferFrom(
                address(this),
                to,
                amountOrTokenId,
                erc1155Amount,
                ""
            );
        }
    }
    
    /**
     * @notice Validate asset contract supports correct interface
     */
    function validateAsset(AssetType assetType, address asset) 
        internal 
        view 
        returns (bool) 
    {
        if (asset == address(0)) return false;
        
        if (assetType == AssetType.ERC20) {
            try IERC20(asset).totalSupply() returns (uint256) {
                return true;
            } catch {
                return false;
            }
        } else if (assetType == AssetType.ERC721) {
            try IERC721(asset).supportsInterface(0x80ac58cd) returns (bool supports) {
                return supports;
            } catch {
                return false;
            }
        } else {
            try IERC1155(asset).supportsInterface(0xd9b67a26) returns (bool supports) {
                return supports;
            } catch {
                return false;
            }
        }
    }
}
