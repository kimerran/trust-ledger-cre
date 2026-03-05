// TrustLedger — Risk Monitor CRE Workflow
//
// Trigger: HTTP POST from /decisions API after initial PENDING creation
// Flow:
//   1. Parse and hash the decision payload (RFC 8785 canonical JSON)
//   2. Sign hash with AWS KMS (ECDSA_SHA_256)          ─┐ parallel
//   3. Assess risk with Claude Haiku                   ─┘
//   4. POST full result to /webhooks/cre callback
//      (backend anchors on-chain via AuditAnchor.sol)

import { cre, Runner, type HTTPPayload } from "@chainlink/cre-sdk";
import { onHttpTrigger } from "./httpCallback";

export type WorkflowConfig = {
  auditAnchorContract: string;
  callbackBaseUrl: string;
  kmsEndpoint: string;
  claudeModel: string;
  chainSelectorName: string;
};

const initWorkflow = (config: WorkflowConfig) => {
  const httpCapability = new cre.capabilities.HTTPCapability();
  const httpTrigger = httpCapability.trigger({});

  return [cre.handler(httpTrigger, onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<WorkflowConfig>();
  await runner.run(initWorkflow);
}

main();
