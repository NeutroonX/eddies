import { Pressable, StyleSheet, View } from 'react-native';
import type { ActivePeriod } from '@/store/ui';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';

interface PeriodSelectorProps {
  value: ActivePeriod;
  onChange: (period: ActivePeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods: ActivePeriod[] = ['week', 'month'];

  return (
    <View style={styles.container}>
      {periods.map((period) => {
        const isActive = value === period;
        return (
          <Pressable
            key={period}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(period)}
          >
            <MonoLabel
              size={12}
              letterSpacing={1}
              color={isActive ? EddiesColors.bone : EddiesColors.steel}
              weight="bold"
            >
              {period.toUpperCase()}
            </MonoLabel>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: EddiesSpacing.xs,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    padding: EddiesSpacing.xs,
    backgroundColor: EddiesColors.ink,
  },
  segment: {
    flex: 1,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 1,
  },
  segmentActive: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.bone,
  },
});
