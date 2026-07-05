'use client';

import { useConfigSync } from '@/context/ConfigSyncContext';

/**
 * Tiny colored dot that reflects the real-time SSE connection state.
 *   Green  — connected and receiving events
 *   Amber  — reconnecting (disconnected or first-connect pending)
 *
 * Drop it anywhere in the layout / nav bar as a subtle live-sync indicator.
 */
export function SyncStatusDot({ className }: { className?: string }) {
  const { connected } = useConfigSync();

  return (
    <span
      className={className}
      title={connected ? 'Real-time sync aktif' : 'Menghubungkan ke server…'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: connected ? '#22c55e' : '#f59e0b',
        boxShadow: connected
          ? '0 0 0 3px rgba(34,197,94,0.20)'
          : '0 0 0 3px rgba(245,158,11,0.20)',
        transition: 'background 0.4s, box-shadow 0.4s',
      }}
    />
  );
}
