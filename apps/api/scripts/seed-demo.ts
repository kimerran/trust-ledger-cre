import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ulid } from 'ulid';
import * as schema from '../db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const MODEL_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('TrustLedger Demo Seed\n');

  // Tenant
  console.log('→ Seeding tenant...');
  await db
    .insert(schema.tenants)
    .values({
      id: TENANT_ID,
      name: 'TrustLedger Demo',
      slug: 'demo',
      isActive: true,
    })
    .onConflictDoNothing();

  // AI Models
  console.log('→ Seeding AI models...');
  await db
    .insert(schema.aiModels)
    .values([
      {
        id: MODEL_IDS[0],
        tenantId: TENANT_ID,
        name: 'LoanGuard v2',
        version: '2.1.0',
        modelType: 'loan_approval',
        description: 'Credit risk scoring for consumer loan applications.',
        metadata: { framework: 'xgboost', trainedOn: '2025-Q4' },
        isActive: true,
      },
      {
        id: MODEL_IDS[1],
        tenantId: TENANT_ID,
        name: 'FraudShield',
        version: '1.4.2',
        modelType: 'fraud_detection',
        description: 'Real-time transaction fraud detection.',
        metadata: { framework: 'pytorch', trainedOn: '2025-Q3' },
        isActive: true,
      },
      {
        id: MODEL_IDS[2],
        tenantId: TENANT_ID,
        name: 'InsureIQ',
        version: '3.0.1',
        modelType: 'insurance_underwriting',
        description: 'Automated underwriting for home and auto policies.',
        metadata: { framework: 'sklearn', trainedOn: '2025-Q2' },
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // Decisions — one of each status
  console.log('→ Seeding decisions...');

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  const decisions: (typeof schema.decisions.$inferInsert)[] = [
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[0],
      decisionType: 'loan_approval',
      outcome: 'APPROVED',
      confidence: '0.9200',
      topFeatures: [
        { name: 'credit_score', value: 780, contribution: 0.35 },
        { name: 'debt_to_income', value: 0.22, contribution: 0.18 },
      ],
      inputHash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      status: 'PENDING',
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[0],
      decisionType: 'loan_approval',
      outcome: 'DENIED',
      confidence: '0.6100',
      topFeatures: [
        { name: 'debt_to_income', value: 0.54, contribution: -0.19 },
        { name: 'credit_score', value: 580, contribution: -0.15 },
      ],
      inputHash: 'sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
      signature: 'MEQCIBxLocalDevSignatureForDeniedLoan==',
      status: 'SIGNED',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[1],
      decisionType: 'fraud_detection',
      outcome: 'FLAGGED',
      confidence: '0.8800',
      topFeatures: [
        { name: 'velocity_score', value: 0.91, contribution: 0.42 },
        { name: 'geo_mismatch', value: 1, contribution: 0.31 },
      ],
      inputHash: 'sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      signature: 'MEQCIBxLocalDevSignatureForFraudFlag==',
      riskLevel: 'HIGH',
      riskSummary: 'High velocity and geographic mismatch detected.',
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: 4829100,
      status: 'ANCHORED',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[2],
      decisionType: 'insurance_underwriting',
      outcome: 'APPROVED',
      confidence: '0.7500',
      topFeatures: [
        { name: 'property_age', value: 12, contribution: 0.21 },
        { name: 'claim_history', value: 0, contribution: 0.19 },
      ],
      inputHash: 'sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
      signature: 'MEQCIBxLocalDevSignatureForInsurance==',
      riskLevel: 'LOW',
      riskSummary: 'Low risk profile. Standard premium applies.',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      blockNumber: 4829050,
      status: 'VERIFIED',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[0],
      decisionType: 'loan_approval',
      outcome: 'APPROVED',
      confidence: '0.8300',
      topFeatures: [
        { name: 'credit_score', value: 720, contribution: 0.29 },
        { name: 'income_stability', value: 0.88, contribution: 0.22 },
      ],
      inputHash: 'sha256:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
      status: 'FAILED',
      errorMessage: 'KMS signing timeout after 30s.',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      id: ulid(),
      tenantId: TENANT_ID,
      modelId: MODEL_IDS[1],
      decisionType: 'fraud_detection',
      outcome: 'CLEAR',
      confidence: '0.9500',
      topFeatures: [
        { name: 'velocity_score', value: 0.12, contribution: 0.08 },
        { name: 'device_trust', value: 0.97, contribution: 0.27 },
      ],
      inputHash: 'sha256:f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
      signature: 'MEQCIBxLocalDevSignatureForClearTx==',
      riskLevel: 'LOW',
      riskSummary: 'Transaction appears legitimate. No anomalies detected.',
      txHash: '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
      blockNumber: 4828900,
      status: 'ANCHORED',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];

  await db.insert(schema.decisions).values(decisions).onConflictDoNothing();

  console.log('\n✓ Demo data seeded successfully!');
  console.log('  Login: demo@trustledger.io / demo1234');
  console.log('  Dashboard: http://localhost:3000');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  pool.end();
  process.exit(1);
});
