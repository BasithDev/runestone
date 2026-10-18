import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WatchingItem, WatchHistoryEntry, WatchingStatus, WatchLogEntry, ContentType,
  ComputedStats, PeriodStats, GenreStats, SeasonBreakdown,
  GENRE_COLORS,
} from '../types';

const WATCHING_KEY = '@runestone_watching';
const HISTORY_KEY = '@runestone_watch_history';
export const WATCH_LOG_KEY = '@runestone_watch_log';

const DEFAULT_EPISODE_MINUTES = 45;
const DEFAULT_MOVIE_MINUTES = 120;

/** Fields that may be patched on an existing watching item. */
export type WatchingPatch = Partial<Omit<WatchingItem, 'id' | 'tmdbId' | 'mediaType' | 'startedAt'>>;

export interface DirectorStat {
  name: string;
  count: number;     // unique completed titles
  titles: string[];  // titles (all; UI may truncate)
}

// ── Write queue ───────────────────────────────────────
// Every read-modify-write runs through this module-level promise chain so
// rapid taps can't read stale data and overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  // The watch log must exist (backfilled from the data *before* this change)
  // before anything is modified, or the first change would be counted twice.
  const run = writeQueue.then(async () => { await readLog(); return fn(); });
  writeQueue = run.catch(() => undefined);
  return run;
}

// ── Low-level storage (unserialized; call inside serialize) ──

async function readItems(): Promise<WatchingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCHING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeItems(items: WatchingItem[]) {
  await AsyncStorage.setItem(WATCHING_KEY, JSON.stringify(items));
}

async function readHistory(): Promise<WatchHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeHistory(entries: WatchHistoryEntry[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

// ── Watch log (low-level) ─────────────────────────────

const episodeMinutes = (i: { episodeRuntime?: number | null }) => i.episodeRuntime || DEFAULT_EPISODE_MINUTES;
const movieMinutes = (i: { runtime?: number | null }) => i.runtime || DEFAULT_MOVIE_MINUTES;

function logEntry(
  item: { tmdbId: number; mediaType: 'movie' | 'tv'; contentType: ContentType; title: string },
  episodes: number, minutes: number, at = new Date().toISOString(),
): WatchLogEntry {
  return {
    id: `${item.mediaType}-${item.tmdbId}-${Date.parse(at)}-${Math.random().toString(36).slice(2, 7)}`,
    tmdbId: item.tmdbId, mediaType: item.mediaType, contentType: item.contentType, title: item.title,
    at, episodes, minutes: Math.round(minutes),
  };
}

/**
 * Builds the first log from data saved before the log existed:
 * every completion in history, plus progress on items still being watched.
 */
function backfillLog(items: WatchingItem[], history: WatchHistoryEntry[]): WatchLogEntry[] {
  const log: WatchLogEntry[] = [];
  for (const h of history) {
    if (h.mediaType === 'movie') {
      log.push(logEntry(h, 1, movieMinutes(h), h.completedAt));
    } else {
      const eps = h.totalEpisodes || 0;
      if (eps > 0) log.push(logEntry(h, eps, eps * episodeMinutes(h), h.completedAt));
    }
  }
  for (const i of items) {
    const at = i.lastWatched || i.startedAt;
    if (i.mediaType === 'movie') {
      if (i.movieCompleted) log.push(logEntry(i, 1, movieMinutes(i), at));
    } else if ((i.episodesWatched ?? 0) > 0) {
      log.push(logEntry(i, i.episodesWatched!, i.episodesWatched! * episodeMinutes(i), at));
    }
  }
  return log;
}

async function readLog(): Promise<WatchLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_LOG_KEY);
    if (raw != null) return JSON.parse(raw);
  } catch { /* fall through to rebuild */ }
  const log = backfillLog(await readItems(), await readHistory());
  await AsyncStorage.setItem(WATCH_LOG_KEY, JSON.stringify(log));
  return log;
}

async function appendLog(entries: WatchLogEntry[]) {
  if (entries.length === 0) return;
  const log = await readLog();
  log.push(...entries);
  await AsyncStorage.setItem(WATCH_LOG_KEY, JSON.stringify(log));
}

/** Log entries for the change from `before` to `after` (episodes / movie completion). */
function progressLog(before: WatchingItem, after: WatchingItem, at?: string): WatchLogEntry[] {
  if (after.mediaType === 'movie') {
    const was = !!before.movieCompleted, now = !!after.movieCompleted;
    if (was === now) return [];
    const sign = now ? 1 : -1;
    return [logEntry(after, sign, sign * movieMinutes(after), at)];
  }
  const delta = (after.episodesWatched ?? 0) - (before.episodesWatched ?? 0);
  if (delta === 0) return [];
  return [logEntry(after, delta, delta * episodeMinutes(after), at)];
}

/** Caught up = every aired episode watched; position moves to the last aired episode. */
function caughtUpState(item: WatchingItem): WatchingItem {
  const total = getTotalEpisodes(item);
  if (item.mediaType === 'movie' || total <= 0) return { ...item, status: 'caught_up' };
  const watched = Math.max(item.episodesWatched ?? 0, total);
  const pos = positionFromWatched(item.seasonEpisodes ?? [], watched);
  return { ...item, status: 'caught_up', episodesWatched: watched, currentSeason: pos.season, currentEpisode: pos.episode };
}

const same = (i: { tmdbId: number; mediaType: string }, tmdbId: number, mediaType: string) =>
  i.tmdbId === tmdbId && i.mediaType === mediaType;

// ── Local date helpers ────────────────────────────────

/** YYYY-MM-DD in the device's local time zone. */
export function localDateKey(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(a: string, b: string): number {
  return Math.round((keyToDate(a).getTime() - keyToDate(b).getTime()) / 86400000);
}

// ── Progress math (shared by every screen) ────────────

export interface Progress {
  watched: number;
  total: number;
  percent: number;
}

/** Aired seasons (those with at least one episode), ordered. */
export function airedSeasons(item: Pick<WatchingItem, 'seasonEpisodes'>): SeasonBreakdown[] {
  return (item.seasonEpisodes ?? [])
    .filter(s => s.episodes > 0)
    .slice()
    .sort((a, b) => a.season - b.season);
}

export function getTotalEpisodes(item: WatchingItem): number {
  const sum = (item.seasonEpisodes ?? []).reduce((a, s) => a + s.episodes, 0);
  return sum > 0 ? sum : item.totalEpisodes ?? 0;
}

export function getProgress(item: WatchingItem): Progress {
  if (item.mediaType === 'movie') {
    const done = item.movieCompleted ? 1 : 0;
    return { watched: done, total: 1, percent: done * 100 };
  }
  const total = getTotalEpisodes(item);
  const watched = Math.max(0, Math.min(item.episodesWatched ?? 0, total || Infinity));
  const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  return { watched, total, percent };
}

/** True when every aired episode is watched. */
export function isAllWatched(item: WatchingItem): boolean {
  const { watched, total } = getProgress(item);
  return total > 0 && watched >= total;
}

/** Number of episodes watched when the position is season/episode. */
export function watchedAtPosition(seasons: SeasonBreakdown[], season: number, episode: number): number {
  const aired = seasons.filter(s => s.episodes > 0);
  if (aired.length === 0) return Math.max(0, episode);
  let count = 0;
  for (const s of aired) {
    if (s.season < season) count += s.episodes;
    else if (s.season === season) { count += Math.max(0, Math.min(episode, s.episodes)); break; }
  }
  return count;
}

/** Position (season/episode) for a watched count. 0 watched = first episode. */
export function positionFromWatched(
  seasons: SeasonBreakdown[], watched: number,
): { season: number; episode: number } {
  const aired = seasons.filter(s => s.episodes > 0).sort((a, b) => a.season - b.season);
  if (aired.length === 0) return { season: 1, episode: Math.max(1, watched) };
  if (watched <= 0) return { season: aired[0].season, episode: 1 };
  let left = watched;
  for (const s of aired) {
    if (left <= s.episodes) return { season: s.season, episode: left };
    left -= s.episodes;
  }
  const last = aired[aired.length - 1];
  return { season: last.season, episode: last.episodes };
}

/** Episodes in aired seasons before `season`. */
export function seasonOffset(seasons: SeasonBreakdown[], season: number): number {
  return seasons
    .filter(s => s.episodes > 0 && s.season < season)
    .reduce((a, s) => a + s.episodes, 0);
}

/** New watched count after marking season N watched (never moves backwards). */
export function markSeasonWatchedCount(seasons: SeasonBreakdown[], watched: number, season: number): number {
  const s = seasons.find(x => x.season === season);
  if (!s || s.episodes <= 0) return watched;
  return Math.max(watched, seasonOffset(seasons, season) + s.episodes);
}

/** New watched count after unmarking season N (moves to end of N-1 when current >= N). */
export function unmarkSeasonWatchedCount(seasons: SeasonBreakdown[], watched: number, season: number): number {
  const offset = seasonOffset(seasons, season);
  return watched > offset ? offset : watched;
}

/**
 * Next position for a series/anime. Rolls over to the next season's first
 * episode and stops at the final aired episode (returns null there).
 */
export function advanceEpisode(item: WatchingItem): WatchingPatch | null {
  if (item.mediaType === 'movie') return null;
  const seasons = item.seasonEpisodes ?? [];
  const total = getTotalEpisodes(item);
  const watched = item.episodesWatched ?? 0;
  if (total > 0 && watched >= total) return null;
  const next = watched + 1;
  if (airedSeasons(item).length === 0) {
    const ep = watched === 0 ? item.currentEpisode ?? 1 : (item.currentEpisode ?? 1) + 1;
    return { currentSeason: item.currentSeason ?? 1, currentEpisode: ep, episodesWatched: next };
  }
  const pos = positionFromWatched(seasons, next);
  return { currentSeason: pos.season, currentEpisode: pos.episode, episodesWatched: next };
}

export function isEndedStatus(showStatus?: string): boolean {
  return showStatus === 'Ended' || showStatus === 'Canceled';
}

// ── Watching Items CRUD ───────────────────────────────

export async function getWatchingItems(): Promise<WatchingItem[]> {
  return readItems();
}

export function addWatchingItem(item: Omit<WatchingItem, 'startedAt' | 'lastWatched'>): Promise<WatchingItem> {
  return serialize(async () => {
    const list = await readItems();
    const existing = list.find(i => same(i, item.tmdbId, item.mediaType));
    if (existing) return existing;

    const priorWatches = (await readHistory()).filter(h => same(h, item.tmdbId, item.mediaType)).length;
    const now = new Date().toISOString();
    const entry: WatchingItem = {
      ...item,
      startedAt: now,
      lastWatched: now,
      ...(priorWatches > 0 ? { status: 'rewatching' as WatchingStatus, rewatchCount: priorWatches } : {}),
    };
    list.push(entry);
    await writeItems(list);
    await appendLog(progressLog({ ...entry, episodesWatched: 0, movieCompleted: false }, entry));
    return entry;
  });
}

export function patchWatchingItem(tmdbId: number, mediaType: string, patch: WatchingPatch): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    const idx = list.findIndex(i => same(i, tmdbId, mediaType));
    if (idx === -1) return;
    const before = list[idx];
    list[idx] = { ...before, ...patch, lastWatched: new Date().toISOString() };
    await writeItems(list);
    await appendLog(progressLog(before, list[idx]));
  });
}

export const updateWatchingProgress = patchWatchingItem;

/** Mark caught up: records every aired episode as watched (and logs them). */
export function markWatchingCaughtUp(tmdbId: number, mediaType: string): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    const idx = list.findIndex(i => same(i, tmdbId, mediaType));
    if (idx === -1) return;
    const before = list[idx];
    list[idx] = { ...caughtUpState(before), lastWatched: new Date().toISOString() };
    await writeItems(list);
    await appendLog(progressLog(before, list[idx]));
  });
}

/**
 * One-off repair for shows marked caught up before progress was recorded
 * with it. Logged at their last update so today's streak isn't inflated.
 * Idempotent: does nothing once progress matches.
 */
export function repairCaughtUpProgress(): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    const fixes: WatchLogEntry[] = [];
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.status !== 'caught_up' || item.mediaType === 'movie') continue;
      const next = caughtUpState(item);
      if ((next.episodesWatched ?? 0) === (item.episodesWatched ?? 0)) continue;
      list[i] = next;
      fixes.push(...progressLog(item, next, item.lastWatched));
      changed = true;
    }
    if (!changed) return;
    await writeItems(list);
    await appendLog(fixes);
  });
}

export function updateWatchingStatus(tmdbId: number, mediaType: string, status: WatchingStatus): Promise<void> {
  return patchWatchingItem(tmdbId, mediaType, {
    status,
    ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
  });
}

/** Put on hold; the note is required. */
export function putOnHold(tmdbId: number, mediaType: string, note: string): Promise<void> {
  return patchWatchingItem(tmdbId, mediaType, {
    status: 'on_hold',
    holdNote: note.trim(),
    dropReason: undefined,
    dropRating: undefined,
  });
}

/** Drop; the reason is required, rating (0-10, 0.5 steps) optional. */
export function dropWatchingItem(
  tmdbId: number, mediaType: string, reason: string, rating?: number | null,
): Promise<void> {
  return patchWatchingItem(tmdbId, mediaType, {
    status: 'dropped',
    dropReason: reason.trim(),
    dropRating: rating == null ? undefined : Math.max(0, Math.min(10, Math.round(rating * 2) / 2)),
    holdNote: undefined,
  });
}

/** Resume an on-hold / dropped item. */
export function resumeWatchingItem(tmdbId: number, mediaType: string): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    const idx = list.findIndex(i => same(i, tmdbId, mediaType));
    if (idx === -1) return;
    const cur = list[idx];
    list[idx] = {
      ...cur,
      status: (cur.rewatchCount ?? 0) > 0 ? 'rewatching' : 'watching',
      holdNote: undefined,
      dropReason: undefined,
      dropRating: undefined,
      lastWatched: new Date().toISOString(),
    };
    await writeItems(list);
  });
}

/** Quick +1 episode. Resolves false when already at the final episode. */
export function advanceWatchingItem(tmdbId: number, mediaType: string): Promise<boolean> {
  return serialize(async () => {
    const list = await readItems();
    const idx = list.findIndex(i => same(i, tmdbId, mediaType));
    if (idx === -1) return false;
    const patch = advanceEpisode(list[idx]);
    if (!patch) return false;
    const before = list[idx];
    list[idx] = { ...before, ...patch, lastWatched: new Date().toISOString() };
    await writeItems(list);
    await appendLog(progressLog(before, list[idx]));
    return true;
  });
}

export function removeWatchingItem(tmdbId: number, mediaType: string): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    await writeItems(list.filter(i => !same(i, tmdbId, mediaType)));
  });
}

export async function getWatchingItem(tmdbId: number, mediaType: string): Promise<WatchingItem | null> {
  const list = await readItems();
  return list.find(i => same(i, tmdbId, mediaType)) || null;
}

export async function isWatching(tmdbId: number, mediaType: string): Promise<boolean> {
  return (await getWatchingItem(tmdbId, mediaType)) !== null;
}

// ── Watch History ─────────────────────────────────────

export async function getWatchHistory(): Promise<WatchHistoryEntry[]> {
  return readHistory();
}

function buildHistoryEntry(item: WatchingItem, isRewatch: boolean): WatchHistoryEntry {
  return {
    id: `${item.mediaType}-${item.tmdbId}-${Date.now()}`,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    contentType: item.contentType,
    title: item.title,
    posterUrl: item.posterUrl,
    genres: item.genres,
    rating: item.rating,
    runtime: item.runtime,
    totalEpisodes: item.mediaType === 'movie' ? item.totalEpisodes : getTotalEpisodes(item) || item.totalEpisodes,
    episodeRuntime: item.episodeRuntime,
    completedAt: new Date().toISOString(),
    year: item.year,
    directors: item.directors,
    ...(isRewatch ? { isRewatch: true } : {}),
  };
}

/** Always logs a completion; flags it as a rewatch when a prior entry exists. */
export function addToWatchHistory(item: WatchingItem): Promise<void> {
  return serialize(async () => {
    const history = await readHistory();
    const prior = history.some(h => same(h, item.tmdbId, item.mediaType));
    history.push(buildHistoryEntry(item, prior));
    await writeHistory(history);
  });
}

// ── Mark Complete (move from watching to history) ─────

export function markAsCompleted(tmdbId: number, mediaType: string): Promise<void> {
  return serialize(async () => {
    const list = await readItems();
    const item = list.find(i => same(i, tmdbId, mediaType));
    if (!item) return;

    const history = await readHistory();
    const prior = history.some(h => same(h, tmdbId, mediaType));
    history.push(buildHistoryEntry(item, prior));
    await writeHistory(history);
    await writeItems(list.filter(i => !same(i, tmdbId, mediaType)));

    // Completing counts whatever wasn't logged yet as watched.
    const finished: WatchingItem = item.mediaType === 'movie'
      ? { ...item, movieCompleted: true }
      : { ...item, episodesWatched: Math.max(item.episodesWatched ?? 0, getTotalEpisodes(item)) };
    await appendLog(progressLog(item, finished));
  });
}

// ── Watch log access ──────────────────────────────────

/** The full watch log (built from existing data the first time). */
export function getWatchLog(): Promise<WatchLogEntry[]> {
  return serialize(readLog);
}

// ── Computed Stats ────────────────────────────────────
// Stats cover everything watched, not only completed titles:
// history (completed) + items with progress (watching, caught up, on hold,
// dropped, rewatching). Time-based stats come from the watch log.

const titleId = (h: { mediaType: string; tmdbId: number }) => `${h.mediaType}-${h.tmdbId}`;

interface WatchedTitle {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  contentType: ContentType;
  title: string;
  genres: string[];
  directors?: string[];
}

function hasProgress(i: WatchingItem): boolean {
  return i.mediaType === 'movie' ? !!i.movieCompleted : (i.episodesWatched ?? 0) > 0;
}

/** Every title the user has watched at least part of, once each. */
export function watchedTitles(history: WatchHistoryEntry[], items: WatchingItem[]): WatchedTitle[] {
  const map = new Map<string, WatchedTitle>();
  for (const h of history) map.set(titleId(h), h);
  for (const i of items) if (hasProgress(i)) map.set(titleId(i), i);
  return Array.from(map.values());
}

function bump(stats: { movies: number; series: number; anime: number; other: number }, type: string) {
  switch (type) {
    case 'movie': stats.movies++; break;
    case 'series': stats.series++; break;
    case 'anime': stats.anime++; break;
    case 'other': stats.other++; break;
  }
}

const toHours = (minutes: number) => Math.max(0, Math.round(minutes / 60));

/** Counts are unique watched titles; hours are all logged watch time (rewatches count). */
export function computeLifetimeStats(
  history: WatchHistoryEntry[], items: WatchingItem[], log: WatchLogEntry[],
): ComputedStats['lifetime'] {
  const stats = { movies: 0, series: 0, anime: 0, other: 0, totalHours: 0 };
  for (const t of watchedTitles(history, items)) bump(stats, t.contentType);
  stats.totalHours = toHours(log.reduce((a, e) => a + e.minutes, 0));
  return stats;
}

function inPeriod(iso: string, year: number, month?: number | null): boolean {
  const d = new Date(iso);
  if (d.getFullYear() !== year) return false;
  return month == null || d.getMonth() + 1 === month;
}

/** Titles watched (any episodes) and hours watched in the period. */
export function computePeriodStats(log: WatchLogEntry[], year: number, month?: number | null): PeriodStats {
  const entries = log.filter(e => inPeriod(e.at, year, month));
  const stats: PeriodStats = { movies: 0, series: 0, anime: 0, other: 0, hours: 0 };
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.episodes <= 0 || seen.has(titleId(e))) continue;
    seen.add(titleId(e));
    bump(stats, e.contentType);
  }
  stats.hours = toHours(entries.reduce((a, e) => a + e.minutes, 0));
  return stats;
}

export function computeGenreStats(history: WatchHistoryEntry[], items: WatchingItem[]): GenreStats[] {
  const counts: Record<string, number> = {};
  for (const t of watchedTitles(history, items)) {
    for (const genre of t.genres) counts[genre] = (counts[genre] || 0) + 1;
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

/** Top directors/creators by unique watched titles. */
export function computeDirectorStats(
  history: WatchHistoryEntry[], items: WatchingItem[], limit = 10,
): DirectorStat[] {
  const map = new Map<string, DirectorStat>();
  for (const t of watchedTitles(history, items)) {
    for (const name of new Set(t.directors ?? [])) {
      const stat = map.get(name) ?? { name, count: 0, titles: [] };
      stat.count++;
      stat.titles.push(t.title);
      map.set(name, stat);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Streaks are consecutive local days with anything watched. */
export function computeStreak(log: WatchLogEntry[]): { current: number; longest: number } {
  const dates = [...new Set(log.filter(e => e.episodes > 0).map(e => localDateKey(e.at)))]
    .sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return { current: 0, longest: 0 };

  let current = 0;
  const now = new Date();
  const today = localDateKey(now);
  const yesterday = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      if (dayDiff(dates[i - 1], dates[i]) === 1) current++;
      else break;
    }
  }

  let longest = 1;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dayDiff(dates[i - 1], dates[i]) === 1) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 1;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

export function getAvailableYears(log: WatchLogEntry[]): number[] {
  const years = new Set(log.map(e => new Date(e.at).getFullYear()));
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}
