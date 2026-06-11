import type { SQLiteDatabase } from 'expo-sqlite';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useStore } from '@/store';
import { listBackups, deleteBackup, type BackupRow } from './client';
import {
  uploadBackup,
  restoreFromCloud,
  undoRestore,
  type RestoreResult,
} from './backup-sync';

// One stable key namespace so mutations can invalidate the list precisely.
export const backupKeys = {
  all: ['backups'] as const,
  list: () => [...backupKeys.all, 'list'] as const,
};

/** Cloud backup metadata, newest first. Light query — never fetches blobs. */
export function useBackupsQuery(enabled = true) {
  return useQuery({
    queryKey: backupKeys.list(),
    queryFn: listBackups,
    enabled,
  });
}

/** Encrypt + upload the current ledger, then refresh the list. */
export function useUploadBackup(db: SQLiteDatabase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (passphrase: string) => uploadBackup(db, passphrase),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: backupKeys.list() }),
  });
}

/**
 * Download + decrypt + REPLACE the local ledger. Bumps dbVersion so every
 * screen re-reads SQLite, and returns the pre-restore snapshot for undo.
 */
export function useRestoreBackup(db: SQLiteDatabase) {
  const bumpDbVersion = useStore((s) => s.bumpDbVersion);
  return useMutation<RestoreResult, Error, { row: BackupRow; passphrase: string }>({
    mutationFn: ({ row, passphrase }) => restoreFromCloud(db, row, passphrase),
    onSuccess: () => bumpDbVersion(),
  });
}

/** Re-apply a pre-restore snapshot to undo a just-completed restore. */
export function useUndoRestore(db: SQLiteDatabase) {
  const bumpDbVersion = useStore((s) => s.bumpDbVersion);
  return useMutation({
    mutationFn: (snapshot: string) => undoRestore(db, snapshot),
    onSuccess: () => bumpDbVersion(),
  });
}

/** Delete one cloud backup, then refresh the list. */
export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: backupKeys.list() }),
  });
}
