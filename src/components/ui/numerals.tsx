import { Text } from 'react-native';
import type { TextStyle } from 'react-native';

import { EddiesColors, EddiesFonts } from '@/constants/theme';

type Weight = 'medium' | 'semibold' | 'bold';

const FONT: Record<Weight, string> = {
  medium: EddiesFonts.display,
  semibold: EddiesFonts.displaySemiBold,
  bold: EddiesFonts.displayBold,
};

type NumeralsProps = {
  children: React.ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  style?: TextStyle;
};

export function Numerals({
  children,
  size = 48,
  weight = 'bold',
  color = EddiesColors.bone,
  style,
}: NumeralsProps) {
  return (
    <Text
      style={[
        { fontFamily: FONT[weight], fontSize: size, color, lineHeight: size * 1.1 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
