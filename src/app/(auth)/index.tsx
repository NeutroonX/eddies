import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MonoLabel } from "@/components/ui/mono-label";
import { EddiesColors, EddiesFonts, EddiesSpacing } from "@/constants/theme";
import { validateInviteCode, requestAccess } from "@/lib/invite";
import { setSetting } from "@/lib/db/repos/settings-repo";
import { useStore } from "@/store";

const PROMPT = "validating access credentials...";
const CHAR_DELAY = 42;
const PROMPT_START_DELAY = 600;

// ── Blinking cursor ────────────────────────────────────────────────────────
function BlinkingCursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);
  return on ? (
    <MonoLabel size={11} letterSpacing={0} color={EddiesColors.alert}>
      ▌
    </MonoLabel>
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
    const t = setTimeout(() => setDisplayed((d) => d + 1), CHAR_DELAY);
    return () => clearTimeout(t);
  }, [started, displayed, done]);

  return (
    <View style={tp.row}>
      <MonoLabel size={10} letterSpacing={1} color={EddiesColors.steel}>
        {"> "}
      </MonoLabel>
      <MonoLabel size={10} letterSpacing={0.5} color={EddiesColors.bone + "BB"}>
        {PROMPT.slice(0, displayed)}
      </MonoLabel>
      {done && <BlinkingCursor />}
    </View>
  );
}
const tp = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});

// ── Auto-format invite code: XXXX-YYYY-ZZZZ ───────────────────────────────
function formatCode(raw: string): string {
  const clean = raw
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 12);
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
}

// ── Unified invite input + validate button ─────────────────────────────────
function InviteInput({
  value,
  onChangeText,
  onSubmit,
  loading,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const isComplete = value.replace(/[^A-Z0-9]/gi, "").length >= 12;

  return (
    <View style={ii.wrap}>
      <View style={ii.fieldHeader}>
        <View style={ii.fieldTag}><Text style={ii.fieldTagText}>INVITE CODE</Text></View>
        <View style={ii.fieldRule} />
      </View>
      <TextInput
        style={ii.input}
        value={value}
        onChangeText={(raw) => onChangeText(formatCode(raw))}
        onSubmitEditing={onSubmit}
        maxLength={14}
        autoCapitalize="characters"
        returnKeyType="go"
        editable={!loading}
        placeholder="XXXX-YYYY-ZZZZ"
        placeholderTextColor={EddiesColors.steel + "40"}
        autoCorrect={false}
        spellCheck={false}
      />
      <Pressable
        style={({ pressed }) => [ii.btn, pressed && ii.btnPressed]}
        onPress={onSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Validate invite code"
      >
        {loading ? (
          <ActivityIndicator size="small" color={isComplete ? EddiesColors.alert : EddiesColors.steel} />
        ) : (
          <>
            <View style={[ii.rule, isComplete && ii.ruleReady]} />
            <Text style={[ii.btnLabel, !isComplete && ii.btnLabelIdle]}>V A L I D A T E</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const ii = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  fieldTag: {
    backgroundColor: EddiesColors.alert + "18",
    borderWidth: 1,
    borderColor: EddiesColors.alert + "55",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fieldTagText: {
    fontFamily: EddiesFonts.mono,
    fontSize: 8,
    color: EddiesColors.alert + "BB",
    letterSpacing: 1,
  },
  fieldRule: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + "25",
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 2,
    fontFamily: "SpaceMono_400Regular",
    fontSize: 14,
    color: EddiesColors.bone,
    letterSpacing: 3,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: EddiesSpacing.sm,
    paddingVertical: 4,
  },
  btnPressed: { opacity: 0.6 },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 11,
    color: EddiesColors.alert,
  },
  btnLabelIdle: {
    color: EddiesColors.steel + "70",
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + "28",
  },
  ruleReady: {
    backgroundColor: EddiesColors.alert + "55",
  },
});

// ── Request access form ────────────────────────────────────────────────────
function AccessRequest() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleRequest() {
    if (status === "sending" || status === "sent") return;
    setErrMsg(null);
    setStatus("sending");
    const { ok, error } = await requestAccess(email);
    if (!ok) {
      setErrMsg(error);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <View style={ar.sentWrap}>
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + "CC"}>
          ▲ REQUEST SENT — WE&apos;LL EMAIL YOUR CODE
        </MonoLabel>
      </View>
    );
  }

  return (
    <View style={ar.wrap}>
      <View style={ar.fieldHeader}>
        <View style={ar.fieldTag}>
          <Text style={ar.fieldTagText}>EMAIL</Text>
        </View>
        <View style={ar.fieldRule} />
      </View>
      <TextInput
        style={ar.input}
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setErrMsg(null);
          setStatus("idle");
        }}
        onSubmitEditing={handleRequest}
        placeholder="your@email.com"
        placeholderTextColor={EddiesColors.steel + "40"}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        editable={status !== "sending"}
      />
      <Pressable
        style={({ pressed }) => [ar.btn, pressed && ar.btnPressed]}
        onPress={handleRequest}
        accessibilityRole="button"
        accessibilityLabel="Request beta access"
      >
        {status === "sending" ? (
          <ActivityIndicator size="small" color={email.includes("@") ? EddiesColors.alert : EddiesColors.steel} />
        ) : (
          <>
            <View style={[ar.rule, email.includes("@") && ar.ruleReady]} />
            <Text style={[ar.btnLabel, email.includes("@") && ar.btnLabelReady]}>R E Q U E S T  A C C E S S</Text>
          </>
        )}
      </Pressable>
      {errMsg !== null && (
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.alert + "BB"}>
          ▲ {errMsg}
        </MonoLabel>
      )}
    </View>
  );
}

const ar = StyleSheet.create({
  wrap: { gap: 0 },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  fieldTag: {
    borderWidth: 1,
    borderColor: EddiesColors.steel + "35",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fieldTagText: {
    fontFamily: EddiesFonts.mono,
    fontSize: 8,
    color: EddiesColors.steel + "99",
    letterSpacing: 1,
  },
  fieldRule: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + "22",
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    fontFamily: "SpaceMono_400Regular",
    fontSize: 12,
    color: EddiesColors.bone + "CC",
    letterSpacing: 0.5,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: EddiesSpacing.sm,
    paddingVertical: 4,
  },
  btnPressed: { opacity: 0.6 },
  btnLabel: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 11,
    color: EddiesColors.steel + "AA",
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + "22",
  },
  ruleReady: {
    backgroundColor: EddiesColors.alert + "55",
  },
  btnLabelReady: {
    color: EddiesColors.alert,
  },
  sentWrap: { alignItems: "center", paddingVertical: EddiesSpacing.sm },
});

// ── Corner brackets (full screen frame) ────────────────────────────────────
function CornerBrackets() {
  const size = 14;
  const color = EddiesColors.steel + "30";
  const corners = ["tl", "tr", "bl", "br"] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners.map((c) => {
        const top = c[0] === "t";
        const left = c[1] === "l";
        return (
          <View
            key={c}
            style={[
              { position: "absolute" },
              top ? { top: 0 } : { bottom: 0 },
              left ? { left: 0 } : { right: 0 },
            ]}
          >
            <View
              style={{
                position: "absolute",
                width: size,
                height: 1,
                backgroundColor: color,
                ...(top ? { top: 0 } : { bottom: 0 }),
                ...(left ? { left: 0 } : { right: 0 }),
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 1,
                height: size,
                backgroundColor: color,
                ...(top ? { top: 0 } : { bottom: 0 }),
                ...(left ? { left: 0 } : { right: 0 }),
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

// ── Root screen ────────────────────────────────────────────────────────────
export default function InviteScreen() {
  const { height } = useWindowDimensions();
  const db = useSQLiteContext();
  const setInviteValidated = useStore((s) => s.setInviteValidated);

  const contentOpacity = useSharedValue(0);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 500 });
  }, [contentOpacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  async function handleValidate() {
    if (!code.trim() || cooldown) return;
    setLoading(true);
    setAuthError(null);
    const { granted, error } = await validateInviteCode(code);
    setLoading(false);
    if (!granted) {
      setAuthError(error);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2500);
      return;
    }
    try {
      await setSetting(db, "invite_validated", "true");
    } catch {
      setAuthError("FAILED TO SAVE — TRY AGAIN");
      return;
    }
    setInviteValidated(true);
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom", "left", "right"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
          INVITE-SYS // EDDIES
        </MonoLabel>
        <View style={s.statusRow}>
          <View style={s.statusDot} />
          <MonoLabel
            size={8}
            letterSpacing={1}
            color={EddiesColors.alert + "99"}
          >
            SECURE
          </MonoLabel>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: height * 0.22 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.content, fadeStyle]}>
          {/* Brand block */}
          <View>
            <Text style={s.brandTitle}>EDDIES</Text>
            <View style={s.accentLine} />
            <MonoLabel
              size={9}
              letterSpacing={3}
              color={EddiesColors.steel + "AA"}
            >
              PERSONAL FINANCE · TERMINAL
            </MonoLabel>
          </View>

          {/* Typewriter */}
          <TypewriterPrompt />

          {/* Invite code section */}
          <View style={s.authSection}>
            <InviteInput
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setAuthError(null);
              }}
              onSubmit={handleValidate}
              loading={loading || cooldown}
            />

            {authError !== null && (
              <MonoLabel
                size={8}
                letterSpacing={1}
                color={EddiesColors.alert + "CC"}
              >
                ▲ {authError}
              </MonoLabel>
            )}
          </View>

          {/* Request access */}
          <AccessRequest />
        </Animated.View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + "55"}>
          SYS-REV: 1.0.0
        </MonoLabel>
        <View style={s.statusRow}>
          <View
            style={[
              s.statusDot,
              { backgroundColor: EddiesColors.steel + "55" },
            ]}
          />
          <MonoLabel
            size={7}
            letterSpacing={1}
            color={EddiesColors.steel + "55"}
          >
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + "18",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: EddiesSpacing.xs,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: EddiesColors.alert,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.xl,
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
    backgroundColor: EddiesColors.alert + "99",
    marginVertical: EddiesSpacing.sm,
  },
  authSection: {
    gap: EddiesSpacing.md,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + "18",
  },
});
