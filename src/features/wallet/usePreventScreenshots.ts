import { usePreventScreenCapture } from 'expo-screen-capture';

/** Blocks screenshots and screen recording while a secret is on screen. */
export function usePreventScreenshots(key: string) {
  usePreventScreenCapture(key);
}
