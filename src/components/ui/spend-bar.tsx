import { Pressable, StyleSheet, View } from 'react-native';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';

interface SpendBarProps {
  categoryName: string;
  amount: number;
  percentage: number;
  rank: number;
  sym?: string;
  onPress?: () => void;
}

export function SpendBar({ categoryName, amount, percentage, rank, sym = '$', onPress }: SpendBarProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${categoryName}: ${sym}${(amount / 100).toFixed(2)}, ${percentage.toFixed(1)} percent`}
    >
      <MonoLabel size={9} color={EddiesColors.steel} style={styles.rank}>
        {String(rank).padStart(2, '0')}
      </MonoLabel>

      <View style={styles.body}>
        <View style={styles.labelRow}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>
            {categoryName.toUpperCase()}
          </MonoLabel>
          <View style={styles.right}>
            <Numerals size={13} color={EddiesColors.bone}>
              {sym}{(amount / 100).toFixed(2)}
            </Numerals>
            <MonoLabel size={9} color={EddiesColors.steel} style={styles.pct}>
              {percentage.toFixed(0)}%
            </MonoLabel>
          </View>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(percentage, 100)}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: EddiesSpacing.sm,
    gap: EddiesSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  rank: { width: 18, marginTop: 2 },
  body: { flex: 1, gap: EddiesSpacing.xs },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  pct: { width: 28, textAlign: 'right' },
  track: {
    height: 4,
    backgroundColor: EddiesColors.surface,
    overflow: 'hidden',
    borderRadius: 2,
  },
  fill: {
    height: '100%',
    backgroundColor: EddiesColors.alert,
  },
});
