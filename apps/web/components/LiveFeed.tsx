'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useDecisionStore } from '../stores/useDecisionStore';
import type { SSEEvent } from '@trustledger/shared';
import { Badge } from './ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LiveFeed() {
  const { data: session } = useSession();
  const { liveEvents, isConnected, addLiveEvent, setConnected } = useDecisionStore();

  useEffect(() => {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    const es = new EventSource(`${API_BASE}/events?token=${encodeURIComponent(token)}`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent;
        addLiveEvent(event);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [session, addLiveEvent, setConnected]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        {isConnected ? 'Live' : 'Disconnected'}
      </div>

      {liveEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Waiting for events…</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {liveEvents.map((evt, i) => (
            <li key={i} className="flex items-start gap-3 text-sm border-b pb-2">
              <Badge variant="secondary" className="shrink-0 text-xs">
                {evt.type}
              </Badge>
              <div className="flex-1 min-w-0">
                <pre className="text-xs text-muted-foreground truncate">
                  {JSON.stringify(evt.data)}
                </pre>
              </div>
              <time className="text-xs text-muted-foreground shrink-0">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
