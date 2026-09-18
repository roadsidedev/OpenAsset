// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ERC721Adapter
 * @notice Multi-tenant asset adapter for ERC721 (NFT) collateral
 * @dev Implements IAssetAdapter. Uses the multi-tenancy pattern: the factory calls
 *      configure() once per market, storing the market's NFT contract address in a
 *      mapping keyed by market. Escrow pulls from borrower to market; release pulls
 *      from market to recipient. The market grants the adapter setApprovalForAll in
 *      its initializer (standard detection), which is what makes release() succeed.
 */
contract ERC721Adapter is IAssetAdapter {
    address public immutable factory;

    struct MarketConfig {
        IERC721 nft;
    }

    mapping(address => MarketConfig) public marketConfigs;

    event MarketConfigured(address indexed market, address indexed nft);
    event CollateralEscrowed(address indexed market, address indexed from, uint256 indexed tokenId);
    event CollateralReleased(address indexed market, address indexed to, uint256 indexed tokenId);

    error NotAnERC721(address nft);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address nftAddress) external override onlyFactory {
        require(market != address(0), "Invalid market");
        require(nftAddress != address(0), "Invalid NFT");
        // Review M7: one-time config (see ERC20Adapter)
        require(address(marketConfigs[market].nft) == address(0), "Already configured");

        // Fail-closed: verify the ERC721 interface (ERC-165). Explicit returndata-length
        // guard — a plain try/catch panics on empty returndata (EOA targets). Non-conformant
        // collateral reverts market creation, never a borrower's loan.
        if (nftAddress.code.length == 0) revert NotAnERC721(nftAddress);
        (bool probeOk, bytes memory probeData) = nftAddress.staticcall(
            abi.encodeWithSignature("supportsInterface(bytes4)", bytes4(0x80ac58cd))
        );
        if (!probeOk || probeData.length < 32 || !abi.decode(probeData, (bool))) {
            revert NotAnERC721(nftAddress);
        }

        marketConfigs[market] = MarketConfig({ nft: IERC721(nftAddress) });
        emit MarketConfigured(market, nftAddress);
    }

    /// @notice Escrow ERC721 NFT from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        IERC721 token = marketConfigs[msg.sender].nft;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(from, msg.sender, amountOrId);
        emit CollateralEscrowed(msg.sender, from, amountOrId);
    }

    /// @notice Release ERC721 NFT from market to recipient
    /// @dev Requires the market to have approved this adapter (setApprovalForAll)
    ///      — granted in LendingMarketV2's initializer.
    function release(address to, uint256 amountOrId) external override {
        IERC721 token = marketConfigs[msg.sender].nft;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(msg.sender, to, amountOrId);
        emit CollateralReleased(msg.sender, to, amountOrId);
    }

    /// @notice Check if NFT transfer would succeed (owner + approval check)
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        IERC721 token = marketConfigs[msg.sender].nft;
        if (address(token) == address(0)) return false;
        try token.ownerOf(amountOrId) returns (address currentOwner) {
            if (currentOwner != from) return false;
            // Approved per-token (escrow spender is this adapter)
            try token.getApproved(amountOrId) returns (address approved) {
                if (approved == address(this)) return true;
            } catch {
                return false;
            }
            // Or operator-approved for all
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
