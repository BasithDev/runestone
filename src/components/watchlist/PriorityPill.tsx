import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { WatchlistPriority } from '../../services/watchlistStore';
import { priorityMeta } from '../lists/priority';

/** Dark pill with a priority-colour dot and a white label (colour is never the only cue). */
function PriorityPill({ priority, small }: { priority: WatchlistPriority; small?: boolean }) {
  const p = priorityMeta(priority);
  return (
    <View style={[s.pill, small && s.small]}>
      <View style={[s.dot, { backgroundColor: p.color }]} />
      <Text style={[s.text, small && s.textSmall]}>{p.label}</Text>
    </View>
  );
}
export default React.memo(PriorityPill);

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  small: { paddingHorizontal: 5, paddingVertical: 2, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: '#fff', fontSize: 10, fontWeight: '700' },
  textSmall: { fontSize: 9 },
});
