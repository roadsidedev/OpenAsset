import { Request, Response } from 'express';
import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/unifiedConfig';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const getNonce = async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    if (!address) {
      res.status(400).json({ error: 'Address required' });
      return;
    }

    const user = await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {},
      create: { address: address.toLowerCase(), nonce: uuidv4() },
    });

    res.json({ nonce: user.nonce });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching nonce');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const address = req.body.address as string;
    const { signature } = req.body;

    if (!address || !signature) {
      res.status(400).json({ error: 'Address and signature required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found. Fetch nonce first.' });
      return;
    }

    const message = `Login to RedChips: ${user.nonce}`;
    const recoveredAddress = verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Rotate nonce
    await prisma.user.update({
      where: { address: user.address },
      data: { nonce: uuidv4() },
    });

    // Generate JWT
    const token = jwt.sign({ address: user.address }, config.jwtSecret, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        address: user.address,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
