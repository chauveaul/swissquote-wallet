import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard } from 'react-native';
import {
  KeyboardEvents,
  KeyboardToolbar,
  useReanimatedFocusedInput,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
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
// DEBUG-KBD
const t0 = Date.now();
export function kbdLog(msg: string) {
  console.log(`[kbd] +${Date.now() - t0}ms ${msg}`);
}

export function FocusedKeyboardToolbar(props: ComponentProps<typeof KeyboardToolbar>) {
  const { input } = useReanimatedFocusedInput();
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible());
  // DEBUG-KBD: temporary instrumentation
  const { height } = useReanimatedKeyboardAnimation();
  useAnimatedReaction(
    () => Math.round(height.value),
    (h, prev) => {
      if (h !== prev && (h === 0 || prev === 0 || prev === null || Math.abs(h - (prev ?? 0)) > 150)) {
        scheduleOnRN(kbdLog, `lib height ${prev} -> ${h}`);
      }
    },
  );
  useEffect(() => {
    const subs = (['keyboardWillShow', 'keyboardDidShow', 'keyboardWillHide', 'keyboardDidHide'] as const).map((e) =>
      KeyboardEvents.addListener(e, (ev) => kbdLog(`lib ${e} h=${ev.height}`)),
    );
    const rn = (['keyboardDidShow', 'keyboardDidHide'] as const).map((e) =>
      Keyboard.addListener(e, (ev) => kbdLog(`rn ${e} h=${ev?.endCoordinates?.height}`)),
    );
    return () => [...subs, ...rn].forEach((x) => x.remove());
  }, []);
  useEffect(() => kbdLog(`state focused=${focused} keyboardOpen=${keyboardOpen}`), [focused, keyboardOpen]);

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
