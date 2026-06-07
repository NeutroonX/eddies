import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Module-level flag — updated once preferences load from DB.
// Optimistic default: enabled until the user explicitly opts out.
let _enabled = true;

// Keys that might appear in error extras/contexts that could carry financial data.
const FINANCIAL_KEY_FRAGMENTS = [
  'amount', 'balance', 'minor', 'account', 'vault',
  'transaction', 'category', 'currency', 'inflow', 'outflow',
];

function scrubFinancialKeys(extra: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    const lower = k.toLowerCase();
    if (!FINANCIAL_KEY_FRAGMENTS.some((frag) => lower.includes(frag))) {
      safe[k] = v;
    }
  }
  return safe;
}

/**
 * Call once at module load time (before React renders) in _layout.tsx.
 * No-ops gracefully when EXPO_PUBLIC_SENTRY_DSN is absent (e.g. local dev).
 */
export function initTelemetry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? 0);

  Sentry.init({
    dsn,
    release: `com.eddies.app@${appVersion}+${buildNumber}`,
    dist: buildNumber,
    // Sample 15% of sessions for performance traces — enough signal, low overhead.
    tracesSampleRate: 0.15,
    environment: __DEV__ ? 'development' : 'production',
    // Skip sending in dev by default; DSN still initialises the SDK for native crash setup.
    enabled: !__DEV__,
    beforeSend(event) {
      if (!_enabled) return null;
      if (event.extra) {
        event.extra = scrubFinancialKeys(event.extra as Record<string, unknown>);
      }
      // Auth is handled by OAuth providers — never forward identity to Sentry.
      delete event.user;
      return event;
    },
    beforeSendTransaction(event) {
      if (!_enabled) return null;
      if (event.extra) {
        event.extra = scrubFinancialKeys(event.extra as Record<string, unknown>);
      }
      delete event.user;
      return event;
    },
  });
}

/** Called from useInitSettings once the user's preference is loaded from DB. */
export function setTelemetryEnabled(enabled: boolean): void {
  _enabled = enabled;
}

/** Safe error capture — silently no-ops when opted out or Sentry not inited. */
export function captureError(error: unknown, context?: Record<string, string>): void {
  if (!_enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
