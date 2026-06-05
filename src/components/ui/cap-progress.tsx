import { Pressable, StyleSheet, View } from 'react-native';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';
import { CautionStripe } from './caution-stripe';

interface CapProgressProps {
  categoryName: string;
  spent: number;
  cap: number;
  percentage: number;
  isOver: boolean;
  onPress?: () => void;
}

export function CapProgress({
  categoryName,
  spent,
  cap,
  percentage,
  isOver,
  onPress,
}: CapProgressProps) {
  const barWidth = Math.min(percentage, 100);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>
          {categoryName}
        </MonoLabel>
        <View style={styles.status}>
          {isOver && (
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.alert} weight="bold">
              CAUTION
            </MonoLabel>
          )}
          <MonoLabel size={10} color={EddiesColors.steel}>
            {percentage.toFixed(0)}%
          </MonoLabel>
        </View>
      </View>

      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: `${barWidth}%`,
              backgroundColor: isOver ? EddiesColors.alert : EddiesColors.bone,
            },
          ]}
        />
      </View>

      {isOver && <CautionStripe height={4} />}

      <View style={styles.amounts}>
        <MonoLabel size={9} color={EddiesColors.steel}>
          ${(spent / 100).toFixed(2)} / ${(cap / 100).toFixed(2)}
        </MonoLabel>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: EddiesSpacing.lg,
    paddingHorizontal: EddiesSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: EddiesSpacing.sm,
  },
  status: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    alignItems: 'center',
  },
  barContainer: {
    height: 20,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: EddiesSpacing.sm,
  },
  barFill: {
    height: '100%',
    opacity: 0.8,
  },
  amounts: {
    marginTop: EddiesSpacing.xs,
  },
});
