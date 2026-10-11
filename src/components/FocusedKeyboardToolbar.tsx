import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard } from 'react-native';
import { KeyboardEvents, KeyboardToolbar, useReanimatedFocusedInput } from 'react-native-keyboard-controller';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * The keyboard toolbar, shown only while a text input has focus and the
 * keyboard is actually open.
 *
 * The toolbar follows the keyboard height tracked by keyboard-controller. On
 * Android that height can get stuck when the keyboard closes while the app is
 * busy (e.g. deriving a password key right after submit), leaving the toolbar
 * floating mid-screen with no keys under it. Two independent signals override
 * it — disabled, the toolbar rests just below the screen edge:
 * - focus loss, reported natively by keyboard-controller;
 * - React Native's own `keyboardDidHide`, which Android re-checks on every
 *   layout pass and so corrects itself.
 */
export function FocusedKeyboardToolbar(props: ComponentProps<typeof KeyboardToolbar>) {
  const { input } = useReanimatedFocusedInput();
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible());
  useAnimatedReaction(
    () => input.value !== null,
    (hasInput, previous) => {
      if (hasInput !== previous) scheduleOnRN(setFocused, hasInput);
    },
  );

  useEffect(() => {
    // Open as the keyboard starts sliding in, so the toolbar rides along with it.
    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', () => setKeyboardOpen(true)),
      KeyboardEvents.addListener('keyboardDidHide', () => setKeyboardOpen(false)),
      Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);

  return <KeyboardToolbar {...props} enabled={focused && keyboardOpen && (props.enabled ?? true)} />;
}
