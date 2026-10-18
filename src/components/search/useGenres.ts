import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tmdbGet } from '../../services/tmdb';

export interface GenreOption { id: number; name: string; movie: boolean; tv: boolean }

const CACHE_KEY = '@runestone_genres_cache';
const TTL = 7 * 24 * 3600 * 1000;
let memory: GenreOption[] | null = null;
let inflight: Promise<GenreOption[]> | null = null;

async function loadGenres(): Promise<GenreOption[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c?.at && Date.now() - c.at < TTL && Array.isArray(c.list) && c.list.length) {
        memory = c.list;
        return c.list;
      }
    }
  } catch { /* ignore cache errors */ }
  if (!inflight) {
    inflight = (async () => {
      const [m, t] = await Promise.all([
        tmdbGet<{ genres: { id: number; name: string }[] }>('genre/movie/list'),
        tmdbGet<{ genres: { id: number; name: string }[] }>('genre/tv/list'),
      ]);
      const map = new Map<number, GenreOption>();
      for (const g of m.genres) map.set(g.id, { id: g.id, name: g.name, movie: true, tv: false });
      for (const g of t.genres) {
        const e = map.get(g.id);
        if (e) e.tv = true; else map.set(g.id, { id: g.id, name: g.name, movie: false, tv: true });
      }
      const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      memory = list;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list })).catch(() => {});
      return list;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

/** Movie + TV genres merged by id, cached in memory and AsyncStorage. */
export function useGenres() {
  const [genres, setGenres] = useState<GenreOption[]>(memory ?? []);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    loadGenres()
      .then(setGenres)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!memory) load(); }, [load]);

  return { genres, loading, error, reload: load };
}
