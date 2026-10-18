import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarPadding } from '../navGuard';

interface Props {
  /** Changes on every show; `nonce` lets the same text re-trigger. */
  message: string | null;
  nonce: number;
  onHide: () => void;
  duration?: number;
}

/** Animated toast pinned above the floating tab bar. */
export default function Snackbar({ message, nonce, onHide, duration = 2500 }: Props) {
  const bottom = useTabBarPadding(12); // sits just above the floating tab bar
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;
  const shown = useRef<string | null>(null);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  if (message) shown.current = message; // keep the text while fading out

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    lift.setValue(16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 16, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onHideRef.current(); });
    }, duration);
    return () => clearTimeout(t);
  }, [message, nonce, duration, opacity, lift]);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom, opacity, transform: [{ translateY: lift }] }]}>
      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
      <Text style={styles.text} numberOfLines={2}>{shown.current}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
