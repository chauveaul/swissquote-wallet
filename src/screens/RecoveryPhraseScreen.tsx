import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader, StepHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useSelectedAccount, useWallet } from '@/features/wallet/store';
import { usePreventScreenshots } from '@/features/wallet/usePreventScreenshots';
import { BackupExportScreen } from '@/screens/BackupExportScreen';
import { colors, fonts, radii } from '@/theme/tokens';

/**
 * - `create`: new wallet onboarding (the draft phrase; a password step follows);
 * - `add`: new account in an existing wallet (the draft phrase; added on confirm);
 * - `reveal`: the selected account's stored phrase.
 */
type Props = { mode: 'create' | 'add' | 'reveal' };

const MASK = '••••••';

/** 02 Secret recovery phrase */
export function RecoveryPhraseScreen({ mode }: Props) {
  usePreventScreenshots('recovery-phrase');

  const draft = useWallet((s) => s.draftMnemonic);
  const revealMnemonic = useWallet((s) => s.revealMnemonic);
  const addAccount = useWallet((s) => s.addAccount);
  const account = useSelectedAccount();
  const fromDraft = mode !== 'reveal';
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [needsReveal, setNeedsReveal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const blurTarget = useRef<View | null>(null);

  // The real words never enter the view tree until the user asks to see them.
  const words = useMemo(() => (phrase ? phrase.split(' ') : Array<string>(12).fill(MASK)), [phrase]);
  const revealed = phrase !== null;

  const reveal = async () => {
    if (fromDraft) {
      setPhrase(draft);
    } else {
      const ok = await confirmUserPresence('Reveal your secret recovery phrase');
      if (ok) setPhrase(revealMnemonic());
    }
    setNeedsReveal(false);
  };

  /** The phrase for the backup file; in reveal mode this needs a fresh presence check. */
  const phraseForBackup = async () => {
    if (fromDraft) return draft;
    if (phrase) return phrase;
    const ok = await confirmUserPresence('Back up your secret recovery phrase');
    return ok ? revealMnemonic() : null;
  };

  const done = async () => {
    if (!revealed && !backedUp) {
      setNeedsReveal(true);
      return;
    }
    if (mode === 'add') {
      setAdding(true);
      setFailure(null);
      try {
        await addAccount();
      } catch (e) {
        setFailure(e instanceof Error ? e.message : 'Could not add the account.');
        setAdding(false);
        return;
      }
      setPhrase(null);
      router.dismissTo('/');
      return;
    }
    setPhrase(null);
    if (mode === 'create') router.push({ pathname: '/set-password', params: { flow: 'create' } });
    else router.back();
  };

  if (exporting) {
    return (
      <BackupExportScreen
        getPhrase={phraseForBackup}
        onCancel={() => setExporting(false)}
        onSaved={() => {
          setBackedUp(true);
          setNeedsReveal(false);
          setExporting(false);
        }}
      />
    );
  }

  return (
    <Screen paddingTop={16} gap={24}>
      {mode === 'create' ? <StepHeader step={2} total={3} /> : null}
      {mode === 'add' ? <StepHeader step={2} total={2} /> : null}
      {mode === 'reveal' ? <NavHeader /> : null}

      <View style={styles.intro}>
        {mode === 'create' ? <Overline>Step 2 of 3</Overline> : null}
        {mode === 'add' ? <Overline>Add account · Step 2 of 2</Overline> : null}
        {mode === 'reveal' ? <Overline>{account.name}</Overline> : null}
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          {fromDraft ? 'Write down your secret recovery phrase' : 'Your secret recovery phrase'}
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          {mode === 'create'
            ? `These ${words.length} words are the only way to restore your wallet.`
            : `These ${words.length} words are the only way to restore this account. Each account has its own phrase.`}{' '}
          Write them down in order and store them somewhere offline. Swissquote can never recover them for you.
        </Text>
      </View>

      <View style={styles.phraseBox}>
        {/* Android blurs the contents of this target; the BlurView must sit outside it. */}
        <BlurTargetView ref={blurTarget} style={styles.phraseContent}>
          <View
            style={styles.grid}
            accessibilityElementsHidden={!revealed}
            importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
          >
            {words.map((word, i) => (
              <View key={i} style={styles.cell} accessible accessibilityLabel={`Word ${i + 1}: ${word}`}>
                <Text mono size={14} color={colors.textMuted} style={styles.cellIndex}>
                  {i + 1}
                </Text>
                <Text mono size={14} selectable={false}>
                  {word}
                </Text>
              </View>
            ))}
          </View>
        </BlurTargetView>

        {!revealed ? (
          <>
            <BlurView
              intensity={18}
              tint="light"
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.overlay}>
              <Icon name="eye" size={32} strokeWidth={1.8} />
              <Button
                label="Tap to reveal"
                variant="secondary"
                height={44}
                fontSize={15}
                style={styles.revealButton}
                onPress={reveal}
              />
              <Text size={13} color={colors.textSecondary}>
                Make sure no one is watching your screen
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <Callout>Never share this phrase. Swissquote staff will never ask for it, by phone, e-mail or chat.</Callout>

      {/* Not in the design: encrypted backup file as an alternative to writing the words down. */}
      <Button
        label={backedUp ? 'Backup file saved' : 'Download encrypted backup'}
        variant="secondary"
        icon={backedUp ? 'check' : 'download'}
        iconSize={18}
        height={48}
        fontSize={15}
        onPress={() => setExporting(true)}
      />

      <Spacer />

      <View style={styles.footer}>
        {needsReveal ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            Write down your phrase or download a backup file before continuing.
          </Text>
        ) : null}
        {failure ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {failure}
          </Text>
        ) : null}
        <Button label={fromDraft ? 'I’ve written it down' : 'Done'} onPress={done} loading={adding} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  phraseBox: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  phraseContent: { backgroundColor: colors.surfaceMuted, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    // Two columns: (100% − 10px gap) / 2
    width: '48.3%',
    flexGrow: 1,
    // 40px content + 1px borders (the design's cell is content-box).
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellIndex: { width: 18, fontFamily: fonts.mono },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  revealButton: { paddingHorizontal: 20 },
  footer: { gap: 8 },
});
