import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request with the authenticated user's id/email
export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn(
    '⚠️  JWT_SECRET is not set. Using an insecure development default. ' +
    'Set JWT_SECRET in your environment before deploying to production.'
  );
}

export interface AppTokenPayload {
  userId: string;
  email: string;
}

/**
 * Sign an application session token for a user.
 */
export function signAppToken(payload: AppTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Verify an application session token. Throws if invalid/expired.
 */
export function verifyAppToken(token: string): AppTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AppTokenPayload;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
}

/**
 * Require a valid app token. Responds 401 if missing/invalid.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyAppToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Attach the user if a valid token is present, but don't reject if it's absent.
 */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = verifyAppToken(token);
      req.userId = payload.userId;
      req.userEmail = payload.email;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
