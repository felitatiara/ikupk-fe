'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfigDomain =
  | 'indikator'
  | 'cascade'
  | 'target'
  | 'baseline'
  | 'user'
  | 'disposisi';

export type ConfigAction = 'created' | 'updated' | 'deleted' | 'bulk';

export interface ConfigEvent {
  domain: ConfigDomain;
  action: ConfigAction;
  id?: number;
  meta?: Record<string, unknown>;
  actorId?: number;
  timestamp: string;
}

type EventHandler = (event: ConfigEvent) => void;
type Unsubscribe = () => void;

interface ConfigSyncContextValue {
  /** True while the SSE connection is open. */
  connected: boolean;
  /** Subscribe to events for a specific domain (or '*' for all). Returns an unsubscribe fn. */
  subscribe: (domain: ConfigDomain | '*', handler: EventHandler) => Unsubscribe;
  /** The most recently received event, or null before the first event. */
  lastEvent: ConfigEvent | null;
}

// ── Toast labels ──────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<ConfigDomain, string> = {
  indikator: 'Indikator',
  cascade:   'Alur Disposisi',
  target:    'Target',
  baseline:  'Data Baseline',
  user:      'Data Pengguna',
  disposisi: 'Disposisi',
};

const ACTION_LABEL: Record<ConfigAction, string> = {
  created: 'ditambahkan',
  updated: 'diperbarui',
  deleted: 'dihapus',
  bulk:    'diperbarui (massal)',
};

// ── Context ───────────────────────────────────────────────────────────────────

const ConfigSyncContext = createContext<ConfigSyncContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const SSE_URL = `${API_BASE_URL}/events/stream`;
const MAX_BACKOFF_MS = 30_000;

export function ConfigSyncProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ConfigEvent | null>(null);

  // Stable ref to handler sets — keyed by domain (or '*' for wildcard).
  const handlersRef = useRef<Map<ConfigDomain | '*', Set<EventHandler>>>(new Map());

  // SSE and reconnect references that must survive re-renders.
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1_000);

  // ── Pub/sub ───────────────────────────────────────────────────────────────

  const subscribe = useCallback(
    (domain: ConfigDomain | '*', handler: EventHandler): Unsubscribe => {
      if (!handlersRef.current.has(domain)) {
        handlersRef.current.set(domain, new Set());
      }
      handlersRef.current.get(domain)!.add(handler);
      return () => {
        handlersRef.current.get(domain)?.delete(handler);
      };
    },
    [],
  );

  // Stable dispatcher — always reads the latest handlers from the ref.
  const dispatch = useCallback((event: ConfigEvent) => {
    setLastEvent(event);
    handlersRef.current.get(event.domain)?.forEach(h => h(event));
    handlersRef.current.get('*')?.forEach(h => h(event));
  }, []);

  // ── Connection management ─────────────────────────────────────────────────

  const connect = useCallback(() => {
    // Close any existing connection before opening a new one.
    esRef.current?.close();

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      backoffRef.current = 1_000; // reset on successful connect
    };

    // Named 'config' event — emitted by the backend for every mutation.
    es.addEventListener('config', (e: MessageEvent) => {
      try {
        const event: ConfigEvent = JSON.parse(e.data);
        dispatch(event);
        // Only show toast to the user who made the change.
        let currentUserId: number | undefined;
        try {
          const stored = sessionStorage.getItem('user');
          if (stored) currentUserId = JSON.parse(stored)?.id;
        } catch { /* ignore */ }
        const isActor = event.actorId !== undefined && currentUserId !== undefined && event.actorId === currentUserId;
        if (isActor) {
          toast.info(
            `${DOMAIN_LABEL[event.domain] ?? event.domain} telah ${ACTION_LABEL[event.action] ?? event.action}`,
            {
              description: 'Klik untuk melihat perubahan terbaru.',
              duration: 4_000,
            },
          );
        }
      } catch {
        // Malformed payload — ignore silently.
      }
    });

    // 'heartbeat' events (every 25 s) keep the connection alive — no action needed.
    es.addEventListener('heartbeat', () => { /* no-op */ });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      // Exponential back-off reconnect (1 s → 2 s → 4 s … capped at 30 s).
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      timerRef.current = setTimeout(connect, delay);
    };
  }, [dispatch]);

  // Open connection once on mount; clean up on unmount.
  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  return (
    <ConfigSyncContext.Provider value={{ connected, subscribe, lastEvent }}>
      {children}
    </ConfigSyncContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfigSync(): ConfigSyncContextValue {
  const ctx = useContext(ConfigSyncContext);
  if (!ctx) throw new Error('useConfigSync must be used within <ConfigSyncProvider>');
  return ctx;
}
