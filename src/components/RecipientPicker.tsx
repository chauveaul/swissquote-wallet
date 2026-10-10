import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Address } from 'viem';

import type { Contact } from '@/features/market/types';
import { accountColor } from '@/features/wallet/accountColor';
import type { AccountMeta } from '@/features/wallet/store';
import { truncateAddress } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { AccountAvatar } from './Marks';
import { Overline, Text } from './Text';

type Props = {
  visible: boolean;
  /** Accounts of this wallet other than the sending one. */
  accounts: readonly AccountMeta[];
  contacts: readonly Contact[];
  onSelect: (address: Address) => void;
  onClose: () => void;
  onAddAccount: () => void;
  onManageContacts: () => void;
};

function Row({ label, address, leading, onPress }: { label: string; address: Address; leading: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${address}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {leading}
      <View style={styles.rowMain}>
        <Text size={15} weight={600}>
          {label}
        </Text>
        <Text mono size={12} color={colors.textMuted}>
          {truncateAddress(address, 6, 6)}
        </Text>
      </View>
    </Pressable>
  );
}

function Hint({ children, action, onPress }: { children: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.hint}>
      <Text size={14} lineHeight={1.4} color={colors.textMuted}>
        {children}{' '}
        <Text size={14} weight={600} color={colors.accentText} onPress={onPress}>
          {action}
        </Text>
      </Text>
    </View>
  );
}

/** Bottom sheet to pick a recipient: own accounts and saved contacts. Not drawn in the design. */
export function RecipientPicker({
  visible,
  accounts,
  contacts,
  onSelect,
  onClose,
  onAddAccount,
  onManageContacts,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const match = (name: string, address: string) =>
    !q || name.toLowerCase().includes(q) || address.toLowerCase().includes(q);
  const shownAccounts = accounts.filter((a) => match(a.name, a.address));
  const shownContacts = contacts.filter((c) => match(c.name, c.address));

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (address: Address) => {
    onSelect(address);
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" size={17} weight={700}>
              Send to
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Search accounts and contacts"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or address"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.accent}
              style={styles.searchInput}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={styles.list}>
            <Overline accessibilityRole="header" style={styles.section}>
              Your accounts
            </Overline>
            {shownAccounts.map((a) => (
              <Row
                key={a.address}
                label={a.name}
                address={a.address}
                leading={<AccountAvatar color={accountColor(a.index)} />}
                onPress={() => pick(a.address)}
              />
            ))}
            {accounts.length === 0 ? (
              <Hint action="Add an account" onPress={onAddAccount}>
                This wallet has only one account.
              </Hint>
            ) : shownAccounts.length === 0 ? (
              <Hint action="Clear search" onPress={() => setQuery('')}>
                No account matches.
              </Hint>
            ) : null}

            <Overline accessibilityRole="header" style={styles.section}>
              Contacts
            </Overline>
            {shownContacts.map((c) => (
              <Row
                key={c.address}
                label={c.name}
                address={c.address}
                leading={
                  <View style={styles.contactMark}>
                    <Text size={15} weight={700}>
                      {c.name.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
                onPress={() => pick(c.address)}
              />
            ))}
            {contacts.length === 0 ? (
              <Hint action="Add contacts" onPress={onManageContacts}>
                No saved contacts yet.
              </Hint>
            ) : shownContacts.length === 0 ? (
              <Hint action="Clear search" onPress={() => setQuery('')}>
                No contact matches.
              </Hint>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,18,18,0.45)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sm * 3,
    borderTopRightRadius: radii.sm * 3,
    paddingTop: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  search: {
    marginHorizontal: 24,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    outlineWidth: 0,
  },
  list: { flexGrow: 0 },
  section: { paddingTop: 12, paddingBottom: 6, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMain: { flex: 1, gap: 2 },
  contactMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { paddingHorizontal: 24, paddingVertical: 10 },
});
