import { ethers } from 'ethers';
import pino from 'pino';

const log = pino({ name: 'anchor-service' });

const AUDIT_ANCHOR_ABI = [
  'function anchorDecision(string decisionId, bytes32 hash, string signature, string riskJson) external',
  'function isAnchored(string decisionId) external view returns (bool)',
  'function getAnchor(string decisionId) external view returns (tuple(bytes32 hash, string signature, string riskJson, uint256 timestamp, address anchorer))',
] as const;

interface AnchorParams {
  decisionId: string;
  inputHash: string;      // "sha256:<hex>"
  signature: string;
  riskJson: string;
}

interface AnchorResult {
  txHash: string;
  blockNumber: number;
}

function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.ALCHEMY_RPC_URL;
  if (!rpcUrl) throw new Error('ALCHEMY_RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpcUrl, {
    name: 'sepolia',
    chainId: 11155111,
  });
}

function getSigner(): ethers.Wallet {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not configured');
  return new ethers.Wallet(privateKey, getProvider());
}

function getContract(): ethers.Contract {
  const address = process.env.AUDIT_ANCHOR_CONTRACT;
  if (!address) throw new Error('AUDIT_ANCHOR_CONTRACT not configured');
  return new ethers.Contract(address, AUDIT_ANCHOR_ABI, getSigner());
}

/**
 * Convert a "sha256:<hex>" hash string to bytes32 for the contract.
 * The contract expects a bytes32 (32 bytes), so we take the hex portion
 * of the sha256 hash and pad/truncate to 32 bytes.
 */
function hashToBytes32(inputHash: string): string {
  const hex = inputHash.replace(/^sha256:/, '');
  if (hex.length !== 64) {
    throw new Error(`Invalid hash length: expected 64 hex chars, got ${hex.length}`);
  }
  return '0x' + hex;
}

export async function anchorDecisionOnChain(params: AnchorParams): Promise<AnchorResult> {
  const { decisionId, inputHash, signature, riskJson } = params;

  log.info({ decisionId }, 'Anchoring decision on Sepolia');

  const contract = getContract();
  const hashBytes32 = hashToBytes32(inputHash);

  const tx = await contract.anchorDecision(decisionId, hashBytes32, signature, riskJson);
  log.info({ decisionId, txHash: tx.hash }, 'Transaction submitted, waiting for confirmation');

  const receipt = await tx.wait(1);

  const result: AnchorResult = {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };

  log.info({ decisionId, ...result }, 'Decision anchored on Sepolia');
  return result;
}

export async function isDecisionAnchored(decisionId: string): Promise<boolean> {
  const contract = getContract();
  return contract.isAnchored(decisionId);
}
