import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { supabase } from '@/lib/supabase';

// Metadata for one stored backup (blob excluded — listing must stay light).
export interface BackupRow {
  id: string;
  created_at: string;
  app_version: string | null;
  schema_ver: number;
  byte_size: number;
}

const TABLE = 'encrypted_backups';

// PostgREST encodes bytea as a hex string prefixed with "\x" on both read & write.
function toBytea(bytes: Uint8Array): string {
  return '\\x' + bytesToHex(bytes);
}
function fromBytea(value: string): Uint8Array {
  return hexToBytes(value.startsWith('\\x') ? value.slice(2) : value);
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to use cloud backup.');
  return data.user.id;
}

// PostgREST error bodies can leak table/constraint/query internals — map them to
// opaque, user-facing copy instead of rethrowing the raw message.
function cloudError(): Error {
  return new Error('Cloud request failed. Check your connection and try again.');
}

export async function listBackups(): Promise<BackupRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, created_at, app_version, schema_ver, byte_size')
    .order('created_at', { ascending: false });
  if (error) throw cloudError();
  return (data ?? []) as BackupRow[];
}

export async function fetchBlob(id: string): Promise<Uint8Array> {
  const { data, error } = await supabase.from(TABLE).select('blob').eq('id', id).single();
  if (error) throw cloudError();
  if (typeof data?.blob !== 'string') throw new Error('Backup not found.');
  return fromBytea(data.blob);
}

export async function insertBackup(
  envelope: Uint8Array,
  meta: { app_version: string | null; schema_ver: number },
): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase.from(TABLE).insert({
    user_id,
    app_version: meta.app_version,
    schema_ver: meta.schema_ver,
    byte_size: envelope.length,
    blob: toBytea(envelope),
  });
  if (error) {
    if (error.message.includes('backup_limit_exceeded')) {
      throw new Error('Backup limit reached. Delete an old backup and try again.');
    }
    throw cloudError();
  }
}

export async function deleteBackup(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw cloudError();
}

// Keep only the most recent `keep` backups; delete the rest. Called after each
// successful upload so per-user storage stays bounded (free-tier safety).
export async function pruneToN(keep = 3): Promise<void> {
  const rows = await listBackups();
  const stale = rows.slice(keep);
  await Promise.all(stale.map((row) => deleteBackup(row.id)));
}
