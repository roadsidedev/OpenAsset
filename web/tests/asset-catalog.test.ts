/**
 * Logic tests for the asset-first market creation flow.
 *
 * Pure-function coverage (no network):
 * 1. Asset catalog build + adapter resolution per chain
 * 2. Search ranking (exact > prefix > substring, providers first)
 * 3. Adapter preview strips
 * 4. Minimum initial liquidity validation ($1,000 protocol minimum,
 *    verified from MarketFactory.sol MIN_LIQUIDITY_USD = 1000e18)
 * 5. Tx-trail → activity event projection
 *
 * Run: npx tsx tests/asset-catalog.test.ts
 */

// Adapter addresses are env-deployed (contracts.ts reads NEXT_PUBLIC_* at module
// load), so env vars must be set BEFORE importing any module that transitively
// loads contracts.ts. All imports below are dynamic for that reason.
process.env.NEXT_PUBLIC_B20_ASSET_ADAPTER_8453 = process.env.NEXT_PUBLIC_B20_ASSET_ADAPTER_8453 || '0xC6F5d51304518Fd1C7df8e7E23B16242400aB953';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function main() {
  const { buildAssetCatalog, searchAssetCatalog, getAdapterPreviewAssets, findCatalogAsset } = await import('../src/lib/assetCatalog');
  const { validateInitialLiquidityUSD, calculateCreationFeeUsd, MIN_INITIAL_LIQUIDITY_USD } = await import('../src/lib/minDeposit');
  const { txTrailToActivityEvents } = await import('../src/store/useTxTrail');
  const { getChainLabel } = await import('../src/lib/chainLabels');

  interface TxTrailEntry {
    id: string;
    type: 'MARKET_CREATED' | 'LOAN_REQUESTED' | 'LOAN_REPAID' | 'LIQUIDITY_DEPOSITED';
    txHash: string;
    chainId: number;
    address: string;
    timestamp: number;
    summary: string;
    details: Record<string, string>;
  }
  console.log('\nOpenAsset — asset-first market creation logic tests\n');

  // ─── 1. Catalog build ─────────────────────────────────────────
  console.log('Test 1: Asset catalog build');
  const catalog = buildAssetCatalog();
  assert(catalog.length > 0, `Catalog has ${catalog.length} assets`);
  const b20 = catalog.filter((a) => a.source === 'b20');
  assert(b20.length >= 10, `B20 tokenized stocks present (${b20.length})`);
  assert(b20.every((a) => a.chainId === 8453), 'B20 assets are native to Base mainnet (8453)');
  assert(b20.every((a) => !!a.assetAdapter), 'B20 assets resolve the b20AssetAdapter address');
  assert(b20.every((a) => !!a.feed), 'B20 assets carry a Chainlink feed');
  const robinhood = catalog.filter((a) => a.source === 'robinhood');
  assert(robinhood.length >= 1, `Robinhood stock tokens present (${robinhood.length})`);
  assert(robinhood.every((a) => a.chainId === 4663), 'Robinhood assets are native to Robinhood Chain (4663)');
  const erc20 = catalog.filter((a) => a.source === 'erc20');
  assert(erc20.length >= 5, `Curated ERC20s present (${erc20.length})`);
  assert(catalog.every((a) => /^0x[0-9a-fA-F]{40}$/.test(a.address)), 'All catalog addresses are valid EVM addresses');

  // ─── 2. Search ranking ────────────────────────────────────────
  console.log('\nTest 2: Search ranking');
  const exact = searchAssetCatalog(catalog, 'tslac');
  assert(exact.length > 0 && exact[0].symbol === 'TSLAc', 'Exact symbol match ranks first');
  const prefix = searchAssetCatalog(catalog, 'aapl');
  assert(prefix.length > 0 && prefix[0].symbol.toLowerCase().startsWith('aapl'), 'Prefix match ranks first');
  const partial = searchAssetCatalog(catalog, 'tsl');
  assert(partial.length > 0, 'Substring search returns results');
  const empty = searchAssetCatalog(catalog, 'zzzznotfound');
  assert(empty.length === 0, 'No results for garbage query');
  const usdc = searchAssetCatalog(catalog, 'USDC');
  assert(usdc.length >= 3, `USDC found across ${usdc.length} chains`);
  const byAddress = findCatalogAsset(catalog, '0xb2000000000000000000001e800a7f5189430cD0');
  assert(!!byAddress && byAddress.symbol === 'TSLAc', 'findCatalogAsset resolves by address (case-insensitive)');

  // ─── 3. Adapter previews ──────────────────────────────────────
  console.log('\nTest 3: Adapter preview strips');
  const b20Adapter = findCatalogAsset(catalog, '0xb2000000000000000000001e800a7f5189430cD0')!.assetAdapter!;
  const preview = getAdapterPreviewAssets(b20Adapter, 8453);
  assert(preview.length > 0 && preview.every((a) => a.source === 'b20'), `B20 adapter preview shows ${preview.length} stock assets`);
  assert(preview.length <= 6, 'Preview strip is capped');
  const emptyPreview = getAdapterPreviewAssets(undefined, 8453);
  assert(emptyPreview.length === 0, 'No preview without adapter address');
  const unknownAdapter = getAdapterPreviewAssets('0x0000000000000000000000000000000000000001', 84532);
  assert(unknownAdapter.length === 0, 'Unknown adapter gets empty preview (manual/browse path)');

  // ─── 4. Minimum liquidity ($1,000 from MarketFactory.sol) ─────
  console.log('\nTest 4: Minimum initial liquidity');
  assert(MIN_INITIAL_LIQUIDITY_USD === 1000, 'MIN_INITIAL_LIQUIDITY_USD = 1000 (MarketFactory.sol:40 = 1000e18 normalized)');
  assert(validateInitialLiquidityUSD('1000').ok, 'Exactly $1,000 passes');
  assert(validateInitialLiquidityUSD('1500.50').ok, 'Above minimum passes');
  assert(!validateInitialLiquidityUSD('999.99').ok, '$999.99 rejected');
  assert(!validateInitialLiquidityUSD('').ok, 'Empty rejected');
  assert(!validateInitialLiquidityUSD('0').ok, 'Zero rejected');
  assert(!validateInitialLiquidityUSD('abc').ok, 'Non-numeric rejected');
  const below = validateInitialLiquidityUSD('500');
  assert(!!below.error && below.error.includes('1,000'), 'Error message states the $1,000 minimum');
  assert(calculateCreationFeeUsd(1000) === 5, '0.5% creation fee = $5 per $1,000 (CREATION_FEE_BPS = 50)');

  // ─── 5. Tx trail → activity projection ────────────────────────
  console.log('\nTest 5: Tx trail projection');
  const entries: TxTrailEntry[] = [
    {
      id: '0xabc-MARKET_CREATED',
      type: 'MARKET_CREATED',
      txHash: '0xabc',
      chainId: 84532,
      address: '0x00000000000000000000000000000000000000aa',
      timestamp: Date.now(),
      summary: 'TSLAc market · 1,000 USDC liquidity',
      details: { txHash: '0xabc', message: 'TSLAc market created with 1,000 USDC liquidity' },
    },
  ];
  const projected = txTrailToActivityEvents(entries);
  assert(projected.length === 1, 'One activity event projected');
  assert(projected[0].type === 'MARKET_CREATED', 'Type preserved (renders as "Market Created")');
  assert(projected[0].details.message.includes('TSLAc'), 'Summary preserved in details.message');
  assert(!!projected[0].details.txHash, 'txHash carried for dedup against backend events');
  assert(!isNaN(Date.parse(projected[0].timestamp)), 'ISO timestamp is parseable');

  // ─── 6. Chain labels ──────────────────────────────────────────
  console.log('\nTest 6: Chain labels');
  assert(getChainLabel(84532) === 'Base Sepolia', 'Base Sepolia labeled');
  assert(getChainLabel(8453) === 'Base', 'Base labeled');
  assert(getChainLabel(4663) === 'Robinhood Chain', 'Robinhood Chain labeled');
  assert(getChainLabel(46630) === 'Robinhood Testnet', 'Robinhood Testnet labeled');
  assert(getChainLabel(undefined) === 'Unknown network', 'Undefined chain handled');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
