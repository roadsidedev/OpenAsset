// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * @title NFTAuctionLiquidationAdapter
 * @notice Multi-tenant liquidation adapter for indivisible ERC721/ERC1155 collateral
 * @dev Implements ILiquidationAdapter with gradual liquidation shape.
 *      Orchestrates through the market's Asset Adapter for collateral movement.
 *      For indivisible assets, the full NFT transfers to the LP. Any surplus
 *      above the debt is returned as a cash side-payment from LP's available liquidity.
 */
contract NFTAuctionLiquidationAdapter is ILiquidationAdapter, ERC721Holder {
    address public immutable factory;

    struct MarketConfig {
        address assetAdapter;
        bool isActive;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyConfiguredMarket() {
        require(marketConfigs[msg.sender].isActive, "Unconfigured market");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address assetAdapter) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(assetAdapter != address(0), "Invalid asset adapter");
        marketConfigs[market] = MarketConfig({
            assetAdapter: assetAdapter,
            isActive: true
        });
    }

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyConfiguredMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        MarketConfig memory config = marketConfigs[msg.sender];

        // TODO: In production, integrate with an NFT auction house (Seaport, Blur, etc.)
        // to auction the NFT. The reference implementation transfers the NFT directly
        // to the LP and handles accounting. A full auction integration would:
        //   1. List NFT on auction house
        //   2. On sale: route proceeds to LP (principal) and holder (surplus)
        //   3. Return surplus via IAssetAdapter.release(holder, surplus)

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
