jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), fatal: jest.fn() },
}));

jest.mock('../src/config/unifiedConfig', () => ({
  config: {
    chains: [{ id: 11155111, rpcUrls: ['http://localhost:8545'] }],
    contracts: {
      marketFactory: new Map([[11155111, '0xFactory']]),
      adapterRegistry: new Map([[11155111, '0xRegistry']]),
    },
  },
  getRpcUrl: jest.fn().mockReturnValue('http://localhost:8545'),
  getContractAddress: jest.fn().mockReturnValue('0xContract'),
}));

import { ContractServiceV2 } from '../src/services/web3/ContractServiceV2';

describe('ContractServiceV2', () => {
  let service: ContractServiceV2;

  beforeEach(() => {
    service = new ContractServiceV2();
    service.clearCache();
  });

  it('should clear cache', () => {
    service.clearCache();
    const stats = service.getCacheStats();
    expect(Object.values(stats).every(v => v === 0)).toBe(true);
  });

  it('should return cache stats', () => {
    const stats = service.getCacheStats();
    expect(stats).toHaveProperty('marketStats');
    expect(stats).toHaveProperty('loanDetails');
  });
});