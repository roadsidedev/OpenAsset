import { PrismaClient, AlertType, AlertLevel } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';
import { EmailService } from './notifications/EmailService';
import { SmsService } from './notifications/SmsService';
import { PushService } from './notifications/PushService';

interface UserAlertPrefs {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  dedupWindowSec?: number;
}

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

      // Check deduplication
      const shouldDedup = await this.checkDeduplication(alert, user);
      if (shouldDedup) {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'SENT', message: alert.message + ' (Deduplicated)' }
        });
        return alert;
      }

      const promises: Promise<void>[] = [];

      // Email
      if (user.email && user.emailVerified) {
        if (user.emailAllAlerts || alert.level === AlertLevel.CRITICAL || alert.level === AlertLevel.WARNING) {
          promises.push(
            this.emailService.sendEmail(user.email, `[${alert.level}] OpenAsset Market Alert`, alert.message)
              .then(() => { sentVia.push('email'); })
          );
        }
      }

      // SMS
      if (user.sms && user.smsVerified) {
        if (alert.level === AlertLevel.CRITICAL) {
          promises.push(
            this.smsService.sendSms(user.sms, `OpenAsset Market: ${alert.message}`)
              .then(() => { sentVia.push('sms'); })
          );
        }
      }

      // Push
      if (user.pushToken && user.pushEnabled) {
        promises.push(
          this.pushService.sendPush(user.pushToken, 'OpenAsset Market Alert', alert.message)
            .then(() => { sentVia.push('push'); })
        );
      }

      const results = await Promise.allSettled(promises);
      const someSucceeded = results.some(r => r.status === 'fulfilled');
      const allFailed = results.length > 0 && results.every(r => r.status === 'rejected');

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

  private async checkDeduplication(alert: any, user: any): Promise<boolean> {
    // Never deduplicate CRITICAL alerts
    if (alert.level === AlertLevel.CRITICAL) return false;

    // Get dedup window for this alert type (from config or user prefs)
    const typeWindow = config.alerts.dedup.windows[alert.type];
    const defaultWindow = config.alerts.dedup.defaultWindowSec;
    const windowSec = typeWindow ?? user.dedupWindowSec ?? defaultWindow;
    const windowMs = windowSec * 1000;

    const windowStart = new Date(Date.now() - windowMs);

    const recentAlert = await this.prisma.alert.findFirst({
      where: {
        userId: alert.userId,
        type: alert.type,
        status: 'SENT',
        sentAt: { gt: windowStart },
        id: { not: alert.id },
      },
      orderBy: { sentAt: 'desc' },
    });

    if (recentAlert) {
      logger.info({ 
        userId: alert.userId, 
        type: alert.type, 
        windowSec,
        recentAlertId: recentAlert.id 
      }, 'Alert deduplicated');
      return true;
    }

    return false;
  }

  // Get user's effective alert preferences (can be extended with user preferences table)
  private getUserAlertPrefs(user: any): UserAlertPrefs {
    return {
      email: user.email && user.emailVerified && (user.emailAllAlerts || true),
      sms: user.sms && user.smsVerified,
      push: user.pushToken && user.pushEnabled,
      dedupWindowSec: undefined, // Could be stored in user preferences
    };
  }
}