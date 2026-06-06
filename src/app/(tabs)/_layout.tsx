import { Tabs } from 'expo-router';

import { CommandTabBar } from '@/components/ui/command-tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CommandTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="analyze" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="vaults" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
