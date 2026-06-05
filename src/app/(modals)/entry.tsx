import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView, StyleSheet, TextInput, View, Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { SectionTag } from '@/components/ui/section-tag';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { createTransaction, updateTransaction, getTransactionById } from '@/lib/db/repos/transactions';
import { createCategory } from '@/lib/db/repos/categories';
import { toMinorUnits, formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store/index';
import type { Transaction } from '@/lib/schemas';

type Kind = 'outflow' | 'inflow' | 'transfer';

export default function EntryModal() {
  const db = useSQLiteContext();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const lastVaultId = useStore(s => s.lastVaultId);
  const setLastVaultId = useStore(s => s.setLastVaultId);
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();

  const [rawAmount, setRawAmount] = useState('');
  const [kind, setKind] = useState<Kind>('outflow');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const [vaultId, setVaultId] = useState<string | null>(lastVaultId);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(params.mode === 'edit');
  const [existingEntry, setExistingEntry] = useState<Transaction | null>(null);

  const isEditMode = params.mode === 'edit' && params.id;

  // Load existing entry if in edit mode
  useEffect(() => {
    if (isEditMode) {
      getTransactionById(db, params.id!).then(entry => {
        if (entry) {
          setExistingEntry(entry);
          setRawAmount((entry.amount_minor / 100).toString());
          setKind(entry.kind as Kind);
          setCategoryId(entry.category_id);
          setVaultId(entry.account_id);
          setNote(entry.note || '');
        }
        setLoading(false);
      }).catch(console.error);
    }
  }, [isEditMode, params.id, db]);

  // Prefill vault from accounts once loaded (create mode only)
  useEffect(() => {
    if (!isEditMode && !vaultId && accounts.length > 0) setVaultId(accounts[0].id);
  }, [accounts, vaultId, isEditMode]);

  function handleKindChange(k: Kind) {
    setKind(k);
    setCategoryId(null);
  }

  function handleAmountChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setRawAmount(cleaned);
  }

  const filteredCats = useMemo(() =>
    kind === 'transfer' ? [] : categories.filter(c =>
      c.kind === (kind === 'outflow' ? 'expense' : 'income')
    ), [categories, kind]);

  const amountMinor = useMemo(() => {
    const n = parseFloat(rawAmount || '0');
    return isNaN(n) ? 0 : toMinorUnits(n);
  }, [rawAmount]);

  const tagIsOther = categoryId === '__other__';
  const isValid = amountMinor > 0 && vaultId !== null &&
    (kind === 'transfer' || (categoryId !== null && (!tagIsOther || otherName.trim().length > 0)));

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', day: '2-digit', month: 'short',
  }).toUpperCase();

  async function handleSave() {
    if (!isValid || saving || loading) return;
    setSaving(true);
    try {
      let resolvedCategoryId = categoryId;
      if (tagIsOther && otherName.trim()) {
        const cat = await createCategory(db, {
          name: otherName.trim(),
          kind: kind === 'outflow' ? 'expense' : 'income',
          glyph: 'tag',
          color: EddiesColors.steel,
          sort: 999,
        });
        resolvedCategoryId = cat.id;
      }

      if (isEditMode && existingEntry) {
        await updateTransaction(db, existingEntry.id, {
          account_id: vaultId!,
          category_id: kind === 'transfer' ? null : resolvedCategoryId,
          kind,
          amount_minor: amountMinor,
          note: note.trim() || null,
          occurred_at: existingEntry.occurred_at,
          transfer_group_id: existingEntry.transfer_group_id,
        });
      } else {
        await createTransaction(db, {
          account_id: vaultId!,
          category_id: kind === 'transfer' ? null : resolvedCategoryId,
          kind,
          amount_minor: amountMinor,
          note: note.trim() || null,
          occurred_at: Date.now(),
          transfer_group_id: null,
        });
        setLastVaultId(vaultId!);
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Keyboard.dismiss();
      setTimeout(() => router.back(), 100);
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
        {/* ── Header ─────────────────────────── */}
        <View style={s.header}>
          <SectionTag label={isEditMode ? 'EDDIES // EDIT ENTRY' : 'EDDIES // LOG 01-A'} />
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setTimeout(() => router.back(), 100);
            }}
            hitSlop={12}
          >
            <MonoLabel size={12} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
          </Pressable>
        </View>

        {/* ── Form ───────────────────────────── */}
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>

          {/* Amount */}
          <View style={s.amountWrap}>
            <TextInput
              value={rawAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              autoFocus
              style={s.amountInput}
              placeholder="0"
              placeholderTextColor={EddiesColors.steel}
              returnKeyType="done"
            />
            <MonoLabel size={10} letterSpacing={2}>AMOUNT</MonoLabel>
          </View>

          {/* Kind toggle */}
          <View style={s.kindRow}>
            {(['outflow', 'inflow', 'transfer'] as Kind[]).map(k => (
              <Pressable
                key={k}
                onPress={() => handleKindChange(k)}
                style={[s.kindBtn, kind === k && s.kindBtnActive]}
              >
                <MonoLabel
                  size={10} letterSpacing={1.5}
                  weight={kind === k ? 'bold' : 'regular'}
                  color={kind === k ? EddiesColors.bone : EddiesColors.steel}
                >
                  {k.toUpperCase()}
                </MonoLabel>
              </Pressable>
            ))}
          </View>

          {/* TAG */}
          <View style={s.field}>
            <MonoLabel size={9} letterSpacing={2}>TAG</MonoLabel>
            {kind === 'transfer' ? (
              <MonoLabel size={10} color={EddiesColors.steel}>TRANSFERS // M2</MonoLabel>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                  {filteredCats.map(c => (
                    <Pill
                      key={c.id} label={c.name} color={c.color}
                      active={c.id === categoryId}
                      onPress={() => { setCategoryId(c.id === categoryId ? null : c.id); setOtherName(''); }}
                    />
                  ))}
                  <Pill
                    label="OTHER"
                    color={EddiesColors.steel}
                    active={tagIsOther}
                    onPress={() => setCategoryId(tagIsOther ? null : '__other__')}
                  />
                </ScrollView>
                {tagIsOther && (
                  <TextInput
                    style={s.otherInput}
                    placeholder="ENTER TAG NAME"
                    placeholderTextColor={EddiesColors.steel}
                    value={otherName}
                    onChangeText={setOtherName}
                    autoFocus
                    maxLength={40}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                )}
              </>
            )}
          </View>

          {/* VAULT */}
          <View style={s.field}>
            <MonoLabel size={9} letterSpacing={2}>VAULT</MonoLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {accounts.map(a => (
                <Pill key={a.id} label={a.name} active={a.id === vaultId} onPress={() => setVaultId(a.id)} />
              ))}
            </ScrollView>
          </View>

          {/* NOTE */}
          <View style={s.field}>
            <MonoLabel size={9} letterSpacing={2}>NOTE</MonoLabel>
            <TextInput
              value={note} onChangeText={setNote}
              style={s.noteInput}
              placeholder="OPTIONAL"
              placeholderTextColor={EddiesColors.steel}
              maxLength={200} returnKeyType="done" blurOnSubmit
            />
          </View>

          {/* DATE */}
          <View style={s.field}>
            <MonoLabel size={10} color={EddiesColors.steel}>DATE // {todayLabel}</MonoLabel>
          </View>

        </ScrollView>

      {/* ── Save ───────────────────────────── */}
      <View style={s.footer}>
        <StampButton
          label={isEditMode ? 'UPDATE ENTRY' : 'SAVE ENTRY'}
          onPress={handleSave}
          disabled={!isValid || saving || loading}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '33',
  },
  body: { gap: EddiesSpacing.lg, paddingBottom: EddiesSpacing.xxl },
  amountWrap: { alignItems: 'center', paddingVertical: EddiesSpacing.lg },
  amountInput: {
    fontFamily: EddiesFonts.displayBold, fontSize: 64,
    color: EddiesColors.bone, textAlign: 'center', minWidth: 120,
  },
  kindRow: { flexDirection: 'row', paddingHorizontal: EddiesSpacing.md, gap: EddiesSpacing.sm },
  kindBtn: {
    flex: 1, paddingVertical: EddiesSpacing.sm,
    borderWidth: 1, borderColor: EddiesColors.steel + '55', alignItems: 'center',
  },
  kindBtnActive: { borderColor: EddiesColors.alert, backgroundColor: EddiesColors.alert + '22' },
  field: { paddingHorizontal: EddiesSpacing.md, gap: EddiesSpacing.xs },
  rail: { gap: EddiesSpacing.sm, paddingVertical: 2 },
  noteInput: {
    fontFamily: EddiesFonts.mono, fontSize: 13, color: EddiesColors.bone,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '55',
    paddingVertical: EddiesSpacing.xs,
  },
  otherInput: {
    fontFamily: EddiesFonts.mono, fontSize: 13, color: EddiesColors.bone,
    borderWidth: 1, borderColor: EddiesColors.alert + '66',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.xs + 2,
    marginTop: EddiesSpacing.xs,
  },
  footer: {
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1, borderTopColor: EddiesColors.steel + '22',
  },
});
