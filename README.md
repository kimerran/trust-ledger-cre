# TrustLedger

> Cryptographic audit trail for AI decisions — powered by Chainlink CRE, AWS KMS, and Ethereum Sepolia.

**Hackathon:** Chainlink Convergence — Risk & Compliance Track
**Deadline:** March 8, 2026

---

## Architecture

```
User/AI System → POST /decisions (Express API)
                       ↓
              Chainlink CRE Workflow
               ├── Hash payload (compute node)
               ├── Sign with AWS KMS  ──┐
               └── LLM risk assess  ──→ Merge
                                         ↓
                              Anchor to Ethereum Sepolia
                                         ↓
                              Callback → /webhooks/cre
                                         ↓
                                  Next.js Dashboard
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start local services (PostgreSQL + Redis)
docker-compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run database migrations
pnpm --filter api db:migrate

# 5. Seed demo data
pnpm --filter api db:seed

# 6. Start all services
pnpm dev
# → web: http://localhost:3000
# → api: http://localhost:3001
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker
- Foundry (`foundryup`)
- Chainlink CRE CLI (`npm install -g @chainlink/cre-cli`)
- AWS CLI configured

## Package Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all apps for production |
| `pnpm test` | Run all tests |
| `pnpm --filter api dev` | Start only the backend |
| `pnpm --filter web dev` | Start only the frontend |
| `pnpm --filter api db:generate` | Generate Drizzle migration |
| `pnpm --filter api db:migrate` | Apply migrations |
| `pnpm --filter api db:seed` | Seed demo data |
| `cd contracts && forge test -vvv` | Run Solidity tests |
| `bash scripts/simulate-cre.sh` | Simulate CRE workflow |

---

## Chainlink File Index

All Chainlink-related files live under `chainlink/`:

| File/Directory | Purpose |
|---|---|
| `chainlink/project.yaml` | CRE project settings — defines targets (dev/staging/production) with RPC URLs |
| `chainlink/secrets.dev.yaml` | Dev secrets template — fill in before running simulation |
| `chainlink/workflows/trustledger-risk-monitor/` | **TypeScript CRE workflow** — the runnable implementation |
| `chainlink/workflows/trustledger-risk-monitor/workflow.yaml` | CRE workflow settings (name, artifact paths) |
| `chainlink/workflows/trustledger-risk-monitor/main.ts` | Workflow entry point |
| `chainlink/workflows/trustledger-risk-monitor/httpCallback.ts` | HTTP trigger handler |
| `chainlink/workflows/trustledger-risk-monitor.workflow.yaml` | Declarative architecture spec (reference / docs) |
| `chainlink/workflows/trustledger-reserve-health.workflow.yaml` | Cron health-check spec (reference / docs) |

### Workflow: `trustledger-risk-monitor`

**Trigger:** HTTP POST from `/decisions` API route
**Implementation:** TypeScript (`@chainlink/cre-sdk`) compiled to WASM by `javy`

**Flow:**
1. Parse and canonicalize the decision payload (RFC 8785)
2. Sign hash with AWS KMS — `HTTPClient` → `ECDSA_SHA_256`
3. Assess risk with Claude Haiku — `HTTPClient` → Anthropic API
4. POST result to `/webhooks/cre` callback (backend anchors on-chain)

**Simulate locally** (no credentials needed — uses placeholders):
```bash
cd chainlink/workflows/trustledger-risk-monitor && bun install && cd ../..
cre workflow simulate ./workflows/trustledger-risk-monitor \
  -R . --target dev-settings --trigger-index 0 --non-interactive \
  --http-payload '{"decisionId":"test","modelId":"...","inputHash":"sha256:...","callbackUrl":"http://localhost:3001/webhooks/cre","decision":{"type":"loan_approval","outcome":"DENIED","confidence":0.61,"topFeatures":[]}}'
```

**Secrets required** (upload via `cre secrets create secrets.dev.yaml --target dev-settings`):
- `KMS_KEY_ARN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `ANTHROPIC_API_KEY`
- `INTERNAL_API_KEY`
- `AUDIT_ANCHOR_CONTRACT`

### Workflow: `trustledger-reserve-health`

**Trigger:** Cron — every 15 minutes
**Flow:**
1. `fetch_recent_decisions` — Query backend for decisions in last 15 minutes
2. `check_anchor_health` — Verify a sample of anchors on-chain
3. `alert_on_failure` — POST to Slack webhook if any anchor fails

---

## Smart Contracts

| Contract | Address (Sepolia) | Purpose |
|---|---|---|
| `AuditAnchor.sol` | `$AUDIT_ANCHOR_CONTRACT` | Immutable storage of decision hashes + signatures |
| `RetentionPolicy.sol` | `$RETENTION_POLICY_CONTRACT` | On-chain retention rules per tenant |

```bash
# Deploy to Sepolia
cd contracts
forge build
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ALCHEMY_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/decisions` | Submit an AI decision |
| `GET` | `/decisions` | List decisions (tenant-scoped) |
| `GET` | `/decisions/:id` | Get a single decision |
| `GET` | `/decisions/:id/verify` | Three-layer verification |
| `GET` | `/decisions/:id/proof` | Download cryptographic proof JSON |
| `GET` | `/models` | List registered AI models |
| `POST` | `/models` | Register a new AI model |
| `GET` | `/workflow-runs` | List CRE workflow runs |
| `GET` | `/events` | SSE stream of live events |
| `POST` | `/webhooks/cre` | CRE workflow callback (internal) |

---

## License

MIT
