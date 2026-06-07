import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import { formatMinor } from '@/lib/format';
import {
  getPendingMonths,
  archiveMonth,
  exportMonthCSV,
  exportMonthHTML,
  markExported,
  type PendingMonth,
} from '@/lib/archive';
import { clearCache } from '@/lib/query-cache';

export default function ArchiveModal() {
  const db = useSQLiteContext();
  const sym = useCurrencySymbol();
  const { archivePrompt, setArchivePrompt, showToast, hapticsEnabled } = useStore();

  const [data, setData] = useState<PendingMonth | null>(null);
  const [csvDone, setCsvDone] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!archivePrompt) return;
    getPendingMonths(db).then((months) => {
      const m = months.find((m) => m.year === archivePrompt.year && m.month === archivePrompt.month);
      setData(m ?? null);
    }).catch(() => showToast('Failed to load month data', 'err'));
  }, [archivePrompt, db]);

  function dismiss() {
    setArchivePrompt(null);
  }

  async function handleExportCSV() {
    if (!data) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await exportMonthCSV(db, data.year, data.month, sym);
      await markExported(db, data.year, data.month, 'csv');
      setCsvDone(true);
      showToast('CSV shared');
    } catch {
      showToast('Export failed', 'err');
    }
  }

  async function handleExportPDF() {
    if (!data) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await exportMonthHTML(db, data.year, data.month, sym);
      await markExported(db, data.year, data.month, 'pdf');
      setPdfDone(true);
      showToast('Report shared — open in browser, print to PDF');
    } catch {
      showToast('Export failed', 'err');
    }
  }

  async function handleArchive() {
    if (!data) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setArchiving(true);
      await archiveMonth(db, data.year, data.month);
      clearCache();
      showToast(`${data.label} archived`);
      dismiss();
    } catch {
      showToast('Archive failed', 'err');
    } finally {
      setArchiving(false);
    }
  }

  if (!data) return null;

  const net = data.total_inflow - data.total_outflow;
  const netPositive = net >= 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // ARCHIVE 06-A" />
        <BarcodeMark height={16} />
        <Pressable onPress={dismiss} hitSlop={12}>
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>LATER</MonoLabel>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* Period */}
        <View style={s.periodRow}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>PERIOD</MonoLabel>
          <Numerals size={32} weight="bold" color={EddiesColors.bone}>{data.label}</Numerals>
        </View>

        {/* Stats */}
        <View style={s.statsBlock}>
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>OUTFLOW</MonoLabel>
            <Numerals size={22} color={EddiesColors.alert} weight="bold">
              {sym}{formatMinor(data.total_outflow)}
            </Numerals>
          </View>
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>INFLOW</MonoLabel>
            <Numerals size={22} color={EddiesColors.bone} weight="bold">
              {sym}{formatMinor(data.total_inflow)}
            </Numerals>
          </View>
          <View style={s.hairline} />
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>NET</MonoLabel>
            <Numerals size={16} color={netPositive ? EddiesColors.bone : EddiesColors.alert} weight="bold">
              {netPositive ? '+' : '−'}{sym}{formatMinor(Math.abs(net))}
            </Numerals>
          </View>
          <View style={s.ledgerRow}>
            <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>ENTRIES</MonoLabel>
            <Numerals size={16} color={EddiesColors.bone} weight="semibold">{data.tx_count}</Numerals>
          </View>
        </View>

        {/* Warning */}
        <View style={s.warningBlock}>
          <MonoLabel size={9} letterSpacing={1} color={EddiesColors.alert} weight="bold">
            ! DATA MANAGEMENT
          </MonoLabel>
          <MonoLabel size={10} letterSpacing={0.5} color={EddiesColors.steel} style={s.warningText}>
            This month's entries will be compressed into a summary and removed from the live ledger.
            Export before archiving — raw entries cannot be recovered after.
          </MonoLabel>
        </View>

        {/* Export actions */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EXPORT FIRST</MonoLabel>

          <Pressable style={[s.exportBtn, csvDone && s.exportBtnDone]} onPress={handleExportCSV}>
            <MonoLabel size={11} weight="bold" color={csvDone ? EddiesColors.steel : EddiesColors.bone} letterSpacing={1}>
              {csvDone ? '✓ CSV EXPORTED' : 'EXPORT CSV'}
            </MonoLabel>
          </Pressable>

          <Pressable style={[s.exportBtn, pdfDone && s.exportBtnDone]} onPress={handleExportPDF}>
            <MonoLabel size={11} weight="bold" color={pdfDone ? EddiesColors.steel : EddiesColors.bone} letterSpacing={1}>
              {pdfDone ? '✓ REPORT EXPORTED' : 'EXPORT PDF REPORT'}
            </MonoLabel>
          </Pressable>

          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel + '88'} style={s.hint}>
            PDF report is an HTML file — open in browser and print to PDF.
          </MonoLabel>
        </View>

        {/* Archive action */}
        <View style={s.section}>
          <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>ARCHIVE</MonoLabel>

          <Pressable
            style={[s.archiveBtn, (!csvDone && !pdfDone) && s.archiveBtnLocked]}
            onPress={handleArchive}
            disabled={archiving}
          >
            {archiving ? (
              <ActivityIndicator color={EddiesColors.bone} />
            ) : (
              <MonoLabel size={11} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
                {(!csvDone && !pdfDone) ? 'EXPORT FIRST TO UNLOCK' : `ARCHIVE ${data.label} & CLEAR`}
              </MonoLabel>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '1A',
  },
  body: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.lg,
    gap: EddiesSpacing.xl,
    paddingBottom: EddiesSpacing.xxl,
  },
  periodRow: { gap: EddiesSpacing.xs },
  statsBlock: { gap: EddiesSpacing.sm },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  hairline: {
    height: 1,
    backgroundColor: EddiesColors.steel + '18',
  },
  warningBlock: {
    borderLeftWidth: 2,
    borderLeftColor: EddiesColors.alert,
    paddingLeft: EddiesSpacing.md,
    gap: EddiesSpacing.xs,
  },
  warningText: { lineHeight: 16 },
  section: { gap: EddiesSpacing.sm },
  exportBtn: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
    borderRadius: 4,
    alignItems: 'center',
  },
  exportBtnDone: {
    borderColor: EddiesColors.steel + '18',
    opacity: 0.6,
  },
  hint: { lineHeight: 15 },
  archiveBtn: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.alert,
    borderRadius: 4,
    alignItems: 'center',
  },
  archiveBtnLocked: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
  },
});
