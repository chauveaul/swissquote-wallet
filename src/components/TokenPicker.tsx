import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MarketToken, TokenSymbol } from '@/features/market/types';
import { useFiat } from '@/features/settings/useFiat';
import { colors, fonts, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { TokenMark } from './Marks';
import { Text } from './Text';

type Props = {
  visible: boolean;
  tokens: MarketToken[];
  selected: TokenSymbol;
  onSelect: (symbol: TokenSymbol) => void;
  onClose: () => void;
  title?: string;
};

/** Bottom sheet listing every available token, with search. Not drawn in the design. */
export function TokenPicker({ visible, tokens, selected, onSelect, onClose, title = 'Select token' }: Props) {
  const insets = useSafeAreaInsets();
  const fiat = useFiat();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter((t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q));
  }, [tokens, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    // Translucent bars let the keyboard library track the keyboard inside the modal window on Android.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      {/* Lifts the sheet above the keyboard while searching. */}
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close token list"
          style={styles.backdrop}
          onPress={close}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" size={17} weight={700}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Search tokens"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or ticker"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.accent}
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(t) => t.symbol}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={styles.list}
            ListEmptyComponent={
              <Text size={14} color={colors.textMuted} style={styles.empty}>
                No tokens match “{query.trim()}”.
              </Text>
            }
            renderItem={({ item }) => {
              const on = item.symbol === selected;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.name}, ${item.symbol}`}
                  onPress={() => {
                    onSelect(item.symbol);
                    close();
                  }}
                  style={({ pressed }) => [styles.row, (pressed || on) && { backgroundColor: colors.surfaceMuted }]}
                >
                  <TokenMark label={item.mark} color={item.color} size={36} fontSize={item.mark.length > 3 ? 10 : 12} />
                  <View style={styles.rowMain}>
                    <Text size={15} weight={600}>
                      {item.name}
                    </Text>
                    <Text size={13} color={colors.textMuted}>
                      {item.symbol}
                    </Text>
                  </View>
                  <Text size={14} color={colors.textSecondary}>
                    {fiat.price(item.priceChf)}
                  </Text>
                  <View style={styles.check}>{on ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}</View>
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,18,18,0.45)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sm * 3,
    borderTopRightRadius: radii.sm * 3,
    paddingTop: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  search: {
    marginHorizontal: 24,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    outlineWidth: 0,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMain: { flex: 1, gap: 2 },
  check: { width: 20, alignItems: 'center' },
  empty: { paddingHorizontal: 24, paddingVertical: 16 },
});
