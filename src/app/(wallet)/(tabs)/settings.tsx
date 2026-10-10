import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Overline, Text } from '@/components/Text';
import { useWallet } from '@/features/wallet/store';
import { AUTO_LOCK_MS, DEMO_MODE } from '@/lib/config';
import { networks } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

type Row = { label: string; value?: string; href?: Href };

/** 11 Settings */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const lock = useWallet((s) => s.lock);
  const biometrics = useWallet((s) => s.meta?.biometrics ?? false);

  // Rows without `href` have no screen in the design yet.
  const sections: { label: string; rows: Row[] }[] = [
    {
      label: 'Security & privacy',
      rows: [
        { label: 'Reveal recovery phrase', href: '/recovery-phrase' },
        { label: 'Face ID & auto-lock', value: `${biometrics ? '' : 'Off · '}${AUTO_LOCK_MS / 60_000} min` },
        { label: 'Connected sites', value: DEMO_MODE ? '3' : '0' },
      ],
    },
    {
      label: 'General',
      rows: [
        { label: 'Display currency', value: 'CHF' },
        { label: 'Networks', value: String(networks.length), href: '/accounts' },
        { label: 'Contacts' },
      ],
    },
    {
      label: 'Support',
      rows: [{ label: 'Help centre' }, { label: 'About' }],
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Text accessibilityRole="header" size={28} weight={700} tracking={-0.01} style={styles.title}>
        Settings
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Swissquote account linking has no flow in the design yet. */}
        <Pressable accessibilityRole="button" style={styles.promo}>
          <View style={styles.promoIcon}>
            <Icon name="link" size={20} color={colors.inkStrong} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text size={15} weight={700} color={colors.surface}>
              Link your Swissquote account
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
                  <Text size={15} weight={500} style={styles.flex}>
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
