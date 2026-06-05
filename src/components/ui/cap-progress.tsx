import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { Numerals } from './numerals';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';

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
  const sym = useCurrencySymbol();
  const swipeRef = useRef<Swipeable>(null);
  const fill = Math.min(percentage, 100);

  // Track color: bone under 80%, alert from 80%+, full alert when over
  const trackColor = isOver
    ? EddiesColors.alert
    : percentage >= 80
      ? EddiesColors.bone
      : EddiesColors.bone + 'AA';

  function triggerEdit() {
    swipeRef.current?.close();
    onEdit?.();
  }

  function triggerDelete() {
    swipeRef.current?.close();
    onDelete?.();
  }

  const overAmount = isOver ? ((spent - cap) / 100).toFixed(0) : null;

  return (
    <Swipeable
      ref={swipeRef}
      overshootFriction={8}
      renderLeftActions={() => (
        <Pressable style={s.editAction} onPress={triggerEdit}>
          <MonoLabel size={10} weight="bold" color={EddiesColors.bone} letterSpacing={1}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable style={s.deleteAction} onPress={triggerDelete}>
          <MonoLabel size={10} weight="bold" color={EddiesColors.bone} letterSpacing={1}>DEL</MonoLabel>
        </Pressable>
      )}
      onSwipeableLeftOpen={triggerEdit}
      onSwipeableRightOpen={triggerDelete}
    >
      <View
        style={s.row}
        accessibilityLabel={`${categoryName}: ${sym}${(spent / 100).toFixed(2)} of ${sym}${(cap / 100).toFixed(2)}${isOver ? ', over limit' : ''}`}
        accessibilityHint="Swipe right to edit, swipe left to delete"
      >
        {/* Header: name + over badge + percentage */}
        <View style={s.headerRow}>
          <MonoLabel
            size={11}
            weight="bold"
            color={isOver ? EddiesColors.alert : EddiesColors.bone}
            letterSpacing={0.5}
          >
            {categoryName.toUpperCase()}
          </MonoLabel>

          <View style={s.headerRight}>
            {isOver && (
              <View style={s.overBadge}>
                <MonoLabel size={7} weight="bold" letterSpacing={2} color={EddiesColors.bone}>
                  OVER
                </MonoLabel>
              </View>
            )}
            <Numerals
              size={16}
              color={isOver ? EddiesColors.alert : EddiesColors.bone}
              weight="bold"
            >
              {percentage.toFixed(0)}%
            </Numerals>
          </View>
        </View>

        {/* Gauge track */}
        <View style={s.track}>
          <View style={[s.fill, { width: `${fill}%`, backgroundColor: trackColor }]} />
        </View>

        {/* Meta: spent · cap · over amount */}
        <View style={s.metaRow}>
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel}>
            {sym}{(spent / 100).toFixed(0)} SPENT
          </MonoLabel>
          <View style={s.metaRight}>
            {overAmount && (
              <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.alert}>
                +{sym}{overAmount} OVER ·{' '}
              </MonoLabel>
            )}
            <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel}>
              {sym}{(cap / 100).toFixed(0)} CAP
            </MonoLabel>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  row: {
    backgroundColor: EddiesColors.ink,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.xs + 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  overBadge: {
    backgroundColor: EddiesColors.alert,
    paddingHorizontal: EddiesSpacing.xs + 2,
    paddingVertical: 2,
  },
  track: {
    height: 5,
    backgroundColor: EddiesColors.steel + '22',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editAction: {
    backgroundColor: EddiesColors.steel + 'AA',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
  },
  deleteAction: {
    backgroundColor: EddiesColors.alert,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
  },
});
