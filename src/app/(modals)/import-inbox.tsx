import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useCurrencySymbol } from '@/hooks/use-currency-symbol';
import {
  acceptPending, dismissPending, getPending,
} from '@/lib/db/repos/pending-imports';
import { learnMerchantCategory } from '@/lib/sms/merchant-learning';
import { formatAmountTabular } from '@/lib/money';
import { trackEvent } from '@/lib/telemetry';
import { useStore } from '@/store';
import type { PendingImport } from '@/lib/schemas';

const TXT_PRIMARY = EddiesColors.bone;
const TXT_SECONDARY = EddiesColors.steel;

// Below this a parse is uncertain and gets a visible flag; at/above HIGH_CONF it
// is eligible for one-tap bulk accept.
const LOW_CONF = 0.75;
const HIGH_CONF = 0.85;

function formatOccurred(ts: number): string {
  return new Date(ts)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .toUpperCase();
}

// Trust signal: white = trusted (high), steel = neutral, red = needs a look.
function confColor(conf: number): string {
  if (conf >= HIGH_CONF) return TXT_PRIMARY;
  if (conf < LOW_CONF) return EddiesColors.alert;
  return TXT_SECONDARY;
}

function ReviewCard({
  item, vaultName, categoryName, categoryColor, sym, onAccept, onEdit, onDismiss,
}: {
  item: PendingImport;
  vaultName: string;
  categoryName: string;
  categoryColor: string;
  sym: string;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const isOut = item.kind === 'outflow';
  const amountColor = isOut ? EddiesColors.alert : TXT_PRIMARY;
  const lowConf = item.confidence < LOW_CONF;
  const originLabel = item.origin === 'sms' ? 'SMS' : 'RULE';
  const pct = Math.round(item.confidence * 100);
  const cColor = confColor(item.confidence);

  // Split rupees / paise so the cents sit smaller and high, keeping the
  // headline figure dominant.
  const full = formatAmountTabular(item.amount_minor);
  const dotAt = full.lastIndexOf('.');
  const major = dotAt >= 0 ? full.slice(0, dotAt) : full;
  const minor = dotAt >= 0 ? full.slice(dotAt) : '';

  const merchant = (item.merchant ?? categoryName).toUpperCase().slice(0, 20);

  return (
    <View style={c.card}>
      <View style={c.top}>
        <MonoLabel size={8} letterSpacing={2} color={TXT_SECONDARY}>{originLabel}</MonoLabel>
        <View style={c.confWrap}>
          {lowConf && <MonoLabel size={8} letterSpacing={2} color={EddiesColors.alert}>CHECK</MonoLabel>}
          <MonoLabel size={9} letterSpacing={1} weight="bold" color={cColor}>{pct}%</MonoLabel>
          <View style={[c.confDot, { backgroundColor: cColor }]} />
        </View>
      </View>

      <View style={c.amountRow}>
        <Text style={[c.amount, { color: amountColor }]}>
          {isOut ? '−' : '+'}{sym}{major}
        </Text>
        {minor ? <Text style={[c.amountCents, { color: amountColor }]}>{minor}</Text> : null}
      </View>

      <View style={c.meterTrack}>
        <View style={[c.meterFill, { width: `${pct}%`, backgroundColor: cColor }]} />
      </View>

      <View style={c.meta}>
        <View style={[c.catDot, { backgroundColor: categoryColor }]} />
        <MonoLabel size={9} letterSpacing={1} weight="bold" color={TXT_PRIMARY}>{merchant}</MonoLabel>
        <MonoLabel size={9} letterSpacing={1} color={TXT_SECONDARY}>· {categoryName.toUpperCase()}</MonoLabel>
      </View>
      <MonoLabel size={8} letterSpacing={1.5} color={TXT_SECONDARY}>
        {formatOccurred(item.occurred_at)} · {vaultName.toUpperCase()}
      </MonoLabel>

      <Pressable onPress={onAccept} style={c.accept} hitSlop={6}
        accessibilityRole="button" accessibilityLabel="Accept import">
        <MonoLabel size={11} letterSpacing={2} weight="bold" color={EddiesColors.ink}>✓  ACCEPT</MonoLabel>
      </Pressable>

      <View style={c.ghostRow}>
        <Pressable onPress={onEdit} style={c.ghostBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Edit import">
          <MonoLabel size={10} letterSpacing={1.5} color={TXT_PRIMARY}>EDIT</MonoLabel>
        </Pressable>
        <View style={c.ghostDivider} />
        <Pressable onPress={onDismiss} style={c.ghostBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Dismiss import">
          <MonoLabel size={10} letterSpacing={1.5} color={EddiesColors.alert}>DISMISS</MonoLabel>
        </Pressable>
      </View>
    </View>
  );
}

export default function ImportInboxModal() {
  const db = useSQLiteContext();
  const sym = useCurrencySymbol();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const bumpDbVersion = useStore(s => s.bumpDbVersion);
  const showToast = useStore(s => s.showToast);
  const [items, setItems] = useState<PendingImport[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await getPending(db));
    setLoading(false);
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const highConfCount = useMemo(
    () => items.filter(i => i.confidence >= HIGH_CONF).length,
    [items]
  );

  const catFor = (id: string | null) => (id ? categories.find(x => x.id === id) : null);
  const nameFor = (id: string | null, list: { id: string; name: string }[], fb: string) =>
    id ? list.find(x => x.id === id)?.name ?? fb : fb;

  async function acceptOne(item: PendingImport) {
    await acceptPending(db, item.id);
    if (item.merchant && item.suggested_category_id) {
      await learnMerchantCategory(db, item.merchant, item.suggested_category_id);
    }
  }

  async function handleAccept(item: PendingImport) {
    try {
      await acceptOne(item);
      trackEvent('import_accepted');
      await reload();
      bumpDbVersion();
    } catch (err) {
      console.error('Accept import error:', err);
      showToast('Failed to accept', 'err');
    }
  }

  async function handleDismiss(item: PendingImport) {
    try {
      await dismissPending(db, item.id);
      trackEvent('import_dismissed');
      await reload();
      bumpDbVersion();
    } catch (err) {
      console.error('Dismiss import error:', err);
      showToast('Failed to dismiss', 'err');
    }
  }

  function handleEdit(item: PendingImport) {
    trackEvent('import_edited');
    const params: Record<string, string> = {
      pendingId: item.id,
      amount: (item.amount_minor / 100).toString(),
      kind: item.kind,
    };
    if (item.suggested_account_id) params.vaultId = item.suggested_account_id;
    if (item.suggested_category_id) params.categoryId = item.suggested_category_id;
    const noteText = item.note ?? item.merchant;
    if (noteText) params.note = noteText;
    router.push({ pathname: '/(modals)/entry', params });
  }

  async function handleAcceptAllHigh() {
    const high = items.filter(i => i.confidence >= HIGH_CONF);
    let ok = 0;
    for (const item of high) {
      try {
        await acceptOne(item);
        ok += 1;
      } catch (err) {
        console.error('Bulk accept error:', err);
      }
    }
    trackEvent('import_accepted', { bulk: true, count: ok });
    await reload();
    bumpDbVersion();
    showToast(`Accepted ${ok} ${ok === 1 ? 'entry' : 'entries'}`, 'ok');
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>EDDIES // IMPORT INBOX</MonoLabel>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <MonoLabel size={10} color={EddiesColors.steel}>✕ CLOSE</MonoLabel>
        </Pressable>
      </View>

      {items.length > 0 && (
        <View style={s.summary}>
          <MonoLabel size={8} letterSpacing={1.5} color={EddiesColors.steel}>
            {items.length} PENDING · {highConfCount} HIGH-CONFIDENCE
          </MonoLabel>
          {highConfCount > 0 && (
            <Pressable onPress={handleAcceptAllHigh} style={s.bulkBtn}
              accessibilityRole="button" accessibilityLabel="Accept all high-confidence imports">
              <MonoLabel size={9} letterSpacing={1.5} weight="bold" color={EddiesColors.ink}>
                ✓ ACCEPT ALL HIGH
              </MonoLabel>
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            item={item}
            vaultName={nameFor(item.suggested_account_id, accounts, '— No Vault')}
            categoryName={nameFor(item.suggested_category_id, categories, 'Uncategorized')}
            categoryColor={catFor(item.suggested_category_id)?.color ?? EddiesColors.steel}
            sym={sym}
            onAccept={() => handleAccept(item)}
            onEdit={() => handleEdit(item)}
            onDismiss={() => handleDismiss(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <MonoLabel size={44} color={EddiesColors.steel + '33'}>☑</MonoLabel>
            <MonoLabel size={11} letterSpacing={2} color={EddiesColors.bone}>INBOX ZERO</MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
              NOTHING TO REVIEW. IMPORTED
            </MonoLabel>
            <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
              SMS & RULE ENTRIES LAND HERE.
            </MonoLabel>
          </View>
        )}
        contentContainerStyle={s.listContent}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '22',
  },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: EddiesColors.steel + '18',
  },
  bulkBtn: {
    paddingHorizontal: EddiesSpacing.md, paddingVertical: EddiesSpacing.xs + 2,
    backgroundColor: EddiesColors.bone, borderRadius: EddiesRadius.chip,
  },
  listContent: { paddingTop: EddiesSpacing.md, paddingBottom: 96, gap: EddiesSpacing.md },
  sep: { height: EddiesSpacing.md },
  empty: { paddingTop: 72, alignItems: 'center', gap: EddiesSpacing.sm },
});

const c = StyleSheet.create({
  card: {
    marginHorizontal: EddiesSpacing.md,
    backgroundColor: EddiesColors.card,
    borderRadius: EddiesRadius.card,
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.sm + 2,
    paddingBottom: EddiesSpacing.md,
    gap: 6,
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  confDot: { width: 7, height: 7, borderRadius: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 },
  amount: { fontFamily: EddiesFonts.displayBold, fontSize: 46, letterSpacing: -1, lineHeight: 48 },
  amountCents: {
    fontFamily: EddiesFonts.displayBold, fontSize: 20, letterSpacing: -0.5,
    marginTop: 6, marginLeft: 1,
  },
  meterTrack: {
    height: 4, borderRadius: 2, marginTop: 2, overflow: 'hidden',
    backgroundColor: EddiesColors.steel + '22',
  },
  meterFill: { height: '100%', borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' },
  catDot: { width: 7, height: 7, borderRadius: 4 },
  accept: {
    marginTop: EddiesSpacing.sm, backgroundColor: EddiesColors.bone,
    borderRadius: EddiesRadius.chip, paddingVertical: EddiesSpacing.sm + 4, alignItems: 'center',
  },
  ghostRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: EddiesSpacing.md, marginTop: 2,
  },
  ghostBtn: { paddingVertical: EddiesSpacing.xs + 2, paddingHorizontal: EddiesSpacing.sm, alignItems: 'center' },
  ghostDivider: { width: 1, height: 12, backgroundColor: EddiesColors.steel + '33' },
});
