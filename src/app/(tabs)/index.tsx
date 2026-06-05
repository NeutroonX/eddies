import { useRef, useState } from 'react';
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

function LedgerHeader({ balance, sections }: { balance: number; sections: DaySection[] }) {
  const sym = useCurrencySymbol();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEntries = sections.flatMap(s => s.data).filter(r => r.occurred_at >= monthStart && r.transfer_group_id === null);
  const monthNet = monthEntries.reduce((sum, r) => r.kind === 'inflow' ? sum + r.amount_minor : sum - r.amount_minor, 0);
  const monthOut = monthEntries.filter(r => r.kind === 'outflow').reduce((s, r) => s + r.amount_minor, 0);
  const monthIn = monthEntries.filter(r => r.kind === 'inflow').reduce((s, r) => s + r.amount_minor, 0);
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
        TOTAL BALANCE
      </MonoLabel>
      <Numerals size={56} weight="bold" color={balance < 0 ? EddiesColors.alert : EddiesColors.bone}>
        {balance < 0 ? '−' : ''}{sym}{formatAmountTabular(Math.abs(balance))}
      </Numerals>

      {/* Month stat row */}
      <View style={hs.statRow}>
        <View style={hs.stat}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>IN</MonoLabel>
          <Text style={hs.statVal}>+{sym}{formatAmountTabular(monthIn)}</Text>
        </View>
        <View style={hs.statDivider} />
        <View style={hs.stat}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>OUT</MonoLabel>
          <Text style={[hs.statVal, { color: EddiesColors.alert }]}>−{sym}{formatAmountTabular(monthOut)}</Text>
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
  const { sections, totalBalance, loading, reload } = useLedger();

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState('');

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
        renderSectionHeader={({ section }) => <DayHeader section={section} />}
        renderItem={({ item }) => (
          <EntryRow
            row={item}
            isPendingDelete={item.id === pendingDeleteId}
            onPress={() => router.push(`/(modals)/entry?mode=edit&id=${item.id}`)}
            onEdit={() => router.push(`/(modals)/entry?mode=edit&id=${item.id}`)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListHeaderComponent={<LedgerHeader balance={totalBalance} sections={sections} />}
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
