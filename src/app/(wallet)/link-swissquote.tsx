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
import { useNetworkId, useSelectedAccount, useWallet } from '@/features/wallet/store';
import {
  getCustodialAddress,
  linkSwissquoteAccount,
  listDemoCustomers,
  loginSwissquote,
  requestLinkChallenge,
  type DemoCustomer,
} from '@/services/swissquoteMock';
import { colors } from '@/theme/tokens';

/**
 * Not drawn in the design. Links this wallet to a MOCK Swissquote account —
 * a fake customer directory + CHF ledger, run separately (`npm run
 * swissquote:mock`), not a real bank backend. The PIN below is a fixed demo
 * value; a real integration would never work this way.
 *
 * What's real: the customer signs in (PIN, server session), the server
 * issues a single-use EIP-4361 challenge naming the customer, address and
 * network, this account signs exactly that, and the server verifies it, checks
 * the address is still solely key-controlled and screens it against sanctions
 * lists before recording the link — the ownership proof FINMA requires for
 * transfers to and from a customer's own wallet.
 */
export default function LinkSwissquote() {
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const getSigner = useWallet((s) => s.getSigner);
  const linkSwissquote = useWallet((s) => s.linkSwissquote);
  const [picked, setPicked] = useState<DemoCustomer | null>(null);
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
      await loginSwissquote(picked.accountNumber, pin);

      const approved = await confirmUserPresence('Link Swissquote account');
      if (!approved) {
        setBusy(false);
        return;
      }

      // The server writes the message; signing our own text would let any old
      // signature from this address be replayed as a proof.
      const { message } = await requestLinkChallenge(account.address, networkId);
      const signature = await getSigner(account.index).signMessage({ message });

      const linked = await linkSwissquoteAccount(signature);
      if (!linked.linkedAddress) throw new Error('Linking failed.');
      // `linked.linkedAddress` is an echo of *this wallet's own* address (what
      // got linked) — not Swissquote's deposit address. Fetch that separately.
      const custodialAddress = await getCustodialAddress();

      await linkSwissquote({
        customerId: linked.id,
        name: linked.name,
        accountNumber: linked.accountNumber,
        custodialAddress,
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
        <NavHeader title="Link Swissquote account" onBack={() => router.dismissTo('/settings')} />
      </View>

      <Callout tone="info">
        You’re in demo mode: choose a sample account below. For every account, the PIN is{' '}
        <Text weight={700}>0000</Text>.
      </Callout>

      <SettingsGroup label="Choose an account">
        {isLoading ? (
          <SettingsRow label="Loading…" />
        ) : !customers?.length ? (
          <SettingsRow label="Can’t reach Swissquote" detail="Check your connection and try again." />
        ) : (
          customers.map((c, i) => (
            <SettingsRow
              key={c.id}
              role="radio"
              label={c.name}
              detail={`Account ${c.accountNumber}${c.linked ? ' · already linked to a wallet' : ''}`}
              selected={picked?.id === c.id}
              onPress={() => (c.linked ? undefined : setPicked(c))}
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

      {picked ? (
        <Text size={13} color={colors.textSecondary}>
          Next, {account.name} signs a one-time Sign-In with Ethereum message confirming you alone control{' '}
          this wallet. Swissquote checks it, screens the address against sanctions lists, and from then on
          only ever withdraws to this address.
        </Text>
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
