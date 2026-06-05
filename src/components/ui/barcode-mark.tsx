import { StyleSheet, View } from 'react-native';

import { EddiesColors } from '@/constants/theme';

// Alternating bar/gap widths that produce a barcode-like motif.
const PATTERN = [3, 1, 2, 1, 4, 1, 2, 2, 1, 3, 2, 1, 3, 1, 4, 2, 1, 2, 3, 1, 2, 1, 3];

type BarcodeMarkProps = {
  height?: number;
  color?: string;
};

export function BarcodeMark({ height = 20, color = EddiesColors.steel }: BarcodeMarkProps) {
  return (
    <View style={[styles.container, { height }]}>
      {PATTERN.map((w, i) =>
        i % 2 === 0 ? (
          <View key={i} style={{ width: w, height: '100%', backgroundColor: color, opacity: 0.5 }} />
        ) : (
          <View key={i} style={{ width: w }} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
});
