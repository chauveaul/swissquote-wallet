import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { StepHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen, Spacer } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Overline, Text } from '@/components/Text';
import { parseBackup, type BackupFile } from '@/features/wallet/backup';
import { pickBackupFile } from '@/features/wallet/backupFile';
import { isValidMnemonic, isWordInList, normalizeWords, type PhraseLength } from '@/features/wallet/mnemonic';
import { usePreventScreenshots } from '@/features/wallet/usePreventScreenshots';
import { closeKeyboard } from '@/lib/keyboard';
import { BackupImportScreen } from '@/screens/BackupImportScreen';
import { colors, fonts, radii } from '@/theme/tokens';

const LENGTHS = [
  { value: 12, label: '12 words' },
  { value: 24, label: '24 words' },
] as const;

type Props = {
  /** `restore`: first-run import (a password step follows). `add`: import as an extra account. */
  flow: 'restore' | 'add';
  /** Called with a valid phrase. Throwing shows the error's message. */
  onPhrase: (phrase: string) => void | Promise<void>;
};

const failureMessage = (e: unknown) => (e instanceof Error ? e.message : 'This recovery phrase could not be used.');

/** 03b Restore wallet (recovery) */
export function RestoreScreen({ flow, onPhrase }: Props) {
  usePreventScreenshots('restore');

  const adding = flow === 'add';
  const [length, setLength] = useState<PhraseLength>(12);
  const [show, setShow] = useState(false);
  const [words, setWords] = useState<string[]>(() => Array(24).fill(''));
  const [touched, setTouched] = useState<boolean[]>(() => Array(24).fill(false));
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);
  const [importing, setImporting] = useState<{ name: string; backup: BackupFile } | null>(null);

  const fieldHeight = length === 24 ? 34 : 44;
  const visible = words.slice(0, length);

  const setWord = (index: number, text: string) => {
    setError(null);
    const parts = text.trim().split(/\s+/);
    // Pasting a whole phrase into any field spreads it across the grid.
    if (parts.length > 1) {
      if (parts.length === 24) setLength(24);
      setWords((prev) => {
        const next = [...prev];
        parts.slice(0, 24 - index).forEach((w, i) => (next[index + i] = w.toLowerCase()));
        return next;
      });
      setTouched((prev) => prev.map((t, i) => (i >= index && i < index + parts.length ? true : t)));
      return;
    }
    setWords((prev) => prev.map((w, i) => (i === index ? text.replace(/\s/g, '').toLowerCase() : w)));
  };

  const markTouched = (index: number) =>
    setTouched((prev) => prev.map((t, i) => (i === index ? true : t)));

  const importFile = async () => {
    setError(null);
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      setImporting({ name: picked.name, backup: parseBackup(picked.contents) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be opened.');
    }
  };

  const applyPhrase = async (phrase: string) => {
    try {
      await closeKeyboard();
      await onPhrase(phrase);
      return true;
    } catch (e) {
      setError(failureMessage(e));
      return false;
    }
  };

  const submit = async () => {
    const phrase = normalizeWords(visible);
    if (visible.some((w) => !w.trim())) {
      setError(`Enter all ${length} words.`);
      return;
    }
    if (!isValidMnemonic(phrase)) {
      setError('This recovery phrase isn’t valid. Check the words and their order.');
      return;
    }
    if (await applyPhrase(phrase)) setWords(Array(24).fill(''));
  };

  if (importing) {
    return (
      <BackupImportScreen
        fileName={importing.name}
        backup={importing.backup}
        onCancel={() => setImporting(null)}
        onUnlocked={(phrase) => {
          setImporting(null);
          void applyPhrase(phrase);
        }}
      />
    );
  }

  return (
    <Screen gap={18}>
      <StepHeader step={adding ? 2 : 1} total={2} />

      <View style={styles.intro}>
        <Overline>{adding ? 'Add account · Step 2 of 2' : 'Restore wallet · Step 1 of 2'}</Overline>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Enter your secret recovery phrase
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          Type the words in the order you wrote them down. Your phrase never leaves this device.
        </Text>
      </View>

      <View style={styles.toolbar}>
        <SegmentedControl
          accessibilityLabel="Phrase length"
          options={LENGTHS}
          value={length}
          onChange={(v) => {
            setLength(v);
            setError(null);
          }}
          style={styles.lengths}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: show }}
          onPress={() => setShow((s) => !s)}
          style={styles.showToggle}
        >
          <Icon name="eye" size={18} />
          <Text size={14} weight={600}>
            {show ? 'Hide words' : 'Show words'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {visible.map((word, i) => {
          const invalid = touched[i] && word.length > 0 && !isWordInList(word);
          return (
            <View
              key={i}
              style={[styles.field, { height: fieldHeight }, invalid && { borderColor: colors.accentText }]}
            >
              <Text mono size={12} color={colors.textMuted} style={styles.fieldIndex}>
                {i + 1}
              </Text>
              <TextInput
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                accessibilityLabel={`Word ${i + 1}`}
                accessibilityHint={invalid ? 'Not a recovery phrase word' : undefined}
                value={word}
                onChangeText={(t) => setWord(i, t)}
                onBlur={() => markTouched(i)}
                onSubmitEditing={() => (i + 1 < length ? inputs.current[i + 1]?.focus() : submit())}
                returnKeyType={i + 1 < length ? 'next' : 'done'}
                submitBehavior={i + 1 < length ? 'submit' : 'blurAndSubmit'}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                importantForAutofill="no"
                textContentType="none"
                selectionColor={colors.accent}
                style={styles.fieldInput}
              />
            </View>
          );
        })}
      </View>

      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
          {error}
        </Text>
      ) : null}

      <Callout size={13}>
        Only enter your phrase in this app. Swissquote will never ask for it by phone, e-mail or chat.
      </Callout>

      {/* Not in the design: restore from an encrypted backup file instead of typing. */}
      <Button
        label="Import backup file"
        variant="secondary"
        icon="file"
        iconSize={18}
        height={48}
        fontSize={15}
        onPress={importFile}
      />

      <Spacer />

      <View style={styles.footer}>
        <Button label={adding ? 'Add account' : 'Continue'} onPress={submit} />
        {adding ? null : (
          <Text size={12} color={colors.textMuted} align="center">
            Next: set a new password for this device
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  lengths: { width: 170 },
  showToggle: { height: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: {
    // Three columns: (100% − 2 × 8px) / 3
    width: '31.6%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  fieldIndex: { width: 18 },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
    outlineWidth: 0,
  },
  footer: { gap: 8 },
});
