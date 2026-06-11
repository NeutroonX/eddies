import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import { createBackup, validateBackup, restoreBackup } from '@/lib/backup';
import { deriveKey, generateSalt, makeVerifier, checkVerifier } from '@/lib/crypto/kdf';
import { seal, open, extractSalt } from '@/lib/crypto/envelope';
import { loadKdfSecret, saveKdfSecret } from '@/lib/crypto/secrets';
import { insertBackup, fetchBlob, pruneToN, type BackupRow } from './client';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/telemetry';

const MAX_BLOB_BYTES = 1_048_576; // mirror the DB-side 1 MiB cap
const KEEP_BACKUPS = 3;

async function currentDbSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM _migrations',
  );
  return row?.version ?? 0;
}

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to use cloud backup.');
  return data.user.id;
}

function appVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

function sizeBucket(bytes: number): string {
  if (bytes < 51_200) return '<50k';
  if (bytes < 256_000) return '50-256k';
  if (bytes < 512_000) return '256-512k';
  return '512k-1m';
}

/**
 * Encrypt the current ledger and upload it. On the first backup a random salt is
 * generated and stored locally; later backups reuse it, and the passphrase is
 * verified locally first so a typo fails fast without a server round-trip.
 */
export async function uploadBackup(db: SQLiteDatabase, passphrase: string): Promise<void> {
  // Spread counts Unicode code points so the check matches the "8 characters" copy.
  if ([...passphrase].length < 8) throw new Error('Passphrase must be at least 8 characters.');

  const uid = await userId();
  const schema_ver = await currentDbSchemaVersion(db);

  // Reuse existing salt if present; verify the passphrase matches prior backups.
  const secret = await loadKdfSecret(uid);
  const salt = secret?.salt ?? generateSalt();
  const key = deriveKey(passphrase, salt);
  if (secret && !checkVerifier(key, secret.verifier)) {
    throw new Error('That passphrase does not match your existing backups.');
  }

  const json = await createBackup(db);
  const envelope = seal(json, key, salt);
  if (envelope.length > MAX_BLOB_BYTES) {
    throw new Error('Your ledger is too large for a single cloud backup.');
  }

  // Persist local KDF state BEFORE the server sees the envelope. Otherwise a
  // SecureStore failure after a successful upload would orphan the salt and the
  // next backup would silently use a different key.
  if (!secret) {
    await saveKdfSecret(uid, { salt, verifier: makeVerifier(key) });
  }

  await insertBackup(envelope, { app_version: appVersion(), schema_ver });
  await pruneToN(KEEP_BACKUPS);

  trackEvent('backup_uploaded', { size: sizeBucket(envelope.length), schema_ver });
}

export interface RestoreResult {
  /** Pre-restore ledger JSON, for an in-session "undo" of an unwanted replace. */
  snapshot: string;
}

/**
 * Download, decrypt, validate, then REPLACE the local ledger inside a single
 * transaction (restoreBackup is all-or-nothing). Returns the pre-restore snapshot
 * so the caller can offer an immediate undo.
 */
export async function restoreFromCloud(
  db: SQLiteDatabase,
  row: BackupRow,
  passphrase: string,
): Promise<RestoreResult> {
  const current = await currentDbSchemaVersion(db);
  if (row.schema_ver > current) {
    throw new Error('This backup is from a newer app version. Update Eddies to restore it.');
  }

  const envelope = await fetchBlob(row.id);
  const salt = extractSalt(envelope);
  const key = deriveKey(passphrase, salt);

  let json: string;
  try {
    json = open(envelope, key); // throws on wrong passphrase / tamper (GCM tag)
  } catch (err) {
    trackEvent('backup_wrong_passphrase');
    throw err instanceof Error ? err : new Error('Could not decrypt backup.');
  }

  let data;
  try {
    data = await validateBackup(JSON.parse(json));
  } catch {
    trackEvent('backup_restore_failed', { reason: 'invalid_format' });
    throw new Error('Backup contents are invalid or corrupted.');
  }

  const snapshot = await createBackup(db); // capture BEFORE we overwrite
  try {
    await restoreBackup(db, data);
  } catch (err) {
    trackEvent('backup_restore_failed', { reason: 'db_write' });
    throw err instanceof Error ? err : new Error('Restore failed while writing data.');
  }

  trackEvent('backup_restore_success', { schema_ver: row.schema_ver });
  return { snapshot };
}

/** Re-apply the pre-restore snapshot to undo a just-completed restore. */
export async function undoRestore(db: SQLiteDatabase, snapshot: string): Promise<void> {
  let data;
  try {
    data = await validateBackup(JSON.parse(snapshot));
  } catch {
    throw new Error('Could not undo the restore — the saved snapshot is unreadable.');
  }
  await restoreBackup(db, data);
}
