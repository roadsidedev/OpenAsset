/**
 * Logic tests for the adapter registry end-to-end flow.
 *
 * Pure-function coverage (no network):
 * 1. Frontend ABI exposes the on-chain registration writes
 *    (registerAdapter, registerAdapterWithMetadata, updateMetadata)
 *    plus the metadata view (getAdapterMetadata) from AdapterRegistry.sol
 * 2. Every deployed (non-zero) adapter address in contracts.ts has frontend
 *    metadata via getAdapterMeta — the map must be generated from the same
 *    source of truth, never hardcoded stale addresses
 * 3. Adapter type enum mapping (0-4) matches AdapterRegistry.AdapterType
 * 4. getDeployedAdapters lists the selectable set per chain
 *
 * Run: npx tsx tests/adapter-registry.test.ts
 */

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

function abiFunctionNames(abi: readonly unknown[]): string[] {
  return (abi as Array<{ name?: string; type?: string }>)
    .filter((e) => e && e.type === 'function' && typeof e.name === 'string')
    .map((e) => e.name as string);
}

async function main() {
  const { ADAPTER_REGISTRY_ABI, ADAPTER_TYPES } = await import('../src/lib/contractAbis');
  const { getAdapterMeta, getDeployedAdapters } = await import('../src/lib/adapterRegistry');
  const { getContracts } = await import('../src/lib/contracts');

  console.log('\nOpenAsset — adapter registry logic tests\n');

  // ─── 1. ABI exposes registration writes ────────────────────
  console.log('Test 1: Registry ABI write surface');
  const fns = abiFunctionNames(ADAPTER_REGISTRY_ABI);
  assert(fns.includes('registerAdapter'), 'ABI exposes registerAdapter');
  assert(fns.includes('registerAdapterWithMetadata'), 'ABI exposes registerAdapterWithMetadata');
  assert(fns.includes('updateMetadata'), 'ABI exposes updateMetadata');
  assert(fns.includes('getAdapterMetadata'), 'ABI exposes getAdapterMetadata');
  assert(fns.includes('getAllAdapters'), 'ABI exposes getAllAdapters');
  assert(fns.includes('getAdapterInfo'), 'ABI exposes getAdapterInfo');
  assert(fns.includes('isSelectable'), 'ABI exposes isSelectable');

  // ─── 2. Type enum mapping ──────────────────────────────────
  console.log('\nTest 2: AdapterType enum mapping');
  assert(ADAPTER_TYPES[0] === 'ASSET', '0 = ASSET');
  assert(ADAPTER_TYPES[1] === 'ORACLE', '1 = ORACLE');
  assert(ADAPTER_TYPES[2] === 'COMPLIANCE', '2 = COMPLIANCE');
  assert(ADAPTER_TYPES[3] === 'LIQUIDATION', '3 = LIQUIDATION');
  assert(ADAPTER_TYPES[4] === 'POSITION', '4 = POSITION');

  // ─── 3. Metadata covers every deployed adapter ─────────────
  console.log('\nTest 3: Metadata sync with contracts.ts');
  const ZERO = '0x0000000000000000000000000000000000000000';
  const chains = [84532, 11155111, 46630];
  let checked = 0;
  let missing: string[] = [];
  for (const chainId of chains) {
    const contracts = getContracts(chainId);
    if (!contracts) {
      failed++;
      console.log(`  ✗ No contracts entry for chain ${chainId}`);
      continue;
    }
    const keys = [
      'erc20Adapter',
      'erc721Adapter',
      'chainlinkAdapter',
      'uniswapV3TWAPAdapter',
      'chainlinkEquityFeedAdapter',
      'b20AssetAdapter',
      'b20PolicyComplianceAdapter',
      'robinhoodComplianceAdapter',
      'standardPositionAdapter',
      'soulboundPositionAdapter',
      'transferablePositionAdapter',
      'dexSwapLiquidationAdapter',
      'nftAuctionLiquidationAdapter',
    ] as const;
    for (const key of keys) {
      const addr = contracts[key];
      if (!addr || addr === ZERO) continue;
      checked++;
      const meta = getAdapterMeta(chainId, addr);
      if (!meta) missing.push(`${chainId}:${key}:${addr}`);
    }
  }
  assert(checked > 0, `Checked ${checked} deployed adapter addresses`);
  assert(missing.length === 0, missing.length === 0 ? 'All deployed adapters have metadata' : `Missing metadata: ${missing.join(', ')}`);

  // ─── 4. getDeployedAdapters helper ─────────────────────────
  console.log('\nTest 4: Deployed adapter listing');
  const listed84532 = getDeployedAdapters(84532);
  assert(listed84532.length >= 8, `Base Sepolia lists ${listed84532.length} deployed adapters (≥8)`);
  assert(
    listed84532.every((a) => a.address !== ZERO && !!a.name && !!a.type),
    'Every listed adapter has address, name and type',
  );
  const types84532 = new Set(listed84532.map((a) => a.type));
  for (const t of ['ASSET', 'ORACLE', 'POSITION', 'LIQUIDATION']) {
    assert(types84532.has(t), `Base Sepolia covers ${t}`);
  }
  assert(getDeployedAdapters(999999).length === 0, 'Unknown chain lists nothing');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
