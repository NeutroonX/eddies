import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from '@/components/ui/mono-label';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { createCategory } from '@/lib/db/repos/categories';
import { createBudget, deleteBudget, updateBudget } from '@/lib/db/repos/budgets';
import { toMinorUnits } from '@/lib/money';
import type { Budget } from '@/lib/schemas';

export default function CapModal() {
  const db = useSQLiteContext();
  const { categories } = useCategories();
  const params = useLocalSearchParams<{ capId?: string }>();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [rawAmount, setRawAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingCap, setExistingCap] = useState<Budget | null>(null);

  useEffect(() => {
    if (!params.capId) return;
    db.getFirstAsync<Budget>('SELECT * FROM budgets WHERE id = ?', params.capId).then((row) => {
      if (!row) return;
      setExistingCap(row);
      setCategoryId(row.category_id);
      setPeriod(row.period);
      setRawAmount((row.amount_minor / 100).toString());
    });
  }, [params.capId, db]);

  async function handleSave() {
    if (!categoryId || !rawAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSaving(true);
    Keyboard.dismiss();
    try {
      let resolvedId = categoryId!;
      if (capIsOther && otherName.trim()) {
        const cat = await createCategory(db, { name: otherName.trim(), kind: 'expense', glyph: 'tag', color: EddiesColors.steel, sort: 999 });
        resolvedId = cat.id;
      }
      const amount = toMinorUnits(parseFloat(rawAmount));
      if (existingCap) {
        await updateBudget(db, existingCap.id, { category_id: resolvedId, period, amount_minor: amount, start_date: existingCap.start_date });
      } else {
        await createBudget(db, { category_id: resolvedId, period, amount_minor: amount, start_date: Date.now() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingCap) return;
    setDeleting(true);
    Keyboard.dismiss();
    try {
      await deleteBudget(db, existingCap.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
    }
  }

  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const capIsOther = categoryId === '__other__';
  const canSave = !!categoryId && !!rawAmount && !saving && (!capIsOther || otherName.trim().length > 0);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* ── Toolbar ── */}
      <View style={s.toolbar}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
          {existingCap ? 'EDDIES // CAP EDIT' : 'EDDIES // CAP NEW'}
        </MonoLabel>
        <Pressable onPress={() => { Keyboard.dismiss(); router.back(); }} hitSlop={12}>
          <MonoLabel size={12} color={EddiesColors.steel}>✕</MonoLabel>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Amount — big number input */}
        <View style={s.amountBlock}>
          <Text style={s.amountCurrency}>$</Text>
          <TextInput
            style={s.amountInput}
            placeholder="0.00"
            placeholderTextColor={EddiesColors.steel}
            keyboardType="decimal-pad"
            value={rawAmount}
            onChangeText={setRawAmount}
            editable={!saving}
            autoFocus={!existingCap}
          />
        </View>

        <View style={s.hairline} />

        {/* Period */}
        <View style={s.field}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>PERIOD</MonoLabel>
          <View style={s.segRow}>
            {(['weekly', 'monthly'] as const).map((p) => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  style={[s.seg, active && s.segActive]}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MonoLabel
                    size={11}
                    letterSpacing={1}
                    weight={active ? 'bold' : 'regular'}
                    color={active ? EddiesColors.bone : EddiesColors.steel}
                  >
                    {p.toUpperCase()}
                  </MonoLabel>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.hairline} />

        {/* Category */}
        <View style={s.field}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>CATEGORY</MonoLabel>
          <View style={s.catList}>
            {expenseCategories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable key={cat.id} style={s.catRow} onPress={() => { setCategoryId(active ? null : cat.id); setOtherName(''); }} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <View style={[s.catDot, { backgroundColor: active ? EddiesColors.alert : 'transparent', borderColor: active ? EddiesColors.alert : EddiesColors.steel }]} />
                  <MonoLabel size={12} weight={active ? 'bold' : 'regular'} color={active ? EddiesColors.bone : EddiesColors.steel}>{cat.name.toUpperCase()}</MonoLabel>
                </Pressable>
              );
            })}
            <Pressable style={s.catRow} onPress={() => setCategoryId(capIsOther ? null : '__other__')} accessibilityRole="button" accessibilityState={{ selected: capIsOther }}>
              <View style={[s.catDot, { backgroundColor: capIsOther ? EddiesColors.alert : 'transparent', borderColor: capIsOther ? EddiesColors.alert : EddiesColors.steel }]} />
              <MonoLabel size={12} weight={capIsOther ? 'bold' : 'regular'} color={capIsOther ? EddiesColors.bone : EddiesColors.steel}>OTHER</MonoLabel>
            </Pressable>
            {capIsOther && (
              <TextInput style={s.otherInput} placeholder="CATEGORY NAME" placeholderTextColor={EddiesColors.steel} value={otherName} onChangeText={setOtherName} autoFocus maxLength={40} autoCapitalize="words" returnKeyType="done" />
            )}
          </View>
        </View>

        <View style={s.hairline} />

        {/* Actions */}
        <View style={s.actions}>
          <StampButton label="SET CAP" onPress={handleSave} disabled={!canSave} loading={saving} />
          {existingCap && (
            <Pressable
              style={[s.deleteRow, deleting && s.dimmed]}
              onPress={handleDelete}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete cap"
            >
              <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
                REMOVE CAP
              </MonoLabel>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1C',
  },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
    gap: EddiesSpacing.lg,
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: EddiesSpacing.lg,
  },
  amountCurrency: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 52,
    color: EddiesColors.bone,
    includeFontPadding: false,
    padding: 0,
  },
  amountInput: {
    flex: 1,
    fontFamily: EddiesFonts.displayBold,
    fontSize: 52,
    color: EddiesColors.bone,
    includeFontPadding: false,
    padding: 0,
  },
  hairline: { height: 1, backgroundColor: '#1A1A1C' },
  field: { gap: EddiesSpacing.md },
  segRow: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: '#1A1A1C',
    alignSelf: 'flex-start',
    padding: 1,
  },
  seg: {
    paddingHorizontal: EddiesSpacing.lg,
    paddingVertical: EddiesSpacing.sm,
  },
  segActive: { backgroundColor: EddiesColors.surface },
  catList: { gap: 0 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 1,
    borderWidth: 1,
  },
  actions: { gap: EddiesSpacing.sm },
  deleteRow: {
    paddingVertical: EddiesSpacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  dimmed: { opacity: 0.4 },
  otherInput: {
    fontFamily: EddiesFonts.mono, fontSize: 13, color: EddiesColors.bone,
    borderWidth: 1, borderColor: EddiesColors.alert + '66',
    paddingHorizontal: EddiesSpacing.sm, paddingVertical: EddiesSpacing.xs + 2,
    marginTop: 2,
  },
});
