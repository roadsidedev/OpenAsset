import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/unifiedConfig';
import { logger } from '../utils/logger';
import { isTokenRevoked } from '../utils/tokenDenylist';

export interface JwtPayload {
  address: string;
  jti?: string;
  exp?: number;
  iat?: number;
}

export interface AuthRequest extends Request {
  user?: {
    address: string;
    jti?: string;
  };
  token?: string;
}

function extractBearer(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1] || null;
}

function decodeAndValidate(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  if (isTokenRevoked(decoded.jti)) {
    throw new Error('Token revoked');
  }
  return decoded;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractBearer(req);

    if (!token) {
      res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
      return;
    }

    try {
      const decoded = decodeAndValidate(token);
      req.user = { address: decoded.address.toLowerCase(), jti: decoded.jti };
      req.token = token;
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Attaches user if a valid Bearer token is present; otherwise continues anonymously.
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractBearer(req);
    if (!token) {
      next();
      return;
    }
    try {
      const decoded = decodeAndValidate(token);
      req.user = { address: decoded.address.toLowerCase(), jti: decoded.jti };
      req.token = token;
    } catch {
      // Ignore invalid tokens for optional auth — treat as anonymous
    }
    next();
  } catch (error) {
    logger.error({ err: error }, 'Optional auth middleware error');
    next();
  }
};
