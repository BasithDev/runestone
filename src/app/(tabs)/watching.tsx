import React, { useRef, useEffect, useState } from 'react';
import {
  ScrollView, Text, View, Image, Pressable, StyleSheet, Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatching } from '../../context/WatchingContext';
import {
  CONTENT_TYPES,
  WatchingItem,
  ContentType,
} from '../../types';

const { width: SW } = Dimensions.get('window');

// ── Type config helpers ───────────────────────────────
function getTypeConfig(type: ContentType) {
  return CONTENT_TYPES.find(c => c.key === type) || CONTENT_TYPES[0];
}

function getTypeBadgeLabel(type: ContentType): string {
  switch (type) {
    case 'movie': return 'Movie';
    case 'series': return 'Series';
    case 'anime': return 'Anime';
    case 'other': return 'Other';
  }
}

// Adaptor to get the content type from the new WatchingItem
function itemType(item: WatchingItem): ContentType {
  return item.contentType;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', icon: 'checkmark-circle' as const, color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
    case 'not_completed':
      return { label: 'Not Completed', icon: 'pause-circle' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
    case 'watching':
      return { label: 'Watching', icon: 'play-circle' as const, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' };
    case 'caught_up':
      return { label: 'Caught Up', icon: 'time' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
    default:
      return { label: 'Unknown', icon: 'help-circle' as const, color: '#71717A', bg: 'rgba(255,255,255,0.06)' };
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// ── Progress Bar ──────────────────────────────────────
function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: percentage,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.progressBg}>
      <Animated.View style={[s.progressFill, { width: animatedWidth, backgroundColor: color }]} />
    </View>
  );
}

// ── Movie Card ────────────────────────────────────────
function MovieCard({ item, onPress }: { item: WatchingItem; onPress: () => void }) {
  const statusCfg = getStatusConfig(item.status);
  const typeCfg = getTypeConfig(itemType(item));

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={s.poster} />
        {/* Completed overlay */}
        {item.movieCompleted && (
          <View style={s.completedOverlay}>
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>

          <View style={s.cardMeta}>
            <View style={[s.typeBadge, { backgroundColor: typeCfg.color + '18' }]}>
              <Text style={[s.typeBadgeText, { color: typeCfg.color }]}>{getTypeBadgeLabel(itemType(item))}</Text>
            </View>
            <Text style={s.cardYear}>{item.year}</Text>
          </View>

          {/* Genres */}
          <View style={s.genreRow}>
            {item.genres.slice(0, 2).map(g => (
              <Text key={g} style={s.genreChip}>{g}</Text>
            ))}
          </View>

          {/* Rating */}
          <View style={s.ratingRow}>
            <Ionicons name="star" size={11} color="#10B981" />
            <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Status badge */}
        <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon} size={14} color={statusCfg.color} />
          <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Last watched */}
      <View style={s.lastWatchedWrap}>
        <Text style={s.lastWatched}>{timeAgo(item.lastWatched)}</Text>
      </View>
    </Pressable>
  );
}

// ── Series/Anime Card ─────────────────────────────────
function SeriesCard({ item, onPress }: { item: WatchingItem; onPress: () => void }) {
  const typeCfg = getTypeConfig(itemType(item));
  const percentage = item.totalEpisodes && item.episodesWatched
    ? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
    : 0;

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={s.poster} />
        {/* Percentage overlay */}
        <View style={s.percentOverlay}>
          <Text style={s.percentText}>{percentage}%</Text>
        </View>
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>

          <View style={s.cardMeta}>
            <View style={[s.typeBadge, { backgroundColor: typeCfg.color + '18' }]}>
              <Text style={[s.typeBadgeText, { color: typeCfg.color }]}>{getTypeBadgeLabel(itemType(item))}</Text>
            </View>
            <Text style={s.cardYear}>{item.year}</Text>
          </View>

          {/* Episode progress */}
          <View style={s.episodeRow}>
            <Ionicons name="layers-outline" size={12} color="#A1A1AA" />
            <Text style={s.episodeText}>
              S{item.currentSeason} E{item.currentEpisode}
              <Text style={{ color: '#52525B' }}> / </Text>
              S{item.totalSeasons} E{item.totalEpisodes}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={{ marginTop: 8 }}>
            <ProgressBar percentage={percentage} color={typeCfg.color} />
            <View style={s.progressMeta}>
              <Text style={s.progressLabel}>{item.episodesWatched} of {item.totalEpisodes} episodes</Text>
              <Text style={[s.progressPercent, { color: typeCfg.color }]}>{percentage}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Last watched */}
      <View style={s.lastWatchedWrap}>
        <Text style={s.lastWatched}>{timeAgo(item.lastWatched)}</Text>
      </View>
    </Pressable>
  );
}

// ── Awaiting Card ─────────────────────────────────────
function AwaitingCard({ item, onPress }: { item: WatchingItem; onPress: () => void }) {
  const typeCfg = getTypeConfig(itemType(item));
  const seasonEps = item.seasonEpisodes?.find(s => s.season === item.currentSeason)?.episodes;
  const seasonComplete = !!seasonEps && (item.currentEpisode ?? 0) >= seasonEps;

  return (
    <Pressable style={[s.card, s.awaitingCard]} onPress={onPress}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={[s.poster, { opacity: 0.7 }]} />
        <View style={s.awaitingBadgeOverlay}>
          <Ionicons name="time" size={18} color="#F59E0B" />
        </View>
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>

          <View style={s.cardMeta}>
            <View style={[s.typeBadge, { backgroundColor: typeCfg.color + '18' }]}>
              <Text style={[s.typeBadgeText, { color: typeCfg.color }]}>{getTypeBadgeLabel(itemType(item))}</Text>
            </View>
            <Text style={s.cardYear}>{item.year}</Text>
          </View>

          {/* Last season info */}
          <View style={s.episodeRow}>
            <Ionicons
              name={seasonComplete ? 'checkmark-done' : 'layers-outline'}
              size={13}
              color={seasonComplete ? '#10B981' : '#A1A1AA'}
            />
            <Text style={s.episodeText}>
              {seasonComplete
                ? `Season ${item.currentSeason} complete`
                : `Stopped at S${item.currentSeason} E${item.currentEpisode}`}
            </Text>
          </View>

          {/* Caught up badge */}
          <View style={s.caughtUpBadge}>
            <Ionicons name="hourglass-outline" size={12} color="#F59E0B" />
            <Text style={s.caughtUpText}>Ongoing — Awaiting new season</Text>
          </View>
        </View>
      </View>

      {/* Last watched */}
      <View style={s.lastWatchedWrap}>
        <Text style={s.lastWatched}>{timeAgo(item.lastWatched)}</Text>
      </View>
    </Pressable>
  );
}

// ── Filter Chips ──────────────────────────────────────
type FilterType = 'all' | ContentType;

// ── Main Watching Screen ──────────────────────────────
export default function WatchingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const { watchingItems, awaitingItems } = useWatching();

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Filter items
  const filteredWatching = filter === 'all'
    ? watchingItems
    : watchingItems.filter(i => i.contentType === filter);

  const filteredAwaiting = filter === 'all'
    ? awaitingItems
    : awaitingItems.filter(i => i.contentType === filter);

  const allItems = [...watchingItems, ...awaitingItems];
  const watchingCount = watchingItems.length;
  const awaitingCount = awaitingItems.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

        {/* ── Header ──────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.headerTitle}>Currently Watching</Text>
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{watchingCount + awaitingCount}</Text>
            </View>
          </View>
        </View>

        {/* ── Filter Chips ────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 20 }}
        >
          <Pressable
            style={[s.filterChip, filter === 'all' && s.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[s.filterChipText, filter === 'all' && s.filterChipTextActive]}>All</Text>
          </Pressable>
          {CONTENT_TYPES.map(ct => {
            const count = allItems.filter(i => i.contentType === ct.key).length;
            if (count === 0) return null;
            return (
              <Pressable
                key={ct.key}
                style={[s.filterChip, filter === ct.key && { backgroundColor: ct.color + '20', borderColor: ct.color + '40' }]}
                onPress={() => setFilter(ct.key)}
              >
                <Ionicons name={ct.icon as any} size={13} color={filter === ct.key ? ct.color : '#71717A'} />
                <Text style={[s.filterChipText, filter === ct.key && { color: ct.color }]}>
                  {ct.label}
                </Text>
                <View style={[s.filterCount, filter === ct.key && { backgroundColor: ct.color + '30' }]}>
                  <Text style={[s.filterCountText, filter === ct.key && { color: ct.color }]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Active Watching Section ─────────────────── */}
        {filteredWatching.length > 0 && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeader}>
              <View style={s.sectionDotRow}>
                <View style={[s.sectionDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={s.sectionTitle}>In Progress</Text>
              </View>
              <Text style={s.sectionCount}>{filteredWatching.length}</Text>
            </View>

            {filteredWatching.map(item => {
              const goToProgress = () => router.push({ pathname: '/watching-progress/[id]', params: { id: item.tmdbId, media_type: item.mediaType } } as any);
              if (item.contentType === 'movie') {
                return <MovieCard key={`${item.mediaType}-${item.tmdbId}`} item={item} onPress={goToProgress} />;
              }
              return <SeriesCard key={`${item.mediaType}-${item.tmdbId}`} item={item} onPress={goToProgress} />;
            })}
          </View>
        )}

        {/* ── Awaiting New Season Section ─────────────── */}
        {filteredAwaiting.length > 0 && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeader}>
              <View style={s.sectionDotRow}>
                <View style={[s.sectionDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={s.sectionTitle}>Awaiting New Season</Text>
              </View>
              <Text style={s.sectionCount}>{filteredAwaiting.length}</Text>
            </View>

            {filteredAwaiting.map(item => (
              <AwaitingCard key={`${item.mediaType}-${item.tmdbId}`} item={item} onPress={() => router.push({ pathname: '/watching-progress/[id]', params: { id: item.tmdbId, media_type: item.mediaType } } as any)} />
            ))}
          </View>
        )}

        {/* ── Empty state when filter has no results ──── */}
        {filteredWatching.length === 0 && filteredAwaiting.length === 0 && (
          <View style={s.emptyWrap}>
            <View style={s.emptyIconCircle}>
              <Ionicons name="play-circle-outline" size={40} color="#3F3F46" />
            </View>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptySubtext}>
              No {filter === 'all' ? 'content' : CONTENT_TYPES.find(c => c.key === filter)?.label.toLowerCase()} being tracked.
            </Text>
            <Pressable
              onPress={() => router.replace('/search' as any)}
              style={s.emptyBtn}
            >
              <Ionicons name="search" size={15} color="#000" />
              <Text style={s.emptyBtnText}>Discover Content</Text>
            </Pressable>
          </View>
        )}

      </Animated.View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  // Header
  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  countBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  countBadgeText: { color: '#10B981', fontSize: 13, fontWeight: '800' },

  // Filter chips
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  filterChipText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#10B981' },
  filterCount: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
  },
  filterCountText: { color: '#52525B', fontSize: 11, fontWeight: '700' },

  // Section
  sectionWrap: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    color: '#E5E2E1', fontSize: 16, fontWeight: '700', letterSpacing: -0.3,
  },
  sectionCount: { color: '#52525B', fontSize: 13, fontWeight: '700' },

  // Card base
  card: {
    backgroundColor: '#121212', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row', padding: 12,
    marginBottom: 10,
  },
  awaitingCard: {
    borderColor: 'rgba(245,158,11,0.12)',
    backgroundColor: '#0F0F0F',
  },

  // Poster
  posterWrap: { marginRight: 14, position: 'relative' },
  poster: {
    width: 80, height: 120, borderRadius: 14,
    backgroundColor: '#1A1A1A',
  },
  completedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  percentOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  percentText: {
    color: '#fff', fontSize: 10, fontWeight: '800',
  },
  awaitingBadgeOverlay: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },

  // Card info
  cardInfo: { flex: 1 },
  cardTitle: {
    color: '#fff', fontSize: 15, fontWeight: '700',
    letterSpacing: -0.3, marginBottom: 6,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardYear: { color: '#52525B', fontSize: 12, fontWeight: '600' },

  // Genres
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  genreChip: {
    color: '#52525B', fontSize: 10, fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    overflow: 'hidden',
  },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#10B981', fontSize: 12, fontWeight: '700' },

  // Episode progress
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  episodeText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },

  // Progress bar
  progressBg: {
    height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 4,
  },
  progressLabel: { color: '#52525B', fontSize: 10, fontWeight: '500' },
  progressPercent: { fontSize: 11, fontWeight: '800' },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    marginTop: 6,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Caught up
  caughtUpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    marginTop: 6, alignSelf: 'flex-start',
  },
  caughtUpText: { color: '#F59E0B', fontSize: 10, fontWeight: '600' },

  // Last watched
  lastWatchedWrap: {
    position: 'absolute', top: 12, right: 12,
  },
  lastWatched: { color: '#3F3F46', fontSize: 10, fontWeight: '600' },

  // Empty state
  emptyWrap: {
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    letterSpacing: -0.3, marginBottom: 8,
  },
  emptySubtext: {
    color: '#52525B', fontSize: 13, fontWeight: '500',
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#10B981',
  },
  emptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
