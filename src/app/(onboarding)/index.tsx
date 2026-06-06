import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';

import { CautionStripe } from '@/components/ui/caution-stripe';
import { MonoLabel } from '@/components/ui/mono-label';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { setSetting } from '@/lib/db/repos/settings-repo';
import { useStore } from '@/store';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Corner bracket decoration ──────────────────────────────────────────────
function CornerBrackets({ size = 20, thickness = 2, color = EddiesColors.steel }: {
  size?: number; thickness?: number; color?: string;
}) {
  const b = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    const isTop = corner.startsWith('t');
    const isLeft = corner.endsWith('l');
    return (
      <View style={[
        cb.corner,
        isTop ? { top: 0 } : { bottom: 0 },
        isLeft ? { left: 0 } : { right: 0 },
      ]}>
        <View style={[
          cb.h,
          { width: size, height: thickness, backgroundColor: color },
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]} />
        <View style={[
          cb.v,
          { width: thickness, height: size, backgroundColor: color },
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]} />
      </View>
    );
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {b('tl')}{b('tr')}{b('bl')}{b('br')}
    </View>
  );
}

const cb = StyleSheet.create({
  corner: { position: 'absolute', width: 24, height: 24 },
  h: { position: 'absolute' },
  v: { position: 'absolute' },
});

// ── Slash decoration ───────────────────────────────────────────────────────
function SlashRow({ count = 6, color = EddiesColors.alert + '44' }: { count?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: count }, (_, i) => (
        <Text key={i} style={{ color, fontFamily: EddiesFonts.displayBold, fontSize: 18, letterSpacing: -2 }}>
          /
        </Text>
      ))}
    </View>
  );
}

// ── Data badge (bottom-right corner label) ─────────────────────────────────
function DataBadge({ lines }: { lines: string[] }) {
  return (
    <View style={dg.wrap}>
      <View style={dg.bar} />
      {lines.map((l, i) => (
        <MonoLabel key={i} size={8} letterSpacing={1} color={EddiesColors.bone + 'CC'}>
          {l}
        </MonoLabel>
      ))}
    </View>
  );
}
const dg = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: EddiesColors.alert + '66',
    padding: EddiesSpacing.sm,
    gap: 3,
  },
  bar: {
    height: 3,
    backgroundColor: EddiesColors.alert,
    marginBottom: 4,
  },
});

// ── PAGE 1: Brand intro ────────────────────────────────────────────────────
function Page1() {
  return (
    <View style={[pg.page, { width: SCREEN_W }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <CornerBrackets size={22} thickness={2} color={EddiesColors.steel + '66'} />

        {/* Top bar */}
        <View style={pg.topBar}>
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
            EDDIES // SECTOR-01
          </MonoLabel>
          <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '66'}>
            INIT — 01-A
          </MonoLabel>
        </View>

        {/* Logo */}
        <View style={p1.logoWrap}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={p1.logo}
            resizeMode="contain"
          />
        </View>

        {/* Large display text */}
        <View style={p1.displayBlock}>
          <Text style={p1.displayBig}>EDDIES</Text>
          <View style={p1.displayRow}>
            <View style={p1.hairlineShort} />
            <Text style={p1.displaySub}>FINANCIAL OS</Text>
          </View>
        </View>

        <CautionStripe height={6} style={{ marginHorizontal: EddiesSpacing.md }} />

        {/* Body copy */}
        <View style={p1.body}>
          <SlashRow count={4} />
          <View style={{ gap: EddiesSpacing.sm, marginTop: EddiesSpacing.sm }}>
            <Text style={p1.headline}>COMMAND YOUR FINANCES.</Text>
            <MonoLabel size={10} letterSpacing={0.5} color={EddiesColors.steel} style={{ lineHeight: 16 }}>
              {'LOG EVERY ENTRY. TRACK EVERY VAULT.\nANALYZE BURN RATE AND SPEND CAPS.'}
            </MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel + '88'}>
              ALL DATA STAYS ON-DEVICE — NO CLOUD.
            </MonoLabel>
          </View>
        </View>

        {/* Bottom data badge */}
        <View style={pg.bottomRow}>
          <BarcodeMark height={20} style={{ flex: 1 }} />
          <DataBadge lines={['PERSONAL FINANCE', 'V1.0 // LOCAL']} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const p1 = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginTop: EddiesSpacing.lg,
    marginBottom: EddiesSpacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 4,
  },
  displayBlock: {
    paddingHorizontal: EddiesSpacing.md,
    marginBottom: EddiesSpacing.md,
    gap: 4,
  },
  displayBig: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 80,
    color: EddiesColors.bone,
    letterSpacing: 8,
    lineHeight: 80,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  hairlineShort: {
    width: 32,
    height: 1,
    backgroundColor: EddiesColors.alert,
  },
  displaySub: {
    fontFamily: EddiesFonts.displaySemiBold,
    fontSize: 18,
    color: EddiesColors.bone + 'CC',
    letterSpacing: 6,
  },
  body: {
    paddingHorizontal: EddiesSpacing.md,
    marginTop: EddiesSpacing.md,
    gap: 2,
  },
  headline: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 22,
    color: EddiesColors.bone,
    letterSpacing: 3,
  },
});

// ── PAGE 2: Mission brief ──────────────────────────────────────────────────
type FeatureItem = { num: string; title: string; desc: string };

const FEATURES: FeatureItem[] = [
  { num: '01', title: 'LOG',    desc: 'INFLOW. OUTFLOW. EVERY CENT.\nCATEGORIZE AS YOU GO.' },
  { num: '02', title: 'INTEL',  desc: 'BURN RATE. CATEGORY SPEND.\nSPENDING CAPS. SEE WHERE IT GOES.' },
  { num: '03', title: 'VAULTS', desc: 'ORGANIZE BY ACCOUNT.\nMULTI-VAULT BALANCE AT A GLANCE.' },
];

function FeatureRow({ item }: { item: FeatureItem }) {
  return (
    <View style={fr.wrap}>
      <Text style={fr.num}>{item.num}</Text>
      <View style={fr.divider} />
      <View style={fr.right}>
        <Text style={fr.title}>{item.title}</Text>
        <MonoLabel size={9} letterSpacing={0.5} color={EddiesColors.steel} style={{ lineHeight: 14 }}>
          {item.desc}
        </MonoLabel>
      </View>
    </View>
  );
}

const fr = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '18',
  },
  num: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 48,
    color: EddiesColors.alert + '44',
    letterSpacing: 2,
    width: 64,
    lineHeight: 52,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: EddiesColors.steel + '22',
  },
  right: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 22,
    color: EddiesColors.bone,
    letterSpacing: 4,
  },
});

function Page2({ onDeploy }: { onDeploy: () => void }) {
  return (
    <View style={[pg.page, { width: SCREEN_W }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <CornerBrackets size={22} thickness={2} color={EddiesColors.steel + '66'} />

        {/* Top bar */}
        <View style={pg.topBar}>
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>
            MISSION BRIEF // 02-A
          </MonoLabel>
          <SlashRow count={3} color={EddiesColors.alert + '66'} />
        </View>

        {/* Section label */}
        <View style={p2.sectionRow}>
          <View style={p2.sectionLine} />
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>CAPABILITIES</MonoLabel>
          <View style={p2.sectionLine} />
        </View>

        {/* Feature rows */}
        <View style={p2.featureList}>
          {FEATURES.map((f) => <FeatureRow key={f.num} item={f} />)}
        </View>

        {/* Warning area */}
        <View style={{ marginHorizontal: EddiesSpacing.md, marginTop: EddiesSpacing.md }}>
          <CautionStripe height={6} />
          <View style={p2.warningRow}>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.alert}>
              USE WITH DISCIPLINE
            </MonoLabel>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel + '66'}>
              AREA // FINANCE-02
            </MonoLabel>
          </View>
        </View>

        {/* Deploy button */}
        <View style={p2.deployWrap}>
          <Pressable
            style={({ pressed }) => [p2.deployBtn, pressed && p2.deployBtnPressed]}
            onPress={onDeploy}
            accessibilityRole="button"
            accessibilityLabel="Deploy — enter the app"
          >
            <SlashRow count={2} color={EddiesColors.alert} />
            <Text style={p2.deployText}>DEPLOY</Text>
            <SlashRow count={2} color={EddiesColors.alert} />
          </Pressable>
          <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel + '66'} style={p2.deployHint}>
            ENTER FINANCIAL COMMAND
          </MonoLabel>
        </View>
      </SafeAreaView>
    </View>
  );
}

const p2 = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    marginHorizontal: EddiesSpacing.md,
    marginBottom: EddiesSpacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel + '22',
  },
  featureList: {
    marginHorizontal: EddiesSpacing.md,
    gap: 0,
  },
  warningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: EddiesSpacing.xs,
  },
  deployWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: EddiesSpacing.xl,
    gap: EddiesSpacing.sm,
  },
  deployBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    borderWidth: 1,
    borderColor: EddiesColors.alert,
    paddingHorizontal: EddiesSpacing.xl,
    paddingVertical: EddiesSpacing.md,
  },
  deployBtnPressed: {
    backgroundColor: EddiesColors.alert + '18',
  },
  deployText: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 28,
    color: EddiesColors.alert,
    letterSpacing: 10,
  },
  deployHint: {
    textAlign: 'center',
  },
});

// ── Root onboarding component ──────────────────────────────────────────────
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const setOnboardingComplete = useStore((s) => s.setOnboardingComplete);
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  async function handleDeploy() {
    await setSetting(db, 'onboarding_complete', 'true').catch(console.error);
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  }

  function handleNext() {
    listRef.current?.scrollToIndex({ index: 1, animated: true });
  }

  const pages = [
    <Page1 key="p1" />,
    <Page2 key="p2" onDeploy={handleDeploy} />,
  ];

  return (
    <View style={s.root}>
      <FlatList
        ref={listRef}
        data={pages}
        renderItem={({ item }) => item}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        scrollEventThrottle={16}
      />

      {/* Bottom nav bar */}
      <SafeAreaView edges={['bottom']} style={s.navWrap}>
        {/* Page dots */}
        <View style={s.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === activeIndex && s.dotActive]}
            />
          ))}
        </View>

        {/* Next button only on page 1 */}
        {activeIndex === 0 && (
          <Pressable
            style={({ pressed }) => [s.nextBtn, pressed && s.nextBtnPressed]}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <MonoLabel size={10} letterSpacing={3} color={EddiesColors.bone}>NEXT</MonoLabel>
            <View style={s.nextArrow} />
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const pg = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
    paddingHorizontal: EddiesSpacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: EddiesSpacing.md,
    marginBottom: EddiesSpacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
    marginTop: 'auto',
    paddingBottom: EddiesSpacing.xxl,
    paddingHorizontal: EddiesSpacing.md,
  },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
  },
  navWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.ink,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '18',
  },
  dots: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 2,
    backgroundColor: EddiesColors.steel + '44',
  },
  dotActive: {
    backgroundColor: EddiesColors.alert,
    width: 32,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
  },
  nextBtnPressed: {
    backgroundColor: EddiesColors.steel + '18',
  },
  nextArrow: {
    width: 8,
    height: 1,
    backgroundColor: EddiesColors.bone,
  },
});
