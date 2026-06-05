import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView, StyleSheet, TextInput, View, Keyboard,
} from 'react-native';
import { router } from 'expo-router';
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
import { createTransaction } from '@/lib/db/repos/transactions';
import { toMinorUnits } from '@/lib/money';
import { useStore } from '@/store/index';

type Kind = 'outflow' | 'inflow' | 'transfer';

export default function EntryModal() {
  const db = useSQLiteContext();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const lastVaultId = useStore(s => s.lastVaultId);
  const setLastVaultId = useStore(s => s.setLastVaultId);

  const [rawAmount, setRawAmount] = useState('');
  const [kind, setKind] = useState<Kind>('outflow');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(lastVaultId);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill vault from accounts once loaded
  useEffect(() => {
    if (!vaultId && accounts.length > 0) setVaultId(accounts[0].id);
  }, [accounts, vaultId]);

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

  const isValid = amountMinor > 0 && vaultId !== null && (kind === 'transfer' || categoryId !== null);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', day: '2-digit', month: 'short',
  }).toUpperCase();

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await createTransaction(db, {
        account_id: vaultId!,
        category_id: kind === 'transfer' ? null : categoryId,
        kind,
        amount_minor: amountMinor,
        note: note.trim() || null,
        occurred_at: Date.now(),
        transfer_group_id: null,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setLastVaultId(vaultId!);
      Keyboard.dismiss();
      setTimeout(() => router.back(), 100);
    } catch {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
        {/* ── Header ─────────────────────────── */}
        <View style={s.header}>
          <SectionTag label="EDDIES // LOG 01-A" />
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {filteredCats.map(c => (
                  <Pill
                    key={c.id} label={c.name} color={c.color}
                    active={c.id === categoryId}
                    onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
                  />
                ))}
              </ScrollView>
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
        <StampButton label="SAVE ENTRY" onPress={handleSave} disabled={!isValid || saving} />
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
  footer: {
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1, borderTopColor: EddiesColors.steel + '22',
  },
});
