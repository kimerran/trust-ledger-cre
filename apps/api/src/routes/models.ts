import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { aiModels } from '../../db/schema';
import { tenantGuard } from '../middleware/tenantGuard';

const router = Router();
const log = pino({ name: 'models-route' });

const createModelSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  modelType: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── GET /models ──────────────────────────────────────────────────────────────

router.get('/', tenantGuard, async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const models = await db
      .select()
      .from(aiModels)
      .where(and(eq(aiModels.tenantId, tenantId), eq(aiModels.isActive, true)));

    res.json({ success: true, data: models });
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to list models');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch models' },
    });
  }
});

// ─── POST /models ─────────────────────────────────────────────────────────────

router.post('/', tenantGuard, async (req, res) => {
  const parsed = createModelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
    });
    return;
  }

  const { name, version, modelType, description, metadata } = parsed.data;
  const tenantId = req.tenantId;

  try {
    const [model] = await db
      .insert(aiModels)
      .values({
        tenantId,
        name,
        version,
        modelType,
        description: description ?? null,
        metadata: metadata ?? null,
      })
      .returning();

    log.info({ modelId: model.id, tenantId }, 'Model registered');
    res.status(201).json({ success: true, data: model });
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to create model');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create model' },
    });
  }
});

export default router;
