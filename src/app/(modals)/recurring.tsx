import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { archiveRule, getRules, pauseRule } from '@/lib/db/repos/recurring';
import { monthlyEquivalentMinor, nextRunAt, scheduleSummary } from '@/lib/recurring/describe';
import { formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store';
import type { RecurringRule } from '@/lib/schemas';

function formatNextRun(ms: number | null): string {
  if (ms === null) return 'ENDED';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${day} ${mon}`;
}

function RuleRow({
  rule, categoryName, vaultName, sym, onEdit, onPause, onDelete,
}: {
  rule: RecurringRule;
  categoryName: string;
  vaultName: string;
  sym: string;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
}) {
  const isOut = rule.kind === 'outflow';
  const amountColor = rule.paused ? EddiesColors.steel : isOut ? EddiesColors.alert : EddiesColors.bone;
  const next = nextRunAt(rule);

  return (
    <Pressable style={[r.row, rule.paused ? r.rowPaused : null]} onPress={onEdit}
      accessibilityRole="button" accessibilityLabel={`Edit ${categoryName} rule`}>
      <View style={r.left}>
        <Text style={[r.amount, { color: amountColor }]}>
          {isOut ? '−' : '+'}{sym}{formatAmountTabular(rule.amount_minor)}
        </Text>
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
          {scheduleSummary(rule)}
        </MonoLabel>
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '99'}>
          {categoryName.toUpperCase()} · {vaultName.toUpperCase()}
        </MonoLabel>
      </View>

      <View style={r.right}>
        <View style={[r.badge, rule.mode === 'auto' ? r.badgeAuto : r.badgeConfirm]}>
          <MonoLabel size={7} letterSpacing={1}
            color={rule.mode === 'auto' ? EddiesColors.ink : EddiesColors.steel}>
            {rule.mode === 'auto' ? 'AUTO' : 'CONFIRM'}
          </MonoLabel>
        </View>
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel}>
          {rule.paused ? 'PAUSED' : `NEXT ${formatNextRun(next)}`}
        </MonoLabel>
        <MonoLabel size={7} letterSpacing={0.5} color={EddiesColors.steel + '88'}>
          ≈{sym}{formatAmountTabular(monthlyEquivalentMinor(rule))}/MO
        </MonoLabel>
        <View style={r.actions}>
          <Pressable onPress={onPause} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={rule.paused ? 'Resume rule' : 'Pause rule'}>
            <MonoLabel size={9} color={EddiesColors.steel}>{rule.paused ? '▶' : '❙❙'}</MonoLabel>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete rule">
            <MonoLabel size={9} color={EddiesColors.alert}>✕</MonoLabel>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function RecurringListModal() {
  const db = useSQLiteContext();
  const sym = useCurrencySymbol();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await getRules(db);
    setRules(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const nameFor = (id: string | null, list: { id: string; name: string }[], fallback: string) =>
    id ? list.find(x => x.id === id)?.name ?? fallback : fallback;

  async function handlePause(rule: RecurringRule) {
    await pauseRule(db, rule.id, rule.paused === 0);
    await reload();
    bumpDbVersion();
  }
  async function handleDelete(rule: RecurringRule) {
    await archiveRule(db, rule.id);
    await reload();
    bumpDbVersion();
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EDDIES // RECURRING</MonoLabel>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      <Pressable style={s.newBtn} onPress={() => router.push('/(modals)/recurring-edit')}
        accessibilityRole="button" accessibilityLabel="New recurring rule">
        <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.alert}>+ NEW RULE</MonoLabel>
      </Pressable>

      <FlatList
        data={rules}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <RuleRow
            rule={item}
            categoryName={nameFor(item.category_id, categories, 'Uncategorized')}
            vaultName={nameFor(item.account_id, accounts, '— No Vault')}
            sym={sym}
            onEdit={() => router.push(`/(modals)/recurring-edit?mode=edit&id=${item.id}`)}
            onPause={() => handlePause(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>NO RECURRING RULES</MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>
              AUTOMATE RENT, SALARY, SUBSCRIPTIONS
            </MonoLabel>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '22',
  },
  newBtn: {
    margin: EddiesSpacing.md, paddingVertical: EddiesSpacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: EddiesColors.alert, borderStyle: 'dashed', borderRadius: 4,
  },
  sep: { height: 1, backgroundColor: EddiesColors.steel + '18' },
  empty: { paddingTop: 80, alignItems: 'center', gap: EddiesSpacing.sm },
});

const r = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.md,
  },
  rowPaused: { opacity: 0.55 },
  left: { flex: 1, gap: 3 },
  amount: { fontFamily: EddiesFonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  right: { alignItems: 'flex-end', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  badgeAuto: { backgroundColor: EddiesColors.bone },
  badgeConfirm: { borderWidth: 1, borderColor: EddiesColors.steel + '66' },
  actions: { flexDirection: 'row', gap: EddiesSpacing.md, marginTop: 2 },
});
