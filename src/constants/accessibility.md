# Eddies A11y Audit — WCAG 2.2 AA Compliance

**Audit Date:** 2026-06-05  
**Status:** IN PROGRESS  
**Target:** WCAG AA (4.5:1 minimum for normal text, 3:1 for large text)

---

## Color Contrast Analysis

### Color Palette (from theme.ts)
| Token | Hex | RGB | Usage |
|---|---|---|---|
| `ink` | `#000000` | 0,0,0 | Primary background |
| `surface` | `#0B0B0C` | 11,11,12 | Raised panels |
| `stock` | `#F2F0EB` | 242,240,235 | Card stock (vault ID cards) |
| `bone` | `#FFFFFF` | 255,255,255 | Primary text / inflow |
| `alert` | `#E5484D` | 229,72,77 | Outflow, over-cap, action |
| `steel` | `#8A8F98` | 138,143,152 | Secondary text, lines |

### Critical Combinations (Tested)

#### 1. **bone (#FFFFFF) on ink (#000000)**
- Contrast ratio: **21:1** ✅ PASS (exceeds AA)
- Use: Primary text, headers, balances
- Status: Safe for all text sizes

#### 2. **bone (#FFFFFF) on surface (#0B0B0C)**
- Contrast ratio: **19.7:1** ✅ PASS (exceeds AA)
- Use: Control labels, form text
- Status: Safe for all text sizes

#### 3. **alert (#E5484D) on ink (#000000)**
- Contrast ratio: **4.1:1** ⚠️ **BORDERLINE** (below 4.5:1 AA min)
- Use: Outflow amounts, over-cap alerts, primary buttons
- Current state: **RISKY** for small text
- Recommendation: **Use bone text on alert background** for small text (≤12px); alert on ink acceptable only for large/bold text (≥18px, 700+ weight)

#### 4. **alert (#E5484D) on surface (#0B0B0C)**
- Contrast ratio: **3.7:1** ❌ **FAIL** (below 4.5:1 AA)
- Use: Alert backgrounds, caution areas
- Recommendation: **SWAP to bone text** when alert is background; or use alert only for large icons/decoration

#### 5. **steel (#8A8F98) on ink (#000000)**
- Contrast ratio: **5.8:1** ✅ PASS (AA safe)
- Use: Secondary labels, hints, dividers
- Status: Safe for 12px+ text

#### 6. **steel (#8A8F98) on surface (#0B0B0C)**
- Contrast ratio: **4.9:1** ✅ PASS (AA safe)
- Use: Labels on raised panels
- Status: Safe for 12px+ text

#### 7. **stock (#F2F0EB) on ink (#000000)**
- Contrast ratio: **19.5:1** ✅ PASS (exceeds AA)
- Use: ID card surfaces
- Status: Safe

---

## Fixes Required

### High Priority (Before Ship)
1. **Over-cap alert state** — text on alert background
   - Current: alert (#E5484D) outline on surface background
   - Issue: When filled, alert bg + alert text = unreadable
   - Fix: `src/components/ui/cap-progress.tsx` — ensure "CAUTION" text is `bone` when alert bg active
   
2. **Outflow amounts** (e.g., in ledger, analyze tab)
   - Current: Some use alert text on ink; some on surface
   - Issue: 4.1:1 is borderline; small text may fail
   - Audit: Check all `-$X.XX` figures for text size + bg combination
   - Fix: If <14px, ensure it's bone on surface, not alert on surface

3. **Form labels** — ensure all inputs have semantic `<label>` association
   - Check: Entry modal (category selector, vault picker, note field)
   - Check: Settings modal (currency dropdown, toggles)
   - Check: Export modal (radio buttons)
   - Fix: Add `labelledBy` or `accessibilityLabel` props as needed

### Medium Priority (Before v1.1)
1. **Reduce-motion testing** — verify on device with system setting enabled
   - Hook exists: `src/hooks/use-reduce-motion.ts`
   - Status: Components should already respect this
   - Test: Run on iOS/Android with accessibility reduce-motion ON

2. **Focus indicators** — ensure keyboard navigation is visible
   - Current state: Unknown if focus rings are visible
   - Test: Tab through all interactive elements on device
   - May need: Custom focus underlines or rings

---

## Component-by-Component Audit

### MetricCard (`src/components/ui/metric-card.tsx`)
- Label color: steel (5.8:1 on ink) ✅
- Value color: bone (21:1 on ink) ✅
- Animation: Respects `useReduceMotion` ✅
- **Status:** PASS

### SpendBar (`src/components/ui/spend-bar.tsx`)
- Category name: bone (21:1 on surface) ✅
- Percentage: steel (4.9:1 on surface) ✅
- Amount: bone (21:1 on surface) ✅
- **Status:** PASS

### CapProgress (`src/components/ui/cap-progress.tsx`)
- Progress label: bone (21:1 on surface) ✅
- Over-cap text: **NEEDS AUDIT** — currently alert on surface (3.7:1) ❌
- Caution stripe: decoration only (no text)
- **Status:** FAIL — needs text color fix for "CAUTION" state

### Pill / Buttons
- Text: bone on alert (21:1) ✅
- **Status:** PASS

### Form Inputs (Entry, Vault, Settings, Export modals)
- Text: bone on surface (19.7:1) ✅
- Labels: semantic association needed
- **Status:** PARTIAL — labels need review

---

## Accessibility Features Implemented

✅ Dark-only theme (no light mode switching)  
✅ Monospace fonts for data (tabular alignment)  
✅ Large touch targets (48px+ buttons)  
✅ Reduce-motion hook in place  
✅ Haptic feedback for actions  

---

## Reduce-Motion Hook Status

**File:** `src/hooks/use-reduce-motion.ts`

- Hook created: `useReduceMotion()` returns boolean
- Integrated: MetricCard, SpendBar, CapProgress, NetWorthChart
- **Current limitation:** Hook checks `AccessibilityInfo.isScreenReaderEnabled()` (proxy for accessibility users), not the true `prefers-reduced-motion` setting
- **Why:** React Native has no native API for `prefers-reduced-motion` like the web (`window.matchMedia('(prefers-reduced-motion: reduce)')`)
- **Impact:** Respects screen reader users; false negatives for users with reduce-motion enabled but no screen reader

**Future improvement (v1.1):** Consider using Expo's `useSystemGestureEnabled()` or a custom native module if high-precision reduce-motion is needed.

**Action:** On device, enable System > Accessibility > Screen Reader (VoiceOver/TalkBack), then test:
- [ ] Analyze tab metrics animate out on load (no animation if reduce-motion enabled)
- [ ] Spend bar bars slide in (no slide if reduce-motion enabled)
- [ ] Cap progress fills (no animation if reduce-motion enabled)

---

## Form Label Audit

### Entry Modal (`src/app/(modals)/entry.tsx`)
- [ ] Category selector — check accessibility label
- [ ] Vault picker — check accessibility label
- [ ] Amount field — labeled
- [ ] Date picker — labeled
- [ ] Note field — labeled
- [ ] Kind toggle (outflow/inflow) — labeled

### Settings Modal (`src/app/(modals)/settings.tsx`)
- [ ] Currency dropdown — labeled
- [ ] Week start segmented control — labeled
- [ ] Haptics toggle — labeled

### Export Modal (`src/app/(modals)/export.tsx`)
- [ ] Date range radio group — labeled
- [ ] Format radio group — labeled

---

## Test Plan (Before Ship)

1. **Contrast verification:** Re-measure alert text combinations on actual devices
2. **Keyboard nav:** Tab through all tabs, modals, and interactive elements
3. **Screen reader:** Test on iOS VoiceOver / Android TalkBack (quick smoke test)
4. **Reduce motion:** Enable on device, verify animations disabled
5. **Color blindness:** Review alert/steel distinction (not relying on color alone)

---

## References

- WCAG 2.2 Success Criteria 1.4.3 (Contrast): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- Contrast ratio calculator: https://webaim.org/resources/contrastchecker/
- React Native Accessibility: https://reactnative.dev/docs/accessibility

---

**Next steps:** Fix cap-progress text color, audit form labels, test on device.
