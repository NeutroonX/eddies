import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';

type PillProps = {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  onRemove?: () => void;
};

// Readable text color for a filled pill: dark ink on light backgrounds,
// white on dark ones. Keeps the selected tag legible regardless of its color.
function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? EddiesColors.ink : EddiesColors.bone;
}

export function Pill({ label, active = false, color, onPress, onRemove }: PillProps) {
  const accentColor = color ?? EddiesColors.alert;
  const bg = active ? accentColor : 'transparent';
  const borderColor = active ? accentColor : EddiesColors.steel;
  const textColor = active ? readableOn(accentColor) : EddiesColors.steel;

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
