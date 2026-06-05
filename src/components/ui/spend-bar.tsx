import { Pressable, StyleSheet, View } from 'react-native';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';

interface SpendBarProps {
  categoryName: string;
  amount: number;
  percentage: number;
  maxPercentage?: number;
  onPress?: () => void;
}

export function SpendBar({
  categoryName,
  amount,
  percentage,
  maxPercentage = 100,
  onPress,
}: SpendBarProps) {
  const barWidth = Math.min((percentage / maxPercentage) * 100, 100);

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${categoryName}: $${(amount / 100).toFixed(2)}, ${percentage.toFixed(1)} percent of total`}
    >
      <View style={styles.header}>
        <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>
          {categoryName}
        </MonoLabel>
        <Numerals size={14} color={EddiesColors.bone}>
          ${(amount / 100).toFixed(2)}
        </Numerals>
      </View>

      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: `${barWidth}%`,
              backgroundColor: EddiesColors.alert,
            },
          ]}
        />
      </View>

      <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel}>
        {percentage.toFixed(1)}% of total
      </MonoLabel>
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
  barContainer: {
    height: 24,
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
});
