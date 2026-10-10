import { colors } from '@/theme/tokens';

const PALETTE = [colors.accent, colors.primary, colors.iconMuted, colors.token.USDC, colors.token.WBTC];

/** Stable avatar colour per account index (design: accent, #323232, #8A8A8A). */
export function accountColor(index: number): string {
  return PALETTE[index % PALETTE.length]!;
}
