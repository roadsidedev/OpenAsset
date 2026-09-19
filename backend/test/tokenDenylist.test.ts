import { revokeToken, isTokenRevoked, clearDenylist } from '../src/utils/tokenDenylist';

describe('tokenDenylist', () => {
  beforeEach(() => clearDenylist());

  it('revokes and recognizes jti', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    revokeToken('jti-1', exp);
    expect(isTokenRevoked('jti-1')).toBe(true);
    expect(isTokenRevoked('other')).toBe(false);
  });

  it('ignores already-expired entries', () => {
    revokeToken('jti-expired', Math.floor(Date.now() / 1000) - 10);
    expect(isTokenRevoked('jti-expired')).toBe(false);
  });
});
