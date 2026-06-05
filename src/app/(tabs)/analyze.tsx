import { ScrollView, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { CapProgress } from '@/components/ui/cap-progress';
import { MetricCard } from '@/components/ui/metric-card';
import { MonoLabel } from '@/components/ui/mono-label';
import { PeriodSelector } from '@/components/ui/period-selector';
import { SectionTag } from '@/components/ui/section-tag';
import { SpendBar } from '@/components/ui/spend-bar';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatMinor, formatPercentage } from '@/lib/format';
import {
  getDailyBurn,
  getInflowVsOutflow,
  getCategorySpend,
  getCapStats,
  type CategorySpend,
  type CapProgress,
} from '@/lib/analytics';
import { useStore } from '@/store';

export default function AnalyzeScreen() {
  const db = useSQLiteContext();
  const activePeriod = useStore((s) => s.activePeriod);
  const setActivePeriod = useStore((s) => s.setActivePeriod);

  const [inflowOutflow, setInflowOutflow] = useState<{ inflow: number; outflow: number; net: number } | null>(null);
  const [burn, setBurn] = useState<{ avgDailyMinor: number; projectedMonthEndMinor: number } | null>(null);
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [caps, setCaps] = useState<CapProgress[]>([]);

  useEffect(() => {
    async function loadData() {
      const now = Date.now();
      let fromMs: number;

      if (activePeriod === 'week') {
        const today = new Date(now);
        const day = today.getDay();
        const diff = today.getDate() - day;
        const start = new Date(today.setDate(diff));
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

      const [inflow, burn2, spending2, caps2] = await Promise.all([
        getInflowVsOutflow(db, fromMs, toMs),
        getDailyBurn(db, fromMs, toMs),
        getCategorySpend(db, fromMs, toMs),
        getCapStats(db, capPeriod, fromMs, toMs),
      ]);

      setInflowOutflow(inflow);
      setBurn(burn2);
      setSpending(spending2);
      setCaps(caps2);
    }

    loadData();
  }, [activePeriod, db]);

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

        <View style={styles.section}>
          <MetricCard
            label="DAILY BURN"
            value={`$${formatMinor(burn?.avgDailyMinor ?? 0)} / day`}
            subtext={`PROJECT → $${formatMinor(burn?.projectedMonthEndMinor ?? 0)}`}
            highlightRed
          />
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={{ marginTop: EddiesSpacing.xs }}>
            ƒ FORMULA
          </MonoLabel>
        </View>

        {spending.length > 0 && (
          <View style={styles.section}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={{ marginBottom: EddiesSpacing.md }}>
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

        {caps.length > 0 && (
          <View style={styles.section}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel} style={{ marginBottom: EddiesSpacing.md }}>
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
                onPress={() => {
                  router.push(`/(modals)/cap?capId=${cap.cap_id}`);
                }}
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
