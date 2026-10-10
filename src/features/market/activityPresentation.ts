import type { IconName } from '@/components/Icon';
import { colors } from '@/theme/tokens';

import type { ActivityItem, ActivityKind } from './types';

export const KIND_ICON: Record<ActivityKind, IconName> = {
  send: 'send',
  receive: 'receive',
  swap: 'swap',
  approve: 'check',
};

export const KIND_LABEL: Record<ActivityKind, string> = {
  send: 'Send',
  receive: 'Receive',
  swap: 'Swap',
  approve: 'Token approval',
};

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
