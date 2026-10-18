import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  WatchingItem, WatchHistoryEntry,
  ComputedStats, PeriodStats, GenreStats,
} from '../types';
import {
  getWatchingItems, addWatchingItem, patchWatchingItem,
  updateWatchingStatus, removeWatchingItem,
  getWatchHistory, markAsCompleted,
  putOnHold, dropWatchingItem, resumeWatchingItem, advanceWatchingItem,
  computeLifetimeStats, computePeriodStats, computeGenreStats, computeDirectorStats,
  computeStreak, getAvailableYears,
  WatchingPatch, DirectorStat,
} from '../services/watchingStore';

interface WatchingContextType {
  // State
  watchingItems: WatchingItem[];   // watching + rewatching (In Progress)
  awaitingItems: WatchingItem[];   // caught_up
  onHoldItems: WatchingItem[];
  droppedItems: WatchingItem[];
  history: WatchHistoryEntry[];
  loading: boolean;

  // Computed
  lifetimeStats: ComputedStats['lifetime'];
  currentStreak: number;
  longestStreak: number;
  availableYears: number[];
  directorStats: DirectorStat[];

  // Actions
  startWatching: (item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>) => Promise<WatchingItem>;
  updateProgress: (tmdbId: number, mediaType: string, updates: WatchingPatch) => Promise<void>;
  markCompleted: (tmdbId: number, mediaType: string) => Promise<void>;
  markCaughtUp: (tmdbId: number, mediaType: string) => Promise<void>;
  putOnHold: (tmdbId: number, mediaType: string, note: string) => Promise<void>;
  dropItem: (tmdbId: number, mediaType: string, reason: string, rating?: number | null) => Promise<void>;
  resume: (tmdbId: number, mediaType: string) => Promise<void>;
  advance: (tmdbId: number, mediaType: string) => Promise<boolean>;
  remove: (tmdbId: number, mediaType: string) => Promise<void>;
  isItemWatching: (tmdbId: number, mediaType: string) => boolean;
  getItem: (tmdbId: number, mediaType: string) => WatchingItem | undefined;
  getHistoryEntries: (tmdbId: number, mediaType: string) => WatchHistoryEntry[];
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

  // Split by status
  const watchingItems = useMemo(
    () => items.filter(i => i.status === 'watching' || i.status === 'rewatching'), [items]);
  const awaitingItems = useMemo(() => items.filter(i => i.status === 'caught_up'), [items]);
  const onHoldItems = useMemo(() => items.filter(i => i.status === 'on_hold'), [items]);
  const droppedItems = useMemo(() => items.filter(i => i.status === 'dropped'), [items]);

  // Computed stats
  const lifetimeStats = useMemo(() => computeLifetimeStats(history), [history]);
  const streak = useMemo(() => computeStreak(history), [history]);
  const availableYears = useMemo(() => getAvailableYears(history), [history]);
  const directorStats = useMemo(() => computeDirectorStats(history), [history]);

  // Actions
  const startWatching = useCallback(async (item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>) => {
    const result = await addWatchingItem(item);
    await loadData();
    return result;
  }, [loadData]);

  const updateProgressCb = useCallback(async (tmdbId: number, mediaType: string, updates: WatchingPatch) => {
    await patchWatchingItem(tmdbId, mediaType, updates);
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

  const putOnHoldCb = useCallback(async (tmdbId: number, mediaType: string, note: string) => {
    await putOnHold(tmdbId, mediaType, note);
    await loadData();
  }, [loadData]);

  const dropCb = useCallback(async (tmdbId: number, mediaType: string, reason: string, rating?: number | null) => {
    await dropWatchingItem(tmdbId, mediaType, reason, rating);
    await loadData();
  }, [loadData]);

  const resumeCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await resumeWatchingItem(tmdbId, mediaType);
    await loadData();
  }, [loadData]);

  const advanceCb = useCallback(async (tmdbId: number, mediaType: string) => {
    const ok = await advanceWatchingItem(tmdbId, mediaType);
    await loadData();
    return ok;
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

  const getHistoryEntries = useCallback((tmdbId: number, mediaType: string) => {
    return history.filter(h => h.tmdbId === tmdbId && h.mediaType === mediaType);
  }, [history]);

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
    onHoldItems,
    droppedItems,
    history,
    loading,
    lifetimeStats,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    availableYears,
    directorStats,
    startWatching,
    updateProgress: updateProgressCb,
    markCompleted: markCompletedCb,
    markCaughtUp: markCaughtUpCb,
    putOnHold: putOnHoldCb,
    dropItem: dropCb,
    resume: resumeCb,
    advance: advanceCb,
    remove: removeCb,
    isItemWatching,
    getItem: getItemCb,
    getHistoryEntries,
    refresh: loadData,
    getPeriodStats,
    getGenreStats,
  }), [
    watchingItems, awaitingItems, onHoldItems, droppedItems, history, loading, lifetimeStats, streak,
    availableYears, directorStats,
    startWatching, updateProgressCb, markCompletedCb, markCaughtUpCb, putOnHoldCb, dropCb, resumeCb,
    advanceCb, removeCb, isItemWatching, getItemCb, getHistoryEntries, loadData, getPeriodStats, getGenreStats,
  ]);

  return <WatchingContext.Provider value={ctx}>{children}</WatchingContext.Provider>;
}

export function useWatching(): WatchingContextType {
  const ctx = useContext(WatchingContext);
  if (!ctx) throw new Error('useWatching must be used within WatchingProvider');
  return ctx;
}
