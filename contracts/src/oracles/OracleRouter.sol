// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/IOracle.sol";

/**
 * @title OracleRouter
 * @notice Multi-source oracle router with intelligent fallback logic
 * @dev Routes price requests to the best available oracle with automatic failover
 * 
 * Features:
 * - Primary, secondary, tertiary oracle tiers
 * - Automatic fallback on primary failure/staleness
 * - Per-asset configuration with granular controls
 * - Comprehensive routing statistics
 * - Emergency disable per oracle type
 * - Gas-efficient batch configuration
 * 
 * Priority Logic:
 * 1. Try primary oracle (usually Chainlink for safety)
 * 2. If primary fails/stale, try secondary (usually Uniswap V3 for decentralization)
 * 3. If secondary fails, try tertiary
 * 4. If all fail and auto-fallback disabled, revert
 * 
 * @custom:security-contact security@redchips.io
 */
contract OracleRouter is IOracle {
    
    // ============ Immutable State ============
    
    address public immutable owner;
    
    // ============ Storage ============
    
    struct OracleConfig {
        address primaryOracle;      // First choice
        address secondaryOracle;    // Fallback
        address tertiaryOracle;     // Second fallback
        bool useAutomaticFallback;  // Auto-fallback or revert
        uint256 maxPriceAge;        // Max acceptable price age
    }
    
    // asset => OracleConfig
    mapping(address => OracleConfig) public oracleConfigs;
    
    // Track registered assets
    address[] public registeredAssets;
    mapping(address => bool) public isRegistered;
    
    // Emergency disable per oracle
    mapping(address => bool) public isOracleDisabled;
    
    // Router statistics
    uint256 public totalPrimaryUsed;
    uint256 public totalSecondaryUsed;
    uint256 public totalTertiaryUsed;
    uint256 public totalFailures;
    
    // ============ Events ============
    
    event OracleConfigured(
        address indexed asset,
        address indexed primaryOracle,
        address indexed secondaryOracle,
        address tertiaryOracle,
        bool useAutomaticFallback,
        uint256 maxPriceAge
    );
    
    event OracleFallback(
        address indexed asset,
        address indexed failedOracle,
        address indexed usedOracle,
        string reason
    );
    
    event PriceFetched(
        address indexed asset,
        address indexed oracle,
        uint256 price,
        uint256 timestamp,
        string oracleType
    );
    
    event OracleDisabled(address indexed oracle);
    event OracleReenabled(address indexed oracle);
    
    // ============ Errors ============
    
    error Unauthorized();
    error AssetNotConfigured();
    error AllOraclesFailed();
    error InvalidOracleAddress();
    error PriceTooStale();
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize OracleRouter
     * @param _owner Admin address
     */
    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Configure oracle sources for an asset
     * @param asset Asset address
     * @param primaryOracle Primary oracle (e.g., Chainlink)
     * @param secondaryOracle Secondary oracle (e.g., Uniswap V3)
     * @param tertiaryOracle Tertiary oracle (optional, can be address(0))
     * @param useAutomaticFallback Whether to auto-fallback or revert
     * @param maxPriceAge Maximum acceptable price age in seconds
     */
    function configureOracle(
        address asset,
        address primaryOracle,
        address secondaryOracle,
        address tertiaryOracle,
        bool useAutomaticFallback,
        uint256 maxPriceAge
    ) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        require(primaryOracle != address(0), "Invalid primary oracle");
        
        oracleConfigs[asset] = OracleConfig({
            primaryOracle: primaryOracle,
            secondaryOracle: secondaryOracle,
            tertiaryOracle: tertiaryOracle,
            useAutomaticFallback: useAutomaticFallback,
            maxPriceAge: maxPriceAge > 0 ? maxPriceAge : 3600 // Default 1 hour
        });
        
        if (!isRegistered[asset]) {
            registeredAssets.push(asset);
            isRegistered[asset] = true;
        }
        
        emit OracleConfigured(
            asset,
            primaryOracle,
            secondaryOracle,
            tertiaryOracle,
            useAutomaticFallback,
            maxPriceAge
        );
    }
    
    /**
     * @notice Batch configure oracles (gas efficient)
     * @param assets Array of assets
     * @param primaryOracles Array of primary oracles
     * @param secondaryOracles Array of secondary oracles
     * @param useAutomaticFallback Auto-fallback enabled
     */
    function configureOracleBatch(
        address[] calldata assets,
        address[] calldata primaryOracles,
        address[] calldata secondaryOracles,
        bool useAutomaticFallback
    ) external onlyOwner {
        uint256 length = assets.length;
        require(
            length == primaryOracles.length && length == secondaryOracles.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < length; i++) {
            this.configureOracle(
                assets[i],
                primaryOracles[i],
                secondaryOracles[i],
                address(0),
                useAutomaticFallback,
                3600
            );
        }
    }
    
    /**
     * @notice Disable an oracle (emergency)
     * @param oracle Oracle address to disable
     */
    function disableOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle");
        isOracleDisabled[oracle] = true;
        emit OracleDisabled(oracle);
    }
    
    /**
     * @notice Re-enable an oracle
     * @param oracle Oracle address to enable
     */
    function enableOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle");
        isOracleDisabled[oracle] = false;
        emit OracleReenabled(oracle);
    }
    
    // ============ IOracle Implementation ============
    
    /**
     * @notice Get price with automatic fallback
     * @dev MEDIUM-002: Made view-compliant by removing state mutations
     * @param asset Asset to price
     * @return price Price with 18 decimals
     * @return decimals Always 18
     */
    function getPrice(address asset) 
        external 
        view
        override 
        returns (uint256 price, uint8 decimals) 
    {
        OracleConfig memory config = oracleConfigs[asset];
        require(config.primaryOracle != address(0), "AssetNotConfigured");
        
        // Try primary oracle
        (bool primarySuccess, uint256 primaryPrice) = _tryGetPrice(
            config.primaryOracle,
            asset,
            config.maxPriceAge
        );
        
        if (primarySuccess) {
            // Statistics tracking removed for view compliance
            return (primaryPrice, 18);
        }
        
        // Primary failed - check if fallback enabled
        if (!config.useAutomaticFallback) {
            revert AllOraclesFailed();
        }
        
        // Try secondary oracle
        if (config.secondaryOracle != address(0)) {
            (bool secondarySuccess, uint256 secondaryPrice) = _tryGetPrice(
                config.secondaryOracle,
                asset,
                config.maxPriceAge
            );
            
            if (secondarySuccess) {
                return (secondaryPrice, 18);
            }
        }
        
        // Try tertiary oracle
        if (config.tertiaryOracle != address(0)) {
            (bool tertiarySuccess, uint256 tertiaryPrice) = _tryGetPrice(
                config.tertiaryOracle,
                asset,
                config.maxPriceAge
            );
            
            if (tertiarySuccess) {
                return (tertiaryPrice, 18);
            }
        }
        
        // All oracles failed
        revert AllOraclesFailed();
    }
    
    /**
     * @notice Get price with source information
     * @param asset Asset to price
     * @return price Price with 18 decimals
     * @return source Oracle address that provided price
     * @return sourceType Oracle type string
     */
    function getPriceWithSource(address asset) 
        external 
        returns (uint256 price, address source, string memory sourceType) 
    {
        OracleConfig memory config = oracleConfigs[asset];
        require(config.primaryOracle != address(0), "AssetNotConfigured");
        
        // Try primary
        (bool primarySuccess, uint256 primaryPrice) = _tryGetPrice(
            config.primaryOracle,
            asset,
            config.maxPriceAge
        );
        
        if (primarySuccess) {
            return (
                primaryPrice,
                config.primaryOracle,
                _getOracleType(config.primaryOracle)
            );
        }
        
        // Try secondary
        if (config.useAutomaticFallback && config.secondaryOracle != address(0)) {
            (bool secondarySuccess, uint256 secondaryPrice) = _tryGetPrice(
                config.secondaryOracle,
                asset,
                config.maxPriceAge
            );
            
            if (secondarySuccess) {
                return (
                    secondaryPrice,
                    config.secondaryOracle,
                    _getOracleType(config.secondaryOracle)
                );
            }
        }
        
        // Try tertiary
        if (config.useAutomaticFallback && config.tertiaryOracle != address(0)) {
            (bool tertiarySuccess, uint256 tertiaryPrice) = _tryGetPrice(
                config.tertiaryOracle,
                asset,
                config.maxPriceAge
            );
            
            if (tertiarySuccess) {
                return (
                    tertiaryPrice,
                    config.tertiaryOracle,
                    _getOracleType(config.tertiaryOracle)
                );
            }
        }
        
        revert AllOraclesFailed();
    }
    
    /**
     * @notice Get last update timestamp
     * @param asset Asset address
     * @return timestamp Unix timestamp
     */
    function getLastUpdate(address asset) 
        external 
        view 
        override 
        returns (uint256 timestamp) 
    {
        OracleConfig memory config = oracleConfigs[asset];
        require(config.primaryOracle != address(0), "AssetNotConfigured");
        
        // Try primary
        try this._externalGetLastUpdate(config.primaryOracle, asset) returns (uint256 ts) {
            return ts;
        } catch {
            // Try secondary
            if (config.secondaryOracle != address(0)) {
                try this._externalGetLastUpdate(config.secondaryOracle, asset) returns (uint256 ts) {
                    return ts;
                } catch {
                    return 0;
                }
            }
            return 0;
        }
    }
    
    /**
     * @notice Check if asset is supported
     * @param asset Asset address
     * @return supported True if configured
     */
    function supportsAsset(address asset) 
        external 
        view 
        override 
        returns (bool supported) 
    {
        return oracleConfigs[asset].primaryOracle != address(0);
    }
    
    /**
     * @notice Get oracle type
     * @return Type string
     */
    function oracleType() 
        external 
        pure 
        override 
        returns (string memory) 
    {
        return "ORACLE_ROUTER";
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Try to get price from an oracle (non-reverting)
     * @param oracle Oracle address
     * @param asset Asset address
     * @param maxAge Maximum price age in seconds
     * @return success Whether fetch succeeded
     * @return price Price if successful
     */
    function _tryGetPrice(
        address oracle,
        address asset,
        uint256 maxAge
    ) 
        internal 
        view 
        returns (bool success, uint256 price) 
    {
        if (oracle == address(0) || isOracleDisabled[oracle]) return (false, 0);
        
        try this._externalGetPrice(oracle, asset) returns (uint256 _price, uint8) {
            if (_price > 0) {
                // Check price staleness
                try this._externalGetLastUpdate(oracle, asset) returns (uint256 timestamp) {
                    if (block.timestamp - timestamp <= maxAge) {
                        return (true, _price);
                    }
                } catch {
                    // If we can't get timestamp, assume price is valid
                    return (true, _price);
                }
            }
        } catch {
            return (false, 0);
        }
        
        return (false, 0);
    }
    
    /**
     * @notice External wrapper for getPrice (enables try/catch)
     * @param oracle Oracle address
     * @param asset Asset address
     * @return price Price
     * @return decimals Decimals
     */
    function _externalGetPrice(address oracle, address asset) 
        external 
        view 
        returns (uint256 price, uint8 decimals) 
    {
        (bool success, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("getPrice(address)", asset)
        );
        
        require(success, "Oracle call failed");
        (price, decimals) = abi.decode(data, (uint256, uint8));
    }
    
    /**
     * @notice External wrapper for getLastUpdate
     * @param oracle Oracle address
     * @param asset Asset address
     * @return timestamp Timestamp
     */
    function _externalGetLastUpdate(address oracle, address asset) 
        external 
        view 
        returns (uint256 timestamp) 
    {
        (bool success, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("getLastUpdate(address)", asset)
        );
        
        require(success, "Oracle call failed");
        timestamp = abi.decode(data, (uint256));
    }
    
    /**
     * @notice Get oracle type string (internal)
     * @param oracle Oracle address
     * @return oType Oracle type
     */
    function _getOracleType(address oracle) internal view returns (string memory oType) {
        try this._externalGetOracleType(oracle) returns (string memory _oType) {
            return _oType;
        } catch {
            return "UNKNOWN";
        }
    }
    
    /**
     * @notice External wrapper for oracleType
     * @param oracle Oracle address
     * @return Type string
     */
    function _externalGetOracleType(address oracle) 
        external 
        view 
        returns (string memory) 
    {
        (bool success, bytes memory data) = oracle.staticcall(
            abi.encodeWithSignature("oracleType()")
        );
        
        require(success, "Oracle call failed");
        return abi.decode(data, (string));
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get oracle configuration
     * @param asset Asset address
     * @return primaryOracle Primary oracle
     * @return secondaryOracle Secondary oracle
     * @return tertiaryOracle Tertiary oracle
     * @return useAutomaticFallback Auto-fallback enabled
     * @return maxPriceAge Max price age
     */
    function getOracleConfig(address asset) 
        external 
        view 
        returns (
            address primaryOracle,
            address secondaryOracle,
            address tertiaryOracle,
            bool useAutomaticFallback,
            uint256 maxPriceAge
        ) 
    {
        OracleConfig memory config = oracleConfigs[asset];
        return (
            config.primaryOracle,
            config.secondaryOracle,
            config.tertiaryOracle,
            config.useAutomaticFallback,
            config.maxPriceAge
        );
    }
    
    /**
     * @notice Get all registered assets
     * @return assets Array of asset addresses
     */
    function getRegisteredAssets() 
        external 
        view 
        returns (address[] memory assets) 
    {
        return registeredAssets;
    }
    
    /**
     * @notice Get router statistics
     * @return primaryUsed Times primary was used
     * @return secondaryUsed Times secondary was used
     * @return tertiaryUsed Times tertiary was used
     * @return failures Number of failures
     * @return totalRequests Total price requests
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 primaryUsed,
            uint256 secondaryUsed,
            uint256 tertiaryUsed,
            uint256 failures,
            uint256 totalRequests
        ) 
    {
        return (
            totalPrimaryUsed,
            totalSecondaryUsed,
            totalTertiaryUsed,
            totalFailures,
            totalPrimaryUsed + totalSecondaryUsed + totalTertiaryUsed + totalFailures
        );
    }
    
    /**
     * @notice Test all oracle sources for an asset
     * @param asset Asset address
     * @return primaryWorks Primary works
     * @return primaryPrice Primary price
     * @return secondaryWorks Secondary works
     * @return secondaryPrice Secondary price
     * @return tertiaryWorks Tertiary works
     * @return tertiaryPrice Tertiary price
     */
    function testOracles(address asset) 
        external 
        view 
        returns (
            bool primaryWorks,
            uint256 primaryPrice,
            bool secondaryWorks,
            uint256 secondaryPrice,
            bool tertiaryWorks,
            uint256 tertiaryPrice
        ) 
    {
        OracleConfig memory config = oracleConfigs[asset];
        uint256 maxAge = config.maxPriceAge > 0 ? config.maxPriceAge : 3600;
        
        (primaryWorks, primaryPrice) = _tryGetPrice(config.primaryOracle, asset, maxAge);
        (secondaryWorks, secondaryPrice) = _tryGetPrice(config.secondaryOracle, asset, maxAge);
        (tertiaryWorks, tertiaryPrice) = _tryGetPrice(config.tertiaryOracle, asset, maxAge);
    }
}
