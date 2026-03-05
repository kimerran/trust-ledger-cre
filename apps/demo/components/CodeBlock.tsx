'use client';

interface CodeBlockProps {
  title?: string;
  language?: string;
  children: string;
}

export function CodeBlock({ title, language = 'json', children }: CodeBlockProps) {
  return (
    <div className="rounded-md border bg-muted/50 overflow-hidden">
      {title && (
        <div className="px-3 py-1.5 border-b bg-muted text-xs font-medium text-muted-foreground">
          {title} {language && <span className="opacity-60">({language})</span>}
        </div>
      )}
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
