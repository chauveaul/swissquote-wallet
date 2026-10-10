import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { BackButton } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useSendDraft } from '@/features/send/draft';
import { parsePaymentRequest, PaymentRequestError } from '@/features/send/paymentRequest';
import { useScanResult } from '@/features/send/scanResult';
import { useNetworkId } from '@/features/wallet/store';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

const FRAME = 260;

/**
 * QR scanner for addresses and EIP-681 payment links. Not drawn in the design.
 * A valid code only pre-fills a form (Send, or Add contact with
 * `purpose=contact`); the user still reviews and confirms there.
 */
export default function Scan() {
  const { from, purpose } = useLocalSearchParams<{ from?: 'send'; purpose?: 'contact' }>();
  const forContact = purpose === 'contact';
  const insets = useSafeAreaInsets();
  const network = getNetwork(useNetworkId());
  const [permission, requestPermission] = useCameraPermissions();
  const setTo = useSendDraft((s) => s.setTo);
  const setAmount = useSendDraft((s) => s.setAmount);
  const putScanResult = useScanResult((s) => s.put);
  const [error, setError] = useState<string | null>(null);
  // Cameras report the same code many times per second; handle one at a time.
  const handling = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handling.current) return;
    handling.current = true;
    try {
      const request = parsePaymentRequest(data, network.chain.id, { anyNetwork: forContact });
      if (forContact) {
        // Only the address is used; the contact form picks it up on focus.
        putScanResult(request.address);
        router.back();
        return;
      }
      setTo(request.address);
      if (request.amount) setAmount(request.amount);
      // Opened from Send: go back to it. Opened elsewhere: continue to Send.
      if (from === 'send') router.back();
      else router.replace('/send');
    } catch (e) {
      setError(e instanceof PaymentRequestError ? e.message : 'This QR code couldn’t be read.');
      setTimeout(() => {
        handling.current = false;
      }, 1500);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <BackButton icon="close" color={colors.surface} />
      <Text accessibilityRole="header" size={17} weight={700} color={colors.surface} style={styles.title}>
        Scan QR code
      </Text>
      <View style={styles.headerSlot} />
    </View>
  );

  if (!permission) return <View style={styles.root}>{header}</View>;

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        {header}
        <View style={styles.permission}>
          <Icon name="scan" size={40} color={colors.surface} />
          <Text size={22} weight={700} color={colors.surface} align="center">
            Allow camera access
          </Text>
          <Text size={15} lineHeight={1.5} color={colors.dark.textSecondary} align="center">
            The camera is only used to read wallet addresses from QR codes. Nothing is recorded or uploaded.
          </Text>
          <Button
            label={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            variant="inverse"
            style={styles.permissionButton}
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
      />
      {header}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.frame} accessibilityElementsHidden>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <Icon name="warning" size={18} color={colors.accentText} />
            <Text size={14} lineHeight={1.4} style={styles.flex}>
              {error}
            </Text>
          </View>
        ) : null}
        <Text size={15} weight={600} color={colors.surface} align="center">
          {forContact ? 'Scan the contact’s address QR code' : 'Scan an Ethereum address or payment QR code'}
        </Text>
        {forContact ? null : (
          <Text size={13} color={colors.dark.textSecondary} align="center">
            Only {network.name} requests are accepted.
          </Text>
        )}
      </View>
    </View>
  );
}

const CORNER = 28;
const STROKE = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.inkStrong },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
    zIndex: 1,
  },
  title: { flex: 1, textAlign: 'center' },
  headerSlot: { width: 44 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.accent },
  tl: { left: 0, top: 0, borderLeftWidth: STROKE, borderTopWidth: STROKE },
  tr: { right: 0, top: 0, borderRightWidth: STROKE, borderTopWidth: STROKE },
  bl: { left: 0, bottom: 0, borderLeftWidth: STROKE, borderBottomWidth: STROKE },
  br: { right: 0, bottom: 0, borderRightWidth: STROKE, borderBottomWidth: STROKE },
  footer: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 6 },
  error: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.accentSurface,
    borderRadius: radii.sm,
  },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  permissionButton: { alignSelf: 'stretch', marginTop: 10 },
});
