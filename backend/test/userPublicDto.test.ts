import { toPublicUser, toSelfUser } from '../src/controllers/UserController';

describe('User public DTO', () => {
  const fullUser = {
    address: '0xabc',
    email: 'secret@example.com',
    emailVerified: true,
    sms: '+15551234567',
    smsVerified: false,
    pushEnabled: true,
    pushToken: 'push-secret-token',
    emailAllAlerts: false,
    nonce: 'nonce-secret',
    nonceExpiresAt: new Date(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  it('toPublicUser omits email, sms, pushToken, nonce', () => {
    const dto = toPublicUser(fullUser);
    expect(dto).toEqual({
      address: '0xabc',
      emailVerified: true,
      smsVerified: false,
      pushEnabled: true,
      emailAllAlerts: false,
      createdAt: fullUser.createdAt,
    });
    expect(dto).not.toHaveProperty('email');
    expect(dto).not.toHaveProperty('sms');
    expect(dto).not.toHaveProperty('pushToken');
    expect(dto).not.toHaveProperty('nonce');
    expect(dto).not.toHaveProperty('nonceExpiresAt');
  });

  it('toSelfUser includes contact fields but not pushToken/nonce', () => {
    const dto = toSelfUser(fullUser);
    expect(dto.email).toBe('secret@example.com');
    expect(dto.sms).toBe('+15551234567');
    expect(dto).not.toHaveProperty('pushToken');
    expect(dto).not.toHaveProperty('nonce');
  });
});
