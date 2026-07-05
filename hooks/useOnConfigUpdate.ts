'use client';

import { useEffect, useRef } from 'react';
import { useConfigSync, ConfigDomain, ConfigEvent } from '@/context/ConfigSyncContext';

/**
 * Subscribe to real-time config-sync events for one or more domains.
 *
 * Uses a ref-wrapped callback so the subscription is not re-registered every
 * render — only when `domains` changes (which it typically never does after mount).
 *
 * @example
 * // Refresh indikator data whenever the admin updates it
 * useOnConfigUpdate(['indikator', 'cascade'], () => setRefreshKey(k => k + 1));
 *
 * @example
 * // Listen to every domain
 * useOnConfigUpdate('*', (event) => console.log(event));
 */
export function useOnConfigUpdate(
  domains: ConfigDomain | ConfigDomain[] | '*',
  callback: (event: ConfigEvent) => void,
): void {
  const { subscribe } = useConfigSync();

  // Keep the latest callback in a ref so we never need to re-subscribe when
  // the parent re-renders with a new inline function reference.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const targets: (ConfigDomain | '*')[] =
      domains === '*'
        ? ['*']
        : Array.isArray(domains)
          ? domains
          : [domains as ConfigDomain];

    // Stable handler that always delegates to the current callback ref.
    const stable = (event: ConfigEvent) => callbackRef.current(event);

    const unsubscribes = targets.map(d => subscribe(d, stable));
    return () => unsubscribes.forEach(u => u());

    // `subscribe` is stable (useCallback []). `domains` intentionally omitted
    // from deps — treat it as immutable after mount (pass a literal array).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);
}
