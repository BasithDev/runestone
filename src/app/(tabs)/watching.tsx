import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, ScrollView, View, Pressable, StyleSheet,
  Animated,
} from 'react-native';
import { Text } from '../../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedPush, useTabBarPadding } from '../../components/navGuard';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useWatching } from '../../context/WatchingContext';
import {
  CONTENT_TYPES,
  WatchingItem,
  ContentType,
} from '../../types';
import { getProgress } from '../../services/watchingStore';

// ── Type config helpers ───────────────────────────────
function getTypeConfig(type: ContentType) {
  return CONTENT_TYPES.find(c => c.key === type) || CONTENT_TYPES[0];
}

function getTypeBadgeLabel(type: ContentType): string {
  switch (type) {
    case 'movie': return 'Movie';
    case 'series': return 'Series';
    case 'anime': return 'Anime';
    case 'other': return 'Docs';
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
    case 'rewatching':
      return { label: 'Rewatching', icon: 'repeat' as const, color: '#A855F7', bg: 'rgba(168,85,247,0.12)' };
    case 'on_hold':
      return { label: 'On Hold', icon: 'pause-circle' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
    case 'dropped':
      return { label: 'Dropped', icon: 'close-circle' as const, color: '#F87171', bg: 'rgba(248,113,113,0.12)' };
    case 'caught_up':
      return { label: 'Caught Up', icon: 'time' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
    default:
      return { label: 'Unknown', icon: 'help-circle' as const, color: '#71717A', bg: 'rgba(255,255,255,0.06)' };
  }
}

function timeAgo(dateStr: string): string {
  // Calendar days in local time (not 24h blocks), so "Yesterday" means yesterday.
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.max(0, Math.round((startOf(new Date()) - startOf(date)) / 86400000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// ── Progress Bar ──────────────────────────────────────
function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <View style={s.progressBg}>
      <View style={[s.progressFill, { width: `${Math.max(0, Math.min(100, percentage))}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Hold note / drop reason ───────────────────────────
function StatusNote({ item }: { item: WatchingItem }) {
  if (item.status === 'on_hold' && item.holdNote) {
    return (
      <View style={[s.noteRow, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
        <Ionicons name="pause-circle" size={12} color="#F59E0B" />
        <Text style={s.noteText} numberOfLines={2}>{item.holdNote}</Text>
      </View>
    );
  }
  if (item.status === 'dropped') {
    return (
      <View style={[s.noteRow, { backgroundColor: 'rgba(248,113,113,0.08)' }]}>
        <Ionicons name="close-circle" size={12} color="#F87171" />
        <Text style={s.noteText} numberOfLines={2}>
          {item.dropReason}
          {item.dropRating != null ? `  ·  ★ ${item.dropRating.toFixed(1)}/10` : ''}
        </Text>
      </View>
    );
  }
  return null;
}

// ── Movie Card ────────────────────────────────────────
const MovieCard = memo(function MovieCard({ item, onOpen }: { item: WatchingItem; onOpen: (item: WatchingItem) => void }) {
  const statusCfg = getStatusConfig(item.status);
  const typeCfg = getTypeConfig(itemType(item));

  return (
    <Pressable style={s.card} onPress={() => onOpen(item)}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={s.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={`${item.mediaType}-${item.tmdbId}`} />
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
        <StatusNote item={item} />
      </View>

      {/* Last watched */}
      <View style={s.lastWatchedWrap}>
        <Text style={s.lastWatched}>{timeAgo(item.lastWatched)}</Text>
      </View>
    </Pressable>
  );
});

// ── Series/Anime Card ─────────────────────────────────
const SeriesCard = memo(function SeriesCard({ item, onOpen }: { item: WatchingItem; onOpen: (item: WatchingItem) => void }) {
  const typeCfg = getTypeConfig(itemType(item));
  const { watched, total, percent: percentage } = getProgress(item);
  const statusCfg = getStatusConfig(item.status);

  return (
    <Pressable style={s.card} onPress={() => onOpen(item)}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={s.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={`${item.mediaType}-${item.tmdbId}`} />
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
            <View style={[s.miniBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[s.miniBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ marginTop: 8 }}>
            <ProgressBar percentage={percentage} color={typeCfg.color} />
            <View style={s.progressMeta}>
              <Text style={s.progressLabel}>{watched} of {total} episodes</Text>
              <Text style={[s.progressPercent, { color: typeCfg.color }]}>{percentage}%</Text>
            </View>
          </View>
          <StatusNote item={item} />
        </View>
      </View>

      {/* Last watched */}
      <View style={s.lastWatchedWrap}>
        <Text style={s.lastWatched}>{timeAgo(item.lastWatched)}</Text>
      </View>
    </Pressable>
  );
});

// ── Awaiting Card ─────────────────────────────────────
const AwaitingCard = memo(function AwaitingCard({ item, onOpen }: { item: WatchingItem; onOpen: (item: WatchingItem) => void }) {
  const typeCfg = getTypeConfig(itemType(item));
  const seasonEps = item.seasonEpisodes?.find(s => s.season === item.currentSeason)?.episodes;
  const seasonComplete = !!seasonEps && (item.currentEpisode ?? 0) >= seasonEps;

  return (
    <Pressable style={[s.card, s.awaitingCard]} onPress={() => onOpen(item)}>
      {/* Poster */}
      <View style={s.posterWrap}>
        <Image source={{ uri: item.posterUrl || undefined }} style={[s.poster, { opacity: 0.7 }]} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={`${item.mediaType}-${item.tmdbId}`} />
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
});

// ── Filter Chips ──────────────────────────────────────
type FilterType = 'all' | ContentType;

// In Progress holds active, on hold and dropped titles; Awaiting holds caught-up
// shows, which pile up over time, so they get their own tab.
type TabKey = 'progress' | 'awaiting';

// ── Main Watching Screen ──────────────────────────────
type Row =
  | { kind: 'header'; key: string; title: string; color: string; count: number; toggle?: boolean; open?: boolean }
  | { kind: 'card'; key: string; item: WatchingItem; variant: 'normal' | 'awaiting' }
  | { kind: 'empty'; key: string };

const rowKey = (r: Row) => r.key;
const cardKey = (item: WatchingItem) => `${item.mediaType}-${item.tmdbId}`;

export default function WatchingScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();
  const bottomPad = useTabBarPadding(12);
  const [filter, setFilter] = useState<FilterType>('all');
  const [tab, setTab] = useState<TabKey>('progress');
  const { watchingItems, awaitingItems, onHoldItems, droppedItems } = useWatching();
  const [droppedOpen, setDroppedOpen] = useState(false);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fadeIn, slideUp]);

  const progressCount = watchingItems.length + onHoldItems.length + droppedItems.length;
  const totalCount = progressCount + awaitingItems.length;

  // Type chips count only the open tab's titles.
  const counts = useMemo(() => {
    const list = tab === 'awaiting' ? awaitingItems : [...watchingItems, ...onHoldItems, ...droppedItems];
    const c = new Map<ContentType, number>();
    for (const i of list) c.set(i.contentType, (c.get(i.contentType) ?? 0) + 1);
    return c;
  }, [tab, watchingItems, awaitingItems, onHoldItems, droppedItems]);

  // If the selected type no longer has any items (e.g. the last one was removed), fall back to All.
  useEffect(() => {
    if (filter !== 'all' && !counts.get(filter)) setFilter('all');
  }, [filter, counts]);

  const rows = useMemo(() => {
    const pick = (list: WatchingItem[]) => (filter === 'all' ? list : list.filter(i => i.contentType === filter));
    const out: Row[] = [];
    const section = (id: string, title: string, color: string, list: WatchingItem[], variant: 'normal' | 'awaiting', toggle = false, open = true) => {
      if (list.length === 0) return;
      out.push({ kind: 'header', key: `h-${id}`, title, color, count: list.length, toggle, open });
      if (open) for (const item of list) out.push({ kind: 'card', key: `${id}-${cardKey(item)}`, item, variant });
    };
    if (tab === 'awaiting') {
      const a = pick(awaitingItems);
      for (const item of a) out.push({ kind: 'card', key: `awaiting-${cardKey(item)}`, item, variant: 'awaiting' });
      if (a.length === 0) out.push({ kind: 'empty', key: 'empty' });
      return out;
    }
    const w = pick(watchingItems), h = pick(onHoldItems), d = pick(droppedItems);
    section('progress', 'Watching', '#3B82F6', w, 'normal');
    section('hold', 'On Hold', '#A1A1AA', h, 'normal');
    section('dropped', 'Dropped', '#F87171', d, 'normal', true, droppedOpen);
    if (w.length + h.length + d.length === 0) out.push({ kind: 'empty', key: 'empty' });
    return out;
  }, [tab, filter, watchingItems, awaitingItems, onHoldItems, droppedItems, droppedOpen]);

  const openProgress = useCallback(
    (item: WatchingItem) => push({ pathname: '/watching-progress/[id]', params: { id: item.tmdbId, media_type: item.mediaType } }),
    [push],
  );
  const toggleDropped = useCallback(() => setDroppedOpen(o => !o), []);
  const goDiscover = useCallback(() => push('/search'), [push]);

  const renderRow = useCallback(({ item: r }: { item: Row }) => {
    if (r.kind === 'header') {
      const inner = (
        <>
          <View style={s.sectionDotRow}>
            <View style={[s.sectionDot, { backgroundColor: r.color }]} />
            <Text style={s.sectionTitle}>{r.title}</Text>
          </View>
          <View style={s.sectionDotRow}>
            <Text style={s.sectionCount}>{r.count}</Text>
            {r.toggle ? <Ionicons name={r.open ? 'chevron-up' : 'chevron-down'} size={16} color="#52525B" /> : null}
          </View>
        </>
      );
      return r.toggle
        ? <Pressable style={[s.sectionHeader, s.sectionPad]} onPress={toggleDropped}>{inner}</Pressable>
        : <View style={[s.sectionHeader, s.sectionPad]}>{inner}</View>;
    }
    if (r.kind === 'empty') {
      return (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="play-circle-outline" size={40} color="#3F3F46" />
          </View>
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.emptySubtext}>
            {tab === 'awaiting'
              ? 'Shows you catch up on wait here for their next season.'
              : `No ${filter === 'all' ? 'content' : CONTENT_TYPES.find(c => c.key === filter)?.label.toLowerCase()} in progress.`}
          </Text>
          <Pressable onPress={goDiscover} style={s.emptyBtn}>
            <Ionicons name="search" size={15} color="#000" />
            <Text style={s.emptyBtnText}>Discover Content</Text>
          </Pressable>
        </View>
      );
    }
    const wrap = (child: React.ReactElement) => <View style={s.cardPad}>{child}</View>;
    if (r.variant === 'awaiting') return wrap(<AwaitingCard item={r.item} onOpen={openProgress} />);
    return wrap(r.item.mediaType === 'movie'
      ? <MovieCard item={r.item} onOpen={openProgress} />
      : <SeriesCard item={r.item} onOpen={openProgress} />);
  }, [tab, filter, openProgress, toggleDropped, goDiscover]);

  const header = useMemo(() => (
    <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.headerTitle}>Currently Watching</Text>
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>{totalCount}</Text>
          </View>
        </View>
      </View>

      {/* ── Tabs ──────────────────────────────────── */}
      <View style={s.segment}>
        {([['progress', 'In Progress', progressCount], ['awaiting', 'Awaiting New Season', awaitingItems.length]] as const)
          .map(([key, label, n]) => {
            const active = tab === key;
            return (
              <Pressable key={key} style={[s.segmentBtn, active && s.segmentBtnActive]} onPress={() => setTab(key)}>
                <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>{label}</Text>
                <View style={[s.segmentCount, active && s.segmentCountActive]}>
                  <Text style={[s.segmentCountText, active && s.segmentCountTextActive]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
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
          const count = counts.get(ct.key) ?? 0;
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
    </Animated.View>
  ), [fadeIn, slideUp, totalCount, progressCount, awaitingItems.length, tab, filter, counts]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}
      data={rows}
      keyExtractor={rowKey}
      renderItem={renderRow}
      ListHeaderComponent={header}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      windowSize={7}
      maxToRenderPerBatch={6}
      removeClippedSubviews
    />
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

  // Tabs
  segment: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, padding: 3,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: '#1F1F22' },
  segmentText: { color: '#71717A', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  segmentTextActive: { color: '#fff' },
  segmentCount: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  segmentCountActive: { backgroundColor: 'rgba(16,185,129,0.2)' },
  segmentCountText: { color: '#52525B', fontSize: 11, fontWeight: '700' },
  segmentCountTextActive: { color: '#10B981' },

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
  sectionPad: { paddingHorizontal: 20 },
  cardPad: { paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, marginTop: 14,
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

  // Status notes
  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, marginTop: 8,
  },
  noteText: { flex: 1, color: '#A1A1AA', fontSize: 11, lineHeight: 15 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  miniBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

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
