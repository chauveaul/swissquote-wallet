import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useSelectedAccount, useWallet } from '@/features/wallet/store';
import {
  linkSwissquoteAccount,
  listDemoCustomers,
  loginSwissquote,
  type SwissquoteCustomer,
} from '@/services/swissquoteMock';
import { colors } from '@/theme/tokens';

/**
 * Not drawn in the design. Links this wallet to a MOCK Swissquote account —
 * a fake customer directory + CHF ledger, run separately (`npm run
 * swissquote:mock`), not a real bank backend. The PIN below is a fixed demo
 * value; a real integration would never work this way.
 *
 * What's real: the account picked here signs a message proving it controls
 * this address, and the mock server verifies that signature before
 * recording the link — the actual ownership check the Travel Rule requires.
 */
export default function LinkSwissquote() {
  const account = useSelectedAccount();
  const getSigner = useWallet((s) => s.getSigner);
  const linkSwissquote = useWallet((s) => s.linkSwissquote);
  const [picked, setPicked] = useState<SwissquoteCustomer | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['swissquote', 'customers'],
    queryFn: listDemoCustomers,
    retry: false,
  });

  const link = async () => {
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      const customer = await loginSwissquote(picked.accountNumber, pin);

      const approved = await confirmUserPresence('Link Swissquote account');
      if (!approved) {
        setBusy(false);
        return;
      }

      const signer = getSigner(account.index);
      const message = `Link wallet ${account.address} to Swissquote account ${customer.id} (${customer.accountNumber}) at ${new Date().toISOString()}`;
      const signature = await signer.signMessage({ message });

      const linked = await linkSwissquoteAccount(customer.id, account.address, message, signature);
      if (!linked.linkedAddress) throw new Error('Linking failed.');

      await linkSwissquote({
        customerId: linked.id,
        name: linked.name,
        accountNumber: linked.accountNumber,
        custodialAddress: linked.linkedAddress,
        linkedAt: linked.linkedAt ?? new Date().toISOString(),
      });
      router.dismissTo('/swissquote-account');
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Could not link this account.');
      setBusy(false);
    }
  };

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Link Swissquote account" />
      </View>

      <Callout tone="info">
        Demo only: this is a mock Swissquote server with fake customers, not a real bank. The PIN
        for every account below is <Text weight={700}>0000</Text>.
      </Callout>

      <SettingsGroup label="Choose a demo account">
        {isLoading ? (
          <SettingsRow label="Loading…" />
        ) : !customers?.length ? (
          <SettingsRow label="Mock server unreachable" detail="Run `npm run swissquote:mock` and try again." />
        ) : (
          customers.map((c, i) => (
            <SettingsRow
              key={c.id}
              role="radio"
              label={c.name}
              detail={`Account ${c.accountNumber}${c.linkedAddress ? ' · already linked to a wallet' : ''}`}
              selected={picked?.id === c.id}
              onPress={() => (c.linkedAddress ? undefined : setPicked(c))}
              last={i === customers.length - 1}
            />
          ))
        )}
      </SettingsGroup>

      {picked ? (
        <PasswordField
          label={`PIN for ${picked.name}`}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          placeholder="0000"
        />
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
          {error}
        </Text>
      ) : null}

      <Spacer />

      <Button label="Link account" onPress={link} loading={busy} disabled={!picked || pin.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
});
