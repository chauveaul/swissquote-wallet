import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { SUPPORT_URLS } from '@/lib/config';
import { colors } from '@/theme/tokens';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is my secret recovery phrase?',
    a: 'The 12 or 24 words created with your wallet. They are the master key to your funds: anyone who has them can take everything, and they are the only way to restore the wallet on a new device.',
  },
  {
    q: 'Can Swissquote recover my wallet?',
    a: 'No. This is a self-custody wallet: your keys are created and stored only on this device. Swissquote never has your recovery phrase or passwords, so keep your phrase or encrypted backup file safe.',
  },
  {
    q: 'What if I lose my phone?',
    a: 'Install the app on a new device, choose “Import an existing wallet” and enter your recovery phrase or import your encrypted backup file with its backup password.',
  },
  {
    q: 'Why do I pay a network fee?',
    a: 'Every transaction is processed by the blockchain network, which charges a fee in its native token (ETH on Ethereum). The fee goes to the network, not to Swissquote, and depends on how busy the network is.',
  },
  {
    q: 'How do I recognise a scam?',
    a: 'Swissquote will never ask for your recovery phrase, passwords or backup file, by phone, e-mail or chat. Check every character of an address before sending, and be wary of urgent messages or offers that look too good to be true.',
  },
  {
    q: 'What does auto-lock do?',
    a: 'It locks the wallet after the app has been in the background for the time you choose under Settings → Biometrics & auto-lock. Unlock again with your password or biometrics.',
  },
];

function Question({ q, a, last }: { q: string; a: string; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.item, !last && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.question}
      >
        <Text size={15} weight={600} style={styles.flex}>
          {q}
        </Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon name="chevronDown" size={16} color={colors.iconMuted} strokeWidth={2.2} />
        </View>
      </Pressable>
      {open ? (
        <Text size={14} lineHeight={1.5} color={colors.textSecondary} style={styles.answer}>
          {a}
        </Text>
      ) : null}
    </View>
  );
}

/** Settings → Help centre. Not drawn in the design; built from the Settings list style. */
export default function Help() {
  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Help centre" />
      </View>

      <SettingsGroup label="Frequently asked">
        {FAQ.map((f, i) => (
          <Question key={f.q} q={f.q} a={f.a} last={i === FAQ.length - 1} />
        ))}
      </SettingsGroup>

      <SettingsGroup
        label="Contact"
        footer="Swissquote support will never ask for your recovery phrase, passwords or backup file."
      >
        <SettingsRow label="Contact support" onPress={() => Linking.openURL(SUPPORT_URLS.help)} />
        <SettingsRow label="Report a security issue" onPress={() => Linking.openURL(SUPPORT_URLS.security)} last />
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  flex: { flex: 1 },
  item: { paddingHorizontal: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  question: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 49, paddingVertical: 12 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  answer: { paddingBottom: 14 },
});
