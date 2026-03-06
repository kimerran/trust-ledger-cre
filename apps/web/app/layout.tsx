import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'] });

export const metadata: Metadata = {
  title: {
    default: 'TrustLedger',
    template: '%s | TrustLedger',
  },
  description: 'Cryptographic audit trail for AI decisions — powered by Chainlink CRE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <SessionProvider>
          <div className="min-h-screen bg-background">
            <nav className="border-b">
              <div className="container flex h-16 items-center gap-6">
                <a href="/dashboard" className="font-semibold text-lg">
                  TrustLedger
                </a>
                <div className="flex gap-4 text-sm">
                  <a href="/dashboard" className="text-muted-foreground hover:text-foreground">
                    Dashboard
                  </a>
                  <a href="/audit" className="text-muted-foreground hover:text-foreground">
                    Audit
                  </a>
                  <a href="/models" className="text-muted-foreground hover:text-foreground">
                    Models
                  </a>

                </div>
              </div>
            </nav>
            <main className="container py-8">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
