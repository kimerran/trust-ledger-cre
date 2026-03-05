/**
 * Creates a standard HS256 JWT the Express API can verify with jsonwebtoken.
 * Uses Web Crypto API (available in both Edge and Node.js runtimes).
 * Extracted from apps/web/lib/auth.ts:9-32.
 */
export async function signApiToken(
  payload: Record<string, unknown>,
  secret: string,
  maxAgeSecs = 86400,
): Promise<string> {
  const enc = new TextEncoder();
  const toB64Url = (bytes: Uint8Array) => {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  const header = toB64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const body = toB64Url(enc.encode(JSON.stringify({ ...payload, iat: now, exp: now + maxAgeSecs })));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const rawSig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${toB64Url(new Uint8Array(rawSig))}`;
}
