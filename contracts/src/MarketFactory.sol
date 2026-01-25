// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LendingMarket.sol";

/**
 * @title MarketFactory
 * @notice Factory for deploying new LendingMarket contracts
 */
contract MarketFactory is Ownable {
    
    // --- State Variables ---

    LendingMarket[] public allMarkets;
    mapping(address => bool) public isMarket;

    // --- Events ---

    event MarketCreated(address indexed market, address indexed owner, address collateralAsset, address loanAsset);

    // --- Constructor ---

    constructor() Ownable(msg.sender) {}

    // --- Functions ---

    /**
     * @notice Deploy a new isolated lending market
     * @param collateralAsset The ERC20 token to be used as collateral
     * @param loanAsset The ERC20 token to be lent out (e.g. USDC)
     * @param oracle The oracle address for pricing
     * @param ltvBps Loan-to-Value in basis points (7500 = 75%)
     * @param durationSeconds Loan duration in seconds
     * @param interestRateBps Interest rate (APR) in basis points
     */
    function createMarket(
        address collateralAsset,
        address loanAsset,
        address oracle,
        uint256 ltvBps,
        uint256 durationSeconds,
        uint256 interestRateBps
    ) external returns (address) {
        // Factory creates the market and assigns msg.sender as the owner of the market
        // Note: In some designs, Factory might retain ownership or have admin rights.
        // Here we transfer ownership to the creator (LP) so they can manage it.
        
        LendingMarket market = new LendingMarket(
            msg.sender, // Owner
            collateralAsset,
            loanAsset,
            oracle,
            ltvBps,
            durationSeconds,
            interestRateBps
        );

        allMarkets.push(market);
        isMarket[address(market)] = true;

        emit MarketCreated(address(market), msg.sender, collateralAsset, loanAsset);

        return address(market);
    }

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
