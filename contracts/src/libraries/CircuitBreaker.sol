// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title CircuitBreaker
 * @notice Gas-optimized on-chain volatility detection and circuit breaking
 * @dev Uses circular buffer for price history to minimize storage costs
 */
library CircuitBreaker {
    using SafeERC20 for IERC20;
    
    uint256 private constant MAX_HISTORY_SIZE = 100; // ~100 minutes at 1 min intervals
    uint256 private constant BPS_DENOMINATOR = 10000;
    
    error CircuitBreakerTriggered();
    error InsufficientPriceHistory();
    
    struct PriceSnapshot {
        uint128 price;      // Price with 18 decimals (max ~3.4e20)
        uint128 timestamp;  // Block timestamp (sufficient until year 2106)
    }
    
    struct CircuitBreakerConfig {
        bool enabled;
        uint16 pauseThresholdBps;    // e.g., 2000 = 20% price move triggers pause
        uint32 lookbackSeconds;       // e.g., 3600 = 1 hour lookback
        uint16 resumeThresholdBps;    // e.g., 1000 = 10% to resume
        uint32 cooldownSeconds;       // e.g., 7200 = 2 hours minimum pause
    }
    
    struct CircuitBreakerState {
        PriceSnapshot[] priceHistory;
        uint256 pausedAt;
        bool isPaused;
        uint256 historyHead; // Circular buffer head pointer
    }
    
    /**
     * @notice Update price history (called periodically by keeper or on loan requests)
     * @param state Circuit breaker state
     * @param currentPrice Current asset price
     */
    function updatePriceHistory(
        CircuitBreakerState storage state,
        uint256 currentPrice
    ) internal {
        PriceSnapshot memory snapshot = PriceSnapshot({
            price: uint128(currentPrice),
            timestamp: uint128(block.timestamp)
        });
        
        if (state.priceHistory.length < MAX_HISTORY_SIZE) {
            // Still filling buffer
            state.priceHistory.push(snapshot);
        } else {
            // Circular buffer: overwrite oldest
            state.priceHistory[state.historyHead] = snapshot;
            state.historyHead = (state.historyHead + 1) % MAX_HISTORY_SIZE;
        }
    }
    
    /**
     * @notice Calculate volatility over lookback period
     * @param state Circuit breaker state
     * @param config Circuit breaker configuration
     * @return volatilityBps Volatility in basis points
     */
    function calculateVolatility(
        CircuitBreakerState storage state,
        CircuitBreakerConfig memory config
    ) internal view returns (uint256 volatilityBps) {
        if (state.priceHistory.length < 2) {
            revert InsufficientPriceHistory();
        }
        
        uint256 cutoffTime = block.timestamp - config.lookbackSeconds;
        uint256 newestPrice = state.priceHistory[
            state.priceHistory.length > MAX_HISTORY_SIZE 
                ? (state.historyHead + MAX_HISTORY_SIZE - 1) % MAX_HISTORY_SIZE
                : state.priceHistory.length - 1
        ].price;
        
        // Find oldest price within lookback window
        uint256 oldestPrice = 0;
        uint256 len = state.priceHistory.length > MAX_HISTORY_SIZE 
            ? MAX_HISTORY_SIZE 
            : state.priceHistory.length;
        
        for (uint256 i = 0; i < len; i++) {
            uint256 idx = state.priceHistory.length > MAX_HISTORY_SIZE
                ? (state.historyHead + i) % MAX_HISTORY_SIZE
                : i;
            
            if (state.priceHistory[idx].timestamp >= cutoffTime) {
                oldestPrice = state.priceHistory[idx].price;
                break;
            }
        }
        
        if (oldestPrice == 0) {
            // No price within lookback window, use oldest available
            oldestPrice = state.priceHistory[
                state.priceHistory.length > MAX_HISTORY_SIZE ? state.historyHead : 0
            ].price;
        }
        
        // Calculate percentage change
        if (newestPrice > oldestPrice) {
            volatilityBps = ((newestPrice - oldestPrice) * BPS_DENOMINATOR) / oldestPrice;
        } else {
            volatilityBps = ((oldestPrice - newestPrice) * BPS_DENOMINATOR) / oldestPrice;
        }
    }
    
    /**
     * @notice Check and update circuit breaker status
     * @param state Circuit breaker state
     * @param config Circuit breaker configuration
     * @param currentPrice Current asset price
     * @return shouldPause True if should pause operations
     */
    function checkAndUpdate(
        CircuitBreakerState storage state,
        CircuitBreakerConfig memory config,
        uint256 currentPrice
    ) internal returns (bool shouldPause) {
        if (!config.enabled) return false;
        
        // Update price history
        updatePriceHistory(state, currentPrice);
        
        // Need at least 2 prices to calculate volatility
        if (state.priceHistory.length < 2) return false;
        
        uint256 volatility = calculateVolatility(state, config);
        
        if (!state.isPaused) {
            // Check if should trigger pause
            if (volatility >= config.pauseThresholdBps) {
                state.isPaused = true;
                state.pausedAt = block.timestamp;
                return true;
            }
        } else {
            // Already paused - check if should resume
            bool cooldownPassed = block.timestamp >= state.pausedAt + config.cooldownSeconds;
            bool volatilityLow = volatility < config.resumeThresholdBps;
            
            if (cooldownPassed && volatilityLow) {
                state.isPaused = false;
                state.pausedAt = 0;
            } else {
                return true; // Stay paused
            }
        }
        
        return false;
    }
    
    /**
     * @notice Check if circuit breaker is currently triggered
     * @param state Circuit breaker state
     * @return isTriggered True if paused
     */
    function isTriggered(CircuitBreakerState storage state) 
        internal 
        view 
        returns (bool isTriggered) 
    {
        return state.isPaused;
    }
}

/**
 * @title AssetHandler
 * @notice Multi-asset transfer handler for ERC20/721/1155
 */
library AssetHandler {
    using SafeERC20 for IERC20;
    
    enum AssetType { ERC20, ERC721, ERC1155 }
    
    error InvalidAssetType();
    error InvalidTransfer();
    error ZeroAmount();
    error ZeroAddress();
    
    /**
     * @notice Transfer asset from sender to recipient
     * @param assetType Type of asset
     * @param asset Asset contract address
     * @param from Sender address
     * @param to Recipient address
     * @param amountOrTokenId Amount (ERC20/1155) or Token ID (ERC721)
     * @param erc1155Amount Amount for ERC1155 (ignored for others)
     */
    function transferAsset(
        AssetType assetType,
        address asset,
        address from,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (asset == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        
        if (assetType == AssetType.ERC20) {
            if (amountOrTokenId == 0) revert ZeroAmount();
            IERC20(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else if (assetType == AssetType.ERC1155) {
            if (erc1155Amount == 0) revert ZeroAmount();
            IERC1155(asset).safeTransferFrom(from, to, amountOrTokenId, erc1155Amount, "");
        } else {
            revert InvalidAssetType();
        }
    }
    
    /**
     * @notice Transfer asset from this contract to recipient
     * @param assetType Type of asset
     * @param asset Asset contract address
     * @param to Recipient address
     * @param amountOrTokenId Amount (ERC20/1155) or Token ID (ERC721)
     * @param erc1155Amount Amount for ERC1155
     */
    function transferAssetOut(
        AssetType assetType,
        address asset,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (asset == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        
        if (assetType == AssetType.ERC20) {
            if (amountOrTokenId == 0) revert ZeroAmount();
            IERC20(asset).safeTransfer(to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(address(this), to, amountOrTokenId);
        } else if (assetType == AssetType.ERC1155) {
            if (erc1155Amount == 0) revert ZeroAmount();
            IERC1155(asset).safeTransferFrom(address(this), to, amountOrTokenId, erc1155Amount, "");
        } else {
            revert InvalidAssetType();
        }
    }
    
    /**
     * @notice Get balance of asset for an address
     * @param assetType Type of asset
     * @param asset Asset contract address
     * @param account Account to check
     * @param tokenId Token ID (for ERC721/1155)
     * @return balance Balance amount
     */
    function getBalance(
        AssetType assetType,
        address asset,
        address account,
        uint256 tokenId
    ) internal view returns (uint256 balance) {
        if (assetType == AssetType.ERC20) {
            balance = IERC20(asset).balanceOf(account);
        } else if (assetType == AssetType.ERC721) {
            balance = IERC721(asset).ownerOf(tokenId) == account ? 1 : 0;
        } else if (assetType == AssetType.ERC1155) {
            balance = IERC1155(asset).balanceOf(account, tokenId);
        }
    }
    
    /**
     * @notice Validate asset contract implements expected interface
     * @param assetType Type of asset
     * @param asset Asset contract address
     * @return isValid True if asset contract is valid
     */
    function validateAsset(AssetType assetType, address asset) 
        internal 
        view 
        returns (bool isValid) 
    {
        if (asset == address(0)) return false;
        
        // Check contract has code
        uint256 size;
        assembly {
            size := extcodesize(asset)
        }
        if (size == 0) return false;
        
        // For production, add interface checks:
        // - ERC20: check totalSupply() exists
        // - ERC721: check supportsInterface(0x80ac58cd)
        // - ERC1155: check supportsInterface(0xd9b67a26)
        
        return true;
    }
}