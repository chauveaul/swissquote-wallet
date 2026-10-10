import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { LogoPlaceholder } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { useWallet } from '@/features/wallet/store';
import { LEGAL_URLS } from '@/lib/config';
import { colors } from '@/theme/tokens';

/** 01 Welcome */
export default function Welcome() {
  const [agreed, setAgreed] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const beginCreate = useWallet((s) => s.beginCreate);

  const proceed = (next: () => void) => {
    if (!agreed) {
      setShowConsentError(true);
      return;
    }
    next();
  };

  return (
    <Screen paddingTop={56} paddingHorizontal={0} paddingBottom={0}>
      <View pointerEvents="none" accessibilityElementsHidden style={styles.circle} />
      <View pointerEvents="none" accessibilityElementsHidden style={styles.square} />

      <View style={styles.logo}>
        <LogoPlaceholder />
      </View>

      <Spacer />

      <View style={styles.panel}>
        <View style={styles.intro}>
          <Overline color={colors.accentText}>Crypto Wallet</Overline>
          <Text accessibilityRole="header" size={40} lineHeight={1.05} weight={700} tracking={-0.02}>
            Your keys.{'\n'}Your crypto.
          </Text>
          <Text size={16} lineHeight={1.45} color={colors.textSecondary}>
            A self-custody wallet by Swissquote. Hold, send and swap digital assets across Ethereum and
            compatible networks.
          </Text>
        </View>

        <View style={styles.consent}>
          <Checkbox
            checked={agreed}
            onChange={(v) => {
              setAgreed(v);
              if (v) setShowConsentError(false);
            }}
            invalid={showConsentError}
            accessibilityLabel="I agree to the Terms of use and acknowledge the Privacy notice"
          >
            <Text size={14} lineHeight={1.4} color={colors.textSecondary}>
              I agree to the{' '}
              <Text size={14} color={colors.accentText} style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
                Terms of use
              </Text>{' '}
              and acknowledge the{' '}
              <Text size={14} color={colors.accentText} style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
                Privacy notice
              </Text>
              .
            </Text>
          </Checkbox>
          {showConsentError ? (
            <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
              Please accept the Terms of use to continue.
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            label="Create a new wallet"
            onPress={() =>
              proceed(() => {
                beginCreate();
                router.push('/create-phrase');
              })
            }
          />
          <Button
            label="Import an existing wallet"
            variant="secondary"
            onPress={() => proceed(() => router.push('/restore'))}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    right: -150,
    top: 120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.accent,
  },
  square: {
    position: 'absolute',
    right: 40,
    top: 300,
    width: 120,
    height: 120,
    backgroundColor: colors.primary,
  },
  logo: { paddingHorizontal: 24, gap: 8 },
  panel: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
    backgroundColor: colors.surface,
  },
  intro: { gap: 12, paddingTop: 24 },
  consent: { gap: 8 },
  actions: { gap: 12 },
  link: { textDecorationLine: 'underline' },
});
