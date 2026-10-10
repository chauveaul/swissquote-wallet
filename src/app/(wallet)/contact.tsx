import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { NavHeader } from '@/components/Header';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { parseRecipient, useSendDraft } from '@/features/send/draft';
import { useScanResult } from '@/features/send/scanResult';
import { useWallet } from '@/features/wallet/store';
import { colors } from '@/theme/tokens';

/** Add or edit a contact. Not drawn in the design; built from Send's form style. */
export default function ContactEditor() {
  const params = useLocalSearchParams<{ address?: string }>();
  const existing = useWallet((s) =>
    params.address ? s.meta?.contacts.find((c) => c.address.toLowerCase() === params.address!.toLowerCase()) : undefined,
  );
  const saveContact = useWallet((s) => s.saveContact);
  const deleteContact = useWallet((s) => s.deleteContact);
  const setTo = useSendDraft((s) => s.setTo);

  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState<string>(existing?.address ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const addressRef = useRef<TextInput>(null);

  // Coming back from the scanner: take the scanned address, if any.
  useFocusEffect(
    useCallback(() => {
      const scanned = useScanResult.getState().take();
      if (scanned) {
        setAddress(scanned);
        setFailure(null);
      }
    }, []),
  );

  const parsed = parseRecipient(address.trim());
  const nameError = !name.trim() ? 'Enter a name.' : null;
  const addressError = !address.trim()
    ? 'Enter an address.'
    : !parsed
      ? 'This isn’t a valid Ethereum address. Check every character.'
      : null;

  const save = async () => {
    setSubmitted(true);
    setFailure(null);
    if (nameError || addressError || !parsed) return;
    try {
      await saveContact({ name: name.trim(), address: parsed }, existing?.address);
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The contact couldn’t be saved.');
    }
  };

  return (
    <Screen gap={24}>
      <NavHeader title={existing ? 'Edit contact' : 'Add contact'} />

      <View style={styles.fields}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setFailure(null);
          }}
          placeholder="e.g. Mia (Ledger)"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
          error={submitted ? nameError : null}
        />
        <TextField
          ref={addressRef}
          label="Address"
          mono
          value={address}
          onChangeText={(v) => {
            setAddress(v.trim());
            setFailure(null);
          }}
          placeholder="0x…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
          error={submitted ? addressError : null}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan QR code"
              onPress={() => router.push({ pathname: '/scan', params: { purpose: 'contact' } })}
              style={styles.scan}
            >
              <Icon name="scan" size={20} />
            </Pressable>
          }
        />
        <Text size={13} lineHeight={1.4} color={colors.textMuted}>
          Scan the recipient’s QR code or paste the address they sent you. Never copy it from a screenshot or e-mail you
          didn’t expect.
        </Text>
      </View>

      <Spacer />

      <View style={styles.actions}>
        {failure ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {failure}
          </Text>
        ) : null}
        <Button label="Save contact" onPress={save} />
        {existing ? (
          <>
            <Button
              label={`Send to ${existing.name}`}
              variant="secondary"
              icon="send"
              iconSize={18}
              onPress={() => {
                setTo(existing.address);
                router.push('/send');
              }}
            />
            <Button
              label="Delete contact"
              variant="secondary"
              onPress={async () => {
                await deleteContact(existing.address);
                router.back();
              }}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 20 },
  actions: { gap: 12 },
  scan: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
