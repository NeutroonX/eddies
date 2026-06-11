import { forwardRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import type { Account } from '@/lib/schemas';

const TYPE_LABELS: Record<string, string> = {
  cash: 'CASH',
  bank: 'BANK',
  card: 'CARD',
  upi: 'UPI',
};

export interface VaultShareRow {
  label: string;
  value: string;
}

/**
 * Field rows shown on the shareable image / copied to clipboard.
 * Single source of truth for both COPY and SHARE so they never drift.
 */
export function vaultShareRows(account: Account): VaultShareRow[] {
  const rows: VaultShareRow[] = [];
  if (account.type === 'bank') {
    rows.push(
      { label: 'A/C NO', value: account.bank_account_number || '—' },
      { label: 'A/C TYPE', value: account.bank_account_type || 'SAVINGS' },
      { label: 'IFSC', value: account.bank_ifsc || '—' },
      { label: 'BRANCH', value: account.bank_branch || '—' },
    );
  } else if (account.type === 'card') {
    rows.push(
      { label: 'NETWORK', value: account.card_network || '—' },
      { label: 'CARD NO', value: account.card_full_number || '—' },
      { label: 'CVV', value: account.card_cvv || '—' },
      { label: 'EXPIRY', value: account.card_expiry || '—' },
    );
  } else if (account.type === 'upi') {
    rows.push(
      { label: 'UPI ID', value: account.upi_id || '—' },
      { label: 'PHONE', value: account.upi_phone || '—' },
    );
  } else {
    rows.push({ label: 'VAULT', value: 'PHYSICAL CASH VAULT' });
  }
  return rows;
}

/** Plaintext block for the COPY action. */
export function vaultShareText(account: Account): string {
  const typeLabel = TYPE_LABELS[account.type] ?? account.type.toUpperCase();
  const lines = [
    'EDDIES // VAULT DETAILS',
    '--------------------------------',
    `NAME:     ${account.name.toUpperCase()}`,
    `TYPE:     ${typeLabel}`,
    `CURRENCY: ${account.currency}`,
    '--------------------------------',
    ...vaultShareRows(account).map(r => `${r.label}: ${r.value}`),
    '--------------------------------',
    `ID: ${account.id}`,
  ];
  return lines.join('\n');
}

interface VaultShareCardProps {
  account: Account;
  balanceLabel: string;
}

/**
 * Off-screen render target captured by react-native-view-shot into a
 * shareable social image. Fixed width so the exported PNG is consistent.
 */
export const VaultShareCard = forwardRef<View, VaultShareCardProps>(
  function VaultShareCard({ account, balanceLabel }, ref) {
    const typeLabel = TYPE_LABELS[account.type] ?? account.type.toUpperCase();
    const rows = vaultShareRows(account);

    return (
      <View ref={ref} collapsable={false} style={s.canvas}>
        <View style={s.topRow}>
          <MonoLabel size={12} letterSpacing={3} color={EddiesColors.steel}>
            EDDIES // VAULT
          </MonoLabel>
          <View style={[s.colorDot, { backgroundColor: account.color }]} />
        </View>

        <Numerals size={40} weight="bold" color={EddiesColors.ink} style={s.name}>
          {account.name.toUpperCase()}
        </Numerals>
        <MonoLabel size={11} letterSpacing={2} color={EddiesColors.steel}>
          {typeLabel} // {account.currency}
        </MonoLabel>

        <View style={s.balanceBlock}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>BALANCE</MonoLabel>
          <Numerals size={44} weight="bold" color={EddiesColors.ink} style={s.balance}>
            {balanceLabel}
          </Numerals>
        </View>

        <View style={s.divider} />

        <View style={s.rows}>
          {rows.map(row => (
            <View key={row.label} style={s.detailRow}>
              <MonoLabel size={10} letterSpacing={1} color={EddiesColors.steel}>{row.label}</MonoLabel>
              <Text style={s.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <BarcodeMark height={28} color={EddiesColors.ink} style={s.barcode} />

        <View style={s.footer}>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
            {new Date().toLocaleDateString()}
          </MonoLabel>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
            EDDIES FIN
          </MonoLabel>
        </View>
      </View>
    );
  },
);

const s = StyleSheet.create({
  canvas: {
    width: 380,
    padding: EddiesSpacing.xl,
    backgroundColor: EddiesColors.stock,
    gap: EddiesSpacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  name: {
    marginTop: EddiesSpacing.sm,
    letterSpacing: 1,
  },
  balanceBlock: {
    marginTop: EddiesSpacing.md,
    gap: 2,
  },
  balance: {
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: EddiesColors.ink + '22',
    marginVertical: EddiesSpacing.sm,
  },
  rows: {
    gap: EddiesSpacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: EddiesSpacing.md,
  },
  detailValue: {
    fontFamily: EddiesFonts.monoBold,
    fontSize: 15,
    color: EddiesColors.ink,
    letterSpacing: 0.5,
    flexShrink: 1,
    textAlign: 'right',
  },
  barcode: {
    marginTop: EddiesSpacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: EddiesSpacing.xs,
  },
});
