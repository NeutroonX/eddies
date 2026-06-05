import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SymbolView } from 'expo-symbols';

import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { EddiesColors, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { formatAmountTabular } from '@/lib/money';
import type { Account } from '@/lib/schemas';

interface VaultCardProps {
  account: Account;
  balance: number;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}

function AccountTypeIcon({ type, color }: { type: string; color: string }) {
  const iconMap: Record<string, string> = {
    cash: 'banknote.fill',
    bank: 'building.2.fill',
    card: 'creditcard.fill',
    savings: 'piggybank.fill',
  };

  if (Platform.OS === 'ios') {
    return <SymbolView name={iconMap[type] as any} size={16} tintColor={color} type="monochrome" />;
  }
  return <MonoLabel size={14} color={color}>{type[0].toUpperCase()}</MonoLabel>;
}

function DeleteAction() {
  return (
    <Pressable style={s.deleteAction}>
      <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>DELETE</MonoLabel>
    </Pressable>
  );
}

export function VaultCard({ account, balance, isActive, onPress, onDelete }: VaultCardProps) {
  const isNegative = balance < 0;

  return (
    <Swipeable
      overshootFriction={8}
      renderRightActions={() => <DeleteAction />}
      onSwipeableRightOpen={onDelete}
    >
      <Pressable onPress={onPress} style={[s.card, isActive && s.cardActive]}>
        <View style={[s.swatch, { backgroundColor: account.color }]} />
        <View style={s.content}>
          <MonoLabel size={12} weight="bold" color={EddiesColors.bone}>
            {account.name.toUpperCase()}
          </MonoLabel>
          <View style={s.typeRow}>
            <AccountTypeIcon type={account.type} color={EddiesColors.steel} />
            <MonoLabel size={10} letterSpacing={0.5} color={EddiesColors.steel}>
              {account.type.toUpperCase()} • {account.currency}
            </MonoLabel>
          </View>
        </View>
        <View style={s.balance}>
          <Numerals
            size={20}
            weight="semibold"
            color={isNegative ? EddiesColors.alert : EddiesColors.bone}
          >
            {isNegative ? '−' : ''}{formatAmountTabular(Math.abs(balance))}
          </Numerals>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '1A',
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  cardActive: {
    borderLeftColor: EddiesColors.bone,
    backgroundColor: EddiesColors.surface,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: EddiesRadius.card,
    marginRight: EddiesSpacing.md,
  },
  content: {
    flex: 1,
    gap: EddiesSpacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.xs,
  },
  balance: {
    alignItems: 'flex-end',
  },
  deleteAction: {
    backgroundColor: EddiesColors.alert,
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.md,
  },
});
