import AsyncStorage from '@react-native-async-storage/async-storage';
import { UpcomingItem, titleKey } from '../types';

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
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveUpcomingItems(items: UpcomingItem[]) {
  await AsyncStorage.setItem(UPCOMING_KEY, JSON.stringify(items));
  listeners.forEach(l => l(items));
}

export async function addUpcomingItem(item: Omit<UpcomingItem, 'addedAt'>): Promise<UpcomingItem> {
  const list = await getUpcomingItems();
  const key = titleKey(item.mediaType, item.tmdbId);
  const existing = list.find(i => titleKey(i.mediaType, i.tmdbId) === key);
  if (existing) return existing;

  const entry: UpcomingItem = { ...item, addedAt: new Date().toISOString() };
  list.push(entry);
  await saveUpcomingItems(list);
  return entry;
}

export async function updateUpcomingItem(
  mediaType: string, tmdbId: number,
  updates: Partial<Pick<UpcomingItem, 'releaseDate' | 'title' | 'posterPath'>>,
): Promise<void> {
  const list = await getUpcomingItems();
  const idx = list.findIndex(i => i.mediaType === mediaType && i.tmdbId === tmdbId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  await saveUpcomingItems(list);
}

export async function removeUpcomingItem(mediaType: string, tmdbId: number): Promise<void> {
  const list = await getUpcomingItems();
  await saveUpcomingItems(list.filter(i => !(i.mediaType === mediaType && i.tmdbId === tmdbId)));
}
