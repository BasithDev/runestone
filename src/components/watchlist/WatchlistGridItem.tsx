import React from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistItem } from '../../services/watchlistStore';
import { priorityOf } from '../lists/priority';
import PressableScale from './PressableScale';
import PriorityPill from './PriorityPill';
import { useEntrance } from './useEntrance';
import { COLORS, posterUriOf } from './utils';

interface Props {
  item: WatchlistItem;
  index: number;
  width: number;
  onPress: (item: WatchlistItem) => void;
  onLongPress: (item: WatchlistItem) => void;
}

function WatchlistGridItem({ item, index, width, onPress, onLongPress }: Props) {
  const entrance = useEntrance(index);
  const uri = posterUriOf(item);
  return (
    <Animated.View style={[{ width }, entrance]}>
      <PressableScale onPress={() => onPress(item)} onLongPress={() => onLongPress(item)}>
        <View style={[s.poster, { width, height: width * 1.5 }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={s.fallback}><Ionicons name="film-outline" size={24} color="#52525B" /></View>
          )}
          <View style={s.ribbon}><PriorityPill priority={priorityOf(item)} small /></View>
          {item.vote_average > 0 && (
            <View style={s.rating}>
              <Ionicons name="star" size={9} color={COLORS.accent} />
              <Text style={s.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
      </PressableScale>
    </Animated.View>
  );
}
export default React.memo(WatchlistGridItem);

const s = StyleSheet.create({
  poster: {
    borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: COLORS.border,
  },
  fallback: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  ribbon: { position: 'absolute', top: 6, left: 6 },
  rating: {
    position: 'absolute', bottom: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2,
  },
  ratingText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  title: { color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 15, letterSpacing: -0.1 },
});
