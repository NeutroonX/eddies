import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';
import { setSetting } from '@/lib/db/repos/settings-repo';
import {
  useSession,
  signInWithEmail,
  signUpWithEmail,
  signOut,
} from '@/lib/cloud/session';
import {
  useBackupsQuery,
  useUploadBackup,
  useRestoreBackup,
  useDeleteBackup,
} from '@/lib/cloud/queries';
import type { BackupRow } from '@/lib/cloud/client';

// ── Helpers (presentational only) ────────────────────────────────────────────
function strengthScore(pass: string): number {
  if (pass.length < 8) return 0;
  let score = 1;
  if (pass.length >= 12) score++;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
  if (/\d/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
  return Math.min(score, 4);
}
const STRENGTH_LABEL = ['TOO SHORT', 'WEAK', 'FAIR', 'GOOD', 'STRONG'];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CloudBackupModal() {
  const { session, loading } = useSession();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function handleClose() {
    if (closeTimer.current) return; // ignore rapid double-tap
    Keyboard.dismiss();
    closeTimer.current = setTimeout(() => router.back(), 100);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // CLOUD 06-A" />
        <BarcodeMark height={16} />
        <Pressable
          style={s.close}
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>
            CLOSE
          </MonoLabel>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={EddiesColors.steel} />
        </View>
      ) : session ? (
        <SignedIn email={session.user.email ?? 'signed in'} />
      ) : (
        <SignedOut />
      )}
    </SafeAreaView>
  );
}

// ── Signed-out: email auth ────────────────────────────────────────────────────
function SignedOut() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const showToast = useStore((s) => s.showToast);

  async function submit() {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.includes('@') || password.length < 8) {
      setError('Enter a valid email and an 8+ character password.');
      return;
    }
    try {
      setBusy(true);
      Keyboard.dismiss();
      if (mode === 'in') {
        await signInWithEmail(email, password);
        showToast('Signed in');
      } else {
        await signUpWithEmail(email, password);
        setNotice('Check your email to confirm, then sign in.');
        setMode('in');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
      <View style={s.section}>
        <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
          {mode === 'in' ? 'SIGN IN TO BACK UP' : 'CREATE A BACKUP ACCOUNT'}
        </MonoLabel>
        <Text style={s.bodyText}>
          Cloud backup needs an account so only you can reach your encrypted data. Sign-in is
          separate from your invite code.
        </Text>
      </View>

      <View style={s.section}>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email"
          placeholderTextColor={EddiesColors.steel}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          selectionColor={EddiesColors.alert}
          accessibilityLabel="Email address"
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="password (8+ chars)"
          placeholderTextColor={EddiesColors.steel}
          secureTextEntry
          autoCapitalize="none"
          selectionColor={EddiesColors.alert}
          accessibilityLabel="Password"
        />
        {error && <Text style={s.errorText}>{error}</Text>}
        {notice && <Text style={s.noticeText}>{notice}</Text>}
      </View>

      <Pressable
        style={[s.button, busy && s.buttonDisabled]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={mode === 'in' ? 'Sign in' : 'Create account'}
      >
        {busy ? (
          <ActivityIndicator color={EddiesColors.bone} />
        ) : (
          <MonoLabel size={12} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
            {mode === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </MonoLabel>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setNotice(null);
          setMode((m) => (m === 'in' ? 'up' : 'in'));
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Toggle sign in or create account"
        style={s.switchModeRow}
      >
        <MonoLabel size={10} letterSpacing={1} color={EddiesColors.steel}>
          {mode === 'in' ? 'NO ACCOUNT? CREATE ONE ▸' : 'HAVE AN ACCOUNT? SIGN IN ▸'}
        </MonoLabel>
      </Pressable>
    </ScrollView>
  );
}

// ── Signed-in: passphrase + backups ───────────────────────────────────────────
function SignedIn({ email }: { email: string }) {
  const db = useSQLiteContext();
  const showToast = useStore((s) => s.showToast);
  const { autoBackupEnabled, autoBackupWifiOnly, setAutoBackupEnabled, setAutoBackupWifiOnly } =
    useStore();

  const [passphrase, setPassphrase] = useState('');
  const [confirmRow, setConfirmRow] = useState<BackupRow | null>(null);

  const backups = useBackupsQuery();
  const upload = useUploadBackup(db);
  const restore = useRestoreBackup(db);
  const remove = useDeleteBackup();

  const score = strengthScore(passphrase);
  const canBackup = passphrase.length >= 8 && !upload.isPending;

  async function handleBackup() {
    if (!canBackup) return;
    Keyboard.dismiss();
    try {
      await upload.mutateAsync(passphrase);
      showToast('Backup uploaded');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup failed', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function handleRestore(row: BackupRow) {
    if (passphrase.length < 8) {
      showToast('Enter your passphrase first', 'err');
      return;
    }
    // Keep the overlay (and its in-flight spinner) mounted until the multi-second
    // download → derive → decrypt → rewrite pipeline settles.
    try {
      const { snapshot } = await restore.mutateAsync({ row, passphrase });
      showToast('Ledger restored');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void snapshot; // snapshot retained in-mutation for a future undo affordance
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Restore failed', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setConfirmRow(null);
    }
  }

  async function toggleAuto(next: boolean) {
    setAutoBackupEnabled(next);
    try {
      await setSetting(db, 'auto_backup_enabled', String(next));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setAutoBackupEnabled(!next); // roll back so UI matches persisted state
      showToast('Could not save setting', 'err');
    }
  }
  async function toggleWifi(next: boolean) {
    setAutoBackupWifiOnly(next);
    try {
      await setSetting(db, 'auto_backup_wifi_only', String(next));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setAutoBackupWifiOnly(!next);
      showToast('Could not save setting', 'err');
    }
  }

  const rows = backups.data ?? [];

  return (
    <>
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
        {/* Account */}
        <View style={s.accountRow}>
          <View style={{ flex: 1 }}>
            <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
              SIGNED IN
            </MonoLabel>
            <Text style={s.accountEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              try {
                await signOut();
                showToast('Signed out');
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Sign out failed', 'err');
              }
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <MonoLabel size={10} weight="bold" color={EddiesColors.alert} letterSpacing={1}>
              SIGN OUT
            </MonoLabel>
          </Pressable>
        </View>

        {/* Lost-passphrase warning — the privacy guarantee, stated loudly. */}
        <View style={s.warning}>
          <MonoLabel size={9} weight="bold" letterSpacing={1.5} color={EddiesColors.alert}>
            ⚠ END-TO-END ENCRYPTED
          </MonoLabel>
          <Text style={s.warningText}>
            Your passphrase is the only key. We never see it and cannot reset it. Lose it and your
            backups are unrecoverable — by design.
          </Text>
        </View>

        {/* Passphrase */}
        <View style={s.section}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
            ENCRYPTION PASSPHRASE
          </MonoLabel>
          <TextInput
            style={s.input}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="at least 8 characters"
            placeholderTextColor={EddiesColors.steel}
            secureTextEntry
            autoCapitalize="none"
            selectionColor={EddiesColors.alert}
            accessibilityLabel="Encryption passphrase"
          />
          {passphrase.length > 0 && (
            <View style={s.strengthRow}>
              <View style={s.strengthBars}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      s.strengthBar,
                      i < score && { backgroundColor: score >= 3 ? EddiesColors.bone : EddiesColors.alert },
                    ]}
                  />
                ))}
              </View>
              <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
                {STRENGTH_LABEL[score]}
              </MonoLabel>
            </View>
          )}
        </View>

        {/* Back up now */}
        <Pressable
          style={[s.button, !canBackup && s.buttonDisabled]}
          onPress={handleBackup}
          disabled={!canBackup}
          accessibilityRole="button"
          accessibilityLabel="Back up now"
        >
          {upload.isPending ? (
            <ActivityIndicator color={EddiesColors.bone} />
          ) : (
            <MonoLabel size={12} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
              BACK UP NOW
            </MonoLabel>
          )}
        </Pressable>

        {/* Backup list */}
        <View style={s.section}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
            CLOUD BACKUPS (KEEPS 3)
          </MonoLabel>
          {backups.isLoading ? (
            <ActivityIndicator color={EddiesColors.steel} style={{ marginVertical: EddiesSpacing.md }} />
          ) : backups.isError ? (
            <Pressable
              onPress={() => backups.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading backups"
            >
              <Text style={s.errorText}>Couldn&apos;t load your backups. Tap to retry.</Text>
            </Pressable>
          ) : rows.length === 0 ? (
            <Text style={s.bodyText}>No backups yet. Your first one is one tap away.</Text>
          ) : (
            <View style={s.list}>
              {rows.map((row) => (
                <View key={row.id} style={s.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listDate}>{formatDate(row.created_at)}</Text>
                    <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
                      {formatBytes(row.byte_size)} · SCHEMA {row.schema_ver}
                    </MonoLabel>
                  </View>
                  <Pressable
                    style={s.listAction}
                    onPress={() => setConfirmRow(row)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore backup from ${formatDate(row.created_at)}`}
                  >
                    <MonoLabel size={10} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
                      RESTORE
                    </MonoLabel>
                  </Pressable>
                  <Pressable
                    style={s.listDelete}
                    onPress={() =>
                      remove.mutate(row.id, {
                        onError: (err) =>
                          showToast(err instanceof Error ? err.message : 'Delete failed', 'err'),
                      })
                    }
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete backup from ${formatDate(row.created_at)}`}
                  >
                    <MonoLabel size={10} weight="bold" color={EddiesColors.steel} letterSpacing={1}>
                      ✕
                    </MonoLabel>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Auto-backup */}
        <View style={s.section}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
            AUTO-BACKUP
          </MonoLabel>
          <ToggleRow
            label="AUTO-BACKUP"
            hint="Off by default. Encrypts and uploads after changes."
            value={autoBackupEnabled}
            onChange={toggleAuto}
          />
          <View style={s.hairline} />
          <ToggleRow
            label="WI-FI ONLY"
            hint="Skip auto-backup on cellular data."
            value={autoBackupWifiOnly}
            onChange={toggleWifi}
            disabled={!autoBackupEnabled}
          />
        </View>
      </ScrollView>

      {/* Loud replace-confirm overlay */}
      {confirmRow && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={s.overlay}
          accessibilityViewIsModal
        >
          <Pressable style={s.scrim} onPress={() => setConfirmRow(null)} />
          <View style={s.dialog} accessible>
            <MonoLabel size={11} weight="bold" letterSpacing={2} color={EddiesColors.alert}>
              REPLACE EVERYTHING?
            </MonoLabel>
            <Text style={s.dialogText}>
              Restoring overwrites your entire local ledger with the backup from{' '}
              {formatDate(confirmRow.created_at)}. This cannot be undone after you close the app.
            </Text>
            <View style={s.dialogActions}>
              <Pressable
                style={s.dialogCancel}
                onPress={() => setConfirmRow(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel restore"
              >
                <MonoLabel size={11} weight="bold" color={EddiesColors.steel} letterSpacing={1}>
                  CANCEL
                </MonoLabel>
              </Pressable>
              <Pressable
                style={[s.dialogConfirm, restore.isPending && s.buttonDisabled]}
                onPress={() => handleRestore(confirmRow)}
                disabled={restore.isPending}
                accessibilityRole="button"
                accessibilityLabel="Confirm restore"
              >
                {restore.isPending ? (
                  <ActivityIndicator color={EddiesColors.bone} size="small" />
                ) : (
                  <MonoLabel size={11} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
                    REPLACE
                  </MonoLabel>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[s.toggleRow, disabled && s.toggleDisabled]}
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <MonoLabel size={11} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
          {label}
        </MonoLabel>
        <Text style={s.toggleHint}>{hint}</Text>
      </View>
      <View style={[s.switch, value && s.switchOn]}>
        <View style={[s.knob, value && s.knobOn]} />
      </View>
    </Pressable>
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
  close: { position: 'absolute', right: EddiesSpacing.md, top: EddiesSpacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.lg,
    gap: EddiesSpacing.lg,
  },
  section: { gap: EddiesSpacing.sm },
  bodyText: { fontSize: 12, color: EddiesColors.steel, lineHeight: 18 },

  input: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '2A',
    borderRadius: 2,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
    color: EddiesColors.bone,
    fontSize: 14,
  },
  errorText: { fontSize: 11, color: EddiesColors.alert, lineHeight: 16 },
  noticeText: { fontSize: 11, color: EddiesColors.bone, lineHeight: 16 },

  button: {
    backgroundColor: EddiesColors.alert,
    paddingVertical: EddiesSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.4 },
  switchModeRow: { alignItems: 'center', paddingVertical: EddiesSpacing.sm },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '14',
  },
  accountEmail: { fontSize: 14, color: EddiesColors.bone, marginTop: 2 },

  warning: {
    backgroundColor: EddiesColors.alert + '12',
    borderWidth: 1,
    borderColor: EddiesColors.alert + '33',
    borderRadius: 2,
    padding: EddiesSpacing.md,
    gap: 6,
  },
  warningText: { fontSize: 12, color: EddiesColors.bone, lineHeight: 18 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: EddiesSpacing.sm },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: EddiesColors.steel + '33',
  },

  list: { gap: EddiesSpacing.xs },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
    borderRadius: 2,
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm + 2,
  },
  listDate: { fontSize: 13, color: EddiesColors.bone, marginBottom: 2 },
  listAction: {
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: EddiesColors.bone + '44',
    borderRadius: 2,
  },
  listDelete: { paddingHorizontal: 6, paddingVertical: 6 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
  },
  toggleDisabled: { opacity: 0.4 },
  toggleHint: { fontSize: 11, color: EddiesColors.steel, lineHeight: 15, marginTop: 2 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: EddiesColors.steel + '33',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: EddiesColors.alert },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: EddiesColors.bone,
    alignSelf: 'flex-start',
  },
  knobOn: { alignSelf: 'flex-end' },
  hairline: { height: 1, backgroundColor: EddiesColors.steel + '14' },

  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: '#000000CC' },
  dialog: {
    width: '86%',
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.alert + '44',
    borderRadius: 4,
    padding: EddiesSpacing.lg,
    gap: EddiesSpacing.md,
  },
  dialogText: { fontSize: 13, color: EddiesColors.bone, lineHeight: 19 },
  dialogActions: { flexDirection: 'row', gap: EddiesSpacing.sm, marginTop: EddiesSpacing.xs },
  dialogCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: EddiesSpacing.sm + 2,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
    borderRadius: 2,
  },
  dialogConfirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: EddiesSpacing.sm + 2,
    backgroundColor: EddiesColors.alert,
    borderRadius: 2,
    minHeight: 40,
  },
});
