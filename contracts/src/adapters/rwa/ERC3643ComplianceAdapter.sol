// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title IERC3643
 * @notice Minimal interface for ERC-3643 (T-REX) token compliance checks
 */
interface IERC3643 {
    function isVerified(address _wallet) external view returns (bool);
    function isFrozen(address _wallet) external view returns (bool);
    function getFrozenTokens(address _wallet) external view returns (uint256);
}

/**
 * @title ERC3643ComplianceAdapter
 * @notice Multi-tenant compliance adapter for ERC-3643 (T-REX) token transfer restrictions
 * @dev Implements IComplianceAdapter by querying the ERC-3643 token's on-chain
 *      identity registry and freeze status.
 *      Multi-tenancy: factory calls configure() once per market, storing the
 *      ERC-3643 token address for that market.
 */
contract ERC3643ComplianceAdapter is IComplianceAdapter {

    address public immutable factory;

    struct MarketConfig {
        IERC3643 token;
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

    function configure(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        // Token address is set via registerToken() with full params
    }

    /**
     * @notice Register an ERC-3643 token for a specific market
     * @param market Address of the LendingMarket contract
     * @param tokenAddress ERC-3643 token contract address
     */
    function registerToken(address market, address tokenAddress) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(tokenAddress != address(0), "Invalid token address");
        marketConfigs[market] = MarketConfig({ token: IERC3643(tokenAddress) });
    }

    /// @inheritdoc IComplianceAdapter
    function isEligible(address participant) external view override returns (bool) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.token) == address(0)) return false;

        try config.token.isVerified(participant) returns (bool verified) {
            if (!verified) return false;
        } catch {
            return false;
        }

        try config.token.isFrozen(participant) returns (bool frozen) {
            if (frozen) return false;
        } catch {
            return false;
        }

        return true;
    }
}
