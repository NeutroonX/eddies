import { memo, useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { VaultCard } from '@/components/vaults/vault-card';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { archiveAccount, getAllAccountBalances } from '@/lib/db/repos/accounts';
import { useStore } from '@/store/index';
import type { Account } from '@/lib/schemas';

interface PendingArchive {
  id: string;
  name: string;
}

function VaultsHeader() {
  return (
    <View style={s.headerWrap}>
      <SectionTag label="EDDIES // VAULTS 04-A" />
      <BarcodeMark height={16} />
      <Pressable onPress={() => router.push('/(modals)/vault?mode=add')} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Add vault">
        <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>+ ADD VAULT</MonoLabel>
      </Pressable>
    </View>
  );
}

const VaultItem = memo(function VaultItem({ account, balance, isActive, onArchive }: { account: Account; balance: number; isActive: boolean; onArchive: (id: string) => void }) {
  const setLastVaultId = useStore(s => s.setLastVaultId);

  return (
    <VaultCard
      account={account}
      balance={balance}
      isActive={isActive}
      onPress={() => setLastVaultId(account.id)}
      onEdit={() => router.push(`/(modals)/vault?mode=edit&id=${account.id}`)}
      onDelete={() => onArchive(account.id)}
    />
  );
});

function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <View style={s.undoBar}>
      <MonoLabel size={11} color={EddiesColors.bone} style={{ flex: 1 }}>
        {label.toUpperCase()} REMOVED
      </MonoLabel>
      <Pressable onPress={onUndo} hitSlop={12} accessibilityRole="button" accessibilityLabel="Undo remove vault">
        <MonoLabel size={11} weight="bold" color={EddiesColors.alert}>UNDO</MonoLabel>
      </Pressable>
    </View>
  );
}

export default function VaultsScreen() {
  const db = useSQLiteContext();
  const { accounts, reload } = useAccounts();
  const lastVaultId = useStore(s => s.lastVaultId);
  const bumpDbVersion = useStore(s => s.bumpDbVersion);

  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const [pending, setPending] = useState<PendingArchive | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});

  useFocusEffect(useCallback(() => {
    reload();
    getAllAccountBalances(db).then(setBalances).catch(console.error);
  }, [reload, db]));

  function handleArchive(accountId: string) {
    if (archiveTimerRef.current && pendingIdRef.current) {
      clearTimeout(archiveTimerRef.current);
      archiveAccount(db, pendingIdRef.current)
        .then(() => reload())
        .then(() => bumpDbVersion())
        .catch(console.error);
    }

    const acc = accounts.find(a => a.id === accountId);
    const label = acc?.name.slice(0, 28) || accountId;
    pendingIdRef.current = accountId;
    setPending({ id: accountId, name: label });

    archiveTimerRef.current = setTimeout(() => {
      archiveTimerRef.current = null;
      pendingIdRef.current = null;
      archiveAccount(db, accountId)
        .then(() => reload())
        .then(() => {
          bumpDbVersion();
          setPending(prev => (prev?.id === accountId ? null : prev));
        })
        .catch(console.error);
    }, 4000);
  }

  function handleUndo() {
    if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
    archiveTimerRef.current = null;
    pendingIdRef.current = null;
    setPending(null);
  }

  const displayAccounts = accounts.filter(a => a.id !== pending?.id);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={displayAccounts}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <VaultItem
            account={item}
            balance={balances[item.id] ?? 0}
            isActive={lastVaultId === item.id}
            onArchive={handleArchive}
          />
        )}
        extraData={`${lastVaultId}:${displayAccounts.length}`}
        ListHeaderComponent={<VaultsHeader />}
        scrollEnabled={displayAccounts.length > 0}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {pending && (
        <UndoBar label={pending.name} onUndo={handleUndo} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  headerWrap: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '1A',
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingVertical: EddiesSpacing.xs,
  },
  undoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderTopWidth: 1,
    borderTopColor: EddiesColors.steel + '33',
  },
});
