import { KeyboardController } from 'react-native-keyboard-controller';

/** Longest we wait for the keyboard to finish hiding before moving on anyway. */
const MAX_WAIT_MS = 600;

/**
 * Closes the keyboard and resolves once it's hidden (or after a short cap).
 *
 * Call it before anything that replaces the screen holding the focused input,
 * or that keeps the app busy (password key derivation): if the keyboard hides
 * during either, Android can skip the hide event and the keyboard toolbar's
 * position gets stuck. See FocusedKeyboardToolbar for the fallback.
 */
export function closeKeyboard(): Promise<void> {
  return Promise.race([
    KeyboardController.dismiss(),
    new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
  ]);
}
