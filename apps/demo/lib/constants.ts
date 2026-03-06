export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_USER_EMAIL = 'demo-wizard@trustledger.io';

export const DEMO_MODEL_ID = '00000000-0000-0000-0000-000000000001';

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';
export const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

export function generateRandomDecision() {
  const outcome = Math.random() > 0.5 ? 'APPROVED' : 'DISAPPROVED';
  const confidence = randFloat(0.55, 0.99);
  const creditScore = randInt(300, 850);
  const dti = randFloat(0.10, 0.65);
  const years = randInt(0, 30);
  const loanAmount = randInt(5000, 500000);

  return {
    modelId: DEMO_MODEL_ID,
    decisionType: 'loan_approval',
    outcome,
    confidence,
    topFeatures: [
      { name: 'credit_score', value: creditScore, contribution: randFloat(0.15, 0.45) },
      { name: 'debt_to_income', value: dti, contribution: randFloat(-0.10, 0.30) },
      { name: 'employment_years', value: years, contribution: randFloat(0.05, 0.25) },
      { name: 'loan_amount', value: loanAmount, contribution: randFloat(-0.20, 0.10) },
    ],
  };
}

export const STEP_TITLES = [
  'Welcome',
  'Submit Decision',
  'Verify',
  'Proof & Summary',
] as const;
