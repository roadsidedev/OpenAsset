// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title IOracle
 * @notice Generic oracle interface for price feeds
 */
interface IOracle {
    /**
     * @notice Get current price for an asset
     * @param asset Address of the asset
     * @return price Price in USD with 18 decimals (1e18 = $1)
     */
    function getPrice(address asset) external view returns (uint256 price);
    
    /**
     * @notice Get timestamp of last price update
     * @param asset Address of the asset
     * @return timestamp Last update timestamp
     */
    function getLastUpdate(address asset) external view returns (uint256 timestamp);
}

/**
 * @title INFTOracle
 * @notice Oracle interface for NFT floor prices (Reservoir, OpenSea)
 */
interface INFTOracle {
    /**
     * @notice Get NFT collection floor price
     * @param collection NFT collection address
     * @return floorPrice Floor price in ETH with 18 decimals
     */
    function getFloorPrice(address collection) external view returns (uint256 floorPrice);
    
    /**
     * @notice Get NFT collection floor price in USD
     * @param collection NFT collection address
     * @return priceUsd Floor price in USD with 18 decimals
     */
    function getFloorPriceUSD(address collection) external view returns (uint256 priceUsd);
    
    /**
     * @notice Get specific NFT valuation (if available)
     * @param collection NFT collection address
     * @param tokenId Token ID
     * @return price Estimated price in ETH with 18 decimals
     */
    function getNFTPrice(address collection, uint256 tokenId) external view returns (uint256 price);
    
    /**
     * @notice Check if floor price is stale
     * @param collection NFT collection address
     * @return isStale True if price hasn't updated recently
     */
    function isPriceStale(address collection) external view returns (bool isStale);
}

/**
 * @title ILendingMarket
 * @notice Interface for isolated lending market
 */
interface ILendingMarket {
    enum AssetType { ERC20, ERC721, ERC1155 }
    
    /**
     * @notice Deposit liquidity to the market
     * @param amount Amount of loan asset to deposit
     * @return shares LP shares minted
     */
    function depositLiquidity(uint256 amount) external returns (uint256 shares);
    
    /**
     * @notice Withdraw liquidity from the market
     * @param shares Amount of LP shares to burn
     * @return amount Loan asset withdrawn
     */
    function withdrawLiquidity(uint256 shares) external returns (uint256 amount);
    
    /**
     * @notice Request a loan by depositing collateral
     * @param collateralAmount Amount of collateral (for ERC20/ERC1155)
     * @param tokenId Token ID (for ERC721)
     * @param erc1155Amount Amount (for ERC1155)
     * @return loanContract Address of created LoanContract
     */
    function requestLoan(
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 erc1155Amount
    ) external returns (address loanContract);
    
    /**
     * @notice Get available liquidity for new loans
     * @return available Amount available
     */
    function getAvailableLiquidity() external view returns (uint256 available);
    
    /**
     * @notice Check if market is paused by circuit breaker
     * @return isPaused True if paused due to volatility
     */
    function isCircuitBreakerTriggered() external view returns (bool isPaused);
}

/**
 * @title ILoanContract
 * @notice Interface for individual loan escrow contract
 */
interface ILoanContract {
    enum LoanStatus { ACTIVE, REPAID, LIQUIDATED, DEFAULTED }
    
    /**
     * @notice Initialize loan contract (called by LendingMarket)
     * @param borrower_ Borrower address
     * @param collateralAmount_ Amount of collateral
     * @param tokenId_ Token ID (for NFT)
     * @param erc1155Amount_ Amount (for ERC1155)
     * @param principal_ Loan principal amount
     * @param interestAmount_ Interest amount
     * @param expiryTime_ Loan expiry timestamp
     */
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 erc1155Amount_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external;
    
    /**
     * @notice Repay loan and reclaim collateral
     */
    function repay() external;
    
    /**
     * @notice Liquidate undercollateralized or expired loan
     */
    function liquidate() external;
    
    /**
     * @notice Get current health factor
     * @return healthFactor Health factor with 18 decimals (1e18 = 100%)
     */
    function getHealthFactor() external view returns (uint256 healthFactor);
    
    /**
     * @notice Check if loan can be liquidated
     * @return canLiquidate True if liquidation is allowed
     */
    function isLiquidatable() external view returns (bool canLiquidate);
    
    /**
     * @notice Get loan details
     */
    function getLoanDetails() external view returns (
        address borrower,
        uint256 principal,
        uint256 interestAmount,
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 startTime,
        uint256 expiryTime,
        LoanStatus status,
        uint256 healthFactor
    );
}

/**
 * @title IMarketFactory
 * @notice Interface for market factory
 */
interface IMarketFactory {
    /**
     * @notice Create a new isolated lending market
     * @param collateralAsset Collateral token address
     * @param loanAsset Loan token address (must be whitelisted stablecoin)
     * @param assetType Type of collateral asset
     * @param oracleType Type of oracle to use
     * @param primaryOracle Primary oracle address
     * @param nftOracle NFT oracle address (for NFT collateral)
     * @param ltvBps Loan-to-value ratio in basis points
     * @param aprBps Interest rate in basis points
     * @param durationSeconds Loan duration
     * @param initialLiquidity Initial liquidity to deposit
     * @return market Address of created market
     */
    function createMarket(
        address collateralAsset,
        address loanAsset,
        ILendingMarket.AssetType assetType,
        OracleType oracleType,
        address primaryOracle,
        address nftOracle,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds,
        uint256 initialLiquidity
    ) external returns (address market);
    
    /**
     * @notice Check if address is a valid market
     * @param market Address to check
     * @return isValid True if valid market
     */
    function isMarket(address market) external view returns (bool isValid);
    
    /**
     * @notice Get total number of markets
     * @return count Total markets created
     */
    function getMarketCount() external view returns (uint256 count);
}

/**
 * @notice Oracle type enum
 */
enum OracleType {
    UNISWAP_V3_TWAP,
    CHAINLINK,
    NFT_ORACLE
}