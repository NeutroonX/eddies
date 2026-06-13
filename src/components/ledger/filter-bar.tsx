import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { Sheet } from '@/components/ui/sheet';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import { useStore } from '@/store';
import { activeFilterCount, isFilterActive, type LedgerKindFilter } from '@/store/ui';

const KIND_LABELS: Record<LedgerKindFilter, string> = {
  all: 'ALL', outflow: 'OUT', inflow: 'IN', transfer: 'TRANSFER',
};

// ── Date presets ────────────────────────────────────────────────────────────
function startOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function endOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime(); }

type DatePreset = { key: string; label: string; from: number | null; to: number | null };
function datePresets(): DatePreset[] {
  const now = new Date();
  const to = endOfDay(now);
  const day = 86_400_000;
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return [
    { key: 'all',   label: 'ALL',        from: null,                          to: null },
    { key: '7d',    label: 'LAST 7D',    from: startOfDay(new Date(now.getTime() - 6 * day)),  to },
    { key: '30d',   label: 'LAST 30D',   from: startOfDay(new Date(now.getTime() - 29 * day)), to },
    { key: 'month', label: 'THIS MONTH', from: monthStart,                    to },
  ];
}

/** Parse a user-entered major-unit amount string to minor units, or null. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  // Zero (or non-finite) is not a meaningful bound — treat as "no constraint".
  if (!Number.isFinite(n) || n <= 0) return null;
  return toMinorUnits(n);
}

const SEARCH_DEBOUNCE_MS = 250;

/** Minimal three-bar "filter" mark, drawn from tokens (no icon dependency). */
function FilterGlyph({ color }: { color: string }) {
  return (
    <View style={s.glyph}>
      <View style={[s.glyphBar, { width: 13, backgroundColor: color }]} />
      <View style={[s.glyphBar, { width: 9, backgroundColor: color }]} />
      <View style={[s.glyphBar, { width: 5, backgroundColor: color }]} />
    </View>
  );
}

/** One labelled block inside the filter sheet — uniform rhythm for every group. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>{label}</MonoLabel>
      {children}
    </View>
  );
}

/**
 * Ledger search + filter (§6.3). Search input is live; structured constraints
 * (kind / vault / category / date / amount) live in a bottom sheet. Active
 * constraints surface as removable chips. All state is session-only Zustand.
 */
export function LedgerFilterBar() {
  const filter = useStore(s => s.ledgerFilter);
  const patch = useStore(s => s.patchLedgerFilter);
  const reset = useStore(s => s.resetLedgerFilter);
  const sym = useCurrencySymbol();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [sheetOpen, setSheetOpen] = useState(false);
  // Search input is local + debounced so the box responds instantly while the
  // SQL re-query only fires after the user pauses typing.
  const [searchInput, setSearchInput] = useState(filter.text);
  // Amount inputs keep local string state so partial entry ("1.") isn't clobbered.
  const [minStr, setMinStr] = useState(filter.amountMin !== null ? String(fromMinorUnits(filter.amountMin)) : '');
  const [maxStr, setMaxStr] = useState(filter.amountMax !== null ? String(fromMinorUnits(filter.amountMax)) : '');

  // Debounce the store write that drives the ledger query (patch is a stable
  // Zustand action). The box updates instantly; the SQL re-query waits for a pause.
  useEffect(() => {
    const id = setTimeout(() => {
      // Skip the no-op patch on mount (avoids a spurious re-query): a new store
      // object would otherwise re-trigger the ledger filter effect for nothing.
      if (searchInput !== filter.text) patch({ text: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, filter.text, patch]);

  // Every path that clears the filter routes through here, keeping the local
  // search/amount strings in lockstep with the store (the only reset callers).
  function clearAll() {
    reset();
    setSearchInput(''); setMinStr(''); setMaxStr('');
  }

  const count = activeFilterCount(filter);
  const active = isFilterActive(filter);
  // Memoized so timestamps are stable across renders (a midnight rollover is
  // refreshed on remount, the right granularity for date presets).
  const presets = useMemo(() => datePresets(), []);
  const activePresetKey = presets.find(p => p.from === filter.dateFrom && p.to === filter.dateTo)?.key ?? null;

  const vaultName = accounts.find(a => a.id === filter.vaultId)?.name ?? null;
  const catName = categories.find(c => c.id === filter.categoryId)?.name ?? null;

  function amountChipLabel(): string | null {
    const { amountMin, amountMax } = filter;
    if (amountMin !== null && amountMax !== null) return `${sym}${fromMinorUnits(amountMin)}–${sym}${fromMinorUnits(amountMax)}`;
    if (amountMin !== null) return `≥ ${sym}${fromMinorUnits(amountMin)}`;
    if (amountMax !== null) return `≤ ${sym}${fromMinorUnits(amountMax)}`;
    return null;
  }
  function dateChipLabel(): string | null {
    if (filter.dateFrom === null && filter.dateTo === null) return null;
    const preset = presets.find(p => p.from === filter.dateFrom && p.to === filter.dateTo);
    return preset ? preset.label : 'CUSTOM RANGE';
  }

  function clearAmount() {
    setMinStr(''); setMaxStr('');
    patch({ amountMin: null, amountMax: null });
  }

  // Evaluate once per render (each was previously called twice).
  const dateLabel = dateChipLabel();
  const amountLabel = amountChipLabel();

  return (
    <View style={s.wrap}>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <MonoLabel size={12} color={EddiesColors.steel + '99'}>⌕</MonoLabel>
          <TextInput
            style={s.input}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="SEARCH"
            placeholderTextColor={EddiesColors.steel + '66'}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search ledger entries"
          />
          {searchInput !== '' && (
            <Pressable onPress={() => setSearchInput('')} hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Clear search text">
              <MonoLabel size={11} color={EddiesColors.steel}>✕</MonoLabel>
            </Pressable>
          )}
        </View>
        <Pressable style={[s.filterBtn, count > 0 && s.filterBtnActive]} onPress={() => setSheetOpen(true)}
          accessibilityRole="button" accessibilityLabel={`Filters${count > 0 ? `, ${count} active` : ''}`}>
          <FilterGlyph color={count > 0 ? EddiesColors.ink : EddiesColors.steel} />
          {count > 0 && (
            <View style={s.countBadge}>
              <MonoLabel size={8} weight="bold" color={EddiesColors.bone}>{count}</MonoLabel>
            </View>
          )}
        </Pressable>
      </View>

      {active && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {filter.kind !== 'all' && (
            <Pill label={KIND_LABELS[filter.kind]} active onRemove={() => patch({ kind: 'all' })} />
          )}
          {vaultName && (
            <Pill label={vaultName} active onRemove={() => patch({ vaultId: null })} />
          )}
          {catName && (
            <Pill label={catName} active onRemove={() => patch({ categoryId: null })} />
          )}
          {dateLabel && (
            <Pill label={dateLabel} active onRemove={() => patch({ dateFrom: null, dateTo: null })} />
          )}
          {amountLabel && (
            <Pill label={amountLabel} active onRemove={clearAmount} />
          )}
          <Pressable onPress={clearAll} hitSlop={8} style={s.clearAll}
            accessibilityRole="button" accessibilityLabel="Clear all filters">
            <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={EddiesColors.alert}>CLEAR</MonoLabel>
          </Pressable>
        </ScrollView>
      )}

      <Sheet visible={sheetOpen} title="FILTER LEDGER" onClose={() => setSheetOpen(false)}>
        <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Section label="KIND">
            <View style={s.pillRow}>
              {(Object.keys(KIND_LABELS) as LedgerKindFilter[]).map(k => (
                <Pill key={k} label={KIND_LABELS[k]} active={filter.kind === k}
                  onPress={() => patch({ kind: k })} />
              ))}
            </View>
          </Section>

          <Section label="DATE RANGE">
            <View style={s.pillRow}>
              {presets.map(p => (
                <Pill key={p.key} label={p.label}
                  active={p.key === 'all' ? !filter.dateFrom && !filter.dateTo : activePresetKey === p.key}
                  onPress={() => patch({ dateFrom: p.from, dateTo: p.to })} />
              ))}
            </View>
          </Section>

          <Section label={`AMOUNT (${sym})`}>
            <View style={s.amountRow}>
              <TextInput
                style={s.amountInput} value={minStr}
                onChangeText={(t) => { setMinStr(t); patch({ amountMin: parseAmount(t) }); }}
                placeholder="MIN" placeholderTextColor={EddiesColors.steel + '66'}
                keyboardType="decimal-pad" accessibilityLabel="Minimum amount" />
              <MonoLabel size={11} color={EddiesColors.steel}>–</MonoLabel>
              <TextInput
                style={s.amountInput} value={maxStr}
                onChangeText={(t) => { setMaxStr(t); patch({ amountMax: parseAmount(t) }); }}
                placeholder="MAX" placeholderTextColor={EddiesColors.steel + '66'}
                keyboardType="decimal-pad" accessibilityLabel="Maximum amount" />
            </View>
          </Section>

          <Section label="VAULT">
            <View style={s.pillRow}>
              <Pill label="ANY" active={filter.vaultId === null} onPress={() => patch({ vaultId: null })} />
              {accounts.filter(a => a.archived === 0).map(a => (
                <Pill key={a.id} label={a.name} active={filter.vaultId === a.id}
                  onPress={() => patch({ vaultId: filter.vaultId === a.id ? null : a.id })} />
              ))}
            </View>
          </Section>

          <Section label="CATEGORY">
            <View style={s.pillRow}>
              <Pill label="ANY" active={filter.categoryId === null} onPress={() => patch({ categoryId: null })} />
              {categories.filter(c => c.archived === 0).map(c => (
                <Pill key={c.id} label={c.name} color={c.color} active={filter.categoryId === c.id}
                  onPress={() => patch({ categoryId: filter.categoryId === c.id ? null : c.id })} />
              ))}
            </View>
          </Section>

        </ScrollView>

        <View style={s.sheetFooter}>
          <Pressable style={s.resetBtn} onPress={clearAll}
            accessibilityRole="button" accessibilityLabel="Reset all filters">
            <MonoLabel size={10} letterSpacing={1.5} weight="bold" color={EddiesColors.steel}>RESET</MonoLabel>
          </Pressable>
          <Pressable style={s.doneBtn} onPress={() => setSheetOpen(false)}
            accessibilityRole="button" accessibilityLabel="Apply filters">
            <MonoLabel size={10} letterSpacing={1.5} weight="bold" color={EddiesColors.ink}>DONE</MonoLabel>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.xs,
    paddingBottom: EddiesSpacing.sm,
    gap: EddiesSpacing.sm,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface, borderRadius: EddiesRadius.panel,
    paddingHorizontal: EddiesSpacing.sm + 2, height: 34,
  },
  input: {
    flex: 1, color: EddiesColors.bone, fontFamily: EddiesFonts.mono,
    fontSize: 12, letterSpacing: 1.5, padding: 0,
  },
  filterBtn: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    backgroundColor: EddiesColors.surface, borderRadius: EddiesRadius.panel,
  },
  filterBtnActive: { backgroundColor: EddiesColors.bone },
  glyph: { alignItems: 'center', gap: 2.5 },
  glyphBar: { height: 1.5, borderRadius: 1 },
  countBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 14, height: 14, paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: EddiesRadius.chip, backgroundColor: EddiesColors.alert,
    borderWidth: 1.5, borderColor: EddiesColors.ink,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm, paddingRight: EddiesSpacing.md },
  clearAll: { paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.chipV },

  sheetScroll: { maxHeight: 480 },
  section: { marginTop: EddiesSpacing.lg, gap: EddiesSpacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: EddiesSpacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  amountInput: {
    flex: 1, color: EddiesColors.bone, fontFamily: EddiesFonts.mono,
    fontSize: 13, letterSpacing: 1, height: 40, paddingHorizontal: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface, borderRadius: EddiesRadius.panel,
    borderWidth: 1, borderColor: EddiesColors.steel + '22',
  },
  sheetFooter: {
    flexDirection: 'row', gap: EddiesSpacing.sm,
    paddingTop: EddiesSpacing.md, marginTop: EddiesSpacing.xs,
  },
  resetBtn: {
    flex: 1, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: EddiesRadius.panel, borderWidth: 1, borderColor: EddiesColors.steel + '44',
  },
  doneBtn: {
    flex: 2, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: EddiesRadius.panel, backgroundColor: EddiesColors.bone,
  },
});
