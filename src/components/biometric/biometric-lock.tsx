import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

export function BiometricLock() {
  const setAppLocked = useStore((s) => s.setAppLocked);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function tryUnlock() {
    setLoading(true);
    setFailed(false);
    const passed = await authenticate('Verify to access Eddies');
    setLoading(false);
    if (passed) {
      setAppLocked(false);
    } else {
      setFailed(true);
    }
  }

  // Auto-trigger on mount
  useEffect(() => {
    tryUnlock();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.root}>
      {/* Blurred app preview */}
      <BlurView intensity={Platform.OS === 'android' ? 60 : 80} style={StyleSheet.absoluteFill} tint="dark" />
      <View style={[StyleSheet.absoluteFill, s.dimOverlay]} />

      {/* Lock card */}
      <View style={s.card}>
        <MonoLabel size={36} letterSpacing={0} color={EddiesColors.alert}>
          ◈
        </MonoLabel>
        <Text style={s.title}>EDDIES</Text>
        <View style={s.divider} />
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
          APP LOCKED
        </MonoLabel>

        {failed && (
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'CC'}>
            ▲ VERIFICATION FAILED — TRY AGAIN
          </MonoLabel>
        )}

        <Pressable
          style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          onPress={tryUnlock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={EddiesColors.ink} />
          ) : (
            <Text style={s.btnLabel}>UNLOCK</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  dimOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '78%',
    borderWidth: 1,
    borderColor: EddiesColors.steel + '30',
    backgroundColor: EddiesColors.ink + 'EE',
    padding: EddiesSpacing.xl,
    alignItems: 'center',
    gap: EddiesSpacing.md,
  },
  title: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 42,
    color: EddiesColors.bone,
    letterSpacing: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: EddiesColors.alert + '50',
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EddiesColors.alert,
    marginTop: EddiesSpacing.xs,
  },
  btnPressed: { opacity: 0.82 },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 15,
    color: EddiesColors.ink,
    letterSpacing: 4,
  },
});
