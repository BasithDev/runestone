import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import StatusPill from '../tracking/StatusPill';
import { WatchingStatus } from '../../types';
import { MediaItem, itemDate, mediaTypeOf } from './types';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';
const MAX_STAGGER = 10;
const STAGGER_MS = 30;

interface Props {
  item: MediaItem;
  index: number;
  status?: WatchingStatus;
  watched: boolean;
  saved: boolean;
  /** Tap: opens the action sheet. */
  onOpen: (item: MediaItem) => void;
  /** Long-press: jumps straight to the details page. */
  onOpenDetails: (item: MediaItem) => void;
}

function formatVotes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function ResultCard({ item, index, status, watched, saved, onOpen, onOpenDetails }: Props) {
  const animate = index < MAX_STAGGER;
  const fade = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const lift = useRef(new Animated.Value(animate ? 12 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const anim = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, delay: index * STAGGER_MS, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 280, delay: index * STAGGER_MS, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [animate, index, fade, lift]);

  const pressTo = (to: number) =>
    Animated.spring(scale, { toValue: to, speed: 40, bounciness: 0, useNativeDriver: true }).start();

  const title = item.title || item.name || 'Untitled';
  const type = mediaTypeOf(item);
  const year = itemDate(item).slice(0, 4);
  const hasRating = item.vote_average > 0;
  const votes = item.vote_count ?? 0;
  const tracked = !!status || watched;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }, { scale }] }}>
      <Pressable
        style={styles.card}
        onPress={() => onOpen(item)}
        onLongPress={() => onOpenDetails(item)}
        delayLongPress={350}
        onPressIn={() => pressTo(0.975)}
        onPressOut={() => pressTo(1)}
      >
        {item.poster_path ? (
          <Image
            source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={String(item.id)}
          />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Ionicons name="film-outline" size={24} color="#52525B" />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{type === 'tv' ? 'Series' : 'Movie'}</Text>
            </View>
            {year ? <Text style={styles.metaText}>{year}</Text> : null}
            {hasRating ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#10B981" />
                <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
                {votes > 0 ? <Text style={styles.votesText}>({formatVotes(votes)})</Text> : null}
              </View>
            ) : (
              <Text style={styles.noRating}>No ratings</Text>
            )}
          </View>

          <Text style={styles.plot} numberOfLines={2}>{item.overview || 'No description available.'}</Text>

          {tracked || saved ? (
            <View style={styles.badgeRow}>
              {status ? <StatusPill status={status} /> : null}
              {watched && !status ? (
                <View style={styles.watchedBadge}>
                  <Ionicons name="checkmark-done" size={10} color="#10B981" />
                  <Text style={styles.watchedText}>Watched</Text>
                </View>
              ) : null}
              {saved ? (
                <View style={styles.savedBadge}>
                  <Ionicons name="bookmark" size={10} color="#10B981" />
                  <Text style={styles.watchedText}>Saved</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#3F3F46" />

      </Pressable>
    </Animated.View>
  );
}

export default memo(ResultCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    marginBottom: 12,
  },
  poster: {
    width: 84,
    height: 126,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, paddingHorizontal: 12, justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  typeBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  typeText: { color: '#A1A1AA', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  ratingText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  votesText: { color: '#52525B', fontSize: 10, fontWeight: '500' },
  noRating: { color: '#52525B', fontSize: 11, fontStyle: 'italic' },
  plot: { color: '#A1A1AA', fontSize: 12, lineHeight: 17 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  watchedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  watchedText: { color: '#10B981', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});
