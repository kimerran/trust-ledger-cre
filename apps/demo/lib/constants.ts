export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_USER_EMAIL = 'demo-wizard@trustledger.io';

export const DEMO_MODEL_ID = '00000000-0000-0000-0000-000000000001';

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';
export const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

export const PRE_POPULATED_DECISION = {
  modelId: DEMO_MODEL_ID,
  decisionType: 'loan_approval',
  outcome: 'APPROVED',
  confidence: 0.92,
  topFeatures: [
    { name: 'credit_score', value: 780, contribution: 0.35 },
    { name: 'debt_to_income', value: 0.22, contribution: 0.18 },
    { name: 'employment_years', value: 7, contribution: 0.14 },
    { name: 'loan_amount', value: 45000, contribution: -0.08 },
  ],
};

export const STEP_TITLES = [
  'Welcome',
  'Submit Decision',
  'On-Chain Anchor',
  'Verify',
  'Proof & Summary',
] as const;
