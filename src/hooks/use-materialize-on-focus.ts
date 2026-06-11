import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { materializeDueRules } from '@/lib/recurring/materialize';
import { useStore } from '@/store';

// Module-level watermark: debounce the pass to at most once per interval per
// app session. Idempotency is guaranteed by each rule's DB watermark, so a
// skipped run is harmless — this only avoids thrashing on rapid refocus.
let lastPassAt = 0;
const MIN_INTERVAL_MS = 60_000;

/**
 * Runs the recurring materialization pass when the host screen gains focus.
 * Mount once (Ledger). Bumps dbVersion if anything was auto-posted so other
 * screens reload via the existing cross-screen invalidation.
 */
export function useMaterializeOnFocus() {
  const db = useSQLiteContext();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastPassAt < MIN_INTERVAL_MS) return;
      lastPassAt = now;

      let cancelled = false;
      materializeDueRules(db, now)
        .then(result => {
          if (!cancelled && result.autoPosted > 0) bumpDbVersion();
        })
        .catch(err => {
          // Never let a scheduling failure break the screen.
          lastPassAt = 0; // allow a retry on next focus
          console.error('materializeDueRules failed:', err);
        });

      return () => {
        cancelled = true;
      };
    }, [db, bumpDbVersion])
  );
}
