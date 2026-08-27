# Robinhood Chain Read-Only Verification — 27 August 2026

No transaction, signature, deployment, approval, or database mutation was performed.

## RPC identity

The public RPC `https://rpc.mainnet.chain.robinhood.com` returned chain ID `0x1237`, which is decimal **4663**, and a current block number during the probe.

## Canonical AAPL token and feed

The canonical Robinhood AAPL token `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` has executable code and returned:

| Read | Result |
| --- | --- |
| `decimals()` | `18` |
| `uiMultiplier()` | `1000566080061092436` |
| `oraclePaused()` | `false` (`0`) |
| `totalSupply()` | `5723955702780000000000` raw units at probe time |

The Chainlink feed proxy `0x6B22A786bAa607d76728168703a39Ea9C99f2cD0` has executable code and returned:

| Read | Result |
| --- | --- |
| `decimals()` | `8` |
| `description()` | `Robinhood AAPL / USD` |
| `latestRoundData()` | Positive answer, nonzero timestamps, round ID `18446744073709552125` at probe time |

The latest feed answer was `31152209667` at 8 decimals, equivalent to **311.52209667 USD per token** at the probe time. This is a point-in-time read, not a price recommendation or deployment parameter.

## Official deployment references

Robinhood Chain documentation lists chain ID 4663, the public RPC, and public sequencer stream endpoints. Its token-contract page identifies the AAPL token as canonical and warns that a same-ticker contract at another address is not the canonical Robinhood Stock Token. Uniswap’s official Robinhood deployment page lists the v3 factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa`, QuoterV2 `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7`, and SwapRouter02 `0xcaf681a66d020601342297493863e78c959e5cb2`.

## Remaining verification

The official Robinhood documentation lists USDG at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` and WETH at `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`. Pool existence, fee tier, liquidity, and quote viability still require direct read-only `UniswapV3Factory.getPool` and pool-state checks. The official Robinhood documentation recommends provider RPCs for production rather than rate-limited public endpoints. The final deployment must also verify the actual lending asset selected by OpenAsset, because the current repository configuration uses a placeholder environment variable rather than a confirmed Robinhood lending-asset manifest.

## Sources

- https://docs.robinhood.com/chain/contracts/
- https://docs.robinhood.com/chain/connecting/
- https://docs.robinhood.com/chain/oracles-and-price-feeds/
- https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood
- https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments
