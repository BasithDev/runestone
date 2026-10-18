// ── Stats insights ────────────────────────────────────
// Pure helpers for the Stats screen: the "what I watched" library and
// activity series built from the watch log. No storage access here.
import {
  ContentType, WatchHistoryEntry, WatchingItem, WatchingStatus, WatchLogEntry, titleKey,
} from '../types';
import { getTotalEpisodes, localDateKey } from './watchingStore';

/** Chart order for content types — validated so no two neighbours clash for colour-blind users. */
export const CHART_TYPE_ORDER: ContentType[] = ['series', 'other', 'anime', 'movie'];

export interface LibraryEntry {
  key: string;                 // `${mediaType}-${tmdbId}`
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  contentType: ContentType;
  title: string;
  posterUrl: string | null;
  year: string;
  status: WatchingStatus;      // current status; 'completed' when only in history
  episodesWatched?: number;    // tv: current progress (or total when completed)
  totalEpisodes?: number;      // tv
  minutes: number;             // all logged watch time for this title
  lastWatchedAt: string;       // ISO — most recent activity
  timesCompleted: number;      // completions in history (rewatches > 1)
  genres: string[];
  rating: number;              // TMDb rating
}

/**
 * Everything the user has watched (any progress), one entry per title,
 * newest activity first. Items still in the watching list win for status.
 */
export function buildLibrary(
  history: WatchHistoryEntry[], items: WatchingItem[], log: WatchLogEntry[],
): LibraryEntry[] {
  const minutes = new Map<string, number>();
  const lastLog = new Map<string, string>();
  for (const e of log) {
    const k = titleKey(e.mediaType, e.tmdbId);
    minutes.set(k, (minutes.get(k) ?? 0) + e.minutes);
    if (e.episodes > 0 && (!lastLog.has(k) || e.at > lastLog.get(k)!)) lastLog.set(k, e.at);
  }

  const map = new Map<string, LibraryEntry>();

  for (const h of history) {
    const k = titleKey(h.mediaType, h.tmdbId);
    const prev = map.get(k);
    const last = prev && prev.lastWatchedAt > h.completedAt ? prev.lastWatchedAt : h.completedAt;
    map.set(k, {
      key: k, tmdbId: h.tmdbId, mediaType: h.mediaType, contentType: h.contentType,
      title: h.title, posterUrl: h.posterUrl, year: h.year,
      status: 'completed',
      episodesWatched: h.mediaType === 'tv' ? h.totalEpisodes : undefined,
      totalEpisodes: h.mediaType === 'tv' ? h.totalEpisodes : undefined,
      minutes: 0, lastWatchedAt: last,
      timesCompleted: (prev?.timesCompleted ?? 0) + 1,
      genres: h.genres, rating: h.rating,
    });
  }

  for (const i of items) {
    const progressed = i.mediaType === 'movie' ? !!i.movieCompleted : (i.episodesWatched ?? 0) > 0;
    const k = titleKey(i.mediaType, i.tmdbId);
    const prev = map.get(k);
    if (!progressed && !prev) continue;
    map.set(k, {
      key: k, tmdbId: i.tmdbId, mediaType: i.mediaType, contentType: i.contentType,
      title: i.title, posterUrl: i.posterUrl, year: i.year,
      status: i.status,
      episodesWatched: i.mediaType === 'tv' ? i.episodesWatched ?? 0 : undefined,
      totalEpisodes: i.mediaType === 'tv' ? getTotalEpisodes(i) || undefined : undefined,
      minutes: 0,
      lastWatchedAt: prev && prev.lastWatchedAt > i.lastWatched ? prev.lastWatchedAt : i.lastWatched,
      timesCompleted: prev?.timesCompleted ?? 0,
      genres: i.genres, rating: i.rating,
    });
  }

  for (const entry of map.values()) {
    entry.minutes = Math.max(0, minutes.get(entry.key) ?? 0);
    const l = lastLog.get(entry.key);
    if (l && l > entry.lastWatchedAt) entry.lastWatchedAt = l;
  }

  return Array.from(map.values()).sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt));
}

export interface DayActivity {
  date: string;     // YYYY-MM-DD (local)
  minutes: number;
  episodes: number;
}

/** Watch activity for each of the last `days` local days, oldest first (includes today). */
export function dailyActivity(log: WatchLogEntry[], days: number): DayActivity[] {
  const byDay = new Map<string, DayActivity>();
  for (const e of log) {
    const d = localDateKey(e.at);
    const cur = byDay.get(d) ?? { date: d, minutes: 0, episodes: 0 };
    cur.minutes += e.minutes;
    cur.episodes += e.episodes;
    byDay.set(d, cur);
  }
  const out: DayActivity[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const v = byDay.get(d);
    out.push({ date: d, minutes: Math.max(0, v?.minutes ?? 0), episodes: Math.max(0, v?.episodes ?? 0) });
  }
  return out;
}

export interface MonthActivity {
  month: number;    // 1-12
  minutes: number;
  titles: number;   // unique titles with episodes watched that month
}

/** Minutes and titles per month of `year`. */
export function monthlyActivity(log: WatchLogEntry[], year: number): MonthActivity[] {
  const out: MonthActivity[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, minutes: 0, titles: 0 }));
  const seen = Array.from({ length: 12 }, () => new Set<string>());
  for (const e of log) {
    const d = new Date(e.at);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth();
    out[m].minutes += e.minutes;
    if (e.episodes > 0) seen[m].add(titleKey(e.mediaType, e.tmdbId));
  }
  out.forEach((m, i) => { m.minutes = Math.max(0, m.minutes); m.titles = seen[i].size; });
  return out;
}

/** Most recent positive log entries (newest first) for an activity feed. */
export function recentActivity(log: WatchLogEntry[], limit = 15): WatchLogEntry[] {
  return log
    .filter(e => e.episodes > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Minutes → "3d 4h" / "5h 20m" / "45m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return mm ? `${h}h ${mm}m` : `${h}h`;
  return `${mm}m`;
}
