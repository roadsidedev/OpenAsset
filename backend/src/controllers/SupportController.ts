/**
 * @file SupportController.ts
 * @description Contact / support form endpoint. Forwards user-submitted
 * feedback and support requests to the team support inbox
 * (support@openasset.markets, overridable via SUPPORT_EMAIL).
 */

import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/notifications/EmailService';
import { logger } from '../utils/logger';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@openasset.markets';

const CATEGORIES = new Set(['support', 'feedback', 'bug', 'other']);
const MAX_MESSAGE_LENGTH = 5000;
const MAX_NAME_LENGTH = 100;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class SupportController {
  private emailService = new EmailService();

  /**
   * POST /support
   * Body: { email, message, category?, name?, chainId?, page? }
   * Forwards the request to the support inbox. Returns
   * { success, data: { delivered } } — delivered=false means the email
   * transport is not configured (frontend falls back to a mailto link).
   */
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, message, category, name, chainId, page } = (req.body || {}) as Record<string, unknown>;

      const from = typeof email === 'string' ? email.trim() : '';
      const body = typeof message === 'string' ? message.trim() : '';
      const cat = typeof category === 'string' ? category.toLowerCase().trim() : 'support';
      const who = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
      const originPage = typeof page === 'string' ? page.trim().slice(0, 200) : '';

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
        res.status(400).json({ success: false, error: 'A valid email address is required.' });
        return;
      }
      if (!body || body.length < 5) {
        res.status(400).json({ success: false, error: 'Message is too short.' });
        return;
      }
      if (body.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({ success: false, error: 'Message is too long.' });
        return;
      }

      const safeCat = CATEGORIES.has(cat) ? cat : 'other';
      const subject = `[${safeCat.toUpperCase()}] OpenAsset contact form — ${from}`;
      const text = [
        `Category: ${safeCat}`,
        `From: ${who || '(no name)'} <${from}>`,
        originPage ? `Page: ${originPage}` : '',
        chainId !== undefined && chainId !== null ? `Chain: ${chainId}` : '',
        '',
        body,
      ]
        .filter(Boolean)
        .join('\n');
      const html = `<pre style="font:13px/1.6 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

      const delivered = await this.emailService.sendEmail(SUPPORT_EMAIL, subject, text, html);
      if (!delivered) {
        logger.warn({ category: safeCat }, 'Support email not delivered — transport unconfigured');
      }

      res.json({ success: true, data: { delivered } });
    } catch (error) {
      logger.error({ err: error }, 'Error submitting support request');
      next(error);
    }
  }
}
