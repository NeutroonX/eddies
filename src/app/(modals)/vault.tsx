import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { VaultForm } from '@/components/vaults/vault-form';
import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { createAccount, updateAccount, getAccountById } from '@/lib/db/repos/accounts';
import type { NewAccount, Account } from '@/lib/schemas';

export default function VaultModal() {
  const db = useSQLiteContext();
  const { mode, id } = useLocalSearchParams<{ mode: 'add' | 'edit'; id?: string }>();
  const [initialData, setInitialData] = useState<Account | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    if (mode === 'edit' && id) {
      getAccountById(db, id).then(acc => {
        setInitialData(acc);
        setLoading(false);
      }).catch(console.error);
    }
  }, [mode, id, db]);

  async function handleSave(data: NewAccount) {
    try {
      if (mode === 'add') {
        await createAccount(db, data);
      } else if (mode === 'edit' && id) {
        await updateAccount(db, id, data);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Keyboard.dismiss();
      setTimeout(() => router.back(), 100);
    } catch (err) {
      console.error('Vault save error:', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const title = mode === 'add' ? 'ADD VAULT' : 'EDIT VAULT';
  const isReady = mode === 'add' || !loading;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
          <SectionTag label={`EDDIES // ${title}`} />
          <BarcodeMark height={16} />
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setTimeout(() => router.back(), 100);
            }}
            hitSlop={12}
          >
            <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CLOSE</MonoLabel>
          </Pressable>
        </View>

      {isReady && (
        <VaultForm
          initialData={initialData ?? undefined}
          onSave={handleSave}
          onCancel={() => router.back()}
        />
      )}
    </SafeAreaView>
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
});
