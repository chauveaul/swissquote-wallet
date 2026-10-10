/**
 * Design tokens extracted from the "Swissquote Crypto Wallet — Mobile" design.
 * Values are kept 1:1 with the source so screens can be compared side-by-side.
 */

export const colors = {
  /** Brand accent (design default). */
  accent: '#FA5B35',
  /** Accent used for text/links and negative values on white (AA contrast). */
  accentText: '#B8401F',
  accentTextPressed: '#8F2F15',
  /** Tinted surface behind accent-related callouts and selected rows. */
  accentSurface: '#FFF1EC',

  ink: '#1D1D1D',
  inkStrong: '#121212',
  primary: '#323232',
  textSecondary: '#4A4A4A',
  textMuted: '#6B6B6B',
  iconMuted: '#8A8A8A',

  surface: '#FFFFFF',
  surfaceMuted: '#F6F6F5',
  border: '#E4E4E2',
  borderInput: '#C9C9C7',
  divider: '#F0F0EE',

  positive: '#1E7A4C',

  /** Dark (unlock) surface palette. */
  dark: {
    background: '#121212',
    field: '#1C1C1C',
    border: '#5A5A5A',
    label: '#E6E6E6',
    textSecondary: '#BDBDBD',
    placeholderBorder: '#8A8A8A',
  },
  /** Light text on dark cards (tooltip date, promo subtitle). */
  onDarkMuted: '#CFCFCF',

  /** Logo placeholder (to be replaced by the official brand asset). */
  logoPlaceholderBorder: '#9A9A9A',
  logoPlaceholderText: '#5E5E5E',

  /** Token marks. */
  token: {
    ETH: '#323232',
    WBTC: '#8A5A12',
    USDC: '#2B5C9E',
    LINK: '#3A4A8C',
  },
} as const;

export const radii = {
  /** The design uses a sharp 4px radius on every surface, button and input. */
  sm: 4,
  pill: 999,
} as const;

/** Font family names registered in the root layout via expo-font. */
export const fonts = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export type FontWeight = 400 | 500 | 600 | 700;

export const fontForWeight: Record<FontWeight, string> = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semibold,
  700: fonts.bold,
};

/** Converts a CSS `em` letter-spacing to React Native points for a given size. */
export const em = (value: number, fontSize: number) => value * fontSize;

/** Horizontal gutter used by most screens. */
export const gutter = 24;
