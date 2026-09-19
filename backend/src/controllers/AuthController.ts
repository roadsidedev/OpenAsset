import { Request, Response } from "express";
import { verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/unifiedConfig";
import { logger } from "../utils/logger";
import { AuthRequest } from "../middleware/auth";
import { revokeToken, isTokenRevoked } from "../utils/tokenDenylist";

const prisma = new PrismaClient();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getNonce = async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;
    if (!address) {
      res.status(400).json({ error: "Address required" });
      return;
    }

    const normalized = address.toLowerCase();
    const nonce = uuidv4();
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS);

    // Rotate nonce on every fetch so prior challenges are invalidated
    const user = await prisma.user.upsert({
      where: { address: normalized },
      update: { nonce, nonceExpiresAt },
      create: { address: normalized, nonce, nonceExpiresAt },
    });

    res.json({ nonce: user.nonce, expiresAt: user.nonceExpiresAt });
  } catch (error) {
    logger.error({ err: error }, "Error fetching nonce");
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
   try {
     const address = req.body.address as string;
     const { signature } = req.body;

     if (!address || !signature) {
       res.status(400).json({ error: "Address and signature required" });
       return;
     }

     const normalized = address.toLowerCase();
     const user = await prisma.user.findUnique({
       where: { address: normalized },
     });

     if (!user) {
       res.status(401).json({ error: "User not found. Fetch nonce first." });
       return;
     }

     if (!user.nonceExpiresAt || user.nonceExpiresAt.getTime() <= Date.now()) {
       res.status(401).json({ error: "Nonce expired. Fetch a new nonce." });
       return;
     }

     const expectedNonce = user.nonce;
     const message = `Login to OpenAsset Market: ${expectedNonce}`;
     const recoveredAddress = verifyMessage(message, signature);

     if (recoveredAddress.toLowerCase() !== normalized) {
       res.status(401).json({ error: "Invalid signature" });
       return;
     }

     // Atomic consume: only succeed if nonce still matches (prevents replay races)
     const rotatedNonce = uuidv4();
     const consumed = await prisma.user.updateMany({
       where: {
         address: normalized,
         nonce: expectedNonce,
         nonceExpiresAt: { gt: new Date() },
       },
       data: {
         nonce: rotatedNonce,
         nonceExpiresAt: null,
       },
     });

     if (consumed.count === 0) {
       res.status(401).json({ error: "Nonce already used or expired. Fetch a new nonce." });
       return;
     }

     const jti = uuidv4();
     const token = jwt.sign(
       { address: normalized, jti },
       config.jwtSecret,
       { expiresIn: "24h" }
     );

     res.json({
       token,
       user: {
         address: normalized,
         email: user.email,
         emailVerified: user.emailVerified,
       },
     });
   } catch (error) {
     logger.error({ err: error }, "Login error");
     res.status(500).json({ error: "Internal server error" });
   }
};

/**
 * Verify current JWT token is valid
 * Used by frontend on mount to restore auth state
 */
export const verifyToken = async (req: Request, res: Response) => {
   try {
     const authHeader = req.headers.authorization;

     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ error: "Missing or invalid authorization header" });
       return;
     }

     const token = authHeader.split(' ')[1];
     const decoded = jwt.verify(token, config.jwtSecret) as {
       address: string;
       jti?: string;
     };

     if (isTokenRevoked(decoded.jti)) {
       res.status(401).json({ error: "Token revoked" });
       return;
     }

     const user = await prisma.user.findUnique({
       where: { address: decoded.address.toLowerCase() },
     });

     if (!user) {
       res.status(401).json({ error: "User not found" });
       return;
     }

     res.json({
       token,
       user: {
         address: user.address,
         email: user.email,
         emailVerified: user.emailVerified,
       },
     });
   } catch (error) {
     logger.error({ err: error }, "Token verification error");
     res.status(401).json({ error: "Invalid or expired token" });
   }
};

/**
 * Blacklist the current JWT (jti) so it cannot be reused until expiry.
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as {
      address: string;
      jti?: string;
      exp?: number;
    };

    if (decoded.jti && decoded.exp) {
      revokeToken(decoded.jti, decoded.exp);
    } else if (decoded.jti) {
      // Fallback: revoke for 24h if exp missing
      revokeToken(decoded.jti, Math.floor(Date.now() / 1000) + 24 * 60 * 60);
    }

    logger.info(
      { address: authReq.user?.address || decoded.address, jti: decoded.jti },
      "User logged out; JWT revoked"
    );

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
