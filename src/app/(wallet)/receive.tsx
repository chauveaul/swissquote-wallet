import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { AccountAvatar } from '@/components/Marks';
import { Screen } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { accountColor } from '@/features/wallet/accountColor';
import { useNetworkId, useSelectedAccount } from '@/features/wallet/store';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

/** 07 Receive */
export default function Receive() {
  const account = useSelectedAccount();
  const network = getNetwork(useNetworkId());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    await Clipboard.setStringAsync(account.address);
    setCopied(true);
  };

  return (
    <Screen background={colors.surfaceMuted} gap={24}>
      <NavHeader title="Receive" />

      <View style={styles.card}>
        <View style={styles.account}>
          <AccountAvatar color={accountColor(account.index)} size={24} />
          <Text size={15} weight={700}>
            {account.name}
          </Text>
        </View>

        <View accessible accessibilityRole="image" accessibilityLabel="QR code for wallet address" style={styles.qr}>
          <QRCode value={account.address} size={196} color={colors.inkStrong} backgroundColor={colors.surface} ecl="M" />
        </View>

        <View style={styles.address}>
          <Overline>Your {network.shortName} address</Overline>
          <Text mono selectable size={14} lineHeight={1.5} align="center" style={styles.addressText}>
            {account.address}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={copied ? 'Copied' : 'Copy'}
            icon={copied ? 'check' : 'copy'}
            iconSize={18}
            height={48}
            fontSize={15}
            style={styles.flex}
            onPress={copy}
          />
          <Button
            label="Share"
            icon="share"
            iconSize={18}
            height={48}
            fontSize={15}
            variant="secondary"
            style={styles.flex}
            onPress={() => Share.share({ message: account.address })}
          />
        </View>
      </View>

      <Callout tone="info" background={colors.surface}>
        Only send assets on <Text size={14} weight={700}>{network.name}</Text> to this address. Assets sent from
        other networks may be lost.
      </Callout>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
    borderTopWidth: 4,
    borderTopColor: colors.accent,
  },
  account: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qr: {
    width: 222,
    height: 222,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  address: { alignItems: 'center', gap: 6 },
  addressText: { maxWidth: 260 },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
});
