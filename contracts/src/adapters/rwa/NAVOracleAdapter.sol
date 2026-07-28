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
    address public immutable factory;

    struct MarketConfig {
        INAVProvider navProvider;
        IProofOfReserve proofOfReserve;
        uint256 maxStaleness;
        uint8 tokenDecimals;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address) external onlyFactory {
        require(market != address(0), "Invalid market");
        // Asset parameter unused — NAV adapter is configured per-provider via registerProvider()
    }

    /**
     * @notice Register a NAV provider for a specific market
     * @param market Address of the LendingMarket contract
     * @param _navProvider NAV provider contract address
     * @param _proofOfReserve Proof of Reserve contract address (address(0) if none)
     * @param _maxStaleness Maximum age before price is considered stale
     * @param _tokenDecimals Token decimals for NAV normalization
     */
    function registerProvider(
        address market,
        address _navProvider,
        address _proofOfReserve,
        uint256 _maxStaleness,
        uint8 _tokenDecimals
    ) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(_navProvider != address(0), "Invalid NAV provider");
        marketConfigs[market] = MarketConfig({
            navProvider: INAVProvider(_navProvider),
            proofOfReserve: _proofOfReserve != address(0) ? IProofOfReserve(_proofOfReserve) : IProofOfReserve(address(0)),
            maxStaleness: _maxStaleness > 0 ? _maxStaleness : 3600,
            tokenDecimals: _tokenDecimals
        });
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.navProvider) == address(0)) return (0, false, 0);

        try config.navProvider.getNAV() returns (uint256 nav, uint256 navUpdatedAt, bool isStale) {
            if (nav == 0 || isStale) return (0, false, navUpdatedAt);

            price = _normalizeDecimals(nav, config.tokenDecimals);
            updatedAt = navUpdatedAt;

            bool isFresh = (block.timestamp - navUpdatedAt) <= config.maxStaleness;

            bool reservesValid = true;
            if (address(config.proofOfReserve) != address(0)) {
                try config.proofOfReserve.getReserve() returns (uint256 reserve, uint256) {
                    reservesValid = reserve > 0;
                } catch {
                    reservesValid = false;
                }
            }

            isTrusted = isFresh && reservesValid;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256) external view override returns (uint256) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.navProvider) == address(0)) return 0;
        try config.navProvider.getNAV() returns (uint256 nav, uint256, bool) {
            if (nav == 0) return 0;
            return _normalizeDecimals(nav, config.tokenDecimals);
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
