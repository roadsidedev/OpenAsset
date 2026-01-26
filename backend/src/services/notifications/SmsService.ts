import twilio from 'twilio';
import { config } from '../../config/unifiedConfig';
import { logger } from '../../utils/logger';

export class SmsService {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (config.alerts.twilio.accountSid && config.alerts.twilio.authToken) {
      this.client = twilio(config.alerts.twilio.accountSid, config.alerts.twilio.authToken);
    } else {
      logger.warn('Twilio not configured');
    }
  }

  async sendSms(to: string, body: string) {
    if (!this.client || !config.alerts.twilio.fromNumber) {
      logger.warn('SMS service not configured, skipping SMS');
      return;
    }

    try {
      await this.client.messages.create({
        body,
        from: config.alerts.twilio.fromNumber,
        to,
      });
      logger.info({ to }, 'SMS sent successfully');
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to send SMS');
    }
  }
}
