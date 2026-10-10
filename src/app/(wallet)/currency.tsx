import { StyleSheet, View } from 'react-native';

import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { useWallet } from '@/features/wallet/store';
import { CURRENCIES } from '@/lib/currency';
import { colors } from '@/theme/tokens';

/** Settings → Display currency. Not drawn in the design; built from the Settings list style. */
export default function DisplayCurrency() {
  const current = useWallet((s) => s.meta?.currency ?? 'CHF');
  const setCurrency = useWallet((s) => s.setCurrency);

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Display currency" />
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Display currency">
        <SettingsGroup
          label="Show values in"
          footer="Balances, prices and fees are converted for display. Purchases are always paid in CHF from your Swissquote account. Exchange rates are indicative (demo)."
        >
          {CURRENCIES.map((c, i) => (
            <SettingsRow
              key={c.code}
              role="radio"
              label={c.code}
              detail={c.name}
              selected={c.code === current}
              onPress={() => setCurrency(c.code)}
              last={i === CURRENCIES.length - 1}
            />
          ))}
        </SettingsGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
});
