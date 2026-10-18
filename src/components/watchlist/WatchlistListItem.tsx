import React from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistItem } from '../../services/watchlistStore';
import { priorityOf, priorityMeta } from '../lists/priority';
import PressableScale from './PressableScale';
import { useEntrance } from './useEntrance';
import { COLORS, posterUriOf, runtimeLabel, timeAgo, yearOf } from './utils';

interface Props {
  item: WatchlistItem;
  index: number;
  onPress: (item: WatchlistItem) => void;
  onLongPress: (item: WatchlistItem) => void;
}

function WatchlistListItem({ item, index, onPress, onLongPress }: Props) {
  const entrance = useEntrance(index);
  const uri = posterUriOf(item);
  const pri = priorityMeta(priorityOf(item));
  const meta = [item.media_type === 'tv' ? 'Series' : 'Movie', yearOf(item), runtimeLabel(item)]
    .filter(Boolean).join(' · ');
  return (
    <Animated.View style={entrance}>
      <PressableScale style={s.card} onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} scaleTo={0.98}>
        <View style={[s.stripe, { backgroundColor: pri.color }]} />
        {uri ? (
          <Image source={{ uri }} style={s.poster} />
        ) : (
          <View style={[s.poster, s.fallback]}><Ionicons name="film-outline" size={24} color="#52525B" /></View>
        )}
        <View style={s.info}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={2}>{item.title}</Text>
            <View style={s.badge}>
              <View style={[s.dot, { backgroundColor: pri.color }]} />
              <Text style={s.badgeText}>{pri.label}</Text>
            </View>
          </View>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          <View style={s.row}>
            {item.vote_average > 0 && (
              <View style={s.rating}>
                <Ionicons name="star" size={11} color={COLORS.accent} />
                <Text style={s.ratingText}>{item.vote_average.toFixed(1)}</Text>
              </View>
            )}
            {item.genres.slice(0, 2).map(g => <Text key={g} style={s.genre}>{g}</Text>)}
          </View>
          {item.why_added ? (
            <View style={s.quote}>
              <Ionicons name="chatbubble-ellipses-outline" size={11} color={COLORS.dim} style={{ marginTop: 2 }} />
              <Text style={s.quoteText} numberOfLines={2}>{item.why_added}</Text>
            </View>
          ) : null}
          <Text style={s.added}>Added {timeAgo(item.added_at)}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}
export default React.memo(WatchlistListItem);

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  poster: { width: 80, height: 120, borderRadius: 12, backgroundColor: '#1A1A1A', marginRight: 14 },
  fallback: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  meta: { color: COLORS.muted, fontSize: 12, fontWeight: '500', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 },
  ratingText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  genre: {
    color: COLORS.dim, fontSize: 10, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  quote: { flexDirection: 'row', gap: 5, marginTop: 8 },
  quoteText: { flex: 1, color: COLORS.muted, fontSize: 12, fontStyle: 'italic', lineHeight: 16 },
  added: { color: COLORS.dim, fontSize: 10, fontWeight: '500', marginTop: 8 },
});
