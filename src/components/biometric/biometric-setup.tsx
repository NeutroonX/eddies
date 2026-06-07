import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/mono-label';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { isBiometricAvailable, authenticate } from '@/lib/biometric';
import { useStore } from '@/store';

function CornerBrackets() {
  const size = 14;
  const color = EddiesColors.steel + '30';
  const corners = ['tl', 'tr', 'bl', 'br'] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners.map((c) => {
        const top  = c[0] === 't';
        const left = c[1] === 'l';
        return (
          <View key={c} style={[{ position: 'absolute' }, top ? { top: 0 } : { bottom: 0 }, left ? { left: 0 } : { right: 0 }]}>
            <View style={{ position: 'absolute', width: size, height: 1, backgroundColor: color, ...(top ? { top: 0 } : { bottom: 0 }), ...(left ? { left: 0 } : { right: 0 }) }} />
            <View style={{ position: 'absolute', width: 1, height: size, backgroundColor: color, ...(top ? { top: 0 } : { bottom: 0 }), ...(left ? { left: 0 } : { right: 0 }) }} />
          </View>
        );
      })}
    </View>
  );
}

function ScanLine() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => (v + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  const dots = '.'.repeat(tick);
  return (
    <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel + '88'}>
      {`SCANNING BIOMETRIC HARDWARE${dots}`}
    </MonoLabel>
  );
}

export function BiometricSetup() {
  const db = useSQLiteContext();
  const setBiometricStatus = useStore((s) => s.setBiometricStatus);
  const setAppLocked       = useStore((s) => s.setAppLocked);
  const [loading, setLoading]   = useState(false);
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
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>
      <CornerBrackets />

      {/* Top bar */}
      <View style={s.topBar}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
          SEC-INIT // EDDIES
        </MonoLabel>
        <View style={s.statusRow}>
          <View style={s.statusDot} />
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + '99'}>
            SETUP
          </MonoLabel>
        </View>
      </View>

      {/* Content */}
      <View style={s.body}>

        {/* Icon block */}
        <View style={s.iconBlock}>
          <View style={s.iconFrame}>
            <Image source={require('@/assets/images/logo_no_bg.png')} style={s.logo} resizeMode="contain" />
          </View>
          <View style={s.iconLineH} />
          <View style={s.iconLineV} />
        </View>

        {/* Title */}
        <View style={s.titleBlock}>
          <Text style={s.title}>SECURE{'\n'}YOUR DATA</Text>
          <View style={s.accentLine} />
          <MonoLabel size={9} letterSpacing={3} color={EddiesColors.steel + 'AA'}>
            BIOMETRIC LOCK · ANDROID
          </MonoLabel>
        </View>

        {/* Info rows */}
        <View style={s.infoBlock}>
          <ScanLine />
          <View style={s.infoRow}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'BB'}>▸</MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + 'CC'}>
              FINGERPRINT · FACE · PIN SUPPORTED
            </MonoLabel>
          </View>
          <View style={s.infoRow}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'BB'}>▸</MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + 'CC'}>
              BALANCES HIDDEN WHEN LOCKED
            </MonoLabel>
          </View>
          <View style={s.infoRow}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'BB'}>▸</MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + 'CC'}>
              CAN BE CHANGED IN SETTINGS
            </MonoLabel>
          </View>
        </View>

        {noHardware && (
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'CC'}>
            ▲ NO BIOMETRIC HARDWARE ENROLLED
          </MonoLabel>
        )}

        {/* Actions */}
        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [s.btnPrimary, pressed && s.btnPressed]}
            onPress={handleEnable}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={EddiesColors.ink} />
            ) : (
              <Text style={s.btnPrimaryLabel}>ENABLE LOCK</Text>
            )}
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <MonoLabel size={7} letterSpacing={2} color={EddiesColors.steel + '55'}>OR</MonoLabel>
            <View style={s.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [s.btnSecondary, pressed && s.btnPressed]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={s.btnSecondaryLabel}>SKIP FOR NOW</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'}>
          SEC-SYS: 1.0.0
        </MonoLabel>
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'}>
          LOCAL · NO CLOUD
        </MonoLabel>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '18',
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
  body: {
    flex: 1,
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.xxl,
    gap: EddiesSpacing.xl,
    justifyContent: 'center',
  },
  iconBlock: {
    alignItems: 'center',
    position: 'relative',
  },
  iconFrame: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: EddiesColors.alert + '40',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EddiesColors.surface,
  },
  logo: {
    width: 48,
    height: 48,
  },
  iconLineH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: EddiesColors.alert + '15',
  },
  iconLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: EddiesColors.alert + '15',
  },
  titleBlock: {
    gap: EddiesSpacing.sm,
  },
  title: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 52,
    color: EddiesColors.bone,
    letterSpacing: 4,
    lineHeight: 56,
  },
  accentLine: {
    height: 1,
    backgroundColor: EddiesColors.alert + '99',
    marginVertical: EddiesSpacing.xs,
  },
  infoBlock: {
    gap: EddiesSpacing.sm,
    paddingLeft: EddiesSpacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: EddiesColors.steel + '20',
  },
  infoRow: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    alignItems: 'center',
  },
  actions: {
    gap: EddiesSpacing.sm,
  },
  btnPrimary: {
    backgroundColor: EddiesColors.alert,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 16,
    color: EddiesColors.ink,
    letterSpacing: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + '18',
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: EddiesColors.steel + '25',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 14,
    color: EddiesColors.steel,
    letterSpacing: 3,
  },
  btnPressed: { opacity: 0.75 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '18',
  },
});
