import AsyncStorage from '@react-native-async-storage/async-storage';
import { UpcomingItem, titleKey } from '../types';
import { getMovieReleaseDates, RELEASE_TYPE } from './tmdb';

const UPCOMING_KEY = '@runestone_upcoming';

// ── Change listeners ──────────────────────────────────
// Lets other services (e.g. release reminders) react to list changes
// without the UI having to call them.
type Listener = (items: UpcomingItem[]) => void;
const listeners = new Set<Listener>();

export function subscribeUpcoming(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ── CRUD ──────────────────────────────────────────────

export async function getUpcomingItems(): Promise<UpcomingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(UPCOMING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// Serialised read-modify-write so quick add/remove taps can't lose updates.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function saveUpcomingItems(items: UpcomingItem[]) {
  await AsyncStorage.setItem(UPCOMING_KEY, JSON.stringify(items));
  listeners.forEach(l => l(items));
}

export function addUpcomingItem(item: Omit<UpcomingItem, 'addedAt'>): Promise<UpcomingItem> {
  return serialize(async () => {
    const list = await getUpcomingItems();
    const key = titleKey(item.mediaType, item.tmdbId);
    const existing = list.find(i => titleKey(i.mediaType, i.tmdbId) === key);
    if (existing) return existing;

    const entry: UpcomingItem = { ...item, addedAt: new Date().toISOString() };
    await saveUpcomingItems([...list, entry]);
    return entry;
  });
}

export function updateUpcomingItem(
  mediaType: string, tmdbId: number,
  updates: Partial<Pick<UpcomingItem, 'releaseDate' | 'title' | 'posterPath'>>,
): Promise<void> {
  return serialize(async () => {
    const list = await getUpcomingItems();
    const idx = list.findIndex(i => i.mediaType === mediaType && i.tmdbId === tmdbId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...updates };
    await saveUpcomingItems(list);
  });
}

export function removeUpcomingItem(mediaType: string, tmdbId: number): Promise<void> {
  return serialize(async () => {
    const list = await getUpcomingItems();
    await saveUpcomingItems(list.filter(i => !(i.mediaType === mediaType && i.tmdbId === tmdbId)));
  });
}

// ── India release date resolution ─────────────────────
/**
 * Earliest India Theatrical (type 3, else 2, else 1) date as YYYY-MM-DD;
 * falls back to the movie's primary release date.
 */
export async function resolveMovieReleaseDate(
  movieId: number, fallback: string | null | undefined,
): Promise<string | null> {
  try {
    const releases = await getMovieReleaseDates(movieId);
    for (const type of [RELEASE_TYPE.THEATRICAL, RELEASE_TYPE.THEATRICAL_LIMITED, RELEASE_TYPE.PREMIERE]) {
      const dates = releases
        .filter(r => r.type === type && r.release_date)
        .map(r => r.release_date.slice(0, 10))
        .sort();
      if (dates.length) return dates[0];
    }
  } catch { /* fall through to fallback */ }
  return fallback ? fallback.slice(0, 10) : null;
}
