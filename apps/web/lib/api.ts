import type {
  Decision,
  AIModel,
  WorkflowRun,
  VerificationResult,
  ApiResponse,
} from '@trustledger/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchApi<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...fetchOptions } = options ?? {};

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers, cache: 'no-store' });
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new Error(json.error.message);
  }

  return json.data;
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export const decisionsApi = {
  list: (token: string) => fetchApi<Decision[]>('/decisions', { token }),

  get: (id: string, token: string) => fetchApi<Decision>(`/decisions/${id}`, { token }),

  submit: (
    body: {
      modelId: string;
      decisionType: string;
      outcome: string;
      confidence: number;
      topFeatures: Array<{ name: string; value: unknown; contribution: number }>;
      metadata?: Record<string, unknown>;
    },
    token: string,
  ) =>
    fetchApi<Decision>('/decisions', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    }),

  verify: (id: string, token: string) =>
    fetchApi<VerificationResult>(`/decisions/${id}/verify`, { token }),

  proof: (id: string, token: string) =>
    fetchApi<Record<string, unknown>>(`/decisions/${id}/proof`, { token }),
};

// ─── Models ───────────────────────────────────────────────────────────────────

export const modelsApi = {
  list: (token: string) => fetchApi<AIModel[]>('/models', { token }),

  create: (
    body: {
      name: string;
      version: string;
      modelType: string;
      description?: string;
    },
    token: string,
  ) =>
    fetchApi<AIModel>('/models', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    }),
};

// ─── Workflow Runs ────────────────────────────────────────────────────────────

export const workflowRunsApi = {
  list: (token: string) => fetchApi<WorkflowRun[]>('/workflow-runs', { token }),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () =>
    fetch(`${API_BASE}/health`).then((r) =>
      r.json() as Promise<{ status: string; checks: Record<string, string> }>,
    ),
};
