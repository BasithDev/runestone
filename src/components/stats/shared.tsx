import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { CONTENT_TYPES, ContentType, MONTH_NAMES } from '../../types';
import { CHART_TYPE_ORDER } from '../../services/statsInsights';

export const ACCENT = '#10B981';
export const EMPTY_CELL = 'rgba(255,255,255,0.05)';
export const HEAT_STEPS = [
  EMPTY_CELL,
  'rgba(16,185,129,0.28)',
  'rgba(16,185,129,0.5)',
  'rgba(16,185,129,0.75)',
  ACCENT,
];

export const TYPE_CFG: Record<ContentType, (typeof CONTENT_TYPES)[number]> =
  Object.fromEntries(CONTENT_TYPES.map(c => [c.key, c])) as any;

/** Content types in the colour-blind-validated chart order. */
export const CHART_ORDER_CFG = CHART_TYPE_ORDER.map(k => TYPE_CFG[k]);

/** "just now" / "5m ago" / "2h ago" / "yesterday" / "3d ago" / "12 Oct". */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((startToday.getTime() - t) / 86400000);
  if (days <= 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/** Fade + slide-up wrapper; `index` staggers the entrance by ~60ms. */
export function FadeSlide({ index, children, style }: { index: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 450, delay: index * 60, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that scales down slightly while pressed. */
export function ScalePressable({
  onPress, style, children, hitSlop, accessibilityLabel,
}: {
  onPress?: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; hitSlop?: number; accessibilityLabel?: string;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Pressable
      onPress={onPress} hitSlop={hitSlop} accessibilityLabel={accessibilityLabel}
      onPressIn={() => to(0.97)} onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Number that counts up to `value`. */
export function CountUp({ value, style, format }: { value: number; style?: any; format?: (n: number) => string }) {
  const a = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(0);
  useEffect(() => {
    a.setValue(0);
    const id = a.addListener(({ value: v }) => setN(v));
    Animated.timing(a, { toValue: value, duration: 1100, useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]);
  return <Text style={style}>{format ? format(n) : Math.round(n).toLocaleString()}</Text>;
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={sh.titleRow}>
      <Text style={sh.title}>{title}</Text>
      {right}
    </View>
  );
}

export const sh = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 24 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#E5E2E1', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  card: {
    backgroundColor: '#121212', borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 16,
  },
  tip: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', minHeight: 18, marginBottom: 10 },
  tipHint: { color: '#71717A' },
});
