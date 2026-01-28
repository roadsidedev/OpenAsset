// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Import OracleType from IOracle.sol to avoid duplicate definition
import {OracleType} from "./IOracle.sol";

/**
 * @title AssetType
 * @notice Asset type enumeration
 */
enum AssetType { ERC20, ERC721, ERC1155 }

/**
 * @title IMarketFactory
 * @notice Interface for market factory
 */
interface IMarketFactory {
    function createMarket(
        address collateralAsset,
        address loanAsset,
        AssetType assetType,
        OracleType oracleType,
        address primaryOracle,
        address nftOracle,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds,
        uint256 initialLiquidity
    ) external returns (address market);
    
    function isMarket(address market) external view returns (bool isValid);
    function getMarketCount() external view returns (uint256 count);
}
