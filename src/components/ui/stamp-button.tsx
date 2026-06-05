import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

type StampButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function StampButton({ label, onPress, disabled = false, loading = false }: StampButtonProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (!reduceMotion) {
      scale.value = withSequence(
        withTiming(0.93, { duration: 80 }),
        withTiming(1, { duration: 120 })
      );
    }
    onPress();
  }

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View style={[styles.button, animStyle, isDisabled && styles.disabled]}>
        <Text style={styles.label}>{loading ? '...' : label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: EddiesColors.alert,
    paddingHorizontal: EddiesSpacing.lg,
    paddingVertical: EddiesSpacing.md,
    borderRadius: EddiesRadius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 16,
    color: EddiesColors.bone,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.4,
  },
});
