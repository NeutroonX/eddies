import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

function CornerBrackets({ color }: { color: string }) {
  const size = 18;
  const corners = ['tl', 'tr', 'bl', 'br'] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners.map((c) => {
        const top  = c[0] === 't';
        const left = c[1] === 'l';
        const pad  = 20;
        return (
          <View key={c} style={[{ position: 'absolute' }, top ? { top: pad } : { bottom: pad }, left ? { left: pad } : { right: pad }]}>
            <View style={{ position: 'absolute', width: size, height: 1, backgroundColor: color, ...(top ? { top: 0 } : { bottom: 0 }), ...(left ? { left: 0 } : { right: 0 }) }} />
            <View style={{ position: 'absolute', width: 1, height: size, backgroundColor: color, ...(top ? { top: 0 } : { bottom: 0 }), ...(left ? { left: 0 } : { right: 0 }) }} />
          </View>
        );
      })}
    </View>
  );
}

export function BiometricLock() {
  const setAppLocked = useStore((s) => s.setAppLocked);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed]   = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function tryUnlock() {
    setLoading(true);
    setFailed(false);
    const passed = await authenticate('Verify to access Eddies');
    setLoading(false);
    if (passed) {
      setAppLocked(false);
    } else {
      setFailed(true);
      setAttempts((a) => a + 1);
    }
  }

  useEffect(() => {
    tryUnlock();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.root}>
      {/* Blurred app preview underneath */}
      <BlurView
        intensity={Platform.OS === 'android' ? 80 : 100}
        style={StyleSheet.absoluteFill}
        tint="dark"
      />
      <View style={[StyleSheet.absoluteFill, s.scrim]} />

      <CornerBrackets color={EddiesColors.steel + '40'} />

      {/* Top status bar */}
      <View style={s.topBar}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel + '80'}>
          SEC-LOCK // EDDIES
        </MonoLabel>
        <View style={s.statusRow}>
          <View style={s.statusDot} />
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + '99'}>
            LOCKED
          </MonoLabel>
        </View>
      </View>

      {/* Center lock UI */}
      <View style={s.center}>

        {/* Lock icon */}
        <View style={s.iconWrap}>
          <View style={s.iconRing}>
            <Image source={require('@/assets/images/logo_no_bg.png')} style={s.logo} resizeMode="contain" />
          </View>
          <MonoLabel size={7} letterSpacing={3} color={EddiesColors.steel + '55'} style={{ marginTop: EddiesSpacing.sm }}>
            {loading ? 'READING...' : failed ? 'RETRY' : 'TOUCH SENSOR'}
          </MonoLabel>
        </View>

        {/* Brand */}
        <Text style={s.brand}>EDDIES</Text>
        <View style={s.accentLine} />
        <MonoLabel size={9} letterSpacing={4} color={EddiesColors.steel + 'AA'}>
          AUTHENTICATION REQUIRED
        </MonoLabel>

        {/* Failure message */}
        {failed && (
          <View style={s.errorRow}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'CC'}>
              {`▲ VERIFICATION FAILED${attempts > 1 ? ` (${attempts}×)` : ''} — TRY AGAIN`}
            </MonoLabel>
          </View>
        )}

        {/* Unlock button */}
        <Pressable
          style={({ pressed }) => [s.btn, failed && s.btnFailed, pressed && s.btnPressed]}
          onPress={tryUnlock}
          disabled={loading}
        >
          {loading ? (
            <View style={s.btnInner}>
              <ActivityIndicator size="small" color={EddiesColors.bone + '99'} />
              <Text style={s.btnLabel}>VERIFYING</Text>
            </View>
          ) : (
            <Text style={s.btnLabel}>{failed ? 'TRY AGAIN' : 'UNLOCK'}</Text>
          )}
        </Pressable>
      </View>

      {/* Bottom hint */}
      <View style={s.bottomBar}>
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '40'}>
          FINGERPRINT · FACE · PIN ACCEPTED
        </MonoLabel>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: 52,
    paddingBottom: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '15',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.xs,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: EddiesColors.alert,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.lg,
    gap: EddiesSpacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: EddiesSpacing.sm,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: EddiesColors.alert + '50',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EddiesColors.surface,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brand: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 56,
    color: EddiesColors.bone,
    letterSpacing: 10,
  },
  accentLine: {
    width: '60%',
    height: 1,
    backgroundColor: EddiesColors.alert + '70',
  },
  errorRow: {
    borderLeftWidth: 2,
    borderLeftColor: EddiesColors.alert,
    paddingLeft: EddiesSpacing.sm,
  },
  btn: {
    width: '100%',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: EddiesColors.steel + '35',
    marginTop: EddiesSpacing.sm,
  },
  btnFailed: {
    borderColor: EddiesColors.alert + '60',
  },
  btnPressed: { opacity: 0.75 },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 16,
    color: EddiesColors.bone,
    letterSpacing: 5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 36,
    paddingTop: EddiesSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '15',
  },
});
