import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';

type PillProps = {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  onRemove?: () => void;
};

export function Pill({ label, active = false, color, onPress, onRemove }: PillProps) {
  const accentColor = color ?? EddiesColors.alert;
  const bg = active ? accentColor : 'transparent';
  const borderColor = active ? accentColor : EddiesColors.steel;
  const textColor = active ? EddiesColors.bone : EddiesColors.steel;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: bg, borderColor }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      {onRemove != null && (
        <View style={styles.removeWrap}>
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
          >
            <Text style={[styles.label, { color: textColor }]}>✕</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.chipH,
    paddingVertical: EddiesSpacing.chipV,
    borderRadius: EddiesRadius.chip,
    borderWidth: EddiesSpacing.hairline,
    gap: EddiesSpacing.xs,
  },
  label: {
    fontFamily: EddiesFonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  removeWrap: {
    marginLeft: 2,
  },
});
