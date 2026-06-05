import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';

export default function SettingsScreen() {
  async function handleSettingsPress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(modals)/settings');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionTag label="EDDIES // SYSTEM 05-A" />
        <BarcodeMark height={20} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Pressable style={styles.button} onPress={handleSettingsPress}>
          <MonoLabel size={12} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
            APP SETTINGS
          </MonoLabel>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(modals)/export');
          }}
        >
          <MonoLabel size={12} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
            EXPORT DATA
          </MonoLabel>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
  },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.md,
  },
  button: {
    paddingVertical: EddiesSpacing.md,
    paddingHorizontal: EddiesSpacing.md,
    backgroundColor: EddiesColors.alert,
    borderRadius: 6,
    alignItems: 'center',
  },
});
