import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

export function BiometricLock() {
  const setAppLocked              = useStore((s) => s.setAppLocked);
  const [loading, setLoading]     = useState(false);
  const [failed, setFailed]       = useState(false);
  const [attempts, setAttempts]   = useState(0);

  async function tryUnlock() {
    setLoading(true);
    setFailed(false);
    const result = await authenticate('Verify to access Eddies');
    setLoading(false);
    if (result.success) {
      setAppLocked(false);
    } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      setFailed(true);
      setAttempts((a) => a + 1);
    }
    // user_cancel / system_cancel: stay on lock screen silently, no error state
  }

  useEffect(() => {
    tryUnlock();
  // runs once on mount to trigger the immediate auth prompt on app open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = loading ? 'VERIFYING...' : failed ? `FAILED${attempts > 1 ? ` (${attempts}×)` : ''} — TRY AGAIN` : 'AUTHENTICATE TO UNLOCK';

  return (
    <View style={s.root}>
      <BlurView intensity={Platform.OS === 'android' ? 80 : 100} style={StyleSheet.absoluteFill} tint="dark" />
      <View style={[StyleSheet.absoluteFill, s.scrim]} />

      <View style={s.center}>
        <Text style={s.brand}>EDDIES</Text>
        <View style={s.accentLine} />

        <View style={s.statusRow}>
          {loading
            ? <ActivityIndicator size="small" color={EddiesColors.steel} />
            : <View style={[s.dot, failed && s.dotFailed]} />
          }
          <MonoLabel size={9} letterSpacing={2} color={failed ? EddiesColors.alert + 'CC' : EddiesColors.steel}>
            {statusLabel}
          </MonoLabel>
        </View>

        <Pressable
          style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          onPress={tryUnlock}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={failed ? 'Try biometric unlock again' : 'Unlock with biometrics'}
        >
          <Text style={s.btnLabel}>{failed ? 'TRY AGAIN' : 'UNLOCK'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    gap: EddiesSpacing.lg,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: EddiesColors.steel,
  },
  dotFailed: {
    backgroundColor: EddiesColors.alert,
  },
  btn: {
    marginTop: EddiesSpacing.xs,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '30',
    paddingVertical: 14,
    paddingHorizontal: EddiesSpacing.xxl,
  },
  btnPressed: { opacity: 0.7 },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 14,
    color: EddiesColors.bone,
    letterSpacing: 5,
  },
});
