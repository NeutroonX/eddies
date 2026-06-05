import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { StampButton } from '@/components/ui/stamp-button';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { createBudget, deleteBudget, updateBudget } from '@/lib/db/repos/budgets';
import { toMinorUnits } from '@/lib/money';
import type { Budget } from '@/lib/schemas';

export default function CapModal() {
  const db = useSQLiteContext();
  const { categories } = useCategories();
  const params = useLocalSearchParams<{ capId?: string }>();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [rawAmount, setRawAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingCap, setExistingCap] = useState<Budget | null>(null);

  useEffect(() => {
    if (params.capId) {
      // Load existing cap for editing
      async function loadCap() {
        const row = await db.getFirstAsync<Budget>(
          'SELECT * FROM budgets WHERE id = ?',
          params.capId
        );
        if (row) {
          setExistingCap(row);
          setCategoryId(row.category_id);
          setPeriod(row.period);
          setRawAmount((row.amount_minor / 100).toString());
        }
      }
      loadCap();
    }
  }, [params.capId, db]);

  async function handleSave() {
    if (!categoryId || !rawAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    Keyboard.dismiss();

    try {
      const minorAmount = toMinorUnits(parseFloat(rawAmount));
      const now = Date.now();

      if (existingCap) {
        await updateBudget(db, existingCap.id, {
          category_id: categoryId,
          period,
          amount_minor: minorAmount,
          start_date: existingCap.start_date,
        });
      } else {
        await createBudget(db, {
          category_id: categoryId,
          period,
          amount_minor: minorAmount,
          start_date: now,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      console.error('Failed to save cap:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingCap) return;

    setDeleting(true);
    Keyboard.dismiss();

    try {
      await deleteBudget(db, existingCap.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      console.error('Failed to delete cap:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
    }
  }

  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <SectionTag label={existingCap ? 'EDDIES // CAP EDIT' : 'EDDIES // CAP NEW'} />
        </View>

        <View style={styles.section}>
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
            CATEGORY
          </MonoLabel>
          <View style={styles.categoryGrid}>
            {expenseCategories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryButton,
                  categoryId === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <MonoLabel
                  size={11}
                  weight={categoryId === cat.id ? 'bold' : 'regular'}
                  color={categoryId === cat.id ? EddiesColors.alert : EddiesColors.steel}
                >
                  {cat.name}
                </MonoLabel>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
            PERIOD
          </MonoLabel>
          <View style={styles.periodButtons}>
            {(['weekly', 'monthly'] as const).map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.periodButton,
                  period === p && styles.periodButtonActive,
                ]}
                onPress={() => setPeriod(p)}
              >
                <MonoLabel
                  size={11}
                  weight={period === p ? 'bold' : 'regular'}
                  color={period === p ? EddiesColors.bone : EddiesColors.steel}
                >
                  {p.toUpperCase()}
                </MonoLabel>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.steel}>
            AMOUNT
          </MonoLabel>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={EddiesColors.steel}
            keyboardType="decimal-pad"
            value={rawAmount}
            onChangeText={setRawAmount}
            editable={!saving}
          />
        </View>

        <View style={styles.actions}>
          <StampButton
            label="SUBMIT"
            onPress={handleSave}
            disabled={!categoryId || !rawAmount || saving}
            loading={saving}
          />
          {existingCap && (
            <Pressable
              style={[styles.deleteButton, deleting && styles.deleteButtonLoading]}
              onPress={handleDelete}
              disabled={deleting}
            >
              <MonoLabel
                size={11}
                weight="bold"
                color={EddiesColors.steel}
              >
                DELETE
              </MonoLabel>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  content: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.lg,
  },
  header: {
    gap: EddiesSpacing.sm,
  },
  section: {
    gap: EddiesSpacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: EddiesSpacing.sm,
  },
  categoryButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    backgroundColor: EddiesColors.surface,
  },
  categoryButtonActive: {
    borderColor: EddiesColors.alert,
    backgroundColor: EddiesColors.ink,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: EddiesSpacing.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: EddiesSpacing.sm,
    paddingHorizontal: EddiesSpacing.md,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    backgroundColor: EddiesColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodButtonActive: {
    borderColor: EddiesColors.bone,
    backgroundColor: EddiesColors.ink,
  },
  amountInput: {
    paddingVertical: EddiesSpacing.md,
    paddingHorizontal: EddiesSpacing.md,
    fontSize: 16,
    fontFamily: EddiesFonts.monoBold,
    color: EddiesColors.bone,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    backgroundColor: EddiesColors.surface,
  },
  actions: {
    gap: EddiesSpacing.md,
  },
  deleteButton: {
    paddingVertical: EddiesSpacing.md,
    paddingHorizontal: EddiesSpacing.md,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    backgroundColor: EddiesColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonLoading: {
    opacity: 0.5,
  },
});
