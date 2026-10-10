import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { AccountAvatar, TokenPill } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { RecipientPicker } from '@/components/RecipientPicker';
import { Overline, Text } from '@/components/Text';
import { useSpotPrice, useToken } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import type { Contact } from '@/features/market/types';
import type { AccountMeta } from '@/features/wallet/store';
import { feeFor, parseRecipient, useSendDraft } from '@/features/send/draft';
import { identifyRecipient } from '@/features/send/recipient';
import { accountColor } from '@/features/wallet/accountColor';
import { useSelectedAccount, useWallet } from '@/features/wallet/store';
import { formatNumber, truncateAddress } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** 05 Send */
const NO_CONTACTS: Contact[] = [];
const NO_ACCOUNTS: AccountMeta[] = [];

export default function Send() {
  const fiat = useFiat();
  const account = useSelectedAccount();
  const eth = useToken(account.index, 'ETH');
  const { to, amount, speed, setTo, setAmount } = useSendDraft();
  const [submitted, setSubmitted] = useState(false);
  const [picking, setPicking] = useState(false);

  const balance = eth?.amount ?? 0;
  const recipient = parseRecipient(to);
  const contacts = useWallet((s) => s.meta?.contacts ?? NO_CONTACTS);
  const accounts = useWallet((s) => s.meta?.accounts ?? NO_ACCOUNTS);
  const known = identifyRecipient(recipient, account.index, accounts, contacts);
  const value = Number(amount) || 0;
  const ethChf = useSpotPrice('ETH');
  const fee = feeFor(speed, ethChf).eth;

  const amountError =
    value <= 0 ? 'Enter an amount.' : value + fee > balance ? 'Insufficient balance to cover amount and network fee.' : null;
  const toError = !to
    ? 'Enter a recipient address.'
    : !recipient
      ? 'This isn’t a valid Ethereum address.'
      : known?.kind === 'self'
        ? 'This is the account you’re sending from. Choose another recipient.'
        : null;

  const review = () => {
    setSubmitted(true);
    if (toError || amountError) return;
    router.push('/review');
  };

  return (
    <Screen gap={20}>
      <NavHeader title="Send" />

      <View style={styles.section}>
        <Overline>From</Overline>
        <View style={styles.fromCard}>
          <AccountAvatar color={accountColor(account.index)} />
          <View style={styles.fromMain}>
            <Text size={15} weight={600}>
              {account.name}
            </Text>
            <Text mono size={12} color={colors.textMuted}>
              {truncateAddress(account.address)}
            </Text>
          </View>
          <Text size={13} color={colors.textSecondary}>
            {formatNumber(balance, 4)} ETH
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.amountHeader}>
          <Overline>To</Overline>
          {/* Not in the design: pick one of your accounts or a saved contact. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from your accounts and contacts"
            onPress={() => setPicking(true)}
            style={styles.maxChip}
          >
            <Text size={13} weight={700}>
              Accounts & contacts
            </Text>
          </Pressable>
        </View>
        <View style={[styles.toField, submitted && toError ? { borderColor: colors.accent } : null]}>
          <TextInput
            accessibilityLabel="Recipient address"
            value={to}
            onChangeText={setTo}
            placeholder="0x…"
            placeholderTextColor={colors.iconMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            selectionColor={colors.accent}
            style={styles.toInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
            onPress={() => router.push({ pathname: '/scan', params: { from: 'send' } })}
            style={styles.iconButton}
          >
            <Icon name="scan" size={20} />
          </Pressable>
        </View>
        {known?.kind === 'self' ? (
          <View style={styles.status}>
            <Icon name="warning" size={16} color={colors.accentText} />
            <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} style={styles.flex}>
              {toError}
            </Text>
          </View>
        ) : known ? (
          <View style={styles.status}>
            <Icon name="check" size={16} color={colors.positive} strokeWidth={2.4} />
            <Text size={13} weight={600} color={colors.positive}>
              {known.kind === 'account' ? 'Your account' : 'Saved contact'} · {known.name}
            </Text>
          </View>
        ) : recipient ? (
          <View style={styles.status}>
            <Icon name="info" size={16} color={colors.textMuted} />
            <Text size={13} weight={600} color={colors.textMuted} style={styles.flex}>
              New address · check {truncateAddress(recipient, 6, 6)} in full before sending
            </Text>
          </View>
        ) : submitted && toError ? (
          <View style={styles.status}>
            <Icon name="warning" size={16} color={colors.accentText} />
            <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
              {toError}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.amountHeader}>
          <Overline>Amount</Overline>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use maximum amount"
            onPress={() => setAmount(Math.max(balance - fee, 0).toFixed(4))}
            style={styles.maxChip}
          >
            <Text size={13} weight={700}>
              Max
            </Text>
          </Pressable>
        </View>
        <View style={[styles.amountBox, submitted && amountError ? styles.amountBoxError : null]}>
          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0000"
              placeholderTextColor={colors.iconMuted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              selectionColor={colors.accent}
              style={styles.amountInput}
            />
            <TokenPill symbol="ETH" color={colors.token.ETH} />
          </View>
          <View style={styles.amountMeta}>
            <Text size={14} color={colors.textSecondary}>
              ≈ {fiat.format(ethChf === null ? null : value * ethChf)}
            </Text>
            <Text size={14} color={colors.textSecondary}>
              Balance {formatNumber(balance, 4)} ETH
            </Text>
          </View>
        </View>
        {submitted && amountError ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
            {amountError}
          </Text>
        ) : null}
      </View>

      <Spacer />

      <Button label="Review" onPress={review} />

      <RecipientPicker
        visible={picking}
        accounts={accounts.filter((a) => a.index !== account.index)}
        contacts={contacts}
        onSelect={setTo}
        onClose={() => setPicking(false)}
        onAddAccount={() => {
          setPicking(false);
          router.push('/accounts');
        }}
        onManageContacts={() => {
          setPicking(false);
          router.push('/contacts');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  flex: { flex: 1 },
  fromCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  fromMain: { flex: 1, gap: 2 },
  toField: {
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingLeft: 12,
    paddingRight: 4,
  },
  toInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    outlineWidth: 0,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maxChip: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  amountBox: {
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
  },
  amountBoxError: { borderWidth: 1.5, borderColor: colors.accent, paddingVertical: 18.5, paddingHorizontal: 14.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 40,
    letterSpacing: -0.8,
    color: colors.ink,
    padding: 0,
    outlineWidth: 0,
  },
  amountMeta: { flexDirection: 'row', justifyContent: 'space-between' },
});
