import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatchingStatus, WATCHING_STATUS_LABELS } from '../../types';

export const STATUS_STYLE: Record<WatchingStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  watching: { icon: 'play-circle', color: '#3B82F6', bg: 'rgba(59,130,246,0.18)' },
  rewatching: { icon: 'repeat', color: '#A855F7', bg: 'rgba(168,85,247,0.18)' },
  caught_up: { icon: 'time', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
  on_hold: { icon: 'pause-circle', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
  dropped: { icon: 'close-circle', color: '#F87171', bg: 'rgba(248,113,113,0.18)' },
  completed: { icon: 'checkmark-circle', color: '#10B981', bg: 'rgba(16,185,129,0.18)' },
};

/** Small coloured pill showing a watching item's status. */
export default function StatusPill({ status, solid, style }: { status: WatchingStatus; solid?: boolean; style?: ViewStyle }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.watching;
  return (
    <View style={[s.pill, { backgroundColor: solid ? 'rgba(0,0,0,0.75)' : cfg.bg }, solid && { borderColor: cfg.color + '66', borderWidth: 1 }, style]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
      <Text style={[s.text, { color: cfg.color }]}>{WATCHING_STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  text: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});
