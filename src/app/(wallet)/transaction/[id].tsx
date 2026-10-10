import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { AccountAvatar } from '@/components/Marks';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { activityPresentation, KIND_ICON, KIND_LABEL } from '@/features/market/activityPresentation';
import { useActivity } from '@/features/market/queries';
import type { ActivityItem } from '@/features/market/types';
import { accountColor } from '@/features/wallet/accountColor';
import { useWallet } from '@/features/wallet/store';
import { formatDateTime, truncateAddress } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

const COUNTERPARTY_LABEL: Record<ActivityItem['kind'], string> = {
  send: 'To',
  receive: 'From',
  approve: 'Spender',
  swap: 'Counterparty',
};

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text size={14} color={colors.textSecondary}>
        {label}
      </Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function Value({ children }: { children: ReactNode }) {
  return (
    <Text size={14} weight={600} align="right">
      {children}
    </Text>
  );
}

/** Copyable full-length address, so it can be checked character by character. */
function AddressValue({ label, address }: { label?: string; address: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <>
      {label ? <Value>{label}</Value> : null}
      <Text mono selectable size={12} lineHeight={1.5} color={colors.textMuted} align="right">
        {address}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Address copied' : 'Copy address'}
        onPress={async () => {
          await Clipboard.setStringAsync(address);
          setCopied(true);
        }}
        hitSlop={8}
        style={styles.copy}
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} color={colors.accentText} />
        <Text size={13} weight={600} color={colors.accentText}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </Pressable>
    </>
  );
}

/** Activity details. Not drawn in the design; built from the Review screen's components. */
export default function TransactionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useActivity();
  const accounts = useWallet((s) => s.meta?.accounts ?? []);
  const item = data.find((a) => a.id === id);

  if (!item) {
    return (
      <Screen gap={24}>
        <NavHeader title="Transaction" />
        <Text size={15} color={colors.textSecondary}>
          This transaction is no longer available.
        </Text>
      </Screen>
    );
  }

  const p = activityPresentation(item);
  const network = getNetwork(item.networkId);
  const account = accounts.find((a) => a.index === item.accountIndex);
  const explorer = network.chain.blockExplorers?.default.url;

  const rows: { label: string; node: ReactNode }[] = [
    { label: 'Type', node: <Value>{KIND_LABEL[item.kind]}</Value> },
    { label: 'Date', node: <Value>{formatDateTime(item.timestamp)}</Value> },
  ];
  if (account) {
    rows.push({
      label: 'Account',
      node: (
        <View style={styles.inline}>
          <AccountAvatar color={accountColor(account.index)} size={20} />
          <Value>{account.name}</Value>
        </View>
      ),
    });
  }
  if (item.counterparty) {
    rows.push({
      label: COUNTERPARTY_LABEL[item.kind],
      node: <AddressValue label={item.counterparty.label} address={item.counterparty.address} />,
    });
  }
  if (item.swap) {
    rows.push(
      { label: 'You paid', node: <Value>{item.swap.paid}</Value> },
      { label: 'You received', node: <Value>{item.swap.received}</Value> },
      { label: 'Rate', node: <Value>{item.swap.rate}</Value> },
      { label: 'Minimum received', node: <Value>{item.swap.minReceived}</Value> },
    );
  }
  rows.push({ label: 'Network', node: <Value>{network.name}</Value> });
  if (item.fee) rows.push({ label: 'Network fee', node: <Value>{item.fee}</Value> });
  if (item.hash) {
    rows.push({
      label: 'Transaction hash',
      node: (
        <Text mono selectable size={12} color={colors.textMuted} align="right">
          {truncateAddress(item.hash, 8, 8)}
        </Text>
      ),
    });
  }

  return (
    <Screen gap={20}>
      <NavHeader title="Transaction" />

      <View style={styles.summary}>
        <View style={[styles.icon, { backgroundColor: p.iconBg }]}>
          <Icon name={KIND_ICON[item.kind]} size={24} color={p.iconFg} strokeWidth={2.2} />
        </View>
        <Text size={15} weight={600}>
          {item.title}
        </Text>
        <Text size={32} weight={700} tracking={-0.02}>
          {item.amount}
        </Text>
        <Text size={15} color={colors.textSecondary}>
          {item.fiat}
        </Text>
        <Text accessibilityRole="text" size={13} weight={600} color={p.statusColor}>
          {p.status}
        </Text>
      </View>

      {item.status === 'failed' && item.failureReason ? <Callout size={13}>{item.failureReason}</Callout> : null}

      <View style={styles.card}>
        {rows.map((r, i) => (
          <Row key={r.label} label={r.label} last={i === rows.length - 1}>
            {r.node}
          </Row>
        ))}
      </View>

      {item.hash && explorer ? (
        <Button
          label={`View on ${network.chain.blockExplorers?.default.name ?? 'explorer'}`}
          variant="secondary"
          icon="external"
          iconSize={18}
          height={48}
          fontSize={15}
          onPress={() => Linking.openURL(`${explorer}/tx/${item.hash}`)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', gap: 4, paddingTop: 8 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowValue: { flex: 1, alignItems: 'flex-end', gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
});
