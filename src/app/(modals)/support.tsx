import { useState } from 'react';
import { Clipboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';

// ── Fill these in before shipping ─────────────────────────────────────────────
const XMR_ADDRESS = 'YOUR_XMR_ADDRESS_HERE';
const RAZORPAY_URL = 'YOUR_RAZORPAY_PAYMENT_PAGE_URL';

export default function SupportModal() {
  const { hapticsEnabled, showToast } = useStore();
  const [copied, setCopied] = useState(false);

  async function copyXmrAddress() {
    Clipboard.setString(XMR_ADDRESS);
    setCopied(true);
    showToast('XMR address copied');
    if (hapticsEnabled) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openRazorpay() {
    if (hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(RAZORPAY_URL);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // SUPPORT 00-A" />
        <BarcodeMark height={16} />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close support screen"
        >
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CLOSE</MonoLabel>
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>

        <Text style={s.intro}>
          {'Eddies is built and maintained solo — no VC, no ads, no tracking.\nIf it saves you time or money, consider throwing something in.'}
        </Text>

        {/* ── Monero (XMR) ─────────────────────────────── */}
        <View style={s.section}>
          <SectionTag label="MONERO (XMR)" />

          <View style={s.card}>
            <View style={s.cryptoHeader}>
              <View style={s.xmrBadge}>
                <Text style={s.xmrGlyph}>ɱ</Text>
              </View>
              <View style={s.cryptoMeta}>
                <Text style={s.cryptoName}>MONERO</Text>
                <MonoLabel size={9} color={EddiesColors.steel} letterSpacing={1}>
                  PRIVACY-NATIVE · UNTRACEABLE
                </MonoLabel>
              </View>
              <View style={s.anonTag}>
                <MonoLabel size={8} color={EddiesColors.alert} letterSpacing={1}>ANON</MonoLabel>
              </View>
            </View>

            <View style={s.addressBox}>
              <MonoLabel size={9} color={EddiesColors.steel} letterSpacing={1}>ADDRESS</MonoLabel>
              <Text style={s.addressText} selectable>
                {XMR_ADDRESS}
              </Text>
            </View>

            <Pressable
              style={[s.copyBtn, copied && s.copyBtnDone]}
              onPress={copyXmrAddress}
              accessibilityRole="button"
              accessibilityLabel="Copy XMR address to clipboard"
            >
              <MonoLabel
                size={11}
                weight="bold"
                color={copied ? EddiesColors.steel : EddiesColors.bone}
                letterSpacing={1.5}
              >
                {copied ? '✓  COPIED' : 'COPY ADDRESS'}
              </MonoLabel>
            </Pressable>

            <Text style={s.note}>
              No account or identity required. Monero transactions are unlinkable and untraceable by design.
            </Text>
          </View>
        </View>

        {/* ── UPI / Bank Transfer ───────────────────────── */}
        <View style={s.section}>
          <SectionTag label="UPI / BANK TRANSFER" />

          <View style={s.card}>
            <View style={s.gatewayHeader}>
              <MonoLabel size={9} color={EddiesColors.steel} letterSpacing={1}>GATEWAY</MonoLabel>
              <MonoLabel size={10} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
                RAZORPAY
              </MonoLabel>
            </View>

            <View style={s.featureTable}>
              <FeatureRow label="PERSONAL UPI ID" value="NEVER EXPOSED" />
              <FeatureRow label="BANK DETAILS" value="HIDDEN BEHIND GATEWAY" />
              <FeatureRow label="ACCEPTS" value="UPI · NET BANKING · CARDS" last />
            </View>

            <Pressable
              style={s.payBtn}
              onPress={openRazorpay}
              accessibilityRole="link"
              accessibilityLabel="Open Razorpay payment page in browser"
            >
              <MonoLabel size={11} weight="bold" color={EddiesColors.bone} letterSpacing={1.5}>
                OPEN PAYMENT PAGE →
              </MonoLabel>
            </Pressable>

            <Text style={s.note}>
              Opens in browser. Processed by Razorpay — your personal UPI ID and bank account are never visible to the developer.
            </Text>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────── */}
        <View style={s.footer}>
          <BarcodeMark height={12} color={EddiesColors.steel} style={{ opacity: 0.15 }} />
          <MonoLabel size={9} color={EddiesColors.steel} letterSpacing={1.5}>
            EVERY CONTRIBUTION KEEPS THE LIGHTS ON
          </MonoLabel>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.featureRow, last && s.featureRowLast]}>
      <MonoLabel size={9} color={EddiesColors.steel} letterSpacing={1}>{label}</MonoLabel>
      <MonoLabel size={9} weight="bold" color={EddiesColors.bone} letterSpacing={0.5}>{value}</MonoLabel>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },

  header: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '1A',
  },

  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.lg,
    gap: EddiesSpacing.xl,
  },

  intro: {
    fontFamily: EddiesFonts.mono,
    fontSize: 11,
    lineHeight: 18,
    color: EddiesColors.steel,
  },

  section: { gap: EddiesSpacing.sm },

  // ── Card shell ──
  card: {
    backgroundColor: EddiesColors.surface,
    borderRadius: EddiesRadius.card,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
    padding: EddiesSpacing.md,
    gap: EddiesSpacing.md,
  },

  // ── Crypto header ──
  cryptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  xmrBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EddiesColors.alert + '1A',
    borderWidth: 1,
    borderColor: EddiesColors.alert + '40',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  xmrGlyph: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 18,
    color: EddiesColors.alert,
    lineHeight: 22,
  },
  cryptoMeta: { flex: 1, gap: 3 },
  cryptoName: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 18,
    color: EddiesColors.bone,
    letterSpacing: 2,
  },
  anonTag: {
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: EddiesColors.alert + '40',
    backgroundColor: EddiesColors.alert + '0F',
    borderRadius: EddiesRadius.chip,
  },

  // ── Address box ──
  addressBox: {
    backgroundColor: EddiesColors.ink,
    borderRadius: EddiesRadius.panel,
    padding: EddiesSpacing.sm,
    gap: EddiesSpacing.xs,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
  },
  addressText: {
    fontFamily: EddiesFonts.mono,
    fontSize: 10,
    color: EddiesColors.bone,
    lineHeight: 16,
    letterSpacing: 0.3,
  },

  // ── Copy button ──
  copyBtn: {
    paddingVertical: EddiesSpacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: EddiesColors.bone + '30',
    backgroundColor: EddiesColors.bone + '08',
    borderRadius: EddiesRadius.panel,
  },
  copyBtnDone: {
    borderColor: EddiesColors.steel + '20',
    backgroundColor: 'transparent',
  },

  // ── Gateway card ──
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureTable: {
    backgroundColor: EddiesColors.ink,
    borderRadius: EddiesRadius.panel,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.sm - 1,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '12',
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },

  // ── Pay button ──
  payBtn: {
    paddingVertical: EddiesSpacing.md,
    alignItems: 'center',
    backgroundColor: EddiesColors.alert,
    borderRadius: EddiesRadius.panel,
  },

  // ── Shared ──
  note: {
    fontFamily: EddiesFonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: EddiesColors.steel,
  },
  footer: {
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    paddingBottom: EddiesSpacing.xl,
  },
});
