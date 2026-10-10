import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader, StepHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useWallet } from '@/features/wallet/store';
import { usePreventScreenshots } from '@/features/wallet/usePreventScreenshots';
import { colors, fonts, radii } from '@/theme/tokens';

type Props = { mode: 'create' | 'reveal' };

const MASK = '••••••';

/** 02 Secret recovery phrase */
export function RecoveryPhraseScreen({ mode }: Props) {
  usePreventScreenshots('recovery-phrase');

  const draft = useWallet((s) => s.draftMnemonic);
  const revealMnemonic = useWallet((s) => s.revealMnemonic);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [needsReveal, setNeedsReveal] = useState(false);

  // The real words never enter the view tree until the user asks to see them.
  const words = useMemo(() => (phrase ? phrase.split(' ') : Array<string>(12).fill(MASK)), [phrase]);
  const revealed = phrase !== null;

  const reveal = async () => {
    if (mode === 'create') {
      setPhrase(draft);
    } else {
      const ok = await confirmUserPresence('Reveal your secret recovery phrase');
      if (ok) setPhrase(revealMnemonic());
    }
    setNeedsReveal(false);
  };

  const done = () => {
    if (!revealed) {
      setNeedsReveal(true);
      return;
    }
    setPhrase(null);
    if (mode === 'create') router.push({ pathname: '/set-password', params: { flow: 'create' } });
    else router.back();
  };

  return (
    <Screen paddingTop={16} gap={24}>
      {mode === 'create' ? <StepHeader step={2} total={3} /> : <NavHeader />}

      <View style={styles.intro}>
        {mode === 'create' ? <Overline>Step 2 of 3</Overline> : null}
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          {mode === 'create' ? 'Write down your secret recovery phrase' : 'Your secret recovery phrase'}
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          These {words.length} words are the only way to restore your wallet. Write them down in order and
          store them somewhere offline. Swissquote can never recover them for you.
        </Text>
      </View>

      <View style={styles.phraseBox}>
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

        {!revealed ? (
          <>
            <BlurView
              intensity={18}
              tint="light"
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
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

      <Spacer />

      <View style={styles.footer}>
        {needsReveal ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            Reveal your phrase and write it down before continuing.
          </Text>
        ) : null}
        <Button label={mode === 'create' ? 'I’ve written it down' : 'Done'} onPress={done} />
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
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
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
