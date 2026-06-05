import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { CautionStripe } from '@/components/ui/caution-stripe';
import { IDCard } from '@/components/ui/id-card';
import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { Pill } from '@/components/ui/pill';
import { SectionTag } from '@/components/ui/section-tag';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';

function DBStatus() {
  const db = useSQLiteContext();
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    db.getFirstAsync<{ version: number }>('SELECT MAX(version) AS version FROM _migrations')
      .then((row) => setVersion(row?.version ?? 0))
      .catch(() => setVersion(-1));
  }, [db]);

  const ok = version !== null && version > 0;
  return (
    <MonoLabel size={10} letterSpacing={2} color={ok ? '#22C55E' : EddiesColors.steel}>
      DB v{version ?? '…'} // {ok ? 'ONLINE' : 'PENDING'}
    </MonoLabel>
  );
}

export default function FoundationScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <SectionTag label="EDDIES // M0 FOUNDATION 00-A" />
          <DBStatus />
          <BarcodeMark height={24} />
        </View>

        {/* ── Typography ─────────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>TYPOGRAPHY</MonoLabel>
          <Numerals size={56}>¥12,450.00</Numerals>
          <Numerals size={28} weight="semibold" color={EddiesColors.alert}>−1,200.00</Numerals>
          <MonoLabel size={14} color={EddiesColors.bone}>EDDIES // LEDGER 02-A</MonoLabel>
          <MonoLabel size={11}>THU 05 JUN · 09:42</MonoLabel>
        </View>

        {/* ── Color tokens ───────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>COLOR TOKENS</MonoLabel>
          <View style={styles.swatchRow}>
            {(
              [
                ['ink', EddiesColors.ink],
                ['surface', EddiesColors.surface],
                ['stock', EddiesColors.stock],
                ['bone', EddiesColors.bone],
                ['alert', EddiesColors.alert],
                ['steel', EddiesColors.steel],
              ] as [string, string][]
            ).map(([name, hex]) => (
              <View key={name} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: hex, borderColor: EddiesColors.steel + '55' }]} />
                <MonoLabel size={8} letterSpacing={1}>{name}</MonoLabel>
              </View>
            ))}
          </View>
        </View>

        {/* ── Pill chips ─────────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>PILL CHIPS</MonoLabel>
          <View style={styles.row}>
            <Pill label="Food" active />
            <Pill label="Transport" />
            <Pill label="Health" active color="#8A8F98" onRemove={() => {}} />
          </View>
        </View>

        {/* ── ID Card ────────────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>ID CARD</MonoLabel>
          <IDCard>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.ink}>
              VAULT // CASH
            </MonoLabel>
            <Numerals size={32} color={EddiesColors.ink} weight="bold">
              $1,234.56
            </Numerals>
            <View style={{ marginTop: EddiesSpacing.sm }}>
              <BarcodeMark height={16} color={EddiesColors.steel} />
            </View>
            <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel} style={{ marginTop: 4 }}>
              SN-000001 // PERSONAL WALLET
            </MonoLabel>
          </IDCard>
        </View>

        {/* ── Motif kit ──────────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>MOTIF KIT</MonoLabel>
          <BarcodeMark height={32} />
          <CautionStripe height={12} />
          <SectionTag label="EDDIES // CAUTION — OVER CAP" />
        </View>

        {/* ── Stamp button ───────────────────────────────── */}
        <View style={styles.section}>
          <MonoLabel size={9} letterSpacing={2}>STAMP BUTTON</MonoLabel>
          <StampButton label="SAVE ENTRY" onPress={() => {}} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: EddiesColors.ink,
  },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.xxl,
    gap: EddiesSpacing.xl,
  },
  header: {
    paddingTop: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
  },
  section: {
    gap: EddiesSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: EddiesSpacing.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 36,
    height: 36,
    borderWidth: 1,
  },
});
