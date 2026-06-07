import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { isBiometricAvailable, authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

export function BiometricSetup() {
  const db = useSQLiteContext();
  const setBiometricStatus = useStore((s) => s.setBiometricStatus);
  const setAppLocked = useStore((s) => s.setAppLocked);
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    const available = await isBiometricAvailable();
    if (!available) {
      await setSetting(db, 'biometric_lock_enabled', 'false');
      setBiometricStatus('disabled');
      setLoading(false);
      return;
    }
    const passed = await authenticate('Verify to enable app lock');
    if (passed) {
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
    <View style={s.overlay}>
      <View style={s.card}>
        <View style={s.iconRow}>
          <MonoLabel size={32} letterSpacing={0} color={EddiesColors.alert}>
            ⬡
          </MonoLabel>
        </View>

        <Text style={s.title}>SECURE YOUR DATA</Text>
        <View style={s.divider} />

        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel} style={s.body}>
          {'ENABLE BIOMETRIC LOCK TO PROTECT YOUR\nFINANCIAL DATA WITH FINGERPRINT OR PIN.'}
        </MonoLabel>

        <Pressable
          style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.btnPressed]}
          onPress={handleEnable}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={EddiesColors.ink} />
          ) : (
            <Text style={[s.btnLabel, { color: EddiesColors.ink }]}>ENABLE LOCK</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.btn, s.btnSecondary, pressed && s.btnPressed]}
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={[s.btnLabel, { color: EddiesColors.steel }]}>SKIP FOR NOW</Text>
        </Pressable>

        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'} style={s.hint}>
          YOU CAN ENABLE THIS LATER IN SETTINGS
        </MonoLabel>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: EddiesColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: '85%',
    borderWidth: 1,
    borderColor: EddiesColors.steel + '25',
    backgroundColor: EddiesColors.surface,
    padding: EddiesSpacing.xl,
    alignItems: 'center',
    gap: EddiesSpacing.md,
  },
  iconRow: {
    marginBottom: EddiesSpacing.xs,
  },
  title: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 28,
    color: EddiesColors.bone,
    letterSpacing: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: EddiesColors.alert + '60',
  },
  body: {
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: EddiesColors.alert,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: EddiesColors.steel + '30',
  },
  btnPressed: { opacity: 0.8 },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 14,
    letterSpacing: 3,
  },
  hint: {
    textAlign: 'center',
    marginTop: EddiesSpacing.xs,
  },
});
