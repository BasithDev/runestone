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
}

interface OttState {
  titles: Record<string, OttTitleState>;
  events: OttEvent[];
  lastFullRefresh: string | null; // ISO
}

let cache: OttState | null = null;
let loading: Promise<OttState> | null = null;
const listeners = new Set<() => void>();

export function subscribeOtt(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function load(): Promise<OttState> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      let st: OttState = { titles: {}, events: [], lastFullRefresh: null };
      try {
        const raw = await AsyncStorage.getItem(OTT_KEY);
        if (raw) st = { ...st, ...JSON.parse(raw) };
      } catch { /* start fresh */ }
      cache = st;
      return st;
    })();
  }
  return loading;
}

async function persist(st: OttState) {
  cache = st;
  try { await AsyncStorage.setItem(OTT_KEY, JSON.stringify(st)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

// Writes are serialised so concurrent per-title checks don't clobber each other.
let writeChain: Promise<unknown> = Promise.resolve();
function mutate(fn: (st: OttState) => OttState | void): Promise<void> {
  const run = writeChain.then(async () => {
    const st = await load();
    const out = fn({ ...st, titles: { ...st.titles }, events: [...st.events] }) ;
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

export function setLastFullRefresh(iso: string): Promise<void> {
  return mutate(st => { st.lastFullRefresh = iso; return st; });
}
