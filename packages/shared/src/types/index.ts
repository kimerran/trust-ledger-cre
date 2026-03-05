// ─── Decision types ───────────────────────────────────────────────────────────

export type DecisionStatus = 'PENDING' | 'SIGNED' | 'ANCHORED' | 'VERIFIED' | 'FAILED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TopFeature {
  name: string;
  value: unknown;
  contribution: number;
}

export interface Decision {
  id: string;
  tenantId: string;
  modelId: string;
  decisionType: string;
  outcome: string;
  confidence: number;
  topFeatures: TopFeature[];
  inputHash: string;
  signature: string | null;
  riskLevel: RiskLevel | null;
  riskSummary: string | null;
  txHash: string | null;
  blockNumber: number | null;
  status: DecisionStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Verification types ───────────────────────────────────────────────────────

export interface HashMatchLayer {
  pass: boolean;
  computed: string;
  stored: string;
}

export interface SignatureLayer {
  pass: boolean;
  algorithm: string;
  kmsKeyArn: string;
}

export interface OnchainAnchorLayer {
  pass: boolean;
  txHash: string | null;
  blockNumber: number | null;
  chain: string;
}

export interface VerificationLayers {
  hashMatch: HashMatchLayer;
  signatureValid: SignatureLayer;
  onchainAnchor: OnchainAnchorLayer;
}

export type VerificationOverall = 'PASS' | 'FAIL' | 'PARTIAL';

export interface VerificationResult {
  decisionId: string;
  layers: VerificationLayers;
  overall: VerificationOverall;
  verifiedAt: string;
}

// ─── AI Model types ───────────────────────────────────────────────────────────

export interface AIModel {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  modelType: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Workflow run types ───────────────────────────────────────────────────────

export type WorkflowRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface WorkflowRun {
  id: string;
  tenantId: string;
  decisionId: string | null;
  workflowName: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Audit event types ────────────────────────────────────────────────────────

export type AuditEventType =
  | 'DECISION_SUBMITTED'
  | 'DECISION_SIGNED'
  | 'DECISION_ANCHORED'
  | 'DECISION_VERIFIED'
  | 'DECISION_FAILED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED';

export interface AuditEvent {
  id: string;
  tenantId: string;
  decisionId: string | null;
  eventType: AuditEventType;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Tenant types ─────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Retention policy types ───────────────────────────────────────────────────

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  decisionType: string | null;
  retentionDays: number;
  onchainPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── CRE Webhook payload ──────────────────────────────────────────────────────

export interface CREWebhookPayload {
  decisionId: string;
  workflowRunId: string;
  hash: string;
  signature: string;
  riskAssessment: {
    riskLevel: RiskLevel;
    summary: string;
  };
  txHash: string;
  blockNumber: number;
  anchoredAt: string;
}

// ─── SSE event types ──────────────────────────────────────────────────────────

export interface SSEEvent {
  type: AuditEventType;
  data: Record<string, unknown>;
  timestamp: string;
}
