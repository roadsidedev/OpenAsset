jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), fatal: jest.fn() },
}));

jest.mock('../src/config/unifiedConfig', () => ({
  config: {
    alerts: {
      sendgrid: { apiKey: undefined, fromEmail: undefined },
      twilio: { accountSid: undefined, authToken: undefined, fromNumber: undefined },
      firebase: { serviceAccountKey: undefined },
      dedup: { defaultWindowSec: 3600, windows: { HEALTH_FACTOR: 1800, LIQUIDATION_RISK: 1800 } },
    },
  },
}));

jest.mock('../src/services/notifications/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({ sendEmail: jest.fn().mockResolvedValue(undefined) })),
}));

jest.mock('../src/services/notifications/SmsService', () => ({
  SmsService: jest.fn().mockImplementation(() => ({ sendSms: jest.fn().mockResolvedValue(undefined) })),
}));

jest.mock('../src/services/notifications/PushService', () => ({
  PushService: jest.fn().mockImplementation(() => ({ sendPush: jest.fn().mockResolvedValue(undefined) })),
}));

import { AlertService } from '../src/services/AlertService';

describe('AlertService', () => {
  const createMockPrisma = () => ({
    alert: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  });

  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let alertService: AlertService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    alertService = new AlertService(mockPrisma as any);
  });

  it('should be instantiated', () => {
    expect(alertService).toBeDefined();
  });

  it('should create an alert', async () => {
    mockPrisma.alert.create.mockResolvedValue({ id: 'alert-1', userId: '0x123', sentVia: [] });
    mockPrisma.alert.update.mockResolvedValue({ id: 'alert-1', status: 'SENT' });
    mockPrisma.user.findUnique.mockResolvedValue({
      address: '0x123',
      email: 'test@example.com',
      emailVerified: true,
      emailAllAlerts: true,
      sms: null,
      smsVerified: false,
      pushToken: null,
      pushEnabled: false,
    });

    await alertService.createAlert(
      '0x123',
      'LIQUIDATION_RISK' as any,
      'WARNING' as any,
      'Test alert'
    );

    expect(mockPrisma.alert.create).toHaveBeenCalled();
  });

  it('should handle missing user', async () => {
    mockPrisma.alert.create.mockResolvedValue({ id: 'alert-1' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.alert.update.mockResolvedValue({ status: 'FAILED' });

    await alertService.createAlert(
      '0x456',
      'LIQUIDATION_RISK' as any,
      'WARNING' as any,
      'Test alert'
    );

    expect(mockPrisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });
});