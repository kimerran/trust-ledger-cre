'use client';

import { useState, useCallback } from 'react';
import { StepIndicator } from '@/components/StepIndicator';
import { StepWelcome } from '@/components/steps/StepWelcome';
import { StepSubmit } from '@/components/steps/StepSubmit';
import { StepVerify } from '@/components/steps/StepVerify';
import { StepProof } from '@/components/steps/StepProof';
import { PRE_POPULATED_DECISION } from '@/lib/constants';
import type { Decision, VerificationResult } from '@trustledger/shared';

interface WizardState {
  currentStep: number;
  token: string | null;
  decision: Decision | null;
  verification: VerificationResult | null;
  proof: Record<string, unknown> | null;
  editedPayload: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: WizardState = {
  currentStep: 0,
  token: null,
  decision: null,
  verification: null,
  proof: null,
  editedPayload: JSON.stringify(PRE_POPULATED_DECISION, null, 2),
  isLoading: false,
  error: null,
};

export function Wizard() {
  const [state, setState] = useState<WizardState>(initialState);

  const setLoading = (isLoading: boolean) => setState((s) => ({ ...s, isLoading, error: null }));
  const setError = (error: string) => setState((s) => ({ ...s, isLoading: false, error }));

  // Step 0 → 1: Mint JWT and advance
  const handleBegin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to mint token');
      setState((s) => ({ ...s, token: data.token, currentStep: 1, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token mint failed');
    }
  }, []);

  // Step 1: Submit decision
  const handleSubmit = useCallback(async () => {
    if (!state.token) return;
    setLoading(true);
    try {
      const payload = JSON.parse(state.editedPayload);
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? 'Submit failed');
      setState((s) => ({ ...s, decision: data.data, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }, [state.token, state.editedPayload]);

  // Step 2: Verify
  const handleVerify = useCallback(async () => {
    const id = state.decision?.id;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/decisions/${id}/verify`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? 'Verify failed');
      setState((s) => ({ ...s, verification: data.data, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed');
    }
  }, [state.decision, state.token]);

  // Step 3: Fetch proof
  const handleFetchProof = useCallback(async () => {
    const id = state.decision?.id;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/decisions/${id}/proof`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message ?? 'Proof fetch failed');
      setState((s) => ({ ...s, proof: data.data, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proof fetch failed');
    }
  }, [state.decision, state.token]);

  const nextStep = () => setState((s) => ({ ...s, currentStep: s.currentStep + 1 }));
  const startOver = () => setState(initialState);

  const decisionId = state.decision?.id ?? '';

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={state.currentStep} />

      {state.error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {state.currentStep === 0 && (
        <StepWelcome onBegin={handleBegin} isLoading={state.isLoading} />
      )}

      {state.currentStep === 1 && (
        <StepSubmit
          token={state.token!}
          decision={state.decision}
          editedJson={state.editedPayload}
          onEditJson={(json) => setState((s) => ({ ...s, editedPayload: json }))}
          onSubmit={handleSubmit}
          onNext={nextStep}
          isLoading={state.isLoading}
        />
      )}

      {state.currentStep === 2 && (
        <StepVerify
          decisionId={decisionId}
          verification={state.verification}
          onVerify={handleVerify}
          onNext={nextStep}
          isLoading={state.isLoading}
        />
      )}

      {state.currentStep === 3 && (
        <StepProof
          decisionId={decisionId}
          proof={state.proof}
          onFetchProof={handleFetchProof}
          onStartOver={startOver}
          isLoading={state.isLoading}
        />
      )}
    </div>
  );
}
