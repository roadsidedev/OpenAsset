import { LifecycleManager, WorkerName } from '../src/bootstrap/lifecycle';

describe('LifecycleManager', () => {
  let lifecycle: LifecycleManager;

  const createMockWorker = (name: WorkerName) => ({
    name,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
  });

  beforeEach(() => {
    lifecycle = new LifecycleManager({
      shutdownTimeoutMs: 5000,
      healthCheckIntervalMs: 1000,
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should register workers', () => {
    lifecycle.register(createMockWorker('api'));
    expect(lifecycle.getWorker('api')).toBeDefined();
  });

  it('should throw when registering duplicate worker', () => {
    lifecycle.register(createMockWorker('api'));
    expect(() => lifecycle.register(createMockWorker('api'))).toThrow();
  });

  it('should start workers', async () => {
    const apiWorker = createMockWorker('api');
    lifecycle.register(apiWorker);
    await lifecycle.startAll();
    expect(apiWorker.start).toHaveBeenCalled();
  });

  it('should stop workers on shutdown', async () => {
    const apiWorker = createMockWorker('api');
    lifecycle.register(apiWorker);
    await lifecycle.startAll();
    await lifecycle.stopAll('SIGTERM');
    expect(apiWorker.stop).toHaveBeenCalled();
  });
});