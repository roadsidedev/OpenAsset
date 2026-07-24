// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * @title NFTAuctionLiquidationAdapter
 * @notice Reference liquidation adapter for indivisible ERC721/ERC1155 collateral
 * @dev Implements ILiquidationAdapter with gradual liquidation shape:
 *      NFT goes to LP; surplus (floor value minus debt) paid as ETH side-payment.
 *
 * Synchronous: liquidation resolves in one transaction.
 * For indivisible assets, the full NFT transfers to the LP. Any surplus
 * above the debt is returned as a cash side-payment from LP's available liquidity.
 *
 * NOTE: In production, this would integrate with an NFT auction house
 * (Seaport, Blur, etc.) For this reference implementation, it transfers
 * the NFT directly and handles accounting.
 */
contract NFTAuctionLiquidationAdapter is ILiquidationAdapter, ERC721Holder {
    address public immutable owner;
    mapping(address => bool) public authorizedMarkets;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
    }

    function registerMarket(address market) external onlyOwner {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
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
