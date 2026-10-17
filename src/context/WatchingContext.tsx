import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  WatchingItem, WatchHistoryEntry, WatchingStatus,
  ComputedStats, PeriodStats, GenreStats, ContentType,
} from '../types';
import {
  getWatchingItems, addWatchingItem, updateWatchingProgress,
  updateWatchingStatus, removeWatchingItem, getWatchingItem,
  getWatchHistory, markAsCompleted, addToWatchHistory,
  computeLifetimeStats, computePeriodStats, computeGenreStats,
  computeStreak, getAvailableYears,
} from '../services/watchingStore';

interface WatchingContextType {
  // State
  watchingItems: WatchingItem[];
  awaitingItems: WatchingItem[];
  history: WatchHistoryEntry[];
  loading: boolean;

  // Computed
  lifetimeStats: ComputedStats['lifetime'];
  currentStreak: number;
  longestStreak: number;
  availableYears: number[];

  // Actions
  startWatching: (item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>) => Promise<WatchingItem>;
  updateProgress: (
    tmdbId: number, mediaType: string,
    updates: Partial<Pick<WatchingItem, 'currentSeason' | 'currentEpisode' | 'episodesWatched' | 'movieCompleted' | 'status'>>,
  ) => Promise<void>;
  markCompleted: (tmdbId: number, mediaType: string) => Promise<void>;
  markCaughtUp: (tmdbId: number, mediaType: string) => Promise<void>;
  remove: (tmdbId: number, mediaType: string) => Promise<void>;
  isItemWatching: (tmdbId: number, mediaType: string) => boolean;
  getItem: (tmdbId: number, mediaType: string) => WatchingItem | undefined;
  refresh: () => Promise<void>;

  // Stats helpers
  getPeriodStats: (year: number, month?: number | null) => PeriodStats;
  getGenreStats: () => GenreStats[];
}

const WatchingContext = createContext<WatchingContextType | null>(null);

export function WatchingProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  const loadData = useCallback(async () => {
    const [w, h] = await Promise.all([getWatchingItems(), getWatchHistory()]);
    setItems(w);
    setHistory(h);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Split into active watching vs caught_up
  const watchingItems = useMemo(() => items.filter(i => i.status === 'watching'), [items]);
  const awaitingItems = useMemo(() => items.filter(i => i.status === 'caught_up'), [items]);

  // Computed stats
  const lifetimeStats = useMemo(() => computeLifetimeStats(history), [history]);
  const streak = useMemo(() => computeStreak(history), [history]);
  const availableYears = useMemo(() => getAvailableYears(history), [history]);

  // Actions
  const startWatching = useCallback(async (item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>) => {
    const result = await addWatchingItem(item);
    await loadData();
    return result;
  }, [loadData]);

  const updateProgressCb = useCallback(async (
    tmdbId: number, mediaType: string,
    updates: Partial<Pick<WatchingItem, 'currentSeason' | 'currentEpisode' | 'episodesWatched' | 'movieCompleted' | 'status'>>,
  ) => {
    await updateWatchingProgress(tmdbId, mediaType, updates);
    await loadData();
  }, [loadData]);

  const markCompletedCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await markAsCompleted(tmdbId, mediaType);
    await loadData();
  }, [loadData]);

  const markCaughtUpCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await updateWatchingStatus(tmdbId, mediaType, 'caught_up');
    await loadData();
  }, [loadData]);

  const removeCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await removeWatchingItem(tmdbId, mediaType);
    await loadData();
  }, [loadData]);

  const isItemWatching = useCallback((tmdbId: number, mediaType: string) => {
    return items.some(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
  }, [items]);

  const getItemCb = useCallback((tmdbId: number, mediaType: string) => {
    return items.find(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
  }, [items]);

  // Period stats (not memoized since year/month params change)
  const getPeriodStats = useCallback((year: number, month?: number | null) => {
    return computePeriodStats(history, year, month);
  }, [history]);

  const getGenreStats = useCallback(() => {
    return computeGenreStats(history);
  }, [history]);

  const ctx = useMemo<WatchingContextType>(() => ({
    watchingItems,
    awaitingItems,
    history,
    loading,
    lifetimeStats,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    availableYears,
    startWatching,
    updateProgress: updateProgressCb,
    markCompleted: markCompletedCb,
    markCaughtUp: markCaughtUpCb,
    remove: removeCb,
    isItemWatching,
    getItem: getItemCb,
    refresh: loadData,
    getPeriodStats,
    getGenreStats,
  }), [
    watchingItems, awaitingItems, history, loading, lifetimeStats, streak, availableYears,
    startWatching, updateProgressCb, markCompletedCb, markCaughtUpCb, removeCb,
    isItemWatching, getItemCb, loadData, getPeriodStats, getGenreStats,
  ]);

  return <WatchingContext.Provider value={ctx}>{children}</WatchingContext.Provider>;
}

export function useWatching(): WatchingContextType {
  const ctx = useContext(WatchingContext);
  if (!ctx) throw new Error('useWatching must be used within WatchingProvider');
  return ctx;
}
