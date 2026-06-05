import { StyleSheet, View } from 'react-native';

import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';

type SectionTagProps = {
  label: string;
};

export function SectionTag({ label }: SectionTagProps) {
  return (
    <View style={styles.container}>
      <MonoLabel size={9} letterSpacing={2} color={EddiesColors.steel}>
        {label}
      </MonoLabel>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: EddiesSpacing.xs,
  },
  rule: {
    height: 1,
    backgroundColor: EddiesColors.steel,
    opacity: 0.3,
  },
});
