import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { CapProgress } from '@/components/ui/cap-progress';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SpendBar } from '@/components/ui/spend-bar';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatMinor } from '@/lib/format';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import {
  getDailyBurn,
  getInflowVsOutflow,
  getCategorySpend,
  getCapStats,
  type CategorySpend,
  type CapProgress as CapProgressType,
} from '@/lib/analytics';
import { deleteBudget } from '@/lib/db/repos/budgets';
import { useStore } from '@/store';

type Period = 'week' | 'month';

function getPeriodRange(period: Period, firstDayOfWeek: number): { fromMs: number; toMs: number } {
  const now = Date.now();
  if (period === 'week') {
    const d = new Date(now);
    const start = new Date(d);
    start.setDate(d.getDate() - ((d.getDay() - firstDayOfWeek + 7) % 7));
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs: now };
  }
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { fromMs: start.getTime(), toMs: now };
}

function getPeriodTotalDays(period: Period): number {
  if (period === 'week') return 7;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export default function AnalyzeScreen() {
  const db = useSQLiteContext();
  const activePeriod = useStore((s) => s.activePeriod);
  const setActivePeriod = useStore((s) => s.setActivePeriod);
  const firstDayOfWeek = useStore((s) => s.firstDayOfWeek);
  const sym = useCurrencySymbol();

  const [inOut, setInOut] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [burn, setBurn] = useState({ avgDailyMinor: 0, projectedMonthEndMinor: 0, daysInPeriod: 0 });
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [caps, setCaps] = useState<CapProgressType[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Commit pending cap delete on unmount without setState.
  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingIdRef.current) {
      deleteBudget(db, pendingIdRef.current).catch(console.error);
    }
  }, [db]);

  const loadData = useCallback(() => {
    const { fromMs, toMs } = getPeriodRange(activePeriod as Period, firstDayOfWeek);
    const capPeriod = activePeriod === 'month' ? 'monthly' : 'weekly';
    Promise.all([
      getInflowVsOutflow(db, fromMs, toMs),
      getDailyBurn(db, fromMs, toMs),
      getCategorySpend(db, fromMs, toMs),
      getCapStats(db, capPeriod as 'weekly' | 'monthly', fromMs, toMs),
    ]).then(([io, b, sp, cp]) => {
      if (!mountedRef.current) return;
      setInOut(io);
      setBurn(b);
      setSpending(sp);
      setCaps(cp);
    }).catch(console.error);
  }, [activePeriod, db, firstDayOfWeek]);

  // Single load path: fires on focus and when activePeriod/db changes.
  useFocusEffect(loadData);

  function handleDeleteCap(cap: CapProgressType) {
    if (deleteTimerRef.current && pendingIdRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteBudget(db, pendingIdRef.current).then(loadData).catch(console.error);
    }
    pendingIdRef.current = cap.cap_id;
    setPendingDelete({ id: cap.cap_id, name: cap.category_name });
    setCaps((prev) => prev.filter((c) => c.cap_id !== cap.cap_id));
    deleteTimerRef.current = setTimeout(() => {
      deleteBudget(db, cap.cap_id).then(loadData).catch(console.error);
      deleteTimerRef.current = null;
      pendingIdRef.current = null;
      setPendingDelete(null);
    }, 4000);
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    pendingIdRef.current = null;
    setPendingDelete(null);
    loadData();
  }

  const netPositive = inOut.net >= 0;
  const totalDays = getPeriodTotalDays(activePeriod as Period);
  const daysElapsed = Math.max(1, burn.daysInPeriod);
  const dayPct = Math.min((daysElapsed / totalDays) * 100, 100);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
              EDDIES // INTEL 03-A
            </MonoLabel>
            <BarcodeMark height={12} color={EddiesColors.steel} />
          </View>
          <View style={s.toggle}>
            {(['week', 'month'] as Period[]).map((p) => {
              const active = activePeriod === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setActivePeriod(p)}
                  style={[s.toggleBtn, active && s.toggleBtnActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MonoLabel
                    size={10}
                    letterSpacing={1}
                    weight={active ? 'bold' : 'regular'}
                    color={active ? EddiesColors.bone : EddiesColors.steel}
                  >
                    {p.toUpperCase()}
                  </MonoLabel>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── FLOW ─────────────────────────────────────── */}
        <Divider label="FLOW" />
        <View style={s.flowBlock}>
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={s.ledgerLabel}>
              OUTFLOW
            </MonoLabel>
            <Numerals size={44} color={EddiesColors.alert} weight="bold">
              {sym}{formatMinor(inOut.outflow)}
            </Numerals>
          </View>
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={s.ledgerLabel}>
              INFLOW
            </MonoLabel>
            <Numerals size={28} color={EddiesColors.bone} weight="semibold">
              {sym}{formatMinor(inOut.inflow)}
            </Numerals>
          </View>
          <View style={s.hairline} />
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={s.ledgerLabel}>
              NET
            </MonoLabel>
            <Numerals
              size={20}
              color={netPositive ? EddiesColors.bone : EddiesColors.alert}
              weight="bold"
            >
              {inOut.net >= 0 ? '+' : '−'}{sym}{formatMinor(Math.abs(inOut.net))}
            </Numerals>
          </View>
        </View>

        {/* ── BURN ─────────────────────────────────────── */}
        <Divider label="BURN" />
        <View style={s.burnBlock}>
          <View style={s.burnRateRow}>
            <Numerals size={38} color={EddiesColors.alert} weight="bold">
              {sym}{formatMinor(burn.avgDailyMinor)}
            </Numerals>
            <MonoLabel size={11} letterSpacing={1} color={EddiesColors.steel} style={s.burnUnit}>
              / DAY
            </MonoLabel>
          </View>

          <View style={s.dayRow}>
            <View style={s.dayTrack}>
              <View style={[s.dayFill, { width: `${dayPct}%` }]} />
            </View>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel} style={s.dayLabel}>
              {daysElapsed} / {totalDays}
            </MonoLabel>
          </View>

          <View style={s.hairline} />
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={s.ledgerLabel}>
              PROJ. END
            </MonoLabel>
            <Numerals size={16} color={EddiesColors.bone} weight="semibold">
              {sym}{formatMinor(burn.projectedMonthEndMinor)}
            </Numerals>
          </View>
        </View>

        {/* ── SPEND ────────────────────────────────────── */}
        {spending.length > 0 && (
          <View>
            <Divider label="SPEND" />
            <View>
              {spending.map((cat, i) => (
                <SpendBar
                  key={cat.category_id}
                  rank={i + 1}
                  sym={sym}
                  categoryName={cat.category_name}
                  amount={cat.total_minor}
                  percentage={cat.percentage}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── CAPS ─────────────────────────────────────── */}
        {caps.length > 0 && (
          <View>
            <Divider label="CAPS" />
            <View>
              {caps.map((cap) => (
                <CapProgress
                  key={cap.cap_id}
                  categoryName={cap.category_name}
                  spent={cap.spent_minor}
                  cap={cap.cap_amount_minor}
                  percentage={cap.percentage}
                  isOver={cap.is_over}
                  onEdit={() => router.push(`/(modals)/cap?capId=${cap.cap_id}`)}
                  onDelete={() => handleDeleteCap(cap)}
                />
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={s.addCap}
          onPress={() => router.push('/(modals)/cap')}
          accessibilityRole="button"
        >
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>+ ADD CAP</MonoLabel>
        </Pressable>

      </ScrollView>

      {pendingDelete && (
        <View style={s.undoBar}>
          <MonoLabel size={11} color={EddiesColors.bone} style={{ flex: 1 }}>
            {pendingDelete.name.toUpperCase()} CAP REMOVED
          </MonoLabel>
          <Pressable onPress={handleUndoDelete} hitSlop={12}>
            <MonoLabel size={11} weight="bold" color={EddiesColors.alert}>UNDO</MonoLabel>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={d.row}>
      <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>{label}</MonoLabel>
      <View style={d.line} />
    </View>
  );
}

const d = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel,
    opacity: 0.12,
  },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
    gap: EddiesSpacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    gap: EddiesSpacing.xs,
    flex: 1,
    marginRight: EddiesSpacing.md,
  },
  toggle: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: EddiesColors.surface,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs,
  },
  toggleBtnActive: {
    backgroundColor: EddiesColors.steel + '22',
  },

  // Shared ledger row: label left, value right-aligned
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  ledgerLabel: {
    marginBottom: 5,
  },

  hairline: {
    height: 1,
    backgroundColor: EddiesColors.steel,
    opacity: 0.12,
  },

  // FLOW
  flowBlock: {
    gap: EddiesSpacing.sm,
  },

  // BURN
  burnBlock: {
    gap: EddiesSpacing.sm,
  },
  burnRateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: EddiesSpacing.xs,
  },
  burnUnit: {
    marginBottom: 7,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  dayTrack: {
    flex: 1,
    height: 3,
    backgroundColor: EddiesColors.steel + '22',
    overflow: 'hidden',
  },
  dayFill: {
    height: '100%',
    backgroundColor: EddiesColors.steel + '66',
  },
  dayLabel: {
    width: 48,
    textAlign: 'right',
  },

  // Add cap
  addCap: {
    paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '12',
    alignItems: 'center',
  },

  // Undo bar
  undoBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '33',
  },
});
