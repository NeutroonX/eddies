# EDDIES — Launch Readiness Audit

> Full-codebase scan for ship-blocking bugs, data-integrity risks, memory leaks,
> security gaps, performance, and store-submission requirements.
> Generated 2026-06-06 against `main` @ `2960f44`.
>
> Legend: **P0** = blocks launch / build is red · **P1** = ships broken behaviour or data loss
> **P2** = leaks / lifecycle / robustness · **P3** = polish & nice-to-have · **INFRA** = release plumbing.

---

## 0. TL;DR — the critical path to v1

1. **The build does not pass `tsc`** — 7 type errors. Fix these first (§1).
2. **Backup, Restore, and Export write no files** — buttons show "success" but nothing leaves the app (§2.1–2.2). Either wire `expo-file-system` + `expo-sharing` or hide the buttons for v1.
3. **Analytics cache is never invalidated** — Intel screen shows stale FLOW/BURN after logging (§2.3).
4. **`transfer` kind is half-built but selectable** — users can log a no-op entry (§2.4).
5. **`setTimeout` delete timers leak on unmount** — setState-after-unmount on Ledger & Intel (§3.1).
6. **No release plumbing** — no `eas.json`, no iOS bundle id, no privacy policy, README is still Expo boilerplate (§6).

Everything below is itemised with `file:line`, root cause, and the fix.

---

## 1. P0 — Build is red (`npx tsc --noEmit` fails)

Run `npx tsc --noEmit` — 7 errors today. Each blocks a release build.

| # | Location | Error | Fix |
|---|----------|-------|-----|
| 1 | `src/lib/export.ts:65` | `getTransactionsByRange` is called but never imported/defined | Replace with `getTransactions(db, { fromMs: range?.from, toMs: range?.to })` (the function that *is* imported). This is a latent crash in JSON export, not just a type error. |
| 2 | `src/lib/export.ts:40` | `categoryMap.get(tx.category_id)` — `category_id` is `string \| null` | Guard: `tx.category_id ? categoryMap.get(tx.category_id) : undefined`. |
| 3 | `src/lib/backup.ts:17` | `z.record(z.string())` — Zod **v4** requires key *and* value schema | Change to `z.record(z.string(), z.string())`. (Zod v4 breaking change — grep the repo for other single-arg `z.record`.) |
| 4 | `src/lib/backup.ts:152` | `Object.entries(backup.settings)` value typed `unknown` → not `SQLiteBindValue` | Type the loop: `for (const [key, value] of Object.entries(backup.settings) as [string,string][])`. |
| 5 | `src/lib/db/repos/budgets.ts:65` | `values: unknown[]` spread into `runAsync` | Type as `SQLiteBindValue[]` (import the type) or `(string\|number)[]`. |
| 6 | `src/lib/db/repos/transactions.ts:101` | same `unknown[]` → `runAsync` | same fix. |
| 7 | `src/components/vaults/vault-card.tsx:71` | `IDCard style={[...]}` array includes `false` and conflicting member types | Give `IDCard`'s `style` prop type `StyleProp<ViewStyle>` and/or filter falsy entries. |

**Add a CI gate:** `package.json` has no `typecheck` script and no test runner. Add:
```jsonc
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "expo lint"
}
```
and make a release impossible while either fails.

---

## 2. P1 — Ships broken behaviour or risks data

### 2.1 Backup / Restore are non-functional but report success
- `src/app/(modals)/settings.tsx:81` `handleCreateBackup` calls `createBackup(db)` which **returns a JSON string that is thrown away** — no file write, no share sheet. Toast says "Backup created." Users believe they have a backup they do not have. **This is the most dangerous UX lie in the app for a finance product.**
- `handleRestoreBackup` (`:97`) is a stub: `showToast('Restore coming soon')`, yet the button reads "RESTORE FROM BACKUP".
- **Fix options:**
  - **Ship-it path:** install `expo-file-system` + `expo-sharing`, write the string to a file and open the share sheet; for restore add `expo-document-picker` → read → `validateBackup` → `restoreBackup`. (Already the documented plan in `issues.md`.)
  - **Cut path (faster to launch):** hide both buttons behind a `__DEV__`/feature flag and keep only DELETE ALL DATA + Export. Don't ship a button that lies.

### 2.2 Export writes no file either
- `src/app/(modals)/export.tsx:64` calls `exportAsCSV` / `exportAsJSON` which **return strings**; the modal shows "EXPORT READY" and closes. Nothing is saved or shared. Same lie as backup.
- Note: `src/lib/archive.ts` *does* the right thing via `Share.share({ message })` (`exportMonthCSV`/`exportMonthHTML`). The main Export modal should use the same `Share` API (or file + share) instead of discarding the string.

### 2.3 Analytics cache is never invalidated → stale Intel
- `src/lib/query-cache.ts` exposes `clearCache` / `invalidatePrefix`, and `analytics.ts:5` comments *"invalidated on transaction writes via clearCache()"* — **but `grep` finds zero call sites.** Nothing ever clears it.
- Effect: `getInflowVsOutflow` and `getDailyBurn` cache for 60s (`TTL`), while `getCategorySpend`/`getCapStats` are **uncached**. After logging an entry, the Intel screen shows **new SPEND/CAPS but stale FLOW/BURN for up to a minute** — the two halves disagree, and it violates the app's own `assertIntelReconcilesLedger` invariant (`analytics.ts:349`).
- **Fix:** call `clearCache()` after every transaction/budget write (in the repos or in the entry/cap save handlers), e.g. in `createTransaction`/`updateTransaction`/`deleteTransaction` and budget mutations. Simpler still for v1: **delete the cache entirely** — these are single-row aggregate queries over an indexed local SQLite table; the cache buys ~nothing and is a correctness footgun.

### 2.4 `transfer` kind is exposed but does nothing
- `src/app/(modals)/entry.tsx:190` renders a selectable `TRANSFER` toggle; TAG shows `TRANSFERS // M2` placeholder (`:211`). A user can pick TRANSFER, enter an amount, and Save.
- `createTransaction` stores it with `transfer_group_id = null` and `category_id = null`. But every balance/analytics query excludes rows via `transfer_group_id IS NULL` **AND** only sums `inflow`/`outflow` — so a saved transfer **changes no balance and appears in no Intel**, yet shows in the Ledger as a mystery row. Dead-end feature surfaced to users.
- **Fix for v1:** remove the `transfer` option from the kind toggle (it's M2 backlog per `issues.md`), or disable Save when `kind==='transfer'`.

### 2.5 `restoreBackup` is unsafe (when it gets wired)
`src/lib/backup.ts:72`:
- **Not wrapped in `withTransactionAsync`** — it `DELETE`s all tables first, then re-inserts row by row. Any malformed row throws mid-loop and leaves the DB **wiped**. Wrap the whole restore in a transaction so it's all-or-nothing.
- **Drops the `archived` flag** — the transaction INSERT (`:120`) omits `archived`, so every restored row defaults to live again. Previously-archived months reappear.
- **Skips `monthly_archives`** entirely — archive history is lost on restore.
- **Validation is `z.any()`** (`:14-17`) — arrays aren't shape-checked, so a hand-edited/corrupt backup inserts garbage or crashes. Validate each row with the real `AccountSchema`/`TransactionSchema`/etc.

### 2.6 Multi-currency totals are summed naively
- `getTotalBalance` (`analytics.ts:53`) and the CSV running balance (`export.ts:30`) **add minor units across vaults of different currencies** as if 1 unit = 1 unit. Vaults carry a `currency` column and the UI shows a single global symbol (`useCurrencySymbol`). A user with a USD and an EUR vault sees a nonsense "total."
- v1 is explicitly single-currency-display (per `issues.md` "Multi-Currency Conversion" backlog). **Decide and document one of:**
  - Constrain v1 to one currency (hide per-vault currency picker), **or**
  - Show per-vault balances only and drop the cross-vault "TOTAL BALANCE" headline, **or**
  - Label the total as "(mixed currencies)" when vaults differ.

### 2.7 "Other" category creates a new row every time
- `entry.tsx:112` and `cap.tsx:76` call `createCategory` on **every** save when "Other" is selected, with no dedupe. Typing "Subscriptions" twice creates two `cat_*` rows with `sort: 999`. Category list grows unbounded; Intel splits the same spend across duplicates.
- **Fix:** look up an existing non-archived category by `(name, kind)` (case-insensitive) and reuse it; only insert if absent.

---

## 3. P2 — Memory leaks & lifecycle

### 3.1 Delete timers leak / setState-after-unmount
- `src/app/(tabs)/index.tsx:138` and `src/app/(tabs)/analyze.tsx:61`: a 4s `setTimeout` (`deleteTimerRef`) commits the pending delete and calls `setState`/`reload`. **There is no `useEffect(() => () => clearTimeout(...), [])` cleanup.** Navigating away or unmounting during the undo window fires the callback on an unmounted component → "can't perform a React state update on an unmounted component" + the timer keeps a closure alive.
- **Fix:** add an unmount cleanup that clears `deleteTimerRef.current`. Decide intent: should leaving the screen **commit** or **cancel** the pending delete? Commit-on-unmount is safer for a delete the user already triggered, but do it without setState.

### 3.2 `analyze.tsx` double-loads and can setState after unmount
- `:80` `useEffect(() => loadData(), [activePeriod, db])` **and** `:81` `useFocusEffect(() => loadData())` both fire on focus → two full 4-query passes back to back on every visit.
- `useFocusEffect` is **not wrapped in `useCallback`** (Expo Router warns about this and re-subscribes each render).
- `loadData` (`:64`) does `Promise.all(...).then(setState)` with **no mounted guard** — a slow query resolving after navigation sets state on an unmounted screen.
- **Fix:** drop the redundant `useEffect`, wrap the focus callback in `useCallback`, and guard with an `isActive`/`AbortController`-style flag inside the effect.

### 3.3 Module-global toast timer (low risk, note it)
- `src/store/ui.ts:8` keeps `toastTimer` at module scope. Fine for a singleton store, but it survives Fast Refresh and is shared across any future multi-instance use. Acceptable for v1; leaving a note.

---

## 4. P2 — Security & data integrity

### 4.1 CSV formula injection
- `export.ts` and `archive.ts:139` write `note`, `category_name`, `vault_name` into CSV cells. A note beginning with `=`, `+`, `-`, or `@` is executed as a formula when opened in Excel/Sheets (CSV injection / DDE). The note is the user's own data, so risk is low, but it's a one-line hardening: prefix such cells with `'` (apostrophe) or wrap and sanitize.
- Current escaping is also inconsistent: `export.ts:44` replaces `,`→`;` and quotes, while `archive.ts:144` only replaces `,`→`;` and ignores embedded newlines/quotes. Unify on a single RFC-4180 CSV encoder.

### 4.2 HTML report is built by string interpolation (XSS when opened in a browser)
- `archive.ts:187` interpolates `category_name`, `vault_name`, `note` straight into HTML and shares it as a file the user opens in a browser. A note like `<img src=x onerror=...>` executes in that page's context. Escape `& < > " '` before interpolation.

### 4.3 No third-party network / keys
- Good news: confirmed **no network calls, no API keys, no analytics SDK, no AI** in the bundle. All data is local SQLite. That removes a large class of launch risk and most privacy-policy burden (but you still need a policy — §6).

---

## 5. P3 — Robustness, correctness, polish

- **No React error boundary.** A single render throw white-screens the whole app. Add a root `ErrorBoundary` in `app/_layout.tsx` with a "something broke" fallback. (Especially important because several screens `.parse()` SQLite rows with Zod and will throw on schema drift.)
- **No tests at all.** No test script, no specs. At minimum add unit tests for `lib/money.ts`, `lib/analytics.ts` SQL aggregations, and the migration runner (these encode financial correctness). The `assertIntelReconcilesLedger` invariant should run in a test, not only `__DEV__`.
- **`Swipeable` from `react-native-gesture-handler` is deprecated** (`vault-card.tsx:2`). RNGH 2.x moved to `ReanimatedSwipeable`. It still works in 2.31 but will be removed; migrate before it bites.
- **Swallowed errors.** Many `.catch(console.error)` and empty `catch {}` (e.g. `use-archive-check.ts:20`, entry/cap save handlers) silently drop failures — a failed write looks identical to success minus the haptic. Surface a toast on write failure everywhere a DB mutation can throw.
- **White flash on modal close** — documented in `issue.md`. Try `presentation: 'transparentModal'` or set an explicit black `contentStyle`/`Stack.Screen` background; the SafeAreaView default during the dismiss animation is the likely culprit.
- **`getDailyBurn` projection** (`analytics.ts:176`) hard-codes a 30-day month and a linear extrapolation. For Feb or 31-day months the "PROJ. END" is wrong. Use the real days-in-month (you already compute it in `analyze.tsx:getPeriodTotalDays`).
- **Week range ignores `first_day_of_week` setting.** `analyze.tsx:33` and `export.tsx:45` hard-code `d.getDay()` (Sunday start), ignoring the user's MON/SUN preference that the Settings screen carefully persists. Honour `firstDayOfWeek`.
- **`deleteTransferGroup` is dead code** until transfers exist (`transactions.ts:108`).

---

## 6. INFRA — Store submission plumbing (none of this exists yet)

- [ ] **`eas.json`** — no EAS build/submit config in repo. Required for store builds.
- [ ] **iOS `bundleIdentifier`** — `app.json` has `android.package` (`com.jasopiw637.Eddies`) but **no `ios.bundleIdentifier`**. iOS build will fail. Also pick a real org id (the `jasopiw637` autogen string is ugly for a public listing).
- [ ] **App icon / logo** — you're bringing this. Slots to fill in `app.json`: `icon`, `android.adaptiveIcon` (foreground/background/monochrome), `web.favicon`, splash `image`. Provide 1024×1024 master.
- [ ] **`versionCode` / `buildNumber`** — only `version: "1.0.0"` is set; add platform build numbers (or let EAS auto-increment).
- [ ] **Privacy policy URL** — both stores require one even though the app collects nothing. State "all data stays on device, no collection." Apple Privacy Nutrition Label = "Data Not Collected."
- [ ] **Store listing assets** — screenshots (per device class), description, keywords, category (Finance), age rating.
- [ ] **`README.md` is still the Expo template** — replace with real product/setup docs before the repo is public.
- [ ] **`expo-doctor`** — run `npx expo-doctor` to catch version mismatches (you're on the bleeding edge: Expo 56, RN 0.85, React 19.2, Reanimated 4, `reactCompiler: true`). Verify the React Compiler experiment is stable for a release build, not just dev.
- [ ] **Onboarding (Phase 4.3)** — deferred per memory. Confirm first-run UX is acceptable without it: cold start lands on an empty Ledger with a "TAP + TO LOG" hint and a default "Cash" vault (migration 3). That's a defensible v1, but there's no "what is this app" moment.
- [ ] **License/branding** — `LICENSE` present; confirm it's the license you want for a shipped app.

---

## 7. Performance

- **`LedgerHeader` recomputes month aggregates on every render** (`index.tsx:18-26`): `sections.flatMap(...).filter(...).reduce(...)` over up to 500 rows, plus three more passes, runs each time the `SectionList` re-renders the header. Memoize with `useMemo` keyed on `sections`, or compute the month totals once in `useLedger`.
- **Ledger is capped at `LIMIT 500`** (`use-ledger.ts:72`) with no pagination. Power users silently lose older rows from the live view (archive mitigates this, but it's invisible). Consider windowed loading or surfacing "showing last 500."
- **`analyze.tsx` runs 4 queries twice per focus** (§3.2) — halve it.
- **`SectionList`/`ScrollView` row components** (`EntryRow`, `SpendBar`, `CapProgress`, `VaultCard`) aren't `React.memo`'d — fine at current scale, revisit if lists grow. (React Compiler may cover some of this; verify in profiler.)
- **Cache removal (§2.3)** also simplifies the perf story — measure before keeping any memo layer.

---

## 8. Accessibility

- **Amount `TextInput`s have no `accessibilityLabel`** (`entry.tsx:175`, `cap.tsx:138`) — screen readers announce only the placeholder/value. Label them "Amount".
- Toggle/segment controls mostly set `accessibilityRole`/`accessibilityState` (good). Audit the Settings haptics/week toggles — they're plain `Pressable`s without `accessibilityRole="switch"`.
- A reduce-motion hook exists (`use-reduce-motion.ts`) and an a11y pass is logged in memory — re-verify contrast of `steel`-on-`ink` small text (the 8–9px mono labels at `steel + '66'`/`'88'` are likely below WCAG AA).

---

## 9. Suggested execution order

1. **Green the build** — §1 (7 type fixes) + add `typecheck` script.
2. **Stop the lies** — §2.1/2.2: either wire file I/O (`expo-file-system`/`expo-sharing`/`expo-document-picker`) or hide Backup/Restore/Export-to-file for v1.
3. **Fix Intel correctness** — §2.3 (kill or invalidate cache) + §5 week-start + projection.
4. **Remove dead `transfer` UI** — §2.4.
5. **Plug the leaks** — §3.1/3.2 timer cleanup + focus de-dupe.
6. **Harden** — §2.5 restore safety (if shipping it), §2.7 category dedupe, §4 CSV/HTML escaping, §5 error boundary.
7. **Release plumbing + logo** — §6 (eas.json, iOS bundle id, icons, privacy policy, README).
8. **Tests for money/analytics/migrations** — §5.
9. **Perf + a11y polish** — §7/§8.

---

*Scan covered: 58 source files — DB layer & migrations, repos, stores, hooks, all 5 tab screens, all 6 modals, analytics/export/backup/archive libs, and the component library. `npx tsc --noEmit` was run (7 errors). No runtime profiling or on-device testing was performed — items marked "verify" need a device pass.*
