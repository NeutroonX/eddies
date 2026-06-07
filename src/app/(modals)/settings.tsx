import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { WORLD_CURRENCIES } from '@/constants/currencies';
import { useStore } from '@/store';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';
import { setTelemetryEnabled } from '@/lib/telemetry';
import { createBackup } from '@/lib/backup';
import { isBiometricAvailable, authenticate } from '@/lib/biometric';

const APP_VERSION = '1.0.0';

export default function SettingsModal() {
  const db = useSQLiteContext();
  const { currency, firstDayOfWeek, hapticsEnabled, crashReportingEnabled, biometricStatus, setCurrency, setFirstDayOfWeek, setHapticsEnabled, setCrashReportingEnabled, setBiometricStatus, showToast } = useStore();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedCurrency = await getSetting(db, 'currency', 'USD');
        const savedDayOfWeek = await getSetting(db, 'first_day_of_week', '1');
        const savedHaptics = await getSetting(db, 'haptics_enabled', 'true');
        const savedCrashReporting = await getSetting(db, 'crash_reporting_enabled', 'true');
        setCurrency(savedCurrency!);
        setFirstDayOfWeek(parseInt(savedDayOfWeek!, 10));
        setHapticsEnabled(savedHaptics === 'true');
        setCrashReportingEnabled(savedCrashReporting !== 'false');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [db, setCurrency, setFirstDayOfWeek, setHapticsEnabled, setCrashReportingEnabled]);

  async function handleCurrencyChange(newCurrency: string) {
    try {
      await setSetting(db, 'currency', newCurrency);
      setCurrency(newCurrency);
      setExpanded(null);
      showToast(`Currency → ${newCurrency}`);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      showToast('Failed to update currency', 'err');
    }
  }

  async function handleFirstDayOfWeekChange(day: number) {
    try {
      setFirstDayOfWeek(day);
      await setSetting(db, 'first_day_of_week', String(day));
      showToast(day === 0 ? 'Week starts Sunday' : 'Week starts Monday');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      showToast('Failed to update setting', 'err');
    }
  }

  async function handleHapticsChange(enabled: boolean) {
    try {
      setHapticsEnabled(enabled);
      await setSetting(db, 'haptics_enabled', enabled ? 'true' : 'false');
      showToast(enabled ? 'Haptics enabled' : 'Haptics disabled');
      if (enabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      showToast('Failed to update setting', 'err');
    }
  }

  async function handleBiometricChange(enable: boolean) {
    try {
      if (enable) {
        const available = await isBiometricAvailable();
        if (!available) { showToast('No biometric hardware enrolled', 'err'); return; }
        const passed = await authenticate('Verify to enable app lock');
        if (!passed) return;
        await setSetting(db, 'biometric_lock_enabled', 'true');
        setBiometricStatus('enabled');
        showToast('App lock enabled');
      } else {
        await setSetting(db, 'biometric_lock_enabled', 'false');
        setBiometricStatus('disabled');
        showToast('App lock disabled');
      }
      if (hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      showToast('Failed to update setting', 'err');
    }
  }

  async function handleCreateBackup() {
    try {
      setBackupLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const json = await createBackup(db);
      const filename = `eddies_backup_${new Date().toISOString().split('T')[0]}.json`;
      await Share.share({ title: filename, message: json });
      showToast('Backup ready to save');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Backup creation error:', err);
      showToast('Backup failed', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBackupLoading(false);
    }
  }

  function handleDeleteAllData() {
    Alert.alert(
      'DELETE ALL DATA',
      'This will permanently erase all transactions, vaults, caps and custom categories.\n\nYour name and join date will be kept.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE EVERYTHING',
          style: 'destructive',
          onPress: confirmDeleteAllData,
        },
      ]
    );
  }

  async function confirmDeleteAllData() {
    setDeleteLoading(true);
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM transactions');
        await db.runAsync('DELETE FROM monthly_archives');
        await db.runAsync('DELETE FROM budgets');
        await db.runAsync('DELETE FROM accounts');
        await db.runAsync(
          `DELETE FROM categories WHERE id NOT IN ('cat_food','cat_transport','cat_rent','cat_utilities','cat_fun','cat_health','cat_income')`
        );
        await db.runAsync(`UPDATE settings SET value='USD' WHERE key='currency'`);
        await db.runAsync(`UPDATE settings SET value='1' WHERE key='first_day_of_week'`);
        await db.runAsync(`UPDATE settings SET value='true' WHERE key='haptics_enabled'`);
        await db.runAsync(
          `INSERT OR IGNORE INTO accounts (id,name,type,currency,opening_balance_minor,color,archived,created_at) VALUES (?,?,?,?,?,?,?,?)`,
          'acc_default', 'Cash', 'cash', 'USD', 0, '#F2F0EB', 0, Date.now()
        );
      });
      setCurrency('USD');
      setFirstDayOfWeek(1);
      setHapticsEnabled(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('All data cleared');
      router.back();
    } catch (err) {
      console.error('Delete all data error:', err);
      showToast('Failed to delete data', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // SETTINGS 01-A" />
        <BarcodeMark height={16} />
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setTimeout(() => router.back(), 100);
          }}
          hitSlop={12}
        >
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CLOSE</MonoLabel>
        </Pressable>
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        scrollEnabled={expanded !== 'currency'}
      >
        {!loading && (
          <>
            {/* Currency */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>CURRENCY</MonoLabel>
              <Pressable
                style={[s.control, expanded === 'currency' && s.controlActive]}
                onPress={() => setExpanded(expanded === 'currency' ? null : 'currency')}
              >
                <Text style={[s.controlText, s.controlValue]}>{currency}</Text>
                <Text style={[s.controlText, s.controlHint]}>{expanded === 'currency' ? '▲' : '▼'}</Text>
              </Pressable>
              {expanded === 'currency' && (
                <Animated.View entering={FadeIn} exiting={FadeOut} style={s.dropdown}>
                  {WORLD_CURRENCIES.map((c) => (
                    <Pressable
                      key={c.code}
                      style={[s.option, currency === c.code && s.optionActive]}
                      onPress={() => handleCurrencyChange(c.code)}
                    >
                      <Text style={[s.optionText, currency === c.code && s.optionTextActive]}>
                        {c.code}
                      </Text>
                      <Text style={[s.optionText, { color: EddiesColors.steel, fontSize: 10 }]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </Animated.View>
              )}
            </View>

            {/* First Day of Week */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>WEEK STARTS ON</MonoLabel>
              <View style={s.segmentedControl}>
                {[{ label: 'SUN', value: 0 }, { label: 'MON', value: 1 }].map((option) => (
                  <Pressable
                    key={option.value}
                    style={[s.segment, firstDayOfWeek === option.value && s.segmentActive]}
                    onPress={() => handleFirstDayOfWeekChange(option.value)}
                  >
                    <Text style={[s.segmentText, firstDayOfWeek === option.value && s.segmentTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Haptics + App Lock side by side */}
            <View style={s.section}>
              <View style={s.toggleGrid}>
                <View style={s.toggleCell}>
                  <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>HAPTICS</MonoLabel>
                  <View style={s.toggleRow}>
                    <Pressable
                      style={[s.toggle, hapticsEnabled && s.toggleActive]}
                      onPress={() => handleHapticsChange(!hapticsEnabled)}
                    >
                      <View style={[s.toggleThumb, hapticsEnabled && s.toggleThumbActive]} />
                    </Pressable>
                    <Text style={s.toggleLabel}>{hapticsEnabled ? 'ON' : 'OFF'}</Text>
                  </View>
                </View>

                {Platform.OS === 'android' && (
                  <View style={s.toggleCell}>
                    <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>APP LOCK</MonoLabel>
                    <View style={s.toggleRow}>
                      <Pressable
                        style={[s.toggle, biometricStatus === 'enabled' && s.toggleActive]}
                        onPress={() => handleBiometricChange(biometricStatus !== 'enabled')}
                      >
                        <View style={[s.toggleThumb, biometricStatus === 'enabled' && s.toggleThumbActive]} />
                      </Pressable>
                      <Text style={s.toggleLabel}>{biometricStatus === 'enabled' ? 'ON' : 'OFF'}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Crash Reporting — always on */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>CRASH REPORTS</MonoLabel>
              <View style={[s.control, s.controlDisabled]}>
                <Text style={s.controlText}>ALWAYS ON</Text>
                <Text style={[s.controlText, s.controlHint]}>🔒</Text>
              </View>
            </View>

            {/* Theme Lock */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>THEME</MonoLabel>
              <View style={[s.control, s.controlDisabled]}>
                <Text style={[s.controlText, s.controlValue]}>Dark only</Text>
                <Text style={[s.controlText, s.controlHint]}>🔒</Text>
              </View>
            </View>

            {/* Backup & Restore */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>DATA</MonoLabel>
              <Pressable
                style={[s.control, backupLoading && s.controlDisabled]}
                onPress={handleCreateBackup}
                disabled={backupLoading}
              >
                {backupLoading ? (
                  <ActivityIndicator color={EddiesColors.bone} size="small" />
                ) : (
                  <Text style={s.controlText}>CREATE BACKUP</Text>
                )}
              </Pressable>
              <View style={s.hairline} />
              <Pressable
                style={[s.controlDestructive, (deleteLoading || backupLoading) && s.controlDisabled]}
                onPress={handleDeleteAllData}
                disabled={deleteLoading || backupLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color={EddiesColors.alert} size="small" />
                ) : (
                  <>
                    <Text style={s.controlTextDestructive}>DELETE ALL DATA</Text>
                    <Text style={s.controlDestructiveHint}>Keeps name & join date</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* App Version */}
            <View style={[s.section, s.sectionLast]}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>APP</MonoLabel>
              <View style={s.versionRow}>
                <Text style={s.versionLabel}>Version</Text>
                <Text style={s.versionValue}>{APP_VERSION}</Text>
              </View>
            </View>
          </>
        )}
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
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.lg,
  },
  section: { gap: EddiesSpacing.sm },
  sectionNote: {
    fontSize: 11,
    lineHeight: 16,
    color: EddiesColors.steel,
    fontFamily: 'SpaceMono_400Regular',
    marginTop: EddiesSpacing.xs,
  },
  sectionLast: { paddingBottom: EddiesSpacing.xl },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface,
    borderRadius: 6,
  },
  controlActive: {},
  controlDisabled: { opacity: 0.6 },
  controlText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
  },
  controlValue: { fontWeight: '600' },
  controlHint: { color: EddiesColors.steel, fontSize: 10 },
  hairline: { height: 1, backgroundColor: EddiesColors.steel + '1A', marginVertical: EddiesSpacing.xs },
  controlDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    backgroundColor: EddiesColors.alert + '12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: EddiesColors.alert + '40',
  },
  controlTextDestructive: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.alert,
    fontWeight: '600',
  },
  controlDestructiveHint: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: EddiesColors.alert + '88',
  },
  dropdown: {
    marginTop: EddiesSpacing.xs,
    backgroundColor: EddiesColors.surface,
    borderRadius: 6,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
  },
  optionActive: { backgroundColor: EddiesColors.alert + '22' },
  optionText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
  },
  optionTextActive: { fontWeight: '600', color: EddiesColors.alert },
  segmentedControl: {
    flexDirection: 'row',
    gap: EddiesSpacing.xs,
    backgroundColor: EddiesColors.surface,
    padding: EddiesSpacing.xs,
    borderRadius: 6,
  },
  segment: {
    flex: 1,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: { backgroundColor: EddiesColors.alert, borderColor: EddiesColors.alert },
  segmentText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    fontWeight: '600',
    color: EddiesColors.steel,
  },
  segmentTextActive: { color: EddiesColors.bone },
  toggleGrid: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
  },
  toggleCell: {
    flex: 1,
    backgroundColor: EddiesColors.surface,
    borderRadius: 6,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    gap: EddiesSpacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
  },
  toggle: {
    width: 48,
    height: 28,
    backgroundColor: EddiesColors.surface,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: EddiesColors.alert + '22' },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: EddiesColors.steel,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    backgroundColor: EddiesColors.alert,
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
    fontWeight: '600',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface,
    borderRadius: 6,
  },
  versionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.steel,
  },
  versionValue: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
    fontWeight: '600',
  },
});
