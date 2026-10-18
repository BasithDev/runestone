import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, Image, FlatList, Pressable,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { parseLocalDate, UpcomingItem } from '../types';
import { tmdbGet, tmdbImage, REGION } from '../services/tmdb';
import { useUpcoming } from '../context/UpcomingContext';
import { useWatchlist } from '../context/WatchlistContext';

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 52) / 2;
const CARD_H = CARD_W * 1.5;

type Tab = 'browse' | 'mine';

// ── Helpers ───────────────────────────────────────────
function localToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function localTodayStr(): string {
  const d = localToday();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function daysUntil(dateStr: string): number {
  return Math.round((parseLocalDate(dateStr).getTime() - localToday().getTime()) / 86400000);
}

function countdownText(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `in ${days} days`;
  if (days < 63) return `in ${Math.floor(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return `in ${months} months`;
}

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const byDateAsc = (a: MediaItem, b: MediaItem) => {
  const da = a.release_date || '9999-99-99';
  const db = b.release_date || '9999-99-99';
  return da.localeCompare(db);
};

// ── Screen ────────────────────────────────────────────
export default function UpcomingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items: saved, isSaved, add, remove } = useUpcoming();
  const { addItem: addToWatchlist, isInWatchlist } = useWatchlist();

  const [tab, setTab] = useState<Tab>('browse');

  // Browse state
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const reqCounter = useRef(0);

  const fetchUpcoming = async (pageNum: number, append = false) => {
    const reqId = ++reqCounter.current;
    try {
      const json = await tmdbGet<{ results?: MediaItem[]; total_pages?: number }>(
        'movie/upcoming', { region: REGION, page: pageNum },
      );
      if (reqId !== reqCounter.current) return;

      if (json.results) {
        const todayStr = localTodayStr();
        const filtered = json.results
          .filter(i => i.poster_path && i.release_date && i.release_date > todayStr)
          .sort(byDateAsc);

        setMovies(prev => {
          // TMDb pages can overlap, so dedupe by id
          const merged: MediaItem[] = append ? [...prev, ...filtered] : filtered;
          const combined = Array.from(new Map(merged.map(m => [m.id, m])).values());
          // Re-sort the full list to maintain order across pages
          return combined.sort(byDateAsc);
        });
        setTotalPages(json.total_pages || 1);
        setPage(pageNum);
      }
    } catch {
      if (!append) setError(true);
    } finally {
      if (reqId === reqCounter.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => { fetchUpcoming(1); }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    fetchUpcoming(page + 1, true);
  };

  const toggleSaved = useCallback(async (item: MediaItem) => {
    if (pendingIds.has(item.id)) return;
    setPendingIds(prev => new Set(prev).add(item.id));
    try {
      if (isSaved('movie', item.id)) {
        await remove('movie', item.id);
      } else {
        await add({
          tmdbId: item.id,
          mediaType: 'movie',
          title: item.title || item.name || '',
          posterPath: item.poster_path,
          releaseDate: item.release_date || null,
        });
      }
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [pendingIds, isSaved, add, remove]);

  const openItem = (id: number, mediaType: string) =>
    router.push({ pathname: '/content/[id]', params: { id, media_type: mediaType } } as any);

  // ── Browse card ──
  const renderBrowseItem = ({ item }: { item: MediaItem }) => {
    const title = item.title || item.name || '';
    const date = item.release_date || item.first_air_date || '';
    const savedNow = isSaved('movie', item.id);

    return (
      <Pressable style={st.card} onPress={() => openItem(item.id, 'movie')}>
        <Image
          source={{ uri: tmdbImage(item.poster_path, 'w342') ?? undefined }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          locations={[0.5, 1]}
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 12 }]}
        >
          <Text style={st.cardTitle} numberOfLines={2}>{title}</Text>
          {date ? (
            <View style={st.dateRow}>
              <Ionicons name="calendar-outline" size={10} color="#10B981" />
              <Text style={st.dateText}>{formatDate(date)}</Text>
            </View>
          ) : null}
        </LinearGradient>
        <Pressable
          style={[st.bookmark, savedNow && st.bookmarkActive]}
          onPress={(e) => { e.stopPropagation(); toggleSaved(item); }}
          hitSlop={6}
        >
          {pendingIds.has(item.id) ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Ionicons
              name={savedNow ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={savedNow ? '#10B981' : '#fff'}
            />
          )}
        </Pressable>
      </Pressable>
    );
  };

  // ── My Upcoming data ──
  type Row =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'item'; key: string; item: UpcomingItem; released: boolean };

  const rows = useMemo<Row[]>(() => {
    const todayStr = localTodayStr();
    const sorted = [...saved].sort((a, b) =>
      (a.releaseDate || '9999-99-99').localeCompare(b.releaseDate || '9999-99-99'));
    const upcoming = sorted.filter(i => !i.releaseDate || i.releaseDate >= todayStr);
    const released = sorted.filter(i => i.releaseDate && i.releaseDate < todayStr).reverse();
    const out: Row[] = [];
    upcoming.forEach(item => out.push({ kind: 'item', key: `u-${item.mediaType}-${item.tmdbId}`, item, released: false }));
    if (released.length) {
      out.push({ kind: 'header', key: 'h-released', label: 'Released' });
      released.forEach(item => out.push({ kind: 'item', key: `r-${item.mediaType}-${item.tmdbId}`, item, released: true }));
    }
    return out;
  }, [saved]);

  const moveToWatchlist = useCallback(async (item: UpcomingItem) => {
    const key = `${item.mediaType}-${item.tmdbId}`;
    if (movingKey) return;
    setMovingKey(key);
    try {
      if (!isInWatchlist(item.tmdbId, item.mediaType)) {
        let runtime: number | null = null;
        let episodeCount: number | null = null;
        let episodeRuntime: number | null = null;
        let genres: string[] = [];
        let voteAverage = 0;
        let voteCount = 0;
        let overview = '';
        let backdrop: string | null = null;
        try {
          const d = await tmdbGet<any>(`${item.mediaType}/${item.tmdbId}`);
          runtime = d.runtime || null;
          episodeCount = d.number_of_episodes || null;
          episodeRuntime = d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null;
          genres = (d.genres || []).map((g: any) => g.name);
          voteAverage = d.vote_average || 0;
          voteCount = d.vote_count || 0;
          overview = d.overview || '';
          backdrop = d.backdrop_path || null;
        } catch { /* use defaults */ }

        await addToWatchlist({
          id: item.tmdbId,
          media_type: item.mediaType,
          title: item.title,
          poster_path: item.posterPath,
          backdrop_path: backdrop,
          vote_average: voteAverage,
          vote_count: voteCount,
          runtime,
          episode_count: episodeCount,
          episode_runtime: episodeRuntime,
          genres,
          release_date: item.releaseDate || '',
          overview,
          priority: 'medium',
        });
      }
      await remove(item.mediaType, item.tmdbId);
    } finally {
      setMovingKey(null);
    }
  }, [movingKey, isInWatchlist, addToWatchlist, remove]);

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'header') {
      return <Text style={st.groupHeader}>{row.label}</Text>;
    }
    const { item, released } = row;
    const days = item.releaseDate ? daysUntil(item.releaseDate) : null;
    const moving = movingKey === `${item.mediaType}-${item.tmdbId}`;
    const posterUri = tmdbImage(item.posterPath, 'w185');

    return (
      <View style={st.listCard}>
        <Pressable style={{ flexDirection: 'row', flex: 1 }} onPress={() => openItem(item.tmdbId, item.mediaType)}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={st.listPoster} />
          ) : (
            <View style={[st.listPoster, { justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="film-outline" size={22} color="#52525B" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text style={st.listTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={st.listDate}>
              {item.releaseDate ? formatDate(item.releaseDate) : 'Release date TBA'}
            </Text>
            {!released && (
              <View style={st.countPill}>
                <Ionicons name="time-outline" size={11} color="#10B981" />
                <Text style={st.countText}>{days === null ? 'TBA' : countdownText(days)}</Text>
              </View>
            )}
            {released && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={st.moveBtn} onPress={() => moveToWatchlist(item)} disabled={moving}>
                  {moving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="bookmark" size={12} color="#000" />
                      <Text style={st.moveBtnText}>Move to Watchlist</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable
          style={st.removeBtn}
          onPress={() => remove(item.mediaType, item.tmdbId)}
          hitSlop={8}
          accessibilityLabel="Remove from My Upcoming"
        >
          <Ionicons name="close" size={16} color="#71717A" />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Text style={st.headerTitle}>Upcoming & Anticipated</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={st.tabs}>
        {([
          { key: 'browse' as const, label: 'Browse' },
          { key: 'mine' as const, label: `My Upcoming (${saved.length})` },
        ]).map(t => (
          <Pressable
            key={t.key}
            style={[st.tab, tab === t.key && st.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[st.tabText, tab === t.key && st.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'mine' ? (
        <FlatList
          data={rows}
          keyExtractor={r => r.key}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.emptyWrap}>
              <View style={st.emptyCircle}>
                <Ionicons name="bookmark-outline" size={36} color="#3F3F46" />
              </View>
              <Text style={st.emptyTitle}>Nothing saved yet</Text>
              <Text style={st.emptySub}>
                Tap the bookmark on any upcoming movie to track its India release here.
              </Text>
              <Pressable style={st.emptyBtn} onPress={() => setTab('browse')}>
                <Text style={st.emptyBtnText}>Browse Upcoming</Text>
              </Pressable>
            </View>
          }
        />
      ) : loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="cloud-offline-outline" size={40} color="#52525B" />
          <Text style={{ color: '#E5E2E1', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
            Failed to load
          </Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderBrowseItem}
          extraData={saved}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.4,
  },
  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' },
  tabText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#10B981' },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.3,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
  },
  dateText: {
    color: '#10B981', fontSize: 11, fontWeight: '600',
  },
  bookmark: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  bookmarkActive: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.5)' },
  // My Upcoming list
  groupHeader: {
    color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: 12, marginBottom: 2,
  },
  listCard: {
    flexDirection: 'row', backgroundColor: '#121212', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  listPoster: { width: 64, height: 96, borderRadius: 10, backgroundColor: '#1A1A1A' },
  listTitle: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  listDate: { color: '#71717A', fontSize: 12, fontWeight: '500', marginTop: 4 },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  countText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  moveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#10B981',
    minWidth: 40, justifyContent: 'center',
  },
  moveBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14, marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  emptySub: { color: '#52525B', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 20, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  emptyBtnText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
});
