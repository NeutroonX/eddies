import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';
import { useAccounts } from '@/hooks/use-accounts';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';

const APP_VERSION = '1.0.0 Beta 1';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function SystemScreen() {
  const db = useSQLiteContext();
  const { userName, setUserName, hapticsEnabled, showToast, dbVersion } = useStore();
  const { accounts } = useAccounts();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [txCount, setTxCount] = useState(0);
  const [joinedLabel, setJoinedLabel] = useState('—');
  const inputRef = useRef<TextInput>(null);

  const loadStats = useCallback(async () => {
    try {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE archived = 0');
      setTxCount(row?.n ?? 0);

      let joined = await getSetting(db, 'joined_at');
      if (!joined) {
        joined = String(Date.now());
        await setSetting(db, 'joined_at', joined);
      }
      const d = new Date(parseInt(joined, 10));
      setJoinedLabel(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    } catch {
      // non-critical
    }
  }, [db]);

  useEffect(() => { loadStats(); }, [dbVersion, loadStats]);

  useEffect(() => {
    if (!editingName) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [editingName]);

  async function commitName() {
    const trimmed = nameInput.trim().toUpperCase() || 'EDDIES USER';
    setNameInput(trimmed);
    setUserName(trimmed);
    setEditingName(false);
    await setSetting(db, 'user_name', trimmed);
    if (hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast('Name saved');
  }

  async function nav(path: string) {
    if (hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as Href);
  }

  const monogram = (userName[0] ?? 'E').toUpperCase();
  const vaultCount = String(accounts.length).padStart(2, '0');
  const entryCount = String(txCount).padStart(3, '0');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // SYSTEM 05-A" />
        <BarcodeMark height={18} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>

        {/* ── Profile Card ─────────────────────────────── */}
        <View style={s.card}>
          <BarcodeMark height={14} color={EddiesColors.steel} style={s.cardStripe} />

          <View style={s.cardBody}>
            {/* Top row: monogram + name + serial */}
            <View style={s.cardTop}>
              <View style={s.monogram}>
                <Text style={s.monogramText}>{monogram}</Text>
              </View>

              <View style={s.nameBlock}>
                {editingName ? (
                  <TextInput
                    ref={inputRef}
                    style={s.nameInput}
                    value={nameInput}
                    onChangeText={setNameInput}
                    onBlur={commitName}
                    onSubmitEditing={commitName}
                    returnKeyType="done"
                    maxLength={20}
                    autoCapitalize="characters"
                    selectionColor={EddiesColors.alert}
                  />
                ) : (
                  <Text style={s.nameText} numberOfLines={1}>{userName}</Text>
                )}
                <Pressable
                  onPress={() => {
                    setNameInput(userName);
                    setEditingName(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Rename user"
                >
                  <MonoLabel size={9} letterSpacing={1.5} color={EddiesColors.steel}>
                    {editingName ? 'EDITING...' : 'TAP TO RENAME ▸'}
                  </MonoLabel>
                </Pressable>
              </View>

              <View style={s.serialBlock}>
                <MonoLabel size={8} letterSpacing={1} color={EddiesColors.steel}>SER.</MonoLabel>
                <MonoLabel size={10} weight="bold" color={EddiesColors.steel}>USR-001</MonoLabel>
              </View>
            </View>

            {/* Divider */}
            <View style={s.cardDivider} />

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statValue}>{vaultCount}</Text>
                <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>VAULTS</MonoLabel>
              </View>
              <View style={s.statSep} />
              <View style={s.stat}>
                <Text style={s.statValue}>{entryCount}</Text>
                <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>ENTRIES</MonoLabel>
              </View>
              <View style={s.statSep} />
              <View style={s.stat}>
                <Text style={s.statValueSm}>{joinedLabel}</Text>
                <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>JOINED</MonoLabel>
              </View>
            </View>
          </View>
        </View>

        {/* ── Automation ───────────────────────────────── */}
        <View style={s.section}>
          <SectionTag label="AUTOMATION" />
          <ActionRow label="RECURRING RULES" onPress={() => nav('/(modals)/recurring')} />
        </View>

        {/* ── Preferences ──────────────────────────────── */}
        <View style={s.section}>
          <SectionTag label="PREFERENCES" />
          <ActionRow label="APP SETTINGS" onPress={() => nav('/(modals)/settings')} />
        </View>

        {/* ── Feedback ─────────────────────────────────── */}
        <View style={s.section}>
          <SectionTag label="FEEDBACK" />
          <ActionRow
            label="SEND FEEDBACK"
            onPress={() => Linking.openURL('mailto:feedback.eddies.dev@atomicmail.io?subject=Feedback%20%2F%20Suggestion')}
          />
        </View>

        {/* ── Build ────────────────────────────────────── */}
        <View style={s.section}>
          <SectionTag label="BUILD" />
          <View style={s.infoGroup}>
            <InfoRow label="VERSION" value={APP_VERSION} />
            <InfoRow label="PLATFORM" value={Platform.OS.toUpperCase()} />
            <InfoRow label="DB VERSION" value={String(dbVersion)} />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      style={[s.actionRow, pressed && s.actionRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <MonoLabel size={11} weight="bold" color={pressed ? EddiesColors.alert : EddiesColors.bone} letterSpacing={1}>
        {label}
      </MonoLabel>
      <MonoLabel size={11} color={EddiesColors.steel}>→</MonoLabel>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <MonoLabel size={11} color={EddiesColors.steel} letterSpacing={1}>{label}</MonoLabel>
      <MonoLabel size={11} weight="bold" color={EddiesColors.bone} letterSpacing={0.5}>{value}</MonoLabel>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
  },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.lg,
    gap: EddiesSpacing.xl,
  },

  // ── Profile card ──
  card: {
    backgroundColor: EddiesColors.stock,
    borderRadius: EddiesRadius.card,
    overflow: 'hidden',
  },
  cardStripe: {
    opacity: 0.25,
  },
  cardBody: {
    padding: EddiesSpacing.card,
    gap: EddiesSpacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
  },
  monogram: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: EddiesColors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monogramText: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 22,
    color: EddiesColors.bone,
    lineHeight: 26,
  },
  nameBlock: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 20,
    color: EddiesColors.ink,
    letterSpacing: 1,
  },
  nameInput: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 20,
    color: EddiesColors.ink,
    letterSpacing: 1,
    padding: 0,
    margin: 0,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.alert,
  },
  serialBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: EddiesColors.steel,
    opacity: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: EddiesColors.steel,
    opacity: 0.2,
  },
  statValue: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 24,
    color: EddiesColors.ink,
    lineHeight: 28,
  },
  statValueSm: {
    fontFamily: EddiesFonts.displayBold,
    fontSize: 16,
    color: EddiesColors.ink,
    lineHeight: 20,
  },

  // ── Sections ──
  section: {
    gap: EddiesSpacing.sm,
  },

  // ── Action rows ──
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderRadius: EddiesRadius.panel,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
  },
  actionRowPressed: {
    backgroundColor: EddiesColors.alert + '11',
    borderColor: EddiesColors.alert + '44',
  },

  // ── Info rows ──
  infoGroup: {
    backgroundColor: EddiesColors.surface,
    borderRadius: EddiesRadius.panel,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '12',
  },
});
