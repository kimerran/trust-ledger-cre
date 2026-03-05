export { auth as middleware } from './lib/auth';

export const config = {
  matcher: [
    // Protect all routes except login, public verify page, and Next.js internals
    '/((?!login|verify|_next/static|_next/image|favicon.ico).*)',
  ],
};
