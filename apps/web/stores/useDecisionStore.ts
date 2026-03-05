'use client';

import { create } from 'zustand';
import type { Decision, SSEEvent } from '@trustledger/shared';

interface DecisionStore {
  decisions: Decision[];
  liveEvents: SSEEvent[];
  isConnected: boolean;

  setDecisions: (decisions: Decision[]) => void;
  upsertDecision: (decision: Decision) => void;
  addLiveEvent: (event: SSEEvent) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useDecisionStore = create<DecisionStore>((set) => ({
  decisions: [],
  liveEvents: [],
  isConnected: false,

  setDecisions: (decisions) => set({ decisions }),

  upsertDecision: (decision) =>
    set((state) => {
      const idx = state.decisions.findIndex((d) => d.id === decision.id);
      if (idx === -1) {
        return { decisions: [decision, ...state.decisions] };
      }
      const next = [...state.decisions];
      next[idx] = decision;
      return { decisions: next };
    }),

  addLiveEvent: (event) =>
    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, 50), // keep last 50
    })),

  setConnected: (isConnected) => set({ isConnected }),

  reset: () => set({ decisions: [], liveEvents: [], isConnected: false }),
}));
