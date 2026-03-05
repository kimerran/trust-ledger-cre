import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { auditEvents } from '../../db/schema';
import { tenantGuard } from '../middleware/tenantGuard';

const router = Router();
const log = pino({ name: 'events-route' });

// Track connected SSE clients per tenant
const clients = new Map<string, Set<NodeJS.Timeout>>();

/**
 * Broadcasts an event to all SSE clients for a given tenant.
 * Called from other routes after state-changing operations.
 */
export function broadcastEvent(
  tenantId: string,
  eventType: string,
  data: Record<string, unknown>,
): void {
  // This is a simple in-process broadcast. In production, use Redis pub/sub.
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  sseClients.get(tenantId)?.forEach((writer) => {
    writer(payload);
  });
}

// Map of tenant → Set of write functions
const sseClients = new Map<string, Set<(data: string) => void>>();

// ─── GET /events (SSE) ────────────────────────────────────────────────────────

router.get('/', tenantGuard, async (req, res) => {
  const tenantId = req.tenantId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send last 20 events on connect
  try {
    const recent = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(20);

    for (const event of recent.reverse()) {
      res.write(
        `data: ${JSON.stringify({
          type: event.eventType,
          data: event.payload ?? {},
          timestamp: event.createdAt,
        })}\n\n`,
      );
    }
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to send initial events');
  }

  // Register client writer
  const write = (payload: string) => {
    res.write(`data: ${payload}\n\n`);
  };

  if (!sseClients.has(tenantId)) {
    sseClients.set(tenantId, new Set());
  }
  sseClients.get(tenantId)!.add(write);

  // Keepalive heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(tenantId)?.delete(write);
    log.debug({ tenantId }, 'SSE client disconnected');
  });
});

export default router;
