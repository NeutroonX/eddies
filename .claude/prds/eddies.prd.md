# EDDIES — Product Requirements Document

> **EDDIES // 01-A**
> A local-first personal finance tracker with a cyberpunk-industrial identity.
> Fast manual logging. Sharp deterministic analysis. **No AI. No bank links. No cloud.**

| Field | Value |
|---|---|
| Product | Eddies |
| Platform | iOS + Android (Expo SDK 56, expo-router) |
| Doc owner | neutron |
| Status | Draft v1 — pending approval |
| Date | 2026-06-05 |
| Build target | v56.0.0 docs — https://docs.expo.dev/versions/v56.0.0/ |

---

## 0. TL;DR

Eddies is an offline money tracker for people who want **full control and zero noise**. You log what you spend and earn in under three seconds, tag it, and the app turns that ledger into honest, deterministic analytics — burn rate, category breakdowns, budget caps, net worth over time. Nothing is "predicted." Nothing is sent anywhere. The name is Night City slang for cash; the product feels like a piece of certified field hardware, not another pastel fintech clone.

**The wedge:** every popular tracker is either (a) a bloated AI-categorizing bank-aggregator that leaks your data and guesses wrong, or (b) a clumsy spreadsheet. Eddies is the third thing: **manual, private, fast, and beautiful** — with a visual identity nobody else has.

---

## 1. Problem & Opportunity

### 1.1 The problem
- **Bank-sync trackers are a privacy and accuracy tax.** They demand credentials, mis-categorize transactions, and bury the user in a feed they didn't author. "AI insights" are vague and untrustworthy.
- **Manual trackers are ugly and slow.** Spreadsheets and most "simple" expense apps make logging a chore and analysis an afterthought.
- **Nobody owns "cool."** Finance UI is a sea of rounded mint-green cards. There's an underserved audience that wants their tools to look like gear, not greeting cards.

### 1.2 The opportunity
A finance app that is **opinionated about three things**: (1) entry is instant, (2) analysis is honest and deterministic, (3) the aesthetic is a brutalist-cyberpunk system that is *restrained, not costume-y*. Local-first means no backend cost, no compliance surface, and a privacy story that sells itself.

### 1.3 Why now / why this stack
Expo SDK 56 ships native primitives (`expo-symbols`, `expo-glass-effect`, `@expo/ui`) and the React Compiler, so a single TS codebase can feel genuinely native on iOS while staying cheap to build. `expo-sqlite` makes real analytical queries trivial on-device.

---

## 2. Vision & Principles

**Vision:** The money tracker you'd actually keep open — because logging is frictionless, the numbers are trustworthy, and it looks like nothing else on your home screen.

**Design & product principles (the constitution):**

1. **Three-second log.** From cold launch to "entry saved" must be ≤ 3 taps. Entry friction is the only thing that kills a manual tracker.
2. **Deterministic over magic.** Every number traces to entries the user typed. No AI, no estimates labeled as facts. If we project (e.g., month-end burn), it's clearly marked as arithmetic, with the formula one tap away.
3. **Local-first, private by construction.** No account, no network calls for core function. Data lives on-device in SQLite; export is user-initiated.
4. **Restraint is the aesthetic.** Cyberpunk through *structure, type, and motif* — not gradients, glow spam, or stock "circuit" textures. Mostly black, mono-spaced data, one alert red. The "slop" failure mode is over-decoration; we ship the opposite.
5. **Data is the hero.** Big condensed numerals, monospaced amounts, generous negative space. Chrome recedes; figures dominate.
6. **No dark patterns, no nags.** No streak guilt, no upsell interruptions, no "premium to see your own data."

---

## 3. Target Users

| Persona | Who | Core need | Why Eddies |
|---|---|---|---|
| **The Operator** (primary) | 22–35, design/dev/creative, privacy-aware, owns their tooling | Log fast, see truthful trends, no data leaving the phone | Speed + privacy + identity |
| **The Rebuilder** | Recovering from debt / on a tight budget | Hard category caps and a visible burn rate | Envelope caps + daily burn, no judgment |
| **The Freelancer** | Irregular income, multiple wallets | Track inflow vs outflow across accounts, export for taxes | Multi-vault + CSV export |

**Anti-persona:** users who want automatic bank import and AI auto-categorization. That's explicitly **not** this product.

---

## 4. Goals & Non-Goals

### 4.1 Goals (v1)
- G1 — Log an expense/income in ≤ 3 taps with amount, category, account, optional note.
- G2 — A ledger that's a pleasure to scan (grouped by day, running balance, fast filter).
- G3 — An analysis surface that answers: *Where did it go? Am I over a cap? What's my burn? Net worth trend?*
- G4 — Multiple vaults (accounts) with transfers between them.
- G5 — Category caps (budgets) with clear over/under signaling.
- G6 — 100% offline; CSV/JSON export + local backup/restore.
- G7 — A cohesive cyberpunk design system implemented as reusable tokens + primitives.

### 4.2 Non-Goals (v1 — explicitly out)
- ❌ **Any AI / ML / LLM features** (no auto-categorization, no "insights," no chat).
- ❌ Bank / Plaid / Open Banking sync.
- ❌ Cloud accounts, login, or server backend.
- ❌ Multi-currency conversion *math* (v1 stores a currency per vault but does not auto-convert; conversion deferred to v2).
- ❌ Recurring-transaction automation (v1.1), shared/household budgets, investments/portfolio tracking, bill reminders.
- ❌ Web app polish (web builds, but mobile is the product).

---

## 5. Scope — Feature Set

### 5.1 Feature map

| # | Feature | Priority | Milestone |
|---|---|---|---|
| F1 | Quick-add entry (modal) | P0 | M1 |
| F2 | Ledger (home) — grouped list, running balance | P0 | M1 |
| F3 | Categories (tags) — seed set + CRUD | P0 | M1 |
| F4 | Vaults (accounts) + balances | P0 | M2 |
| F5 | Transfers between vaults | P1 | M2 |
| F6 | Analyze — category breakdown, inflow/outflow, burn rate | P0 | M3 |
| F7 | Net-worth-over-time trend | P1 | M3 |
| F8 | Caps (budgets) with progress + alerts | P1 | M3 |
| F9 | Filter & search the ledger | P1 | M2 |
| F10 | Export (CSV + JSON) & local backup/restore | P0 | M4 |
| F11 | Design system (tokens + primitives) | P0 | M0 |
| F12 | Settings (currency, first-day-of-week, haptics, theme lock) | P1 | M4 |
| F13 | Onboarding (3 screens, create first vault) | P2 | M4 |
| F14 | Recurring entries | P2 | v1.1 |

### 5.2 Feature specs

#### F1 — Quick-Add Entry `[P0]`
The product's heartbeat. Opened from a persistent FAB / center tab action.

- **Layout:** full-height modal. Giant monospaced amount field at top (numeric keypad auto-focused). Below: a horizontal **kind toggle** `OUTFLOW / INFLOW / TRANSFER`, a category chip rail, a vault selector pill, optional note line, date (defaults to *now*, tap to change).
- **Interaction:** type amount → tap a category chip → **SAVE** (big red button). Account defaults to last-used vault. That's the 3-tap path (amount via keypad counts as one focused action).
- **Money rule:** amounts entered as decimals, **stored as integer minor units** (cents). No floating-point money, ever.
- **Validation:** amount > 0; category required for inflow/outflow; both vaults required + must differ for transfer.
- **Micro-delight:** on save, a brief "stamp" animation (Reanimated) — the entry gets "certified" — then modal dismisses. Haptic tick.
- **Acceptance:** logging is reachable from any tab; median time-to-save < 3s in dogfood; reopening prefills last vault.

#### F2 — Ledger (Home) `[P0]`
- **Header:** total balance (sum across vaults) in large condensed numerals; small mono delta vs. start of current period. A subtle barcode / `EDDIES // LEDGER` registration mark for identity.
- **List:** transactions grouped by **day** with sticky date headers (`THU 05 JUN`). Each row: category glyph, name/note, vault tag, amount (red for outflow, off-white for inflow, mono). Right-aligned figures align on the decimal.
- **Empty state:** an on-brand "NO ENTRIES LOGGED // STANDING BY" card, not a sad illustration.
- **Row actions:** tap → detail/edit; swipe → delete (with undo snackbar).
- **Acceptance:** 1,000 entries scroll at 60fps; correct running balance; deletes reversible.

#### F3 — Categories / Tags `[P0]`
- Seed set on first run (Food, Transport, Rent, Utilities, Fun, Health, Income, etc.), each with an `expo-symbols` glyph + assigned accent.
- CRUD: name, kind (expense/income), glyph, color from a constrained palette (no free hex — keeps the system coherent).
- **Acceptance:** user can add/rename/retire a tag; retiring keeps historical entries intact (soft archive).

#### F4 — Vaults (Accounts) `[P0]`
- Account = a wallet/card/cash store. Fields: name, type (cash/bank/card/savings), currency, opening balance, color.
- Each vault renders as an **ID-card surface** (off-white "card stock", mono serial, type stamp) — the hero of this tab, echoing the reference art.
- Balance = opening balance + Σ entries. Archive (not delete) to preserve history.

#### F5 — Transfers `[P1]`
- Move money between two vaults; modeled as a linked pair sharing a `transfer_group_id` so it nets to zero across the system and never pollutes spend analytics.

#### F6 — Analyze (Intel) `[P0]`
The reason to stay. **All deterministic.**
- **Period switcher:** Week / Month / Custom range (segmented, mono labels).
- **Spend-by-category:** ranked bars (not a pie) with amount + % of outflow; tap a bar → filtered ledger.
- **Inflow vs Outflow:** paired bars per period bucket + a net figure.
- **Burn rate:** average daily outflow for the period, and a *clearly-labeled arithmetic* projection — "AT THIS RATE → month-end ≈ X" with a `ƒ` tap revealing the formula. No prediction dressed as fact.
- **Top tags / largest entries:** quick honest highlights.
- **Acceptance:** every figure is reproducible from the ledger; numbers reconcile with the Ledger tab to the cent.

#### F7 — Net Worth Trend `[P1]`
- Line/step chart of Σ vault balances over time (Reanimated/Skia or RN SVG). Snap-to-point readout in mono. Caution-stripe baseline at zero.

#### F8 — Caps (Budgets) `[P1]`
- Per-category monthly/weekly **cap**. Progress bar: off-white fill → flips to alert red + a `CAUTION` stripe when exceeded.
- Local notification optional when a cap is breached (no server; `expo-notifications`, opt-in).
- **Acceptance:** cap state derives live from entries in the active period; over-cap is unmistakable.

#### F9 — Filter & Search `[P1]`
- Filter ledger by vault, category, kind, date range, and free-text note search. Filter chips render in the cyberpunk pill style with an `✕` to clear (matching the reference catalog screen).

#### F10 — Export & Backup `[P0]`
- **Export:** CSV (spreadsheet-friendly) and JSON (full fidelity) via `expo-sharing`. User picks range.
- **Backup/Restore:** write/read a single `.eddies` JSON snapshot (all tables) to the OS file picker. Restore is explicit and previewed.
- **Acceptance:** round-trip backup→wipe→restore reproduces state exactly; CSV opens cleanly in Sheets/Excel.

#### F11 — Design System `[P0]` (see §8)
#### F12 — Settings, F13 — Onboarding, F14 — Recurring (v1.1) — standard scope per map.

---

## 6. Information Architecture & Navigation

`expo-router` file-based routing, typed routes enabled. Tab bar (4) + a center **LOG** action that opens the quick-add modal.

```
src/app/
  _layout.tsx                 # root stack: tabs + modal group + theme provider
  (tabs)/
    _layout.tsx               # tab bar: Ledger · Intel · Vaults · System
    index.tsx                 # F2  LEDGER (home)
    analyze.tsx               # F6/F7 INTEL
    vaults.tsx                # F4/F5 VAULTS
    settings.tsx              # F12 SYSTEM
  (modals)/
    entry.tsx                 # F1  quick-add / edit entry
    transfer.tsx              # F5  transfer
    category.tsx              # F3  tag editor
    cap.tsx                   # F8  cap editor
  onboarding.tsx              # F13 (first-run gate)
```

**Terminology layer** (label in mono subtext so it's always legible, never cryptic):

| Concept | Eddies label |
|---|---|
| Transaction | ENTRY / LOG |
| Expense | OUTFLOW |
| Income | INFLOW |
| Account | VAULT |
| Category | TAG |
| Budget | CAP |
| Analysis | INTEL |

---

## 7. Data Model & Analytics Engine

### 7.1 Storage
- **`expo-sqlite`** — system of record (relational → real analytics queries).
- **KV prefs** via a settings table or `expo-sqlite/kv` (last-used vault, theme lock). No `AsyncStorage`.
- **Money:** every amount is an **integer of minor units** (`amount_minor`), with a `currency` per vault. No floats in storage or aggregation.

### 7.2 Schema (SQLite) — synthetic field definitions

```sql
accounts(
  id TEXT PK, name TEXT, type TEXT,            -- cash|bank|card|savings
  currency TEXT, opening_balance_minor INTEGER,
  color TEXT, archived INTEGER DEFAULT 0, created_at INTEGER
)

categories(
  id TEXT PK, name TEXT, kind TEXT,            -- expense|income
  glyph TEXT, color TEXT, archived INTEGER DEFAULT 0, sort INTEGER
)

transactions(
  id TEXT PK, account_id TEXT FK, category_id TEXT FK NULL,
  kind TEXT,                                   -- outflow|inflow|transfer
  amount_minor INTEGER,                         -- always positive
  note TEXT, occurred_at INTEGER, created_at INTEGER,
  transfer_group_id TEXT NULL
)

budgets(
  id TEXT PK, category_id TEXT FK, period TEXT, -- weekly|monthly
  amount_minor INTEGER, start_date INTEGER
)

settings(key TEXT PK, value TEXT)
```

**Date format:** all timestamps stored as **integer Unix epoch milliseconds** (`occurred_at`, `created_at`, `start_date`); formatted for display in the UI layer only. Indexes on `transactions(occurred_at)`, `transactions(account_id)`, `transactions(category_id)`.

### 7.3 Analytics (all pure SQL/TS, deterministic)
- Vault balance = `opening_balance + Σ(inflow) − Σ(outflow) ± transfers`.
- Spend-by-category, inflow vs outflow, daily burn (Σ outflow / days in range), arithmetic month-end projection (burn × remaining days), net worth series, cap usage %, top tags / largest entries.
- **Invariant:** Intel figures must reconcile to the Ledger to the cent. Add a debug assertion in dev builds.

---

## 8. Design System — "EDDIES INDUSTRIAL"

> The brand sells *restraint*. Cyberpunk via structure, type, and motif — never gradient/glow slop.

### 8.1 Color tokens
Dark-only brand surfaces (lock theme; ignore system light mode for brand screens).

| Token | Hex | Use |
|---|---|---|
| `ink` | `#000000` | Primary background |
| `surface` | `#0B0B0C` | Raised panels |
| `stock` | `#F2F0EB` | "Card stock" off-white (vault/ID cards) |
| `bone` | `#FFFFFF` | Primary text / inflow figures |
| `alert` | `#E5484D` | Outflow, over-cap, primary action (the one red) |
| `steel` | `#8A8F98` | Secondary mono text, hairlines |
| `caution` | repeating `#E5484D`/`#000` stripe | Over-cap / zero baseline only |

One accent. No second hue unless a tag color (from a constrained 6-swatch palette). Signal logic: **red = money leaving / danger**, **bone = money in / neutral**.

### 8.2 Typography `[LOCKED]`
- **Display / numerals: `Rajdhani`** — a squared-off techno grotesque (semi-condensed, HUD/interface feel). Used for balances, headers, big figures, section tags. Cyberpunk through structure, not gimmick; legible in caps and mixed case. Weights: 500 / 600 / 700.
- **Data / labels: `Space Mono`** — distinctive monospace for amounts, serials, timestamps, registration marks (`EDDIES // INTEL 02-A`). Tabular numerals so amount columns align on the decimal.
- **Body:** system sans for notes and longform settings (keeps long text effortless).
- **Pairing rule:** exactly two families (Rajdhani + Space Mono). No third display face — mixing more is the slop failure mode.
- Both are free (Google Fonts), loaded via `expo-font` with `Rajdhani_500Medium/600SemiBold/700Bold` and `SpaceMono_400Regular/700Bold`.

### 8.3 Motif kit (use sparingly — 1–2 per screen, max)
Registration crosshair `+` · barcode strip · section tags `EDDIES // INTEL 02-A` · certification stamp (save animation) · chunky pill chips with `✕` · ID-card framing for vaults · caution stripe reserved for over-cap and the net-worth zero line.

### 8.4 Tokens & primitives (code)
Extend `src/constants/theme.ts` (existing `Colors`/`Spacing`/`Fonts` shape) with `Eddies` tokens. Build primitives in `src/components/ui/`:
`<Numerals>`, `<MonoLabel>`, `<Pill>`, `<IDCard>`, `<SectionTag>`, `<BarcodeMark>`, `<CautionStripe>`, `<StampButton>`. **Components consume tokens only — no raw hex in screens.**

### 8.5 Motion
`react-native-reanimated` 4 + worklets (already installed). Save = "stamp" press + haptic. Tab/route transitions crisp and fast (≤200ms). Bars/charts animate in once, never loop. Respect reduce-motion.

---

## 9. Technical Architecture

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 56, expo-router (typed routes, React Compiler on) | Already scaffolded; native feel |
| Language | TypeScript, `strict` | Existing config; `@/*` → `src/*` |
| State (UI/device) | **Zustand** | Local UI/session state (active period, filters, last vault) |
| State (data) | **expo-sqlite** + thin **repository layer** (`src/lib/db/`) | No server → no TanStack Query needed; repos return typed rows |
| Validation | **Zod** schemas at the repo boundary | Validate every read/write; no malformed money |
| Persistence | SQLite (records) + KV (prefs) | Relational analytics + fast prefs |
| Charts | Reanimated + RN SVG / Skia | On-device, no web deps |
| Icons | `expo-symbols` (+ fallback set for Android) | Native glyphs |
| Notifications | `expo-notifications` (opt-in, local only) | Cap breach alerts |
| Export/share | `expo-sharing`, `expo-file-system` | CSV/JSON/backup |

**Layering rule (project convention):** no business logic inside screens. Screens → hooks → `src/lib/` services/repositories → SQLite. Money math lives in `src/lib/money.ts` (minor-unit helpers), aggregations in `src/lib/analytics.ts`.

```
src/
  app/            # routes (thin; presentation only)
  components/ui/  # design-system primitives
  components/     # composed feature components
  lib/
    db/           # sqlite client, migrations, repositories
    money.ts      # minor-unit + currency formatting
    analytics.ts  # deterministic aggregations
  store/          # zustand slices (ui/session)
  constants/theme.ts   # Eddies tokens (extend existing)
```

> Build per the **v56.0.0** docs: https://docs.expo.dev/versions/v56.0.0/ — Expo APIs changed in 56; verify each module's 56 signature before use.

---

## 10. Delivery Milestones

| Milestone | Scope | Exit criteria | Plan |
|---|---|---|---|
| **M0 — Foundation** | Design tokens, fonts, UI primitives, SQLite client + migrations + repos, Zod schemas, money lib | Primitives render in a gallery screen; DB migrates; money round-trips | pending |
| **M1 — Log & Ledger** | F1 quick-add, F2 ledger, F3 categories (seed+CRUD) | Log in ≤3 taps; ledger groups by day; running balance correct | pending |
| **M2 — Vaults & Filters** | F4 vaults (ID cards), F5 transfers, F9 filter/search | Multi-vault balances reconcile; transfers net to zero; filters work | pending |
| **M3 — Intel & Caps** | F6 analyze, F7 net-worth, F8 caps | Every figure reconciles to ledger to the cent; over-cap signals | pending |
| **M4 — Ship-ready** | F10 export/backup, F12 settings, F13 onboarding, polish/a11y | Backup round-trip exact; onboarding creates first vault; reduce-motion respected | pending |
| **v1.1** | F14 recurring entries, multi-currency conversion | — | backlog |

---

## 11. Success Metrics

Privacy-respecting, mostly **local/qualitative** (no analytics SDK in v1 — measured via dogfood + opt-in TestFlight feedback):
- **Activation:** % of first-run users who log ≥3 entries day 1.
- **Friction:** median time-to-save (target < 3s).
- **Stickiness:** D7 / D30 return; entries-per-active-week.
- **Trust:** zero reconciliation mismatches between Intel and Ledger (hard invariant, not a vanity metric).
- **Perf:** 60fps ledger at 1k entries; cold start < 2s.

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manual entry abandoned (friction) | High | High | Obsess over the 3-tap path; last-vault prefill; haptic + stamp reward |
| Aesthetic reads as "costume," hurts legibility | Med | High | Restraint rule (1–2 motifs/screen); mono labels always; a11y contrast audit |
| Float money bugs | Med | High | Integer minor units everywhere; Zod guards; unit tests on `money.ts` |
| Expo 56 API drift | Med | Med | Verify each module against v56 docs before use; pin versions |
| Data loss (local-only, no cloud) | Med | High | Easy backup/restore; prompt periodic backup; export early |
| Chart perf on Android | Med | Med | Prefer SVG/Reanimated; virtualize; cap animated points |
| Scope creep toward AI/sync | Med | Med | Non-Goals are contractual; revisit only post-v1 |

---

## 13. Open Questions

1. **Charts:** RN-SVG (lighter, simpler) vs Skia (richer)? → lean RN-SVG for v1 unless net-worth needs Skia.
2. **Fonts:** Bebas Neue vs Archivo Expanded for display — pick one and commit.
3. **Notifications:** ship cap alerts in M3, or defer to M4 to keep M3 deterministic-only?
4. **Onboarding depth:** 3 screens vs a single "create your first vault" gate?
5. **Currency in v1:** lock to a single user-chosen currency app-wide (simplest) vs per-vault display now, conversion later?

---

## 14. Acceptance (v1 ship gate)

- [ ] All P0 features complete and reconciling.
- [ ] Log path verified ≤ 3 taps; reduce-motion + a11y contrast pass.
- [ ] Backup→wipe→restore reproduces state exactly; CSV/JSON export clean.
- [ ] No raw hex in screens; all surfaces use Eddies tokens.
- [ ] Zero AI / network calls in core flows (verified).
- [ ] Reviewed by `ecc:react-reviewer` + `ecc:typescript-reviewer`; DB layer by `ecc:database-reviewer`.

---

*EDDIES // END OF DOCUMENT — STANDING BY*
