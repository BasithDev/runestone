import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  WatchingItem, WatchHistoryEntry, WatchLogEntry,
  ComputedStats, PeriodStats, GenreStats,
} from '../types';
import {
  getWatchingItems, addWatchingItem, patchWatchingItem,
  updateWatchingStatus, removeWatchingItem, setWatchCount,
  getWatchHistory, getWatchLog, markAsCompleted, markWatchingCaughtUp, repairCaughtUpProgress,
  putOnHold, dropWatchingItem, resumeWatchingItem, advanceWatchingItem,
  computeLifetimeStats, computePeriodStats, computeGenreStats, computeDirectorStats,
  computeStreak, getAvailableYears,
  WatchingPatch, DirectorStat,
} from '../services/watchingStore';
import { buildLibrary, LibraryEntry } from '../services/statsInsights';

interface WatchingContextType {
  // State
  watchingItems: WatchingItem[];   // watching + rewatching (In Progress)
  awaitingItems: WatchingItem[];   // caught_up
  onHoldItems: WatchingItem[];
  droppedItems: WatchingItem[];
  history: WatchHistoryEntry[];
  watchLog: WatchLogEntry[];
  /** Everything watched (any progress), newest activity first — for the Stats screen. */
  library: LibraryEntry[];
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
  /** Removes the title completely: tracking, watch history and logged watch time. */
  remove: (tmdbId: number, mediaType: string) => Promise<void>;
  /** Sets how many times a watched title was completed (min 1). */
  setWatchCount: (tmdbId: number, mediaType: string, count: number) => Promise<void>;
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
  const [watchLog, setWatchLog] = useState<WatchLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Latest-wins: overlapping loads (rapid taps) must not apply out of order.
  const loadSeq = useRef(0);

  // Re-read the stores. History and the watch log come from the store's
  // write-through cache, so they keep the same array identity when unchanged
  // and the derived stats below don't recompute on every action.
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [w, h, l] = await Promise.all([getWatchingItems(), getWatchHistory(), getWatchLog()]);
      if (seq !== loadSeq.current) return;
      // Items are a fresh parse every time; keep the old reference if nothing changed.
      setItems(prev => (JSON.stringify(prev) === JSON.stringify(w) ? prev : w));
      setHistory(h);
      setWatchLog(l);
    } finally {
      // Never leave screens on a spinner if storage throws.
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  // Public refresh / first load: also runs the one-off caught-up repair.
  const loadData = useCallback(async () => {
    try { await repairCaughtUpProgress(); } catch { /* repair is best-effort */ }
    await reload();
  }, [reload]);

  useEffect(() => { loadData().catch(() => {}); }, [reload]);

  // Split by status
  const watchingItems = useMemo(
    () => items.filter(i => i.status === 'watching' || i.status === 'rewatching'), [items]);
  const awaitingItems = useMemo(() => items.filter(i => i.status === 'caught_up'), [items]);
  const onHoldItems = useMemo(() => items.filter(i => i.status === 'on_hold'), [items]);
  const droppedItems = useMemo(() => items.filter(i => i.status === 'dropped'), [items]);

  // Computed stats
  // Everything watched counts (not only completed): history + items with progress + watch log.
  const lifetimeStats = useMemo(() => computeLifetimeStats(history, items, watchLog), [history, items, watchLog]);
  const streak = useMemo(() => computeStreak(watchLog), [watchLog]);
  const library = useMemo(() => buildLibrary(history, items, watchLog), [history, items, watchLog]);
  const availableYears = useMemo(() => getAvailableYears(watchLog), [watchLog]);
  const directorStats = useMemo(() => computeDirectorStats(history, items), [history, items]);

  // Actions
  const startWatching = useCallback(async (item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>) => {
    const result = await addWatchingItem(item);
    await reload();
    return result;
  }, [reload]);

  const updateProgressCb = useCallback(async (tmdbId: number, mediaType: string, updates: WatchingPatch) => {
    await patchWatchingItem(tmdbId, mediaType, updates);
    await reload();
  }, [reload]);

  const markCompletedCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await markAsCompleted(tmdbId, mediaType);
    await reload();
  }, [reload]);

  const markCaughtUpCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await markWatchingCaughtUp(tmdbId, mediaType);
    await reload();
  }, [reload]);

  const putOnHoldCb = useCallback(async (tmdbId: number, mediaType: string, note: string) => {
    await putOnHold(tmdbId, mediaType, note);
    await reload();
  }, [reload]);

  const dropCb = useCallback(async (tmdbId: number, mediaType: string, reason: string, rating?: number | null) => {
    await dropWatchingItem(tmdbId, mediaType, reason, rating);
    await reload();
  }, [reload]);

  const resumeCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await resumeWatchingItem(tmdbId, mediaType);
    await reload();
  }, [reload]);

  const advanceCb = useCallback(async (tmdbId: number, mediaType: string) => {
    const ok = await advanceWatchingItem(tmdbId, mediaType);
    await reload();
    return ok;
  }, [reload]);

  const removeCb = useCallback(async (tmdbId: number, mediaType: string) => {
    await removeWatchingItem(tmdbId, mediaType);
    await reload();
  }, [reload]);

  const setWatchCountCb = useCallback(async (tmdbId: number, mediaType: string, count: number) => {
    await setWatchCount(tmdbId, mediaType, count);
    await reload();
  }, [reload]);

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
    return computePeriodStats(watchLog, year, month);
  }, [watchLog]);

  const getGenreStats = useCallback(() => {
    return computeGenreStats(history, items);
  }, [history, items]);

  const ctx = useMemo<WatchingContextType>(() => ({
    watchingItems,
    awaitingItems,
    onHoldItems,
    droppedItems,
    history,
    watchLog,
    library,
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
    setWatchCount: setWatchCountCb,
    isItemWatching,
    getItem: getItemCb,
    getHistoryEntries,
    refresh: loadData,
    getPeriodStats,
    getGenreStats,
  }), [
    watchingItems, awaitingItems, onHoldItems, droppedItems, history, watchLog, library, loading, lifetimeStats, streak,
    availableYears, directorStats,
    startWatching, updateProgressCb, markCompletedCb, markCaughtUpCb, putOnHoldCb, dropCb, resumeCb,
    advanceCb, removeCb, setWatchCountCb, isItemWatching, getItemCb, getHistoryEntries, loadData, getPeriodStats, getGenreStats,
  ]);

  return <WatchingContext.Provider value={ctx}>{children}</WatchingContext.Provider>;
}

export function useWatching(): WatchingContextType {
  const ctx = useContext(WatchingContext);
  if (!ctx) throw new Error('useWatching must be used within WatchingProvider');
  return ctx;
}
