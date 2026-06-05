import { Pressable, StyleSheet, View } from 'react-native';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';

interface CapProgressProps {
  categoryName: string;
  spent: number;
  cap: number;
  percentage: number;
  isOver: boolean;
  onPress?: () => void;
}

export function CapProgress({ categoryName, spent, cap, percentage, isOver, onPress }: CapProgressProps) {
  const fill = Math.min(percentage, 100);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${categoryName}: $${(spent / 100).toFixed(2)} of $${(cap / 100).toFixed(2)}${isOver ? ', over limit' : ''}`}
      accessibilityHint={onPress ? 'Tap to edit' : undefined}
    >
      <View style={styles.labelRow}>
        <MonoLabel size={11} weight="bold" color={isOver ? EddiesColors.alert : EddiesColors.bone}>
          {categoryName.toUpperCase()}
        </MonoLabel>
        <View style={styles.right}>
          {isOver && (
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert} weight="bold">
              OVER
            </MonoLabel>
          )}
          <MonoLabel size={9} color={EddiesColors.steel}>
            ${(spent / 100).toFixed(0)} / ${(cap / 100).toFixed(0)}
          </MonoLabel>
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${fill}%`, backgroundColor: isOver ? EddiesColors.alert : EddiesColors.bone },
          ]}
        />
      </View>

      {isOver && (
        <View style={styles.overRow}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[styles.stripe, { backgroundColor: i % 2 === 0 ? EddiesColors.alert : 'transparent' }]}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  track: {
    height: 3,
    backgroundColor: '#1A1A1C',
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  overRow: {
    flexDirection: 'row',
    height: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  stripe: { flex: 1 },
});
