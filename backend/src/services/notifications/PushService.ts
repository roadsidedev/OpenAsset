import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/unifiedConfig';
import { logger } from '../../utils/logger';

export class PushService {
  private initialized = false;

  constructor() {
    const keyOrPath = config.alerts.firebase.serviceAccountKey;
    if (keyOrPath) {
      try {
        if (!admin.apps.length) {
          let serviceAccount;
          if (keyOrPath.trim().startsWith('{')) {
             serviceAccount = JSON.parse(keyOrPath);
          } else {
             const keyPath = path.resolve(keyOrPath);
             if (fs.existsSync(keyPath)) {
                serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
             } else {
                logger.warn(`Firebase service account file not found at ${keyPath}`);
                return;
             }
          }
          
          if (serviceAccount) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
            this.initialized = true;
          }
        } else {
          this.initialized = true;
        }
      } catch (err) {
        logger.error({ err }, 'Failed to initialize Firebase Admin');
      }
    } else {
      logger.warn('Firebase not configured');
    }
  }

  async sendPush(token: string, title: string, body: string) {
    if (!this.initialized) {
      logger.warn('Push service not configured, skipping push');
      return;
    }

    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
      });
      logger.info({ token }, 'Push notification sent successfully');
    } catch (error) {
      logger.error({ err: error, token }, 'Failed to send push notification');
    }
  }
}
