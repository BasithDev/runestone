import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet } from 'react-native';

/** Animates height (JS driver) and opacity/translate (native driver) when `open` toggles. */
function Expandable({ open, children }: { open: boolean; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [h, setH] = useState(0);

  useEffect(() => {
    const cfg = { duration: 240, easing: Easing.out(Easing.cubic) };
    const a = Animated.parallel([
      Animated.timing(progress, { toValue: open ? 1 : 0, ...cfg, useNativeDriver: false }),
      Animated.timing(fade, { toValue: open ? 1 : 0, ...cfg, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [open, progress, fade]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.ceil(e.nativeEvent.layout.height);
    setH(prev => (prev === next ? prev : next));
  };

  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, h] });
  const lift = fade.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={[s.outer, { height }]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        onLayout={onLayout}
        style={[s.inner, { opacity: fade, transform: [{ translateY: lift }] }]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export default memo(Expandable);

const s = StyleSheet.create({
  outer: { overflow: 'hidden' },
  inner: { position: 'absolute', top: 0, left: 0, right: 0 },
});
