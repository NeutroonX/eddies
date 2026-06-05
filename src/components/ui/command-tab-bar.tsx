import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MonoLabel } from './mono-label';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';

const LABELS: Record<string, string> = {
  index:    'LEDGER',
  analyze:  'INTEL',
  log:      '[+]',
  vaults:   'VAULTS',
  settings: 'SYSTEM',
};

type TabBarProps = {
  state: { routes: Array<{ key: string; name: string }>; index: number };
  navigation: { navigate(name: string): void };
};

export function CommandTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const hapticsEnabled = useStore((s) => s.hapticsEnabled);

  function pressTab(routeName: string, isFocused: boolean) {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (routeName === 'log') {
      router.push('/(modals)/entry');
      return;
    }
    if (!isFocused) navigation.navigate(routeName);
  }

  return (
    <View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
      <View style={s.bar}>
        <View style={s.row}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const isLog = route.name === 'log';
            const label = LABELS[route.name] ?? route.name.toUpperCase();

            return (
              <Pressable
                key={route.key}
                style={s.item}
                onPress={() => pressTab(route.name, isFocused)}
                accessibilityRole={isLog ? 'button' : 'tab'}
                accessibilityState={isLog ? undefined : { selected: isFocused }}
                accessibilityLabel={isLog ? 'Log entry' : label}
              >
                <View
                  style={[
                    s.chip,
                    isFocused && !isLog && s.chipActive,
                    isLog && s.chipLog,
                  ]}
                >
                  <MonoLabel
                    size={9}
                    weight="bold"
                    letterSpacing={isLog ? 0.5 : 1.5}
                    color={
                      isLog
                        ? EddiesColors.bone
                        : isFocused
                          ? EddiesColors.ink
                          : EddiesColors.steel
                    }
                  >
                    {label}
                  </MonoLabel>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.sm,
  },
  bar: {
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  chip: {
    paddingHorizontal: EddiesSpacing.xs + 2,
    paddingVertical: 4,
  },
  chipActive: {
    backgroundColor: EddiesColors.bone,
  },
  chipLog: {
    backgroundColor: EddiesColors.alert,
    paddingHorizontal: EddiesSpacing.sm,
  },
});
