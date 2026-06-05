import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Keyboard, ActivityIndicator } from 'react-native';
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
import { createBackup } from '@/lib/backup';

const APP_VERSION = '1.0.0';

export default function SettingsModal() {
  const db = useSQLiteContext();
  const { currency, firstDayOfWeek, hapticsEnabled, setCurrency, setFirstDayOfWeek, setHapticsEnabled, showToast } = useStore();

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedCurrency = await getSetting(db, 'currency', 'USD');
        const savedDayOfWeek = await getSetting(db, 'first_day_of_week', '1');
        const savedHaptics = await getSetting(db, 'haptics_enabled', 'true');
        setCurrency(savedCurrency!);
        setFirstDayOfWeek(parseInt(savedDayOfWeek!, 10));
        setHapticsEnabled(savedHaptics === 'true');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [db, setCurrency, setFirstDayOfWeek, setHapticsEnabled]);

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

  async function handleCreateBackup() {
    try {
      setBackupLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await createBackup(db);
      showToast('Backup created');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Backup creation error:', err);
      showToast('Backup failed', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreBackup() {
    showToast('Restore coming soon');
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

            {/* Haptics */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>HAPTICS</MonoLabel>
              <View style={s.toggleRow}>
                <Pressable
                  style={[s.toggle, hapticsEnabled && s.toggleActive]}
                  onPress={() => handleHapticsChange(!hapticsEnabled)}
                >
                  <View style={[s.toggleThumb, hapticsEnabled && s.toggleThumbActive]} />
                </Pressable>
                <Text style={s.toggleLabel}>{hapticsEnabled ? 'ENABLED' : 'DISABLED'}</Text>
              </View>
            </View>

            {/* Theme Lock */}
            <View style={s.section}>
              <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>THEME</MonoLabel>
              <View style={[s.control, s.controlDisabled]}>
                <Text style={[s.controlText, s.controlValue]}>Dark only</Text>
                <Text style={[s.controlText, s.controlHint]}>🔒</Text>
              </View>
              <Text style={s.sectionNote}>EDDIES is dark-only by design. Light mode is not supported.</Text>
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
              <Pressable
                style={[s.control, backupLoading && s.controlDisabled]}
                onPress={handleRestoreBackup}
                disabled={backupLoading}
              >
                <Text style={s.controlText}>RESTORE FROM BACKUP</Text>
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
