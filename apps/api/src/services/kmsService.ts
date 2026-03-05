import { KMSClient, SignCommand, VerifyCommand } from '@aws-sdk/client-kms';
import { createSign, createVerify, generateKeyPairSync } from 'crypto';
import pino from 'pino';

const log = pino({ name: 'kms-service' });

// ─── Dev fallback key (generated once per process) ────────────────────────────
// TODO: replace with KMS in production
let devPrivateKey: string | null = null;
let devPublicKey: string | null = null;

function getDevKeys(): { privateKey: string; publicKey: string } {
  if (!devPrivateKey || !devPublicKey) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    devPrivateKey = privateKey;
    devPublicKey = publicKey;
    log.warn('Using ephemeral local ECDSA key — NOT suitable for production');
  }
  return { privateKey: devPrivateKey!, publicKey: devPublicKey! };
}

// ─── KMS client (lazy init) ───────────────────────────────────────────────────

let kmsClient: KMSClient | null = null;

function getKMSClient(): KMSClient {
  if (!kmsClient) {
    if (!process.env.AWS_REGION) throw new Error('AWS_REGION is required');
    kmsClient = new KMSClient({ region: process.env.AWS_REGION });
  }
  return kmsClient;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Signs the given hash string using AWS KMS (ECDSA_SHA_256).
 * In development (NODE_ENV !== 'production'), falls back to a local ECDSA key.
 *
 * @param hashHex - The 'sha256:...' prefixed hex string to sign
 * @returns Base64-encoded DER signature
 */
export async function signWithKMS(hashHex: string): Promise<string> {
  if (process.env.NODE_ENV !== 'production') {
    return signWithLocalKey(hashHex);
  }

  const kmsKeyArn = process.env.KMS_KEY_ARN;
  if (!kmsKeyArn) throw new Error('KMS_KEY_ARN is required in production');

  const client = getKMSClient();
  // Pass the raw UTF-8 bytes of the hash string. KMS will SHA-256 internally.
  const message = Buffer.from(hashHex, 'utf-8');

  const response = await client.send(
    new SignCommand({
      KeyId: kmsKeyArn,
      Message: message,
      MessageType: 'RAW', // KMS will SHA-256 internally
      SigningAlgorithm: 'ECDSA_SHA_256',
    }),
  );

  if (!response.Signature) throw new Error('KMS returned no signature');
  return Buffer.from(response.Signature).toString('base64');
}

/**
 * Verifies a KMS signature against the original hash string.
 * In development, uses the local ECDSA key.
 *
 * @param hashHex - The 'sha256:...' prefixed hash string that was signed
 * @param signatureBase64 - The base64 signature to verify
 * @returns true if the signature is valid
 */
export async function verifyWithKMS(hashHex: string, signatureBase64: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    return verifyWithLocalKey(hashHex, signatureBase64);
  }

  const kmsKeyArn = process.env.KMS_KEY_ARN;
  if (!kmsKeyArn) throw new Error('KMS_KEY_ARN is required in production');

  const client = getKMSClient();
  const message = Buffer.from(hashHex, 'utf-8');
  const signature = Buffer.from(signatureBase64, 'base64');

  try {
    const response = await client.send(
      new VerifyCommand({
        KeyId: kmsKeyArn,
        Message: message,
        MessageType: 'RAW',
        Signature: signature,
        SigningAlgorithm: 'ECDSA_SHA_256',
      }),
    );
    return response.SignatureValid === true;
  } catch (err) {
    log.warn({ err }, 'KMS signature verification failed');
    return false;
  }
}

export function getKMSKeyArn(): string {
  return process.env.KMS_KEY_ARN ?? 'local-dev-key';
}

// ─── Dev fallback implementations ────────────────────────────────────────────

// TODO: replace with KMS in production
function signWithLocalKey(hashHex: string): string {
  const { privateKey } = getDevKeys();
  const sign = createSign('SHA256');
  sign.update(hashHex, 'utf-8');
  sign.end();
  return sign.sign(privateKey).toString('base64');
}

// TODO: replace with KMS in production
function verifyWithLocalKey(hashHex: string, signatureBase64: string): boolean {
  const { publicKey } = getDevKeys();
  try {
    const verify = createVerify('SHA256');
    verify.update(hashHex, 'utf-8');
    verify.end();
    return verify.verify(publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}
