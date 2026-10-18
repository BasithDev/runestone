import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const STAGGER_MS = 40;
const MAX_STAGGERED = 12;

/** Staggered fade-and-slide entrance. Items past MAX_STAGGERED render instantly. */
export function useEntrance(index: number) {
  const animate = index < MAX_STAGGERED;
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    const anim = Animated.timing(v, {
      toValue: 1, duration: 360, delay: index * STAGGER_MS, useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
}
