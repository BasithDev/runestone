import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { UpcomingItem, titleKey } from '../types';
import {
  getUpcomingItems,
  addUpcomingItem,
  removeUpcomingItem,
  subscribeUpcoming,
  resolveMovieReleaseDate,
} from '../services/upcomingStore';

export type NewUpcoming = {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  /** Primary TMDb date; used when no India theatrical date is found (movies) or as-is (tv). */
  releaseDate: string | null;
};

interface UpcomingContextType {
  items: UpcomingItem[];
  loading: boolean;
  add: (item: NewUpcoming) => Promise<void>;
  remove: (mediaType: string, tmdbId: number) => Promise<void>;
  isSaved: (mediaType: string, tmdbId: number) => boolean;
  refresh: () => Promise<void>;
}

const UpcomingContext = createContext<UpcomingContextType>({
  items: [],
  loading: true,
  add: async () => {},
  remove: async () => {},
  isSaved: () => false,
  refresh: async () => {},
});

export function useUpcoming() {
  return useContext(UpcomingContext);
}

export function UpcomingProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setItems(await getUpcomingItems());
    } catch { /* keep the current list */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return subscribeUpcoming(next => setItems([...next]));
  }, [refresh]);

  const add = useCallback(async (item: NewUpcoming) => {
    const releaseDate = item.mediaType === 'movie'
      ? await resolveMovieReleaseDate(item.tmdbId, item.releaseDate)
      : (item.releaseDate ? item.releaseDate.slice(0, 10) : null);
    await addUpcomingItem({ ...item, releaseDate });
  }, []);

  const remove = useCallback(async (mediaType: string, tmdbId: number) => {
    await removeUpcomingItem(mediaType, tmdbId);
  }, []);

  const keys = useMemo(() => new Set(items.map(i => titleKey(i.mediaType, i.tmdbId))), [items]);
  const isSaved = useCallback(
    (mediaType: string, tmdbId: number) => keys.has(titleKey(mediaType, tmdbId)),
    [keys],
  );

  const value = useMemo(
    () => ({ items, loading, add, remove, isSaved, refresh }),
    [items, loading, add, remove, isSaved, refresh],
  );

  return <UpcomingContext.Provider value={value}>{children}</UpcomingContext.Provider>;
}
