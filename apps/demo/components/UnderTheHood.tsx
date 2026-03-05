'use client';

import { useState } from 'react';

interface UnderTheHoodProps {
  children: React.ReactNode;
}

export function UnderTheHood({ children }: UnderTheHoodProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Under the Hood</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
