import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SymbolView } from 'expo-symbols';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { formatAmountTabular } from '@/lib/money';
import type { LedgerRow } from '@/hooks/use-ledger';

function CategoryIcon({ glyph, color }: { glyph: string; color: string }) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={glyph as any} size={18} tintColor={color} type="monochrome" />;
  }
  return (
    <View style={[styles.glyphFallback, { backgroundColor: color + '22' }]}>
      <MonoLabel size={9} color={color} weight="bold">{glyph[0]?.toUpperCase() ?? '?'}</MonoLabel>
    </View>
  );
}

type Props = {
  row: LedgerRow;
  isPendingDelete?: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function EntryRow({ row, isPendingDelete = false, onPress, onEdit, onDelete }: Props) {
  const isOutflow = row.kind === 'outflow';
  const amountColor = isOutflow ? EddiesColors.alert : EddiesColors.bone;
  const label = row.note?.trim() || row.category_name;
  const time = new Date(row.occurred_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <Swipeable
      renderLeftActions={() => (
        <Pressable onPress={onEdit} style={styles.editBtn}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.bone}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.bone}>DELETE</MonoLabel>
        </Pressable>
      )}
      overshootFriction={8}
    >
      <Pressable onPress={onPress} style={[styles.row, isPendingDelete && styles.fading]}>
        <View style={styles.iconWrap}>
          <CategoryIcon glyph={row.category_glyph} color={row.category_color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <MonoLabel size={10} color={EddiesColors.steel}>{row.vault_name} · {time}</MonoLabel>
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isOutflow ? '−' : '+'}{formatAmountTabular(row.amount_minor)}
        </Text>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: 10,
    backgroundColor: EddiesColors.ink,
    gap: EddiesSpacing.sm,
  },
  fading: { opacity: 0.35 },
  iconWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
  glyphFallback: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  label: { fontFamily: EddiesFonts.displaySemiBold, fontSize: 15, color: EddiesColors.bone },
  amount: { fontFamily: EddiesFonts.mono, fontSize: 14, letterSpacing: 0.5 },
  editBtn: {
    backgroundColor: EddiesColors.steel, width: 80,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: EddiesColors.alert, width: 80,
    justifyContent: 'center', alignItems: 'center',
  },
});
