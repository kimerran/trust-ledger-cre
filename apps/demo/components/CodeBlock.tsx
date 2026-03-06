'use client';

import { useState } from 'react';

interface CodeBlockProps {
  title?: string;
  language?: string;
  children: string;
  copyButton?: boolean;
}

export function CodeBlock({ title, language = 'json', children, copyButton = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border bg-muted/50 overflow-hidden">
      {(title || copyButton) && (
        <div className="px-3 py-1.5 border-b bg-muted text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>
            {title} {language && <span className="opacity-60">({language})</span>}
          </span>
          {copyButton && (
            <button
              onClick={handleCopy}
              className="px-2 py-0.5 rounded text-[10px] font-medium border bg-background hover:bg-accent transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
