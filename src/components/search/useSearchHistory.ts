import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@runestone_search_history';
const TITLES_KEY = '@runestone_recent_titles';
const MAX_QUERIES = 15;
const MAX_TITLES = 10;

export interface RecentTitle {
  id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
}

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(key: string, list: unknown[]) {
  AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
}

/** Recent search queries and recently opened titles, persisted in AsyncStorage. */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [recentTitles, setRecentTitles] = useState<RecentTitle[]>([]);
  const historyRef = useRef<string[]>([]);
  const titlesRef = useRef<RecentTitle[]>([]);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, t] = await Promise.all([readList<string>(HISTORY_KEY), readList<RecentTitle>(TITLES_KEY)]);
      if (!alive) return;
      if (!touched.current) {
        historyRef.current = h;
        titlesRef.current = t;
      } else {
        // Entries added before the read finished win over stored ones.
        const seen = new Set(historyRef.current.map(q => q.toLowerCase()));
        historyRef.current = [...historyRef.current, ...h.filter(q => !seen.has(q.toLowerCase()))].slice(0, MAX_QUERIES);
        const ids = new Set(titlesRef.current.map(x => `${x.media_type}-${x.id}`));
        titlesRef.current = [...titlesRef.current, ...t.filter(x => !ids.has(`${x.media_type}-${x.id}`))].slice(0, MAX_TITLES);
      }
      setHistory(historyRef.current);
      setRecentTitles(titlesRef.current);
    })();
    return () => { alive = false; };
  }, []);

  const commitHistory = useCallback((next: string[]) => {
    historyRef.current = next;
    setHistory(next);
    persist(HISTORY_KEY, next);
  }, []);

  const addQuery = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) return;
    touched.current = true;
    const lower = q.toLowerCase();
    let list = historyRef.current;
    // Typing "bat" -> "batm" -> "batman" should leave one entry, not three.
    if (list[0] && lower.startsWith(list[0].toLowerCase()) && lower !== list[0].toLowerCase()) list = list.slice(1);
    commitHistory([q, ...list.filter(h => h.toLowerCase() !== lower)].slice(0, MAX_QUERIES));
  }, [commitHistory]);

  const removeQuery = useCallback((q: string) => {
    touched.current = true;
    commitHistory(historyRef.current.filter(h => h !== q));
  }, [commitHistory]);

  const clearHistory = useCallback(() => {
    touched.current = true;
    commitHistory([]);
  }, [commitHistory]);

  const addTitle = useCallback((t: RecentTitle) => {
    touched.current = true;
    const next = [t, ...titlesRef.current.filter(x => !(x.id === t.id && x.media_type === t.media_type))].slice(0, MAX_TITLES);
    titlesRef.current = next;
    setRecentTitles(next);
    persist(TITLES_KEY, next);
  }, []);

  return { history, recentTitles, addQuery, removeQuery, clearHistory, addTitle };
}
