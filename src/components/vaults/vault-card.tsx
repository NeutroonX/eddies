import { memo, useState, useRef } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, Share, Text } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolView } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';

import { IDCard } from '@/components/ui/id-card';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { CautionStripe } from '@/components/ui/caution-stripe';
import { VaultShareCard, vaultShareText } from '@/components/vaults/vault-share-card';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { formatAmountTabular } from '@/lib/money';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import type { Account } from '@/lib/schemas';

const TYPE_LABELS: Record<string, string> = {
  cash: 'CASH',
  bank: 'BANK',
  card: 'CARD',
  upi: 'UPI',
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
    upi: 'qrcode',
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

export const VaultCard = memo(function VaultCard({ account, balance, isActive, onPress, onEdit, onDelete }: VaultCardProps) {
  const isNegative = balance < 0;
  const sym = useCurrencySymbol();
  const serial = serialFromId(account.id);
  const typeLabel = TYPE_LABELS[account.type] ?? account.type.toUpperCase();
  const swipeRef = useRef<SwipeableMethods>(null);
  const shareCardRef = useRef<View>(null);
  const actionFiredRef = useRef(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Guards against double-firing when both the swipe-open and a button tap land.
  function triggerEdit() {
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    swipeRef.current?.close();
    onEdit();
  }

  function triggerDelete() {
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    swipeRef.current?.close();
    onDelete();
  }

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(vaultShareText(account));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Copied', `${account.name} details copied to clipboard.`);
    } catch (err) {
      console.error('Copy error:', err);
      Alert.alert('Copy failed', 'Could not copy vault details.');
    }
  }

  async function handleShare() {
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Eddies Vault: ${account.name}`,
          UTI: 'public.png',
        });
      } else {
        // Fallback: share the plaintext details if the OS share sheet is unavailable.
        await Share.share({
          message: vaultShareText(account),
          title: `Eddies Vault: ${account.name}`,
        });
      }
    } catch (err) {
      console.error('Sharing error:', err);
      Alert.alert('Share failed', 'Could not generate the share image.');
    }
  }

  return (
    <>
      {detailsVisible && (
        <View style={s.offscreen} pointerEvents="none" aria-hidden>
          <VaultShareCard ref={shareCardRef} account={account} />
        </View>
      )}
    <ReanimatedSwipeable
      ref={swipeRef}
      overshootFriction={8}
      onSwipeableOpen={(direction) => {
        // direction is the swipe direction: 'right' reveals the left (EDIT) actions.
        if (direction === 'right') triggerEdit();
        else triggerDelete();
      }}
      onSwipeableClose={() => { actionFiredRef.current = false; }}
      renderLeftActions={() => (
        <Pressable style={s.editAction} onPress={triggerEdit} accessibilityRole="button" accessibilityLabel={`Edit ${account.name}`}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>EDIT</MonoLabel>
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable style={s.deleteAction} onPress={triggerDelete} accessibilityRole="button" accessibilityLabel={`Delete ${account.name}`}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>DELETE</MonoLabel>
        </Pressable>
      )}
    >
      <Pressable
        onPress={onPress}
        onLongPress={() =>
          Alert.alert(
            account.name,
            undefined,
            [
              { text: 'Edit', onPress: triggerEdit },
              { text: 'Delete', style: 'destructive', onPress: triggerDelete },
              { text: 'Cancel', style: 'cancel' },
            ]
          )
        }
        style={s.wrapper}
        accessibilityRole="button"
      >
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

          {!detailsVisible ? (
            <View style={s.mainBalance}>
              <Numerals
                size={34}
                weight="bold"
                color={isNegative ? EddiesColors.alert : EddiesColors.ink}
                style={s.balance}
              >
                {isNegative ? '−' : ''}{sym}{formatAmountTabular(Math.abs(balance))}
              </Numerals>
              <Pressable style={s.showBtn} onPress={() => setDetailsVisible(true)}>
                <MonoLabel size={9} weight="bold" color={EddiesColors.steel}>[ SHOW ]</MonoLabel>
              </Pressable>
            </View>
          ) : (
            <View style={s.detailsBlock}>
              <View style={s.detailsRow}>
                <View style={{ flex: 1 }}>
                  {account.type === 'bank' && (
                    <>
                      <MonoLabel size={8} color={EddiesColors.steel}>A/C NO</MonoLabel>
                      <Text style={s.detailText} selectable>{account.bank_account_number || '—'}</Text>
                      <MonoLabel size={8} color={EddiesColors.steel} style={{ marginTop: 4 }}>A/C TYPE</MonoLabel>
                      <Text style={s.detailText}>{account.bank_account_type || 'SAVINGS'}</Text>
                    </>
                  )}
                  {account.type === 'card' && (
                    <>
                      <MonoLabel size={8} color={EddiesColors.steel}>CARD NO</MonoLabel>
                      <Text style={s.detailText} selectable>{account.card_full_number || '—'}</Text>
                      <View style={s.minimalGridSmall}>
                        <View style={{ flex: 1.5 }}>
                          <MonoLabel size={8} color={EddiesColors.steel}>CVV</MonoLabel>
                          <Text style={s.detailText} selectable>{account.card_cvv || '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <MonoLabel size={8} color={EddiesColors.steel}>EXP</MonoLabel>
                          <Text style={s.detailText}>{account.card_expiry || '—'}</Text>
                        </View>
                      </View>
                    </>
                  )}
                  {account.type === 'upi' && (
                    <>
                      <MonoLabel size={8} color={EddiesColors.steel}>UPI ID</MonoLabel>
                      <Text style={s.detailText} selectable>{account.upi_id || '—'}</Text>
                    </>
                  )}
                  {account.type === 'cash' && (
                    <MonoLabel size={9} color={EddiesColors.ink}>PHYSICAL CASH VAULT</MonoLabel>
                  )}
                </View>
                <View style={s.detailActions}>
                  <Pressable style={s.actionBtn} onPress={handleCopy}>
                    <MonoLabel size={8} weight="bold" color={EddiesColors.ink}>COPY</MonoLabel>
                  </Pressable>
                  <Pressable style={s.actionBtn} onPress={handleShare}>
                    <MonoLabel size={8} weight="bold" color={EddiesColors.ink}>SHARE</MonoLabel>
                  </Pressable>
                  <Pressable style={s.hideBtn} onPress={() => setDetailsVisible(false)}>
                    <MonoLabel size={8} weight="bold" color={EddiesColors.alert}>HIDE</MonoLabel>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

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
    </>
  );
});

const s = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
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
  mainBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: EddiesSpacing.xs,
  },
  balance: {
    letterSpacing: -0.5,
  },
  showBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
    borderRadius: 2,
  },
  detailsBlock: {
    marginTop: EddiesSpacing.xs,
    minHeight: 50,
    justifyContent: 'center',
  },
  minimalGridSmall: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    marginTop: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontFamily: EddiesFonts.monoBold,
    fontSize: 13,
    color: EddiesColors.ink,
    letterSpacing: 0.5,
  },
  detailActions: {
    gap: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: EddiesColors.bone + '44',
    borderWidth: 1,
    borderColor: EddiesColors.ink + '22',
    borderRadius: 2,
  },
  hideBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
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
