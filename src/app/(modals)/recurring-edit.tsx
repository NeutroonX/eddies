import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
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
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { createRule, getRuleById, updateRule } from '@/lib/db/repos/recurring';
import { materializeDueRules } from '@/lib/recurring/materialize';
import { toMinorUnits, formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store';
import type { RecurringRule } from '@/lib/schemas';

type Kind = 'outflow' | 'inflow';
type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';
type EndKind = 'never' | 'on_date' | 'after_n';
type Mode = 'auto' | 'confirm';

const FREQS: Freq[] = ['daily', 'weekly', 'monthly', 'yearly'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Parse YYYY-MM-DD into local epoch ms at 09:00, or null if invalid. */
function parseDate(str: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d, 9, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt.getTime();
}

export default function RecurringEditModal() {
  const db = useSQLiteContext();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const sym = useCurrencySymbol();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const showToast = useStore(s => s.showToast);
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();
  const isEdit = params.mode === 'edit' && !!params.id;

  const [rawAmount, setRawAmount] = useState('');
  const [kind, setKind] = useState<Kind>('outflow');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [freq, setFreq] = useState<Freq>('monthly');
  const [intervalN, setIntervalN] = useState('1');
  const [anchorDay, setAnchorDay] = useState(() => String(new Date().getDate()));
  const [startStr, setStartStr] = useState(() => formatDate(Date.now()));
  const [endKind, setEndKind] = useState<EndKind>('never');
  const [endStr, setEndStr] = useState('');
  const [endCount, setEndCount] = useState('12');
  const [mode, setMode] = useState<Mode>('confirm');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [existing, setExisting] = useState<RecurringRule | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    getRuleById(db, params.id!)
      .then(rule => {
        if (!rule) return;
        setExisting(rule);
        setRawAmount((rule.amount_minor / 100).toString());
        setKind(rule.kind === 'inflow' ? 'inflow' : 'outflow');
        setCategoryId(rule.category_id);
        setVaultId(rule.account_id);
        setNote(rule.note ?? '');
        setFreq(rule.freq);
        setIntervalN(String(rule.interval_n));
        if (rule.anchor_day != null) setAnchorDay(String(rule.anchor_day));
        setStartStr(formatDate(rule.start_date));
        setEndKind(rule.end_kind);
        if (rule.end_date != null) setEndStr(formatDate(rule.end_date));
        if (rule.end_count != null) setEndCount(String(rule.end_count));
        setMode(rule.mode);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isEdit, params.id, db]);

  useEffect(() => {
    if (!isEdit && accounts.length > 0) setVaultId(prev => prev ?? accounts[0].id);
  }, [accounts, isEdit]);

  const filteredCats = useMemo(
    () => categories.filter(c => c.kind === (kind === 'outflow' ? 'expense' : 'income')),
    [categories, kind],
  );

  const amountMinor = useMemo(() => {
    const n = parseFloat(rawAmount || '0');
    return isNaN(n) ? 0 : toMinorUnits(n);
  }, [rawAmount]);

  const parsedInterval = Math.max(1, parseInt(intervalN || '1', 10) || 1);
  const startMs = parseDate(startStr);
  const endMs = parseDate(endStr);
  const parsedEndCount = parseInt(endCount || '0', 10) || 0;

  const isValid =
    amountMinor > 0 &&
    categoryId !== null &&
    startMs !== null &&
    (endKind !== 'on_date' || (endMs !== null && endMs > (startMs ?? 0))) &&
    (endKind !== 'after_n' || parsedEndCount > 0);

  function handleAmountChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setRawAmount(cleaned);
  }

  function handleNumeric(text: string, set: (v: string) => void) {
    set(text.replace(/[^0-9]/g, ''));
  }

  async function handleSave() {
    if (!isValid || saving || loading || startMs === null) return;
    setSaving(true);
    try {
      const anchor =
        freq === 'monthly'
          ? Math.min(31, Math.max(1, parseInt(anchorDay || '1', 10) || new Date(startMs).getDate()))
          : freq === 'weekly'
            ? new Date(startMs).getDay()
            : null;

      const payload = {
        account_id: vaultId,
        category_id: categoryId,
        kind,
        amount_minor: amountMinor,
        note: note.trim() || null,
        freq,
        interval_n: parsedInterval,
        anchor_day: anchor,
        start_date: startMs,
        end_kind: endKind,
        end_date: endKind === 'on_date' ? endMs : null,
        end_count: endKind === 'after_n' ? parsedEndCount : null,
        mode,
      };

      if (isEdit && existing) {
        await updateRule(db, existing.id, payload);
      } else {
        await createRule(db, payload);
      }
      // Post any now-due occurrences immediately so an auto rule shows up in the
      // Ledger right away, rather than waiting for the focus-pass debounce.
      await materializeDueRules(db);
      bumpDbVersion();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Keyboard.dismiss();
      setTimeout(() => router.back(), 100);
    } catch (err) {
      console.error('Save recurring error:', err);
      showToast('Failed to save rule', 'err');
      setSaving(false);
    }
  }

  const amountColor = kind === 'outflow' ? EddiesColors.alert : EddiesColors.bone;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
          {isEdit ? 'EDDIES // EDIT RULE' : 'EDDIES // NEW RULE'}
        </MonoLabel>
        <Pressable
          onPress={() => { Keyboard.dismiss(); setTimeout(() => router.back(), 100); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        {/* Amount */}
        <View style={s.panel}>
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
          <View style={s.kindRow}>
            <Pressable
              style={[s.kindBtn, s.kindBtnLeft, kind === 'outflow' ? s.kindOutflowOn : s.kindOff]}
              onPress={() => { setKind('outflow'); setCategoryId(null); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === 'outflow' }}
            >
              <MonoLabel size={11} letterSpacing={2} weight={kind === 'outflow' ? 'bold' : 'regular'}
                color={kind === 'outflow' ? EddiesColors.bone : EddiesColors.steel}>↓ OUTFLOW</MonoLabel>
            </Pressable>
            <Pressable
              style={[s.kindBtn, kind === 'inflow' ? s.kindInflowOn : s.kindOff]}
              onPress={() => { setKind('inflow'); setCategoryId(null); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === 'inflow' }}
            >
              <MonoLabel size={11} letterSpacing={2} weight={kind === 'inflow' ? 'bold' : 'regular'}
                color={kind === 'inflow' ? EddiesColors.ink : EddiesColors.steel}>↑ INFLOW</MonoLabel>
            </Pressable>
          </View>
        </View>

        {/* Tag */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>TAG</MonoLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            {filteredCats.map(c => (
              <Pill key={c.id} label={c.name} color={c.color} active={c.id === categoryId}
                onPress={() => setCategoryId(c.id === categoryId ? null : c.id)} />
            ))}
          </ScrollView>
        </View>

        {/* Vault */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>VAULT</MonoLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            <Pill label="// NO VAULT" active={vaultId === null} color={EddiesColors.steel}
              onPress={() => setVaultId(null)} />
            {accounts.map(a => (
              <Pill key={a.id} label={a.name} active={a.id === vaultId} onPress={() => setVaultId(a.id)} />
            ))}
          </ScrollView>
        </View>

        {/* Frequency */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>FREQUENCY</MonoLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            {FREQS.map(f => (
              <Pill key={f} label={f.toUpperCase()} active={freq === f} onPress={() => setFreq(f)} />
            ))}
          </ScrollView>
          <View style={s.inlineRow}>
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>EVERY</MonoLabel>
            <TextInput value={intervalN} onChangeText={t => handleNumeric(t, setIntervalN)}
              keyboardType="number-pad" style={s.numInput} maxLength={3} />
            <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
              {freq === 'daily' ? 'DAY(S)' : freq === 'weekly' ? 'WEEK(S)' : freq === 'monthly' ? 'MONTH(S)' : 'YEAR(S)'}
            </MonoLabel>
          </View>
          {freq === 'monthly' && (
            <View style={s.inlineRow}>
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>ON DAY</MonoLabel>
              <TextInput value={anchorDay} onChangeText={t => handleNumeric(t, setAnchorDay)}
                keyboardType="number-pad" style={s.numInput} maxLength={2} />
              <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
                OF THE MONTH (CLAMPS TO LAST DAY)
              </MonoLabel>
            </View>
          )}
        </View>

        {/* Start */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>STARTS</MonoLabel>
          <TextInput value={startStr} onChangeText={setStartStr} placeholder="YYYY-MM-DD"
            placeholderTextColor={EddiesColors.steel + '55'} style={s.dateInput}
            autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
          {startMs === null && (
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert}>INVALID DATE — USE YYYY-MM-DD</MonoLabel>
          )}
        </View>

        {/* End */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>ENDS</MonoLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            <Pill label="NEVER" active={endKind === 'never'} onPress={() => setEndKind('never')} />
            <Pill label="ON DATE" active={endKind === 'on_date'} onPress={() => setEndKind('on_date')} />
            <Pill label="AFTER N" active={endKind === 'after_n'} onPress={() => setEndKind('after_n')} />
          </ScrollView>
          {endKind === 'on_date' && (
            <TextInput value={endStr} onChangeText={setEndStr} placeholder="YYYY-MM-DD"
              placeholderTextColor={EddiesColors.steel + '55'} style={s.dateInput}
              autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
          )}
          {endKind === 'after_n' && (
            <View style={s.inlineRow}>
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>STOP AFTER</MonoLabel>
              <TextInput value={endCount} onChangeText={t => handleNumeric(t, setEndCount)}
                keyboardType="number-pad" style={s.numInput} maxLength={4} />
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>OCCURRENCES</MonoLabel>
            </View>
          )}
        </View>

        {/* Mode */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>MODE</MonoLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            <Pill label="✓ AUTO-POST" active={mode === 'auto'} onPress={() => setMode('auto')} />
            <Pill label="⦿ CONFIRM FIRST" active={mode === 'confirm'} onPress={() => setMode('confirm')} />
          </ScrollView>
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
            {mode === 'auto'
              ? 'POSTS AUTOMATICALLY ON SCHEDULE.'
              : 'QUEUES FOR REVIEW BEFORE POSTING (INBOX SHIPS IN A LATER UPDATE).'}
          </MonoLabel>
        </View>

        {/* Memo */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2}>MEMO</MonoLabel>
          <TextInput value={note} onChangeText={setNote} style={s.memoInput} placeholder="— OPTIONAL —"
            placeholderTextColor={EddiesColors.steel + '44'} maxLength={200} returnKeyType="done" blurOnSubmit />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View style={s.previewRow}>
          <Text style={[s.previewAmount, { color: amountColor }]}>{sym}{formatAmountTabular(amountMinor)}</Text>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>{' · '}</MonoLabel>
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>{freq.toUpperCase()}</MonoLabel>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '66'}>{' · '}</MonoLabel>
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>{mode === 'auto' ? 'AUTO' : 'CONFIRM'}</MonoLabel>
        </View>
        <View style={s.stampWrap}>
          <StampButton label={isEdit ? 'UPDATE RULE' : 'CREATE RULE'} onPress={handleSave}
            disabled={!isValid || saving || loading} loading={saving} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '22',
  },
  body: { gap: EddiesSpacing.lg, paddingTop: EddiesSpacing.md, paddingBottom: EddiesSpacing.xxl },
  panel: {
    marginHorizontal: EddiesSpacing.md, backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33',
  },
  amountZone: { alignItems: 'center', paddingTop: EddiesSpacing.lg, paddingBottom: EddiesSpacing.lg },
  amountInput: {
    fontFamily: EddiesFonts.displayBold, fontSize: 72, textAlign: 'center',
    minWidth: 100, letterSpacing: -2,
  },
  kindRow: { flexDirection: 'row' },
  kindBtn: { flex: 1, paddingVertical: EddiesSpacing.sm + 2, alignItems: 'center' },
  kindBtnLeft: { borderRightWidth: 1, borderRightColor: EddiesColors.steel + '33' },
  kindOutflowOn: { backgroundColor: EddiesColors.alert },
  kindInflowOn: { backgroundColor: EddiesColors.bone },
  kindOff: { backgroundColor: 'transparent' },
  section: { paddingHorizontal: EddiesSpacing.md, gap: EddiesSpacing.sm },
  rail: { gap: EddiesSpacing.sm, paddingVertical: 2 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  numInput: {
    fontFamily: EddiesFonts.monoBold, fontSize: 16, color: EddiesColors.bone,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '55',
    minWidth: 48, textAlign: 'center', paddingVertical: 2,
  },
  dateInput: {
    fontFamily: EddiesFonts.mono, fontSize: 16, color: EddiesColors.bone,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '55',
    paddingVertical: EddiesSpacing.xs, letterSpacing: 1,
  },
  memoInput: {
    fontFamily: EddiesFonts.mono, fontSize: 14, color: EddiesColors.bone,
    paddingVertical: EddiesSpacing.sm, letterSpacing: 0.5,
  },
  footer: { gap: EddiesSpacing.sm, paddingBottom: EddiesSpacing.md },
  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingTop: EddiesSpacing.sm,
  },
  previewAmount: { fontFamily: EddiesFonts.monoBold, fontSize: 11, letterSpacing: 1 },
  stampWrap: { paddingHorizontal: EddiesSpacing.md },
});
