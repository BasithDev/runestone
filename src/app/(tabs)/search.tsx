import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatchlist } from '../../context/WatchlistContext';
import { tmdbGet } from '../../services/tmdb';
import AddToWatchlistSheet from '../../components/lists/AddToWatchlistSheet';
import { WatchlistPriority } from '../../services/watchlistStore';
import YearPickerSheet from '../../components/YearPickerSheet';

// ── Types ──────────────────────────────────────────────
interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
  // Person-specific
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: MediaItem[];
}

// ── Constants ──────────────────────────────────────────
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_W = 100;
const POSTER_H = 150;

const CHIPS = ['All', 'Movies', 'Series', 'Anime', 'Others'] as const;
type ChipType = (typeof CHIPS)[number];

// Map chips to TMDB media_type filter
const chipToMediaType: Record<ChipType, string | null> = {
  All: null,
  Movies: 'movie',
  Series: 'tv',
  Anime: 'tv', // filtered by genre later
  Others: null,
};

// Drop items without posters; Anime = TV results with the Animation genre (16).
function applyChipFilter(items: MediaItem[], chip: ChipType): MediaItem[] {
  let out = items.filter(i => i.poster_path);
  if (chip === 'Anime') out = out.filter(i => i.genre_ids?.includes(16));
  return out;
}

/** Release year of a movie/tv item ('' when unknown). */
function itemYear(i: MediaItem): string {
  return (i.release_date || i.first_air_date || '').slice(0, 4);
}

/** Client-side year filter (multi search, filmographies, trending). */
function applyYearFilter(items: MediaItem[], year: number | null): MediaItem[] {
  if (year == null) return items;
  const y = String(year);
  return items.filter(i => itemYear(i) === y);
}

// ── Result row component ─────────────────────────────
function ResultRow({ item, isSaved, onToggleSave }: {
  item: MediaItem;
  isSaved: boolean;
  onToggleSave: (item: MediaItem) => void;
}) {
  const router = useRouter();
  const title = item.title || item.name || 'Untitled';
  const hasRating = item.vote_average > 0;
  const rating = hasRating ? item.vote_average.toFixed(1) : null;
  const voteCount = item.vote_count ?? 0;
  const plot = item.overview || 'No description available.';
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

  // Format vote count: 1200 → 1.2k
  const formatVotes = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <Pressable
      style={styles.resultRow}
      onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id, media_type: mediaType } } as any)}
    >
      {/* Poster */}
      <View style={styles.posterContainer}>
        <Image
          source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
          style={styles.poster}
          resizeMode="cover"
        />
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.resultTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.resultPlot} numberOfLines={5}>{plot}</Text>
        <View style={styles.ratingRow}>
          {hasRating ? (
            <>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#10B981" />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
              {voteCount > 0 && (
                <Text style={styles.dateText}>({formatVotes(voteCount)})</Text>
              )}
            </>
          ) : (
            <Text style={styles.noRatingText}>No ratings</Text>
          )}
          {item.release_date || item.first_air_date ? (
            <Text style={styles.dateText}>
              {(item.release_date || item.first_air_date || '').slice(0, 4)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.saveButton, isSaved && styles.saveButtonActive]}
        onPress={(e) => { e.stopPropagation(); onToggleSave(item); }}
      >
        <Ionicons
          name={isSaved ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={isSaved ? '#10B981' : '#71717A'}
        />
      </Pressable>
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; person_id?: string; person_name?: string; company_id?: string; company_name?: string }>();

  const [query, setQuery] = useState(params.q || params.person_name || params.company_name || '');
  const [activeChip, setActiveChip] = useState<ChipType>('All');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [browseMode, setBrowseMode] = useState<'search' | 'person' | 'company'>('search');
  const [year, setYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const yearRef = useRef<number | null>(null); // read by fetchers without re-creating them

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const trendingReq = useRef(0);
  const requestId = useRef(0);          // bumped per new request; stale responses are dropped
  const lastParamsKey = useRef('');
  const [companyId, setCompanyId] = useState<string | null>(null);

  const { isInWatchlist, addItem, removeItem } = useWatchlist();

  // Modal state for watchlist confirmation
  const [modalItem, setModalItem] = useState<MediaItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // ── Fetch Trending (fallback) ────────────────────────
  const fetchTrending = useCallback(async (chip: ChipType) => {
    const reqId = ++trendingReq.current;
    setLoadingTrending(true);
    try {
      let endpoint = 'trending/all/day';
      if (chip === 'Movies') {
        endpoint = 'trending/movie/day';
      } else if (chip === 'Series' || chip === 'Anime') {
        endpoint = 'trending/tv/day';
      }

      const json = await tmdbGet<{ results?: MediaItem[] }>(endpoint);
      if (reqId !== trendingReq.current) return;

      if (json.results) {
        setTrending(applyChipFilter(json.results, chip).slice(0, 10));
      }
    } catch {
      // silently fail
    } finally {
      if (reqId === trendingReq.current) setLoadingTrending(false);
    }
  }, []);

  // Fetch trending on mount or when chip changes if query is empty
  useEffect(() => {
    if (!query.trim()) {
      fetchTrending(activeChip);
    }
  }, [activeChip, query, fetchTrending]);

  // ── Fetch person filmography ─────────────────────────
  const fetchPersonCredits = useCallback(async (personId: string) => {
    const reqId = ++requestId.current;
    setLoading(true);
    try {
      const json = await tmdbGet<{ cast?: any[] }>(`person/${personId}/combined_credits`);
      if (reqId !== requestId.current) return;
      if (json.cast) {
        const seen = new Set<number>();
        const items = json.cast
          .filter((i: any) => {
            if (!i.poster_path || (i.media_type !== 'movie' && i.media_type !== 'tv')) return false;
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          })
          .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0));
        setResults(items);
        setPage(1);
        setTotalPages(1);
      }
    } catch { /* silently fail */ }
    finally { if (reqId === requestId.current) setLoading(false); }
  }, []);

  // ── Company movies (paged discover) ──────────────────
  const discoverCompany = useCallback(
    (cid: string, pageNum: number) =>
      tmdbGet<{ results?: MediaItem[]; total_pages?: number }>('discover/movie', {
        with_companies: cid, sort_by: 'popularity.desc', page: pageNum,
        primary_release_year: yearRef.current ?? undefined,
      }),
    [],
  );

  const fetchCompanyMovies = useCallback(async (cid: string) => {
    const reqId = ++requestId.current;
    setLoading(true);
    try {
      const json = await discoverCompany(cid, 1);
      if (reqId !== requestId.current) return;
      if (json.results) {
        setResults(json.results.filter(i => i.poster_path).map(i => ({ ...i, media_type: 'movie' })));
        setTotalPages(json.total_pages || 1);
        setPage(1);
      }
    } catch { /* silently fail */ }
    finally { if (reqId === requestId.current) setLoading(false); }
  }, [discoverCompany]);

  // ── Search TMDb ──────────────────────────────────────
  const searchTMDb = useCallback((searchQuery: string, pageNum: number, chip: ChipType) => {
    const path = chip === 'Movies' ? 'search/movie'
      : chip === 'Series' || chip === 'Anime' ? 'search/tv'
      : 'search/multi';
    // search/movie and search/tv filter by year server-side; search/multi can't,
    // so those results are filtered on the device (applyYearFilter).
    const yr = yearRef.current ?? undefined;
    return tmdbGet<{ results?: MediaItem[]; total_pages?: number }>(path, {
      query: searchQuery,
      page: pageNum,
      ...(path === 'search/movie' ? { primary_release_year: yr } : {}),
      ...(path === 'search/tv' ? { first_air_date_year: yr } : {}),
    });
  }, []);

  // ── Execute search (debounced) ───────────────────────
  const executeSearch = useCallback(async (searchQuery: string, chip: ChipType) => {
    const reqId = ++requestId.current;
    if (!searchQuery.trim()) {
      setResults([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const json = await searchTMDb(searchQuery, 1, chip);
      if (reqId !== requestId.current) return;
      if (json?.results) {
        setResults(applyChipFilter(json.results, chip));
        setTotalPages(json.total_pages || 1);
        setPage(1);
      }
    } catch {
      // silently fail
    } finally {
      if (reqId === requestId.current) setLoading(false);
    }
  }, [searchTMDb]);

  // Handle query from params (e.g. from content details). The tab stays mounted,
  // so react to every change in param values rather than only the first.
  useEffect(() => {
    const key = `${params.person_id ?? ''}|${params.company_id ?? ''}|${params.q ?? ''}`;
    if (key === '||' || key === lastParamsKey.current) return;
    lastParamsKey.current = key;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (params.person_id) {
      setBrowseMode('person');
      setCompanyId(null);
      setQuery(params.person_name || 'Actor');
      fetchPersonCredits(params.person_id);
    } else if (params.company_id) {
      setBrowseMode('company');
      setCompanyId(params.company_id);
      setQuery(params.company_name || 'Studio');
      fetchCompanyMovies(params.company_id);
    } else if (params.q) {
      setBrowseMode('search');
      setCompanyId(null);
      setQuery(params.q);
      executeSearch(params.q, activeChip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.person_id, params.company_id, params.q, params.person_name, params.company_name]);

  // ── Debounced input handler ──────────────────────────
  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setBrowseMode('search'); // typing resets to normal search
    lastParamsKey.current = '';
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      executeSearch(text, activeChip);
    }, 500);
  }, [activeChip, executeSearch]);

  // ── Chip press ───────────────────────────────────────
  const onChipPress = useCallback((chip: ChipType) => {
    setActiveChip(chip);
    if (query.trim() && browseMode === 'search') {
      executeSearch(query, chip);
    }
  }, [query, browseMode, executeSearch]);

  // ── Year filter ──────────────────────────────────────
  const onYearChange = useCallback((y: number | null) => {
    yearRef.current = y;
    setYear(y);
    if (browseMode === 'company' && companyId) fetchCompanyMovies(companyId);
    else if (browseMode === 'search' && query.trim()) executeSearch(query, activeChip);
    // person mode: credits are already loaded; filtered on render
  }, [browseMode, companyId, query, activeChip, fetchCompanyMovies, executeSearch]);

  const visibleResults = useMemo(() => applyYearFilter(results, year), [results, year]);
  const visibleTrending = useMemo(() => applyYearFilter(trending, year), [trending, year]);

  // ── Load more (infinite scroll) ──────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || page >= totalPages || !query.trim() || browseMode === 'person') return;
    if (browseMode === 'company' && !companyId) return;

    const reqId = requestId.current; // a newer search invalidates this page
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const json = browseMode === 'company'
        ? await discoverCompany(companyId!, nextPage)
        : await searchTMDb(query, nextPage, activeChip);
      if (reqId !== requestId.current) return;
      if (json?.results) {
        let filtered = applyChipFilter(json.results, browseMode === 'company' ? 'All' : activeChip);
        if (browseMode === 'company') filtered = filtered.map(i => ({ ...i, media_type: 'movie' }));
        setResults((prev) => {
          const seen = new Set(prev.map(i => `${i.media_type}-${i.id}`));
          return [...prev, ...filtered.filter(i => !seen.has(`${i.media_type}-${i.id}`))];
        });
        setPage(nextPage);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, page, totalPages, query, activeChip, browseMode, companyId, searchTMDb, discoverCompany]);

  // ── Toggle watchlist ────────────────────────────────
  const handleToggleWatchlist = useCallback((item: MediaItem) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    if (isInWatchlist(item.id, mediaType)) {
      removeItem(item.id, mediaType);
    } else {
      setModalItem(item);
    }
  }, [isInWatchlist, removeItem]);

  const handleConfirmAdd = useCallback(async (priority: WatchlistPriority, whyAdded: string) => {
    if (!modalItem) return;
    const mediaType = modalItem.media_type || (modalItem.title ? 'movie' : 'tv');

    let runtime: number | null = null;
    let episodeCount: number | null = null;
    let episodeRuntime: number | null = null;
    let genres: string[] = [];

    // Fetch full details for runtime/episode data
    setModalLoading(true);
    try {
      const json = await tmdbGet<any>(`${mediaType}/${modalItem.id}`);
      runtime = json.runtime || null;
      episodeCount = json.number_of_episodes || null;
      // Try multiple sources for episode runtime
      episodeRuntime = json.episode_run_time?.[0]
        || json.last_episode_to_air?.runtime
        || null;
      genres = (json.genres || []).map((g: any) => g.name);
    } catch { /* use defaults */ }

    try {
      await addItem({
        id: modalItem.id,
        media_type: mediaType as 'movie' | 'tv',
        title: modalItem.title || modalItem.name || '',
        poster_path: modalItem.poster_path,
        backdrop_path: null,
        vote_average: modalItem.vote_average,
        vote_count: modalItem.vote_count || 0,
        runtime,
        episode_count: episodeCount,
        episode_runtime: episodeRuntime,
        genres,
        release_date: modalItem.release_date || modalItem.first_air_date || '',
        overview: modalItem.overview || '',
        priority,
        ...(whyAdded ? { why_added: whyAdded } : {}),
      });
    } finally {
      setModalLoading(false);
    }
    setModalItem(null);
  }, [modalItem, addItem]);

  // ── Render Trending Section (Fallback) ───────────────
  const renderTrendingSection = () => {
    if (loadingTrending) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      );
    }

    if (trending.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="film-outline" size={32} color="#52525B" />
          </View>
          <Text style={styles.emptyTitle}>No Trending Content</Text>
          <Text style={styles.emptySubtitle}>Unable to load trending shows at this moment.</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text style={styles.sectionTitle}>
          Top 10 Trending {activeChip === 'All' ? 'Now' : activeChip}
        </Text>
        <FlatList
          data={visibleTrending}
          keyExtractor={(item) => `trending-${item.id}`}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
          renderItem={({ item, index }) => {
            const title = item.title || item.name || 'Untitled';
            const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';

            const trendingMediaType = item.media_type || (item.title ? 'movie' : 'tv');
            return (
              <Pressable
                style={styles.trendingCard}
                onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id, media_type: trendingMediaType } } as any)}
              >
                <Image
                  source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
                  style={styles.trendingPoster}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  locations={[0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />
                
                {/* Rank Badge */}
                <View style={styles.trendingRank}>
                  <Text style={styles.trendingRankText}>{index + 1}</Text>
                </View>

                {/* Text overlay at bottom */}
                <View style={styles.trendingInfo}>
                  <Text style={styles.trendingTitle} numberOfLines={1}>{title}</Text>
                  <View style={styles.trendingMeta}>
                    <Ionicons name="star" size={10} color="#10B981" />
                    <Text style={styles.trendingRating}>{rating}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      </View>
    );
  };

  // ── Empty state ──────────────────────────────────────
  const EmptyState = () => {
    if (loading) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search" size={32} color="#10B981" />
          </View>
          <Text style={styles.emptyTitle}>Discover Content</Text>
          <Text style={styles.emptySubtitle}>
            Search for movies, series, anime, and more to add to your watchlist.
          </Text>
        </View>
      );
    }
    if (results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="film-outline" size={32} color="#52525B" />
          </View>
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term or filter.
          </Text>
        </View>
      );
    }
    if (year !== null && visibleResults.length === 0) {
      const serverFiltered = browseMode === 'company'
        || (browseMode === 'search' && activeChip !== 'All' && activeChip !== 'Others');
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={32} color="#52525B" />
          </View>
          <Text style={styles.emptyTitle}>Nothing from {year}</Text>
          <Text style={styles.emptySubtitle}>
            {serverFiltered
              ? 'Try another year or clear the year filter.'
              : 'Pick Movies or Series for a full year search, or load more results.'}
          </Text>
          {!serverFiltered && page < totalPages && browseMode === 'search' && (
            <Pressable onPress={loadMore} style={[styles.chip, styles.chipActive, { marginTop: 16 }]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{loadingMore ? 'Loading…' : 'Load more results'}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return null;
  };

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* ── Search Bar ──────────────────────────────── */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#52525B" style={{ marginRight: 10 }} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Movies, series, actors, directors..."
            placeholderTextColor="#52525B"
            value={query}
            onChangeText={onChangeText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { lastParamsKey.current = ''; requestId.current++; setLoading(false); setQuery(''); setResults([]); setBrowseMode('search'); setCompanyId(null); }}>
              <Ionicons name="close-circle" size={18} color="#52525B" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filter Chips ────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScrollView}
        contentContainerStyle={styles.chipsContainer}
      >
        {CHIPS.map((chip) => {
          const isActive = activeChip === chip;
          return (
            <Pressable
              key={chip}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onChipPress(chip)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {chip}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.chipDivider} />
        <Pressable
          style={[styles.chip, styles.yearChip, year !== null && styles.chipActive]}
          onPress={() => setYearPickerOpen(true)}
        >
          <Ionicons name="calendar-outline" size={13} color={year !== null ? '#10B981' : '#71717A'} />
          <Text style={[styles.chipText, year !== null && styles.chipTextActive]}>
            {year ?? 'Year'}
          </Text>
          {year !== null && (
            <Pressable onPress={() => onYearChange(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="#10B981" />
            </Pressable>
          )}
        </Pressable>
      </ScrollView>

      {/* ── Results / Trending Fallback ────────────── */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : !query.trim() ? (
        renderTrendingSection()
      ) : (
        <FlatList
          data={visibleResults}
          keyExtractor={(item) => `${item.media_type || 'x'}-${item.id}`}
          renderItem={({ item }) => (
            <ResultRow
              item={item}
              isSaved={isInWatchlist(item.id, item.media_type || (item.title ? 'movie' : 'tv'))}
              onToggleSave={handleToggleWatchlist}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : null
          }
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ── YEAR PICKER ────────────────────────── */}
      <YearPickerSheet
        visible={yearPickerOpen}
        value={year}
        onSelect={onYearChange}
        onClose={() => setYearPickerOpen(false)}
      />

      {/* ── ADD TO WATCHLIST SHEET ─────────────── */}
      <AddToWatchlistSheet
        visible={!!modalItem}
        title={modalItem?.title || modalItem?.name || ''}
        subtitle={modalItem ? (modalItem.media_type === 'tv' || (!modalItem.title && modalItem.name) ? 'Series' : 'Movie') : undefined}
        loading={modalLoading}
        onConfirm={handleConfirmAdd}
        onCancel={() => setModalItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
  },
  chipsScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  yearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  chipText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#10B981',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  posterContainer: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 8,
    justifyContent: 'center',
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  resultPlot: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 3,
  },
  ratingText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },
  noRatingText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  saveButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  trendingCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    position: 'relative',
  },
  trendingPoster: {
    width: '100%',
    height: '100%',
  },
  trendingRank: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  trendingRankText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  trendingSave: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingSaveActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  trendingInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  trendingTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendingRating: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#E5E2E1',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
});
