import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Keyboard } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import type { Account, NewAccount } from '@/lib/schemas';

interface VaultFormProps {
  initialData?: Account;
  onSave: (data: NewAccount) => Promise<void> | void;
  onCancel: () => void;
}

const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'savings'] as const;
const PRESET_COLORS = [EddiesColors.stock, EddiesColors.bone, EddiesColors.alert, EddiesColors.steel, '#E5B8F4', '#B5E7A0'];

export function VaultForm({ initialData, onSave, onCancel }: VaultFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<typeof ACCOUNT_TYPES[number]>(
    (initialData?.type as typeof ACCOUNT_TYPES[number]) ?? 'cash'
  );
  const currency = initialData?.currency ?? 'USD';
  const [rawBalance, setRawBalance] = useState(
    initialData ? (initialData.opening_balance_minor / 100).toString() : '0'
  );
  const [color, setColor] = useState(initialData?.color ?? EddiesColors.stock);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => {
    const nameOk = name.trim().length > 0;
    const balanceNum = parseFloat(rawBalance || '0');
    const balanceOk = !isNaN(balanceNum) && balanceNum >= 0;
    return nameOk && balanceOk;
  }, [name, rawBalance]);

  function handleBalanceChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setRawBalance(cleaned);
  }

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const balanceNum = parseFloat(rawBalance || '0');
      const balanceMinor = Math.round(balanceNum * 100);
      await onSave({
        name: name.trim(),
        type,
        currency,
        opening_balance_minor: balanceMinor,
        color,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>NAME</MonoLabel>
        <TextInput
          style={s.input}
          placeholder="Vault name"
          placeholderTextColor={EddiesColors.steel + '66'}
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoFocus
        />
      </View>

      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>TYPE</MonoLabel>
        <View style={s.pills}>
          {ACCOUNT_TYPES.map(t => (
            <Pill
              key={t}
              label={t.toUpperCase()}
              active={type === t}
              onPress={() => setType(t)}
            />
          ))}
        </View>
      </View>

      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>CURRENCY</MonoLabel>
        <Pressable style={s.currencyPill}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>{currency}</MonoLabel>
        </Pressable>
      </View>

      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>OPENING BALANCE</MonoLabel>
        <TextInput
          style={s.input}
          placeholder="0.00"
          placeholderTextColor={EddiesColors.steel + '66'}
          value={rawBalance}
          onChangeText={handleBalanceChange}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>COLOR</MonoLabel>
        <View style={s.colorGrid}>
          {PRESET_COLORS.map(c => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[s.colorSwatch, { backgroundColor: c, borderColor: color === c ? EddiesColors.bone : 'transparent' }]}
            />
          ))}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            onCancel();
          }}
          style={s.cancelBtn}
        >
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CANCEL</MonoLabel>
        </Pressable>
        <StampButton
          label="SAVE VAULT"
          onPress={() => {
            Keyboard.dismiss();
            handleSave();
          }}
          disabled={!isValid || saving}
          loading={saving}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
  },
  scrollContent: {
    padding: EddiesSpacing.md,
    gap: EddiesSpacing.lg,
  },
  section: {
    gap: EddiesSpacing.sm,
  },
  input: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
    borderRadius: 4,
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm,
    color: EddiesColors.bone,
    fontFamily: EddiesFonts.mono,
    fontSize: 14,
  },
  pills: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    flexWrap: 'wrap',
  },
  currencyPill: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
    borderRadius: 4,
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm,
    alignSelf: 'flex-start',
  },
  colorGrid: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    marginTop: EddiesSpacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: EddiesSpacing.sm,
    alignItems: 'center',
  },
});
