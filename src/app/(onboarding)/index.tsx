import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';

import { MonoLabel } from '@/components/ui/mono-label';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { useStore } from '@/store';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Corner brackets ────────────────────────────────────────────────────────
function CornerBrackets({ size = 20, color = EddiesColors.steel + '40' }: { size?: number; color?: string }) {
  const corners = (['tl', 'tr', 'bl', 'br'] as const).map((c) => {
    const isTop  = c[0] === 't';
    const isLeft = c[1] === 'l';
    const pos = [isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }];
    return (
      <View key={c} style={[cbr.corner, ...pos]}>
        <View style={[cbr.h, { width: size, backgroundColor: color }, ...pos]} />
        <View style={[cbr.v, { height: size, backgroundColor: color }, ...pos]} />
      </View>
    );
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners}
    </View>
  );
}
const cbr = StyleSheet.create({
  corner: { position: 'absolute', width: 24, height: 24 },
  h: { position: 'absolute', height: 1.5 },
  v: { position: 'absolute', width: 1.5 },
});

// ── Data badge ─────────────────────────────────────────────────────────────
function DataBadge({ lines }: { lines: string[] }) {
  return (
    <View style={dg.wrap}>
      <View style={dg.bar} />
      {lines.map((l, i) => (
        <MonoLabel key={i} size={7} letterSpacing={1} color={EddiesColors.bone + 'AA'}>{l}</MonoLabel>
      ))}
    </View>
  );
}
const dg = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: EddiesColors.alert + '55', padding: EddiesSpacing.sm, gap: 3 },
  bar:  { height: 2, backgroundColor: EddiesColors.alert, marginBottom: 3 },
});

// ── Floating feature badge (the orbiting card icons from the reference) ─────
type BadgeProps = {
  symbol: string;
  label: string;
  floatPhase: number;
  entranceDelay: number;
  style?: object;
};

function FloatingBadge({ symbol, label, floatPhase, entranceDelay, style }: BadgeProps) {
  const opacityRef = useRef(new Animated.Value(0));
  const enterYRef  = useRef(new Animated.Value(10));
  const floatYRef  = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityRef.current, { toValue: 1, duration: 500, delay: entranceDelay, useNativeDriver: true }),
      Animated.timing(enterYRef.current,  { toValue: 0, duration: 500, delay: entranceDelay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    const HALF = 2000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatYRef.current, { toValue: -6, duration: HALF, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(floatYRef.current, { toValue:  6, duration: HALF, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), floatPhase * HALF * 2);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);

  return (
    <Animated.View
      style={[fb.wrap, style, { opacity: opacityRef.current, transform: [{ translateY: Animated.add(enterYRef.current, floatYRef.current) }] }]}
      pointerEvents="none"
    >
      <Text style={fb.symbol}>{symbol}</Text>
      <MonoLabel size={7} letterSpacing={2} color={EddiesColors.steel + 'BB'}>{label}</MonoLabel>
    </Animated.View>
  );
}
const fb = StyleSheet.create({
  wrap: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: EddiesColors.alert + '55',
    backgroundColor: EddiesColors.alert + '08',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    minWidth: 60,
    alignItems: 'center',
  },
  symbol: { fontFamily: EddiesFonts.displayBold, fontSize: 18, color: EddiesColors.alert, lineHeight: 20 },
});

// ── Gear reticle (rotating ring at corner) ─────────────────────────────────
function GearRing({ delay = 0 }: { delay?: number }) {
  const rotateRef  = useRef(new Animated.Value(0));
  const opacityRef = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacityRef.current, { toValue: 0.5, duration: 800, delay, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(rotateRef.current, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const rot = rotateRef.current.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ opacity: opacityRef.current, transform: [{ rotate: rot }], width: 38, height: 38 }} pointerEvents="none">
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: EddiesColors.steel + '60' }} />
      <View style={{ position: 'absolute', top: 2,  left: 17, width: 4, height: 1,  backgroundColor: EddiesColors.steel + '80' }} />
      <View style={{ position: 'absolute', bottom: 2, left: 17, width: 4, height: 1,  backgroundColor: EddiesColors.steel + '80' }} />
      <View style={{ position: 'absolute', left: 2, top: 17, width: 1,  height: 4, backgroundColor: EddiesColors.steel + '80' }} />
      <View style={{ position: 'absolute', right: 2, top: 17, width: 1,  height: 4, backgroundColor: EddiesColors.steel + '80' }} />
    </Animated.View>
  );
}

// ── Red bar (single, slides in) ────────────────────────────────────────────
function AnimatedBar({ delay }: { delay: number }) {
  const txRef      = useRef(new Animated.Value(-36));
  const opacityRef = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityRef.current, { toValue: 1, duration: 200, delay, useNativeDriver: true }),
      Animated.timing(txRef.current,      { toValue: 0, duration: 280, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ width: 28, height: 3, backgroundColor: EddiesColors.alert, opacity: opacityRef.current, transform: [{ translateX: txRef.current }] }} />
  );
}

function RedBars({ count = 3, baseDelay = 300 }: { count?: number; baseDelay?: number }) {
  return (
    <View style={{ gap: 5 }} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => <AnimatedBar key={i} delay={baseDelay + i * 110} />)}
    </View>
  );
}

// ── Warning triangle icons (stacked column) ────────────────────────────────
function TriangleItem({ delay }: { delay: number }) {
  const opacityRef = useRef(new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacityRef.current, { toValue: 1, duration: 300, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: opacityRef.current }}>
      <MonoLabel size={9} letterSpacing={0} color={EddiesColors.alert + '80'}>△</MonoLabel>
    </Animated.View>
  );
}

function TriangleStack({ count = 3, baseDelay = 400 }: { count?: number; baseDelay?: number }) {
  return (
    <View style={{ gap: 4 }} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => <TriangleItem key={i} delay={baseDelay + i * 150} />)}
    </View>
  );
}

// ── Feature row (page 2) ──────────────────────────────────────────────────
function FeatureRow({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  const opacityRef = useRef(new Animated.Value(0));
  const tyRef      = useRef(new Animated.Value(14));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityRef.current, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.timing(tyRef.current,      { toValue: 0, duration: 450, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: opacityRef.current, transform: [{ translateY: tyRef.current }] }}>
      <View style={fr.row}>
        <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert + '88'}>{num}</MonoLabel>
        <View style={fr.right}>
          <Text style={fr.title}>{title}</Text>
          <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={{ lineHeight: 14 }}>{desc}</MonoLabel>
        </View>
      </View>
      <View style={fr.divider} />
    </Animated.View>
  );
}
const fr = StyleSheet.create({
  row:     { flexDirection: 'row', gap: EddiesSpacing.md, alignItems: 'center', paddingVertical: EddiesSpacing.md },
  right:   { flex: 1, gap: 3 },
  title:   { fontFamily: EddiesFonts.displayBold, fontSize: 36, color: EddiesColors.bone, letterSpacing: 3, lineHeight: 36 },
  divider: { height: 1, backgroundColor: EddiesColors.steel + '1A' },
});

// ── Shared top-bar style ───────────────────────────────────────────────────
const pg = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.sm,
  },
});

// ── PAGE 1 ─────────────────────────────────────────────────────────────────
function Page1({ height }: { height: number }) {
  const heroOpacityRef = useRef(new Animated.Value(0));
  const heroYRef       = useRef(new Animated.Value(28));
  const bodyOpacityRef = useRef(new Animated.Value(0));
  const btmOpacityRef  = useRef(new Animated.Value(0));
  const [subText, setSubText] = useState('');
  const FULL_SUB = 'FINANCIAL OS';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacityRef.current, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
      Animated.timing(heroYRef.current,       { toValue: 0, duration: 700, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    let tw: ReturnType<typeof setInterval>;
    const t = setTimeout(() => {
      let i = 0;
      tw = setInterval(() => {
        i++;
        setSubText(FULL_SUB.slice(0, i));
        if (i >= FULL_SUB.length) clearInterval(tw);
      }, 55);
    }, 700);

    Animated.timing(bodyOpacityRef.current, { toValue: 1, duration: 600, delay: 1400, useNativeDriver: true }).start();
    Animated.timing(btmOpacityRef.current,  { toValue: 1, duration: 500, delay: 1900, useNativeDriver: true }).start();

    return () => { clearTimeout(t); clearInterval(tw); };
  }, []);

  return (
    <View style={{ width: SCREEN_W, height, backgroundColor: EddiesColors.ink }}>
      <CornerBrackets />

      {/* Floating feature badges — orbit the hero wordmark */}
      <FloatingBadge symbol="↑" label="INCOME" floatPhase={0}    entranceDelay={550}  style={{ top: height * 0.17, left: 14 }} />
      <FloatingBadge symbol="■" label="VAULTS" floatPhase={0.4}  entranceDelay={700}  style={{ top: height * 0.10, right: 18 }} />
      <FloatingBadge symbol="↓" label="SPEND"  floatPhase={0.75} entranceDelay={850}  style={{ top: height * 0.55, left: 14 }} />
      <FloatingBadge symbol="%" label="INTEL"  floatPhase={0.2}  entranceDelay={1000} style={{ top: height * 0.50, right: 18 }} />

      {/* Left accent stack */}
      <View style={{ position: 'absolute', left: 16, top: height * 0.70 }} pointerEvents="none">
        <TriangleStack count={3} baseDelay={600} />
      </View>

      {/* Top-right rotating reticle */}
      <View style={{ position: 'absolute', top: 52, right: 14 }} pointerEvents="none">
        <GearRing delay={100} />
      </View>

      {/* Main flex content */}
      <View style={{ flex: 1, paddingHorizontal: EddiesSpacing.md, paddingBottom: EddiesSpacing.md }}>
        <View style={pg.topBar}>
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>EDDIES // SECTOR-01</MonoLabel>
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '60'}>BOOT — 01</MonoLabel>
        </View>

        {/* Hero — centered */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ opacity: heroOpacityRef.current, transform: [{ translateY: heroYRef.current }], alignItems: 'center' }}>
            <Text style={p1.displayBig}>EDDIES</Text>
            <View style={p1.subRow}>
              <View style={p1.accentBar} />
              <Text style={p1.subText}>{subText}</Text>
              <View style={p1.accentBar} />
            </View>
          </Animated.View>
        </View>

        {/* Body copy */}
        <Animated.View style={[p1.body, { opacity: bodyOpacityRef.current }]}>
          <View style={p1.bodyInner}>
            <Text style={p1.headline}>COMMAND YOUR FINANCES.</Text>
            <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={{ lineHeight: 15 }}>
              {'LOG EVERY ENTRY. TRACK EVERY VAULT.\nANALYZE BURN RATE AND SPEND CAPS.'}
            </MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '60'}>
              ALL DATA STAYS ON-DEVICE — NO CLOUD.
            </MonoLabel>
          </View>
        </Animated.View>

        {/* Bottom row */}
        <Animated.View style={[p1.bottomRow, { opacity: btmOpacityRef.current }]}>
          <BarcodeMark height={18} style={{ flex: 1 }} />
          <DataBadge lines={['PERSONAL FINANCE', 'V1.0 // LOCAL']} />
        </Animated.View>
      </View>
    </View>
  );
}
const p1 = StyleSheet.create({
  displayBig: { fontFamily: EddiesFonts.displayBold, fontSize: 76, color: EddiesColors.bone, letterSpacing: 8, lineHeight: 76 },
  subRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  accentBar:  { width: 28, height: 1, backgroundColor: EddiesColors.alert },
  subText:    { fontFamily: EddiesFonts.mono, fontSize: 10, color: EddiesColors.steel, letterSpacing: 5 },
  body:       { gap: EddiesSpacing.sm },
  bodyInner:  { gap: EddiesSpacing.sm, paddingTop: EddiesSpacing.sm },
  headline:   { fontFamily: EddiesFonts.displayBold, fontSize: 18, color: EddiesColors.bone, letterSpacing: 3 },
  bottomRow:  { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.md, marginTop: EddiesSpacing.md },
});

// ── PAGE 2 ─────────────────────────────────────────────────────────────────
function Page2({ height, onDeploy }: { height: number; onDeploy: () => void }) {
  const ctaOpacityRef = useRef(new Animated.Value(0));
  const ctaYRef       = useRef(new Animated.Value(16));

  useEffect(() => {
    const out = Easing.out(Easing.quad);
    Animated.timing(ctaOpacityRef.current, { toValue: 1, duration: 500, delay: 1050, useNativeDriver: true }).start();
    Animated.timing(ctaYRef.current,       { toValue: 0, duration: 500, delay: 1050, easing: out, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ width: SCREEN_W, height, backgroundColor: EddiesColors.ink }}>
      <CornerBrackets />

      <View style={{ position: 'absolute', right: 16, top: height * 0.68 }} pointerEvents="none">
        <TriangleStack count={3} baseDelay={350} />
      </View>
      <View style={{ position: 'absolute', top: 52, left: 14 }} pointerEvents="none">
        <GearRing delay={50} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: EddiesSpacing.md, paddingBottom: EddiesSpacing.md }}>
        <View style={pg.topBar}>
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>MISSION BRIEF // 02</MonoLabel>
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '55'}>SYS INIT</MonoLabel>
        </View>

        {/* Cyberpunk quote — fish shell terminal */}
        <View style={p2.quoteBlock}>
          <View style={p2.termPrompt}>
            <Text style={p2.promptSymbol}>❯</Text>
            <Text style={p2.quoteText}>
              "Spend big, live fast, whatever. But at the end of the run, the eddies you track are the only score that matters."
            </Text>
          </View>
          <View style={p2.quoteMeta}>
            <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '50'}>NIGHT CITY STREET CODE 605185</MonoLabel>
            <BarcodeMark height={14} color={EddiesColors.steel} style={{ width: 56 }} />
          </View>
        </View>

        <View style={p2.divider} />

        {/* Feature rows */}
        <View style={p2.rows}>
          <FeatureRow num="01" title="LOG"    desc="INFLOW. OUTFLOW. EVERY CENT." delay={480} />
          <FeatureRow num="02" title="INTEL"  desc="BURN RATE. SPEND CAPS."       delay={630} />
          <FeatureRow num="03" title="VAULTS" desc="ORGANIZE BY ACCOUNT."         delay={780} />
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={{ opacity: ctaOpacityRef.current, transform: [{ translateY: ctaYRef.current }] }}>
          <View style={p2.metaRow}>
            <MonoLabel size={7} letterSpacing={1} color={EddiesColors.steel + '44'}>ALL DATA ON-DEVICE</MonoLabel>
            <MonoLabel size={7} letterSpacing={1} color={EddiesColors.alert + '88'}>USE WITH DISCIPLINE</MonoLabel>
          </View>
          <Pressable
            style={({ pressed }) => [p2.ctaWrap, pressed && p2.ctaWrapPressed]}
            onPress={onDeploy}
            accessibilityRole="button"
            accessibilityLabel="Enter the app"
          >
            <View style={p2.ctaLeft}>
              <Text style={p2.ctaText}>ENTER SYSTEM</Text>
            </View>
            <View style={p2.ctaRight}>
              <Text style={p2.ctaArrow}>›</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
const p2 = StyleSheet.create({
  quoteBlock: { marginBottom: EddiesSpacing.sm },
  divider: { height: 1, backgroundColor: EddiesColors.steel + '22', marginBottom: EddiesSpacing.sm },
  termPrompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: EddiesSpacing.sm,
    marginBottom: EddiesSpacing.sm,
  },
  promptSymbol: {
    fontFamily: EddiesFonts.mono,
    fontSize: 11,
    color: EddiesColors.alert,
    lineHeight: 18,
  },
  quoteText: {
    flex: 1,
    fontSize: 13,
    color: EddiesColors.bone + 'BB',
    letterSpacing: 0.1,
    lineHeight: 19,
  },
  quoteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rows: { gap: 0 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: EddiesSpacing.sm,
  },
  ctaWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: EddiesColors.alert,
    overflow: 'hidden',
  },
  ctaWrapPressed: { opacity: 0.85 },
  ctaLeft: {
    flex: 1,
    paddingVertical: EddiesSpacing.md + 2,
    paddingHorizontal: EddiesSpacing.md,
    backgroundColor: EddiesColors.alert + '10',
    justifyContent: 'center',
  },
  ctaRight: {
    width: 56,
    backgroundColor: EddiesColors.alert,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: { fontFamily: EddiesFonts.displayBold, fontSize: 22, color: EddiesColors.bone, letterSpacing: 5 },
  ctaArrow: { fontFamily: EddiesFonts.displayBold, fontSize: 32, color: EddiesColors.ink, lineHeight: 34 },
});

// ── Root ───────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const setOnboardingComplete = useStore((s) => s.setOnboardingComplete);
  const showToast = useStore((s) => s.showToast);
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  const onViewableItemsChangedRef = useRef<({ viewableItems }: { viewableItems: ViewToken[] }) => void>(
    ({ viewableItems }) => {
      if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
    }
  );

  async function handleDeploy() {
    try {
      await setSetting(db, 'onboarding_complete', 'true');
    } catch {
      showToast('Setup failed — try again', 'err');
      return;
    }
    setOnboardingComplete(true);
    router.replace('/(auth)');
  }

  function handleNext() {
    listRef.current?.scrollToIndex({ index: 1, animated: true });
  }

  const pages = [
    <Page1 key="p1" height={pageHeight} />,
    <Page2 key="p2" height={pageHeight} onDeploy={handleDeploy} />,
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1 }} onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}>
        {pageHeight > 0 && (
          <FlatList
            ref={listRef}
            data={pages}
            renderItem={({ item }) => item}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChangedRef.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            scrollEventThrottle={16}
          />
        )}
      </View>

      <View style={s.nav}>
        <View style={s.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
          ))}
        </View>
        {activeIndex === 0 ? (
          <Pressable
            style={({ pressed }) => [s.nextBtn, pressed && s.nextBtnPressed]}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Go to next page"
          >
            <MonoLabel size={10} letterSpacing={3} color={EddiesColors.bone}>NEXT</MonoLabel>
            <View style={s.arrow} />
          </Pressable>
        ) : (
          <View style={s.nextBtn} />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: EddiesColors.ink },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '18',
    backgroundColor: EddiesColors.ink,
  },
  dots:         { flexDirection: 'row', gap: EddiesSpacing.sm, alignItems: 'center' },
  dot:          { width: 20, height: 2, backgroundColor: EddiesColors.steel + '40' },
  dotActive:    { width: 32, backgroundColor: EddiesColors.alert },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
    minWidth: 80,
    justifyContent: 'center',
  },
  nextBtnPressed: { backgroundColor: EddiesColors.steel + '18' },
  arrow:          { width: 8, height: 1, backgroundColor: EddiesColors.bone },
});
