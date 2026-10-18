import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * router.push that ignores repeat calls within a short window, so a
 * double-tap can't stack the same screen twice.
 */
export function useGuardedPush() {
  const router = useRouter();
  const last = useRef(0);
  return useCallback(
    (href: any) => {
      const now = Date.now();
      if (now - last.current < 700) return;
      last.current = now;
      router.push(href);
    },
    [router],
  );
}

/** Bottom padding that clears the floating tab bar (bar ~66pt + its offset). */
export function useTabBarPadding(extra = 24) {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, 12) + 66 + extra;
}

/** Back navigation that falls back to Home when there is nothing to go back to (e.g. opened from a notification). */
export function useGoBack() {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
}
