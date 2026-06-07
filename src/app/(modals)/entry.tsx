import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, TextInput, View, Text, Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from '@/components/ui/mono-label';
import { Pill } from '@/components/ui/pill';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { createTransaction, updateTransaction, getTransactionById } from '@/lib/db/repos/transactions';
import { findOrCreateCategory } from '@/lib/db/repos/categories';
import { toMinorUnits, formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store/index';
import type { Transaction } from '@/lib/schemas';

type Kind = 'outflow' | 'inflow';


export default function EntryModal() {
  const db = useSQLiteContext();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const lastVaultId = useStore(s => s.lastVaultId);
  const setLastVaultId = useStore(s => s.setLastVaultId);
  const showToast = useStore(s => s.showToast);
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();

  const [rawAmount, setRawAmount] = useState('');
  const [kind, setKind] = useState<Kind>('outflow');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const otherInputRef = useRef<TextInput>(null);
  const [vaultId, setVaultId] = useState<string | null>(lastVaultId);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(params.mode === 'edit');
  const [existingEntry, setExistingEntry] = useState<Transaction | null>(null);

  const isEditMode = params.mode === 'edit' && params.id;

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
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [isEditMode, params.id, db]);

  useEffect(() => {
    if (!isEditMode && accounts.length > 0) {
      setVaultId(prev => prev ?? accounts[0].id);
    }
  }, [accounts, isEditMode]);

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

  const filteredCats = useMemo(
    () => categories.filter(c => c.kind === (kind === 'outflow' ? 'expense' : 'income')),
    [categories, kind],
  );

  const amountMinor = useMemo(() => {
    const n = parseFloat(rawAmount || '0');
    return isNaN(n) ? 0 : toMinorUnits(n);
  }, [rawAmount]);

  const tagIsOther = categoryId === '__other__';

  useEffect(() => {
    if (tagIsOther) {
      const t = setTimeout(() => otherInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [tagIsOther]);

  const isValid =
    amountMinor > 0 &&
    vaultId !== null &&
    categoryId !== null &&
    (!tagIsOther || otherName.trim().length > 0);

  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase();

  const amountColor = kind === 'outflow' ? EddiesColors.alert : EddiesColors.bone;

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedVault = accounts.find(a => a.id === vaultId);
  const footerTagLabel = tagIsOther
    ? (otherName.toUpperCase() || null)
    : (selectedCategory?.name.toUpperCase() ?? null);

  async function handleSave() {
    if (!isValid || saving || loading) return;
    setSaving(true);
    try {
      let resolvedCategoryId = categoryId;
      if (tagIsOther && otherName.trim()) {
        const cat = await findOrCreateCategory(db, {
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
          category_id: resolvedCategoryId,
          kind,
          amount_minor: amountMinor,
          note: note.trim() || null,
          occurred_at: existingEntry.occurred_at,
          transfer_group_id: existingEntry.transfer_group_id,
        });
      } else {
        await createTransaction(db, {
          account_id: vaultId!,
          category_id: resolvedCategoryId,
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
      showToast('Failed to save entry', 'err');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ───────────────────────────────────────── */}
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
          {isEditMode ? 'EDDIES // EDIT ENTRY' : 'EDDIES // LOG 01-A'}
        </MonoLabel>
        <Pressable
          onPress={() => { Keyboard.dismiss(); setTimeout(() => router.back(), 100); }}
          hitSlop={12}
        >
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      {/* ── Scrollable body ──────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.body}
      >

        {/* ── Amount panel ─────────────────────────────────
            Dark surface card. No internal rules.
            Kind toggle = solid inverted selection.             */}
        <View style={s.panel}>

          {/* Prompt header row */}
          <View style={s.panelHead}>
            <View style={s.panelPrompt}>
              <Text style={s.panelPromptCaret}>&gt;</Text>
              <MonoLabel size={9} letterSpacing={2}>AMOUNT</MonoLabel>
            </View>
            <MonoLabel size={9} letterSpacing={1}>{todayLabel}</MonoLabel>
          </View>

          {/* Amount input */}
          <View style={s.amountZone}>
            <TextInput
              value={rawAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              style={[s.amountInput, { color: amountColor }]}
              placeholder="0"
              placeholderTextColor={EddiesColors.steel + '55'}
              selectionColor={amountColor}
              returnKeyType="done"
            />
          </View>

          {/* Kind toggle — terminal inverted selection */}
          <View style={s.kindRow}>
            <Pressable
              style={[
                s.kindBtn,
                s.kindBtnLeft,
                kind === 'outflow' ? s.kindOutflowOn : s.kindOff,
              ]}
              onPress={() => handleKindChange('outflow')}
            >
              <MonoLabel
                size={11} letterSpacing={2}
                weight={kind === 'outflow' ? 'bold' : 'regular'}
                color={kind === 'outflow' ? EddiesColors.bone : EddiesColors.steel}
              >
                ↓ OUTFLOW
              </MonoLabel>
            </Pressable>
            <Pressable
              style={[
                s.kindBtn,
                kind === 'inflow' ? s.kindInflowOn : s.kindOff,
              ]}
              onPress={() => handleKindChange('inflow')}
            >
              <MonoLabel
                size={11} letterSpacing={2}
                weight={kind === 'inflow' ? 'bold' : 'regular'}
                color={kind === 'inflow' ? EddiesColors.ink : EddiesColors.steel}
              >
                ↑ INFLOW
              </MonoLabel>
            </Pressable>
          </View>
        </View>

        {/* ── TAG ──────────────────────────────────────── */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>TAG</MonoLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.rail}
          >
            {filteredCats.map(c => (
              <Pill
                key={c.id}
                label={c.name}
                color={c.color}
                active={c.id === categoryId}
                onPress={() => {
                  setCategoryId(c.id === categoryId ? null : c.id);
                  setOtherName('');
                }}
              />
            ))}
            <Pill
              label="+ OTHER"
              color={EddiesColors.steel}
              active={tagIsOther}
              onPress={() => setCategoryId(tagIsOther ? null : '__other__')}
            />
          </ScrollView>

          {tagIsOther && (
            <View style={s.otherBlock}>
              <MonoLabel size={9} letterSpacing={2}>TAG NAME</MonoLabel>
              <TextInput
                ref={otherInputRef}
                style={s.otherInput}
                placeholder="e.g. Subscriptions"
                placeholderTextColor={EddiesColors.steel + '55'}
                value={otherName}
                onChangeText={setOtherName}
                maxLength={40}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
          )}
        </View>

        {/* ── VAULT ────────────────────────────────────── */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>VAULT</MonoLabel>
          {accounts.length === 0 ? (
            <Pressable
              style={s.vaultEmpty}
              onPress={() => { Keyboard.dismiss(); setTimeout(() => { router.back(); router.push('/(modals)/vault?mode=add'); }, 100); }}
            >
              <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.alert}>+ ADD VAULT TO CONTINUE</MonoLabel>
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.rail}
            >
              {accounts.map(a => (
                <Pill
                  key={a.id}
                  label={a.name}
                  active={a.id === vaultId}
                  onPress={() => setVaultId(a.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── MEMO ─────────────────────────────────────── */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>MEMO</MonoLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={s.memoInput}
            placeholder="— OPTIONAL —"
            placeholderTextColor={EddiesColors.steel + '44'}
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit
          />
        </View>

      </ScrollView>

      {/* ── Footer ──────────────────────────────────────── */}
      <View style={s.footer}>
        <View style={s.previewRow}>
          <Text style={[s.previewAmount, { color: amountColor }]}>
            ${formatAmountTabular(amountMinor)}
          </Text>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>{' · '}</MonoLabel>
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
            {kind.toUpperCase()}
          </MonoLabel>
          {footerTagLabel != null && (
            <>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>{' · '}</MonoLabel>
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
                {footerTagLabel}
              </MonoLabel>
            </>
          )}
          {selectedVault != null && (
            <>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>{' · '}</MonoLabel>
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
                {selectedVault.name.toUpperCase()}
              </MonoLabel>
            </>
          )}
        </View>

        <View style={s.stampWrap}>
          <StampButton
            label={isEditMode ? 'UPDATE ENTRY' : 'STAMP ENTRY'}
            onPress={handleSave}
            disabled={!isValid || saving || loading}
            loading={saving}
          />
        </View>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
  },

  // ── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '22',
  },

  body: {
    gap: EddiesSpacing.lg,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
  },

  // ── Amount panel ────────────────────────────────────
  panel: {
    marginHorizontal: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
  },

  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.sm,
    paddingBottom: EddiesSpacing.xs,
  },

  panelPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  panelPromptCaret: {
    fontFamily: EddiesFonts.monoBold,
    fontSize: 9,
    color: EddiesColors.alert,
  },

  amountZone: {
    alignItems: 'center',
    paddingTop: EddiesSpacing.lg,
    paddingBottom: EddiesSpacing.xl,
  },

  amountInput: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 80,
    textAlign: 'center',
    minWidth: 100,
    letterSpacing: -2,
  },

  // Kind toggle: two equal halves, no internal rules
  kindRow: {
    flexDirection: 'row',
  },

  kindBtn: {
    flex: 1,
    paddingVertical: EddiesSpacing.sm + 2,
    alignItems: 'center',
  },

  kindBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: EddiesColors.steel + '33',
  },

  // Active = solid fill (terminal "selected" inversion)
  kindOutflowOn: {
    backgroundColor: EddiesColors.alert,
  },

  kindInflowOn: {
    backgroundColor: EddiesColors.bone,
  },

  kindOff: {
    backgroundColor: 'transparent',
  },

  // ── Sections ────────────────────────────────────────
  section: {
    paddingHorizontal: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
  },

  rail: {
    gap: EddiesSpacing.sm,
    paddingVertical: 2,
  },

  memoInput: {
    fontFamily: EddiesFonts.mono,
    fontSize: 14,
    color: EddiesColors.bone,
    paddingVertical: EddiesSpacing.sm,
    letterSpacing: 0.5,
  },

  vaultEmpty: {
    paddingVertical: EddiesSpacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: EddiesColors.alert,
    paddingLeft: EddiesSpacing.sm,
  },

  otherBlock: {
    borderLeftWidth: 2,
    borderLeftColor: EddiesColors.alert,
    paddingLeft: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
    marginTop: EddiesSpacing.xs,
  },

  otherInput: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 26,
    color: EddiesColors.bone,
    paddingVertical: EddiesSpacing.xs,
  },

  // ── Footer ──────────────────────────────────────────
  footer: {
    gap: EddiesSpacing.sm,
    paddingBottom: EddiesSpacing.md,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.sm,
    flexWrap: 'nowrap',
  },

  previewAmount: {
    fontFamily: EddiesFonts.monoBold,
    fontSize: 11,
    letterSpacing: 1,
  },

  stampWrap: {
    paddingHorizontal: EddiesSpacing.md,
  },
});
