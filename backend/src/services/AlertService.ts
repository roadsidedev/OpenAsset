import { PrismaClient, AlertType, AlertLevel } from '@prisma/client';
import { logger } from '../utils/logger';
import { EmailService } from './notifications/EmailService';
import { SmsService } from './notifications/SmsService';
import { PushService } from './notifications/PushService';

export class AlertService {
  private emailService: EmailService;
  private smsService: SmsService;
  private pushService: PushService;

  constructor(private prisma: PrismaClient) {
    this.emailService = new EmailService();
    this.smsService = new SmsService();
    this.pushService = new PushService();
  }

  async createAlert(
    userId: string,
    type: AlertType,
    level: AlertLevel,
    message: string,
    loanId?: string
  ) {
    try {
      const alert = await this.prisma.alert.create({
        data: {
          userId,
          type,
          level,
          message,
          loanId: loanId || null, 
          sentVia: [], 
        },
      });

      const updatedAlert = await this.dispatchAlert(alert);
      return updatedAlert;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create alert');
    }
  }

  private async dispatchAlert(alert: any) {
    const sentVia: string[] = [];
    
    try {
      const user = await this.prisma.user.findUnique({
        where: { address: alert.userId },
      });

      if (!user) {
        logger.warn({ userId: alert.userId }, 'User not found for alert dispatch');
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'FAILED' }
        });
        return alert;
      }

      // Rate limiting: Avoid spamming users with same alert type (unless CRITICAL)
      if (alert.level !== AlertLevel.CRITICAL) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentAlert = await this.prisma.alert.findFirst({
          where: {
            userId: alert.userId,
            type: alert.type,
            status: 'SENT',
            sentAt: { gt: oneHourAgo },
            id: { not: alert.id }, 
          },
          orderBy: { sentAt: 'desc' },
        });

        if (recentAlert) {
          logger.info({ userId: alert.userId, type: alert.type }, 'Rate limited alert dispatch');
          await this.prisma.alert.update({
            where: { id: alert.id },
            data: { status: 'SENT', message: alert.message + ' (Rate limited)' }
          });
          return alert;
        }
      }

      const promises: Promise<void>[] = [];

      // Email
      if (user.email && user.emailVerified) {
         if (user.emailAllAlerts || alert.level === AlertLevel.CRITICAL || alert.level === AlertLevel.WARNING) {
             promises.push(
               this.emailService.sendEmail(user.email, `[${alert.level}] RedChips Alert`, alert.message)
                 .then(() => { sentVia.push('email'); })
             );
         }
      }

      // SMS
      if (user.sms && user.smsVerified) {
          if (alert.level === AlertLevel.CRITICAL) {
             promises.push(
                this.smsService.sendSms(user.sms, `RedChips: ${alert.message}`)
                  .then(() => { sentVia.push('sms'); })
             );
          }
      }

      // Push
      if (user.pushToken && user.pushEnabled) {
          promises.push(
            this.pushService.sendPush(user.pushToken, 'RedChips Alert', alert.message)
              .then(() => { sentVia.push('push'); })
          );
      }

      const results = await Promise.allSettled(promises);
      const someSucceeded = results.some(r => r.status === 'fulfilled');
      const allFailed = results.length > 0 && results.every(r => r.status === 'rejected');

      // Update alert with sentVia and status
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { 
          sentVia,
          status: allFailed ? 'FAILED' : (someSucceeded || results.length === 0 ? 'SENT' : 'FAILED'),
          retryCount: allFailed ? { increment: 1 } : undefined
        },
      });

    } catch (error) {
      logger.error({ err: error, alertId: alert.id }, 'Error during alert dispatch');
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'FAILED', retryCount: { increment: 1 } }
      });
    }

    return alert;
  }
}
