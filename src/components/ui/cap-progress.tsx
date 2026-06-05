import { Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';

interface CapProgressProps {
  categoryName: string;
  spent: number;
  cap: number;
  percentage: number;
  isOver: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CapProgress({ categoryName, spent, cap, percentage, isOver, onEdit, onDelete }: CapProgressProps) {
  const fill = Math.min(percentage, 100);

  return (
    <Swipeable
      overshootFriction={8}
      renderLeftActions={() => (
        <Pressable style={s.editAction} onPress={onEdit}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable style={s.deleteAction}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>DELETE</MonoLabel>
        </Pressable>
      )}
      onSwipeableLeftOpen={onEdit}
      onSwipeableRightOpen={onDelete}
    >
      <Pressable
        style={s.row}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName}: $${(spent / 100).toFixed(2)} of $${(cap / 100).toFixed(2)}${isOver ? ', over limit' : ''}`}
        accessibilityHint="Swipe left to edit, swipe right to delete"
      >
        <View style={s.labelRow}>
          <MonoLabel size={11} weight="bold" color={isOver ? EddiesColors.alert : EddiesColors.bone}>
            {categoryName.toUpperCase()}
          </MonoLabel>
          <View style={s.right}>
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

        <View style={s.track}>
          <View
            style={[
              s.fill,
              { width: `${fill}%`, backgroundColor: isOver ? EddiesColors.alert : EddiesColors.bone },
            ]}
          />
        </View>

        {isOver && (
          <View style={s.overRow}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={[s.stripe, { backgroundColor: i % 2 === 0 ? EddiesColors.alert : 'transparent' }]}
              />
            ))}
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  row: {
    paddingVertical: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    backgroundColor: EddiesColors.ink,
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
  editAction: {
    backgroundColor: EddiesColors.steel,
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  deleteAction: {
    backgroundColor: EddiesColors.alert,
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
});
