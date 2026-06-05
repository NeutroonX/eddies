import { Tabs, router } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesRadius, EddiesSpacing } from '@/constants/theme';
import { useInitSettings } from '@/hooks/use-init-settings';

type IconProps = { color: string; name: string };
function TabIcon({ name, color }: IconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name as any} size={18} tintColor={color} type="monochrome" />;
  }
  // Android/web: mono text glyph as fallback
  return <MonoLabel size={16} color={color}>{name[0].toUpperCase()}</MonoLabel>;
}

function LogFAB() {
  return (
    <Pressable onPress={() => router.push('/(modals)/entry')} style={styles.fab}>
      <MonoLabel size={24} weight="bold" color={EddiesColors.bone}>+</MonoLabel>
    </Pressable>
  );
}

export default function TabsLayout() {
  useInitSettings();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: EddiesColors.bone,
        tabBarInactiveTintColor: EddiesColors.steel,
        tabBarLabelStyle: {
          fontFamily: EddiesFonts.mono,
          fontSize: 9,
          letterSpacing: 1.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'LEDGER',
          tabBarIcon: ({ color }) => <TabIcon name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analyze"
        options={{
          title: 'INTEL',
          tabBarIcon: ({ color }) => <TabIcon name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: '', tabBarButton: () => <LogFAB /> }}
      />
      <Tabs.Screen
        name="vaults"
        options={{
          title: 'VAULTS',
          tabBarIcon: ({ color }) => <TabIcon name="creditcard.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SYSTEM',
          tabBarIcon: ({ color }) => <TabIcon name="gearshape.fill" color={color} />,
        }}
      />
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
