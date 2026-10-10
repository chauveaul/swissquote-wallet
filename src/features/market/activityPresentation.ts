import type { IconName } from '@/components/Icon';
import { colors } from '@/theme/tokens';

import type { ActivityItem, ActivityKind } from './types';

export const KIND_ICON: Record<ActivityKind, IconName> = {
  send: 'send',
  receive: 'receive',
  swap: 'swap',
  approve: 'check',
  buy: 'plus',
};

export const KIND_LABEL: Record<ActivityKind, string> = {
  send: 'Send',
  receive: 'Receive',
  swap: 'Swap',
  approve: 'Token approval',
  buy: 'Buy',
};

type Fiat = { format: (chf: number | null, decimals?: number) => string };

/** "EUR 768.61", or "Fee EUR 0.89" for fee-only entries such as approvals. */
export function activityValueLabel(item: ActivityItem, fiat: Fiat): string {
  return `${item.valueIsFee ? 'Fee ' : ''}${fiat.format(item.valueChf)}`;
}

/** "0.00042 ETH · EUR 1.29" */
export function activityFeeLabel(item: ActivityItem, fiat: Fiat): string | null {
  if (!item.fee) return null;
  return item.fee.native ? `${item.fee.native} · ${fiat.format(item.fee.chf)}` : fiat.format(item.fee.chf);
}

/** Status text and colours shared by the Activity list and the details screen. */
export function activityPresentation(item: ActivityItem) {
  switch (item.status) {
    case 'pending':
      return {
        status: item.eta ? `Pending · ${item.eta}` : 'Pending',
        statusColor: colors.accentText,
        iconBg: colors.accentSurface,
        iconFg: colors.accentText,
      };
    case 'failed':
      return { status: 'Failed', statusColor: colors.textMuted, iconBg: colors.surfaceMuted, iconFg: colors.textMuted };
    default:
      return { status: 'Confirmed', statusColor: colors.positive, iconBg: colors.surfaceMuted, iconFg: colors.ink };
  }
}
