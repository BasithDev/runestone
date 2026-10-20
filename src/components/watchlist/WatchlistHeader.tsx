import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ViewMode } from './utils';

interface Props {
  total: number;
  viewMode: ViewMode;
  onToggleView: () => void;
}

function WatchlistHeader({ total, viewMode, onToggleView }: Props) {
  return (
    <View style={s.row}>
      <View style={s.left}>
        <Text style={s.title}>Watchlist</Text>
        {total > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{total}</Text></View>
        )}
      </View>
      {total > 0 && (
        <Pressable
          onPress={onToggleView}
          style={s.toggle}
          accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          hitSlop={6}
        >
          <Ionicons name={viewMode === 'grid' ? 'list' : 'grid'} size={18} color={COLORS.text} />
        </Pressable>
      )}
    </View>
  );
}
export default React.memo(WatchlistHeader);

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  badge: {
    backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, minWidth: 26, alignItems: 'center',
  },
  badgeText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  toggle: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
});
