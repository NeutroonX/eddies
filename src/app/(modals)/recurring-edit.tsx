import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from '@/components/ui/mono-label';
import { Sheet, SheetOption } from '@/components/ui/sheet';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { findOrCreateCategory } from '@/lib/db/repos/categories';
import { createRule, getRuleById, updateRule } from '@/lib/db/repos/recurring';
import { materializeDueRules } from '@/lib/recurring/materialize';
import {
  formatRunDate, monthlyEquivalentMinor, nextRunAt,
} from '@/lib/recurring/describe';
import { toMinorUnits, formatAmountTabular } from '@/lib/money';
import { useStore } from '@/store';
import type { RecurringRule } from '@/lib/schemas';

type Kind = 'outflow' | 'inflow';
type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';
type EndKind = 'never' | 'on_date' | 'after_n';
type Mode = 'auto' | 'confirm';
type SheetId = null | 'tag' | 'repeats' | 'on' | 'starts' | 'ends' | 'vault' | 'note';

const FREQS: Freq[] = ['daily', 'weekly', 'monthly', 'yearly'];
const FREQ_LABEL: Record<Freq, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
const FREQ_NOUN: Record<Freq, string> = { daily: 'DAY', weekly: 'WEEK', monthly: 'MONTH', yearly: 'YEAR' };
const DAY = 86_400_000;

function pad(n: number): string { return String(n).padStart(2, '0'); }
/** Local epoch ms at 09:00 for the calendar day of `ms`. */
function atNine(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0).getTime();
}
function toDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Parse YYYY-MM-DD into local 09:00 epoch ms, or null if invalid. */
function parseDateStr(str: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d, 9, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt.getTime();
}
/** Human date: TODAY / TOMORROW / "12 JUN" (+year when not current). */
function friendlyDate(ms: number, now = Date.now()): string {
  const a = atNine(ms), t = atNine(now);
  if (a === t) return 'TODAY';
  if (a === t + DAY) return 'TOMORROW';
  if (a === t - DAY) return 'YESTERDAY';
  return formatRunDate(ms, now);
}

/** A calm settings-style row: label left, value (+ chevron) right. */
function Row({
  label, value, valueColor, dotColor, onPress, muted,
}: {
  label: string;
  value: string;
  valueColor?: string;
  dotColor?: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable style={rs.row} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}>
      <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>{label}</MonoLabel>
      <View style={rs.right}>
        {dotColor ? <View style={[rs.dot, { backgroundColor: dotColor }]} /> : null}
        <MonoLabel size={11} letterSpacing={1}
          color={valueColor ?? (muted ? EddiesColors.steel + '99' : EddiesColors.bone)}>
          {value}
        </MonoLabel>
        <MonoLabel size={12} color={EddiesColors.steel + '99'}>›</MonoLabel>
      </View>
    </Pressable>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable onPress={onToggle} style={ts.track} accessibilityRole="switch"
      accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <View style={[ts.fill, { backgroundColor: on ? EddiesColors.alert : EddiesColors.steel + '33' }]} />
      <View style={[ts.knob, on ? ts.knobOn : ts.knobOff]} />
    </Pressable>
  );
}

function Stepper({
  value, onChange, min = 1, max = 999,
}: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={ss.stepper}>
      <Pressable style={ss.stepBtn} hitSlop={8} onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityRole="button" accessibilityLabel="Decrease">
        <MonoLabel size={18} color={EddiesColors.bone}>−</MonoLabel>
      </Pressable>
      <Text style={ss.stepVal}>{value}</Text>
      <Pressable style={ss.stepBtn} hitSlop={8} onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityRole="button" accessibilityLabel="Increase">
        <MonoLabel size={18} color={EddiesColors.bone}>+</MonoLabel>
      </Pressable>
    </View>
  );
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
  // `undefined` = untouched (defaults to first vault); `null` = explicitly no vault.
  const [vaultId, setVaultId] = useState<string | null | undefined>(undefined);
  const [note, setNote] = useState('');
  const [otherName, setOtherName] = useState('');   // free-text tag when "OTHER" is chosen
  const [freq, setFreq] = useState<Freq>('monthly');
  const [intervalN, setIntervalN] = useState(1);
  const [anchorDay, setAnchorDay] = useState(() => new Date().getDate());
  const [startMs, setStartMs] = useState(() => atNine(Date.now()));
  const [endKind, setEndKind] = useState<EndKind>('never');
  const [endMs, setEndMs] = useState<number | null>(null);
  const [endCount, setEndCount] = useState(12);
  const [mode, setMode] = useState<Mode>('confirm');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [existing, setExisting] = useState<RecurringRule | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [dateDraft, setDateDraft] = useState('');     // manual YYYY-MM-DD entry inside date sheets

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
        setIntervalN(Math.max(1, rule.interval_n));
        if (rule.anchor_day != null) setAnchorDay(rule.anchor_day);
        setStartMs(rule.start_date);
        setEndKind(rule.end_kind);
        setEndMs(rule.end_date ?? null);
        if (rule.end_count != null) setEndCount(rule.end_count);
        setMode(rule.mode);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isEdit, params.id, db]);

  // Default to the first vault until the user explicitly picks one (incl. "no vault").
  const effectiveVaultId = vaultId === undefined ? (accounts[0]?.id ?? null) : vaultId;
  const vaultName = effectiveVaultId === null
    ? '// NO VAULT'
    : (accounts.find(a => a.id === effectiveVaultId)?.name ?? '// NO VAULT').toUpperCase();

  const filteredCats = useMemo(
    () => categories.filter(c => c.kind === (kind === 'outflow' ? 'expense' : 'income')),
    [categories, kind],
  );
  const category = categories.find(c => c.id === categoryId) ?? null;
  const tagIsOther = categoryId === '__other__';
  const tagLabel = tagIsOther
    ? (otherName.trim().toUpperCase() || 'OTHER')
    : category ? category.name.toUpperCase() : 'SELECT';
  const tagDot = tagIsOther ? EddiesColors.steel : category?.color;

  const amountMinor = useMemo(() => {
    const n = parseFloat(rawAmount || '0');
    return isNaN(n) ? 0 : toMinorUnits(n);
  }, [rawAmount]);

  const isValid =
    amountMinor > 0 &&
    categoryId !== null &&
    (!tagIsOther || otherName.trim().length > 0) &&
    (endKind !== 'on_date' || (endMs !== null && endMs > startMs)) &&
    (endKind !== 'after_n' || endCount > 0);

  // Anchor day-of-month / day-of-week derived from cadence + start.
  const anchorFor = useCallback(
    (start: number) =>
      freq === 'monthly' ? Math.min(31, Math.max(1, anchorDay))
      : freq === 'weekly' ? new Date(start).getDay()
      : null,
    [freq, anchorDay],
  );

  // Live forecast of the first occurrence — mirrors exactly what will be saved.
  const previewNext = useMemo(() => {
    const draft = {
      freq, interval_n: intervalN, anchor_day: anchorFor(startMs),
      start_date: startMs, end_kind: endKind,
      end_date: endKind === 'on_date' ? endMs : null,
      end_count: endKind === 'after_n' ? endCount : null,
      last_run_at: null,
    } as RecurringRule;
    try { return nextRunAt(draft); } catch { return null; }
  }, [freq, intervalN, anchorFor, startMs, endKind, endMs, endCount]);

  // Stable mount-time fallback for the NEXT preview when no run date resolves —
  // keeps Date.now() out of the render body (react-hooks/purity).
  const [nowFallback] = useState(() => Date.now());

  const monthlyEq = monthlyEquivalentMinor({ freq, interval_n: intervalN, amount_minor: amountMinor });
  const amountColor = kind === 'outflow' ? EddiesColors.alert : EddiesColors.bone;

  const repeatsValue = intervalN === 1 ? FREQ_LABEL[freq] : `EVERY ${intervalN} ${FREQ_NOUN[freq]}S`;
  const endsValue = endKind === 'never' ? 'NEVER'
    : endKind === 'on_date' ? (endMs ? `ON ${formatRunDate(endMs)}` : 'PICK DATE')
    : `AFTER ${endCount}`;

  function handleAmountChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setRawAmount(cleaned);
  }

  function openDateSheet(id: 'starts' | 'ends') {
    setDateDraft(id === 'starts' ? toDateStr(startMs) : endMs ? toDateStr(endMs) : '');
    setSheet(id === 'starts' ? 'starts' : 'ends');
  }

  async function handleSave() {
    if (!isValid || saving || loading) return;
    setSaving(true);
    try {
      // Resolve a free-text "OTHER" tag into a real category (reused if it exists).
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
      const payload = {
        account_id: effectiveVaultId,
        category_id: resolvedCategoryId,
        kind,
        amount_minor: amountMinor,
        note: note.trim() || null,
        freq,
        interval_n: intervalN,
        anchor_day: anchorFor(startMs),
        start_date: startMs,
        end_kind: endKind,
        end_date: endKind === 'on_date' ? endMs : null,
        end_count: endKind === 'after_n' ? endCount : null,
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

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
          {isEdit ? 'EDIT RULE' : 'NEW RULE'}
        </MonoLabel>
        <Pressable onPress={() => { Keyboard.dismiss(); setTimeout(() => router.back(), 100); }}
          hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <MonoLabel size={11} color={EddiesColors.steel}>✕</MonoLabel>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        {/* Hero amount */}
        <View style={s.hero}>
          <View style={s.amountRow}>
            <Text style={[s.sym, { color: amountColor }]}>{sym}</Text>
            <TextInput
              value={rawAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              style={[s.amountInput, { color: amountColor }]}
              placeholder="0"
              placeholderTextColor={EddiesColors.steel + '44'}
              selectionColor={amountColor}
              returnKeyType="done"
            />
          </View>
          <View style={s.kindToggle}>
            <Pressable onPress={() => { setKind('outflow'); setCategoryId(null); setOtherName(''); }} hitSlop={8}
              accessibilityRole="radio" accessibilityState={{ checked: kind === 'outflow' }}>
              <MonoLabel size={10} letterSpacing={2} weight={kind === 'outflow' ? 'bold' : 'regular'}
                color={kind === 'outflow' ? EddiesColors.alert : EddiesColors.steel}>OUTFLOW</MonoLabel>
            </Pressable>
            <MonoLabel size={10} color={EddiesColors.steel + '55'}>/</MonoLabel>
            <Pressable onPress={() => { setKind('inflow'); setCategoryId(null); setOtherName(''); }} hitSlop={8}
              accessibilityRole="radio" accessibilityState={{ checked: kind === 'inflow' }}>
              <MonoLabel size={10} letterSpacing={2} weight={kind === 'inflow' ? 'bold' : 'regular'}
                color={kind === 'inflow' ? EddiesColors.bone : EddiesColors.steel}>INFLOW</MonoLabel>
            </Pressable>
          </View>
        </View>

        {/* Calm rows */}
        <View style={s.rows}>
          <Row label="TAG" value={tagLabel} dotColor={tagDot}
            muted={!category && !tagIsOther} onPress={() => setSheet('tag')} />
          <Row label="REPEATS" value={repeatsValue} onPress={() => setSheet('repeats')} />
          {freq === 'monthly' && (
            <Row label="ON" value={`DAY ${Math.min(31, Math.max(1, anchorDay))}`} onPress={() => setSheet('on')} />
          )}
          <Row label="STARTS" value={friendlyDate(startMs)} onPress={() => openDateSheet('starts')} />
          <Row label="ENDS" value={endsValue} muted={endKind === 'never'} onPress={() => setSheet('ends')} />
          <Row label="VAULT" value={vaultName} muted={effectiveVaultId === null} onPress={() => setSheet('vault')} />

          {/* Auto-post toggle */}
          <View style={rs.row}>
            <View style={{ flex: 1 }}>
              <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>AUTO-POST</MonoLabel>
              <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>
                {mode === 'auto' ? 'POSTS ON SCHEDULE' : 'QUEUES FOR REVIEW'}
              </MonoLabel>
            </View>
            <Toggle on={mode === 'auto'} label="Auto-post"
              onToggle={() => setMode(m => (m === 'auto' ? 'confirm' : 'auto'))} />
          </View>

          <Row label="NOTE" value={note ? note.toUpperCase() : 'ADD NOTE'} muted={!note}
            onPress={() => setSheet('note')} />
        </View>
      </ScrollView>

      {/* Footer: live summary + action */}
      <View style={s.footer}>
        <View style={s.summary}>
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
            NEXT {isValid ? friendlyDate(previewNext ?? nowFallback) : '—'}
          </MonoLabel>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '88'}>
            ≈{sym}{formatAmountTabular(monthlyEq)}/MO
          </MonoLabel>
        </View>
        <View style={s.stampWrap}>
          <StampButton label={isEdit ? 'UPDATE RULE' : 'CREATE RULE'} onPress={handleSave}
            disabled={!isValid || saving || loading} loading={saving} />
        </View>
      </View>

      {/* ── Sheets ─────────────────────────────────────────── */}
      <Sheet visible={sheet === 'tag'} title="TAG" onClose={() => setSheet(null)}>
        {filteredCats.map(c => (
          <Pressable key={c.id} style={cs.tagRow} onPress={() => { setCategoryId(c.id); setSheet(null); }}
            accessibilityRole="radio" accessibilityState={{ checked: c.id === categoryId }}>
            <View style={[cs.tagDot, { backgroundColor: c.color }]} />
            <MonoLabel size={12} letterSpacing={1.5} weight={c.id === categoryId ? 'bold' : 'regular'}
              color={c.id === categoryId ? EddiesColors.bone : EddiesColors.steel}>
              {c.name.toUpperCase()}
            </MonoLabel>
            {c.id === categoryId ? <MonoLabel size={12} color={EddiesColors.alert}>  ✓</MonoLabel> : null}
          </Pressable>
        ))}
        {/* Catch-all free-text tag */}
        <Pressable style={cs.tagRow} onPress={() => setCategoryId('__other__')}
          accessibilityRole="radio" accessibilityState={{ checked: tagIsOther }}>
          <View style={[cs.tagDot, { backgroundColor: EddiesColors.steel }]} />
          <MonoLabel size={12} letterSpacing={1.5} weight={tagIsOther ? 'bold' : 'regular'}
            color={tagIsOther ? EddiesColors.bone : EddiesColors.steel}>+ OTHER</MonoLabel>
          {tagIsOther ? <MonoLabel size={12} color={EddiesColors.alert}>  ✓</MonoLabel> : null}
        </Pressable>
        {tagIsOther && (
          <View style={cs.manualRow}>
            <TextInput value={otherName} onChangeText={setOtherName} placeholder="E.G. SUBSCRIPTIONS"
              placeholderTextColor={EddiesColors.steel + '55'} style={cs.dateInput}
              autoCapitalize="characters" maxLength={40} returnKeyType="done"
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the field when this action sheet opens on user tap */
              onSubmitEditing={() => { if (otherName.trim()) setSheet(null); }} autoFocus />
            <Pressable style={cs.setBtn} disabled={!otherName.trim()}
              onPress={() => { if (otherName.trim()) setSheet(null); }}
              accessibilityRole="button" accessibilityLabel="Set tag name">
              <MonoLabel size={9} letterSpacing={1.5}
                color={otherName.trim() ? EddiesColors.alert : EddiesColors.steel + '55'}>SET</MonoLabel>
            </Pressable>
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'repeats'} title="REPEATS" onClose={() => setSheet(null)}>
        <View style={cs.everyRow}>
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>EVERY</MonoLabel>
          <Stepper value={intervalN} onChange={setIntervalN} min={1} max={99} />
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>{FREQ_NOUN[freq]}{intervalN === 1 ? '' : 'S'}</MonoLabel>
        </View>
        {FREQS.map(f => (
          <SheetOption key={f} label={FREQ_LABEL[f]} selected={f === freq} onPress={() => setFreq(f)} />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'on'} title="ON DAY OF MONTH" onClose={() => setSheet(null)}>
        <View style={cs.centerPad}>
          <Stepper value={Math.min(31, Math.max(1, anchorDay))} onChange={setAnchorDay} min={1} max={31} />
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '88'}>CLAMPS TO LAST DAY IN SHORT MONTHS</MonoLabel>
        </View>
      </Sheet>

      <Sheet visible={sheet === 'starts'} title="STARTS" onClose={() => setSheet(null)}>
        <View style={cs.chips}>
          {([['TODAY', 0], ['TOMORROW', 1], ['IN 1 WEEK', 7]] as const).map(([lbl, d]) => (
            <Pressable key={lbl} style={cs.chip}
              onPress={() => { setStartMs(atNine(Date.now() + d * DAY)); setSheet(null); }}
              accessibilityRole="button" accessibilityLabel={lbl}>
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.bone}>{lbl}</MonoLabel>
            </Pressable>
          ))}
        </View>
        <View style={cs.manualRow}>
          <TextInput value={dateDraft} onChangeText={setDateDraft} placeholder="YYYY-MM-DD"
            placeholderTextColor={EddiesColors.steel + '55'} style={cs.dateInput}
            autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
          <Pressable style={cs.setBtn} disabled={parseDateStr(dateDraft) === null}
            onPress={() => { const ms = parseDateStr(dateDraft); if (ms !== null) { setStartMs(ms); setSheet(null); } }}
            accessibilityRole="button" accessibilityLabel="Set start date">
            <MonoLabel size={9} letterSpacing={1.5}
              color={parseDateStr(dateDraft) === null ? EddiesColors.steel + '55' : EddiesColors.alert}>SET</MonoLabel>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={sheet === 'ends'} title="ENDS" onClose={() => setSheet(null)}>
        <SheetOption label="NEVER" selected={endKind === 'never'}
          onPress={() => { setEndKind('never'); setSheet(null); }} />
        <SheetOption label="ON A DATE" selected={endKind === 'on_date'}
          sublabel={endMs ? formatRunDate(endMs) : undefined} onPress={() => setEndKind('on_date')} />
        {endKind === 'on_date' && (
          <View style={cs.manualRow}>
            <TextInput value={dateDraft} onChangeText={setDateDraft} placeholder="YYYY-MM-DD"
              placeholderTextColor={EddiesColors.steel + '55'} style={cs.dateInput}
              autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
            <Pressable style={cs.setBtn} disabled={parseDateStr(dateDraft) === null}
              onPress={() => { const ms = parseDateStr(dateDraft); if (ms !== null) { setEndMs(ms); setSheet(null); } }}
              accessibilityRole="button" accessibilityLabel="Set end date">
              <MonoLabel size={9} letterSpacing={1.5}
                color={parseDateStr(dateDraft) === null ? EddiesColors.steel + '55' : EddiesColors.alert}>SET</MonoLabel>
            </Pressable>
          </View>
        )}
        <SheetOption label="AFTER N TIMES" selected={endKind === 'after_n'}
          sublabel={endKind === 'after_n' ? `${endCount} OCCURRENCES` : undefined}
          onPress={() => setEndKind('after_n')} />
        {endKind === 'after_n' && (
          <View style={cs.centerPad}>
            <Stepper value={endCount} onChange={setEndCount} min={1} max={999} />
            <Pressable style={cs.doneBtn} onPress={() => setSheet(null)} accessibilityRole="button" accessibilityLabel="Done">
              <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.alert}>DONE</MonoLabel>
            </Pressable>
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'vault'} title="VAULT" onClose={() => setSheet(null)}>
        <SheetOption label="// NO VAULT" selected={effectiveVaultId === null}
          onPress={() => { setVaultId(null); setSheet(null); }} />
        {accounts.map(a => (
          <SheetOption key={a.id} label={a.name.toUpperCase()} selected={a.id === effectiveVaultId}
            onPress={() => { setVaultId(a.id); setSheet(null); }} />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'note'} title="NOTE" onClose={() => setSheet(null)}>
        <TextInput value={note} onChangeText={setNote} style={cs.noteInput} placeholder="— OPTIONAL —"
          placeholderTextColor={EddiesColors.steel + '44'} maxLength={200} returnKeyType="done"
          /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the field when this action sheet opens on user tap */
          blurOnSubmit onSubmitEditing={() => setSheet(null)} autoFocus />
        <Pressable style={cs.doneBtn} onPress={() => setSheet(null)} accessibilityRole="button" accessibilityLabel="Done">
          <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.alert}>DONE</MonoLabel>
        </Pressable>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '1A',
  },
  body: { paddingBottom: EddiesSpacing.xl },
  hero: { alignItems: 'center', paddingTop: EddiesSpacing.xl, paddingBottom: EddiesSpacing.lg, gap: EddiesSpacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  sym: { fontFamily: EddiesFonts.displayBold, fontSize: 34, marginRight: 4 },
  amountInput: {
    fontFamily: EddiesFonts.displayBold, fontSize: 72, textAlign: 'center',
    minWidth: 80, letterSpacing: -2, padding: 0,
  },
  kindToggle: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.md },
  rows: { borderTopWidth: 1, borderTopColor: EddiesColors.steel + '1A' },
  footer: {
    gap: EddiesSpacing.sm, paddingTop: EddiesSpacing.sm, paddingBottom: EddiesSpacing.md,
    borderTopWidth: 1, borderTopColor: EddiesColors.steel + '1A',
  },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md, paddingTop: EddiesSpacing.xs,
  },
  stampWrap: { paddingHorizontal: EddiesSpacing.md },
});

const rs = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.md,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

const ts = StyleSheet.create({
  track: { width: 44, height: 24, borderRadius: 999, justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999 },
  knob: { width: 18, height: 18, borderRadius: 999, backgroundColor: EddiesColors.bone, marginHorizontal: 3 },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});

const ss = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.md },
  stepBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: EddiesColors.steel + '44', borderRadius: EddiesRadius.panel,
  },
  stepVal: { fontFamily: EddiesFonts.monoBold, fontSize: 18, color: EddiesColors.bone, minWidth: 32, textAlign: 'center' },
});

const cs = StyleSheet.create({
  tagRow: {
    flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '12',
  },
  tagDot: { width: 9, height: 9, borderRadius: 5 },
  everyRow: {
    flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm, marginBottom: EddiesSpacing.xs,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '1A',
  },
  centerPad: { alignItems: 'center', gap: EddiesSpacing.md, paddingVertical: EddiesSpacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: EddiesSpacing.sm, paddingVertical: EddiesSpacing.sm },
  chip: {
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderWidth: 1, borderColor: EddiesColors.steel + '44', borderRadius: EddiesRadius.panel,
  },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm },
  dateInput: {
    flex: 1, fontFamily: EddiesFonts.mono, fontSize: 16, color: EddiesColors.bone,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '55',
    paddingVertical: EddiesSpacing.xs, letterSpacing: 1,
  },
  setBtn: { paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm },
  doneBtn: { paddingHorizontal: EddiesSpacing.lg, paddingVertical: EddiesSpacing.sm },
  noteInput: {
    fontFamily: EddiesFonts.mono, fontSize: 14, color: EddiesColors.bone,
    paddingVertical: EddiesSpacing.sm, letterSpacing: 0.5, minHeight: 44,
  },
});
