import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';

function LogFAB() {
  return (
    <Pressable onPress={() => router.push('/(modals)/entry')} style={styles.fab}>
      <MonoLabel size={24} weight="bold" color={EddiesColors.bone}>
        +
      </MonoLabel>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: EddiesColors.bone,
        tabBarInactiveTintColor: EddiesColors.steel,
        tabBarShowIcon: false,
        tabBarLabelStyle: {
          fontFamily: EddiesFonts.mono,
          fontSize: 9,
          letterSpacing: 1.5,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'LEDGER' }} />
      <Tabs.Screen name="analyze" options={{ title: 'INTEL' }} />
      <Tabs.Screen
        name="log"
        options={{
          title: '',
          tabBarButton: () => <LogFAB />,
        }}
      />
      <Tabs.Screen name="vaults" options={{ title: 'VAULTS' }} />
      <Tabs.Screen name="settings" options={{ title: 'SYSTEM' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: EddiesColors.surface,
    borderTopColor: EddiesColors.steel + '33',
    borderTopWidth: EddiesSpacing.hairline,
    height: 60,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: EddiesRadius.chip,
    backgroundColor: EddiesColors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    alignSelf: 'center',
  },
});
