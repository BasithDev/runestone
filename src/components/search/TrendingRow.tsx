import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MediaItem } from './types';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';

interface CardProps {
  item: MediaItem;
  rank: number;
  onOpen: (item: MediaItem) => void;
}

const TrendingCard = memo(function TrendingCard({ item, rank, onOpen }: CardProps) {
  const title = item.title || item.name || 'Untitled';
  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)}>
      {item.poster_path ? (
        <Image
          source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
          style={styles.poster}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          recyclingKey={String(item.id)}
        />
      ) : null}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {item.vote_average > 0 ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={10} color="#10B981" />
            <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const keyOf = (item: MediaItem) => `trending-${item.media_type || 'x'}-${item.id}`;

interface Props {
  title: string;
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
}

/** Horizontal row of large posters with a rank number overlay. */
function TrendingRow({ title, items, onOpen }: Props) {
  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => <TrendingCard item={item} rank={index + 1} onOpen={onOpen} />,
    [onOpen],
  );
  return (
    <View>
      <Text style={styles.section}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

export default memo(TrendingRow);

const styles = StyleSheet.create({
  section: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12, paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    width: 150, height: 225, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#121212', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  poster: { width: '100%', height: '100%' },
  rank: {
    position: 'absolute', left: 10, bottom: 34,
    color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: -2,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
  },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10 },
  title: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
});
