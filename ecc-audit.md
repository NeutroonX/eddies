# ECC Audit — Eddies
**Date:** 2026-06-07
**Agents run:** `ecc:react-reviewer`, `ecc:typescript-reviewer`, `ecc:security-reviewer`, `ecc:refactor-cleaner`
**Overall verdict: FAIL — do not ship until all red items are resolved**

---

## Dead Code Removed (already applied, -415 lines net)

| File | What was removed |
|---|---|
| `src/constants/theme.ts` | Entire legacy `Colors`, `ThemeColor`, `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth` — never referenced; all code uses `EddiesColors*` tokens |
| `src/lib/analytics.ts` | 6 unused functions: `getVaultBalance`, `getPeriodSummary`, `getCategoryTops`, `getCapProgress` (single-cap), `getNetWorthSeries`, `assertIntelReconcilesLedger` + 6 unused Zod schema imports |
| `src/lib/schemas.ts` | Removed `SettingSchema`, `NetWorthPointSchema`, `CategoryTopSchema`, `PeriodSummarySchema`; converted `CategorySpend`, `InflowOutflow`, `DailyBurn`, `CapProgress` from Zod schemas to plain TS types |
| `src/lib/format.ts` | Removed `formatCurrency`, `formatPercentage`, duplicate `getCurrencySymbol` import |
| `src/lib/query-cache.ts` | Removed `getCached`, `setCached`, `invalidatePrefix` (only `clearCache` was used) |
| `src/lib/export.ts` | Removed `formatCurrencyForExport` |
| `src/lib/db/repos/budgets.ts` | Removed `getBudgetByCategoryAndPeriod` |
| `src/lib/db/repos/categories.ts` | Removed `getCategoryById` |
| `src/components/ui/metric-card.tsx` | Deleted — zero callers |
| `src/components/ui/net-worth-chart.tsx` | Deleted — zero callers |
| `src/components/ui/period-selector.tsx` | Deleted — zero callers |
| `src/app/(modals)/settings.tsx` | Removed `crashReportingEnabled` (read but never used), dead `toggleGrid`/`toggleCell`/`controlActive` stylesheet entries |
| `src/app/(modals)/vault.tsx` | Removed unused `flex` stylesheet entry |
| `src/app/(auth)/index.tsx` | Removed unused `accent` stylesheet entry |
| `src/app/(onboarding)/index.tsx` | Removed unused `cursor` stylesheet entry |
| `src/app/(tabs)/analyze.tsx` | Removed unused `EddiesFonts` import |

---

## Issues — Fix Immediately (block ship)

### SECURITY — CRIT-1: Live Sentry Auth Token in `.env.local`
**File:** `.env.local:31`
`SENTRY_AUTH_TOKEN` with scopes `project:releases`, `org:read`, `event:admin` is present on disk.
`.gitignore` covers the file but any accidental staging exposes it.

**Action:**
1. Rotate the token at sentry.io → User Settings → Auth Tokens.
2. Run `git log --all --oneline -p -- .env.local` to confirm never committed.
3. Store new token only via `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>`.
4. Delete `.env.local` locally after migration.

---

### SECURITY — CRIT-2: Column-Name SQL Injection in `updateAccount` / `updateCategory`
**Files:** `src/lib/db/repos/accounts.ts:41`, `src/lib/db/repos/categories.ts:43`

`Object.entries(data)` keys are interpolated directly into the SQL `SET` clause:
```ts
const set = entries.map(([k]) => `${k} = ?`).join(', ');
await db.runAsync(`UPDATE accounts SET ${set} WHERE id = ?`, ...);
```
Values are parameterized (safe). Column names are not. A caller passing an attacker-controlled key can inject arbitrary SQL into the column position.

**Fix:** Replace with an explicit allowlist:
```ts
const ALLOWED_COLS: Array<keyof NewAccount> = ['name', 'type', 'currency', 'opening_balance_minor', 'color'];
const updates: string[] = [];
const values: unknown[] = [];
for (const col of ALLOWED_COLS) {
  if (col in data) { updates.push(`${col} = ?`); values.push(data[col]); }
}
```
Apply the same pattern to `updateCategory`.

---

### SECURITY — CRIT-3: TOCTOU Race on Invite Code Redemption
**File:** `supabase/functions/validate-invite-code/index.ts:31–82`

Read → check → increment are three separate HTTP round-trips with no transaction. Two concurrent requests can both pass `uses_count >= max_uses` and both claim a single-use code.

**Fix:** Replace with one atomic Postgres update:
```sql
UPDATE invite_codes
SET uses_count = uses_count + 1,
    is_active = CASE WHEN uses_count + 1 >= max_uses THEN false ELSE is_active END
WHERE code = $1
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_uses IS NULL OR uses_count < max_uses)
RETURNING *;
```
Zero rows returned = invalid/exhausted code.

---

### REACT — H1: `useRef().current` Accessed During Render (6 locations)
**File:** `src/app/(onboarding)/index.tsx:76–78, 124–125, 149–150, 174, 195–196, 238–241, 342–343, 482–484`

```ts
const opacity = useRef(new Animated.Value(0)).current  // ❌ .current in render body
```
Produces 6 CI-blocking `react-hooks/refs` lint errors. Defeats Concurrent Mode guarantees and Fast Refresh.

**Fix:** Deref inside `useEffect` only:
```ts
const opacityRef = useRef(new Animated.Value(0));
useEffect(() => {
  Animated.timing(opacityRef.current, { ... }).start();
}, []);
```

---

### TYPESCRIPT — H1: `z.array(z.any())` in Backup Restore Drives SQL Inserts
**File:** `src/lib/backup.ts:27`

```ts
monthly_archives: z.array(z.any()).optional(),
```
Each element's fields are spread directly as SQL bind parameters in `restoreBackup` with zero field-level validation. A crafted backup file can insert garbage data or panic the SQLite driver.

**Fix:**
```ts
const MonthlyArchiveRowSchema = z.object({
  id: z.string(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  label: z.string().max(20),
  total_inflow: z.number().int().nonnegative(),
  total_outflow: z.number().int().nonnegative(),
  tx_count: z.number().int().nonnegative(),
  exported_csv: z.number().int(),
  exported_pdf: z.number().int(),
  archived_at: z.number().int().nullable(),
});
// replace z.any() with MonthlyArchiveRowSchema
```

---

### TYPESCRIPT — H2: `useReduceMotion` Polls Wrong API
**File:** `src/hooks/use-reduce-motion.ts:7`

```ts
AccessibilityInfo.isScreenReaderEnabled().then(...)  // ❌ wrong
```
A user with VoiceOver on but no reduce-motion preference gets motion disabled. A user with reduce-motion on but no screen reader does not.

**Fix:**
```ts
AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
// subscribe to 'reduceMotionChanged' not 'screenReaderChanged'
```

---

## Issues — Fix Before Shipping Analytics / Settings

### TYPESCRIPT — H3: Missing `firstDayOfWeek` in `useCallback` Deps
**File:** `src/app/(tabs)/analyze.tsx:91`

`loadData` closes over `firstDayOfWeek` from the store but the dep array is `[activePeriod, db]`. After the user changes week-start day in settings and returns, the period range is computed with the stale value.

**Fix:** Add `firstDayOfWeek` to the `useCallback` dep array.

---

### TYPESCRIPT — H4: `Promise.all` Without `.catch` in `loadData`
**File:** `src/app/(tabs)/analyze.tsx:79–91`

If any of the four analytics queries reject, the rejection is silently dropped — no toast, no Sentry event, UI shows stale zeros.

**Fix:** Append `.catch((err) => captureError(err))` or convert to `async`/`try-catch`.

---

### TYPESCRIPT — H5: `setLoading(false)` Never Called on Rejection
**Files:** `src/app/(modals)/vault.tsx:27`, `src/app/(modals)/entry.tsx:59`

```ts
getAccountById(db, id).then(acc => {
  setInitialData(acc);
  setLoading(false);
}).catch(console.error);  // setLoading never called on error path
```
Modal stays in permanent loading state on any DB error.

**Fix:** Move `setLoading(false)` into a `finally` block.

---

### REACT — H2: Derived State Written in `useEffect`
**File:** `src/app/(modals)/entry.tsx:63–65`

```ts
useEffect(() => {
  if (!isEditMode && !vaultId && accounts.length > 0) setVaultId(accounts[0].id);
}, [accounts, vaultId, isEditMode]);
```
Causes an extra render cycle. `vaultId` in the dep array creates a self-referential dependency.

**Fix:** Compute during render:
```ts
const effectiveVaultId = vaultId ?? (!isEditMode && accounts.length > 0 ? accounts[0].id : null);
```

---

### REACT — H3: Module-Level Mutable `toastTimer`
**File:** `src/store/ui.ts:8`

```ts
let toastTimer: ReturnType<typeof setTimeout> | undefined;
```
Shared across all renders and hot-reload boundaries. Two concurrent `showToast` calls clobber the timer reference — previous `clearTimeout` is skipped.

**Fix:** Move timer ID into a Zustand slice field and clear via `get()` inside the action.

---

### SECURITY — H2: `currencySymbol` Not Escaped in HTML Export
**File:** `src/lib/archive.ts:234–236`

All other user-controlled fields are wrapped in `escapeHtml()` but `currencySymbol` is interpolated raw. If symbol is ever user-controlled a script tag executes when the report opens in a browser.

**Fix:**
```ts
`+${escapeHtml(currencySymbol)}${(totalIn / 100).toFixed(2)}`
```

---

## Issues — Fix Before Wider Rollout

### SECURITY
| File | Issue | Fix |
|---|---|---|
| Both Edge Functions | `CORS: *` — `request-access` is exploitable as a free email relay | Add anon JWT check + rate limit |
| `src/lib/telemetry.ts:43` | `scrubFinancialKeys` not applied to `beforeSendTransaction` — route params leak in perf traces | Add `beforeSendTransaction` hook |
| Multiple repos (`genId`) | `Math.random()` for primary keys (~26 bits entropy) | Replace with `Crypto.randomUUID()` |
| `src/lib/backup.ts:60` | Zod errors leak schema structure via `throw new Error(\`...: ${err}\`)` | Sanitize: `throw new Error('Invalid backup file — check format and version.')` |
| `src/app/(auth)/index.tsx` | No cooldown on failed invite code attempts | Disable button 2–3s after each failure; add server-side rate limit |
| `src/lib/supabase.ts:12–13` | `persistSession: false` / `autoRefreshToken: false` — **must** be updated before OAuth is wired | Set both to `true` and provide MMKV storage adapter when wiring OAuth |

### TYPESCRIPT
| File | Line | Issue | Fix |
|---|---|---|---|
| `src/lib/archive.ts` | 72 | `getAllAsync<any>` — no type safety on archive rows | Use typed row interface or `MonthlyArchiveRowSchema` |
| `src/app/(tabs)/settings.tsx` | 77 | `router.push(path as any)` bypasses typed routing | Type `path` as `Href` from `expo-router` |
| `src/app/(onboarding)/index.tsx` | 487 | `setSetting` failure swallowed, navigation proceeds | Let error propagate or show toast before navigating |
| `src/app/(modals)/cap.tsx` | 141 | Hardcoded `$` instead of `useCurrencySymbol()` | Replace with `useCurrencySymbol()` |
| `src/components/vaults/vault-form.tsx` | 23 | `as any` on `PRESET_TYPES.includes()` | Use `(PRESET_TYPES as readonly string[]).includes(...)` |
| `src/app/(modals)/archive.tsx` | 37 | `.then()` without `.catch` on `getPendingMonths` | Append `.catch(() => showToast('Failed to load month data', 'err'))` |

### REACT
| File | Issue | Fix |
|---|---|---|
| `src/components/ledger/entry-row.tsx`, `vault-card.tsx` | Swipe is the only path to edit/delete — inaccessible to motor-impaired users | Add long-press context menu with Edit / Delete options |
| Multiple `Pressable` elements | Missing `accessibilityRole="button"` and `accessibilityLabel` | Add to all bare interactive `Pressable` components |
| `src/app/(modals)/settings.tsx:31–49` | Redundant SQLite re-read on every modal open — settings already in Zustand | Remove `useEffect`, read from store directly |
| `src/app/(tabs)/index.tsx:246` | Inline `renderItem` / `ItemSeparatorComponent` arrow fns defeat SectionList memoization | Extract to `useCallback` or module-scope stable refs |
| `src/app/(onboarding)/index.tsx` | Uses JS-thread `Animated` API — jank risk on first launch; rest of app uses Reanimated | Migrate entrance animations to `useSharedValue` + Reanimated |
| `src/app/(tabs)/settings.tsx:55` | `loadStats` fires twice concurrently (`useFocusEffect` + `useEffect([dbVersion])`) | Remove `useFocusEffect`, rely solely on `useEffect([dbVersion, loadStats])` |
| `_layout.tsx:120` | 5 separate `useStore` subscriptions in `BiometricGate` — re-renders on each field change | Use single `useShallow` selector |

### CONFIG
| Issue | Fix |
|---|---|
| `eslint-plugin-jsx-a11y` not installed — a11y linting completely blind | `npm install -D eslint-plugin-jsx-a11y` and add to `eslint.config.js` |
| Duplicate `react` / `expo-router` imports in `_layout.tsx` | Deduplicate |
| `src/app/(modals)/settings.tsx` — `setTelemetryEnabled` and `crashReportingEnabled` imported but unused | Remove dead imports |

---

## Positive Findings (confirmed correct)

- All SQLite queries use parameterized bindings throughout — no string-concatenated SQL (except the column-name vector in CRIT-2)
- `SERVICE_ROLE_KEY` accessed only server-side in Edge Functions, never in client
- `invite_codes` table has RLS enabled with default-deny
- CSV export has formula-injection guard via `csvCell()` (`=+-@\t\r` prefix check)
- HTML export escapes all user-controlled string fields via `escapeHtml()` (except `currencySymbol` — see H2)
- Sentry `scrubFinancialKeys` runs on `beforeSend` and always deletes `event.user`
- No `WebView`, `dangerouslySetInnerHTML`, `eval()`, or `new Function()` anywhere in the codebase
- No third-party AI API keys in the client bundle
- Zod validation on every external data boundary (Supabase edge function responses, SQLite repo layer)
- Biometric lock uses OS biometric API; no biometric data stored by the app
- Invite validation (`src/lib/invite.ts`) is correctly implemented with Zod parsing
- TypeScript build: **clean — zero errors**
