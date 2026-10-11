import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Overline, Text } from '@/components/Text';
import { useSelectedAccount, useWallet } from '@/features/wallet/store';
import { formatAutoLock } from '@/lib/autoLock';
import { networks } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

type Row = { label: string; value?: string; href?: Href; destructive?: boolean };

/** 11 Settings */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const lock = useWallet((s) => s.lock);
  const meta = useWallet((s) => s.meta);
  const account = useSelectedAccount();
  const multipleAccounts = (meta?.accounts.length ?? 0) > 1;
  const biometrics = meta?.biometrics ?? false;
  const autoLock = formatAutoLock(meta?.autoLockMs ?? 60_000);
  const contacts = meta?.contacts.length ?? 0;
  const swissquote = meta?.swissquote ?? null;

  // Destination screens other than "Reveal recovery phrase" and "Networks" aren't drawn in the design.
  const sections: { label: string; rows: Row[] }[] = [
    {
      label: 'Security & privacy',
      rows: [
        // Each account has its own phrase: this one belongs to the selected account.
        { label: 'Reveal recovery phrase', value: multipleAccounts ? account.name : undefined, href: '/recovery-phrase' },
        { label: 'Biometrics & auto-lock', value: `${biometrics ? '' : 'Off · '}${autoLock}`, href: '/security' },
        { label: 'Connected sites', value: String(meta?.connectedSites.length ?? 0), href: '/connected-sites' },
        // Not in the design: removes the wallet so a different one can be used.
        { label: 'Sign out', href: '/sign-out', destructive: true },
      ],
    },
    {
      label: 'General',
      rows: [
        { label: 'Display currency', value: meta?.currency ?? 'CHF', href: '/currency' },
        { label: 'Networks', value: String(networks.length), href: '/accounts' },
        { label: 'Contacts', value: contacts ? String(contacts) : undefined, href: '/contacts' },
      ],
    },
    {
      label: 'Support',
      rows: [
        { label: 'Help centre', href: '/help' },
        { label: 'About', href: '/about' },
      ],
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Text accessibilityRole="header" size={28} weight={700} tracking={-0.01} style={styles.title}>
        Settings
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Not drawn in the design: links to a mock Swissquote server, see swissquote-account.tsx. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(swissquote ? '/swissquote-account' : '/link-swissquote')}
          style={styles.promo}
        >
          <View style={styles.promoIcon}>
            <Icon name="link" size={20} color={colors.inkStrong} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text size={15} weight={700} color={colors.surface}>
              {swissquote ? `Linked to ${swissquote.name}` : 'Link your Swissquote account'}
            </Text>
            <Text size={13} color={colors.onDarkMuted}>
              Move funds between your bank account and wallet
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.surface} strokeWidth={2.2} />
        </Pressable>

        {sections.map((section) => (
          <View key={section.label} style={styles.section}>
            <Overline accessibilityRole="header" style={styles.sectionLabel}>
              {section.label}
            </Overline>
            <View style={styles.group}>
              {section.rows.map((row) => (
                <Pressable
                  key={row.label}
                  accessibilityRole="button"
                  accessibilityLabel={row.value ? `${row.label}, ${row.value}` : row.label}
                  onPress={row.href ? () => router.push(row.href!) : undefined}
                  style={styles.row}
                >
                  <Text
                    size={15}
                    weight={row.destructive ? 600 : 500}
                    color={row.destructive ? colors.accentText : colors.ink}
                    style={styles.flex}
                  >
                    {row.label}
                  </Text>
                  {row.value ? (
                    <Text size={14} color={colors.textMuted}>
                      {row.value}
                    </Text>
                  ) : null}
                  <Icon name="chevronRight" size={16} color={colors.iconMuted} strokeWidth={2.2} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Button label="Lock wallet" variant="secondary" icon="lock" iconSize={18} height={48} fontSize={15} onPress={lock} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  flex: { flex: 1 },
  title: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 12 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 12 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: colors.inkStrong,
    borderRadius: radii.sm,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: 6 },
  sectionLabel: { paddingHorizontal: 8 },
  group: { backgroundColor: colors.surface, borderRadius: radii.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // 48px + 1px divider (content-box in the design).
    minHeight: 49,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
