import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './utils';

function useFloatIn() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [v]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
}

export function WatchlistEmpty({ onDiscover }: { onDiscover: () => void }) {
  const a = useFloatIn();
  return (
    <Animated.View style={[s.wrap, a]}>
      <View style={s.circle}><Ionicons name="bookmark-outline" size={40} color="#52525B" /></View>
      <Text style={s.title}>Your watchlist is empty</Text>
      <Text style={s.sub}>Save movies and series you want to watch.{'\n'}They'll appear here for easy access.</Text>
      <Pressable style={s.btn} onPress={onDiscover}>
        <Ionicons name="search" size={16} color="#000" />
        <Text style={s.btnText}>Discover Content</Text>
      </Pressable>
    </Animated.View>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  const a = useFloatIn();
  return (
    <Animated.View style={[s.wrap, { paddingTop: 40 }, a]}>
      <View style={[s.circle, { width: 64, height: 64, borderRadius: 32 }]}>
        <Ionicons name="search-outline" size={28} color="#52525B" />
      </View>
      <Text style={s.title}>No matches found</Text>
      <Text style={s.sub}>Try a different search term or filter.</Text>
      <Pressable style={s.ghost} onPress={onClear}>
        <Text style={s.ghostText}>Clear Filters</Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 70 },
  circle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  sub: { color: COLORS.dim, fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.accent,
  },
  btnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  ghost: {
    marginTop: 18, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  ghostText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
});
