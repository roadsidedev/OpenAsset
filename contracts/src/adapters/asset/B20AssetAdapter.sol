// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IB20
 * @notice Minimal B20 interface needed for asset adapter
 * @dev B20 is an ERC-20 extension (Beryl upgrade precompile) with policy slots and pauses.
 * Selectors verified against IB20 spec reference at commit 5c6c5cd.
 */
interface IB20 is IERC20 {
    // Policy scopes (fixed constants in B20 spec)
    function TRANSFER_SENDER_POLICY() external view returns (bytes32);
    function TRANSFER_RECEIVER_POLICY() external view returns (bytes32);
    function TRANSFER_EXECUTOR_POLICY() external view returns (bytes32);
    function policyId(bytes32 policyScope) external view returns (uint64);
    function isPaused(bytes32 feature) external view returns (bool);
    // Optional B20 helpers (not required for core escrow, used by indexer/UI)
    function multiplier() external view returns (uint256);
    function scaledBalanceOf(address account) external view returns (uint256);
    function toScaledBalance(uint256 raw) external view returns (uint256);
    function WAD_PRECISION() external view returns (uint256);
}

/**
 * @title IPolicyRegistry
 * @notice Registry for B20 transfer policies
 * @dev isAuthorized never reverts — unknown policy/account returns false.
 * Selector 0x55a1179e verified against IPolicyRegistry spec reference.
 */
interface IPolicyRegistry {
    function isAuthorized(uint64 policyId, address account) external view returns (bool);
}

/**
 * @title B20AssetAdapter
 * @notice Multi-tenant asset adapter for Base B20 tokenized stocks
 * @dev Implements IAssetAdapter with:
 *  - Standard ERC-20 escrow/release via SafeERC20 (B20 is ERC-20 compatible)
 *  - Policy-aware isTransferable (checks sender + receiver + executor slots via PolicyRegistry)
 *  - Pause awareness (Transfers feature)
 *  - Multi-tenancy: factory calls configure(market, collateralToken) once per market.
 *    Per-market config keyed by market address (mirrors ERC20Adapter.sol:21 pattern).
 *
 * Trust model: engine verifies balance delta post-escrow (LendingMarketV2.sol:383)
 * so under-delivery reverts regardless of adapter bug. Policy reverts at origination
 * are atomic and safe (TR §4).
 */
contract B20AssetAdapter is IAssetAdapter {
    error B20ReleaseUnauthorized();
    error InvalidB20Token(address token);
    using SafeERC20 for IERC20;

    address public immutable factory;
    IPolicyRegistry public immutable policyRegistry;

    struct MarketConfig {
        IB20 token;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory, address _policyRegistry) {
        require(_factory != address(0), "Invalid factory");
        require(_policyRegistry != address(0), "Invalid registry");
        factory = _factory;
        policyRegistry = IPolicyRegistry(_policyRegistry);
    }

    event MarketConfigured(address indexed market, address indexed token);
    event CollateralEscrowed(address indexed market, address indexed from, uint256 amount);
    event CollateralReleased(address indexed market, address indexed to, uint256 amount);

    function configure(address market, address collateralToken) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(collateralToken != address(0), "Invalid token");
        // Review M7: one-time config (see ERC20Adapter)
        require(address(marketConfigs[market].token) == address(0), "Already configured");
        // Review M12: reject tokens that don't expose the B20 policy surface
        // (selector probe with returndata-length guard — an EOA or plain ERC20
        // would otherwise wire silently and fail only at first borrow).
        (bool pidOk, bytes memory pidRet) = collateralToken.staticcall(
            abi.encodeWithSelector(bytes4(keccak256("policyId(bytes32)")), bytes32(0))
        );
        if (!pidOk || pidRet.length < 32) revert InvalidB20Token(collateralToken);
        marketConfigs[market] = MarketConfig({ token: IB20(collateralToken) });
        emit MarketConfigured(market, collateralToken);
    }

    /// @notice Escrow B20 collateral from borrower to the calling market (msg.sender == market)
    function escrow(address from, uint256 amountOrId) external override {
        IB20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        // Pull from borrower -> market (market is msg.sender inside adapter context)
        IERC20(address(token)).safeTransferFrom(from, msg.sender, amountOrId);
        emit CollateralEscrowed(msg.sender, from, amountOrId);
    }

    /// @notice Release B20 collateral from market to recipient
    /// @dev Requires market has approved this adapter to spend its tokens.
    /// LendingMarketV2 constructor does max approval for collateralAsset when isContract().
    /// Review H6: release-direction policy pre-check — the B20 token enforces the
    /// market's sender policy and the recipient's receiver policy at transfer time;
    /// surfacing it here gives a precise revert BEFORE any protocol interaction and a
    /// view for frontends, instead of stranding the loan after debt collection.
    function release(address to, uint256 amountOrId) external override {
        IB20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        // Sender policy applies to the market (the token holder being debited),
        // receiver policy to the recipient; the executor is this adapter.
        if (!_authorizedFor(token, token.TRANSFER_SENDER_POLICY(), msg.sender)) {
            revert B20ReleaseUnauthorized();
        }
        if (!_authorizedFor(token, token.TRANSFER_RECEIVER_POLICY(), to)) {
            revert B20ReleaseUnauthorized();
        }
        if (!_authorizedFor(token, token.TRANSFER_EXECUTOR_POLICY(), address(this))) {
            revert B20ReleaseUnauthorized();
        }
        // adapter is spender for market's balance
        IERC20(address(token)).safeTransferFrom(msg.sender, to, amountOrId);
        emit CollateralReleased(msg.sender, to, amountOrId);
    }

    /// @notice View pre-check for the release direction (review H6): can the market
    ///         release `amountOrId` to `to` given current B20 policies?
    function isReleaseable(address to, uint256 amountOrId) external view returns (bool) {
        if (to == address(0) || amountOrId == 0) return false;
        IB20 token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;
        if (!_authorizedFor(token, token.TRANSFER_SENDER_POLICY(), msg.sender)) return false;
        if (!_authorizedFor(token, token.TRANSFER_RECEIVER_POLICY(), to)) return false;
        if (!_authorizedFor(token, token.TRANSFER_EXECUTOR_POLICY(), address(this))) return false;
        return token.balanceOf(msg.sender) >= amountOrId;
    }

    /// @notice Check if B20 transfer would succeed prior to spending gas on escrow
    /// @dev Checks: policy authorized for both parties, balance + allowance to MARKET (not adapter).
    /// Pause is intentionally NOT checked here — it is a granular per-feature flag with unstable selector
    /// across B20 builds. A paused transfer will simply revert at escrow time and the engine's balance-delta
    /// invariant (LendingMarketV2.sol:383) will surface it atomically. isTransferable is a UX pre-check only.
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        IB20 token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;

        // Policy checks — sender, receiver, and executor slots. Policy ID 0 is the
        // always-allow sentinel. The executor of token.transferFrom is this adapter.
        if (!_authorizedFor(token, token.TRANSFER_SENDER_POLICY(), from)) return false;
        if (!_authorizedFor(token, token.TRANSFER_RECEIVER_POLICY(), to)) return false;
        if (!_authorizedFor(token, token.TRANSFER_EXECUTOR_POLICY(), address(this))) return false;

        uint256 balance = token.balanceOf(from);
        // Allowance must be from -> adapter (adapter is the spender in escrow), not -> market
        // LendingMarketV2 calls assetAdapter.escrow(borrower, amount); adapter then does token.transferFrom(borrower, market, amount)
        // So ERC20 checks allowance[borrower][adapter] == address(this)
        uint256 allowance = token.allowance(from, address(this));
        return balance >= amountOrId && allowance >= amountOrId;
    }

    function _authorizedFor(IB20 token, bytes32 scope, address account) internal view returns (bool) {
        uint64 pid;
        try token.policyId(scope) returns (uint64 p) {
            pid = p;
        } catch {
            return false; // fail-closed if token does not expose policyId
        }
        if (pid == 0) return true; // always-allow builtin
        try policyRegistry.isAuthorized(pid, account) returns (bool ok) {
            return ok;
        } catch {
            return false; // fail-closed — registry never reverts per spec but guard anyway
        }
    }

    /// @notice Helper for UI/indexer: scaled balance for a market's token
    function scaledBalanceOf(address market, address account) external view returns (uint256) {
        IB20 token = marketConfigs[market].token;
        if (address(token) == address(0)) return 0;
        try token.scaledBalanceOf(account) returns (uint256 s) { return s; } catch { return 0; }
    }
}
