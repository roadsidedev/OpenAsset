# First-Party Reference Adapters

First-party adapters are both deployable implementations and teaching material. Read the interface, configuration, dependency handling, tests, and documented assumptions together. They are not automatically safe or suitable for production without the applicable verification and deployment review.

## Reading map

| Lesson | Reference implementation | What to study | Tests |
|---|---|---|---|
| ERC-20 asset movement | [`ERC20Adapter`](../contracts/src/adapters/asset/ERC20Adapter.sol) | SafeERC20 transfers, per-market token configuration, allowance and balance checks | `test/fizz/handlers/ERC20AdapterHandler.sol` |
| NFT asset movement | [`ERC721Adapter`](../contracts/src/adapters/asset/ERC721Adapter.sol) | Ownership, approval, token ID semantics, and transferability | `test/fizz/handlers/ERC721AdapterHandler.sol` |
| ERC-20 pricing | [`ChainlinkAdapter`](../contracts/src/adapters/oracle/ChainlinkAdapter.sol) | Feed registration, decimals, staleness, negative answers, and L2 sequencer checks | `test/unit/ChainlinkAdapter.test.ts` |
| TWAP pricing | [`UniswapV3TWAPAdapter`](../contracts/src/adapters/oracle/UniswapV3TWAPAdapter.sol) | Pool configuration, bounded TWAP windows, fallback and trust signal | `test/fizz/handlers/UniswapV3TWAPAdapterHandler.sol` |
| RWA/NAV pricing | [`NAVOracleAdapter`](../contracts/src/adapters/rwa/NAVOracleAdapter.sol) | Issuer NAV, proof-of-reserve, freshness, and normalization | RWA adapter tests and integration suite |
| Tokenized equity pricing | [`ChainlinkEquityFeedAdapter`](../contracts/src/adapters/rwa/ChainlinkEquityFeedAdapter.sol) | Trading-session awareness, sequencer grace, and market-specific settings | `test/unit/ChainlinkEquityFeedAdapter.test.ts` |
| Swap liquidation | [`DEXSwapLiquidationAdapter`](../contracts/src/adapters/liquidation/DEXSwapLiquidationAdapter.sol) | Market-only invocation, router handoff, minimum output, slippage, and reconciliation | `test/unit/DEXSwapLiquidationAdapter.test.ts` |
| NFT liquidation | [`NFTAuctionLiquidationAdapter`](../contracts/src/adapters/liquidation/NFTAuctionLiquidationAdapter.sol) | Asynchronous auction lifecycle and cure-window declarations | Lending-market liquidation tests |
| Compliance | [`ERC3643ComplianceAdapter`](../contracts/src/adapters/rwa/ERC3643ComplianceAdapter.sol) | Registry integration and fail-closed eligibility | `test/unit/B20Adapters.test.ts` |
| Managed RWA compliance | [`ManagedAllowlistComplianceAdapter`](../contracts/src/adapters/rwa/ManagedAllowlistComplianceAdapter.sol) | Explicit operator role, allowlist events, and honest claims | `test/unit/B20Adapters.test.ts` |
| Policy-controlled asset | [`B20AssetAdapter`](../contracts/src/adapters/asset/B20AssetAdapter.sol) | External policy checks, transfer pause, and fail-closed asset movement | `test/unit/B20Adapters.test.ts` |
| Position ownership | [`StandardPositionAdapter`](../contracts/src/adapters/position/StandardPositionAdapter.sol) | Clone initialization, market authorization, mint/burn, and ownerOf | Position adapter tests |

## How to study an adapter

Start at the constructor and identify immutable authority and dependency addresses. Follow `configure` to see what is keyed by market. Trace every runtime function from `msg.sender` through external calls and output validation. Then read the focused test file, especially unauthorized, stale, revert, and balance-delta cases. Finally compare the assumptions in code comments with the [verification checklist](./VERIFICATION_POLICY.md).

## Reference implementation rules

A first-party reference must compile, expose complete NatSpec for security-critical behavior, include deterministic local tests, document unsupported token/dependency behavior, avoid unbounded work, and keep production code separate from test-only mocks. A reference implementation is a learning baseline, not a shortcut around review. Use the [template catalog](./ADAPTER_TEMPLATES.md) for category selection and the [security model](./ADAPTER_SECURITY_MODEL.md) for permission, upgrade, and revocation requirements.
