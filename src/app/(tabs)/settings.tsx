import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionTag label="EDDIES // SYSTEM 05-A" />
        <BarcodeMark height={20} />
      </View>
      <View style={styles.body}>
        <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
          SYSTEM // M4
        </MonoLabel>
      </View>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
