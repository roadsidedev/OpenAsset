// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";

/**
 * @title INAVProvider
 * @notice Minimal interface for issuer-published NAV data
 * @dev Each fund/issuer has their own NAV publication mechanism.
 *      This interface provides the minimal integration surface.
 */
interface INAVProvider {
    /**
     * @notice Get the current NAV per share
     * @return nav NAV per share with 18 decimals
     * @return updatedAt Timestamp of the last NAV publication
     * @return isStale Whether the NAV is older than the acceptable threshold
     */
    function getNAV() external view returns (uint256 nav, uint256 updatedAt, bool isStale);
}

/**
 * @title IProofOfReserve
 * @notice Minimal interface for Chainlink Proof of Reserve feeds
 * @dev Provides verification that the issuer holds the underlying assets
 *      backing the token. Pairing NAV with PoR gives confidence that
 *      the reported NAV corresponds to real reserves.
 */
interface IProofOfReserve {
    /**
     * @notice Get the audited reserve amount
     * @return reserve Amount held in custody (with 18 decimals)
     * @return updatedAt Timestamp of the last audit
     */
    function getReserve() external view returns (uint256 reserve, uint256 updatedAt);
}

/**
 * @title NAVOracleAdapter
 * @notice Reference oracle adapter for fund-like RWA (tokenized treasuries, private credit)
 * @dev Implements IOracleAdapter using issuer-published NAV, ideally paired
 *      with Chainlink Proof of Reserve.
 *
 * Requires issuer cooperation — the issuer must publish NAV on-chain via
 * the INAVProvider interface (or equivalent mechanism).
 *
 * The adapter reads NAV per share and derives the asset price. When paired
 * with Proof of Reserve, it can also verify that reserves cover the outstanding
 * token supply (not enforced on-chain here, but available for off-chain monitoring).
 *
 * isTrusted returns false if:
 * - NAV is stale (not updated within maxStaleness)
 * - NAV is zero
 * - PoR indicates reserves are insufficient (if PoR is configured)
 */
contract NAVOracleAdapter is IOracleAdapter {
    INAVProvider public immutable navProvider;
    IProofOfReserve public immutable proofOfReserve; // may be address(0)
    uint256 public immutable maxStaleness;

    // Token decimals for converting NAV per share to price
    uint8 public immutable tokenDecimals;

    constructor(
        address _navProvider,
        address _proofOfReserve,
        uint256 _maxStaleness,
        uint8 _tokenDecimals
    ) {
        require(_navProvider != address(0), "Invalid NAV provider");
        navProvider = INAVProvider(_navProvider);
        proofOfReserve = _proofOfReserve != address(0)
            ? IProofOfReserve(_proofOfReserve)
            : IProofOfReserve(address(0));
        maxStaleness = _maxStaleness > 0 ? _maxStaleness : 3600;
        tokenDecimals = _tokenDecimals;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        try navProvider.getNAV() returns (uint256 nav, uint256 navUpdatedAt, bool isStale) {
            if (nav == 0 || isStale) return (0, false, navUpdatedAt);

            // Convert NAV per share to USD price with 18 decimals
            // NAV is already in USD terms for most fund tokens
            price = _normalizeDecimals(nav, tokenDecimals);
            updatedAt = navUpdatedAt;

            // Staleness check
            bool isFresh = (block.timestamp - navUpdatedAt) <= maxStaleness;

            // Optional: Proof of Reserve verification
            bool reservesValid = true;
            if (address(proofOfReserve) != address(0)) {
                try proofOfReserve.getReserve() returns (uint256 reserve, uint256 reserveUpdatedAt) {
                    // Basic sanity: reserve should be > 0
                    reservesValid = reserve > 0;
                    // In production: compare reserve against outstanding token supply
                } catch {
                    reservesValid = false; // PoR read failed = don't trust
                }
            }

            isTrusted = isFresh && reservesValid;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        try navProvider.getNAV() returns (uint256 nav, uint256 navUpdatedAt2, bool isStale2) {
            if (nav == 0) return 0;
            return _normalizeDecimals(nav, tokenDecimals);
        } catch {
            return 0;
        }
    }

    function _normalizeDecimals(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return value;
        if (decimals > 18) return value / (10 ** (decimals - 18));
        return value * (10 ** (18 - decimals));
    }
}
