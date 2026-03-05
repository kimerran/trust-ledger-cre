#!/usr/bin/env tsx
/**
 * seed-demo.ts — Populates the database with realistic demo data.
 * Run with: pnpm --filter api db:seed
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ulid } from 'ulid';
import * as schema from '../apps/api/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { tenants, aiModels, decisions, workflowRuns, auditEvents } = schema;

// ─── Demo data ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_MODELS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'LoanGuard-v2',
    version: '2.1.4',
    modelType: 'loan_approval',
    description: 'XGBoost ensemble for consumer loan approval decisions',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'ClaimBot-v1',
    version: '1.3.0',
    modelType: 'insurance_claim',
    description: 'Random forest for insurance claim fraud detection',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'MedRisk-Alpha',
    version: '0.9.2',
    modelType: 'medical_diagnosis',
    description: 'Neural network for diagnostic risk stratification',
  },
];

type DecisionStatus = 'PENDING' | 'SIGNED' | 'ANCHORED' | 'VERIFIED' | 'FAILED';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

const DEMO_DECISIONS: Array<{
  type: string;
  outcome: string;
  confidence: number;
  riskLevel: RiskLevel;
  status: DecisionStatus;
  modelId: string;
  topFeatures: Array<{ name: string; value: unknown; contribution: number }>;
}> = [
  {
    type: 'loan_approval',
    outcome: 'APPROVED',
    confidence: 0.91,
    riskLevel: 'LOW',
    status: 'VERIFIED',
    modelId: '00000000-0000-0000-0000-000000000001',
    topFeatures: [
      { name: 'credit_score', value: 780, contribution: 0.32 },
      { name: 'debt_to_income', value: 0.22, contribution: 0.28 },
      { name: 'employment_years', value: 8, contribution: 0.15 },
    ],
  },
  {
    type: 'loan_approval',
    outcome: 'DENIED',
    confidence: 0.61,
    riskLevel: 'HIGH',
    status: 'ANCHORED',
    modelId: '00000000-0000-0000-0000-000000000001',
    topFeatures: [
      { name: 'debt_to_income', value: 0.54, contribution: -0.19 },
      { name: 'credit_score', value: 580, contribution: -0.15 },
      { name: 'employment_months', value: 8, contribution: -0.08 },
    ],
  },
  {
    type: 'insurance_claim',
    outcome: 'FLAGGED_FRAUD',
    confidence: 0.78,
    riskLevel: 'HIGH',
    status: 'SIGNED',
    modelId: '00000000-0000-0000-0000-000000000002',
    topFeatures: [
      { name: 'claim_amount_zscore', value: 3.2, contribution: -0.24 },
      { name: 'prior_claims_count', value: 4, contribution: -0.18 },
      { name: 'incident_hour', value: 2, contribution: -0.09 },
    ],
  },
  {
    type: 'loan_approval',
    outcome: 'APPROVED',
    confidence: 0.85,
    riskLevel: 'MEDIUM',
    status: 'VERIFIED',
    modelId: '00000000-0000-0000-0000-000000000001',
    topFeatures: [
      { name: 'credit_score', value: 710, contribution: 0.22 },
      { name: 'debt_to_income', value: 0.38, contribution: -0.04 },
      { name: 'collateral_ratio', value: 1.4, contribution: 0.18 },
    ],
  },
  {
    type: 'medical_diagnosis',
    outcome: 'HIGH_RISK',
    confidence: 0.73,
    riskLevel: 'HIGH',
    status: 'ANCHORED',
    modelId: '00000000-0000-0000-0000-000000000003',
    topFeatures: [
      { name: 'age', value: 67, contribution: 0.12 },
      { name: 'bmi', value: 31.4, contribution: 0.09 },
      { name: 'blood_pressure_systolic', value: 148, contribution: 0.11 },
    ],
  },
  {
    type: 'loan_approval',
    outcome: 'DENIED',
    confidence: 0.55,
    riskLevel: 'MEDIUM',
    status: 'FAILED',
    modelId: '00000000-0000-0000-0000-000000000001',
    topFeatures: [
      { name: 'income', value: 28000, contribution: -0.12 },
      { name: 'requested_amount', value: 45000, contribution: -0.22 },
    ],
  },
];

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedTenant() {
  console.log('→ Seeding tenant...');
  await db
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: 'Demo Financial Corp',
      slug: 'demo-financial',
    })
    .onConflictDoNothing();
}

async function seedModels() {
  console.log('→ Seeding AI models...');
  for (const model of DEMO_MODELS) {
    await db
      .insert(aiModels)
      .values({
        ...model,
        tenantId: TENANT_ID,
      })
      .onConflictDoNothing();
  }
}

async function seedDecisions() {
  console.log('→ Seeding decisions...');

  for (const d of DEMO_DECISIONS) {
    const decisionId = ulid();
    const inputHash = `sha256:${Buffer.from(JSON.stringify(d.topFeatures)).toString('hex').slice(0, 64)}`;
    const txHash =
      d.status === 'ANCHORED' || d.status === 'VERIFIED'
        ? `0x${Buffer.from(decisionId).toString('hex').padEnd(64, '0').slice(0, 64)}`
        : null;

    await db.insert(decisions).values({
      id: decisionId,
      tenantId: TENANT_ID,
      modelId: d.modelId,
      decisionType: d.type,
      outcome: d.outcome,
      confidence: d.confidence.toFixed(4),
      topFeatures: d.topFeatures,
      inputHash,
      signature: d.status !== 'PENDING' ? 'base64:MEUCIQDdemo_signature_here==' : null,
      riskLevel: d.riskLevel,
      riskSummary: `Demo risk assessment: ${d.riskLevel} risk level detected for ${d.type} decision.`,
      txHash,
      blockNumber: txHash ? 4800000 + Math.floor(Math.random() * 30000) : null,
      status: d.status,
      errorMessage: d.status === 'FAILED' ? 'KMS signing timeout during demo seed' : null,
    });

    await db.insert(auditEvents).values({
      tenantId: TENANT_ID,
      decisionId,
      eventType: 'DECISION_SUBMITTED',
      payload: { decisionId, inputHash },
    });

    if (d.status !== 'PENDING') {
      await db.insert(auditEvents).values({
        tenantId: TENANT_ID,
        decisionId,
        eventType: 'DECISION_SIGNED',
        payload: { decisionId },
      });
    }

    if (txHash) {
      await db.insert(auditEvents).values({
        tenantId: TENANT_ID,
        decisionId,
        eventType: 'DECISION_ANCHORED',
        payload: { decisionId, txHash },
      });

      // Seed a workflow run
      const runId = ulid();
      await db.insert(workflowRuns).values({
        id: runId,
        tenantId: TENANT_ID,
        decisionId,
        workflowName: 'trustledger-risk-monitor',
        status: 'SUCCESS',
        input: { decisionId },
        output: { txHash, riskLevel: d.riskLevel },
        durationMs: 2000 + Math.floor(Math.random() * 3000),
        completedAt: new Date(),
      });
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('TrustLedger Demo Seed\n');

  try {
    await seedTenant();
    await seedModels();
    await seedDecisions();

    console.log('\n✓ Demo data seeded successfully!');
    console.log('  Login: demo@trustledger.io / demo1234');
    console.log('  Dashboard: http://localhost:3000');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
