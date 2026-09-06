import sgMail from '@sendgrid/mail';
import { config } from '../../config/unifiedConfig';
import { logger } from '../../utils/logger';

export class EmailService {
  constructor() {
    if (config.alerts.sendgrid.apiKey) {
      sgMail.setApiKey(config.alerts.sendgrid.apiKey);
    } else {
      logger.warn('SendGrid API Key not configured');
    }
  }

  /**
   * Sends an email. Returns true when actually delivered, false when skipped
   * (transport unconfigured) or failed — callers can degrade gracefully.
   */
  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!config.alerts.sendgrid.apiKey || !config.alerts.sendgrid.fromEmail) {
      logger.warn('Email service not configured, skipping email');
      return false;
    }

    try {
      await sgMail.send({
        to,
        from: config.alerts.sendgrid.fromEmail,
        subject,
        text,
        html: html || text,
      });
      logger.info({ to, subject }, 'Email sent successfully');
      return true;
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to send email');
      // We don't throw here to prevent stopping other alerts, but in a robust system we might want a retry queue.
      return false;
    }
  }
}
