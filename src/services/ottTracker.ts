// ── India OTT / new-season tracker ────────────────────
// Everything here is region IN (see services/tmdb.ts REGION).
import { OttInfo, WatchingStatus, parseLocalDate, titleKey } from '../types';
import { RELEASE_TYPE, getMovieReleaseDates, getWatchProviders, tmdbGet } from './tmdb';
import { getUpcomingItems } from './upcomingStore';
import { getWatchlist } from './watchlistStore';
import { getWatchingItems } from './watchingStore';
import { cancelNotification, notifyNow, scheduleNotificationAt } from './notifications';
import {
  OttEventKind, OttTitleState, addEvent, getLastFullRefresh, getTitleState, getTitleStates,
  removeTitleState, saveTitleState, setLastFullRefresh,
} from './ottStore';

const FRESH_MS = 12 * 60 * 60 * 1000;
const CONCURRENCY = 4;
const TRACKED_STATUSES: WatchingStatus[] = ['watching', 'caught_up', 'on_hold', 'rewatching'];

export interface TrackedTitle {
  key: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
}

export async function getTrackedTitles(): Promise<TrackedTitle[]> {
  const [upcoming, watchlist, watching] = await Promise.all([
    getUpcomingItems(), getWatchlist(), getWatchingItems(),
  ]);
  const map = new Map<string, TrackedTitle>();
  const add = (tmdbId: number, mediaType: 'movie' | 'tv', title: string) => {
    const key = titleKey(mediaType, tmdbId);
    if (!map.has(key)) map.set(key, { key, tmdbId, mediaType, title });
  };
  upcoming.forEach(i => add(i.tmdbId, i.mediaType, i.title));
  watchlist.forEach(i => add(i.id, i.media_type, i.title));
  watching
    .filter(i => TRACKED_STATUSES.includes(i.status))
    .forEach(i => add(i.tmdbId, i.mediaType, i.title));
  return [...map.values()];
}

// ── Fetching ──────────────────────────────────────────
interface FetchedOtt {
  digitalDate: string | null;
  providers: string[];
  knownSeasons?: number;
  nextSeason?: number | null;
  nextAirDate?: string | null;
}

function providerNames(p: Awaited<ReturnType<typeof getWatchProviders>>): string[] {
  const names = [...(p.flatrate ?? []), ...(p.free ?? []), ...(p.ads ?? [])].map(x => x.provider_name);
  return [...new Set(names)];
}

async function fetchOtt(t: { tmdbId: number; mediaType: 'movie' | 'tv' }): Promise<FetchedOtt> {
  if (t.mediaType === 'movie') {
    const [releases, providers] = await Promise.all([
      getMovieReleaseDates(t.tmdbId),
      getWatchProviders('movie', t.tmdbId),
    ]);
    const dates = releases
      .filter(r => r.type === RELEASE_TYPE.DIGITAL && r.release_date)
      .map(r => r.release_date.slice(0, 10))
      .sort();
    const today = toYmd(new Date());
    // Prefer the earliest upcoming date, else the most recent past one.
    const digitalDate = dates.find(d => d >= today) ?? dates[dates.length - 1] ?? null;
    return { digitalDate, providers: providerNames(providers) };
  }

  const [show, providers] = await Promise.all([
    tmdbGet<any>(`tv/${t.tmdbId}`),
    getWatchProviders('tv', t.tmdbId),
  ]);
  const seasons: { season_number: number; air_date?: string | null }[] =
    (show.seasons ?? []).filter((s: any) => s.season_number > 0);
  const knownSeasons = Math.max(show.number_of_seasons ?? 0, ...seasons.map(s => s.season_number), 0);

  const today = toYmd(new Date());
  let nextSeason: number | null = null;
  let nextAirDate: string | null = null;
  const future = seasons.filter(s => s.air_date && s.air_date >= today)
    .sort((a, b) => a.air_date!.localeCompare(b.air_date!))[0];
  if (future) {
    nextSeason = future.season_number;
    nextAirDate = future.air_date!;
  } else if (show.next_episode_to_air?.episode_number === 1 && show.next_episode_to_air.air_date) {
    nextSeason = show.next_episode_to_air.season_number;
    nextAirDate = show.next_episode_to_air.air_date;
  }
  return { digitalDate: null, providers: providerNames(providers), knownSeasons, nextSeason, nextAirDate };
}

function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatOttDate(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Per-title check ───────────────────────────────────
async function emit(t: TrackedTitle, kind: OttEventKind, message: string, notify: boolean) {
  await addEvent({ titleKey: t.key, tmdbId: t.tmdbId, mediaType: t.mediaType, title: t.title, kind, message });
  if (notify) await notifyNow(t.title, message, { tmdbId: t.tmdbId, mediaType: t.mediaType, screen: 'alerts' });
}

export async function checkTitle(t: TrackedTitle, opts: { force?: boolean } = {}): Promise<OttTitleState> {
  const prev = await getTitleState(t.key);
  if (prev && !opts.force && Date.now() - new Date(prev.checkedAt).getTime() < FRESH_MS) return prev;

  const f = await fetchOtt(t);
  const baseline = !prev;
  const now = new Date().toISOString();
  const today = toYmd(new Date());

  const next: OttTitleState = {
    titleKey: t.key, tmdbId: t.tmdbId, mediaType: t.mediaType, title: t.title,
    digitalDate: f.digitalDate,
    providers: f.providers,
    checkedAt: now,
    arrivedAt: prev?.arrivedAt ?? null,
    knownSeasons: t.mediaType === 'tv' ? f.knownSeasons : undefined,
    nextSeason: f.nextSeason ?? null,
    nextAirDate: f.nextAirDate ?? null,
    digitalNotifId: prev?.digitalNotifId ?? null,
    digitalNotifDate: prev?.digitalNotifDate ?? null,
  };

  // Digital date
  if (f.digitalDate && f.digitalDate !== prev?.digitalDate) {
    if (!baseline || f.digitalDate >= today) {
      await emit(t, 'ott_date', `OTT release in India on ${formatOttDate(f.digitalDate)}`, !baseline);
    }
  }

  // Providers
  if (!baseline) {
    const added = f.providers.filter(p => !prev!.providers.includes(p));
    if (added.length > 0) {
      next.arrivedAt = prev!.arrivedAt ?? now;
      await emit(t, 'ott_arrived', `Now streaming in India on ${added.join(', ')}`, true);
    }
  }

  // New seasons (TV)
  if (t.mediaType === 'tv' && !baseline) {
    if ((f.knownSeasons ?? 0) > (prev!.knownSeasons ?? 0)) {
      await emit(t, 'new_season', `Season ${f.knownSeasons} announced`, true);
    }
    if (f.nextAirDate && (f.nextAirDate !== prev!.nextAirDate || f.nextSeason !== prev!.nextSeason)) {
      await emit(t, 'season_date', `Season ${f.nextSeason} premieres ${formatOttDate(f.nextAirDate)}`, true);
    }
  }

  // Morning-of notification for a future digital date
  if (next.digitalNotifDate !== f.digitalDate || !f.digitalDate) {
    await cancelNotification(next.digitalNotifId);
    next.digitalNotifId = null;
    next.digitalNotifDate = null;
  }
  if (f.digitalDate && f.digitalDate >= today && !next.digitalNotifId) {
    const at = parseLocalDate(f.digitalDate);
    at.setHours(9, 0, 0, 0);
    const id = await scheduleNotificationAt(
      at, `${t.title} is on OTT today`, 'Digital release in India today.',
      { tmdbId: t.tmdbId, mediaType: t.mediaType, screen: 'alerts' },
    );
    if (id) { next.digitalNotifId = id; next.digitalNotifDate = f.digitalDate; }
  }

  await saveTitleState(next);
  return next;
}

// ── Refresh all ───────────────────────────────────────
let inFlight: Promise<void> | null = null;

/** Checks every tracked title (skipping ones checked < 12 h ago unless forced). */
export function refreshAll(opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const tracked = await getTrackedTitles();

    // Drop state (and pending notifications) for titles no longer tracked.
    const keys = new Set(tracked.map(t => t.key));
    for (const s of await getTitleStates()) {
      if (!keys.has(s.titleKey)) {
        await cancelNotification(s.digitalNotifId);
        await removeTitleState(s.titleKey);
      }
    }

    const queue = [...tracked];
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        try { await checkTitle(t, opts); } catch { /* one failure must not stop the run */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    await setLastFullRefresh(new Date().toISOString());
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/** Runs a full refresh if the last one was more than `maxAgeMs` ago. */
export async function refreshIfStale(maxAgeMs = 6 * 60 * 60 * 1000): Promise<void> {
  const last = await getLastFullRefresh();
  if (last && Date.now() - new Date(last).getTime() < maxAgeMs) return;
  await refreshAll();
}

// ── Single-title lookup (content screen) ──────────────
export async function getOttForTitle(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<OttInfo> {
  const key = titleKey(mediaType, tmdbId);
  const cached = await getTitleState(key);
  if (cached && Date.now() - new Date(cached.checkedAt).getTime() < FRESH_MS) return cached;
  if (cached) {
    try { return await checkTitle({ key, tmdbId, mediaType, title: cached.title }, { force: true }); }
    catch { return cached; }
  }
  // Untracked title: fetch without storing state or raising alerts.
  const f = await fetchOtt({ tmdbId, mediaType });
  return { digitalDate: f.digitalDate, providers: f.providers, checkedAt: new Date().toISOString() };
}
