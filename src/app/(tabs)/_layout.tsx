import { Tabs } from 'expo-router';

import { CommandTabBar } from '@/components/ui/command-tab-bar';
import { useInitSettings } from '@/hooks/use-init-settings';

export default function TabsLayout() {
  useInitSettings();
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
