import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { archiveRule, getRules, pauseRule } from '@/lib/db/repos/recurring';
import { materializeDueRules } from '@/lib/recurring/materialize';
import {
  formatRunDate, monthlyEquivalentMinor, nextRunAt, scheduleSummary,
} from '@/lib/recurring/describe';
import { formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store';
import type { RecurringRule } from '@/lib/schemas';

// Graphite card surface — a raised dark panel that lifts off pure-black via its
// shadow (not a border). The category spine + the figure carry the identity.
const CARD_BG = '#1A1B1E';
const TXT_PRIMARY = EddiesColors.bone;
const TXT_SECONDARY = EddiesColors.steel;
const TXT_FAINT = EddiesColors.steel + '88';

// ─── Committed-per-month dashboard (borderless, lives on black) ──────────────
function CommittedPanel({
  out, inn, net, active, sym,
}: { out: number; inn: number; net: number; active: number; sym: string }) {
  const cols: { label: string; value: string; color: string }[] = [
    { label: 'OUT', value: `−${sym}${formatAmountTabular(out)}`, color: EddiesColors.alert },
    { label: 'IN', value: `+${sym}${formatAmountTabular(inn)}`, color: EddiesColors.bone },
    {
      label: 'NET',
      value: `${net >= 0 ? '+' : '−'}${sym}${formatAmountTabular(Math.abs(net))}`,
      color: net >= 0 ? EddiesColors.bone : EddiesColors.alert,
    },
  ];
  return (
    <View style={d.wrap}>
      <View style={d.head}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>↻ RECURRING / MONTH</MonoLabel>
        <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel + '99'}>{active} ACTIVE</MonoLabel>
      </View>
      <View style={d.row}>
        {cols.map(col => (
          <View key={col.label} style={d.col}>
            <Text style={[d.value, { color: col.color }]}>{col.value}</Text>
            <MonoLabel size={7.5} letterSpacing={2} color={EddiesColors.steel}>{col.label}</MonoLabel>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── New-rule action (solid, no dashed border) ───────────────────────────────
function NewRuleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={n.btn} onPress={onPress} accessibilityRole="button" accessibilityLabel="New recurring rule">
      <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.bone}>+  NEW RULE</MonoLabel>
    </Pressable>
  );
}

// ─── Rule card (cream "stock" card) ──────────────────────────────────────────
function StockRuleCard({
  rule, categoryName, categoryColor, vaultName, sym, onEdit, onPause, onDelete,
}: {
  rule: RecurringRule;
  categoryName: string;
  categoryColor: string;
  vaultName: string;
  sym: string;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
}) {
  const paused = rule.paused === 1;
  const isOut = rule.kind === 'outflow';
  const amountColor = isOut ? EddiesColors.alert : TXT_PRIMARY;
  const next = nextRunAt(rule);
  const showProgress = rule.end_kind === 'after_n' && rule.end_count != null;

  return (
    <Pressable style={[c.card, paused && c.paused]} onPress={onEdit}
      accessibilityRole="button" accessibilityLabel={`Edit ${categoryName} rule`}>
      <View style={c.body}>
        {/* Tag + mode */}
        <View style={c.top}>
          <View style={c.tag}>
            <View style={[c.tagDot, { backgroundColor: categoryColor }]} />
            <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={TXT_PRIMARY}>
              {categoryName.toUpperCase()}
            </MonoLabel>
          </View>
          <View style={[c.badge, rule.mode === 'auto' ? c.badgeAuto : c.badgeConfirm]}>
            <MonoLabel size={7} letterSpacing={1.5}
              color={rule.mode === 'auto' ? EddiesColors.ink : TXT_SECONDARY}>
              {rule.mode === 'auto' ? 'AUTO' : 'CONFIRM'}
            </MonoLabel>
          </View>
        </View>

        {/* Figure */}
        <Text style={[c.amount, { color: amountColor }]}>
          {isOut ? '−' : '+'}{sym}{formatAmountTabular(rule.amount_minor)}
        </Text>

        {/* Cadence + vault */}
        <MonoLabel size={8} letterSpacing={1} color={TXT_SECONDARY}>
          {scheduleSummary(rule)} · {vaultName.toUpperCase()}
          {showProgress ? `  ·  ${rule.occurrences_made}/${rule.end_count}` : ''}
        </MonoLabel>

        {/* Footer: next chip + monthly + actions */}
        <View style={c.foot}>
          <View style={c.footL}>
            <View style={c.nextChip}>
              <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.bone}>
                {paused ? '❙❙ PAUSED' : `↻ NEXT ${formatRunDate(next)}`}
              </MonoLabel>
            </View>
            <MonoLabel size={8} letterSpacing={0.5} color={TXT_FAINT}>
              ≈{sym}{formatAmountTabular(monthlyEquivalentMinor(rule))}/MO
            </MonoLabel>
          </View>
          <View style={c.actions}>
            <Pressable onPress={onPause} hitSlop={10} style={c.actBtn} accessibilityRole="button"
              accessibilityLabel={paused ? 'Resume rule' : 'Pause rule'}>
              <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={TXT_SECONDARY}>
                {paused ? 'RESUME' : 'PAUSE'}
              </MonoLabel>
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={10} style={c.actBtn} accessibilityRole="button"
              accessibilityLabel="Stop rule">
              <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={EddiesColors.alert}>STOP</MonoLabel>
            </Pressable>
          </View>
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
  const showToast = useStore(s => s.showToast);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await getRules(db);
    setRules(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const committed = useMemo(() => {
    let out = 0, inn = 0, active = 0;
    for (const rule of rules) {
      if (rule.paused === 1) continue;
      active += 1;
      const m = monthlyEquivalentMinor(rule);
      if (rule.kind === 'outflow') out += m; else inn += m;
    }
    return { out, inn, active, net: inn - out };
  }, [rules]);

  const catFor = (id: string | null) => (id ? categories.find(c => c.id === id) : null);
  const nameFor = (id: string | null, list: { id: string; name: string }[], fallback: string) =>
    id ? list.find(x => x.id === id)?.name ?? fallback : fallback;

  async function handlePause(rule: RecurringRule) {
    const willPause = rule.paused === 0;
    try {
      await pauseRule(db, rule.id, willPause);
      if (!willPause) await materializeDueRules(db);
      await reload();
      bumpDbVersion();
    } catch (err) {
      console.error('Pause recurring error:', err);
      showToast('Failed to update rule', 'err');
    }
  }
  async function handleDelete(rule: RecurringRule) {
    try {
      await archiveRule(db, rule.id);
      await reload();
      bumpDbVersion();
    } catch (err) {
      console.error('Delete recurring error:', err);
      showToast('Failed to delete rule', 'err');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EDDIES // RECURRING</MonoLabel>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      {committed.active > 0 && (
        <CommittedPanel out={committed.out} inn={committed.inn} net={committed.net}
          active={committed.active} sym={sym} />
      )}

      {rules.length > 0 && <NewRuleButton onPress={() => router.push('/(modals)/recurring-edit')} />}

      <FlatList
        data={rules}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <StockRuleCard
            rule={item}
            categoryName={nameFor(item.category_id, categories, 'Uncategorized')}
            categoryColor={catFor(item.category_id)?.color ?? EddiesColors.steel}
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
            <MonoLabel size={44} color={EddiesColors.steel + '33'}>↻</MonoLabel>
            <MonoLabel size={11} letterSpacing={2} color={EddiesColors.bone}>NO RECURRING RULES YET</MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
              SET RENT, SALARY OR SUBS ONCE —
            </MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
              EDDIES POSTS THEM ON SCHEDULE.
            </MonoLabel>
            <Pressable style={s.emptyCta} onPress={() => router.push('/(modals)/recurring-edit')}
              accessibilityRole="button" accessibilityLabel="Create first recurring rule">
              <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.bone}>
                + CREATE FIRST RULE
              </MonoLabel>
            </Pressable>
          </View>
        )}
        contentContainerStyle={s.listContent}
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
  listContent: { paddingTop: EddiesSpacing.md, paddingBottom: 96, gap: EddiesSpacing.md },
  sep: { height: EddiesSpacing.md },
  empty: { paddingTop: 72, alignItems: 'center', gap: EddiesSpacing.sm },
  emptyCta: {
    marginTop: EddiesSpacing.lg,
    paddingHorizontal: EddiesSpacing.lg, paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.alert, borderRadius: EddiesRadius.card,
  },
});

// Dashboard
const d = StyleSheet.create({
  wrap: {
    paddingHorizontal: EddiesSpacing.md, paddingTop: EddiesSpacing.md, paddingBottom: EddiesSpacing.md,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '18',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: EddiesSpacing.sm + 2 },
  row: { flexDirection: 'row' },
  col: { flex: 1, gap: 4 },
  value: { fontFamily: EddiesFonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
});

// New-rule button
const n = StyleSheet.create({
  btn: {
    marginHorizontal: EddiesSpacing.md, marginTop: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md, alignItems: 'center',
    backgroundColor: EddiesColors.alert, borderRadius: EddiesRadius.card,
  },
});

// Cream stock card
const c = StyleSheet.create({
  card: {
    marginHorizontal: EddiesSpacing.md,
    backgroundColor: CARD_BG,
    borderRadius: EddiesRadius.card,
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  paused: { opacity: 0.5 },
  body: { paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.md, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 2 },
  badgeAuto: { backgroundColor: EddiesColors.bone },
  badgeConfirm: { borderWidth: 1, borderColor: EddiesColors.steel + '55' },
  amount: { fontFamily: EddiesFonts.displayBold, fontSize: 30, letterSpacing: -0.5, marginTop: 2 },
  foot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: EddiesSpacing.xs, paddingTop: EddiesSpacing.sm,
    borderTopWidth: 1, borderTopColor: EddiesColors.steel + '1A',
  },
  footL: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm, flexShrink: 1 },
  nextChip: {
    backgroundColor: EddiesColors.ink,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: EddiesRadius.chip,
  },
  actions: { flexDirection: 'row', gap: EddiesSpacing.md },
  actBtn: { paddingHorizontal: 2, paddingVertical: 2 },
});
