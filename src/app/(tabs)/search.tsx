import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWatchlist } from '../../context/WatchlistContext';
import { useWatching } from '../../context/WatchingContext';
import { tmdbGet } from '../../services/tmdb';
import AddToWatchlistSheet from '../../components/lists/AddToWatchlistSheet';
import { WatchlistPriority } from '../../services/watchlistStore';
import YearPickerSheet from '../../components/YearPickerSheet';
import QuickTrackSheet, { QuickTrackTarget } from '../../components/tracking/QuickTrackSheet';
import ResultCard from '../../components/search/ResultCard';
import SearchHistory from '../../components/search/SearchHistory';
import FiltersSheet from '../../components/search/FiltersSheet';
import ActiveFilterChips from '../../components/search/ActiveFilterChips';
import Snackbar from '../../components/search/Snackbar';
import TrendingRow from '../../components/search/TrendingRow';
import StateView from '../../components/search/StateView';
import { useSearchHistory, RecentTitle } from '../../components/search/useSearchHistory';
import { useGenres } from '../../components/search/useGenres';
import {
  MediaItem,
  SearchFilters,
  DEFAULT_FILTERS,
  applyClientFilters,
  countActiveFilters,
  itemDate,
  mediaTypeOf,
  sortItems,
} from '../../components/search/types';

// ── Constants ──────────────────────────────────────────
const CHIPS = ['All', 'Movies', 'Series', 'Anime', 'Others'] as const;
type ChipType = (typeof CHIPS)[number];

// Drop items without posters (and people); Anime = TV results with the Animation genre (16).
function applyChipFilter(items: MediaItem[], chip: ChipType): MediaItem[] {
  let out = items.filter(i => i.poster_path && i.media_type !== 'person');
  if (chip === 'Anime') out = out.filter(i => i.genre_ids?.includes(16));
  return out;
}

/** Client-side year filter (multi search, filmographies). */
function applyYearFilter(items: MediaItem[], year: number | null): MediaItem[] {
  if (year == null) return items;
  const y = String(year);
  return items.filter(i => itemDate(i).slice(0, 4) === y);
}

const keyOfResult = (item: MediaItem) => `${mediaTypeOf(item)}-${item.id}`;

type PagedResponse = { results?: MediaItem[]; total_pages?: number };

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
  const [error, setError] = useState(false);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [trendingError, setTrendingError] = useState(false);
  const [browseMode, setBrowseMode] = useState<'search' | 'person' | 'company'>('search');
  const [year, setYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [quickTarget, setQuickTarget] = useState<QuickTrackTarget | null>(null);
  const [snack, setSnack] = useState<{ message: string; nonce: number } | null>(null);

  // Read by fetchers without re-creating them
  const yearRef = useRef<number | null>(null);
  const filtersRef = useRef<SearchFilters>(DEFAULT_FILTERS);
  const personIdRef = useRef<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trendingReq = useRef(0);
  const requestId = useRef(0);          // bumped per new request; stale responses are dropped
  const loadMoreFailed = useRef(false); // stops auto-paging after a failed page
  const lastParamsKey = useRef('');

  const { isInWatchlist, addItem, removeItem } = useWatchlist();
  const { getItem, getHistoryEntries } = useWatching();
  const { history, recentTitles, addQuery, removeQuery, clearHistory, addTitle } = useSearchHistory();
  const { genres, loading: genresLoading, error: genresError, reload: reloadGenres } = useGenres();
  const genresRef = useRef(genres);
  genresRef.current = genres;

  // Modal state for watchlist confirmation
  const [modalItem, setModalItem] = useState<MediaItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const activeCount = countActiveFilters(filters, year);
  const isBrowse = browseMode === 'search' && !query.trim() && activeCount > 0;
  const showList = !!query.trim() || isBrowse;

  const beginRequest = useCallback(() => {
    loadMoreFailed.current = false;
    setError(false);
    return ++requestId.current;
  }, []);

  // ── Fetch Trending ───────────────────────────────────
  const fetchTrending = useCallback(async (chip: ChipType) => {
    const reqId = ++trendingReq.current;
    setLoadingTrending(true);
    setTrendingError(false);
    try {
      const endpoint = chip === 'Movies' ? 'trending/movie/day'
        : chip === 'Series' || chip === 'Anime' ? 'trending/tv/day'
        : 'trending/all/day';
      const json = await tmdbGet<{ results?: MediaItem[] }>(endpoint);
      if (reqId !== trendingReq.current) return;
      setTrending(applyChipFilter(json.results ?? [], chip).slice(0, 10));
    } catch {
      if (reqId === trendingReq.current) setTrendingError(true);
    } finally {
      if (reqId === trendingReq.current) setLoadingTrending(false);
    }
  }, []);

  // Fetch trending on mount or when chip changes if query is empty
  useEffect(() => {
    if (!query.trim()) fetchTrending(activeChip);
  }, [activeChip, query, fetchTrending]);

  // ── Fetch person filmography ─────────────────────────
  const fetchPersonCredits = useCallback(async (personId: string) => {
    const reqId = beginRequest();
    setLoading(true);
    try {
      const json = await tmdbGet<{ cast?: any[] }>(`person/${personId}/combined_credits`);
      if (reqId !== requestId.current) return;
      const seen = new Set<number>();
      const items = (json.cast ?? [])
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
    } catch {
      if (reqId === requestId.current) { setResults([]); setError(true); }
    } finally { if (reqId === requestId.current) setLoading(false); }
  }, [beginRequest]);

  // ── Company movies (paged discover) ──────────────────
  const discoverCompany = useCallback(
    (cid: string, pageNum: number) =>
      tmdbGet<PagedResponse>('discover/movie', {
        with_companies: cid, sort_by: 'popularity.desc', page: pageNum,
        primary_release_year: yearRef.current ?? undefined,
      }),
    [],
  );

  const fetchCompanyMovies = useCallback(async (cid: string) => {
    const reqId = beginRequest();
    setLoading(true);
    try {
      const json = await discoverCompany(cid, 1);
      if (reqId !== requestId.current) return;
      setResults((json.results ?? []).filter(i => i.poster_path).map(i => ({ ...i, media_type: 'movie' })));
      setTotalPages(json.total_pages || 1);
      setPage(1);
    } catch {
      if (reqId === requestId.current) { setResults([]); setError(true); }
    } finally { if (reqId === requestId.current) setLoading(false); }
  }, [discoverCompany, beginRequest]);

  // ── Browse (empty query + filters) via discover ──────
  const fetchBrowse = useCallback(async (chip: ChipType, pageNum: number) => {
    const f = filtersRef.current;
    const yr = yearRef.current ?? undefined;
    const types: ('movie' | 'tv')[] = chip === 'Movies' ? ['movie']
      : chip === 'Series' || chip === 'Anime' ? ['tv']
      : ['movie', 'tv'];
    const today = new Date().toISOString().slice(0, 10);

    const calls = types.map(async (t) => {
      // Genre ids differ between movie and tv lists; keep the ones valid for this type.
      const valid = f.genres.filter(id => {
        const g = genresRef.current.find(x => x.id === id);
        return !g || g[t];
      });
      if (f.genres.length && valid.length === 0) return null;

      let withGenres: string | undefined;
      if (chip === 'Anime') withGenres = [16, ...valid.filter(id => id !== 16)].join(',');
      else if (valid.length) withGenres = valid.join('|'); // any of the selected genres

      const newest = f.sort === 'newest';
      const dateKey = t === 'movie' ? 'primary_release_date' : 'first_air_date';
      const json = await tmdbGet<PagedResponse>(`discover/${t}`, {
        with_genres: withGenres,
        with_original_language: f.language ?? undefined,
        'vote_average.gte': f.minRating ?? undefined,
        'vote_count.gte': f.minRating || f.sort === 'rating' ? 50 : undefined,
        sort_by: f.sort === 'rating' ? 'vote_average.desc' : newest ? `${dateKey}.desc` : 'popularity.desc',
        ...(newest ? { [`${dateKey}.lte`]: today } : {}),
        ...(t === 'movie' ? { primary_release_year: yr } : { first_air_date_year: yr }),
        page: pageNum,
      });
      return { t, json };
    });

    const settled = await Promise.all(calls);
    let items: MediaItem[] = [];
    let total = 1;
    for (const r of settled) {
      if (!r) continue;
      total = Math.max(total, r.json.total_pages || 1);
      items = items.concat((r.json.results ?? []).filter(i => i.poster_path).map(i => ({ ...i, media_type: r.t })));
    }
    // Interleave movie + tv by the chosen sort (popularity by default).
    return { items: sortItems(items, f.sort === 'relevance' ? 'popularity' : f.sort), totalPages: total };
  }, []);

  // ── Search TMDb ──────────────────────────────────────
  const searchTMDb = useCallback((searchQuery: string, pageNum: number, chip: ChipType) => {
    const path = chip === 'Movies' ? 'search/movie'
      : chip === 'Series' || chip === 'Anime' ? 'search/tv'
      : 'search/multi';
    // search/movie and search/tv filter by year server-side; search/multi can't,
    // so those results are filtered on the device (applyYearFilter).
    const yr = yearRef.current ?? undefined;
    return tmdbGet<PagedResponse>(path, {
      query: searchQuery,
      page: pageNum,
      ...(path === 'search/movie' ? { primary_release_year: yr } : {}),
      ...(path === 'search/tv' ? { first_air_date_year: yr } : {}),
    });
  }, []);

  // ── Execute search (debounced) / browse ──────────────
  const executeSearch = useCallback(async (searchQuery: string, chip: ChipType) => {
    const reqId = beginRequest();
    const browsing = !searchQuery.trim();

    if (browsing && countActiveFilters(filtersRef.current, yearRef.current) === 0) {
      setResults([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (browsing) {
        const { items, totalPages: tp } = await fetchBrowse(chip, 1);
        if (reqId !== requestId.current) return;
        setResults(items);
        setTotalPages(tp);
        setPage(1);
      } else {
        const json = await searchTMDb(searchQuery, 1, chip);
        if (reqId !== requestId.current) return;
        const items = applyChipFilter(json?.results ?? [], chip);
        setResults(items);
        setTotalPages(json?.total_pages || 1);
        setPage(1);
        if (items.length > 0) addQuery(searchQuery);
      }
    } catch {
      if (reqId === requestId.current) { setResults([]); setError(true); }
    } finally {
      if (reqId === requestId.current) setLoading(false);
    }
  }, [searchTMDb, fetchBrowse, beginRequest, addQuery]);

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
      personIdRef.current = params.person_id;
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

  // ── Input handlers ───────────────────────────────────
  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setBrowseMode('search'); // typing resets to normal search
    lastParamsKey.current = '';
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      executeSearch(text, activeChip);
    }, 500);
  }, [activeChip, executeSearch]);

  const onSubmit = useCallback(() => {
    if (!query.trim() || browseMode !== 'search') return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    addQuery(query);
    executeSearch(query, activeChip);
  }, [query, browseMode, activeChip, addQuery, executeSearch]);

  const onClear = useCallback(() => {
    lastParamsKey.current = '';
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setQuery('');
    setResults([]);
    setBrowseMode('search');
    setCompanyId(null);
    executeSearch('', activeChip); // bumps the request id; re-browses if filters are active
  }, [activeChip, executeSearch]);

  const onSelectHistory = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    lastParamsKey.current = '';
    Keyboard.dismiss();
    setQuery(q);
    setBrowseMode('search');
    setCompanyId(null);
    addQuery(q);
    executeSearch(q, activeChip);
  }, [activeChip, addQuery, executeSearch]);

  const onChipPress = useCallback((chip: ChipType) => {
    setActiveChip(chip);
    if (browseMode === 'search') executeSearch(query, chip);
  }, [query, browseMode, executeSearch]);

  // ── Filters / year ───────────────────────────────────
  const applyFilters = useCallback((f: SearchFilters, y: number | null) => {
    const yearChanged = y !== yearRef.current;
    filtersRef.current = f;
    yearRef.current = y;
    setFilters(f);
    setYear(y);
    if (browseMode === 'search') executeSearch(query, activeChip);
    else if (browseMode === 'company' && companyId && yearChanged) fetchCompanyMovies(companyId);
    // person mode: credits are already loaded; filtered on render
  }, [browseMode, companyId, query, activeChip, fetchCompanyMovies, executeSearch]);

  const onYearChange = useCallback((y: number | null) => {
    applyFilters(filtersRef.current, y);
  }, [applyFilters]);

  const onFiltersChange = useCallback((f: SearchFilters) => {
    applyFilters(f, yearRef.current);
  }, [applyFilters]);

  const onClearYear = useCallback(() => applyFilters(filtersRef.current, null), [applyFilters]);
  const onClearAllFilters = useCallback(() => applyFilters(DEFAULT_FILTERS, null), [applyFilters]);

  // Browse results are filtered by TMDb; everything else is filtered on the device.
  const visibleResults = useMemo(() => {
    const byYear = applyYearFilter(results, year);
    return isBrowse ? byYear : applyClientFilters(byYear, filters);
  }, [results, year, filters, isBrowse]);

  // ── Load more (infinite scroll) ──────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || page >= totalPages || !showList || browseMode === 'person') return;
    if (browseMode === 'company' && !companyId) return;

    const reqId = requestId.current; // a newer search invalidates this page
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      let incoming: MediaItem[];
      if (browseMode === 'company') {
        const json = await discoverCompany(companyId!, nextPage);
        incoming = applyChipFilter(json.results ?? [], 'All').map(i => ({ ...i, media_type: 'movie' }));
      } else if (isBrowse) {
        incoming = (await fetchBrowse(activeChip, nextPage)).items;
      } else {
        const json = await searchTMDb(query, nextPage, activeChip);
        incoming = applyChipFilter(json?.results ?? [], activeChip);
      }
      if (reqId !== requestId.current) return;
      setResults((prev) => {
        const seen = new Set(prev.map(keyOfResult));
        return [...prev, ...incoming.filter(i => !seen.has(keyOfResult(i)))];
      });
      setPage(nextPage);
    } catch {
      loadMoreFailed.current = true;
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, page, totalPages, showList, query, activeChip, browseMode, companyId, isBrowse, searchTMDb, discoverCompany, fetchBrowse]);

  // Device-side filters can leave a page nearly empty; keep paging a few pages.
  useEffect(() => {
    if (!showList || loading || loadingMore || loadMoreFailed.current || browseMode === 'person') return;
    if (results.length > 0 && visibleResults.length < 6 && page < totalPages && page < 8) loadMore();
  }, [showList, loading, loadingMore, browseMode, results.length, visibleResults.length, page, totalPages, loadMore]);

  // ── Retry ────────────────────────────────────────────
  const onRetry = useCallback(() => {
    if (browseMode === 'person' && personIdRef.current) fetchPersonCredits(personIdRef.current);
    else if (browseMode === 'company' && companyId) fetchCompanyMovies(companyId);
    else executeSearch(query, activeChip);
  }, [browseMode, companyId, query, activeChip, fetchPersonCredits, fetchCompanyMovies, executeSearch]);

  const onRetryTrending = useCallback(() => fetchTrending(activeChip), [activeChip, fetchTrending]);

  // ── Opening titles ───────────────────────────────────
  const openTitle = useCallback((id: number, mediaType: string) => {
    router.push({ pathname: '/content/[id]', params: { id, media_type: mediaType } } as any);
  }, [router]);

  const onOpenItem = useCallback((item: MediaItem) => {
    const mt = mediaTypeOf(item);
    addTitle({ id: item.id, media_type: mt, title: item.title || item.name || 'Untitled', poster_path: item.poster_path });
    openTitle(item.id, mt);
  }, [addTitle, openTitle]);

  const onOpenRecent = useCallback((t: RecentTitle) => {
    addTitle(t);
    openTitle(t.id, t.media_type);
  }, [addTitle, openTitle]);

  // ── Quick track + snackbar ───────────────────────────
  const onQuickTrack = useCallback((item: MediaItem) => {
    setQuickTarget({
      tmdbId: item.id,
      mediaType: mediaTypeOf(item),
      title: item.title || item.name || 'Untitled',
      posterPath: item.poster_path,
      releaseDate: itemDate(item) || null,
    });
  }, []);
  const closeQuickTrack = useCallback(() => setQuickTarget(null), []);
  const onQuickDone = useCallback((message: string) => {
    setQuickTarget(null);
    setSnack(prev => ({ message, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);
  const hideSnack = useCallback(() => setSnack(null), []);

  // ── Toggle watchlist ────────────────────────────────
  const handleToggleWatchlist = useCallback((item: MediaItem) => {
    const mediaType = mediaTypeOf(item);
    if (isInWatchlist(item.id, mediaType)) {
      removeItem(item.id, mediaType);
    } else {
      setModalItem(item);
    }
  }, [isInWatchlist, removeItem]);

  const handleConfirmAdd = useCallback(async (priority: WatchlistPriority, whyAdded: string) => {
    if (!modalItem) return;
    const mediaType = mediaTypeOf(modalItem);

    let runtime: number | null = null;
    let episodeCount: number | null = null;
    let episodeRuntime: number | null = null;
    let genreNames: string[] = [];

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
      genreNames = (json.genres || []).map((g: any) => g.name);
    } catch { /* use defaults */ }

    try {
      await addItem({
        id: modalItem.id,
        media_type: mediaType,
        title: modalItem.title || modalItem.name || '',
        poster_path: modalItem.poster_path,
        backdrop_path: null,
        vote_average: modalItem.vote_average,
        vote_count: modalItem.vote_count || 0,
        runtime,
        episode_count: episodeCount,
        episode_runtime: episodeRuntime,
        genres: genreNames,
        release_date: itemDate(modalItem),
        overview: modalItem.overview || '',
        priority,
        ...(whyAdded ? { why_added: whyAdded } : {}),
      });
    } finally {
      setModalLoading(false);
    }
    setModalItem(null);
  }, [modalItem, addItem]);
  const cancelWatchlist = useCallback(() => setModalItem(null), []);

  // ── List rendering ───────────────────────────────────
  const listExtra = useMemo(
    () => ({ getItem, getHistoryEntries, isInWatchlist }),
    [getItem, getHistoryEntries, isInWatchlist],
  );

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
    const mt = mediaTypeOf(item);
    return (
      <ResultCard
        item={item}
        index={index}
        status={getItem(item.id, mt)?.status}
        watched={getHistoryEntries(item.id, mt).length > 0}
        saved={isInWatchlist(item.id, mt)}
        onOpen={onOpenItem}
        onQuickTrack={onQuickTrack}
        onToggleSave={handleToggleWatchlist}
      />
    );
  }, [getItem, getHistoryEntries, isInWatchlist, onOpenItem, onQuickTrack, handleToggleWatchlist]);

  const emptyEl = useMemo(() => {
    if (loading) return null;
    if (error) {
      return (
        <StateView
          icon="cloud-offline-outline" tone="error"
          title="Something went wrong"
          subtitle="We couldn't reach TMDb. Check your connection and try again."
          actionLabel="Retry" onAction={onRetry}
        />
      );
    }
    if (results.length > 0 && year !== null && visibleResults.length === 0 && activeCount === 1) {
      return (
        <StateView
          icon="calendar-outline" title={`Nothing from ${year}`}
          subtitle="Try another year or clear the year filter."
          actionLabel="Clear year" onAction={onClearYear}
        />
      );
    }
    return (
      <StateView
        icon="film-outline" title="No results found"
        subtitle={activeCount > 0 ? 'Try loosening or clearing some filters.' : 'Try a different search term.'}
        actionLabel={activeCount > 0 ? 'Clear filters' : undefined}
        onAction={activeCount > 0 ? onClearAllFilters : undefined}
      />
    );
  }, [loading, error, results.length, visibleResults.length, year, activeCount, onRetry, onClearYear, onClearAllFilters]);

  const footerEl = useMemo(
    () => (loadingMore ? <View style={styles.footerLoader}><ActivityIndicator size="small" color="#10B981" /></View> : null),
    [loadingMore],
  );

  const trendingTitle = `Top 10 Trending ${activeChip === 'All' ? 'Now' : activeChip}`;

  const bottomPad = 110;
  const emptyQueryContent = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomPad }}
    >
      <SearchHistory
        history={history}
        recentTitles={recentTitles}
        onSelectQuery={onSelectHistory}
        onRemoveQuery={removeQuery}
        onClearAll={clearHistory}
        onOpenTitle={onOpenRecent}
      />
      {loadingTrending && trending.length === 0 ? (
        <View style={styles.trendingLoader}><ActivityIndicator size="large" color="#10B981" /></View>
      ) : trendingError && trending.length === 0 ? (
        <StateView
          icon="cloud-offline-outline" tone="error" title="Couldn't load trending"
          subtitle="Check your connection and try again."
          actionLabel="Retry" onAction={onRetryTrending}
        />
      ) : trending.length === 0 ? (
        <StateView icon="search" tone="accent" title="Discover content" subtitle="Search for movies, series, anime, and more to track or add to your watchlist." />
      ) : (
        <TrendingRow title={trendingTitle} items={trending} onOpen={onOpenItem} />
      )}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top, backgroundColor: '#000' }}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* ── Search Bar ──────────────────────────────── */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#52525B" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Movies, series, actors, directors..."
            placeholderTextColor="#52525B"
            value={query}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />}
          {query.length > 0 && (
            <Pressable onPress={onClear} hitSlop={8} style={{ marginLeft: 8 }} accessibilityLabel="Clear search">
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
        keyboardShouldPersistTaps="handled"
      >
        {CHIPS.map((chip) => {
          const isActive = activeChip === chip;
          return (
            <Pressable
              key={chip}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onChipPress(chip)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
            </Pressable>
          );
        })}
        <View style={styles.chipDivider} />
        <Pressable
          style={[styles.chip, styles.iconChip, year !== null && styles.chipActive]}
          onPress={() => setYearPickerOpen(true)}
        >
          <Ionicons name="calendar-outline" size={13} color={year !== null ? '#10B981' : '#71717A'} />
          <Text style={[styles.chipText, year !== null && styles.chipTextActive]}>{year ?? 'Year'}</Text>
          {year !== null && (
            <Pressable onPress={onClearYear} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="#10B981" />
            </Pressable>
          )}
        </Pressable>
        <Pressable
          style={[styles.chip, styles.iconChip, activeCount > 0 && styles.chipActive]}
          onPress={() => setFiltersOpen(true)}
        >
          <Ionicons name="options-outline" size={14} color={activeCount > 0 ? '#10B981' : '#71717A'} />
          <Text style={[styles.chipText, activeCount > 0 && styles.chipTextActive]}>Filters</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>

      <ActiveFilterChips
        filters={filters}
        year={year}
        genres={genres}
        onChange={onFiltersChange}
        onClearYear={onClearYear}
        onClearAll={onClearAllFilters}
      />

      {/* ── Results / Recent + Trending ────────────── */}
      {showList ? (
        loading && visibleResults.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={visibleResults}
            extraData={listExtra}
            keyExtractor={keyOfResult}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={emptyEl}
            ListFooterComponent={footerEl}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            windowSize={9}
          />
        )
      ) : emptyQueryContent}

      <Snackbar message={snack?.message ?? null} nonce={snack?.nonce ?? 0} onHide={hideSnack} />

      <YearPickerSheet
        visible={yearPickerOpen}
        value={year}
        onSelect={onYearChange}
        onClose={() => setYearPickerOpen(false)}
      />

      <FiltersSheet
        visible={filtersOpen}
        filters={filters}
        year={year}
        genres={genres}
        genresLoading={genresLoading}
        genresError={genresError}
        onRetryGenres={reloadGenres}
        onApply={applyFilters}
        onClose={() => setFiltersOpen(false)}
      />

      <QuickTrackSheet
        visible={!!quickTarget}
        target={quickTarget}
        onClose={closeQuickTrack}
        onDone={onQuickDone}
      />

      <AddToWatchlistSheet
        visible={!!modalItem}
        title={modalItem?.title || modalItem?.name || ''}
        subtitle={modalItem ? (mediaTypeOf(modalItem) === 'tv' ? 'Series' : 'Movie') : undefined}
        loading={modalLoading}
        onConfirm={handleConfirmAdd}
        onCancel={cancelWatchlist}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -1.2 },
  searchBarContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    height: 50,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '400' },
  chipsScrollView: { flexGrow: 0, flexShrink: 0 },
  chipsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipDivider: { width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  iconChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
  chipText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#10B981' },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '800' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  trendingLoader: { height: 225, justifyContent: 'center', alignItems: 'center' },
  footerLoader: { paddingVertical: 20 },
});
