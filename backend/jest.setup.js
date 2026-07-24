// Set test environment variables before any modules load
process.env.LOG_LEVEL = 'error';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/openasset_test';
process.env.JWT_SECRET = 'test-secret-for-testing';
process.env.RPC_URLS = '11155111:http://127.0.0.1:8545';
// Contract addresses use chain-prefixed format but Zod validates regex for raw 0x format
// Skip setting them - let Zod defaults handle it