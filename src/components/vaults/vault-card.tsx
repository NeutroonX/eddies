import { Platform, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolView } from 'expo-symbols';

import { IDCard } from '@/components/ui/id-card';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { CautionStripe } from '@/components/ui/caution-stripe';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatAmountTabular } from '@/lib/money';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import type { Account } from '@/lib/schemas';

const TYPE_LABELS: Record<string, string> = {
  cash: 'CASH',
  bank: 'BANK',
  card: 'CARD',
  savings: 'SAVINGS',
};

interface VaultCardProps {
  account: Account;
  balance: number;
  isActive: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TypeIcon({ type }: { type: string }) {
  const iconMap: Record<string, string> = {
    cash: 'banknote.fill',
    bank: 'building.2.fill',
    card: 'creditcard.fill',
    savings: 'piggybank.fill',
  };
  if (Platform.OS === 'ios') {
    return <SymbolView name={iconMap[type] as any} size={12} tintColor={EddiesColors.steel} type="monochrome" />;
  }
  return null;
}

function serialFromId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(-6).padStart(6, '0');
}

export function VaultCard({ account, balance, isActive, onPress, onEdit, onDelete }: VaultCardProps) {
  const isNegative = balance < 0;
  const sym = useCurrencySymbol();
  const serial = serialFromId(account.id);
  const typeLabel = TYPE_LABELS[account.type] ?? account.type.toUpperCase();

  return (
    <ReanimatedSwipeable
      overshootFriction={8}
      renderLeftActions={() => (
        <Pressable style={s.editAction} onPress={onEdit}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable style={s.deleteAction} onPress={onDelete}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>DELETE</MonoLabel>
        </Pressable>
      )}
      onSwipeableOpen={(direction) => { if (direction === 'right') onDelete(); }}
    >
      <Pressable onPress={onPress} style={s.wrapper} accessibilityRole="button">
        <IDCard style={[s.card, isActive ? s.cardActive : undefined]}>

          <View style={s.topRow}>
            <View style={s.typeStamp}>
              <TypeIcon type={account.type} />
              <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
                VAULT // {typeLabel}
              </MonoLabel>
            </View>
            <View style={[s.colorDot, { backgroundColor: account.color }]} />
          </View>


          <Numerals size={20} weight="bold" color={EddiesColors.ink} style={s.name}>
            {account.name.toUpperCase()}
          </Numerals>

          <Numerals
            size={34}
            weight="bold"
            color={isNegative ? EddiesColors.alert : EddiesColors.ink}
            style={s.balance}
          >
            {isNegative ? '−' : ''}{sym}{formatAmountTabular(Math.abs(balance))}
          </Numerals>

          {isNegative && <CautionStripe height={6} style={s.cautionStripe} />}

          <BarcodeMark height={20} color={EddiesColors.ink} style={s.barcode} />

          <View style={s.footer}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel}>
              {`SN-${serial} // ${account.name.toUpperCase()}`}
            </MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel}>
              {account.currency}
            </MonoLabel>
          </View>

          {isActive && <View style={s.activeEdge} />}

        </IDCard>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xs,
    backgroundColor: EddiesColors.ink,
  },
  card: {
    gap: 2,
    overflow: 'hidden',
  },
  cardActive: {
    // slight shadow tint to show selection — stock bg handles itself
    opacity: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    marginTop: EddiesSpacing.xs,
    letterSpacing: 1,
  },
  balance: {
    marginTop: EddiesSpacing.xs,
    letterSpacing: -0.5,
  },
  cautionStripe: {
    marginTop: EddiesSpacing.xs,
    marginHorizontal: -EddiesSpacing.md,
  },
  barcode: {
    marginTop: EddiesSpacing.xs,
    marginHorizontal: -EddiesSpacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: EddiesSpacing.xs,
  },
  activeEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: EddiesColors.alert,
  },
  editAction: {
    backgroundColor: EddiesColors.steel,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    marginVertical: EddiesSpacing.sm,
    borderRadius: 2,
  },
  deleteAction: {
    backgroundColor: EddiesColors.alert,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    marginVertical: EddiesSpacing.sm,
    borderRadius: 2,
  },
});
