// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title IB20Policy
 * @notice Minimal B20 view interface for compliance adapter
 * @dev Only policyId() + scope constants needed. B20 token itself holds per-token policy slots.
 */
interface IB20Policy {
    function TRANSFER_SENDER_POLICY() external view returns (bytes32);
    function TRANSFER_RECEIVER_POLICY() external view returns (bytes32);
    function TRANSFER_EXECUTOR_POLICY() external view returns (bytes32);
    function policyId(bytes32 policyScope) external view returns (bytes32);
}

interface IPolicyRegistryView {
    function isAuthorized(bytes32 policyId, address account) external view returns (bool);
}

/**
 * @title B20PolicyComplianceAdapter
 * @notice Multi-tenant compliance adapter for Base B20 tokenized stocks
 * @dev Mirrors ERC3643ComplianceAdapter.sol structure with one key difference:
 *      policy lookup is self-configuring from the B20 token — no off-chain coordination.
 *
 *      - IComplianceAdapter.configure(address market) takes ONE arg per spec (IComplianceAdapter.sol:26).
 *        Token binding comes via separate factory-admin registerToken(market, token) call,
 *        same two-step pattern as ERC3643ComplianceAdapter.registerToken and ChainlinkEquityFeedAdapter.registerFeed.
 *      - policyId == 0 is the always-allow builtin sentinel → skip check.
 *      - Registry address is constructor param (multi-chain + testability), not hardcoded constant.
 *      - Checked at origination (always when complianceAdapter != 0) and on TransferablePosition transfers
 *        per Validation Matrix R5 — note R5 is off-chain review-enforced (MarketFactoryV2.sol:332-340).
 *      - FAIL-CLOSED: any revert → false (engine treats revert as false).
 *
 * Multi-tenancy: factory calls configure() once per market; admin calls registerToken() to bind token.
 */
contract B20PolicyComplianceAdapter is IComplianceAdapter {
    address public immutable factory;
    IPolicyRegistryView public immutable policyRegistry;
    address public owner;

    struct MarketConfig {
        IB20Policy token;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyFactoryOrOwner() {
        require(msg.sender == factory || msg.sender == owner, "Only factory/owner");
        _;
    }

    constructor(address _factory, address _policyRegistry) {
        require(_factory != address(0), "Invalid factory");
        require(_policyRegistry != address(0), "Invalid registry");
        factory = _factory;
        policyRegistry = IPolicyRegistryView(_policyRegistry);
        owner = msg.sender;
    }

    function transferOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    function configure(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        // Token binding is done via registerToken(); this satisfies the IComplianceAdapter interface
    }

    /**
     * @notice Bind a B20 token to a market for policy checks (factory only)
     * @param market LendingMarketV2 address
     * @param token B20 collateral token address
     */
    function registerToken(address market, address token) external onlyFactoryOrOwner {
        require(market != address(0), "Invalid market");
        require(token != address(0), "Invalid token");
        marketConfigs[market] = MarketConfig({ token: IB20Policy(token) });
    }

    /// @inheritdoc IComplianceAdapter
    function isEligible(address participant) external view override returns (bool) {
        // msg.sender is the LendingMarketV2 calling this adapter
        IB20Policy token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;

        // Sender policy — participant as sender (borrower sending collateral)
        if (!_authorized(token, token.TRANSFER_SENDER_POLICY(), participant)) return false;
        // Receiver policy — participant as receiver (relevant for position transfers / collateral release)
        // For origination we conservatively check both; if receiver slot is always-allow (0) it is skipped.
        if (!_authorized(token, token.TRANSFER_RECEIVER_POLICY(), participant)) return false;

        return true;
    }

    function _authorized(IB20Policy token, bytes32 scope, address account) internal view returns (bool) {
        bytes32 pid;
        try token.policyId(scope) returns (bytes32 p) {
            pid = p;
        } catch {
            return false;
        }
        if (pid == bytes32(0)) return true; // always-allow builtin
        try policyRegistry.isAuthorized(pid, account) returns (bool ok) {
            return ok;
        } catch {
            return false; // fail-closed
        }
    }

    /// @notice View helper for UI: returns the two policyIds for a market
    function getMarketPolicies(address market) external view returns (bytes32 senderPid, bytes32 receiverPid) {
        IB20Policy token = marketConfigs[market].token;
        if (address(token) == address(0)) return (bytes32(0), bytes32(0));
        try token.policyId(token.TRANSFER_SENDER_POLICY()) returns (bytes32 p) { senderPid = p; } catch { senderPid = bytes32(0); }
        try token.policyId(token.TRANSFER_RECEIVER_POLICY()) returns (bytes32 p) { receiverPid = p; } catch { receiverPid = bytes32(0); }
    }
}
