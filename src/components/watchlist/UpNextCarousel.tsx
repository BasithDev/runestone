import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistItem } from '../../services/watchlistStore';
import { priorityOf } from '../lists/priority';
import PressableScale from './PressableScale';
import PriorityPill from './PriorityPill';
import { COLORS, itemKey, posterUriOf } from './utils';

const CARD_W = 140;
const CARD_H = 210;
const GAP = 12;
const MAX = 10;

interface CardProps {
  item: WatchlistItem;
  onPress: (item: WatchlistItem) => void;
  onLongPress: (item: WatchlistItem) => void;
}

const UpNextCard = React.memo(function UpNextCard({ item, onPress, onLongPress }: CardProps) {
  const uri = posterUriOf(item);
  return (
    <PressableScale onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} style={s.card}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={itemKey(item)} />
      ) : (
        <View style={s.fallback}><Ionicons name="film-outline" size={28} color="#52525B" /></View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
        locations={[0.25, 0.6, 1]}
        style={s.gradient}
      >
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        {item.why_added ? <Text style={s.why} numberOfLines={2}>{item.why_added}</Text> : null}
      </LinearGradient>
      <View style={s.ribbon}><PriorityPill priority={priorityOf(item)} small /></View>
    </PressableScale>
  );
});

interface Props {
  items: WatchlistItem[];
  onPress: (item: WatchlistItem) => void;
  onLongPress: (item: WatchlistItem) => void;
}

function UpNextCarousel({ items, onPress, onLongPress }: Props) {
  const { data, isFallback } = useMemo(() => {
    const byAdded = (a: WatchlistItem, b: WatchlistItem) => (b.added_at || '').localeCompare(a.added_at || '');
    const high = items.filter(i => priorityOf(i) === 'high').sort(byAdded);
    if (high.length > 0) return { data: high.slice(0, MAX), isFallback: false };
    return { data: [...items].sort(byAdded).slice(0, MAX), isFallback: true };
  }, [items]);

  const renderItem = useCallback(
    ({ item }: { item: WatchlistItem }) => <UpNextCard item={item} onPress={onPress} onLongPress={onLongPress} />,
    [onPress, onLongPress],
  );

  if (data.length === 0) return null;
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.heading}>Up Next</Text>
        <Text style={s.sub}>{isFallback ? 'Newest additions' : 'High priority'}</Text>
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={itemKey}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ItemSeparatorComponent={Sep}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}
export default React.memo(UpNextCarousel);

function Sep() { return <View style={{ width: GAP }} />; }

const s = StyleSheet.create({
  wrap: { marginTop: 24, marginHorizontal: -20 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  heading: { color: COLORS.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: COLORS.dim, fontSize: 12, fontWeight: '500' },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: COLORS.border,
  },
  fallback: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 40 },
  title: { color: COLORS.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  why: { color: COLORS.muted, fontSize: 10, lineHeight: 13, marginTop: 3, fontStyle: 'italic' },
  ribbon: { position: 'absolute', top: 8, left: 8 },
});
