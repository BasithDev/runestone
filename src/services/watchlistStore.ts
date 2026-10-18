import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const STORAGE_KEY = '@runestone_watchlist';
const POSTER_DIR = `${FileSystem.documentDirectory}watchlist_posters/`;

// ── Types ─────────────────────────────────────────────
export type WatchlistPriority = 'high' | 'medium' | 'low';

export interface WatchlistItem {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  runtime: number | null;          // minutes for movie
  episode_count: number | null;    // total episodes for tv
  episode_runtime: number | null;  // avg episode runtime in minutes
  genres: string[];
  release_date: string;
  overview: string;
  added_at: string;                // ISO timestamp
  local_poster_uri: string | null; // local file path (native only)
  priority?: WatchlistPriority;    // missing on old items → treat as 'medium'
  why_added?: string;              // user's note on why it was saved
}

type UniqueKey = string; // `${media_type}-${id}`
function makeKey(id: number, media_type: string): UniqueKey {
  return `${media_type}-${id}`;
}

// ── Ensure poster directory exists (native only) ──────
async function ensurePosterDir() {
  if (Platform.OS === 'web') return;
  const info = await FileSystem.getInfoAsync(POSTER_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(POSTER_DIR, { intermediates: true });
  }
}

// ── Download poster to local storage (native only) ────
async function downloadPoster(posterPath: string, id: number, mediaType: string): Promise<string | null> {
  if (Platform.OS === 'web' || !posterPath) return null;

  try {
    await ensurePosterDir();
    const filename = `${mediaType}_${id}.jpg`;
    const localUri = `${POSTER_DIR}${filename}`;
    const remoteUri = `https://image.tmdb.org/t/p/w342${posterPath}`;

    const result = await FileSystem.downloadAsync(remoteUri, localUri);
    return result.uri;
  } catch {
    return null;
  }
}

// ── Delete local poster file ──────────────────────────
async function deletePoster(localUri: string | null) {
  if (!localUri || Platform.OS === 'web') return;
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) await FileSystem.deleteAsync(localUri);
  } catch {
    // silently fail
  }
}

// ── Core CRUD ─────────────────────────────────────────

export async function getWatchlist(): Promise<WatchlistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as WatchlistItem[] : [];
  } catch {
    return [];
  }
}

// Read-modify-write goes through one queue so rapid taps (or an add racing a
// poster download) can't read stale data and overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function saveWatchlist(items: WatchlistItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function addToWatchlist(item: Omit<WatchlistItem, 'added_at' | 'local_poster_uri'>): Promise<WatchlistItem> {
  const key = makeKey(item.id, item.media_type);
  const find = (list: WatchlistItem[]) => list.find(i => makeKey(i.id, i.media_type) === key);

  // Skip if already exists
  const already = find(await getWatchlist());
  if (already) return already;

  // Download poster locally (native only) outside the queue so a slow network doesn't block other writes.
  const localUri = await downloadPoster(item.poster_path || '', item.id, item.media_type);

  return serialize(async () => {
    const list = await getWatchlist();
    const dupe = find(list); // added while the poster was downloading
    if (dupe) return dupe;
    const entry: WatchlistItem = {
      ...item,
      added_at: new Date().toISOString(),
      local_poster_uri: localUri,
    };
    await saveWatchlist([...list, entry]);
    return entry;
  });
}

export function removeFromWatchlist(id: number, mediaType: string): Promise<void> {
  return serialize(async () => {
    const list = await getWatchlist();
    const key = makeKey(id, mediaType);
    const item = list.find(i => makeKey(i.id, i.media_type) === key);
    if (!item) return;
    await saveWatchlist(list.filter(i => makeKey(i.id, i.media_type) !== key));
    // Delete the file after the list is saved, so a failed save never leaves an item with a missing poster.
    await deletePoster(item.local_poster_uri);
  });
}

export async function isInWatchlist(id: number, mediaType: string): Promise<boolean> {
  const list = await getWatchlist();
  return list.some(i => makeKey(i.id, i.media_type) === makeKey(id, mediaType));
}

export function getEstimatedHours(items: WatchlistItem[]): number {
  let totalMinutes = 0;

  for (const item of items) {
    if (item.media_type === 'movie') {
      totalMinutes += item.runtime || 0;
    } else if (item.media_type === 'tv') {
      if (item.episode_runtime && item.episode_count) {
        totalMinutes += item.episode_runtime * item.episode_count;
      } else if (item.episode_count) {
        // Fallback: assume ~45 min per episode when runtime is unknown
        totalMinutes += 45 * item.episode_count;
      } else if (item.runtime) {
        totalMinutes += item.runtime;
      }
    }
  }

  return Math.round(totalMinutes / 60);
}

export function getWatchlistStats(items: WatchlistItem[]) {
  const total = items.length;
  const movies = items.filter(i => i.media_type === 'movie').length;
  const series = items.filter(i => i.media_type === 'tv').length;
  const hours = getEstimatedHours(items);
  return { total, movies, series, hours };
}

export function updateWatchlistItem(
  id: number,
  mediaType: string,
  updates: { priority?: WatchlistPriority; why_added?: string },
): Promise<void> {
  return serialize(async () => {
    const list = await getWatchlist();
    const key = makeKey(id, mediaType);
    const idx = list.findIndex(i => makeKey(i.id, i.media_type) === key);
    if (idx === -1) return;
    const next = { ...list[idx] };
    if (updates.priority !== undefined) next.priority = updates.priority;
    if (updates.why_added !== undefined) {
      const note = updates.why_added.trim();
      if (note) next.why_added = note; else delete next.why_added;
    }
    list[idx] = next;
    await saveWatchlist(list);
  });
}
