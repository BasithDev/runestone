import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  WatchlistItem,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistItem,
  WatchlistPriority,
  isInWatchlist as checkIsInWatchlist,
  getWatchlistStats,
} from '../services/watchlistStore';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  loading: boolean;
  stats: { total: number; movies: number; series: number; hours: number };
  isInWatchlist: (id: number, mediaType: string) => boolean;
  addItem: (item: Omit<WatchlistItem, 'added_at' | 'local_poster_uri'>) => Promise<void>;
  removeItem: (id: number, mediaType: string) => Promise<void>;
  updateItem: (id: number, mediaType: string, updates: { priority?: WatchlistPriority; why_added?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType>({
  watchlist: [],
  loading: true,
  stats: { total: 0, movies: 0, series: 0, hours: 0 },
  isInWatchlist: () => false,
  addItem: async () => {},
  removeItem: async () => {},
  updateItem: async () => {},
  refresh: async () => {},
});

export function useWatchlist() {
  return useContext(WatchlistContext);
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const items = await getWatchlist();
      // Sort: oldest added_at first
      items.sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime());
      setWatchlist(items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isInWatchlistSync = useCallback(
    (id: number, mediaType: string) => {
      return watchlist.some(i => i.id === id && i.media_type === mediaType);
    },
    [watchlist]
  );

  const addItem = useCallback(
    async (item: Omit<WatchlistItem, 'added_at' | 'local_poster_uri'>) => {
      await addToWatchlist(item);
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (id: number, mediaType: string) => {
      await removeFromWatchlist(id, mediaType);
      await refresh();
    },
    [refresh]
  );

  const updateItem = useCallback(
    async (id: number, mediaType: string, updates: { priority?: WatchlistPriority; why_added?: string }) => {
      await updateWatchlistItem(id, mediaType, updates);
      await refresh();
    },
    [refresh]
  );

  const stats = useMemo(() => getWatchlistStats(watchlist), [watchlist]);

  const value = useMemo(() => ({
    watchlist,
    loading,
    stats,
    isInWatchlist: isInWatchlistSync,
    addItem,
    removeItem,
    updateItem,
    refresh,
  }), [watchlist, loading, stats, isInWatchlistSync, addItem, removeItem, updateItem, refresh]);

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}
