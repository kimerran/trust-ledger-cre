import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TrustLedger Demo',
  description: 'Interactive walkthrough of the AI decision audit trail pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b bg-card">
          <div className="container flex h-14 items-center px-4">
            <span className="text-lg font-bold tracking-tight">
              TrustLedger <span className="text-muted-foreground font-normal text-sm ml-1">DEMO</span>
            </span>
          </div>
        </nav>
        <main className="container mx-auto max-w-4xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
