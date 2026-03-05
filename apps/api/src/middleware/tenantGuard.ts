import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const log = pino({ name: 'tenant-guard' });

interface JWTPayload {
  sub: string;
  tenantId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      userId: string;
    }
  }
}

export function tenantGuard(req: Request, res: Response, next: NextFunction): void {
  // Support both Authorization header and ?token= query param (needed for EventSource/SSE)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    log.error('NEXTAUTH_SECRET is not configured');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JWTPayload;

    if (!payload.tenantId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Token does not contain tenantId' },
      });
      return;
    }

    req.tenantId = payload.tenantId;
    req.userId = payload.sub;
    next();
  } catch (err) {
    log.warn({ err }, 'JWT verification failed');
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
