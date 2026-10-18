import React, { memo, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  /** Accent colour (#RRGGBB); omit for the neutral style. */
  color?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
}

const NEUTRAL = '#E4E4E7';

function ActionTile({ icon, label, sub, color, onPress, disabled, loading, selected }: ActionTileProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, tension: 200, friction: 12, useNativeDriver: true }).start();

  const tint = color ?? NEUTRAL;
  const bg = color ? `${color}1F` : 'rgba(255,255,255,0.06)';
  const border = selected ? tint : color ? `${color}40` : 'rgba(255,255,255,0.08)';

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(0.96)}
        onPressOut={() => spring(1)}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        style={[s.tile, { backgroundColor: bg, borderColor: border }, disabled && !loading && s.dim]}
      >
        <View style={[s.badge, { backgroundColor: color ? `${color}2E` : 'rgba(255,255,255,0.08)' }]}>
          {loading ? (
            <ActivityIndicator size="small" color={tint} />
          ) : (
            <Ionicons name={icon} size={22} color={tint} />
          )}
        </View>
        <View style={s.texts}>
          <Text style={s.label} numberOfLines={1}>{label}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(ActionTile);

const s = StyleSheet.create({
  wrap: { flexGrow: 1, flexBasis: '46%' },
  tile: {
    minHeight: 72, borderRadius: 18, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dim: { opacity: 0.45 },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  label: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  sub: { color: '#8A8A93', fontSize: 11, fontWeight: '500', marginTop: 2 },
});
