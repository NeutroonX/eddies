import { StyleSheet, View } from 'react-native';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
  highlightRed?: boolean;
}

export function MetricCard({ label, value, subtext, color, highlightRed }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
        {label}
      </MonoLabel>
      <Numerals
        size={28}
        color={highlightRed ? EddiesColors.alert : color || EddiesColors.bone}
        weight="bold"
      >
        {value}
      </Numerals>
      {subtext && (
        <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={{ marginTop: EddiesSpacing.xs }}>
          {subtext}
        </MonoLabel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    padding: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
  },
});
