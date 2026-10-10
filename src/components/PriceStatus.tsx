import { StyleSheet, View } from 'react-native';

import { PRICES_LIVE, useQuotes } from '@/features/market/queries';
import { colors } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

const time = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Freshness of live prices: "Prices updated 14:31", or "Prices delayed · updated
 * 14:31" when a refresh failed. Renders nothing with demo prices.
 */
export function PriceStatus({ style }: { style?: object }) {
  const { delayed, updatedAt, isLoading } = useQuotes();
  if (!PRICES_LIVE) return null;

  let text: string;
  if (isLoading && !updatedAt) text = 'Loading prices…';
  else if (!updatedAt) text = 'Prices unavailable';
  else text = delayed ? `Prices delayed · updated ${time(updatedAt)}` : `Prices updated ${time(updatedAt)}`;
  const warn = delayed || (!isLoading && !updatedAt);

  return (
    <View accessibilityRole={warn ? 'alert' : 'text'} style={[styles.row, style]}>
      {warn ? <Icon name="warning" size={14} color={colors.accentText} /> : null}
      <Text size={12} weight={warn ? 600 : 400} color={warn ? colors.accentText : colors.textMuted}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
