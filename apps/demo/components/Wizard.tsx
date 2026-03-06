'use client';

import { useState, useCallback } from 'react';
import { PipelineIndicator } from '@/components/StepIndicator';
import { StepWelcome } from '@/components/steps/StepWelcome';
import { StepSubmit } from '@/components/steps/StepSubmit';
import { StepAnchor } from '@/components/steps/StepAnchor';
import { StepVerify } from '@/components/steps/StepVerify';
import { StepProof } from '@/components/steps/StepProof';
import { generateRandomDecision } from '@/lib/constants';
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
  editedPayload: JSON.stringify(generateRandomDecision(), null, 2),
  isLoading: false,
  error: null,
};

// Wizard steps:
//   0 = Welcome
//   1 = Submit Decision (AI Decision)
//   2 = Blockchain Anchor (shows CRE command)
//   3 = Verify (3-layer check)
//   4 = Proof & Summary

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

  // Step 3: Verify
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

  // Step 4: Fetch proof
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

  // Map wizard steps to pipeline indicator stages:
  // Pipeline: 0=AI Decision, 1=Hash & Sign, 2=On-Chain, 3=Verify, 4=Proof
  //
  // Wizard step 0 (welcome):              stage 0 active
  // Wizard step 1 (submit, no decision):  stage 0 active
  // Wizard step 1 (decision created):     stage 0 done, stage 1 active
  // Wizard step 2 (anchor page):          stages 0-1 done, stage 2 active
  // Wizard step 3 (verify, no result):    stages 0-2 done, stage 3 active
  // Wizard step 3 (result ready):         stages 0-3 done
  // Wizard step 4 (proof):               stages 0-3 done, stage 4 active
  // Wizard step 4 (proof fetched):       all 5 done
  let completedStages = 0;
  let activeStage = 0;

  if (state.currentStep === 0) {
    activeStage = 0;
  } else if (state.currentStep === 1 && !state.decision) {
    activeStage = 0;
  } else if (state.currentStep === 1 && state.decision) {
    completedStages = 1;
    activeStage = 1;
  } else if (state.currentStep === 2) {
    completedStages = 2;
    activeStage = 2;
  } else if (state.currentStep === 3) {
    completedStages = 3;
    activeStage = state.verification ? -1 : 3;
    if (state.verification) completedStages = 4;
  } else if (state.currentStep === 4) {
    completedStages = state.proof ? 5 : 4;
    activeStage = state.proof ? -1 : 4;
  }

  return (
    <div className="space-y-6">
      <PipelineIndicator completedStages={completedStages} activeStage={activeStage} />

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
        <StepAnchor
          decisionId={decisionId}
          inputHash={state.decision?.inputHash ?? ''}
          signature={state.decision?.signature ?? ''}
          decisionPayload={state.editedPayload}
          onNext={nextStep}
        />
      )}

      {state.currentStep === 3 && (
        <StepVerify
          decisionId={decisionId}
          verification={state.verification}
          onVerify={handleVerify}
          onNext={nextStep}
          isLoading={state.isLoading}
        />
      )}

      {state.currentStep === 4 && (
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
