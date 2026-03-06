// TrustLedger — HTTP Trigger Handler
//
// Receives the AI decision payload, orchestrates signing + risk assessment,
// anchors on-chain via CRE's EVMClient, then notifies the backend with the txHash.

import {
  cre,
  type Runtime,
  type HTTPPayload,
  decodeJson,
  json,
  ok,
  text,
  getNetwork,
  prepareReportRequest,
  TxStatus,
  bytesToHex,
} from "@chainlink/cre-sdk";
import { encodeFunctionData, encodeAbiParameters, toHex } from "viem";
import type { WorkflowConfig } from "./main";

// ─── ABI for the onReport receiver ──────────────────────────────────────────

const AUDIT_ANCHOR_RECEIVER_ABI = [
  {
    type: "function",
    name: "onReport",
    inputs: [
      { name: "metadata", type: "bytes" },
      { name: "rawReport", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// ─── Payload types ─────────────────────────────────────────────────────────

type TopFeature = {
  name: string;
  value: number;
  contribution: number;
};

type DecisionInput = {
  decisionId: string;
  signature: string;
  modelId: string;
  inputHash: string; // pre-computed sha256: hex by the backend
  callbackUrl: string;
  decision: {
    type: string;
    outcome: string;
    confidence: number;
    topFeatures: TopFeature[];
  };
  // Optional secrets passed in payload for simulation (CRE WASM doesn't support getSecret in sim)
  secrets?: Record<string, string>;
};

type RiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
};

type CallbackPayload = {
  decisionId: string;
  workflowRunId: string;
  hash: string;
  signature: string;
  riskAssessment: RiskAssessment;
  txHash: string;
  anchoredAt: string;
};

// ─── Base64 encoding (no btoa in CRE WASM runtime) ───────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(str: string): string {
  const bytes = Array.from(str).map((c) => c.charCodeAt(0));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[(b0 >> 2) & 0x3f];
    out += B64[((b0 << 4) | (b1 >> 4)) & 0x3f];
    out += i + 1 < bytes.length ? B64[((b1 << 2) | (b2 >> 6)) & 0x3f] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 0x3f] : "=";
  }
  return out;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Safely retrieve a secret; falls back to payload secrets, then to fallback string. */
function getSecretSafe(
  runtime: Runtime<WorkflowConfig>,
  name: string,
  payloadSecrets?: Record<string, string>,
  fallback = ""
): string {
  // 1. Try CRE secret store (works in deployed mode)
  try {
    const val = runtime.getSecret({ id: name }).result().value;
    if (val) return val;
  } catch {
    // Not available in simulation
  }
  // 2. Try payload-provided secrets (for simulation)
  if (payloadSecrets?.[name]) return payloadSecrets[name];
  return fallback;
}

// ─── RFC 8785 canonical JSON ───────────────────────────────────────────────

function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalize((obj as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

// ─── Trigger handler ──────────────────────────────────────────────────────

export function onHttpTrigger(
  runtime: Runtime<WorkflowConfig>,
  payload: HTTPPayload
): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("TrustLedger Risk Monitor — workflow started");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!payload.input || payload.input.length === 0) {
    runtime.log("[ERROR] Empty request payload");
    throw new Error("Empty request payload");
  }

  const input = decodeJson(payload.input) as DecisionInput;
  runtime.log(`[1/5] Decision ID: ${input.decisionId}`);
  runtime.log(`[1/5] Model ID:    ${input.modelId}`);
  runtime.log(`[1/5] Outcome:     ${input.decision.outcome}`);
  runtime.log(`[1/5] Confidence:  ${input.decision.confidence}`);

  // ─── Step 1: canonical hash ────────────────────────────────────────────
  const hashablePayload = {
    confidence: input.decision.confidence,
    decisionType: input.decision.type,
    modelId: input.modelId,
    outcome: input.decision.outcome,
    topFeatures: input.decision.topFeatures,
  };
  const canonical = canonicalize(hashablePayload);
  const hash = input.inputHash;
  runtime.log(`[1/5] Canonical payload length: ${canonical.length} chars`);
  runtime.log(`[1/5] Hash: ${hash}`);

  // ─── Step 2: sign with AWS KMS ────────────────────────────────────────
  runtime.log("[2/5] Signing with AWS KMS...");

  const secrets = input.secrets;
  const kmsKeyArn = getSecretSafe(runtime, "KMS_KEY_ARN", secrets);
  const awsKeyId = getSecretSafe(runtime, "AWS_ACCESS_KEY_ID", secrets);
  const awsSecret = getSecretSafe(runtime, "AWS_SECRET_ACCESS_KEY", secrets);

  const isSimulation = !kmsKeyArn || !awsKeyId || !awsSecret;
  if (isSimulation) {
    runtime.log(
      "[2/5] KMS secrets not configured — running in simulation mode"
    );
  }

  let signature = input.signature;

  if (!isSimulation) {
    const kmsBody = JSON.stringify({
      KeyId: kmsKeyArn,
      Message: toBase64(hash),
      MessageType: "RAW",
      SigningAlgorithm: "ECDSA_SHA_256",
    });

    const kmsResult = runtime.runInNodeMode(
      (
        nodeRuntime,
        body: string,
        keyId: string,
        secret: string,
        endpoint: string
      ) => {
        const sender = new cre.capabilities.HTTPClient();
        const response = sender
          .sendRequest(nodeRuntime, {
            url: endpoint,
            method: "POST",
            headers: {
              "Content-Type": "application/x-amz-json-1.1",
              "X-Amz-Target": "TrentService.Sign",
              "X-Aws-Access-Key-Id": keyId,
              "X-Aws-Secret-Access-Key": secret,
            },
            body: Buffer.from(body).toString("base64"),
          })
          .result();

        if (!ok(response)) {
          runtime.log(`[WARN] KMS sign failed (${response.statusCode})`);
          return "SIGN_FAILED";
        }

        const parsed = json(response) as { Signature: string };
        return parsed.Signature ?? "MISSING_SIGNATURE";
      },
      { aggregation: "MODE" }
    )(kmsBody, awsKeyId, awsSecret, runtime.config.kmsEndpoint).result();

    signature = String(kmsResult);
  }

  runtime.log(`[2/5] Signature: ${signature.substring(0, 32)}...`);

  // ─── Step 3: risk assessment via Claude Haiku ─────────────────────────
  runtime.log("[3/5] Assessing risk with Claude Haiku...");

  const anthropicKey = getSecretSafe(runtime, "ANTHROPIC_API_KEY", secrets);
  const hasAnthropicKey = anthropicKey.length > 0;

  let riskAssessment: RiskAssessment = {
    riskLevel: "MEDIUM",
    summary: "Risk assessment unavailable — ANTHROPIC_API_KEY not configured.",
  };

  if (hasAnthropicKey) {
    const claudeBody = JSON.stringify({
      model: runtime.config.claudeModel,
      max_tokens: 256,
      system:
        'You are a risk assessment AI for financial and regulated AI decisions. Always respond with valid JSON only — no markdown, no explanation. Schema: {"riskLevel": "LOW"|"MEDIUM"|"HIGH", "summary": "<1-2 sentences>"}',
      messages: [
        {
          role: "user",
          content: [
            `Assess the risk of this AI decision:`,
            `Type: ${input.decision.type}`,
            `Outcome: ${input.decision.outcome}`,
            `Confidence: ${input.decision.confidence}`,
            `Top features: ${JSON.stringify(input.decision.topFeatures)}`,
            ``,
            `Respond with JSON only. Do not put any json symbol.`,
          ].join("\n"),
        },
      ],
    });

    const riskResult = runtime.runInNodeMode(
      (nodeRuntime, body: string, apiKey: string) => {
        const sender = new cre.capabilities.HTTPClient();
        const response = sender
          .sendRequest(nodeRuntime, {
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: Buffer.from(body).toString("base64"),
          })
          .result();

        if (!ok(response)) {
          runtime.log(`[WARN] Claude API failed (${response.statusCode})`);
          return JSON.stringify({
            riskLevel: "MEDIUM",
            summary: "Risk assessment unavailable (API error).",
          });
        }

        const parsed = json(response) as {
          content: Array<{ type: string; text: string }>;
        };
        return parsed.content?.[0]?.text ?? "{}";
      },
      { aggregation: "MODE" }
    )(claudeBody, anthropicKey).result();

    try {
      riskAssessment = JSON.parse(String(riskResult)) as RiskAssessment;
    } catch (error) {
      runtime.log(`llm error: ${error as string}`);
      runtime.log("[WARN] Failed to parse Claude response");
    }
  }

  runtime.log(`[3/5] Risk level: ${riskAssessment.riskLevel}`);
  runtime.log(`[3/5] Summary: ${riskAssessment.summary}`);

  // ─── Step 4: anchor on-chain via EVMClient ─────────────────────────────
  runtime.log("[4/5] Anchoring on-chain via CRE EVMClient...");

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(
      `Network not found for chain: ${runtime.config.chainSelectorName}`
    );
  }

  // Strip "sha256:" prefix and convert to bytes32
  const hashHex = ("0x" + hash.replace(/^sha256:/, "")) as `0x${string}`;
  const riskJson = JSON.stringify(riskAssessment);

  // ABI-encode the inner data that onReport will decode
  const innerData = encodeAbiParameters(
    [
      { type: "string" },
      { type: "bytes32" },
      { type: "string" },
      { type: "string" },
    ],
    [input.decisionId, hashHex, signature, riskJson]
  );

  // Encode the full onReport(metadata, rawReport) call
  const writeCallData = encodeFunctionData({
    abi: AUDIT_ANCHOR_RECEIVER_ABI,
    functionName: "onReport",
    args: [toHex("0x"), innerData],
  });

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  const report = runtime.report(prepareReportRequest(writeCallData)).result();

  const writeResp = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.auditAnchorContract,
      report,
    })
    .result();

  runtime.log(writeResp.txStatus.toString());

  if (writeResp.txStatus !== TxStatus.SUCCESS) {
    runtime.log(
      `[ERROR] On-chain anchor failed: ${writeResp.errorMessage || writeResp.txStatus}`
    );
    throw new Error(
      `On-chain anchor failed: ${writeResp.errorMessage || writeResp.txStatus}`
    );
  }

  const txHash = writeResp.txHash
    ? bytesToHex(writeResp.txHash)
    : "0x0000000000000000000000000000000000000000000000000000000000000000";

  runtime.log(`[4/5] Anchored on-chain — txHash: ${txHash}`);

  // ─── Step 5: notify backend with txHash ────────────────────────────────
  runtime.log("[5/5] Notifying backend...");

  const internalKey = getSecretSafe(
    runtime,
    "INTERNAL_API_KEY",
    secrets,
    "dev-internal"
  );

  const callbackPayload: CallbackPayload = {
    decisionId: input.decisionId,
    workflowRunId: `cre-${Date.now()}`,
    hash,
    signature,
    riskAssessment,
    txHash,
    anchoredAt: new Date().toISOString(),
  };

  const callbackBody = JSON.stringify(callbackPayload);
  const callbackUrl = input.callbackUrl;

  runtime.runInNodeMode(
    (nodeRuntime, body: string, apiKey: string, url: string) => {
      const sender = new cre.capabilities.HTTPClient();
      const response = sender
        .sendRequest(nodeRuntime, {
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          body: Buffer.from(body).toString("base64"),
        })
        .result();

      if (!ok(response)) {
        runtime.log(
          `[WARN] Callback to ${url} failed (${response.statusCode})`
        );
      } else {
        runtime.log(`[5/5] Callback delivered (${response.statusCode})`);
      }
      return response.statusCode;
    },
    { aggregation: "MODE" }
  )(callbackBody, internalKey, callbackUrl).result();

  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("TrustLedger Risk Monitor — complete");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return JSON.stringify(callbackPayload);
}
