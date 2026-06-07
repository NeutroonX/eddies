import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Keyboard } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { WORLD_CURRENCIES } from '@/constants/currencies';
import { useStore } from '@/store/index';
import type { Account, NewAccount } from '@/lib/schemas';

interface VaultFormProps {
  initialData?: Account;
  onSave: (data: NewAccount) => Promise<void> | void;
  onCancel: () => void;
}

const PRESET_TYPES = ['cash', 'bank', 'card', 'savings'] as const;
const PRESET_COLORS = [EddiesColors.stock, EddiesColors.bone, EddiesColors.alert, EddiesColors.steel, '#E5B8F4', '#B5E7A0'];

export function VaultForm({ initialData, onSave, onCancel }: VaultFormProps) {
  const preferredCurrency = useStore(s => s.currency);
  const isPreset = (PRESET_TYPES as readonly string[]).includes(initialData?.type ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<string>(initialData?.type ?? 'cash');
  const [typeIsOther, setTypeIsOther] = useState(!isPreset && !!initialData?.type);
  const [otherType, setOtherType] = useState(!isPreset ? (initialData?.type ?? '') : '');
  const [currency, setCurrency] = useState(initialData?.currency ?? preferredCurrency);

  // Keep default currency in sync when user changes it in settings (new vault only)
  useEffect(() => {
    if (!initialData) setCurrency(preferredCurrency);
  }, [preferredCurrency, initialData]);
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
        <View style={s.currencyHeader}>
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>CURRENCY</MonoLabel>
          <View style={s.currencyBadge}>
            <MonoLabel size={11} weight="bold" color={EddiesColors.alert} letterSpacing={1}>
              {currency}
            </MonoLabel>
            <MonoLabel size={10} color={EddiesColors.steel}>
              {WORLD_CURRENCIES.find(c => c.code === currency)?.symbol ?? ''}
            </MonoLabel>
          </View>
        </View>
        <View style={s.searchBox}>
          <MonoLabel size={10} color={EddiesColors.steel} letterSpacing={1}>⌕</MonoLabel>
          <TextInput
            style={s.searchInput}
            placeholder="Search code or name..."
            placeholderTextColor={EddiesColors.steel + '66'}
            value={currencySearch}
            onChangeText={setCurrencySearch}
            autoCapitalize="characters"
            maxLength={20}
            returnKeyType="search"
          />
          {currencySearch.length > 0 && (
            <Pressable onPress={() => setCurrencySearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear currency search">
              <MonoLabel size={10} color={EddiesColors.steel}>✕</MonoLabel>
            </Pressable>
          )}
        </View>
        <View style={s.currencyList}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {filteredCurrencies.map(c => {
              const active = currency === c.code;
              return (
                <Pressable
                  key={c.code}
                  style={[s.currencyRow, active && s.currencyRowActive]}
                  onPress={() => { setCurrency(c.code); setCurrencySearch(''); Keyboard.dismiss(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.code} — ${c.name}`}
                  accessibilityState={{ selected: active }}
                >
                  <View style={s.currencyRowLeft}>
                    <MonoLabel size={11} weight="bold" color={active ? EddiesColors.ink : EddiesColors.bone} letterSpacing={1}>
                      {c.code}
                    </MonoLabel>
                    <MonoLabel size={9} color={active ? EddiesColors.ink + 'BB' : EddiesColors.steel}>
                      {c.name}
                    </MonoLabel>
                  </View>
                  <MonoLabel size={13} weight="bold" color={active ? EddiesColors.alert : EddiesColors.steel + '88'}>
                    {c.symbol}
                  </MonoLabel>
                </Pressable>
              );
            })}
            {filteredCurrencies.length === 0 && (
              <View style={s.currencyEmpty}>
                <MonoLabel size={10} color={EddiesColors.steel}>NO RESULTS</MonoLabel>
              </View>
            )}
          </ScrollView>
        </View>
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
            <Pressable key={c} onPress={() => setColor(c)} style={[s.colorSwatch, { backgroundColor: c, borderColor: color === c ? EddiesColors.bone : 'transparent' }]} accessibilityRole="button" accessibilityLabel={`Select color ${c}`} accessibilityState={{ selected: color === c }} />
          ))}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable onPress={() => { Keyboard.dismiss(); onCancel(); }} style={s.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancel">
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
  currencyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  currencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.xs,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.alert + '40',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: 3,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33',
    paddingHorizontal: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
  },
  searchInput: {
    flex: 1,
    color: EddiesColors.bone, fontFamily: EddiesFonts.mono, fontSize: 13,
    paddingVertical: EddiesSpacing.sm,
    includeFontPadding: false,
  },
  currencyList: {
    maxHeight: 200,
    borderWidth: 1, borderColor: EddiesColors.steel + '22',
    backgroundColor: EddiesColors.surface,
  },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
  currencyRowLeft: { gap: 2 },
  currencyRowActive: { backgroundColor: EddiesColors.bone },
  currencyEmpty: {
    paddingVertical: EddiesSpacing.lg, alignItems: 'center',
  },
  colorGrid: { flexDirection: 'row', gap: EddiesSpacing.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 40, height: 40, borderRadius: 4, borderWidth: 2 },
  actions: { flexDirection: 'row', gap: EddiesSpacing.sm, marginTop: EddiesSpacing.lg },
  cancelBtn: { flex: 1, paddingVertical: EddiesSpacing.sm, alignItems: 'center' },
});
