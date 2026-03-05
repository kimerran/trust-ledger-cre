import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const log = pino({ name: 'auth-guard' });

/**
 * Guards internal endpoints (e.g. /webhooks/cre) that should only be
 * called by other services using the INTERNAL_API_KEY.
 */
export function internalAuthGuard(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] ?? req.headers['x-internal-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    log.error('INTERNAL_API_KEY is not configured');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' },
    });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    log.warn({ ip: req.ip }, 'Unauthorized internal API key attempt');
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
    return;
  }

  next();
}
