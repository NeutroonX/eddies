/**
 * Play-compliant SMS capture via the Android share sheet (Phase 3).
 *
 * The user long-presses a bank/UPI SMS → Share → Eddies. The OS hands us the
 * raw text (no READ_SMS, no notification listener — outside the Play Protect
 * fraud bucket), which we feed through the same parser/dedup pipeline as the
 * internal pull path via `ingestRawSms`. See docs/sms-play-compliance-plan.md.
 */
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useShareIntentContext } from 'expo-share-intent';

import type { RawSms } from '@/lib/sms/parser';
import { ingestRawSms } from '@/lib/sms/scan';
import { captureError } from '@/lib/telemetry';
import { useStore } from '@/store';

export function useSmsShareIntent(): void {
  const db = useSQLiteContext();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const bumpDbVersion = useStore((s) => s.bumpDbVersion);
  const showToast = useStore((s) => s.showToast);

  // Tracks the most recent intent so the ingest effect's finally can tell "a
  // newer share arrived" (skip reset, the new run owns it) from "unmounted"
  // (still our intent → reset, else it re-fires this effect on next mount).
  // Mirrored via an effect, not during render (react-hooks/refs); this runs
  // after the ingest effect's setup, so a superseding intent updates the ref
  // before the old in-flight run reaches its finally.
  const latestIntentRef = useRef(shareIntent);
  useEffect(() => {
    latestIntentRef.current = shareIntent;
  }, [shareIntent]);

  useEffect(() => {
    if (!hasShareIntent) return;

    const body = shareIntent.text?.trim();
    // Only text shares are transactions; ignore media/file shares outright.
    if (shareIntent.type !== 'text' || !body) {
      resetShareIntent();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Shared text carries no reliable sender; the parser derives the bank
        // hint from the body, so an empty address is fine. `date` is only a
        // fallback — the parser prefers the timestamp inside the message body.
        const raw: RawSms = {
          address: shareIntent.meta?.title ?? '',
          body,
          date: Date.now(),
        };
        const res = await ingestRawSms(db, [raw], { source: 'push' });
        if (cancelled) return;
        bumpDbVersion();
        if (res.inserted > 0) {
          showToast('Transaction captured — review it', 'ok');
          router.push('/(modals)/import-inbox');
        } else {
          showToast('No transaction found in that message', 'err');
        }
      } catch (err) {
        captureError(err, { feature: 'sms_share_intent' });
        if (!cancelled) showToast('Could not read shared message', 'err');
      } finally {
        // Reset unless a newer share intent has already arrived (that run owns
        // the reset). On unmount the ref still equals our captured intent, so we
        // reset here — otherwise the stale intent re-fires this effect on the
        // next mount and reports a false "no transaction" for an already-captured
        // message. ingestRawSms isn't aborted by `cancelled`, so the row is in.
        if (latestIntentRef.current === shareIntent) resetShareIntent();
      }
    })();

    return () => {
      cancelled = true;
    };
    // resetShareIntent is intentionally omitted: expo-share-intent does not
    // memoize it, so including it re-fires this effect (and re-ingests) on
    // every provider render. It only wraps a stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, shareIntent, db, bumpDbVersion, showToast]);
}
