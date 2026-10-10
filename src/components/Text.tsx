import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, em, fonts, fontForWeight, type FontWeight } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  size?: number;
  weight?: FontWeight;
  color?: string;
  /** IBM Plex Mono — used for addresses and recovery words. */
  mono?: boolean;
  /** Unitless CSS-style line-height multiplier. */
  lineHeight?: number;
  /** CSS-style letter-spacing in `em`. */
  tracking?: number;
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
};

export function Text({
  size = 14,
  weight = 400,
  color = colors.ink,
  mono = false,
  lineHeight,
  tracking,
  uppercase,
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: mono ? fonts.mono : fontForWeight[weight],
          fontSize: size,
          color,
          lineHeight: lineHeight ? lineHeight * size : undefined,
          letterSpacing: tracking ? em(tracking, size) : undefined,
          textTransform: uppercase ? 'uppercase' : undefined,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

/** Small uppercase section label ("TOTAL BALANCE", "FROM", "TOKENS"…). */
export function Overline({ color = colors.textMuted, ...props }: Omit<TextProps, 'size' | 'weight'>) {
  return <Text size={13} weight={600} tracking={0.08} uppercase color={color} {...props} />;
}
