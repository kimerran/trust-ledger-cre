import { createHash } from 'crypto';

/**
 * Produces a deterministic RFC 8785-style canonical JSON string.
 * Keys are sorted recursively so the output is always the same
 * regardless of insertion order.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalize(item));
    return '[' + items.join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalize(record[k]));
  return '{' + pairs.join(',') + '}';
}

/**
 * Hashes the input features payload of an AI decision.
 *
 * IMPORTANT: Only pass the input features — never the full DB row.
 * Fields like signature, txHash, and status must be excluded before
 * calling this function, as they are added after the decision is made
 * and would break verification if included in the hash.
 *
 * @param payload - The canonical input features object
 * @returns A SHA-256 hex digest prefixed with 'sha256:'
 */
export function hashDecision(payload: Record<string, unknown>): string {
  const canonical = canonicalize(payload);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return 'sha256:' + digest;
}
