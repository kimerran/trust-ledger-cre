#!/usr/bin/env bash
# simulate-cre.sh — Simulate the trustledger-risk-monitor CRE workflow locally
#
# Usage: bash scripts/simulate-cre.sh [DECISION_ID]
#
# Requires: cre CLI — installed at ~/.cre/bin/cre (run `cre login` first)
#
# Project structure expected by the CLI:
#   chainlink/
#   ├── project.yaml                              ← CRE project settings (targets + RPCs)
#   ├── secrets.dev.yaml                          ← dev secrets (fill in before running)
#   └── workflows/
#       └── trustledger-risk-monitor/             ← workflow TypeScript package
#           ├── workflow.yaml                     ← CRE workflow settings
#           ├── main.ts                           ← entry point
#           └── httpCallback.ts                   ← HTTP trigger handler
#
# Troubleshooting:
#   "no project settings file found"  → Make sure chainlink/project.yaml exists
#   "workflow path must be a directory" → Pass a directory, not a .yaml file
#   External API calls failing         → Fill in chainlink/secrets.dev.yaml

set -euo pipefail

# ─── Resolve paths ────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRE_DIR="$REPO_ROOT/chainlink"
WORKFLOW_DIR="$CRE_DIR/workflows/trustledger-risk-monitor"
DECISION_ID="${1:-01HQTEST$(date +%s)}"

# Add CRE to PATH if not already there
export PATH="$HOME/.cre/bin:$PATH"

echo "=== TrustLedger CRE Simulation ==="
echo "Project dir : $CRE_DIR"
echo "Workflow dir: $WORKFLOW_DIR"
echo "Decision ID : $DECISION_ID"
echo ""

# ─── Build realistic test payload ─────────────────────────────────────────────
INPUT=$(cat <<EOF
{
  "decisionId": "$DECISION_ID",
  "modelId": "00000000-0000-0000-0000-000000000001",
  "inputHash": "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f9a1aca1dba1f43a",
  "callbackUrl": "http://localhost:3001/webhooks/cre",
  "decision": {
    "type": "loan_approval",
    "outcome": "DENIED",
    "confidence": 0.61,
    "topFeatures": [
      { "name": "debt_to_income", "value": 0.54, "contribution": -0.19 },
      { "name": "credit_score", "value": 580, "contribution": -0.15 },
      { "name": "employment_months", "value": 8, "contribution": -0.08 }
    ]
  }
}
EOF
)

# ─── Save payload to temp file (avoids shell quoting issues) ──────────────────
PAYLOAD_FILE="$(mktemp /tmp/cre-payload-XXXXXX.json)"
echo "$INPUT" > "$PAYLOAD_FILE"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

echo "Input payload:"
echo "$INPUT" | python3 -m json.tool 2>/dev/null || echo "$INPUT"
echo ""

# ─── Check for cre CLI ────────────────────────────────────────────────────────
if ! command -v cre &>/dev/null; then
  echo "WARNING: 'cre' CLI not found in PATH."
  echo "  Install: npm install -g @chainlink/cre-cli"
  echo "  Or add to PATH: export PATH=\"\$HOME/.cre/bin:\$PATH\""
  echo ""
  echo "Showing expected output shape (mock):"
  cat <<MOCK
{
  "decisionId": "$DECISION_ID",
  "workflowRunId": "cre-run-$(date +%s)",
  "hash": "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f9a1aca1dba1f43a",
  "signature": "MEUCIQD1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJK==",
  "riskAssessment": {
    "riskLevel": "HIGH",
    "summary": "High debt-to-income ratio and below-average credit score indicate elevated default risk."
  },
  "anchoredAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
MOCK
  exit 0
fi

# ─── Check workflow directory exists ──────────────────────────────────────────
if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "ERROR: Workflow directory not found: $WORKFLOW_DIR"
  exit 1
fi

# ─── Install workflow dependencies if needed ──────────────────────────────────
if [ ! -d "$WORKFLOW_DIR/node_modules" ]; then
  echo "Installing workflow dependencies..."
  cd "$WORKFLOW_DIR"
  bun install 2>/dev/null || npm install
  cd "$REPO_ROOT"
  echo ""
fi

# ─── Run simulation ───────────────────────────────────────────────────────────
# Must run from chainlink/ so project.yaml is found at the project root
cd "$CRE_DIR"

echo "Running: cre workflow simulate ./workflows/trustledger-risk-monitor --target dev-settings"
echo ""

# --project-root . ensures project.yaml is found in chainlink/
# --http-payload  passes the JSON payload to the HTTP trigger
# --trigger-index 0 selects the HTTP trigger (index 0)
# --non-interactive skips prompts
cre workflow simulate ./workflows/trustledger-risk-monitor \
  -R . \
  --target dev-settings \
  --trigger-index 0 \
  --non-interactive \
  --http-payload "@$PAYLOAD_FILE"
