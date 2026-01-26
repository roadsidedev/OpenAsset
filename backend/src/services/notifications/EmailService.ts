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

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    if (!config.alerts.sendgrid.apiKey || !config.alerts.sendgrid.fromEmail) {
      logger.warn('Email service not configured, skipping email');
      return;
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
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to send email');
      // We don't throw here to prevent stopping other alerts, but in a robust system we might want a retry queue.
    }
  }
}
