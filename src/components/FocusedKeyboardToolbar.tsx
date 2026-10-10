import { useState, type ComponentProps } from 'react';
import { KeyboardToolbar, useReanimatedFocusedInput } from 'react-native-keyboard-controller';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * The keyboard toolbar, shown only while a text input has focus.
 *
 * The toolbar follows the keyboard height the library tracks. When a screen
 * swap unmounts the focused input, Android hides the keys without the library
 * seeing it, so that height stays stuck and the toolbar floats mid-screen.
 * Focus loss is reported natively and reliably, so it decides visibility
 * instead: disabled, the toolbar rests just below the screen edge.
 */
export function FocusedKeyboardToolbar(props: ComponentProps<typeof KeyboardToolbar>) {
  const { input } = useReanimatedFocusedInput();
  const [focused, setFocused] = useState(false);

  useAnimatedReaction(
    () => input.value !== null,
    (hasInput, previous) => {
      if (hasInput !== previous) scheduleOnRN(setFocused, hasInput);
    },
  );

  return <KeyboardToolbar {...props} enabled={focused && (props.enabled ?? true)} />;
}
