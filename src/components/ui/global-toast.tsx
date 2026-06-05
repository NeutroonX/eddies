import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';

export function GlobalToast() {
  const toast = useStore((s) => s.toast);

  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180).springify()}
      exiting={FadeOutDown.duration(140)}
      style={[styles.container, toast.type === 'err' ? styles.err : styles.ok]}
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: EddiesSpacing.md,
    right: EddiesSpacing.md,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    borderRadius: 6,
    alignItems: 'center',
    zIndex: 999,
  },
  ok: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
  },
  err: {
    backgroundColor: EddiesColors.alert,
  },
  text: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
