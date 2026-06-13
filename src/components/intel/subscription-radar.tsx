import { Pressable, StyleSheet, View } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { Numerals } from '@/components/ui/numerals';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { formatMinor } from '@/lib/format';
import { formatRunDate } from '@/lib/recurring/describe';
import { totalMonthlyMinor, type Subscription } from '@/lib/subscriptions';

type Props = {
  subscriptions: Subscription[];
  sym: string;
  onCreateRule: (sub: Subscription) => void;
  onDismiss: (sub: Subscription) => void;
};

/**
 * Intel "RADAR" block (§6.2). Summary line + per-subscription rows with cadence,
 * last-charged date, amount, and two actions: turn into a recurring rule, or
 * dismiss the suggestion.
 */
export function SubscriptionRadar({ subscriptions, sym, onCreateRule, onDismiss }: Props) {
  if (subscriptions.length === 0) return null;

  const monthly = totalMonthlyMinor(subscriptions);
  const count = subscriptions.length;

  return (
    <View>
      <View style={s.summary}>
        <MonoLabel size={8} letterSpacing={2} color={EddiesColors.steel}>RADAR</MonoLabel>
        <View style={s.summaryLine} />
        <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
          {count} {count === 1 ? 'SUB' : 'SUBS'} · {sym}{formatMinor(monthly)}/MO
        </MonoLabel>
      </View>

      <View>
        {subscriptions.map((sub) => (
          <View key={sub.key} style={s.row}>
            <View style={s.body}>
              <View style={s.labelRow}>
                <MonoLabel size={11} weight="bold" color={EddiesColors.bone}>
                  {sub.label.toUpperCase()}
                </MonoLabel>
                <Numerals size={13} color={EddiesColors.alert}>
                  {sym}{formatMinor(sub.amountMinor)}
                </Numerals>
              </View>
              <View style={s.metaRow}>
                <MonoLabel size={9} letterSpacing={1} color={EddiesColors.steel}>
                  {sub.cadence === 'monthly' ? 'MONTHLY' : 'YEARLY'} · LAST {formatRunDate(sub.lastChargedAt)}
                </MonoLabel>
              </View>
            </View>

            <View style={s.actions}>
              <Pressable
                onPress={() => onCreateRule(sub)}
                hitSlop={8}
                style={s.ruleBtn}
                accessibilityRole="button"
                accessibilityLabel={`Turn ${sub.label} into a recurring rule`}
              >
                <MonoLabel size={9} letterSpacing={1} weight="bold" color={EddiesColors.bone}>
                  + RULE
                </MonoLabel>
              </Pressable>
              <Pressable
                onPress={() => onDismiss(sub)}
                hitSlop={12}
                style={s.dismissBtn}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${sub.label} subscription suggestion`}
              >
                <MonoLabel size={13} color={EddiesColors.steel}>×</MonoLabel>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  summaryLine: {
    flex: 1,
    height: 1,
    backgroundColor: EddiesColors.steel,
    opacity: 0.12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: EddiesSpacing.sm + 2,
    gap: EddiesSpacing.sm,
  },
  body: {
    flex: 1,
    gap: EddiesSpacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EddiesSpacing.sm,
  },
  ruleBtn: {
    paddingHorizontal: EddiesSpacing.sm,
    paddingVertical: EddiesSpacing.xs,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '44',
  },
  dismissBtn: {
    width: 22,
    alignItems: 'center',
  },
});
