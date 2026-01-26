import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { EmailService } from '../services/notifications/EmailService';
import { SmsService } from '../services/notifications/SmsService';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const emailService = new EmailService();
const smsService = new SmsService();

// Validation schemas
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  sms: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(), // Basic E.164 check
  pushEnabled: z.boolean().optional(),
  pushToken: z.string().optional(),
  emailAllAlerts: z.boolean().optional(),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6),
});

export const getUser = async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    const user = await prisma.user.findUnique({
      where: { address },
    });

    if (!user) {
       // If user doesn't exist, create them (auto-onboarding) or return 404.
       // Given the context, we might want to auto-create or just return null profile.
       // Let's create if missing for simpler UX.
       const newUser = await prisma.user.create({
         data: { address },
       });
       res.json(newUser);
       return;
    }

    res.json(user);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching user');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const address = req.params.address as string;

    if (!authReq.user || authReq.user.address.toLowerCase() !== address.toLowerCase()) {
      res.status(403).json({ error: 'Unauthorized: Cannot update another user profile' });
      return;
    }

    const data = updateProfileSchema.parse(req.body);

    // If email/sms changes, we reset verification
    const existingUser = await prisma.user.findUnique({ where: { address } });
    
    const updateData: any = { ...data };
    if (data.email && existingUser?.email !== data.email) {
      updateData.emailVerified = false;
    }
    if (data.sms && existingUser?.sms !== data.sms) {
      updateData.smsVerified = false;
    }

    const user = await prisma.user.upsert({
      where: { address },
      update: updateData,
      create: { address, ...updateData },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      logger.error({ err: error }, 'Error updating user');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const requestEmailVerification = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const address = req.params.address as string;

    if (!authReq.user || authReq.user.address.toLowerCase() !== address.toLowerCase()) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { address } });

    if (!user || !user.email) {
      res.status(400).json({ error: 'No email configured' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.verificationCode.create({
      data: {
        address,
        code,
        type: 'EMAIL',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      },
    });

    await emailService.sendEmail(
      user.email,
      'RedChips Verification Code',
      `Your verification code is: ${code}`
    );

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error({ err: error }, 'Error requesting email verification');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmEmailVerification = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const address = req.params.address as string;
    
    if (!authReq.user || authReq.user.address.toLowerCase() !== address.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }

    const { code } = verifyCodeSchema.parse(req.body);

    const validCode = await prisma.verificationCode.findFirst({
      where: {
        address,
        code,
        type: 'EMAIL',
        expiresAt: { gt: new Date() },
      },
    });

    if (!validCode) {
      res.status(400).json({ error: 'Invalid or expired code' });
      return;
    }

    await prisma.user.update({
      where: { address },
      data: { emailVerified: true },
    });

    // Cleanup codes
    await prisma.verificationCode.deleteMany({
      where: { address, type: 'EMAIL' },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error confirming email verification');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestSmsVerification = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const address = req.params.address as string;

    if (!authReq.user || authReq.user.address.toLowerCase() !== address.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { address } });

    if (!user || !user.sms) {
      res.status(400).json({ error: 'No SMS number configured' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.verificationCode.create({
      data: {
        address,
        code,
        type: 'SMS',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
      },
    });

    await smsService.sendSms(
        user.sms,
        `Your RedChips verification code is: ${code}`
    );

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error({ err: error }, 'Error requesting SMS verification');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmSmsVerification = async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const address = req.params.address as string;

      if (!authReq.user || authReq.user.address.toLowerCase() !== address.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const { code } = verifyCodeSchema.parse(req.body);
  
      const validCode = await prisma.verificationCode.findFirst({
        where: {
          address,
          code,
          type: 'SMS',
          expiresAt: { gt: new Date() },
        },
      });
  
      if (!validCode) {
        res.status(400).json({ error: 'Invalid or expired code' });
        return;
      }
  
      await prisma.user.update({
        where: { address },
        data: { smsVerified: true },
      });
  
      // Cleanup codes
      await prisma.verificationCode.deleteMany({
        where: { address, type: 'SMS' },
      });
  
      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, 'Error confirming SMS verification');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
