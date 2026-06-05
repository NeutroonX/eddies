import { useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SectionTag } from '@/components/ui/section-tag';
import { EntryRow } from '@/components/ledger/entry-row';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useLedger, type DaySection, type LedgerRow } from '@/hooks/use-ledger';
import { deleteTransaction } from '@/lib/db/repos/transactions';
import { formatAmountTabular } from '@/lib/money';

// ── Sub-components ────────────────────────────────────────────────────────────

function LedgerHeader({ balance, sections }: { balance: number; sections: DaySection[] }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthNet = sections
    .flatMap(s => s.data)
    .filter(r => r.occurred_at >= monthStart && r.transfer_group_id === null)
    .reduce((sum, r) => r.kind === 'inflow' ? sum + r.amount_minor : sum - r.amount_minor, 0);
  const netPositive = monthNet >= 0;

  return (
    <View style={hs.wrap}>
      <SectionTag label="EDDIES // LEDGER 02-A" />
      <BarcodeMark height={16} />
      <Numerals size={52} color={balance < 0 ? EddiesColors.alert : EddiesColors.bone}>
        {balance < 0 ? '−' : ''}{formatAmountTabular(Math.abs(balance))}
      </Numerals>
      <MonoLabel size={11} color={netPositive ? EddiesColors.bone : EddiesColors.alert}>
        {netPositive ? '+' : '−'}{formatAmountTabular(Math.abs(monthNet))} THIS MONTH
      </MonoLabel>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={es.wrap}>
      <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
        NO ENTRIES LOGGED // STANDING BY
      </MonoLabel>
    </View>
  );
}

function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <View style={us.bar}>
      <MonoLabel size={11} color={EddiesColors.bone} style={{ flex: 1 }} numberOfLines={1}>
        {label.toUpperCase()} DELETED
      </MonoLabel>
      <Pressable onPress={onUndo} hitSlop={12}>
        <MonoLabel size={11} weight="bold" color={EddiesColors.alert}>UNDO</MonoLabel>
      </Pressable>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LedgerScreen() {
  const db = useSQLiteContext();
  const { sections, totalBalance, loading, reload } = useLedger();

  // Undo state — pending delete is soft (row fades); DB write deferred 4s.
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState('');

  function handleDelete(row: LedgerRow) {
    // Commit any existing in-flight delete immediately.
    if (deleteTimerRef.current && pendingIdRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTransaction(db, pendingIdRef.current).then(() => reload()).catch(console.error);
    }

    const label = (row.note?.trim() || row.category_name).slice(0, 28);
    pendingIdRef.current = row.id;
    setPendingDeleteId(row.id);
    setPendingDeleteLabel(label);

    deleteTimerRef.current = setTimeout(() => {
      deleteTransaction(db, row.id).then(() => reload()).catch(console.error);
      deleteTimerRef.current = null;
      pendingIdRef.current = null;
      setPendingDeleteId(prev => (prev === row.id ? null : prev));
    }, 4000);
  }

  function handleUndo() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    pendingIdRef.current = null;
    setPendingDeleteId(null);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={s.dayHeader}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>{section.title}</MonoLabel>
          </View>
        )}
        renderItem={({ item }) => (
          <EntryRow
            row={item}
            isPendingDelete={item.id === pendingDeleteId}
            onPress={() => { /* TODO M2: edit sheet */ }}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListHeaderComponent={<LedgerHeader balance={totalBalance} sections={sections} />}
        ListEmptyComponent={loading ? null : <EmptyState />}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: EddiesColors.steel + '1A', marginLeft: 52 }} />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {pendingDeleteId !== null && (
        <UndoBar label={pendingDeleteLabel} onUndo={handleUndo} />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  dayHeader: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs + 2,
    backgroundColor: EddiesColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '22',
  },
});

const hs = StyleSheet.create({
  wrap: { padding: EddiesSpacing.md, paddingTop: EddiesSpacing.lg, gap: EddiesSpacing.xs },
});

const es = StyleSheet.create({
  wrap: { paddingTop: 100, alignItems: 'center' },
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
    borderWidth: 1,
    borderColor: EddiesColors.steel + '55',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    gap: EddiesSpacing.sm,
  },
});
