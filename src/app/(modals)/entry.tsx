import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';

export default function EntryModal() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SectionTag label="EDDIES // LOG 01-A" />
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MonoLabel size={12} color={EddiesColors.steel}>
            ✕ CLOSE
          </MonoLabel>
        </Pressable>
      </View>
      <View style={styles.body}>
        <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>
          QUICK-ADD // M1
        </MonoLabel>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '33',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
