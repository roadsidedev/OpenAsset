import { PrismaClient, AlertType, AlertLevel } from '@prisma/client';
import { logger } from '../../app';

export class AlertService {
  constructor(private prisma: PrismaClient) {}

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
          loanId,
          sentVia: [], // Populate based on user prefs
        },
      });

      // Dispatch to external providers (Email, SMS, Push)
      await this.dispatchAlert(alert);

      return alert;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create alert');
      throw error;
    }
  }

  private async dispatchAlert(alert: any) {
    // Logic to check user preferences and send via configured channels
    logger.info({ alertId: alert.id, type: alert.type }, 'Dispatching alert');
    
    // Mock sending
    // if (user.emailEnabled) sendEmail(...);
  }
}
