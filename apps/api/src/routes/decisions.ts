import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { eq, and, desc } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../../db/index';
import { decisions, auditEvents, workflowRuns } from '../../db/schema';
import { tenantGuard } from '../middleware/tenantGuard';
import { hashDecision } from '@trustledger/shared';
import { signWithKMS } from '../services/kmsService';
import { verifyDecision } from '../services/verificationService';
import { triggerRiskMonitorWorkflow } from '../services/creService';

const router = Router();
const log = pino({ name: 'decisions-route' });

// ─── Validation schemas ───────────────────────────────────────────────────────

const topFeatureSchema = z.object({
  name: z.string(),
  value: z.unknown(),
  contribution: z.number(),
});

const submitDecisionSchema = z.object({
  modelId: z.string().uuid(),
  decisionType: z.string().min(1),
  outcome: z.string().min(1),
  confidence: z.number().min(0).max(1),
  topFeatures: z.array(topFeatureSchema),
  metadata: z.record(z.unknown()).optional(),
});

// ─── POST /decisions ──────────────────────────────────────────────────────────

router.post('/', tenantGuard, async (req, res) => {
  const parsed = submitDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
    });
    return;
  }

  const { modelId, decisionType, outcome, confidence, topFeatures, metadata } = parsed.data;
  const tenantId = req.tenantId;
  const decisionId = ulid();

  const payload: Record<string, unknown> = {
    confidence,
    decisionType,
    modelId,
    outcome,
    topFeatures,
  };

  const inputHash = hashDecision(payload);

  try {
    // 1. Persist in PENDING state
    await db.insert(decisions).values({
      id: decisionId,
      tenantId,
      modelId,
      decisionType,
      outcome,
      confidence: confidence.toFixed(4),
      topFeatures,
      inputHash,
      status: 'PENDING',
      metadata: metadata ?? null,
    });

    await db.insert(auditEvents).values({
      tenantId,
      decisionId,
      eventType: 'DECISION_SUBMITTED',
      payload: { decisionId, inputHash },
    });

    // 2. Sign with KMS (or local dev key)
    let signature: string;
    try {
      signature = await signWithKMS(inputHash);
      await db
        .update(decisions)
        .set({ signature, status: 'SIGNED', updatedAt: new Date() })
        .where(and(eq(decisions.id, decisionId), eq(decisions.tenantId, tenantId)));

      await db.insert(auditEvents).values({
        tenantId,
        decisionId,
        eventType: 'DECISION_SIGNED',
        payload: { decisionId },
      });
    } catch (err) {
      log.error({ err, decisionId }, 'KMS signing failed');
      await db
        .update(decisions)
        .set({ status: 'FAILED', errorMessage: 'KMS signing failed', updatedAt: new Date() })
        .where(and(eq(decisions.id, decisionId), eq(decisions.tenantId, tenantId)));

      await db.insert(auditEvents).values({
        tenantId,
        decisionId,
        eventType: 'DECISION_FAILED',
        payload: { decisionId, reason: 'KMS signing failed' },
      });

      res.status(500).json({
        success: false,
        error: { code: 'SIGNING_FAILED', message: 'Failed to sign decision' },
      });
      return;
    }

    // 3. Create workflow run record
    const workflowRunId = ulid();
    await db.insert(workflowRuns).values({
      id: workflowRunId,
      tenantId,
      decisionId,
      workflowName: 'trustledger-risk-monitor',
      status: 'RUNNING',
      input: payload,
    });

    // 4. Trigger CRE workflow (async — don't await response)
    const apiBase = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    triggerRiskMonitorWorkflow({
      decisionId,
      decision: { type: decisionType, outcome, confidence, topFeatures },
      inputHash,
      callbackUrl: `${apiBase}/webhooks/cre`,
    }).catch((err) => {
      log.error({ err, decisionId }, 'CRE trigger failed');
    });

    log.info({ decisionId, tenantId, status: 'SIGNED' }, 'Decision submitted and signed');

    const [decision] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, decisionId), eq(decisions.tenantId, tenantId)))
      .limit(1);

    res.status(201).json({ success: true, data: decision });
  } catch (err) {
    log.error({ err, decisionId }, 'Failed to submit decision');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create decision' },
    });
  }
});

// ─── GET /decisions ───────────────────────────────────────────────────────────

router.get('/', tenantGuard, async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const rows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.tenantId, tenantId))
      .orderBy(desc(decisions.createdAt))
      .limit(100);

    res.json({ success: true, data: rows });
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to list decisions');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch decisions' },
    });
  }
});

// ─── GET /decisions/:id ───────────────────────────────────────────────────────

router.get('/:id', tenantGuard, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  try {
    const [decision] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.tenantId, tenantId)))
      .limit(1);

    if (!decision) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Decision not found' },
      });
      return;
    }

    res.json({ success: true, data: decision });
  } catch (err) {
    log.error({ err, id, tenantId }, 'Failed to get decision');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch decision' },
    });
  }
});

// ─── GET /decisions/:id/verify ────────────────────────────────────────────────

router.get('/:id/verify', tenantGuard, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  try {
    const [decision] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.tenantId, tenantId)))
      .limit(1);

    if (!decision) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Decision not found' },
      });
      return;
    }

    const result = await verifyDecision(decision);

    // Update status to VERIFIED if all layers pass
    if (result.overall === 'PASS' && decision.status === 'ANCHORED') {
      await db
        .update(decisions)
        .set({ status: 'VERIFIED', updatedAt: new Date() })
        .where(and(eq(decisions.id, id), eq(decisions.tenantId, tenantId)));

      await db.insert(auditEvents).values({
        tenantId,
        decisionId: id,
        eventType: 'DECISION_VERIFIED',
        payload: { decisionId: id, overall: result.overall },
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    log.error({ err, id, tenantId }, 'Verification failed');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Verification failed' },
    });
  }
});

// ─── GET /decisions/:id/proof ─────────────────────────────────────────────────

router.get('/:id/proof', tenantGuard, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  try {
    const [decision] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.tenantId, tenantId)))
      .limit(1);

    if (!decision) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Decision not found' },
      });
      return;
    }

    const proof = {
      decisionId: decision.id,
      tenantId: decision.tenantId,
      inputHash: decision.inputHash,
      signature: decision.signature,
      riskLevel: decision.riskLevel,
      txHash: decision.txHash,
      blockNumber: decision.blockNumber,
      status: decision.status,
      createdAt: decision.createdAt,
      proofGeneratedAt: new Date().toISOString(),
    };

    res
      .setHeader('Content-Disposition', `attachment; filename="proof-${id}.json"`)
      .setHeader('Content-Type', 'application/json')
      .json({ success: true, data: proof });
  } catch (err) {
    log.error({ err, id, tenantId }, 'Failed to generate proof');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate proof' },
    });
  }
});

export default router;
