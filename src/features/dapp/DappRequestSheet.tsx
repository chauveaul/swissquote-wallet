import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { Checkbox } from '@/components/Checkbox';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { colors, radii } from '@/theme/tokens';

import { SANCTIONS_SOURCE_LABEL } from './sanctions';
import type { SimulationResult } from './simulate';

export type PendingDappRequest =
  | { kind: 'connect'; origin: string }
  | { kind: 'sign'; origin: string; display: string }
  | { kind: 'blocked'; origin: string; reason: string }
  | { kind: 'transaction'; origin: string; simulation: SimulationResult | null };

type Props = {
  request: PendingDappRequest | null;
  busy: boolean;
  error: string | null;
  stepUpAck: boolean;
  onStepUpAckChange: (v: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
};

/** The threshold above (or at an unknown value) which an extra, explicit confirmation is required. */
export const DAPP_REVIEW_THRESHOLD_CHF = 500;

export function DappRequestSheet({ request, busy, error, stepUpAck, onStepUpAckChange, onApprove, onReject }: Props) {
  const insets = useSafeAreaInsets();
  if (!request) return null;

  const blocked = request.kind === 'blocked';
  const simulating = request.kind === 'transaction' && !request.simulation;
  const willRevert = request.kind === 'transaction' && request.simulation?.willRevert;
  const needsStepUp =
    request.kind === 'transaction' &&
    request.simulation &&
    !request.simulation.willRevert &&
    (request.simulation.valueChf === null || request.simulation.valueChf > DAPP_REVIEW_THRESHOLD_CHF);
  const canApprove = !blocked && !simulating && !willRevert && (!needsStepUp || stepUpAck);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onReject}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={onReject} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Icon
              name={blocked ? 'warning' : 'link'}
              size={20}
              color={blocked ? colors.accentText : colors.ink}
            />
            <Text size={13} weight={600} color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              {request.origin}
            </Text>
          </View>

          {request.kind === 'connect' ? (
            <>
              <Text accessibilityRole="header" size={20} weight={700}>
                Connect to this dApp?
              </Text>
              <Text size={14} lineHeight={1.4} color={colors.textSecondary}>
                It will be able to see your address and ask you to approve transactions. Nothing moves without your
                approval each time.
              </Text>
            </>
          ) : null}

          {request.kind === 'sign' ? (
            <>
              <Text accessibilityRole="header" size={20} weight={700}>
                Sign this message?
              </Text>
              <View style={styles.messageBox}>
                <Text mono size={13} lineHeight={1.4}>
                  {request.display}
                </Text>
              </View>
            </>
          ) : null}

          {request.kind === 'blocked' ? (
            <>
              <Text accessibilityRole="header" size={20} weight={700} color={colors.accentText}>
                This request is blocked
              </Text>
              <Callout tone="warning">{request.reason}</Callout>
              <Text size={12} color={colors.textMuted}>
                Screened against: {SANCTIONS_SOURCE_LABEL}.
              </Text>
            </>
          ) : null}

          {request.kind === 'transaction' ? (
            <>
              <Text accessibilityRole="header" size={20} weight={700}>
                Review this transaction
              </Text>
              {simulating ? (
                <Text size={14} color={colors.textMuted}>
                  Simulating…
                </Text>
              ) : (
                <Text size={15} lineHeight={1.4} weight={600}>
                  {request.simulation!.summary}
                </Text>
              )}
              {willRevert ? (
                <Callout tone="warning">
                  We won’t let you sign this — it would fail on-chain. {request.simulation!.revertReason}
                </Callout>
              ) : null}
              {needsStepUp && !willRevert ? (
                <>
                  <Callout tone="warning">
                    {request.simulation!.valueChf === null
                      ? "This transaction's value couldn't be verified — treat it as high-risk."
                      : `This moves more than CHF ${DAPP_REVIEW_THRESHOLD_CHF} from your wallet.`}
                  </Callout>
                  <Checkbox checked={stepUpAck} onChange={onStepUpAckChange} accessibilityLabel="Confirm large transaction">
                    <Text size={13} lineHeight={1.4} color={colors.textSecondary}>
                      I understand what this transaction does and want to continue.
                    </Text>
                  </Checkbox>
                </>
              ) : null}
            </>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {!blocked ? (
              <Button label="Approve" onPress={onApprove} loading={busy} disabled={!canApprove} />
            ) : null}
            <Button label={blocked ? 'Close' : 'Reject'} variant="secondary" onPress={onReject} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,18,18,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sm * 3,
    borderTopRightRadius: radii.sm * 3,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: 12,
    maxHeight: 160,
  },
  actions: { gap: 10, paddingTop: 4 },
});
