import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WatchingItem, WatchHistoryEntry, WatchingStatus,
  ComputedStats, PeriodStats, GenreStats, ContentType,
  GENRE_COLORS,
} from '../types';

const WATCHING_KEY = '@runestone_watching';
const HISTORY_KEY = '@runestone_watch_history';

// ── Watching Items CRUD ───────────────────────────────

export async function getWatchingItems(): Promise<WatchingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCHING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveWatchingItems(items: WatchingItem[]) {
  await AsyncStorage.setItem(WATCHING_KEY, JSON.stringify(items));
}

export async function addWatchingItem(item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>): Promise<WatchingItem> {
  const list = await getWatchingItems();
  // Skip if already exists
  const existing = list.find(i => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType);
  if (existing) return existing;

  const now = new Date().toISOString();
  const entry: WatchingItem = {
    ...item,
    startedAt: now,
    lastWatched: now,
  };
  list.push(entry);
  await saveWatchingItems(list);
  return entry;
}

export async function updateWatchingProgress(
  tmdbId: number,
  mediaType: string,
  updates: Partial<Pick<WatchingItem, 'currentSeason' | 'currentEpisode' | 'episodesWatched' | 'movieCompleted' | 'status'>>,
): Promise<void> {
  const list = await getWatchingItems();
  const idx = list.findIndex(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
  if (idx === -1) return;

  list[idx] = {
    ...list[idx],
    ...updates,
    lastWatched: new Date().toISOString(),
  };
  await saveWatchingItems(list);
}

export async function updateWatchingStatus(
  tmdbId: number,
  mediaType: string,
  status: WatchingStatus,
): Promise<void> {
  const list = await getWatchingItems();
  const idx = list.findIndex(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
  if (idx === -1) return;

  list[idx].status = status;
  list[idx].lastWatched = new Date().toISOString();
  if (status === 'completed') {
    list[idx].completedAt = new Date().toISOString();
  }
  await saveWatchingItems(list);
}

export async function removeWatchingItem(tmdbId: number, mediaType: string): Promise<void> {
  const list = await getWatchingItems();
  const filtered = list.filter(i => !(i.tmdbId === tmdbId && i.mediaType === mediaType));
  await saveWatchingItems(filtered);
}

export async function getWatchingItem(tmdbId: number, mediaType: string): Promise<WatchingItem | null> {
  const list = await getWatchingItems();
  return list.find(i => i.tmdbId === tmdbId && i.mediaType === mediaType) || null;
}

export async function isWatching(tmdbId: number, mediaType: string): Promise<boolean> {
  const item = await getWatchingItem(tmdbId, mediaType);
  return item !== null;
}

// ── Watch History ─────────────────────────────────────

export async function getWatchHistory(): Promise<WatchHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveWatchHistory(entries: WatchHistoryEntry[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export async function addToWatchHistory(item: WatchingItem): Promise<void> {
  const history = await getWatchHistory();
  // Don't duplicate
  const exists = history.find(h => h.tmdbId === item.tmdbId && h.mediaType === item.mediaType);
  if (exists) return;

  const entry: WatchHistoryEntry = {
    id: `${item.mediaType}-${item.tmdbId}-${Date.now()}`,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    contentType: item.contentType,
    title: item.title,
    posterUrl: item.posterUrl,
    genres: item.genres,
    rating: item.rating,
    runtime: item.runtime,
    totalEpisodes: item.totalEpisodes,
    episodeRuntime: item.episodeRuntime,
    completedAt: new Date().toISOString(),
    year: item.year,
  };
  history.push(entry);
  await saveWatchHistory(history);
}

// ── Mark Complete (move from watching to history) ─────

export async function markAsCompleted(tmdbId: number, mediaType: string): Promise<void> {
  const list = await getWatchingItems();
  const item = list.find(i => i.tmdbId === tmdbId && i.mediaType === mediaType);
  if (!item) return;

  // Add to history
  await addToWatchHistory(item);

  // Remove from watching
  await removeWatchingItem(tmdbId, mediaType);
}

// ── Computed Stats ────────────────────────────────────

function estimateHours(entry: WatchHistoryEntry | WatchingItem): number {
  if (entry.mediaType === 'movie') {
    return (entry.runtime || 120) / 60; // default 2h for movies
  }
  const eps = ('totalEpisodes' in entry ? entry.totalEpisodes : 0) || 0;
  const epRuntime = ('episodeRuntime' in entry ? entry.episodeRuntime : null) || 45;
  return (eps * epRuntime) / 60;
}

export function computeLifetimeStats(history: WatchHistoryEntry[]): ComputedStats['lifetime'] {
  const stats = { movies: 0, series: 0, anime: 0, other: 0, totalHours: 0 };
  for (const entry of history) {
    switch (entry.contentType) {
      case 'movie': stats.movies++; break;
      case 'series': stats.series++; break;
      case 'anime': stats.anime++; break;
      case 'other': stats.other++; break;
    }
    stats.totalHours += estimateHours(entry);
  }
  stats.totalHours = Math.round(stats.totalHours);
  return stats;
}

export function computePeriodStats(
  history: WatchHistoryEntry[],
  year: number,
  month?: number | null,
): PeriodStats {
  const filtered = history.filter(entry => {
    const d = new Date(entry.completedAt);
    if (d.getFullYear() !== year) return false;
    if (month != null && d.getMonth() + 1 !== month) return false;
    return true;
  });

  const stats: PeriodStats = { movies: 0, series: 0, anime: 0, other: 0, hours: 0 };
  for (const entry of filtered) {
    switch (entry.contentType) {
      case 'movie': stats.movies++; break;
      case 'series': stats.series++; break;
      case 'anime': stats.anime++; break;
      case 'other': stats.other++; break;
    }
    stats.hours += estimateHours(entry);
  }
  stats.hours = Math.round(stats.hours);
  return stats;
}

export function computeGenreStats(history: WatchHistoryEntry[]): GenreStats[] {
  const counts: Record<string, number> = {};
  for (const entry of history) {
    for (const genre of entry.genres) {
      counts[genre] = (counts[genre] || 0) + 1;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return sorted.map(([name, count], idx) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100),
    color: GENRE_COLORS[idx % GENRE_COLORS.length],
  }));
}

export function computeStreak(history: WatchHistoryEntry[]): { current: number; longest: number } {
  if (history.length === 0) return { current: 0, longest: 0 };

  // Get unique dates sorted descending
  const dates = [...new Set(
    history.map(h => h.completedAt.split('T')[0])
  )].sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return { current: 0, longest: 0 };

  // Current streak
  let current = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (Math.abs(diff - 1) < 0.1) {
        current++;
      } else {
        break;
      }
    }
  }

  // Longest streak
  let longest = 1;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.abs(diff - 1) < 0.1) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 1;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

export function getAvailableYears(history: WatchHistoryEntry[]): number[] {
  const years = new Set(history.map(h => new Date(h.completedAt).getFullYear()));
  // Always include current year
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

export function getAvailableMonths(history: WatchHistoryEntry[], year: number): number[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const months = new Set(
    history
      .filter(h => new Date(h.completedAt).getFullYear() === year)
      .map(h => new Date(h.completedAt).getMonth() + 1)
  );

  // For current year, only show up to current month
  const maxMonth = year === currentYear ? currentMonth : 12;
  return Array.from(months).filter(m => m <= maxMonth).sort((a, b) => a - b);
}
