# TrustLedger

> Cryptographic audit trail for AI decisions — powered by Chainlink CRE, AWS KMS, and Ethereum Sepolia.

---

## Architecture

```
User/AI System → POST /decisions (Express API)
                       ↓
              Chainlink CRE Workflow
               ├── Hash payload (RFC 8785 canonical JSON)
               ├── Sign with AWS KMS (ECDSA_SHA_256) ──┐
               └── LLM risk assess (Claude Haiku)  ──→ Merge
                                                        ↓
                                             Callback → /webhooks/cre
                                                        ↓
                                              Anchor to Ethereum Sepolia
                                              (AuditAnchor.sol via ethers.js)
                                                        ↓
                                                 Next.js Dashboard
                                                 + Public Proof Page
```

### Three-Layer Verification

Every decision can be independently verified through three layers:

1. **Hash Match** — Recomputes the RFC 8785 canonical JSON hash and compares to stored value
2. **KMS Signature** — Verifies the ECDSA_SHA_256 signature against the hash using AWS KMS (dev: deterministic local ECDSA key derived from `DEPLOYER_PRIVATE_KEY`)
3. **On-Chain Anchor** — Confirms the transaction receipt on Ethereum Sepolia via Etherscan V2 API

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start local services (PostgreSQL + Redis)
docker-compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# 4. Run database migrations
pnpm --filter api db:migrate

# 5. Seed demo data
pnpm --filter api db:seed

# 6. Start all services
pnpm dev
# → web: http://localhost:3000
# → api: http://localhost:3001
# → demo: http://localhost:3002
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker
- Foundry (`foundryup`)
- Chainlink CRE CLI (`~/.cre/bin/cre` — see [CRE docs](https://docs.chain.link/cre))
- Bun (`curl -fsSL https://bun.sh/install | bash`) — required for CRE workflow compilation

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DEPLOYER_PRIVATE_KEY` | Ethereum private key for deploying contracts and deriving dev KMS key |
| `ALCHEMY_RPC_URL` | Sepolia RPC endpoint |
| `AUDIT_ANCHOR_CONTRACT` | Deployed AuditAnchor.sol address on Sepolia |
| `ETHERSCAN_API_KEY` | For on-chain verification (Etherscan V2 API) |
| `ANTHROPIC_API_KEY` | Claude Haiku for risk assessment |
| `INTERNAL_API_KEY` | Shared key for CRE → API callback auth |
| `NEXTAUTH_SECRET` | NextAuth.js session encryption |

> **Never commit `.env` or hardcode secrets in source files.** All secrets are loaded from environment variables or CRE secret store.

## Package Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all apps for production |
| `pnpm test` | Run all tests |
| `pnpm --filter api dev` | Start only the backend |
| `pnpm --filter web dev` | Start only the frontend |
| `pnpm --filter demo dev` | Start only the demo wizard |
| `pnpm --filter api db:generate` | Generate Drizzle migration |
| `pnpm --filter api db:migrate` | Apply migrations |
| `pnpm --filter api db:seed` | Seed demo data |
| `cd contracts && forge test -vvv` | Run Solidity tests |

---

## Chainlink CRE Workflow

All Chainlink-related files live under `chainlink/`:

| File/Directory | Purpose |
|---|---|
| `chainlink/project.yaml` | CRE project settings — targets (dev/staging/production) with RPC URLs |
| `chainlink/secrets.dev.yaml` | Dev secrets declaration — maps CRE secret names to env var names |
| `chainlink/workflows/trustledger-risk-monitor/` | **TypeScript CRE workflow** — the runnable implementation |
| `chainlink/workflows/trustledger-risk-monitor/workflow.yaml` | CRE workflow settings (name, artifact paths, secrets path) |
| `chainlink/workflows/trustledger-risk-monitor/main.ts` | Workflow entry point |
| `chainlink/workflows/trustledger-risk-monitor/httpCallback.ts` | HTTP trigger handler (all 4 steps) |
| `chainlink/workflows/trustledger-risk-monitor/config.dev.json` | Dev config (contract address, callback URL, Claude model) |

### Workflow: `trustledger-risk-monitor`

**Trigger:** HTTP POST from `/decisions` API route
**Implementation:** TypeScript (`@chainlink/cre-sdk`) compiled to WASM by `javy`

**Flow:**
1. Parse and canonicalize the decision payload (RFC 8785)
2. Sign hash with AWS KMS — `HTTPClient` → `ECDSA_SHA_256`
3. Assess risk with Claude Haiku — `HTTPClient` → Anthropic API
4. POST result to `/webhooks/cre` callback (backend anchors on-chain via `anchorService.ts`)

### Simulating locally

The CRE WASM runtime does not support `runtime.getSecret()` during simulation. Instead, pass secrets in the HTTP payload under a `secrets` key:

```bash
# 1. Install workflow dependencies (first time only)
cd chainlink/workflows/trustledger-risk-monitor && bun install && cd ../..

# 2. Run simulation from chainlink/ directory
cd chainlink
~/.cre/bin/cre workflow simulate ./workflows/trustledger-risk-monitor \
  -R . --target dev-settings --trigger-index 0 --non-interactive \
  --http-payload '{
    "decisionId": "test-123",
    "signature": "test-sig",
    "modelId": "model-v1",
    "inputHash": "sha256:abc123",
    "callbackUrl": "http://localhost:3001/webhooks/cre",
    "decision": {
      "type": "FRAUD_CHECK",
      "outcome": "APPROVED",
      "confidence": 0.95,
      "topFeatures": [{"name": "tx_amount", "value": 500, "contribution": 0.3}]
    },
    "secrets": {
      "ANTHROPIC_API_KEY": "your-anthropic-key",
      "INTERNAL_API_KEY": "your-internal-key"
    }
  }'
```

**Secret resolution order** (in `getSecretSafe`):
1. CRE secret store (`runtime.getSecret()`) — works in deployed mode
2. `secrets` field in the HTTP payload — works in simulation
3. Hardcoded fallback (e.g. `"dev-internal"`)

**Secrets for deployed mode** (upload via `cre secrets create`):
- `KMS_KEY_ARN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `ANTHROPIC_API_KEY`
- `INTERNAL_API_KEY`

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
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

> `Deploy.s.sol` reads `DEPLOYER_PRIVATE_KEY` from environment via `vm.envUint()`.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Health check |
| `POST` | `/decisions` | JWT | Submit an AI decision |
| `GET` | `/decisions` | JWT | List decisions (tenant-scoped) |
| `GET` | `/decisions/:id` | JWT | Get a single decision |
| `GET` | `/decisions/:id/verify` | JWT | Three-layer verification |
| `GET` | `/decisions/:id/proof` | JWT | Download cryptographic proof JSON |
| `GET` | `/decisions/public/:id/verify` | None | Public verification (no auth) |
| `GET` | `/models` | JWT | List registered AI models |
| `POST` | `/models` | JWT | Register a new AI model |
| `GET` | `/workflow-runs` | JWT | List CRE workflow runs |
| `GET` | `/events` | JWT | SSE stream of live events |
| `POST` | `/webhooks/cre` | API Key | CRE workflow callback (internal) |

### Public Proof Page

Each decision has a shareable public proof URL:
```
http://localhost:3000/verify/<decision-id>
```
No authentication required. Displays all three verification layers with pass/fail status.

---

## Demo App

The demo wizard at `http://localhost:3002` walks through the full flow:

1. **Welcome** — Mint a demo JWT token
2. **Submit** — Edit and submit an AI decision payload (editable JSON)
3. **Verify** — Run three-layer verification on the submitted decision
4. **Proof** — View and download the cryptographic proof

---

## Project Structure

```
trust-ledger-chainlink/
├── apps/
│   ├── api/          Express API (port 3001)
│   ├── web/          Next.js dashboard (port 3000)
│   └── demo/         Demo wizard app (port 3002)
├── packages/
│   └── shared/       Shared types + hashDecision utility
├── contracts/        Foundry — AuditAnchor.sol, RetentionPolicy.sol
├── chainlink/        CRE project — workflows, config, secrets
├── docker-compose.yml
└── .env.example
```

---

## License

MIT
