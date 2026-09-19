/**
 * JWT_SECRET boot validation — loads unifiedConfig with controlled env.
 * Uses isolated module reload so placeholders / missing secrets throw.
 */

const MODULE_PATH = '../src/config/unifiedConfig';

function loadConfigWithEnv(env: Record<string, string | undefined>) {
  jest.resetModules();
  const previous: Record<string, string | undefined> = {};
  const keys = [
    'JWT_SECRET',
    'NODE_ENV',
    'DATABASE_URL',
    'RPC_URLS',
    'PORT',
    'LOG_LEVEL',
    'FRONTEND_URL',
  ];
  for (const k of keys) {
    previous[k] = process.env[k];
  }
  // Baseline safe env for schema parse
  process.env.DATABASE_URL = env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/openasset_test';
  process.env.RPC_URLS = env.RPC_URLS ?? 'http://127.0.0.1:8545';
  process.env.NODE_ENV = env.NODE_ENV ?? 'test';
  process.env.LOG_LEVEL = env.LOG_LEVEL ?? 'error';
  if (env.JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = env.JWT_SECRET;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(MODULE_PATH);
  } finally {
    for (const k of keys) {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    }
  }
}

describe('JWT_SECRET boot validation', () => {
  afterEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret-for-testing';
    process.env.NODE_ENV = 'test';
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => loadConfigWithEnv({ JWT_SECRET: undefined, NODE_ENV: 'test' })).toThrow(
      /JWT_SECRET is required/
    );
  });

  it('throws when JWT_SECRET is the known insecure placeholder', () => {
    expect(() =>
      loadConfigWithEnv({
        JWT_SECRET: 'super-secret-change-me-in-production',
        NODE_ENV: 'development',
      })
    ).toThrow(/insecure placeholder/);
  });

  it('throws in production when secret is too short', () => {
    expect(() =>
      loadConfigWithEnv({
        JWT_SECRET: 'short-but-not-placeholder',
        NODE_ENV: 'production',
      })
    ).toThrow(/at least 32 characters/);
  });

  it('accepts a strong secret', () => {
    const mod = loadConfigWithEnv({
      JWT_SECRET: 'a'.repeat(32) + '-strong-test-secret',
      NODE_ENV: 'test',
    });
    expect(mod.config.jwtSecret).toContain('strong-test-secret');
  });
});
