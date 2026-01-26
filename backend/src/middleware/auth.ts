import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/unifiedConfig';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    address: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
       return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { address: string };
      req.user = { address: decoded.address.toLowerCase() };
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};
