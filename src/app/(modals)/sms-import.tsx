import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';
import { createSmsReader } from '@/lib/sms/reader';
import { scanSms } from '@/lib/sms/scan';
import { captureError, trackEvent } from '@/lib/telemetry';
import { useStore } from '@/store';

const ENABLED_KEY = 'sms_import_enabled';

const PRIVACY_POINTS = [
  'Reading happens entirely on your phone. No SMS text is ever uploaded.',
  'Raw messages are never sent to crash reports or cloud backups.',
  'Eddies only reads — it never sends SMS, and ignores OTP & promo texts.',
  'Optional: the app works fully without it. You can turn this off anytime.',
];

export default function SmsImportModal() {
  const db = useSQLiteContext();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const showToast = useStore(s => s.showToast);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const reader = createSmsReader();
  const supported = reader.isSupported();

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

      <ScrollView contentContainerStyle={s.content}>
        <MonoLabel size={44} color={EddiesColors.steel + '33'}>✉</MonoLabel>
        <MonoLabel size={15} letterSpacing={1} weight="bold" color={EddiesColors.bone}>
          AUTO-LOG FROM BANK SMS
        </MonoLabel>
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel} style={s.sub}>
          EDDIES READS YOUR BANK & UPI TEXTS ON-DEVICE AND TURNS THEM INTO ONE-TAP ENTRIES.
        </MonoLabel>

        <View style={s.points}>
          {PRIVACY_POINTS.map((p, i) => (
            <View key={i} style={s.point}>
              <MonoLabel size={10} color={EddiesColors.bone}>›</MonoLabel>
              <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={s.pointTxt}>
                {p}
              </MonoLabel>
            </View>
          ))}
        </View>

        {!supported ? (
          <View style={s.note}>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
              SMS IMPORT IS ANDROID-ONLY. ON THIS DEVICE, ADD ENTRIES MANUALLY OR VIA QUICK-ADD.
            </MonoLabel>
          </View>
        ) : enabled ? (
          <>
            <View style={s.statusOn}>
              <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={EddiesColors.ink}>● SMS IMPORT ON</MonoLabel>
            </View>
            <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={handleScanNow} disabled={busy}
              accessibilityRole="button" accessibilityLabel="Scan messages now">
              <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.bone}>
                {busy ? 'SCANNING…' : '↻ SCAN NOW'}
              </MonoLabel>
            </Pressable>
            <Pressable style={s.secondary} onPress={handleDisable} disabled={busy}
              accessibilityRole="button" accessibilityLabel="Turn off SMS import">
              <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>TURN OFF</MonoLabel>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={handleEnable} disabled={busy}
              accessibilityRole="button" accessibilityLabel="Enable SMS import">
              <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.bone}>
                {busy ? 'WORKING…' : 'ENABLE SMS IMPORT'}
              </MonoLabel>
            </Pressable>
            <Pressable style={s.secondary} onPress={() => router.back()}
              accessibilityRole="button" accessibilityLabel="Skip, add manually">
              <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>SKIP — I&apos;LL ADD MANUALLY</MonoLabel>
            </Pressable>
          </>
        )}
      </ScrollView>
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
  content: { padding: EddiesSpacing.lg, alignItems: 'center', gap: EddiesSpacing.sm },
  sub: { textAlign: 'center', marginTop: EddiesSpacing.xs, lineHeight: 15 },
  points: {
    alignSelf: 'stretch', marginTop: EddiesSpacing.lg, gap: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md, paddingHorizontal: EddiesSpacing.md,
    backgroundColor: '#1A1B1E', borderRadius: EddiesRadius.card,
  },
  point: { flexDirection: 'row', gap: EddiesSpacing.sm, alignItems: 'flex-start' },
  pointTxt: { flex: 1, lineHeight: 14 },
  note: {
    alignSelf: 'stretch', marginTop: EddiesSpacing.lg, padding: EddiesSpacing.md,
    borderWidth: 1, borderColor: EddiesColors.steel + '33', borderRadius: EddiesRadius.card,
  },
  statusOn: {
    marginTop: EddiesSpacing.lg, paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.xs + 2,
    backgroundColor: EddiesColors.bone, borderRadius: EddiesRadius.chip,
  },
  cta: {
    alignSelf: 'stretch', marginTop: EddiesSpacing.lg,
    paddingVertical: EddiesSpacing.md, alignItems: 'center',
    backgroundColor: EddiesColors.alert, borderRadius: EddiesRadius.card,
  },
  ctaBusy: { opacity: 0.6 },
  secondary: { marginTop: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm, alignItems: 'center' },
});
