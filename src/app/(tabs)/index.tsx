import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SectionTag } from '@/components/ui/section-tag';
import { EntryRow } from '@/components/ledger/entry-row';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useLedger, type DaySection, type LedgerRow } from '@/hooks/use-ledger';
import { deleteTransaction } from '@/lib/db/repos/transactions';
import { formatAmountTabular } from '@/lib/money';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { useStore } from '@/store';

function LedgerHeader({ balance, sections, hasMixedCurrencies, pendingRow }: { balance: number; sections: DaySection[]; hasMixedCurrencies: boolean; pendingRow: LedgerRow | null }) {
  const sym        = useCurrencySymbol();
  const appLocked  = useStore((s) => s.appLocked);

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

  const netPositive = monthNet >= 0;

  return (
    <View style={hs.wrap}>
      <View style={hs.topRow}>
        <SectionTag label="EDDIES // LEDGER 02-A" />
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
          {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
        </MonoLabel>
      </View>

      <BarcodeMark height={28} />

      <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel} style={hs.balanceLabel}>
        TOTAL BALANCE{hasMixedCurrencies ? ' *' : ''}
      </MonoLabel>
      {hasMixedCurrencies && (
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
          * VAULTS HAVE MIXED CURRENCIES — SUM IS APPROXIMATE
        </MonoLabel>
      )}
      <Numerals size={56} weight="bold" color={effectiveBalance < 0 ? EddiesColors.alert : EddiesColors.bone}>
        {appLocked ? '••••••' : `${effectiveBalance < 0 ? '−' : ''}${sym}${formatAmountTabular(Math.abs(effectiveBalance))}`}
      </Numerals>

      {/* Month stat row */}
      <View style={hs.statRow}>
        <View style={hs.stat}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>IN</MonoLabel>
          <Text style={hs.statVal}>{appLocked ? '••••' : `+${sym}${formatAmountTabular(monthIn)}`}</Text>
        </View>
        <View style={hs.statDivider} />
        <View style={hs.stat}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>OUT</MonoLabel>
          <Text style={[hs.statVal, { color: EddiesColors.alert }]}>{appLocked ? '••••' : `−${sym}${formatAmountTabular(monthOut)}`}</Text>
        </View>
        <View style={hs.statDivider} />
        <View style={hs.stat}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>NET</MonoLabel>
          <Text style={[hs.statVal, { color: netPositive ? EddiesColors.bone : EddiesColors.alert }]}>
            {netPositive ? '+' : '−'}{sym}{formatAmountTabular(Math.abs(monthNet))}
          </Text>
        </View>
      </View>

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

function EmptyState() {
  return (
    <View style={es.wrap}>
      <View style={es.crosshair}>
        <View style={es.hLine} />
        <View style={es.vLine} />
      </View>
      <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel} style={es.text}>
        NO ENTRIES LOGGED
      </MonoLabel>
      <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>
        STANDING BY // TAP + TO LOG
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
      <Pressable onPress={onUndo} hitSlop={12}>
        <MonoLabel size={11} weight="bold" color={EddiesColors.alert}>UNDO</MonoLabel>
      </Pressable>
    </View>
  );
}

export default function LedgerScreen() {
  const db = useSQLiteContext();
  const { sections, totalBalance, hasMixedCurrencies, atRowLimit, loading, reload } = useLedger();

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
      deleteTransaction(db, pendingIdRef.current).then(() => reload()).catch(console.error);
    }
    const label = (row.note?.trim() || row.category_name).slice(0, 28);
    pendingIdRef.current = row.id;
    setPendingDeleteId(row.id);
    setPendingDeleteLabel(label);
    deleteTimerRef.current = setTimeout(() => {
      deleteTimerRef.current = null;
      pendingIdRef.current = null;
      deleteTransaction(db, row.id)
        .then(() => reload())
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
      />
      <SectionList
        style={s.list}
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => <DayHeader section={section} />}
        renderItem={renderItem}
        ListFooterComponent={atRowLimit ? <LedgerLimitBanner /> : null}
        ListEmptyComponent={loading ? null : <EmptyState />}
        ItemSeparatorComponent={() => <View style={s.separator} />}
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
    paddingTop: EddiesSpacing.lg,
    paddingBottom: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    marginTop: EddiesSpacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface,
    borderRadius: 4,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    gap: EddiesSpacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 14,
    color: EddiesColors.bone,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: EddiesColors.steel + '33',
  },
  hairline: {
    height: 1,
    backgroundColor: EddiesColors.steel + '22',
    marginTop: EddiesSpacing.sm,
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
