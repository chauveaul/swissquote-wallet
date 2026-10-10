import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { useWallet } from '@/features/wallet/store';
import { truncateAddress } from '@/lib/format';
import { colors } from '@/theme/tokens';

/** Settings → Contacts. Not drawn in the design; built from the Settings list style. */
export default function Contacts() {
  const contacts = useWallet((s) => s.meta?.contacts ?? []);

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Contacts" />
      </View>

      {contacts.length === 0 ? (
        <Text size={15} lineHeight={1.5} color={colors.textSecondary} align="center" style={styles.empty}>
          Save addresses you send to often. Send marks them as a saved contact, so a look-alike address stands out.
        </Text>
      ) : (
        <SettingsGroup footer="Send marks saved addresses as a saved contact, so a look-alike address stands out.">
          {contacts.map((c, i) => (
            <SettingsRow
              key={c.address}
              label={c.name}
              detail={truncateAddress(c.address, 6, 6)}
              mono
              onPress={() => router.push({ pathname: '/contact', params: { address: c.address } })}
              last={i === contacts.length - 1}
            />
          ))}
        </SettingsGroup>
      )}

      <Button
        label="Add contact"
        variant="secondary"
        icon="plus"
        iconSize={16}
        iconStrokeWidth={2.4}
        gap={6}
        height={48}
        fontSize={15}
        onPress={() => router.push('/contact')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  empty: { paddingVertical: 24, paddingHorizontal: 8 },
});
