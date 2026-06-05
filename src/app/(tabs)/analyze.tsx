import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapProgress } from '@/components/ui/cap-progress';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SpendBar } from '@/components/ui/spend-bar';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatMinor } from '@/lib/format';
import {
  getDailyBurn,
  getInflowVsOutflow,
  getCategorySpend,
  getCapStats,
  type CategorySpend,
  type CapProgress as CapProgressType,
} from '@/lib/analytics';
import { useStore } from '@/store';

type Period = 'week' | 'month';

function getPeriodRange(period: Period): { fromMs: number; toMs: number } {
  const now = Date.now();
  const toMs = now;

  if (period === 'week') {
    const d = new Date(now);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs };
  }

  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { fromMs: start.getTime(), toMs };
}

export default function AnalyzeScreen() {
  const db = useSQLiteContext();
  const activePeriod = useStore((s) => s.activePeriod);
  const setActivePeriod = useStore((s) => s.setActivePeriod);

  const [inOut, setInOut] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [burn, setBurn] = useState({ avgDailyMinor: 0, projectedMonthEndMinor: 0 });
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [caps, setCaps] = useState<CapProgressType[]>([]);

  useEffect(() => {
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
  }, [activePeriod, db]);

  const netPositive = inOut.net >= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
            EDDIES // INTEL 03-A
          </MonoLabel>
          <View style={styles.periodToggle}>
            {(['week', 'month'] as Period[]).map((p) => {
              const active = activePeriod === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setActivePeriod(p)}
                  style={[styles.periodBtn, active && styles.periodBtnActive]}
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

        {/* Divider label */}
        <SectionDivider label="FLOW" />

        {/* Outflow — the hero number */}
        <View style={styles.flowBlock}>
          <View style={styles.flowRow}>
            <Numerals size={48} color={EddiesColors.alert} weight="bold">
              ${formatMinor(inOut.outflow)}
            </Numerals>
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.alert} style={styles.flowTag}>
              OUTFLOW
            </MonoLabel>
          </View>

          <View style={[styles.flowRow, styles.inflowRow]}>
            <Numerals size={28} color={EddiesColors.bone} weight="bold">
              ${formatMinor(inOut.inflow)}
            </Numerals>
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel} style={styles.flowTag}>
              INFLOW
            </MonoLabel>
          </View>

          <View style={styles.hairline} />

          <View style={styles.netRow}>
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
              NET
            </MonoLabel>
            <Numerals
              size={18}
              color={netPositive ? EddiesColors.bone : EddiesColors.alert}
              weight="bold"
            >
              {inOut.net >= 0 ? '+' : '−'}${formatMinor(Math.abs(inOut.net))}
            </Numerals>
          </View>
        </View>

        {/* Burn Rate */}
        <SectionDivider label="BURN" />

        <View style={styles.burnBlock}>
          <View style={styles.burnRow}>
            <Numerals size={32} color={EddiesColors.alert} weight="bold">
              ${formatMinor(burn.avgDailyMinor)}
            </Numerals>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel} style={styles.flowTag}>
              / DAY
            </MonoLabel>
          </View>
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel}>
            ƒ AT THIS RATE → MONTH-END ≈ ${formatMinor(burn.projectedMonthEndMinor)}
          </MonoLabel>
        </View>

        {/* Spend breakdown */}
        {spending.length > 0 && (
          <>
            <SectionDivider label="SPEND" />
            <View style={styles.listBlock}>
              {spending.map((cat, i) => (
                <SpendBar
                  key={cat.category_id}
                  rank={i + 1}
                  categoryName={cat.category_name}
                  amount={cat.total_minor}
                  percentage={cat.percentage}
                />
              ))}
            </View>
          </>
        )}

        {/* Cap watch */}
        {caps.length > 0 && (
          <>
            <SectionDivider label="CAPS" />
            <View style={styles.listBlock}>
              {caps.map((cap) => (
                <CapProgress
                  key={cap.cap_id}
                  categoryName={cap.category_name}
                  spent={cap.spent_minor}
                  cap={cap.cap_amount_minor}
                  percentage={cap.percentage}
                  isOver={cap.is_over}
                  onPress={() => router.push(`/(modals)/cap?capId=${cap.cap_id}`)}
                />
              ))}
            </View>
          </>
        )}

        {/* Add cap CTA */}
        <Pressable
          style={styles.addCap}
          onPress={() => router.push('/(modals)/cap')}
          accessibilityRole="button"
          accessibilityLabel="Add cap"
        >
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
            + ADD CAP
          </MonoLabel>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={divStyles.row}>
      <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
        {label}
      </MonoLabel>
      <View style={divStyles.line} />
    </View>
  );
}

const divStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    marginBottom: EddiesSpacing.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: '#1A1A1C' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
    gap: EddiesSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodToggle: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: '#1A1A1C',
    padding: 1,
  },
  periodBtn: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs,
  },
  periodBtnActive: {
    backgroundColor: EddiesColors.surface,
  },
  flowBlock: { gap: EddiesSpacing.sm },
  flowRow: { flexDirection: 'row', alignItems: 'flex-end', gap: EddiesSpacing.sm },
  inflowRow: { marginTop: -EddiesSpacing.xs },
  flowTag: { marginBottom: 6 },
  hairline: { height: 1, backgroundColor: '#1A1A1C' },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: EddiesSpacing.xs,
  },
  burnBlock: { gap: EddiesSpacing.sm },
  burnRow: { flexDirection: 'row', alignItems: 'flex-end', gap: EddiesSpacing.sm },
  listBlock: {},
  addCap: {
    paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    alignItems: 'center',
  },
});
