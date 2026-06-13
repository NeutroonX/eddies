import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Keyboard } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { StampButton } from '@/components/ui/stamp-button';
import { MaskedField } from '@/components/ui/masked-field';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { WORLD_CURRENCIES } from '@/constants/currencies';
import { useStore } from '@/store/index';
import type { Account, NewAccount } from '@/lib/schemas';

interface VaultFormProps {
  initialData?: Account;
  onSave: (data: NewAccount) => Promise<void> | void;
  onCancel: () => void;
}

const PRESET_TYPES = ['cash', 'bank', 'card', 'upi'] as const;
const PRESET_COLORS = [EddiesColors.stock, EddiesColors.bone, EddiesColors.alert, EddiesColors.steel, '#E5B8F4', '#B5E7A0'];

export function VaultForm({ initialData, onSave, onCancel }: VaultFormProps) {
  const preferredCurrency = useStore(s => s.currency);
  
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<string>(initialData?.type ?? 'cash');
  const [currency, setCurrency] = useState(initialData?.currency ?? preferredCurrency);

  // Bank details
  const [bankAccountNumber, setBankAccountNumber] = useState(initialData?.bank_account_number ?? '');
  const [bankAccountType, setBankAccountType] = useState(initialData?.bank_account_type ?? 'SAVINGS');
  const [bankIfsc, setBankIfsc] = useState(initialData?.bank_ifsc ?? '');
  const [bankBranch, setBankBranch] = useState(initialData?.bank_branch ?? '');

  // UPI details
  const [upiId, setUpiId] = useState(initialData?.upi_id ?? '');
  const [upiPhone, setUpiPhone] = useState(initialData?.upi_phone ?? '');

  // Card details
  const [cardNetwork, setCardNetwork] = useState(initialData?.card_network ?? '');
  const [cardFullNumber, setCardFullNumber] = useState(initialData?.card_full_number ?? '');
  const [cardCvv, setCardCvv] = useState(initialData?.card_cvv ?? '');
  const [cardExpiry, setCardExpiry] = useState(initialData?.card_expiry ?? '');

  useEffect(() => {
    // preferredCurrency hydrates from the store after mount, so this default
    // must be applied in an effect rather than a lazy initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const typeOk = type.length > 0;
    const balanceOk = !isNaN(parseFloat(rawBalance || '0'));
    return nameOk && typeOk && balanceOk;
  }, [name, type, rawBalance]);

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
      await onSave({
        name: name.trim(),
        type: type,
        currency,
        opening_balance_minor: Math.round(parseFloat(rawBalance || '0') * 100),
        color,
        bank_account_number: bankAccountNumber.trim() || null,
        bank_account_type: bankAccountType.trim() || null,
        bank_ifsc: bankIfsc.trim() || null,
        bank_branch: bankBranch.trim() || null,
        upi_id: upiId.trim() || null,
        upi_phone: upiPhone.trim() || null,
        card_network: cardNetwork.trim() || null,
        card_full_number: cardFullNumber.trim() || null,
        card_cvv: cardCvv.trim() || null,
        card_expiry: cardExpiry.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  const normalizedType = type.toLowerCase();
  const isBank = normalizedType === 'bank';
  const isCard = normalizedType === 'card';
  const isUpi = normalizedType === 'upi';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

      {/* NAME */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>NAME</MonoLabel>
        <TextInput style={s.input} placeholder="Vault name" placeholderTextColor={EddiesColors.steel + '66'} value={name} onChangeText={setName} maxLength={40} />
      </View>

      {/* TYPE */}
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>TYPE</MonoLabel>
        <View style={s.pills}>
          {PRESET_TYPES.map(t => (
            <Pill key={t} label={t.toUpperCase()} active={type === t}
              onPress={() => { setType(t); }} />
          ))}
        </View>
      </View>

      {/* ── MODULAR DETAILS (MINIMAL) ─────────────────────────── */}
      
      {isBank && (
        <View style={s.minimalModule}>
          <View style={s.minimalGrid}>
            <View style={{ flex: 1.5 }}>
              <MaskedField 
                label="A/C NUMBER" 
                value={bankAccountNumber} 
                onChangeText={setBankAccountNumber} 
                placeholder="0000000000"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>A/C TYPE</MonoLabel>
              <View style={s.pillsSmall}>
                {['SAVINGS', 'CURRENT'].map(t => (
                  <Pill key={t} label={t} active={bankAccountType.toUpperCase() === t} onPress={() => setBankAccountType(t)} />
                ))}
              </View>
            </View>
          </View>
          <View style={s.minimalGrid}>
            <View style={{ flex: 1 }}>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>IFSC</MonoLabel>
              <TextInput 
                style={s.minimalInput} 
                value={bankIfsc} 
                onChangeText={setBankIfsc} 
                placeholder="CODE" 
                autoCapitalize="characters" 
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>BRANCH</MonoLabel>
              <TextInput 
                style={s.minimalInput} 
                value={bankBranch} 
                onChangeText={setBankBranch} 
                placeholder="Name" 
              />
            </View>
          </View>
        </View>
      )}

      {isUpi && (
        <View style={s.minimalModule}>
          <MaskedField 
            label="VPA / UPI ID" 
            value={upiId} 
            onChangeText={setUpiId} 
            placeholder="user@bank"
          />
          <View style={{ marginTop: 4 }}>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>PHONE</MonoLabel>
            <TextInput 
              style={s.minimalInput} 
              value={upiPhone} 
              onChangeText={setUpiPhone} 
              placeholder="+91..." 
              keyboardType="phone-pad"
            />
          </View>
        </View>
      )}

      {isCard && (
        <View style={s.minimalModule}>
          <View>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>NETWORK</MonoLabel>
            <View style={s.pillsSmall}>
              {['VISA', 'MC', 'AMEX', 'RUPAY'].map(n => (
                <Pill key={n} label={n} active={cardNetwork === n} onPress={() => setCardNetwork(n)} />
              ))}
            </View>
          </View>
          <MaskedField 
            label="FULL CARD NUMBER" 
            value={cardFullNumber} 
            onChangeText={setCardFullNumber} 
            placeholder="0000 0000 0000 0000" 
            keyboardType="numeric"
          />
          <View style={s.minimalGrid}>
            <View style={{ flex: 1 }}>
              <MaskedField 
                label="CVV" 
                value={cardCvv} 
                onChangeText={setCardCvv} 
                placeholder="000" 
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>EXPIRY</MonoLabel>
              <TextInput 
                style={s.minimalInput} 
                value={cardExpiry} 
                onChangeText={setCardExpiry} 
                placeholder="MM/YY" 
                maxLength={5}
              />
            </View>
          </View>
        </View>
      )}

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
        </View>
        <View style={s.currencyList}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {filteredCurrencies.slice(0, 50).map(c => {
              const active = currency === c.code;
              return (
                <Pressable
                  key={c.code}
                  style={[s.currencyRow, active && s.currencyRowActive]}
                  onPress={() => { setCurrency(c.code); setCurrencySearch(''); Keyboard.dismiss(); }}
                >
                  <View style={s.currencyRowLeft}>
                    <MonoLabel size={11} weight="bold" color={active ? EddiesColors.ink : EddiesColors.bone}>{c.code}</MonoLabel>
                    <MonoLabel size={9} color={active ? EddiesColors.ink + 'BB' : EddiesColors.steel}>{c.name}</MonoLabel>
                  </View>
                  <MonoLabel size={13} weight="bold" color={active ? EddiesColors.alert : EddiesColors.steel + '88'}>{c.symbol}</MonoLabel>
                </Pressable>
              );
            })}
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
  field: { gap: 6 },
  input: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', borderRadius: 4,
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.sm,
    color: EddiesColors.bone, fontFamily: EddiesFonts.mono, fontSize: 14,
  },
  inputSmall: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '22', borderRadius: 4,
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: 8,
    color: EddiesColors.bone, fontFamily: EddiesFonts.mono, fontSize: 13,
    marginTop: 4,
  },
  inputRow: { flexDirection: 'row', gap: EddiesSpacing.sm },
  pills: { flexDirection: 'row', gap: EddiesSpacing.sm, flexWrap: 'wrap' },
  pillsSmall: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  
  // Minimalist Modular sections
  minimalModule: {
    gap: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface + '08',
    padding: EddiesSpacing.sm,
    borderRadius: 4,
    borderLeftWidth: 1,
    borderLeftColor: EddiesColors.steel + '33',
  },
  minimalGrid: {
    flexDirection: 'row',
    gap: EddiesSpacing.md,
    marginTop: 4,
  },
  minimalInput: {
    fontFamily: EddiesFonts.mono,
    fontSize: 13,
    color: EddiesColors.bone,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '22',
    paddingVertical: 4,
  },

  currencyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.xs,
    backgroundColor: EddiesColors.surface, borderWidth: 1, borderColor: EddiesColors.alert + '40',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: 3,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', paddingHorizontal: EddiesSpacing.sm, gap: EddiesSpacing.xs,
  },
  searchInput: { flex: 1, color: EddiesColors.bone, fontFamily: EddiesFonts.mono, fontSize: 13, paddingVertical: EddiesSpacing.sm },
  currencyList: { maxHeight: 160, borderWidth: 1, borderColor: EddiesColors.steel + '22', backgroundColor: EddiesColors.surface },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
  currencyRowLeft: { gap: 2 },
  currencyRowActive: { backgroundColor: EddiesColors.bone },
  colorGrid: { flexDirection: 'row', gap: EddiesSpacing.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 40, height: 40, borderRadius: 4, borderWidth: 2 },
  actions: { flexDirection: 'row', gap: EddiesSpacing.sm, marginTop: EddiesSpacing.lg, paddingBottom: 40 },
  cancelBtn: { flex: 1, paddingVertical: EddiesSpacing.sm, alignItems: 'center' },
});
