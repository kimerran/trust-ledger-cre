import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

/**
 * Creates a standard HS256 JWT the Express API can verify with jsonwebtoken.
 * Uses Web Crypto API (available in both Edge and Node.js runtimes).
 */
async function signApiToken(
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

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Demo users — replace with real DB lookup in production
        const demoUsers: Record<string, { password: string; tenantId: string; name: string }> = {
          'demo@trustledger.io': {
            password: 'demo1234',
            tenantId: '00000000-0000-0000-0000-000000000001',
            name: 'Demo User',
          },
          'admin@trustledger.io': {
            password: 'admin1234',
            tenantId: '00000000-0000-0000-0000-000000000001',
            name: 'Admin',
          },
        };

        const user = demoUsers[email];
        if (!user || user.password !== password) return null;

        return {
          id: email,
          email,
          name: user.name,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = (user as { tenantId?: string }).tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { tenantId?: string }).tenantId = token.tenantId as string;
      }
      // Mint an HS256 JWT the Express API can verify with jwt.verify(token, NEXTAUTH_SECRET).
      // NextAuth v5 internally uses JWE (encrypted), which jsonwebtoken cannot parse — so we
      // generate a separate signed token here using the same shared secret.
      const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
      (session as { accessToken?: string }).accessToken = await signApiToken(
        { sub: token.sub ?? '', tenantId: token.tenantId },
        secret,
      );
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
