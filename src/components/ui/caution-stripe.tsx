import { StyleSheet, View, type ViewStyle } from 'react-native';

import { EddiesColors } from '@/constants/theme';

type CautionStripeProps = {
  height?: number;
  style?: ViewStyle;
};

export function CautionStripe({ height = 8, style }: CautionStripeProps) {
  return (
    <View style={[styles.container, { height }, style]}>
      {Array.from({ length: 30 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            { backgroundColor: i % 2 === 0 ? EddiesColors.alert : EddiesColors.ink },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stripe: {
    flex: 1,
    transform: [{ skewX: '-20deg' }],
  },
});
