import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Keyboard } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { WORLD_CURRENCIES } from '@/constants/currencies';
import type { Account, NewAccount } from '@/lib/schemas';

interface VaultFormProps {
  initialData?: Account;
  onSave: (data: NewAccount) => Promise<void> | void;
  onCancel: () => void;
}

const PRESET_TYPES = ['cash', 'bank', 'card', 'savings'] as const;
const PRESET_COLORS = [EddiesColors.stock, EddiesColors.bone, EddiesColors.alert, EddiesColors.steel, '#E5B8F4', '#B5E7A0'];

export function VaultForm({ initialData, onSave, onCancel }: VaultFormProps) {
  const isPreset = PRESET_TYPES.includes(initialData?.type as any);
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<string>(initialData?.type ?? 'cash');
  const [typeIsOther, setTypeIsOther] = useState(!isPreset && !!initialData?.type);
  const [otherType, setOtherType] = useState(!isPreset ? (initialData?.type ?? '') : '');
  const [currency, setCurrency] = useState(initialData?.currency ?? 'USD');
  const [currencySearch, setCurrencySearch] = useState('');
  const [rawBalance, setRawBalance] = useState(initialData ? (initialData.opening_balance_minor / 100).toString() : '0');
  const [color, setColor] = useState(initialData?.color ?? EddiesColors.stock);
  const [saving, setSaving] = useState(false);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toUpperCase();
    if (!q) return WORLD_CURRENCIES;
    return WORLD_CURRENCIES.filter(c => c.code.includes(q) || c.name.toUpperCase().includes(q));
  }, [currencySearch]);

  const isValid = useMemo(() => {
    const nameOk = name.trim().length > 0;
    const typeOk = typeIsOther ? otherType.trim().length > 0 : type.length > 0;
    const balanceOk = !isNaN(parseFloat(rawBalance || '0'));
    return nameOk && typeOk && balanceOk;
  }, [name, type, typeIsOther, otherType, rawBalance]);

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
      const resolvedType = typeIsOther ? otherType.trim().toLowerCase() : type;
      await onSave({
        name: name.trim(),
        type: resolvedType,
        currency,
        opening_balance_minor: Math.round(parseFloat(rawBalance || '0') * 100),
        color,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

      {/* NAME */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>NAME</MonoLabel>
        <TextInput style={s.input} placeholder="Vault name" placeholderTextColor={EddiesColors.steel + '66'} value={name} onChangeText={setName} maxLength={40} autoFocus />
      </View>

      {/* TYPE */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>TYPE</MonoLabel>
        <View style={s.pills}>
          {PRESET_TYPES.map(t => (
            <Pill key={t} label={t.toUpperCase()} active={!typeIsOther && type === t}
              onPress={() => { setType(t); setTypeIsOther(false); setOtherType(''); }} />
          ))}
          <Pill label="OTHER" active={typeIsOther} color={EddiesColors.steel}
            onPress={() => { setTypeIsOther(!typeIsOther); if (!typeIsOther) setType(''); }} />
        </View>
        {typeIsOther && (
          <TextInput
            style={s.input}
            placeholder="e.g. CRYPTO, INVESTMENT"
            placeholderTextColor={EddiesColors.steel + '66'}
            value={otherType}
            onChangeText={setOtherType}
            maxLength={30}
            autoCapitalize="words"
            autoFocus
          />
        )}
      </View>

      {/* CURRENCY */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>CURRENCY</MonoLabel>
        <TextInput
          style={s.input}
          placeholder="SEARCH..."
          placeholderTextColor={EddiesColors.steel + '66'}
          value={currencySearch}
          onChangeText={setCurrencySearch}
          autoCapitalize="characters"
          maxLength={10}
        />
        <ScrollView style={s.currencyList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {filteredCurrencies.map(c => {
            const active = currency === c.code;
            return (
              <Pressable
                key={c.code}
                style={[s.currencyRow, active && s.currencyRowActive]}
                onPress={() => { setCurrency(c.code); setCurrencySearch(''); }}
              >
                <MonoLabel size={11} weight="bold" color={active ? EddiesColors.ink : EddiesColors.bone} letterSpacing={1}>
                  {c.code}
                </MonoLabel>
                <MonoLabel size={10} color={active ? EddiesColors.ink + 'AA' : EddiesColors.steel}>
                  {c.symbol}  {c.name}
                </MonoLabel>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* OPENING BALANCE */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>OPENING BALANCE</MonoLabel>
        <TextInput style={s.input} placeholder="0.00" placeholderTextColor={EddiesColors.steel + '66'} value={rawBalance} onChangeText={handleBalanceChange} keyboardType="decimal-pad" />
      </View>

      {/* COLOR */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>COLOR</MonoLabel>
        <View style={s.colorGrid}>
          {PRESET_COLORS.map(c => (
            <Pressable key={c} onPress={() => setColor(c)} style={[s.colorSwatch, { backgroundColor: c, borderColor: color === c ? EddiesColors.bone : 'transparent' }]} />
          ))}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable onPress={() => { Keyboard.dismiss(); onCancel(); }} style={s.cancelBtn}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CANCEL</MonoLabel>
        </Pressable>
        <StampButton label="SAVE VAULT" onPress={() => { Keyboard.dismiss(); handleSave(); }} disabled={!isValid || saving} loading={saving} />
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: EddiesColors.ink },
  scrollContent: { padding: EddiesSpacing.md, gap: EddiesSpacing.lg },
  section: { gap: EddiesSpacing.sm },
  input: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', borderRadius: 4,
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.sm,
    color: EddiesColors.bone, fontFamily: EddiesFonts.mono, fontSize: 14,
  },
  pills: { flexDirection: 'row', gap: EddiesSpacing.sm, flexWrap: 'wrap' },
  currencyList: {
    maxHeight: 180,
    borderWidth: 1, borderColor: EddiesColors.steel + '22',
  },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.xs + 2,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
  currencyRowActive: { backgroundColor: EddiesColors.bone },
  colorGrid: { flexDirection: 'row', gap: EddiesSpacing.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 40, height: 40, borderRadius: 4, borderWidth: 2 },
  actions: { flexDirection: 'row', gap: EddiesSpacing.sm, marginTop: EddiesSpacing.lg },
  cancelBtn: { flex: 1, paddingVertical: EddiesSpacing.sm, alignItems: 'center' },
});
