import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type TabRoute = 'index' | 'activity' | 'settings';

type Props = {
  current: TabRoute;
  onNavigate: (route: TabRoute) => void;
};

function NavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !onPress }}
      onPress={onPress}
      style={styles.item}
    >
      <Icon name={icon} size={22} color={active ? colors.ink : colors.textMuted} />
      <Text size={11} weight={active ? 700 : 500} color={active ? colors.ink : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Main navigation: Wallet · Explore · Trade (accent) · Activity · Settings. */
export function BottomNav({ current, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(24, insets.bottom) }]}>
      <NavItem label="Wallet" icon="wallet" active={current === 'index'} onPress={() => onNavigate('index')} />
      {/* Explore has no screen in the design yet. */}
      <NavItem label="Explore" icon="explore" active={false} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Trade"
        onPress={() => router.push('/swap')}
        style={styles.item}
      >
        <View style={styles.trade}>
          <Icon name="swap" size={22} color={colors.inkStrong} strokeWidth={2.2} />
        </View>
      </Pressable>
      <NavItem
        label="Activity"
        icon="activity"
        active={current === 'activity'}
        onPress={() => onNavigate('activity')}
      />
      <NavItem
        label="Settings"
        icon="sliders"
        active={current === 'settings'}
        onPress={() => onNavigate('settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  trade: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
