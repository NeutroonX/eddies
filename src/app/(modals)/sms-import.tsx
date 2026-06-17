import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { GlobalToast } from '@/components/ui/global-toast';
import { EddiesColors, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';
import { createSmsReader } from '@/lib/sms/reader';
import { scanSms } from '@/lib/sms/scan';
import { captureError, trackEvent } from '@/lib/telemetry';
import { useStore } from '@/store';

const ENABLED_KEY = 'sms_import_enabled';

// Public (Play-compliant) build captures transactions via the Android share
// sheet, so the screen teaches that flow instead of an in-app permission toggle.
const SHARE_STEPS = [
  'Open the bank or UPI SMS in your Messages app.',
  'Tap Share, then choose Eddies.',
  'Confirm the entry in your review inbox.',
];

export default function SmsImportModal() {
  const db = useSQLiteContext();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const showToast = useStore(s => s.showToast);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const reader = useMemo(() => createSmsReader(), []);
  const supported = reader.isSupported();
  // On Android the reader is also a no-op when this build ships without the
  // READ_SMS pull path (Play-compliant preview/production); distinguish that
  // from genuinely unsupported platforms so the copy isn't misleading.
  const unavailableOnAndroidBuild = !supported && Platform.OS === 'android';

  const reload = useCallback(async () => {
    setEnabled((await getSetting(db, ENABLED_KEY)) === 'true');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function runScan(): Promise<void> {
    const res = await scanSms(db, reader);
    bumpDbVersion();
    showToast(
      res.inserted > 0
        ? `Found ${res.inserted} new ${res.inserted === 1 ? 'entry' : 'entries'}`
        : 'No new transactions found',
      'ok'
    );
  }

  async function handleEnable() {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await reader.requestPermission();
      trackEvent(granted ? 'sms_permission_granted' : 'sms_permission_denied');
      if (!granted) {
        showToast('Permission not granted', 'err');
        return;
      }
      await setSetting(db, ENABLED_KEY, 'true');
      setEnabled(true);
      await runScan();
    } catch (err) {
      captureError(err, { feature: 'sms_import_enable' });
      showToast('SMS import unavailable on this build', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleScanNow() {
    if (busy) return;
    setBusy(true);
    try {
      await runScan();
    } catch (err) {
      captureError(err, { feature: 'sms_import_scan' });
      showToast('Scan failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    await setSetting(db, ENABLED_KEY, 'false');
    setEnabled(false);
    showToast('SMS import turned off', 'ok');
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EDDIES // SMS IMPORT</MonoLabel>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={s.iconBadge}>
            <MonoLabel size={24} color={EddiesColors.bone}>✉</MonoLabel>
          </View>
          <MonoLabel size={18} letterSpacing={1} weight="bold" color={EddiesColors.bone} style={s.title}>
            AUTO-LOG FROM SMS
          </MonoLabel>
          <MonoLabel size={11} letterSpacing={0.3} color={EddiesColors.steel} style={s.sub}>
            Bank & UPI texts become one-tap entries.
          </MonoLabel>
        </View>

        {unavailableOnAndroidBuild ? (
          <View style={s.steps}>
            <MonoLabel size={10} letterSpacing={1.5} weight="bold" color={EddiesColors.bone} style={s.stepsTitle}>
              SHARE A BANK TEXT TO LOG IT
            </MonoLabel>
            {SHARE_STEPS.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}>
                  <MonoLabel size={10} weight="bold" color={EddiesColors.bone}>{i + 1}</MonoLabel>
                </View>
                <MonoLabel size={11} letterSpacing={0.3} color={EddiesColors.steel} style={s.stepTxt}>
                  {step}
                </MonoLabel>
              </View>
            ))}
            <MonoLabel size={9} letterSpacing={0.3} color={EddiesColors.steel + 'AA'} style={s.caveat}>
              Only texts you share are logged — no background scanning, no history import.
            </MonoLabel>
          </View>
        ) : !supported ? (
          <View style={s.note}>
            <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={s.noteTxt}>
              SMS import is Android-only. On this device, add entries manually.
            </MonoLabel>
          </View>
        ) : (
          <View style={s.controls}>
            <View style={[s.cell, s.statusCell]}>
              <MonoLabel size={11} weight="bold" color={enabled ? EddiesColors.bone : EddiesColors.steel}>
                {enabled ? '● ON' : '○ OFF'}
              </MonoLabel>
            </View>
            <Pressable
              style={[s.cell, s.scanCell, (!enabled || busy) && s.cellDisabled]}
              onPress={handleScanNow} disabled={!enabled || busy}
              accessibilityRole="button" accessibilityLabel="Scan messages now">
              <MonoLabel size={11} letterSpacing={1} weight="bold" color={EddiesColors.bone}>
                {busy ? '…' : '↻ SCAN'}
              </MonoLabel>
            </Pressable>
            <Pressable
              style={[s.cell, enabled ? s.toggleOff : s.toggleOn, busy && s.cellBusy]}
              onPress={enabled ? handleDisable : handleEnable} disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={enabled ? 'Turn off SMS import' : 'Turn on SMS import'}>
              <MonoLabel size={11} letterSpacing={1} weight="bold"
                color={enabled ? EddiesColors.steel : EddiesColors.bone}>
                {enabled ? 'TURN OFF' : 'TURN ON'}
              </MonoLabel>
            </Pressable>
          </View>
        )}

        <MonoLabel size={9} letterSpacing={0.3} color={EddiesColors.steel + 'AA'} style={s.privacy}>
          On-device only · never uploaded · read-only, skips OTP & promo.
        </MonoLabel>
      </ScrollView>

      <GlobalToast />
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
  content: {
    paddingHorizontal: EddiesSpacing.lg,
    paddingTop: EddiesSpacing.xl,
    paddingBottom: EddiesSpacing.xl,
    gap: EddiesSpacing.lg,
  },
  // Hero
  hero: { alignItems: 'center', gap: EddiesSpacing.sm },
  iconBadge: {
    width: 56, height: 56, borderRadius: EddiesRadius.card,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: EddiesSpacing.xs,
  },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', lineHeight: 17 },
  // Control row: STATUS · SCAN · TOGGLE
  controls: { flexDirection: 'row', gap: EddiesSpacing.sm },
  cell: {
    flex: 1, height: 48, borderRadius: EddiesRadius.card,
    alignItems: 'center', justifyContent: 'center',
  },
  statusCell: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '33',
  },
  scanCell: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '44',
  },
  cellDisabled: { opacity: 0.35 },
  cellBusy: { opacity: 0.6 },
  toggleOn: { backgroundColor: EddiesColors.alert },
  toggleOff: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '44',
  },
  // Privacy — one quiet line
  privacy: { textAlign: 'center', lineHeight: 14 },
  note: {
    padding: EddiesSpacing.md,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', borderRadius: EddiesRadius.card,
  },
  noteTxt: { textAlign: 'center', lineHeight: 15 },
  // Share-to-log steps (public Play-compliant build)
  steps: {
    padding: EddiesSpacing.md,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', borderRadius: EddiesRadius.card,
    gap: EddiesSpacing.sm,
  },
  stepsTitle: { marginBottom: EddiesSpacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1, borderColor: EddiesColors.steel + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { flex: 1, lineHeight: 16 },
  caveat: { lineHeight: 14, marginTop: EddiesSpacing.xs },
});
