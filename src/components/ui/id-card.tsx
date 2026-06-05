import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { EddiesColors, EddiesRadius, EddiesSpacing } from '@/constants/theme';

type IDCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function IDCard({ children, style }: IDCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EddiesColors.stock,
    borderRadius: EddiesRadius.card,
    padding: EddiesSpacing.card,
    overflow: 'hidden',
  },
});
