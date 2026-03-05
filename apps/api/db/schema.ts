import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  boolean,
  numeric,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const decisionStatusEnum = pgEnum('decision_status', [
  'PENDING',
  'SIGNED',
  'ANCHORED',
  'VERIFIED',
  'FAILED',
]);

export const riskLevelEnum = pgEnum('risk_level', ['LOW', 'MEDIUM', 'HIGH']);

export const workflowRunStatusEnum = pgEnum('workflow_run_status', [
  'RUNNING',
  'SUCCESS',
  'FAILED',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'DECISION_SUBMITTED',
  'DECISION_SIGNED',
  'DECISION_ANCHORED',
  'DECISION_VERIFIED',
  'DECISION_FAILED',
  'WORKFLOW_STARTED',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_FAILED',
]);

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── AI Models ────────────────────────────────────────────────────────────────

export const aiModels = pgTable(
  'ai_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    version: text('version').notNull(),
    modelType: text('model_type').notNull(),
    description: text('description'),
    metadata: jsonb('metadata'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('ai_models_tenant_idx').on(table.tenantId),
  }),
);

// ─── Decisions ────────────────────────────────────────────────────────────────

export const decisions = pgTable(
  'decisions',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id),
    decisionType: text('decision_type').notNull(),
    outcome: text('outcome').notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
    topFeatures: jsonb('top_features').notNull(),
    inputHash: text('input_hash').notNull(),
    signature: text('signature'),
    riskLevel: riskLevelEnum('risk_level'),
    riskSummary: text('risk_summary'),
    txHash: text('tx_hash'),
    blockNumber: integer('block_number'),
    status: decisionStatusEnum('status').notNull().default('PENDING'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('decisions_tenant_idx').on(table.tenantId),
    statusIdx: index('decisions_status_idx').on(table.status),
    createdAtIdx: index('decisions_created_at_idx').on(table.createdAt),
  }),
);

// ─── Workflow Runs ────────────────────────────────────────────────────────────

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    decisionId: text('decision_id').references(() => decisions.id),
    workflowName: text('workflow_name').notNull(),
    status: workflowRunStatusEnum('status').notNull().default('RUNNING'),
    input: jsonb('input'),
    output: jsonb('output'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('workflow_runs_tenant_idx').on(table.tenantId),
    decisionIdx: index('workflow_runs_decision_idx').on(table.decisionId),
  }),
);

// ─── Audit Events ─────────────────────────────────────────────────────────────

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    decisionId: text('decision_id').references(() => decisions.id),
    eventType: auditEventTypeEnum('event_type').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('audit_events_tenant_idx').on(table.tenantId),
    decisionIdx: index('audit_events_decision_idx').on(table.decisionId),
    createdAtIdx: index('audit_events_created_at_idx').on(table.createdAt),
  }),
);

// ─── Retention Policies ───────────────────────────────────────────────────────

export const retentionPolicies = pgTable(
  'retention_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    decisionType: text('decision_type'), // null = applies to all types
    retentionDays: integer('retention_days').notNull().default(2555), // 7 years default
    onchainPolicyId: text('onchain_policy_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('retention_policies_tenant_idx').on(table.tenantId),
  }),
);
