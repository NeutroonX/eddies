import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { isBiometricAvailable, authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

export function BiometricSetup() {
  const db                         = useSQLiteContext();
  const setBiometricStatus         = useStore((s) => s.setBiometricStatus);
  const setAppLocked               = useStore((s) => s.setAppLocked);
  const [loading, setLoading]      = useState(false);
  const [noHardware, setNoHardware] = useState(false);

  async function handleEnable() {
    setLoading(true);
    const available = await isBiometricAvailable();
    if (!available) {
      setNoHardware(true);
      await setSetting(db, 'biometric_lock_enabled', 'false');
      setBiometricStatus('disabled');
      setLoading(false);
      return;
    }
    const result = await authenticate('Verify to enable app lock');
    if (result.success) {
      await setSetting(db, 'biometric_lock_enabled', 'true');
      setBiometricStatus('enabled');
      setAppLocked(false);
    }
    setLoading(false);
  }

  async function handleSkip() {
    await setSetting(db, 'biometric_lock_enabled', 'false');
    setBiometricStatus('disabled');
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>

      <View style={s.center}>
        <Text style={s.brand}>EDDIES</Text>
        <View style={s.accentLine} />
        <MonoLabel size={9} letterSpacing={3} color={EddiesColors.steel}>
          ENABLE APP LOCK
        </MonoLabel>

        <View style={s.infoBlock}>
          {(['FINGERPRINT · FACE · PIN SUPPORTED', 'BALANCES HIDDEN WHEN LOCKED', 'TOGGLE ANYTIME IN SETTINGS'] as const).map((line) => (
            <View key={line} style={s.infoRow}>
              <MonoLabel size={8} letterSpacing={0} color={EddiesColors.alert + '99'}>—</MonoLabel>
              <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + 'AA'}>{line}</MonoLabel>
            </View>
          ))}
        </View>

        {noHardware && (
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'CC'}>
            ▲ NO BIOMETRIC HARDWARE ENROLLED
          </MonoLabel>
        )}

        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [s.btnPrimary, pressed && s.btnPressed]}
            onPress={handleEnable}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Enable biometric app lock"
          >
            {loading
              ? <ActivityIndicator size="small" color={EddiesColors.ink} />
              : <Text style={s.btnPrimaryLabel}>ENABLE LOCK</Text>
            }
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.btnSecondary, pressed && s.btnPressed]}
            onPress={handleSkip}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Skip app lock setup"
          >
            <Text style={s.btnSecondaryLabel}>SKIP FOR NOW</Text>
          </Pressable>
        </View>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: EddiesColors.ink,
    zIndex: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    gap: EddiesSpacing.xl,
  },
  brand: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 64,
    color: EddiesColors.bone,
    letterSpacing: 12,
  },
  accentLine: {
    width: 48,
    height: 1,
    backgroundColor: EddiesColors.alert,
  },
  infoBlock: {
    gap: EddiesSpacing.sm,
    alignSelf: 'stretch',
  },
  infoRow: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    alignItems: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: EddiesSpacing.sm,
  },
  btnPrimary: {
    backgroundColor: EddiesColors.alert,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 15,
    color: EddiesColors.ink,
    letterSpacing: 4,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: EddiesColors.steel + '25',
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 13,
    color: EddiesColors.steel,
    letterSpacing: 3,
  },
  btnPressed: { opacity: 0.7 },
});
