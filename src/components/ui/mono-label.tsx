import { Text } from 'react-native';
import type { TextStyle } from 'react-native';

import { EddiesColors, EddiesFonts } from '@/constants/theme';

type MonoLabelProps = {
  children: React.ReactNode;
  size?: number;
  weight?: 'regular' | 'bold';
  color?: string;
  letterSpacing?: number;
  style?: TextStyle;
};

export function MonoLabel({
  children,
  size = 12,
  weight = 'regular',
  color = EddiesColors.steel,
  letterSpacing = 1,
  style,
}: MonoLabelProps) {
  return (
    <Text
      style={[
        {
          fontFamily: weight === 'bold' ? EddiesFonts.monoBold : EddiesFonts.mono,
          fontSize: size,
          color,
          letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
