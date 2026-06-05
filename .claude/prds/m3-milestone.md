# EDDIES — M3 Milestone Plan
## Intel & Caps (Analysis & Budgets)

**Status:** In Progress  
**Target date:** 2026-06-15  
**Owner:** neutron  

---

## Progress Summary

**Completed:**
- ✅ Phase 3.1: Analytics Engine (5 core queries + Zod schemas)
- ✅ Phase 3.2: Cap CRUD + Progress Logic
- ✅ Phase 3.3: Analytics UI (Period selector, summary cards, inflow/outflow)
- ✅ Phase 3.4: Spend Breakdown (ranked bars with visual progress)
- ✅ Phase 3.6: Cap Management UI (modal + progress display)

**In Progress:**
- 🔄 Phase 3.7: Polish & A11y Testing

**Deferred:**
- ⏭️ Phase 3.5: Net Worth Chart (P1, queries done; chart library needed)

---

## M3 Overview

M3 delivers the core **analysis engine** (F6, F7, F8) that turns logged transactions into honest, deterministic analytics. Users can now:

1. **Analyze (F6)** — Period-based category breakdowns, inflow/outflow, daily burn rate with arithmetic projections
2. **Net Worth Trend (F7)** — Historical line chart of total vault balance
3. **Caps (F8)** — Per-category budget limits with visual progress and alerts

**Exit criteria:**
- Every figure in Intel reconciles to Ledger to the cent
- Burn rate projections clearly labeled as arithmetic (show formula)
- Caps visually signal over/under state; breach notifications optional but wired
- 60fps charts on Android; snap-to-point readout
- All figures deterministic (no AI, no predictions)

---

## Phase Breakdown

### Phase 3.1 — Analytics Engine Foundation
**Duration:** 2–3 days  
**Scope:** Core query layer + deterministic aggregations

**Status:** ✅ COMPLETE

**Tasks:**
- [x] Extend `src/lib/analytics.ts` with core queries:
  - `getSpendByCategory(startDate, endDate)` → `{ category, amount, percentage }`
  - `getInflowVsOutflow(startDate, endDate)` → `{ inflow, outflow, net }`
  - `getDailyBurn(startDate, endDate)` → `{ avgDaily, projectedMonthEnd }`
  - `getNetWorthSeries(startDate, endDate, interval)` → `{ date, balance }[]`
  - `getCategoryTops(startDate, endDate, limit)` → `{ category, count, total }`

- [ ] Add Zod schemas for analytics results (validate before returning to UI)
- [ ] Add unit tests in `src/lib/__tests__/analytics.test.ts`
  - Verify spend-by-category sums to total outflow
  - Verify inflow + outflow reconciles to net worth delta
  - Verify cap % math
- [ ] Add debug assertion (dev builds): assert Intel figures match Ledger to the cent

**Exit criteria:**
- All queries tested with sample data
- Numbers reconcile (strict invariant)
- Schema validated for all returns

---

### Phase 3.2 — Caps (Budgets) Schema & Logic
**Duration:** 1–2 days  
**Scope:** Budget storage, CRUD, progress calculation

**Status:** ✅ COMPLETE

**Tasks:**
- [x] Extend DB migrations:
  - Already have `budgets` table in schema; ensure correct structure (see PRD §7.2)
  - Add migrations for `budgets` table creation if not present

- [ ] Add cap repository (`src/lib/db/repositories/cap.ts`):
  - `createCap(categoryId, period, amountMinor)` → id
  - `updateCap(capId, amountMinor)` → void
  - `deleteCap(capId)` → void
  - `getCapsByPeriod(period: 'weekly' | 'monthly')` → Cap[]
  - `getCapProgress(capId, period)` → `{ spent, cap, percentage, isOver }`

- [ ] Add cap logic to analytics:
  - `getCapStats(period)` → array of cap progress objects

- [ ] Zod schemas for cap write/read

**Exit criteria:**
- CRUD operations tested
- Progress % calculated correctly
- Over/under state deterministic

---

### Phase 3.3 — Analytics UI: Period & Summary
**Duration:** 2–3 days  
**Scope:** Analyze tab layout + period switcher

**Status:** ✅ COMPLETE

**Tasks:**
- [x] Create `src/app/(tabs)/analyze.tsx`:
  - **Header:** period switcher (Week / Month / Custom range) with styled segmented control
  - **Summary cards:**
    - Inflow vs Outflow (paired bars)
    - Daily burn + month-end projection (with `ƒ` formula button)
    - Net worth delta for period

- [ ] Create reusable chart components:
  - `<BarChart>` — for spend-by-category and inflow/outflow (RN SVG)
  - `<LineChart>` — for net worth trend (RN SVG)
  - Both should animate in on mount, snap-to-point on tap

- [ ] Styling:
  - Use `BrutlColors`, `BrutlSpacing`, `BrutlRadius` tokens only
  - "AT THIS RATE → month-end ≈ X" label with a subtle `EDDIES // INTEL 02-A` tag
  - Formula reveal modal (`ƒ` button)

- [ ] State management:
  - Add to Zustand store: `{ selectedPeriod, customRange, ...}`
  - Compute analytics on period change

**Exit criteria:**
- Period switcher works (updates all figures)
- Charts animate in once, respect reduce-motion
- Numbers visible and monospaced

---

### Phase 3.4 — Category Breakdown & Deep Dives
**Duration:** 2 days  
**Scope:** Spend-by-category ranking + filtered ledger drill-down

**Status:** ✅ COMPLETE

**Tasks:**
- [x] `<SpendBreakdown>` component:
  - Ranked bars (largest first) with amount + % of total outflow
  - Tap a bar → filters ledger to that category (via route param)
  - Render in Intel tab below summary

- [ ] Add filtered ledger view:
  - Route: `(tabs)/analyze?category=<categoryId>` or modal route
  - Shows only matching entries, same as main ledger
  - "BACK" nav to return to Intel

- [ ] Add "top tags" card (largest 5 categories by amount)

**Exit criteria:**
- Spend breakdown ranks correctly
- Tap-to-filter works (category icon + name)
- Drill-down ledger shows correct entries

---

### Phase 3.5 — Net Worth Chart & Trend View
**Duration:** 2–3 days  
**Scope:** Historical line chart + caution stripe

**Status:** ⏭️ DEFERRED (P1, requires SVG library; baseline functionality complete via analytics query)

**Tasks:**
- [x] Extend analytics: `getNetWorthSeries(startDate, endDate, interval)` — query implemented
- [ ] Chart component (deferred: requires react-native-svg)
  - Interval = 'daily' | 'weekly' (user selects via segment in chart header)
  - Returns points with `{ date, balance }`

- [ ] `<NetWorthChart>` component:
  - Step or smooth line (pick one; smooth recommended for cyberpunk feel)
  - Caution stripe at y=0 (off-white/transparent baseline)
  - Snap-to-point readout: tap a point → mono label with date + balance
  - Animate in once on mount

- [ ] Add "Net Worth" card to Intel tab (chart + summary label)
- [ ] Styling: axis labels in `SpaceMono`, axis hairlines in `steel`

**Exit criteria:**
- Chart renders on Android at 60fps
- Zero baseline visible
- Point readout works

---

### Phase 3.6 — Caps UI & Alerts
**Duration:** 2–3 days  
**Scope:** Cap CRUD modal + progress display + notifications

**Status:** ✅ COMPLETE

**Tasks:**
- [x] Create `src/app/(modals)/cap.tsx`:
  - **Edit/create cap:** category selector, period (week/month), amount field
  - Save button (big red, `SUBMIT`), delete button (less prominent)
  - Validation: amount > 0

- [ ] Add cap progress cards:
  - Render in a "CAPS WATCH" section in Intel tab (or separate "Limits" tab in future)
  - Per-cap: category name, progress bar (off-white → flips red when exceeded)
  - `CAUTION` stripe overlay when over
  - Tap → edit modal

- [ ] Cap management (CRUD):
  - Add button to create new cap
  - Edit modal on tap
  - Swipe or delete button to remove

- [ ] Local notifications (optional, wired):
  - When a cap is breached, fire `expo-notifications` alert (opt-in setting)
  - Notification text: `"CAUTION: {category} exceeded by {amount}"`

**Exit criteria:**
- Create/edit/delete caps work
- Progress bars animate smoothly
- Over-cap is unmistakable (red + stripe)
- Notification fires (if enabled)

---

### Phase 3.7 — Polish & Reconciliation Testing
**Duration:** 1–2 days  
**Scope:** A11y, motion, invariant checks

**Tasks:**
- [ ] A11y audit:
  - Text contrast (bone on ink, alert on ink, etc.)
  - Form labels (category selector, period)
  - Semantic structure (headings, lists)
  - Test with a screen reader

- [ ] Motion:
  - Charts animate in once; respect `reduce-motion`
  - Tab transitions crisp (≤200ms)
  - No loops on bar/line animations

- [ ] Determinism checks:
  - Log 50 test entries across multiple categories/vaults
  - Run Intel queries
  - Verify every figure matches hand-calculated totals to the cent
  - Cross-check Ledger tab balances

- [ ] Performance:
  - Test with 5k+ entries
  - Measure chart render time (target <500ms)
  - Verify 60fps on Android

**Exit criteria:**
- Contrast ratios pass WCAG AA
- Charts smoke test at scale
- Zero reconciliation mismatches
- Reduce-motion respected

---

## Implementation Order

1. **Phase 3.1** — Analytics queries + unit tests (foundation)
2. **Phase 3.2** — Cap schema + repository + CRUD logic
3. **Phase 3.3** — UI scaffolding (Analyze tab + summary)
4. **Phase 3.4** — Category drill-downs
5. **Phase 3.5** — Net worth chart
6. **Phase 3.6** — Cap UI + alerts
7. **Phase 3.7** — Polish + invariant tests

---

## Definition of Done (M3)

- [ ] `src/lib/analytics.ts` complete with all queries + unit tests
- [ ] `src/lib/db/repositories/cap.ts` complete (CRUD)
- [ ] `src/app/(tabs)/analyze.tsx` renders period switcher + summary + charts
- [ ] Period change propagates to all figures correctly
- [ ] Charts animate smoothly and respect reduce-motion
- [ ] Cap CRUD modal works; progress visible in Intel
- [ ] Over-cap state unmistakable (red + stripe)
- [ ] All figures reconcile to Ledger to the cent (debug assertion passing)
- [ ] A11y audit complete; WCAG AA on primary surfaces
- [ ] Reviewed by `ecc:react-reviewer` + `ecc:typescript-reviewer`
- [ ] No AI, no network calls, no predictions

---

## Notes

- **Charts:** Using RN SVG (lighter than Skia; sufficient for v1)
- **Notifications:** Wired in Phase 3.6 but optional to user
- **Custom ranges:** "Week / Month / Custom range" picker; custom logic deferred to M4 if time-constrained
- **Multi-currency:** Not in M3; amounts stay in their vault's currency (conversion deferred to v1.1)

---

*EDDIES // M3 PLAN — ACTIVE*
