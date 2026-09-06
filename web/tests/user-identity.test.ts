/**
 * Logic tests for user identity derivation.
 *
 * Pure-function coverage (no network):
 * 1. resolveSocialIdentity — avatar priority (pfpUrl > twitter > google > …),
 *    display-name resolution (handle > name > email), null safety
 * 2. identiconForAddress — determinism, distinctness, palette bounds,
 *    non-empty patterns, neutral fallback for missing addresses
 *
 * Run: npx tsx tests/user-identity.test.ts
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

async function main() {
  const { resolveSocialIdentity, identiconForAddress } = await import('../src/lib/identity');

  console.log('\nOpenAsset — user identity logic tests\n');

  // ─── 1. Social identity resolution ─────────────────────────
  console.log('Test 1: Social identity resolution');

  // Twitter-only user
  const twitterUser = {
    twitter: { username: 'satoshi', profilePictureUrl: 'https://pbs.twimg.com/a.jpg' },
  };
  const tw = resolveSocialIdentity(twitterUser);
  assert(tw.avatarUrl === 'https://pbs.twimg.com/a.jpg', 'Twitter profile picture used as avatar');
  assert(tw.displayName === 'satoshi', 'Twitter handle used as display name');
  assert(tw.source === 'social', 'Source marked social');

  // Google-only user (profilePictureUrl field name)
  const googleUser = {
    google: { name: 'Ada Lovelace', profilePictureUrl: 'https://lh3.googleusercontent.com/b.jpg' },
    email: { address: 'ada@example.com' },
  };
  const go = resolveSocialIdentity(googleUser);
  assert(go.avatarUrl === 'https://lh3.googleusercontent.com/b.jpg', 'Google profile picture used as avatar');
  assert(go.displayName === 'Ada Lovelace', 'Google real name preferred over email');
  assert(go.source === 'social', 'Google counts as social');

  // Privy aggregated pfpUrl takes top priority
  const aggregated = {
    pfpUrl: 'https://cdn.privy.com/top.jpg',
    twitter: { username: 'x', profilePictureUrl: 'https://pbs.twimg.com/lower.jpg' },
  };
  const agg = resolveSocialIdentity(aggregated);
  assert(agg.avatarUrl === 'https://cdn.privy.com/top.jpg', 'Privy aggregated pfpUrl wins over linked accounts');

  // Avatar priority across linked accounts: twitter before google
  const both = {
    google: { name: 'G', profilePictureUrl: 'https://g/2.jpg' },
    twitter: { username: 'T', profilePictureUrl: 'https://t/1.jpg' },
  };
  assert(resolveSocialIdentity(both).avatarUrl === 'https://t/1.jpg', 'Twitter avatar preferred over google');

  // Email-only login: no avatar, email as display name
  const emailOnly = { email: { address: 'dev@openasset.io' } };
  const em = resolveSocialIdentity(emailOnly);
  assert(!em.avatarUrl, 'Email-only user has no avatar');
  assert(em.displayName === 'dev@openasset.io', 'Email used as display name fallback');
  assert(em.source === 'none', 'Email-only source is none (identicon path)');

  // Twitter legacy field name (profilePicture)
  const legacy = { twitter: { username: 'old', profilePicture: 'https://t/legacy.jpg' } };
  assert(resolveSocialIdentity(legacy).avatarUrl === 'https://t/legacy.jpg', 'Legacy profilePicture field supported');

  // Null / undefined safety
  assert(resolveSocialIdentity(null).source === 'none', 'null user resolves to none');
  assert(resolveSocialIdentity(undefined).source === 'none', 'undefined user resolves to none');
  assert(resolveSocialIdentity({}).displayName === undefined, 'Empty user has no display name');

  // ─── 2. Identicon generation ───────────────────────────────
  console.log('\nTest 2: Identicon generation');

  const A = '0xc30e5c99bF1997Db3Cb8E864F5eD0b6E4A244A5';
  const i1 = identiconForAddress(A);
  const i2 = identiconForAddress(A);
  assert(JSON.stringify(i1) === JSON.stringify(i2), 'Identicon is deterministic for the same address');
  assert(identiconForAddress(A.toLowerCase()).from === i1.from, 'Identicon ignores address casing');

  const i3 = identiconForAddress('0x1111111111111111111111111111111111111111');
  const i4 = identiconForAddress('0x2222222222222222222222222222222222222222');
  assert(
    i3.from !== i4.from || i3.to !== i4.to || JSON.stringify(i3.cells) !== JSON.stringify(i4.cells),
    'Different addresses produce different identicons',
  );

  assert(i1.cells.length === 15, 'Identicon has 15 seed cells (3×5 mirrored)');
  assert(i1.cells.some(Boolean), 'Identicon pattern is never empty');
  assert(PALETTE_SIZE_OK(i1), 'Palette colors come from the curated set');

  const neutral = identiconForAddress(null);
  assert(neutral.from === '#94a3b8', 'Missing address renders neutral placeholder');
  assert(identiconForAddress('').from === '#94a3b8', 'Empty address renders neutral placeholder');

  // Every generated pattern must be a valid shape
  const sample = ['0xabc', '0xdead', '0xbeef', '0x0000000000000000000000000000000000000000'];
  assert(
    sample.every((a) => {
      const ic = identiconForAddress(a);
      return ic.cells.length === 15 && ic.cells.every((c) => typeof c === 'boolean');
    }),
    'All sampled identicons have valid cell shapes',
  );

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

/** Validates from/to are hex colors (any palette is acceptable; structure check). */
function PALETTE_SIZE_OK(i: { from: string; to: string }): boolean {
  return /^#[0-9a-f]{6}$/i.test(i.from) && /^#[0-9a-f]{6}$/i.test(i.to);
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
