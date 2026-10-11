import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { Checkbox } from '@/components/Checkbox';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { signOut, signOutAccount } from '@/features/wallet/signOut';
import { useSelectedAccount, useWallet } from '@/features/wallet/store';
import { WrongPasswordError } from '@/features/wallet/vault';
import { closeKeyboard } from '@/lib/keyboard';
import { colors, radii } from '@/theme/tokens';

type Props = { onCancel: () => void };

type Scope = 'account' | 'all';

function ScopeOption({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={styles.flex}>
        <Text size={15} weight={600}>
          {title}
        </Text>
        <Text size={13} lineHeight={1.4} color={colors.textSecondary}>
          {detail}
        </Text>
      </View>
      {selected ? <Icon name="check" size={20} strokeWidth={2.4} /> : null}
    </Pressable>
  );
}

/**
 * Sign out: removes the selected account, or every account, from the device.
 * With a single account there is nothing to choose. Not drawn in the design;
 * built from its components.
 *
 * Rendered as a wallet route when unlocked and inline on Unlock when locked,
 * never as a route shared by both states: the router would otherwise restore
 * it after the next wallet is set up.
 */
export function SignOutScreen({ onCancel }: Props) {
  const unlocked = useWallet((s) => s.status === 'unlocked');
  const verifyPassword = useWallet((s) => s.verifyPassword);
  const accountCount = useWallet((s) => s.meta?.accounts.length ?? 0);
  const account = useSelectedAccount();
  const multiple = accountCount > 1;
  const [scope, setScope] = useState<Scope>('account');
  const all = !multiple || scope === 'all';

  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savedLabel =
    multiple && all
      ? 'I’ve written down the recovery phrase of every account and stored them safely.'
      : 'I’ve written down my secret recovery phrase and stored it safely.';

  const submit = async () => {
    setSubmitted(true);
    setPasswordError(null);
    if (!saved) return;
    if (!password) {
      setPasswordError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    try {
      await closeKeyboard();
      if (all) {
        await verifyPassword(password);
        await signOut();
        // Route guards now send the user to Welcome.
      } else {
        await signOutAccount(account.index, password);
        // The next account is selected; the wallet stays as it was (unlocked or locked).
        onCancel();
      }
    } catch (e) {
      setPasswordError(e instanceof WrongPasswordError ? 'Incorrect password. Try again.' : 'Could not sign out.');
      setBusy(false);
    }
  };

  return (
    <Screen gap={24}>
      <NavHeader title="Sign out" onBack={onCancel} />

      <View style={styles.intro}>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          {all ? 'Remove this wallet from your device' : `Remove ${account.name} from your device`}
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          {all
            ? 'Signing out deletes this wallet’s keys from this phone so you can create or import a different one.'
            : 'Signing out deletes this account’s keys from this phone. Your other accounts stay as they are.'}{' '}
          Funds stay on the blockchain, but you can only get back in with the secret recovery phrase.
        </Text>
      </View>

      {multiple ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Sign out of" style={styles.options}>
          <ScopeOption
            title={`Only ${account.name}`}
            detail="Keep your other accounts on this device."
            selected={scope === 'account'}
            onPress={() => setScope('account')}
          />
          <ScopeOption
            title={`All ${accountCount} accounts`}
            detail="Remove the whole wallet, including its password."
            selected={scope === 'all'}
            onPress={() => setScope('all')}
          />
        </View>
      ) : null}

      <Callout>Swissquote can never restore your wallet. Without your recovery phrase, your funds are lost for good.</Callout>

      {unlocked ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/recovery-phrase')} style={styles.link}>
          <Text size={15} weight={600} color={colors.accentText}>
            {multiple && !all ? `View ${account.name}’s recovery phrase first` : 'View my recovery phrase first'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.fields}>
        <Checkbox
          checked={saved}
          onChange={setSaved}
          invalid={submitted && !saved}
          accessibilityLabel={savedLabel}
        >
          <Text size={14} lineHeight={1.4} color={colors.textSecondary}>
            {savedLabel}
          </Text>
        </Checkbox>
        {submitted && !saved ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
            {multiple && all
              ? 'Confirm you have every account’s recovery phrase before signing out.'
              : 'Confirm you have your recovery phrase before signing out.'}
          </Text>
        ) : null}

        <PasswordField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          onSubmitEditing={submit}
          returnKeyType="done"
          error={passwordError}
        />
      </View>

      <Spacer />

      <View style={styles.actions}>
        <Button label={all ? 'Sign out and remove wallet' : `Sign out of ${account.name}`} onPress={submit} loading={busy} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: 10 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  link: { height: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  fields: { gap: 20 },
  actions: { gap: 12 },
});
