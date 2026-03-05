import pino from 'pino';
import { hashDecision } from '@trustledger/shared';
import { verifyWithKMS, getKMSKeyArn } from './kmsService';
import type {
  VerificationResult,
  VerificationOverall,
  HashMatchLayer,
  SignatureLayer,
  OnchainAnchorLayer,
} from '@trustledger/shared';

const log = pino({ name: 'verification-service' });

interface DecisionRecord {
  id: string;
  inputHash: string;
  signature: string | null;
  txHash: string | null;
  blockNumber: number | null;
  topFeatures: unknown;
  decisionType: string;
  outcome: string;
  confidence: string;
  modelId: string;
}

// ─── Layer 1: Hash verification ───────────────────────────────────────────────

async function verifyHashLayer(decision: DecisionRecord): Promise<HashMatchLayer> {
  const payload: Record<string, unknown> = {
    confidence: parseFloat(decision.confidence),
    decisionType: decision.decisionType,
    modelId: decision.modelId,
    outcome: decision.outcome,
    topFeatures: decision.topFeatures,
  };

  const computed = hashDecision(payload);
  const stored = decision.inputHash;
  const pass = computed === stored;

  if (!pass) {
    log.warn(
      { decisionId: decision.id, computed, stored },
      'Hash verification failed — payload mismatch',
    );
  }

  return { pass, computed, stored };
}

// ─── Layer 2: Signature verification ─────────────────────────────────────────

async function verifySignatureLayer(decision: DecisionRecord): Promise<SignatureLayer> {
  const kmsKeyArn = getKMSKeyArn();

  if (!decision.signature) {
    return { pass: false, algorithm: 'ECDSA_SHA_256', kmsKeyArn };
  }

  try {
    const pass = await verifyWithKMS(decision.inputHash, decision.signature);
    return { pass, algorithm: 'ECDSA_SHA_256', kmsKeyArn };
  } catch (err) {
    log.error({ err, decisionId: decision.id }, 'KMS verify call failed');
    return { pass: false, algorithm: 'ECDSA_SHA_256', kmsKeyArn };
  }
}

// ─── Layer 3: On-chain anchor verification ────────────────────────────────────

async function verifyOnchainLayer(decision: DecisionRecord): Promise<OnchainAnchorLayer> {
  const chain = 'sepolia';

  if (!decision.txHash) {
    return { pass: false, txHash: null, blockNumber: null, chain };
  }

  const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
  if (!etherscanApiKey) {
    log.warn('ETHERSCAN_API_KEY not set — skipping on-chain verification');
    return { pass: false, txHash: decision.txHash, blockNumber: decision.blockNumber, chain };
  }

  try {
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', '11155111');
    url.searchParams.set('module', 'transaction');
    url.searchParams.set('action', 'gettxreceiptstatus');
    url.searchParams.set('txhash', decision.txHash);
    url.searchParams.set('apikey', etherscanApiKey);

    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      throw new Error(`Etherscan returned HTTP ${resp.status}`);
    }

    const json = (await resp.json()) as {
      status: string;
      result: { status: string } | string;
    };

    // Etherscan returns status "1" (success) or "0" (fail/pending)
    const txStatus =
      typeof json.result === 'object' ? json.result.status : json.result;
    const pass = json.status === '1' && txStatus === '1';

    return {
      pass,
      txHash: decision.txHash,
      blockNumber: decision.blockNumber,
      chain,
    };
  } catch (err) {
    log.error({ err, decisionId: decision.id, txHash: decision.txHash }, 'Etherscan query failed');
    return {
      pass: false,
      txHash: decision.txHash,
      blockNumber: decision.blockNumber,
      chain,
    };
  }
}

// ─── Overall result computation ───────────────────────────────────────────────

function computeOverall(
  hashMatch: HashMatchLayer,
  signatureValid: SignatureLayer,
  onchainAnchor: OnchainAnchorLayer,
): VerificationOverall {
  const results = [hashMatch.pass, signatureValid.pass, onchainAnchor.pass];
  const passing = results.filter(Boolean).length;

  if (passing === 3) return 'PASS';
  if (passing === 0) return 'FAIL';
  return 'PARTIAL';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function verifyDecision(decision: DecisionRecord): Promise<VerificationResult> {
  log.info({ decisionId: decision.id }, 'Starting three-layer verification');

  // All three layers run independently — never skip any
  const [hashMatch, signatureValid, onchainAnchor] = await Promise.all([
    verifyHashLayer(decision),
    verifySignatureLayer(decision),
    verifyOnchainLayer(decision),
  ]);

  const overall = computeOverall(hashMatch, signatureValid, onchainAnchor);

  log.info(
    {
      decisionId: decision.id,
      overall,
      hashMatch: hashMatch.pass,
      signatureValid: signatureValid.pass,
      onchainAnchor: onchainAnchor.pass,
    },
    'Verification complete',
  );

  return {
    decisionId: decision.id,
    layers: { hashMatch, signatureValid, onchainAnchor },
    overall,
    verifiedAt: new Date().toISOString(),
  };
}
