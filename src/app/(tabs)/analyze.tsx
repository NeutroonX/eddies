import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { CapProgress } from '@/components/ui/cap-progress';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SpendBar } from '@/components/ui/spend-bar';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
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

function getPeriodRange(period: Period): { fromMs: number; toMs: number } {
  const now = Date.now();
  if (period === 'week') {
    const d = new Date(now);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
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
  const sym = useCurrencySymbol();

  const [inOut, setInOut] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [burn, setBurn] = useState({ avgDailyMinor: 0, projectedMonthEndMinor: 0, daysInPeriod: 0 });
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [caps, setCaps] = useState<CapProgressType[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  function loadData() {
    const { fromMs, toMs } = getPeriodRange(activePeriod as Period);
    const capPeriod = activePeriod === 'month' ? 'monthly' : 'weekly';
    Promise.all([
      getInflowVsOutflow(db, fromMs, toMs),
      getDailyBurn(db, fromMs, toMs),
      getCategorySpend(db, fromMs, toMs),
      getCapStats(db, capPeriod as 'weekly' | 'monthly', fromMs, toMs),
    ]).then(([io, b, sp, cp]) => {
      setInOut(io);
      setBurn(b);
      setSpending(sp);
      setCaps(cp);
    });
  }

  useEffect(() => { loadData(); }, [activePeriod, db]);
  useFocusEffect(() => { loadData(); });

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
  const totalFlow = inOut.inflow + inOut.outflow;
  const outPct = totalFlow > 0 ? (inOut.outflow / totalFlow) * 100 : 0;
  const totalDays = getPeriodTotalDays(activePeriod as Period);
  const daysElapsed = burn.daysInPeriod;
  const dayPct = Math.min((daysElapsed / totalDays) * 100, 100);
  const periodLabel = activePeriod === 'week' ? 'THIS WEEK' : 'THIS MONTH';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EDDIES // INTEL 03-A</MonoLabel>
            <BarcodeMark height={12} color={EddiesColors.steel} />
          </View>
          <View style={s.periodToggle}>
            {(['week', 'month'] as Period[]).map((p) => {
              const active = activePeriod === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setActivePeriod(p)}
                  style={[s.periodBtn, active && s.periodBtnActive]}
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

        {/* ── FLOW panel ─────────────────────────────── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>FLOW</MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '80'}>{periodLabel}</MonoLabel>
          </View>

          <View style={s.flowAccent} />

          <View style={s.flowRows}>
            {/* Outflow */}
            <View style={s.flowLine}>
              <View style={[s.flowDot, { backgroundColor: EddiesColors.alert }]} />
              <Numerals size={40} color={EddiesColors.alert} weight="bold">
                {sym}{formatMinor(inOut.outflow)}
              </Numerals>
              <View style={s.flowLineSpacer} />
              <MonoLabel size={9} letterSpacing={2} color={EddiesColors.alert}>OUT</MonoLabel>
            </View>

            {/* Inflow */}
            <View style={s.flowLine}>
              <View style={[s.flowDot, { backgroundColor: EddiesColors.bone }]} />
              <Numerals size={24} color={EddiesColors.bone} weight="semibold">
                {sym}{formatMinor(inOut.inflow)}
              </Numerals>
              <View style={s.flowLineSpacer} />
              <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>IN</MonoLabel>
            </View>
          </View>

          <View style={s.panelHairline} />

          {/* NET row */}
          <View style={s.netRow}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>NET</MonoLabel>
            <Numerals
              size={16}
              color={netPositive ? EddiesColors.bone : EddiesColors.alert}
              weight="bold"
            >
              {inOut.net >= 0 ? '+' : '−'}{sym}{formatMinor(Math.abs(inOut.net))}
            </Numerals>
          </View>

          {/* Ratio bar: outflow vs inflow split */}
          {totalFlow > 0 && (
            <View style={s.ratioTrack}>
              <View style={[s.ratioOut, { flex: outPct }]} />
              <View style={[s.ratioIn, { flex: 100 - outPct }]} />
            </View>
          )}
          {totalFlow > 0 && (
            <View style={s.ratioLabels}>
              <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert}>
                OUT {outPct.toFixed(0)}%
              </MonoLabel>
              <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel}>
                IN {(100 - outPct).toFixed(0)}%
              </MonoLabel>
            </View>
          )}
        </View>

        {/* ── BURN RATE panel ────────────────────────── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>BURN RATE</MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '80'}>
              DAY {daysElapsed} / {totalDays}
            </MonoLabel>
          </View>

          <View style={s.burnRate}>
            <Numerals size={36} color={EddiesColors.alert} weight="bold">
              {sym}{formatMinor(burn.avgDailyMinor)}
            </Numerals>
            <MonoLabel size={10} letterSpacing={1} color={EddiesColors.steel} style={s.burnUnit}>
              / DAY
            </MonoLabel>
          </View>

          {/* Day progress bar */}
          <View style={s.dayTrack}>
            <View style={[s.dayFill, { width: `${dayPct}%` }]} />
          </View>

          <View style={s.panelHairline} />

          <View style={s.projRow}>
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>PROJ. END</MonoLabel>
            <Numerals size={14} color={EddiesColors.bone} weight="semibold">
              {sym}{formatMinor(burn.projectedMonthEndMinor)}
            </Numerals>
          </View>
        </View>

        {/* ── SPEND ──────────────────────────────────── */}
        {spending.length > 0 && (
          <View>
            <SectionLabel label="SPEND" />
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
        )}

        {/* ── CAPS ───────────────────────────────────── */}
        {caps.length > 0 && (
          <View>
            <SectionLabel label="CAPS" />
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
        )}

        <Pressable
          style={s.addCap}
          onPress={() => router.push('/(modals)/cap')}
          accessibilityRole="button"
        >
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>+ ADD CAP</MonoLabel>
        </Pressable>

      </ScrollView>

      {/* Undo bar */}
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

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sl.row}>
      <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>{label}</MonoLabel>
      <View style={sl.line} />
    </View>
  );
}

const sl = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    marginBottom: EddiesSpacing.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: EddiesColors.surface },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
    gap: EddiesSpacing.xl,
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
  periodToggle: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: EddiesColors.surface,
    padding: 2,
    borderRadius: EddiesRadius.panel,
  },
  periodBtn: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs + 2,
    borderRadius: EddiesRadius.panel,
  },
  periodBtnActive: {
    backgroundColor: EddiesColors.steel + '2A',
  },

  // Panel shared
  panel: {
    backgroundColor: EddiesColors.surface,
    borderRadius: EddiesRadius.card,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '18',
    overflow: 'hidden',
    gap: EddiesSpacing.sm,
    paddingBottom: EddiesSpacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.sm,
  },
  panelHairline: {
    height: 1,
    backgroundColor: EddiesColors.steel + '18',
    marginHorizontal: EddiesSpacing.md,
  },

  // FLOW
  flowAccent: {
    height: 2,
    backgroundColor: EddiesColors.alert,
    marginHorizontal: EddiesSpacing.md,
    borderRadius: 1,
  },
  flowRows: {
    paddingHorizontal: EddiesSpacing.md,
    gap: EddiesSpacing.xs,
  },
  flowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  flowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flowLineSpacer: { flex: 1 },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
  },
  ratioTrack: {
    flexDirection: 'row',
    height: 4,
    marginHorizontal: EddiesSpacing.md,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ratioOut: {
    height: '100%',
    backgroundColor: EddiesColors.alert,
  },
  ratioIn: {
    height: '100%',
    backgroundColor: EddiesColors.steel + '55',
  },
  ratioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
  },

  // BURN
  burnRate: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: EddiesSpacing.xs,
    paddingHorizontal: EddiesSpacing.md,
  },
  burnUnit: {
    marginBottom: 6,
  },
  dayTrack: {
    height: 3,
    backgroundColor: EddiesColors.steel + '22',
    marginHorizontal: EddiesSpacing.md,
    borderRadius: 1,
    overflow: 'hidden',
  },
  dayFill: {
    height: '100%',
    backgroundColor: EddiesColors.steel + '66',
    borderRadius: 1,
  },
  projRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
  },

  // Add cap
  addCap: {
    paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.surface,
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
