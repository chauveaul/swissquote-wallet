import { useMemo, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PricePoint } from '@/features/market/types';
import { formatNumber, priceDecimals } from '@/lib/format';
import { colors, radii } from '@/theme/tokens';

import { Text } from './Text';

const HEIGHT = 220;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;
const TIP_WIDTH = 140;

type Props = {
  points: PricePoint[];
  hover: number | null;
  onHover: (index: number | null) => void;
  accent?: string;
  accessibilityLabel: string;
};

/**
 * Line + area chart with dashed gridlines and a scrub tooltip. Geometry mirrors
 * the design prototype (8% vertical padding, gridlines at min / mid / max).
 */
export function PriceChart({ points, hover, onHover, accent = colors.accent, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(342);
  const n = points.length;

  const geo = useMemo(() => {
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const padV = (max - min) * 0.08 || 1;
    min -= padV;
    max += padV;
    const x = (i: number) => (i / (n - 1)) * width;
    const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${width} ${HEIGHT} L0 ${HEIGHT} Z`;
    const decimals = priceDecimals(max);
    const grid = [0, 0.5, 1].map((f) => {
      const v = min + padV + f * (max - min - 2 * padV);
      return { y: y(v), label: formatNumber(v, decimals) };
    });
    return { x, y, line, area, grid, decimals };
  }, [points, n, width]);

  const indexAt = (e: GestureResponderEvent) => {
    const i = Math.floor((e.nativeEvent.locationX / width) * n);
    return Math.min(Math.max(i, 0), n - 1);
  };

  const active = hover !== null && hover < n ? hover : null;
  const hx = active !== null ? geo.x(active) : 0;
  const hy = active !== null ? geo.y(points[active]!.value) : 0;
  const tipLeft = Math.min(Math.max(hx - TIP_WIDTH / 2, 0), width - TIP_WIDTH);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => onHover(indexAt(e))}
      onResponderMove={(e) => onHover(indexAt(e))}
      onResponderRelease={() => onHover(null)}
      onResponderTerminate={() => onHover(null)}
    >
      {geo.grid.map((g, i) => (
        <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.gridLine, { top: g.y }]} />
          <Text size={11} color={colors.textMuted} style={[styles.gridLabel, { top: g.y - 16 }]}>
            {g.label}
          </Text>
        </View>
      ))}

      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={geo.area} fill={accent} fillOpacity={0.08} stroke="none" />
        <Path d={geo.line} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>

      {active !== null ? (
        <>
          <View pointerEvents="none" style={[styles.cross, { left: hx }]} />
          <View pointerEvents="none" style={[styles.dot, { left: hx - 6, top: hy - 6, backgroundColor: accent }]} />
          <View pointerEvents="none" style={[styles.tip, { left: tipLeft }]}>
            <Text size={12} color={colors.onDarkMuted}>
              {points[active]!.label}
            </Text>
            <Text size={14} weight={700} color={colors.surface}>
              CHF {formatNumber(points[active]!.value, geo.decimals)}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', height: HEIGHT, width: '100%' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  gridLabel: {
    position: 'absolute',
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 2,
  },
  cross: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0,
    borderLeftWidth: 1,
    borderLeftColor: colors.ink,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    boxShadow: `0 0 0 2px ${colors.surface}`,
  },
  tip: {
    position: 'absolute',
    top: -8,
    width: TIP_WIDTH,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.inkStrong,
    borderRadius: radii.sm,
    gap: 1,
  },
});
