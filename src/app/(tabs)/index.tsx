import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { EntryRow } from '@/components/ledger/entry-row';
import { LedgerFilterBar } from '@/components/ledger/filter-bar';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useLedger, type DaySection, type FilteredTotals, type LedgerRow } from '@/hooks/use-ledger';
import { useMaterializeOnFocus } from '@/hooks/use-materialize-on-focus';
import { useUpcoming } from '@/hooks/use-upcoming';
import { useInboxCount } from '@/hooks/use-inbox-count';
import { useSmsAutoScan } from '@/hooks/use-sms-auto-scan';
import { deleteTransaction } from '@/lib/db/repos/transactions';
import { formatAmountTabular } from '@/lib/money';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { useStore } from '@/store';

// Graphite "stock card" surface — matches the recurring-rules cards: a raised
// dark panel that lifts off pure-black via its shadow (not a border), with a
// category/state-colored spine carrying the accent.

function LedgerHeader({ balance, sections, hasMixedCurrencies, pendingRow, filterActive, filteredTotals }: { balance: number; sections: DaySection[]; hasMixedCurrencies: boolean; pendingRow: LedgerRow | null; filterActive: boolean; filteredTotals: FilteredTotals | null }) {
  const sym        = useCurrencySymbol();
  const appLocked  = useStore((s) => s.appLocked);
  const upcoming   = useUpcoming();
  const inboxCount = useInboxCount();

  // Optimistically subtract the pending-delete entry from the displayed balance.
  const effectiveBalance = useMemo(() => {
    if (!pendingRow || pendingRow.transfer_group_id !== null) return balance;
    return balance + (pendingRow.kind === 'outflow' ? pendingRow.amount_minor : -pendingRow.amount_minor);
  }, [balance, pendingRow]);

  // Single-pass month aggregate — skip pending-delete row immediately.
  const { monthNet, monthOut, monthIn } = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const cutoff = monthStart.getTime();
    let net = 0, out = 0, inc = 0;
    for (const section of sections) {
      for (const r of section.data) {
        if (pendingRow && r.id === pendingRow.id) continue;
        if (r.occurred_at < cutoff || r.transfer_group_id !== null) continue;
        if (r.kind === 'inflow') { net += r.amount_minor; inc += r.amount_minor; }
        else                     { net -= r.amount_minor; out += r.amount_minor; }
      }
    }
    return { monthNet: net, monthOut: out, monthIn: inc };
  }, [sections, pendingRow]);

  // When a filter is active, the month figure cycle reflects the filtered set
  // (computed in SQL over every match, not just the rendered page).
  const { net: viewNet, out: viewOut, in: viewIn } = filterActive && filteredTotals
    ? filteredTotals
    : { net: monthNet, out: monthOut, in: monthIn };

  const netPositive = viewNet >= 0;
  const netArrow = netPositive ? '▲' : '▼';
  const netColor = netPositive ? EddiesColors.bone : EddiesColors.alert;

  const monthYear = filterActive
    ? `${filteredTotals?.count ?? 0} RESULT${(filteredTotals?.count ?? 0) === 1 ? '' : 'S'}`
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const balanceStr = appLocked ? '••••••' : `${effectiveBalance < 0 ? '−' : ''}${sym}${formatAmountTabular(Math.abs(effectiveBalance))}`;
  const inStr  = appLocked ? '••••' : `+${sym}${formatAmountTabular(viewIn)}`;
  const outStr = appLocked ? '••••' : `−${sym}${formatAmountTabular(viewOut)}`;
  const netStr = appLocked ? '••••' : `${netPositive ? '+' : '−'}${sym}${formatAmountTabular(Math.abs(viewNet))}`;
  const upNetStr = appLocked ? '••••' : `${upcoming.netMinor >= 0 ? '+' : '−'}${sym}${formatAmountTabular(Math.abs(upcoming.netMinor))}`;

  const goInbox = () => router.push('/(modals)/import-inbox');
  const goRecurring = () => router.push('/(modals)/recurring');

  const hasInbox = inboxCount > 0;

  // Right-hand month figure: tap to cycle NET → OUT → IN. NET leads by default.
  const [statIdx, setStatIdx] = useState(0);
  const stats = [
    { label: 'NET', value: netStr, color: netColor, arrow: appLocked ? '' : netArrow },
    { label: 'OUT', value: outStr, color: EddiesColors.alert, arrow: '' },
    { label: 'IN',  value: inStr,  color: EddiesColors.bone,  arrow: '' },
  ];
  const stat = stats[statIdx];
  const cycleStat = () => setStatIdx(i => (i + 1) % stats.length);

  return (
    <View style={hs.wrap}>
      <View style={hs.topRow}>
        <MonoLabel size={11} letterSpacing={3} weight="bold" color={EddiesColors.bone}>LEDGER</MonoLabel>
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>{monthYear}</MonoLabel>
      </View>

      {/* Balance block, then the tap-to-cycle month figure stacked below it. */}
      <View>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel} style={hs.balanceLabel}>
          TOTAL BALANCE{hasMixedCurrencies ? ' *' : ''}
        </MonoLabel>
        {hasMixedCurrencies && (
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
            * VAULTS HAVE MIXED CURRENCIES — SUM IS APPROXIMATE
          </MonoLabel>
        )}
        <Numerals size={hasInbox ? 40 : 52} weight="bold" color={effectiveBalance < 0 ? EddiesColors.alert : EddiesColors.bone}>
          {balanceStr}
        </Numerals>
      </View>

      {/* Month figure below the balance — header's own row gap separates them. */}
      <Pressable onPress={cycleStat} hitSlop={8} style={hs.statTap} accessibilityRole="button"
        accessibilityLabel={`${stat.label} this month ${stat.value}. Tap to cycle month totals.`}>
        <View style={hs.statHead}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>{stat.label}</MonoLabel>
          <MonoLabel size={9} color={EddiesColors.steel + '88'}>›</MonoLabel>
        </View>
        <Text style={[hs.statVal, { color: stat.color }]}>
          {stat.value}{stat.arrow ? ` ${stat.arrow}` : ''}
        </Text>
      </Pressable>

      {/* Priority review card with a direct CTA, only when work waits. */}
      {hasInbox && (
        <Pressable style={hs.cCard} onPress={goInbox} accessibilityRole="button"
          accessibilityLabel={`${inboxCount} ${inboxCount === 1 ? 'entry' : 'entries'} to review`}>
          <View style={hs.tileTop}>
            <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={EddiesColors.bone}>☑ REVIEW INBOX</MonoLabel>
            <View style={hs.inboxBadge}>
              <MonoLabel size={11} weight="bold" color={EddiesColors.ink}>{inboxCount > 99 ? '99+' : inboxCount}</MonoLabel>
            </View>
          </View>
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + 'aa'}>
            {inboxCount} ENTR{inboxCount === 1 ? 'Y' : 'IES'} WAITING
          </MonoLabel>
          <View style={hs.cCta}>
            <MonoLabel size={10} letterSpacing={1.5} weight="bold" color={EddiesColors.ink}>REVIEW ALL  →</MonoLabel>
          </View>
        </Pressable>
      )}

      {/* Quiet navigation line into recurring rules. */}
      <Pressable style={hs.upLine} onPress={goRecurring} accessibilityRole="button"
        accessibilityLabel={upcoming.count > 0 ? `${upcoming.count} scheduled in the next 7 days. View recurring rules.` : 'Set up recurring transactions'}>
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
          {upcoming.count > 0 ? `↻ ${upcoming.count} UPCOMING · ${upNetStr}` : '↻ SET UP RECURRING'}
        </MonoLabel>
        <MonoLabel size={10} color={EddiesColors.steel + '88'}>›</MonoLabel>
      </Pressable>

      <View style={hs.hairline} />
    </View>
  );
}

function LedgerLimitBanner() {
  return (
    <View style={lb.wrap}>
      <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel + '66'}>
        SHOWING LAST 500 ENTRIES — ARCHIVE TO SEE OLDER RECORDS
      </MonoLabel>
    </View>
  );
}

const lb = StyleSheet.create({
  wrap: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '18',
    alignItems: 'center',
  },
});

function DayHeader({ section }: { section: DaySection }) {
  const sym = useCurrencySymbol();
  const dayOut = section.data
    .filter(r => r.kind === 'outflow')
    .reduce((s, r) => s + r.amount_minor, 0);
  const count = section.data.length;

  // Split title into day-name + date, e.g. "THU" and "05 JUN"
  const parts = section.title.split(' '); // ["THU", "05", "JUN"]
  const dayName = parts[0];
  const dateStr = parts.slice(1).join(' ');

  return (
    <View style={dh.row}>
      <View style={dh.left}>
        <Text style={dh.dayName}>{dayName}</Text>
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>{dateStr}</MonoLabel>
      </View>
      <View style={dh.line} />
      <View style={dh.right}>
        {dayOut > 0 && (
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.alert}>
            −{sym}{formatAmountTabular(dayOut)}
          </MonoLabel>
        )}
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
          {count} {count === 1 ? 'ENTRY' : 'ENTRIES'}
        </MonoLabel>
      </View>
    </View>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <View style={es.wrap}>
      <View style={es.crosshair}>
        <View style={es.hLine} />
        <View style={es.vLine} />
      </View>
      <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel} style={es.text}>
        {filtered ? 'NO MATCHES' : 'NO ENTRIES LOGGED'}
      </MonoLabel>
      <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>
        {filtered ? 'ADJUST OR CLEAR THE FILTER' : 'STANDING BY // TAP + TO LOG'}
      </MonoLabel>
    </View>
  );
}

function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <View style={us.bar}>
      <MonoLabel size={11} color={EddiesColors.bone} style={{ flex: 1 }}>
        {label.toUpperCase()} DELETED
      </MonoLabel>
      <Pressable onPress={onUndo} hitSlop={12} accessibilityRole="button" accessibilityLabel="Undo delete entry">
        <MonoLabel size={11} weight="bold" color={EddiesColors.alert}>UNDO</MonoLabel>
      </Pressable>
    </View>
  );
}

export default function LedgerScreen() {
  const db = useSQLiteContext();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  // Post any due recurring transactions when the Ledger gains focus.
  useMaterializeOnFocus();
  // Pull new bank/UPI SMS into the review inbox (Android, opt-in, on focus).
  useSmsAutoScan();
  const { sections, totalBalance, hasMixedCurrencies, atRowLimit, filteredTotals, filterActive, loading, reload } = useLedger();

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState('');

  const pendingDeleteRow = useMemo(() => {
    if (!pendingDeleteId) return null;
    for (const s of sections) {
      const r = s.data.find(row => row.id === pendingDeleteId);
      if (r) return r;
    }
    return null;
  }, [pendingDeleteId, sections]);

  // Commit any pending delete on unmount without calling setState.
  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingIdRef.current) {
      deleteTransaction(db, pendingIdRef.current).catch(console.error);
    }
  }, [db]);

  function handleDelete(row: LedgerRow) {
    if (deleteTimerRef.current && pendingIdRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTransaction(db, pendingIdRef.current).then(() => { reload(); bumpDbVersion(); }).catch(console.error);
    }
    const label = (row.note?.trim() || row.category_name).slice(0, 28);
    pendingIdRef.current = row.id;
    setPendingDeleteId(row.id);
    setPendingDeleteLabel(label);
    deleteTimerRef.current = setTimeout(() => {
      deleteTimerRef.current = null;
      pendingIdRef.current = null;
      deleteTransaction(db, row.id)
        .then(() => { reload(); bumpDbVersion(); })
        .then(() => setPendingDeleteId(prev => (prev === row.id ? null : prev)))
        .catch(console.error);
    }, 4000);
  }

  function handleUndo() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    pendingIdRef.current = null;
    setPendingDeleteId(null);
  }

  const renderItem = useCallback(({ item }: { item: LedgerRow }) => (
    <EntryRow
      row={item}
      isPendingDelete={item.id === pendingDeleteId}
      onPress={() => router.push(`/(modals)/entry?mode=edit&id=${item.id}`)}
      onEdit={() => router.push(`/(modals)/entry?mode=edit&id=${item.id}`)}
      onDelete={() => handleDelete(item)}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [pendingDeleteId]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <LedgerHeader
        balance={totalBalance}
        sections={sections}
        hasMixedCurrencies={hasMixedCurrencies}
        pendingRow={pendingDeleteRow}
        filterActive={filterActive}
        filteredTotals={filteredTotals}
      />
      <LedgerFilterBar />
      <SectionList
        style={s.list}
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => <DayHeader section={section} />}
        renderItem={renderItem}
        ListFooterComponent={atRowLimit ? <LedgerLimitBanner /> : null}
        ListEmptyComponent={loading ? null : <EmptyState filtered={filterActive} />}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      {pendingDeleteId !== null && (
        <UndoBar label={pendingDeleteLabel} onUndo={handleUndo} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  list: { flex: 1 },
  separator: {
    height: 1,
    backgroundColor: EddiesColors.steel + '18',
    marginLeft: 54 + EddiesSpacing.sm * 2,
  },
});

const hs = StyleSheet.create({
  wrap: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.sm,
    gap: EddiesSpacing.sm,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  balanceLabel: { marginBottom: 2 },
  // Balance block, then the tap-to-cycle month figure stacked below (NET · OUT · IN)
  statTap: { alignItems: 'flex-end', gap: 3, marginTop: -EddiesSpacing.md },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statVal: { fontFamily: EddiesFonts.displayBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  // Quiet navigation line into recurring
  upLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: EddiesSpacing.xs,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Priority review card
  cCard: {
    backgroundColor: EddiesColors.card, borderRadius: EddiesRadius.card,
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm + 2, gap: 6,
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  cCta: {
    marginTop: 2, alignSelf: 'flex-start', backgroundColor: EddiesColors.bone,
    borderRadius: EddiesRadius.chip, paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.xs + 2,
  },
  inboxBadge: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: EddiesRadius.chip, backgroundColor: EddiesColors.alert,
    alignItems: 'center', justifyContent: 'center',
  },
  hairline: {
    height: 1, backgroundColor: EddiesColors.steel + '22', marginTop: EddiesSpacing.xs,
  },
});

const dh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs + 2,
    backgroundColor: EddiesColors.surface,
    gap: EddiesSpacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: EddiesSpacing.xs,
  },
  dayName: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 13,
    color: EddiesColors.bone,
    letterSpacing: 1,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + '33',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
});

const es = StyleSheet.create({
  wrap: {
    paddingTop: 80,
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  crosshair: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: EddiesSpacing.sm,
  },
  hLine: {
    position: 'absolute',
    width: 32,
    height: 1,
    backgroundColor: EddiesColors.steel + '66',
  },
  vLine: {
    position: 'absolute',
    width: 1,
    height: 32,
    backgroundColor: EddiesColors.steel + '66',
  },
  text: {
    marginTop: EddiesSpacing.xs,
  },
});

const us = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 90,
    left: EddiesSpacing.md,
    right: EddiesSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EddiesColors.surface,
    borderLeftWidth: 2,
    borderLeftColor: EddiesColors.alert,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    gap: EddiesSpacing.sm,
  },
});
