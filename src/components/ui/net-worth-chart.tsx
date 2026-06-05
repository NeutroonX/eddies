import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { MonoLabel } from './mono-label';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { NetWorthPoint } from '@/lib/analytics';

interface NetWorthChartProps {
  data: NetWorthPoint[];
  width: number;
  height?: number;
}

function formatDateShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en', { month: 'short' }).toUpperCase()}`;
}

function formatAmountShort(minor: number): string {
  const major = minor / 100;
  if (Math.abs(major) >= 1000) return `$${(major / 1000).toFixed(1)}k`;
  return `$${major.toFixed(0)}`;
}

export function NetWorthChart({ data, width, height = 180 }: NetWorthChartProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (data.length > 1) {
      progress.value = withTiming(1, {
        duration: reduceMotion ? 0 : 600,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [data, reduceMotion, progress]);

  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <MonoLabel size={9} color={EddiesColors.steel}>
          NO DATA FOR PERIOD
        </MonoLabel>
      </View>
    );
  }

  const PAD_LEFT = 50;
  const PAD_RIGHT = 16;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 24;
  const chartW = width - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const balanceRange = maxBalance - minBalance || 1;

  const minDate = data[0].date;
  const maxDate = data[data.length - 1].date;
  const dateRange = maxDate - minDate || 1;

  function toX(date: number) {
    return PAD_LEFT + ((date - minDate) / dateRange) * chartW;
  }

  function toY(balance: number) {
    return PAD_TOP + chartH - ((balance - minBalance) / balanceRange) * chartH;
  }

  const pathD = data
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${toX(point.date)} ${toY(point.balance)}`)
    .join(' ');

  const zeroY = toY(0);
  const showZeroLine = minBalance < 0 && maxBalance > 0;

  // Show first, middle, last date labels
  const labelIndices = [0, Math.floor(data.length / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {/* Zero baseline (caution stripe logic — just a red dashed line) */}
        {showZeroLine && (
          <Line
            x1={PAD_LEFT}
            y1={zeroY}
            x2={PAD_LEFT + chartW}
            y2={zeroY}
            stroke={EddiesColors.alert}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Y-axis hairline */}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + chartH}
          stroke={EddiesColors.steel}
          strokeWidth={1}
          opacity={0.4}
        />

        {/* Net worth line */}
        <Path
          d={pathD}
          fill="none"
          stroke={EddiesColors.bone}
          strokeWidth={1.5}
        />

        {/* Date axis labels */}
        {labelIndices.map((i) => (
          <SvgText
            key={i}
            x={toX(data[i].date)}
            y={PAD_TOP + chartH + 14}
            fill={EddiesColors.steel}
            fontSize={8}
            fontFamily="SpaceMono_400Regular"
            textAnchor="middle"
          >
            {formatDateShort(data[i].date)}
          </SvgText>
        ))}

        {/* Y-axis label: max */}
        <SvgText
          x={PAD_LEFT - 4}
          y={PAD_TOP + 4}
          fill={EddiesColors.steel}
          fontSize={8}
          fontFamily="SpaceMono_400Regular"
          textAnchor="end"
        >
          {formatAmountShort(maxBalance)}
        </SvgText>

        {/* Y-axis label: min */}
        <SvgText
          x={PAD_LEFT - 4}
          y={PAD_TOP + chartH}
          fill={EddiesColors.steel}
          fontSize={8}
          fontFamily="SpaceMono_400Regular"
          textAnchor="end"
        >
          {formatAmountShort(minBalance)}
        </SvgText>

        {/* End-point dot */}
        <Circle
          cx={toX(data[data.length - 1].date)}
          cy={toY(data[data.length - 1].balance)}
          r={3}
          fill={EddiesColors.bone}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
