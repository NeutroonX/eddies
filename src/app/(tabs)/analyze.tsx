import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { CapProgress } from '@/components/ui/cap-progress';
import { MetricCard } from '@/components/ui/metric-card';
import { MonoLabel } from '@/components/ui/mono-label';
import { NetWorthChart } from '@/components/ui/net-worth-chart';
import { PeriodSelector } from '@/components/ui/period-selector';
import { SectionTag } from '@/components/ui/section-tag';
import { SpendBar } from '@/components/ui/spend-bar';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatMinor } from '@/lib/format';
import {
  getDailyBurn,
  getInflowVsOutflow,
  getCategorySpend,
  getCapStats,
  getNetWorthSeries,
  type CategorySpend,
  type CapProgress as CapProgressType,
  type NetWorthPoint,
} from '@/lib/analytics';
import { useStore } from '@/store';

export default function AnalyzeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const activePeriod = useStore((s) => s.activePeriod);
  const setActivePeriod = useStore((s) => s.setActivePeriod);

  const [inflowOutflow, setInflowOutflow] = useState<{ inflow: number; outflow: number; net: number } | null>(null);
  const [burn, setBurn] = useState<{ avgDailyMinor: number; projectedMonthEndMinor: number } | null>(null);
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [caps, setCaps] = useState<CapProgressType[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthPoint[]>([]);

  useEffect(() => {
    async function loadData() {
      const now = Date.now();
      let fromMs: number;

      if (activePeriod === 'week') {
        const today = new Date(now);
        const day = today.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - day);
        start.setHours(0, 0, 0, 0);
        fromMs = start.getTime();
      } else {
        const start = new Date(now);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        fromMs = start.getTime();
      }

      const toMs = now;
      const capPeriod: 'weekly' | 'monthly' = activePeriod === 'month' ? 'monthly' : 'weekly';

      const [inflow, burn2, spending2, caps2, netWorth2] = await Promise.all([
        getInflowVsOutflow(db, fromMs, toMs),
        getDailyBurn(db, fromMs, toMs),
        getCategorySpend(db, fromMs, toMs),
        getCapStats(db, capPeriod, fromMs, toMs),
        getNetWorthSeries(db, fromMs, toMs),
      ]);

      setInflowOutflow(inflow);
      setBurn(burn2);
      setSpending(spending2);
      setCaps(caps2);
      setNetWorth(netWorth2);
    }

    loadData();
  }, [activePeriod, db]);

  const chartWidth = width - EddiesSpacing.md * 2;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <SectionTag label="EDDIES // INTEL 03-A" />
          <BarcodeMark height={20} />
        </View>

        <View style={styles.section}>
          <PeriodSelector value={activePeriod} onChange={setActivePeriod} />
        </View>

        {/* Inflow / Outflow / Net */}
        <View style={styles.section}>
          <View style={styles.grid}>
            <MetricCard
              label="INFLOW"
              value={`$${formatMinor(inflowOutflow?.inflow ?? 0)}`}
              color={EddiesColors.bone}
            />
            <MetricCard
              label="OUTFLOW"
              value={`$${formatMinor(inflowOutflow?.outflow ?? 0)}`}
              highlightRed
            />
          </View>
          <MetricCard
            label="NET"
            value={`$${formatMinor(inflowOutflow?.net ?? 0)}`}
            color={inflowOutflow && inflowOutflow.net < 0 ? EddiesColors.alert : EddiesColors.bone}
          />
        </View>

        {/* Daily Burn + Arithmetic Projection */}
        <View style={styles.section}>
          <MetricCard
            label="DAILY BURN"
            value={`$${formatMinor(burn?.avgDailyMinor ?? 0)} / day`}
            subtext={`ƒ AT THIS RATE → MONTH-END ≈ $${formatMinor(burn?.projectedMonthEndMinor ?? 0)}`}
            highlightRed
          />
        </View>

        {/* Net Worth Trend Chart */}
        <View style={styles.section}>
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
            NET WORTH TREND
          </MonoLabel>
          <NetWorthChart data={netWorth} width={chartWidth} height={180} />
        </View>

        {/* Spend by Category */}
        {spending.length > 0 && (
          <View style={styles.section}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
              SPEND BY CATEGORY
            </MonoLabel>
            {spending.map((cat) => (
              <SpendBar
                key={cat.category_id}
                categoryName={cat.category_name}
                amount={cat.total_minor}
                percentage={cat.percentage}
              />
            ))}
          </View>
        )}

        {/* Cap Watch */}
        {caps.length > 0 && (
          <View style={styles.section}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
              CAP WATCH
            </MonoLabel>
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.lg,
  },
  header: {
    gap: EddiesSpacing.sm,
  },
  section: {
    gap: EddiesSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    gap: EddiesSpacing.md,
  },
});
