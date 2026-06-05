import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SymbolView } from 'expo-symbols';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { formatAmountTabular } from '@/lib/money';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import type { LedgerRow } from '@/hooks/use-ledger';

function CategoryIcon({ glyph, color }: { glyph: string; color: string }) {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <SymbolView name={glyph as any} size={16} tintColor={color} type="monochrome" />
      </View>
    );
  }
  return (
    <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <MonoLabel size={10} color={color} weight="bold">{glyph[0]?.toUpperCase() ?? '?'}</MonoLabel>
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
  const sym = useCurrencySymbol();
  const isOutflow = row.kind === 'outflow';
  const isTransfer = row.kind === 'transfer';
  const amountColor = isOutflow ? EddiesColors.alert : isTransfer ? EddiesColors.steel : EddiesColors.bone;
  const label = row.note?.trim() || row.category_name;
  const time = new Date(row.occurred_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const sign = isOutflow ? '−' : isTransfer ? '⇄' : '+';

  return (
    <Swipeable
      renderLeftActions={() => (
        <Pressable onPress={onEdit} style={styles.editBtn}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.bone}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.bone}>DEL</MonoLabel>
        </Pressable>
      )}
      overshootFriction={8}
    >
      <Pressable onPress={onPress} style={[styles.row, isPendingDelete && styles.fading]}>
        {/* Icon */}
        <CategoryIcon glyph={row.category_glyph} color={row.category_color} />

        {/* Label + vault */}
        <View style={styles.info}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel}>
            {row.vault_name.toUpperCase()}
          </MonoLabel>
        </View>

        {/* Amount + time stacked right */}
        <View style={styles.rightCol}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {sign}{sym}{formatAmountTabular(row.amount_minor)}
          </Text>
          <MonoLabel size={9} color={EddiesColors.steel + 'AA'} style={styles.time}>
            {time}
          </MonoLabel>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    backgroundColor: EddiesColors.ink,
    gap: EddiesSpacing.sm,
  },
  fading: { opacity: 0.3 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  label: {
    fontFamily: EddiesFonts.displaySemiBold,
    fontSize: 15,
    color: EddiesColors.bone,
    letterSpacing: 0.2,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  amount: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  time: {
    textAlign: 'right',
  },
  editBtn: {
    backgroundColor: EddiesColors.steel,
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: EddiesColors.alert,
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
