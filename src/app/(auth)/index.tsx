import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { validateInviteCode } from '@/lib/invite';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { useStore } from '@/store';

const PROMPT = 'validating access credentials...';
const CHAR_DELAY = 42;
const PROMPT_START_DELAY = 600;

// ── Blinking cursor ────────────────────────────────────────────────────────
function BlinkingCursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);
  return on ? (
    <MonoLabel size={11} letterSpacing={0} color={EddiesColors.alert}>▌</MonoLabel>
  ) : null;
}

// ── Typewriter prompt ──────────────────────────────────────────────────────
function TypewriterPrompt() {
  const [displayed, setDisplayed] = useState(0);
  const [started, setStarted] = useState(false);
  const done = started && displayed >= PROMPT.length;

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), PROMPT_START_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started || done) return;
    const t = setTimeout(() => setDisplayed(d => d + 1), CHAR_DELAY);
    return () => clearTimeout(t);
  }, [started, displayed, done]);

  return (
    <View style={tp.row}>
      <MonoLabel size={10} letterSpacing={1} color={EddiesColors.steel}>{'> '}</MonoLabel>
      <MonoLabel size={10} letterSpacing={0.5} color={EddiesColors.bone + 'BB'}>
        {PROMPT.slice(0, displayed)}
      </MonoLabel>
      {done && <BlinkingCursor />}
    </View>
  );
}
const tp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

// ── Unified invite input + validate button ─────────────────────────────────
function InviteInput({ value, onChangeText, onSubmit, loading }: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const disabled = loading || !value.trim();

  return (
    <View style={[ii.wrap, focused && ii.wrapFocused]}>
      <View style={ii.accent} />
      <TextInput
        style={ii.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={32}
        autoCapitalize="characters"
        returnKeyType="go"
        editable={!loading}
        placeholder="XXXX-YYYY-ZZZZ"
        placeholderTextColor={EddiesColors.steel + '35'}
        autoCorrect={false}
        spellCheck={false}
      />
      <View style={ii.divider} />
      <Pressable
        style={({ pressed }) => [
          ii.btn,
          pressed && !disabled && ii.btnPressed,
          disabled && ii.btnDisabled,
        ]}
        onPress={disabled ? undefined : onSubmit}
        accessibilityRole="button"
        accessibilityLabel="Validate invite code"
        accessibilityState={{ disabled }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={EddiesColors.alert} />
        ) : (
          <View style={ii.btnInner}>
            <Text style={[ii.btnLabel, disabled && ii.btnLabelDim]}>VALIDATE</Text>
            <MonoLabel
              size={15}
              letterSpacing={0}
              color={disabled ? EddiesColors.steel + '55' : EddiesColors.alert}
            >
              ›
            </MonoLabel>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const ii = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: EddiesColors.steel + '30',
    backgroundColor: EddiesColors.surface,
    overflow: 'hidden',
  },
  wrapFocused: {
    borderColor: EddiesColors.alert + '70',
  },
  accent: {
    width: 2,
    backgroundColor: EddiesColors.alert,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    paddingLeft: EddiesSpacing.md,
    paddingRight: EddiesSpacing.sm,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    color: EddiesColors.bone,
    letterSpacing: 2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: EddiesColors.steel + '25',
    marginVertical: 12,
  },
  btn: {
    width: 116,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EddiesSpacing.md,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.xs,
  },
  btnPressed: {
    backgroundColor: EddiesColors.alert + '10',
  },
  btnDisabled: {
    opacity: 0.38,
  },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 15,
    color: EddiesColors.bone,
    letterSpacing: 3,
  },
  btnLabelDim: {
    color: EddiesColors.steel,
  },
});

// ── Corner brackets (full screen frame) ────────────────────────────────────
function CornerBrackets() {
  const size = 14;
  const color = EddiesColors.steel + '30';
  const corners = (['tl', 'tr', 'bl', 'br'] as const);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners.map(c => {
        const top  = c[0] === 't';
        const left = c[1] === 'l';
        return (
          <View
            key={c}
            style={[
              { position: 'absolute' },
              top  ? { top: 0 }    : { bottom: 0 },
              left ? { left: 0 }   : { right: 0 },
            ]}
          >
            <View style={{
              position: 'absolute',
              width: size, height: 1,
              backgroundColor: color,
              ...(top  ? { top: 0 }    : { bottom: 0 }),
              ...(left ? { left: 0 }   : { right: 0 }),
            }} />
            <View style={{
              position: 'absolute',
              width: 1, height: size,
              backgroundColor: color,
              ...(top  ? { top: 0 }    : { bottom: 0 }),
              ...(left ? { left: 0 }   : { right: 0 }),
            }} />
          </View>
        );
      })}
    </View>
  );
}

// ── Root screen ────────────────────────────────────────────────────────────
export default function InviteScreen() {
  const db = useSQLiteContext();
  const setInviteValidated = useStore((s) => s.setInviteValidated);

  const contentOpacity = useSharedValue(0);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 500 });
  }, [contentOpacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  async function handleValidate() {
    if (!code.trim()) return;
    setLoading(true);
    setAuthError(null);
    const { granted, error } = await validateInviteCode(code);
    setLoading(false);
    if (!granted) {
      setAuthError(error);
      return;
    }
    try {
      await setSetting(db, 'invite_validated', 'true');
    } catch {
      setAuthError('FAILED TO SAVE — TRY AGAIN');
      return;
    }
    setInviteValidated(true);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>

      {/* Top bar */}
      <View style={s.topBar}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
          INVITE-SYS // EDDIES
        </MonoLabel>
        <View style={s.statusRow}>
          <View style={s.statusDot} />
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + '99'}>
            SECURE
          </MonoLabel>
        </View>
      </View>

      {/* Content */}
      <Animated.View style={[s.content, fadeStyle]}>

        {/* Brand block */}
        <View>
          <Text style={s.brandTitle}>EDDIES</Text>
          <View style={s.accentLine} />
          <MonoLabel size={9} letterSpacing={3} color={EddiesColors.steel + 'AA'}>
            PERSONAL FINANCE · TERMINAL
          </MonoLabel>
        </View>

        {/* Typewriter */}
        <TypewriterPrompt />

        {/* Invite code section */}
        <View style={s.authSection}>
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <MonoLabel size={8} letterSpacing={3} color={EddiesColors.steel + '50'}>
              ENTER INVITE CODE
            </MonoLabel>
            <View style={s.dividerLine} />
          </View>

          <InviteInput
            value={code}
            onChangeText={(t) => { setCode(t); setAuthError(null); }}
            onSubmit={handleValidate}
            loading={loading}
          />

          {authError !== null && (
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + 'CC'}>
              ▲  {authError}
            </MonoLabel>
          )}
        </View>

        {/* Footnote */}
        <View style={s.footnote}>
          <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'}>
            ▲  NO CODE? EMAIL kranthicodes4@gmail.com TO REQUEST ACCESS
          </MonoLabel>
        </View>

      </Animated.View>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'}>
          SYS-REV: 1.0.0
        </MonoLabel>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: EddiesColors.steel + '55' }]} />
          <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '55'}>
            ENCRYPTED
          </MonoLabel>
        </View>
      </View>

      <CornerBrackets />

    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
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
  content: {
    flex: 1,
    paddingHorizontal: EddiesSpacing.md,
    justifyContent: 'center',
    gap: EddiesSpacing.lg,
  },
  brandTitle: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 68,
    color: EddiesColors.bone,
    letterSpacing: 6,
    lineHeight: 72,
  },
  accentLine: {
    height: 1,
    backgroundColor: EddiesColors.alert + '99',
    marginVertical: EddiesSpacing.sm,
  },
  authSection: {
    gap: EddiesSpacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + '18',
  },
  footnote: {
    alignItems: 'center',
  },
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
