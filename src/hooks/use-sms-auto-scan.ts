import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getSetting } from '@/lib/db/repos/settings-repo';
import { createSmsReader } from '@/lib/sms/reader';
import { scanSms } from '@/lib/sms/scan';
import { captureError } from '@/lib/telemetry';
import { useStore } from '@/store';

const ENABLED_KEY = 'sms_import_enabled';
// Don't re-scan more than once per this window even across rapid focus changes.
const MIN_INTERVAL_MS = 60_000;

/**
 * Incremental SMS scan on Ledger focus (roadmap §5.3.3 "incremental" mode).
 * No-ops unless the platform supports SMS, the user enabled import, and
 * permission is granted — so iOS/web and opted-out users pay nothing. Failures
 * are swallowed (graceful degradation if permission was revoked or the native
 * module is absent).
 */
export function useSmsAutoScan(): void {
  const db = useSQLiteContext();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const lastRun = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const now = Date.now();
        if (now - lastRun.current < MIN_INTERVAL_MS) return;
        try {
          if ((await getSetting(db, ENABLED_KEY)) !== 'true') return;
          const reader = createSmsReader();
          if (!reader.isSupported() || !(await reader.hasPermission())) return;
          lastRun.current = now;
          const res = await scanSms(db, reader, { now });
          if (!cancelled && res.inserted > 0) bumpDbVersion();
        } catch (err) {
          captureError(err, { feature: 'sms_auto_scan' });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, bumpDbVersion])
  );
}
