import AsyncStorage from '@react-native-async-storage/async-storage';
import { OttInfo } from '../types';

const OTT_KEY = '@runestone_ott';
const MAX_EVENTS = 200;

export type OttEventKind = 'ott_date' | 'ott_arrived' | 'new_season' | 'season_date';

export interface OttEvent {
  id: string;
  titleKey: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  kind: OttEventKind;
  message: string;
  createdAt: string; // ISO
  read: boolean;
}

export interface OttTitleState extends OttInfo {
  titleKey: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  // TV only
  knownSeasons?: number;
  nextSeason?: number | null;      // season of the next premiere with a confirmed date
  nextAirDate?: string | null;     // YYYY-MM-DD of that premiere
  // Scheduled "digital release today" notification
  digitalNotifId?: string | null;
  digitalNotifDate?: string | null;
  // Alert de-duplication: data that flickers (provider drops out of TMDb and
  // comes back, a date disappears and reappears) must not alert twice.
  seenProviders?: string[];        // every provider ever seen for this title
  lastDigitalAlert?: string | null;  // last digital date we alerted about
  lastSeasonAlert?: string | null;   // `${season}|${date}` last alerted
}

interface OttState {
  titles: Record<string, OttTitleState>;
  events: OttEvent[];
  lastFullRefresh: string | null; // ISO
}

let cache: OttState | null = null;
let cacheAt = 0;
let loading: Promise<OttState> | null = null;
const listeners = new Set<() => void>();
// Reads reuse the cache this long; the background task may run in another JS
// context and write the same key, so mutations always reload first.
const CACHE_MS = 5000;

export function subscribeOtt(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Drops the in-memory copy (call after the stored key is wiped, e.g. backup restore). */
export function resetOttStore() {
  cache = null;
  cacheAt = 0;
  loading = null;
  listeners.forEach(l => l());
}

async function readStored(): Promise<OttState> {
  const st: OttState = { titles: {}, events: [], lastFullRefresh: null };
  try {
    const raw = await AsyncStorage.getItem(OTT_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (p.titles && typeof p.titles === 'object') st.titles = p.titles;
        if (Array.isArray(p.events)) st.events = p.events;
        if (typeof p.lastFullRefresh === 'string') st.lastFullRefresh = p.lastFullRefresh;
      }
    }
  } catch { /* start fresh */ }
  return st;
}

async function load(fresh = false): Promise<OttState> {
  if (cache && !fresh && Date.now() - cacheAt < CACHE_MS) return cache;
  if (!loading) {
    loading = readStored().then(st => { cache = st; cacheAt = Date.now(); return st; })
      .finally(() => { loading = null; });
  }
  return loading;
}

async function persist(st: OttState) {
  cache = st;
  cacheAt = Date.now();
  try { await AsyncStorage.setItem(OTT_KEY, JSON.stringify(st)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

// Writes are serialised so concurrent per-title checks don't clobber each other.
let writeChain: Promise<unknown> = Promise.resolve();
function mutate(fn: (st: OttState) => OttState | void): Promise<void> {
  const run = writeChain.then(async () => {
    const st = await load(true);
    const out = fn({ ...st, titles: { ...st.titles }, events: [...st.events] });
    await persist(out ?? st);
  });
  writeChain = run.catch(() => {});
  return run;
}

// ── Reads ─────────────────────────────────────────────
export async function getTitleStates(): Promise<OttTitleState[]> {
  return Object.values((await load()).titles);
}

export async function getTitleState(key: string): Promise<OttTitleState | undefined> {
  return (await load()).titles[key];
}

export async function getEvents(): Promise<OttEvent[]> {
  return (await load()).events;
}

export async function getUnreadCount(): Promise<number> {
  return (await load()).events.filter(e => !e.read).length;
}

export async function getLastFullRefresh(): Promise<string | null> {
  return (await load()).lastFullRefresh;
}

// ── Writes ────────────────────────────────────────────
export function saveTitleState(state: OttTitleState): Promise<void> {
  return mutate(st => { st.titles[state.titleKey] = state; return st; });
}

export function removeTitleState(key: string): Promise<void> {
  return mutate(st => { delete st.titles[key]; return st; });
}

export function addEvent(e: Omit<OttEvent, 'id' | 'createdAt' | 'read'>): Promise<void> {
  return mutate(st => {
    const ev: OttEvent = {
      ...e,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    st.events = [ev, ...st.events].slice(0, MAX_EVENTS);
    return st;
  });
}

export function markAllRead(): Promise<void> {
  return mutate(st => { st.events = st.events.map(e => (e.read ? e : { ...e, read: true })); return st; });
}

export function markRead(id: string): Promise<void> {
  return mutate(st => { st.events = st.events.map(e => (e.id === id && !e.read ? { ...e, read: true } : e)); return st; });
}

export function clearEvents(): Promise<void> {
  return mutate(st => { st.events = []; return st; });
}

export function setLastFullRefresh(iso: string): Promise<void> {
  return mutate(st => { st.lastFullRefresh = iso; return st; });
}
