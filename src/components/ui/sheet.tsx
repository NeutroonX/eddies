import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesRadius, EddiesSpacing } from '@/constants/theme';

/**
 * Minimal bottom sheet built on RN Modal — no external dependency. Slides up,
 * dims the backdrop, dismisses on backdrop tap or hardware back. Content is
 * supplied by the caller (option lists, steppers, date chips, etc.).
 */
export function Sheet({
  visible, title, onClose, children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Dismiss">
        {/* Inner Pressable swallows taps so they don't dismiss the sheet. */}
        <Pressable style={[s.panel, { paddingBottom: insets.bottom + EddiesSpacing.lg }]} onPress={() => {}}>
          <View style={s.grabber} />
          <View style={s.head}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>{title}</MonoLabel>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <MonoLabel size={11} color={EddiesColors.steel}>✕</MonoLabel>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A single selectable option line inside a Sheet. */
export function SheetOption({
  label, selected, onPress, sublabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  sublabel?: string;
}) {
  return (
    <Pressable style={s.option} onPress={onPress} accessibilityRole="radio"
      accessibilityState={{ checked: selected }} accessibilityLabel={label}>
      <View style={{ flex: 1, gap: 2 }}>
        <MonoLabel size={12} letterSpacing={1.5} weight={selected ? 'bold' : 'regular'}
          color={selected ? EddiesColors.bone : EddiesColors.steel}>
          {label}
        </MonoLabel>
        {sublabel ? (
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>{sublabel}</MonoLabel>
        ) : null}
      </View>
      {selected ? <MonoLabel size={12} color={EddiesColors.alert}>✓</MonoLabel> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: EddiesColors.surface,
    borderTopWidth: 1, borderColor: EddiesColors.steel + '33',
    borderTopLeftRadius: EddiesRadius.card, borderTopRightRadius: EddiesRadius.card,
    paddingHorizontal: EddiesSpacing.md, paddingTop: EddiesSpacing.sm,
  },
  grabber: {
    alignSelf: 'center', width: 36, height: 3, borderRadius: 2,
    backgroundColor: EddiesColors.steel + '55', marginBottom: EddiesSpacing.sm,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '1A',
    marginBottom: EddiesSpacing.xs,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: EddiesSpacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
});
