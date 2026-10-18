// ── Title tracking payload builder ────────────────────
// One place that turns TMDb details into the item `startWatching` stores, so
// the details screen and the quick-track sheet always produce identical items.
import { SeasonBreakdown, WatchingItem, detectContentType } from '../types';
import { tmdbGet } from './tmdb';
import { localDateKey } from './watchingStore';

export type TrackablePayload = Omit<WatchingItem, 'startedAt' | 'lastWatched'>;

/** Subset of the TMDb details response the builder reads. */
export interface TrackableDetails {
  id: number;
  title?: string; name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average?: number; vote_count?: number;
  release_date?: string; first_air_date?: string;
  runtime?: number; episode_run_time?: number[];
  number_of_seasons?: number; number_of_episodes?: number;
  status?: string;
  overview?: string;
  created_by?: { id?: number; name: string }[];
  genres?: { id: number; name: string }[];
  credits?: { crew?: { job: string; name: string }[] };
  seasons?: { season_number: number; air_date?: string | null; episode_count?: number }[];
}

/** A season as fetched: only `air_date` of each episode is needed. */
export interface TrackableSeason {
  season_number: number;
  name?: string;
  air_date?: string | null;
  episodes?: { air_date?: string | null }[];
}

export interface TrackableBundle {
  item: TrackablePayload;
  meta: {
    backdropPath: string | null;
    voteCount: number;
    overview: string;
    releaseDate: string;
  };
}

/**
 * Per-season counts of episodes aired on or before `today` (local YYYY-MM-DD).
 * Specials (season 0) are skipped. A season with nothing aired yet is kept (as
 * 0 episodes) only when it is announced, i.e. it has an air date or listed episodes.
 */
export function airedSeasonBreakdown(
  seasons: TrackableSeason[], today = localDateKey(),
): SeasonBreakdown[] {
  const out: SeasonBreakdown[] = [];
  for (const sr of seasons) {
    if (!sr || sr.season_number === 0) continue;
    const eps = sr.episodes ?? [];
    const aired = eps.filter(e => !!e.air_date && e.air_date.slice(0, 10) <= today).length;
    const announced = !!sr.air_date || eps.length > 0;
    if (aired === 0 && !announced) continue;
    out.push({ season: sr.season_number, episodes: aired, title: sr.name });
  }
  return out.sort((a, b) => a.season - b.season);
}

/** Build the start-watching payload from details (+ fetched seasons for TV). */
export function buildTrackable(
  details: TrackableDetails, mediaType: 'movie' | 'tv', seasons: TrackableSeason[] = [],
): TrackablePayload {
  const isTv = mediaType === 'tv';
  const contentType = detectContentType(mediaType, undefined, details.genres);
  const seasonEpisodes = isTv ? airedSeasonBreakdown(seasons) : [];
  const airedTotal = seasonEpisodes.reduce((a, s) => a + s.episodes, 0);
  const directors = isTv
    ? (details.created_by || []).map(c => c.name)
    : (details.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name);

  return {
    id: Date.now(),
    tmdbId: details.id,
    mediaType,
    contentType,
    title: details.title || details.name || '',
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : null,
    year: (details.release_date || details.first_air_date || '').split('-')[0] || '',
    // The store flips this to 'rewatching' when the title is already in history
    status: 'watching',
    currentSeason: isTv ? 1 : undefined,
    currentEpisode: isTv ? 1 : undefined,
    totalSeasons: details.number_of_seasons || undefined,
    totalEpisodes: (isTv && airedTotal > 0 ? airedTotal : details.number_of_episodes) || undefined,
    episodesWatched: 0,
    seasonEpisodes: seasonEpisodes.length > 0 ? seasonEpisodes : undefined,
    movieCompleted: false,
    genres: (details.genres || []).map(g => g.name),
    rating: details.vote_average || 0,
    runtime: details.runtime || null,
    episodeRuntime: details.episode_run_time?.[0] || null,
    directors: directors.length > 0 ? directors : undefined,
    showStatus: isTv ? details.status : undefined,
  };
}

// ── Fetch + session cache ─────────────────────────────
const CACHE_MS = 30 * 60 * 1000; // aired-episode counts go stale in a long session
const cache = new Map<string, { at: number; p: Promise<TrackableBundle> }>();

async function load(mediaType: 'movie' | 'tv', tmdbId: number): Promise<TrackableBundle> {
  const details = await tmdbGet<TrackableDetails>(
    `${mediaType}/${tmdbId}`,
    mediaType === 'movie' ? { append_to_response: 'credits' } : {},
  );

  let seasons: TrackableSeason[] = [];
  if (mediaType === 'tv') {
    const numbers = (details.seasons?.length
      ? details.seasons.map(s => s.season_number)
      : Array.from({ length: details.number_of_seasons ?? 0 }, (_, i) => i + 1)
    ).filter(n => n > 0);
    const results = await Promise.all(numbers.map(async n => {
      const path = `tv/${tmdbId}/season/${n}`;
      try { return await tmdbGet<TrackableSeason>(path); }
      catch {
        try { return await tmdbGet<TrackableSeason>(path); } catch { return null; }
      }
    }));
    // A season that failed twice must not silently vanish (the stored total would be
    // too low for good): approximate it from the show's own episode_count instead.
    seasons = results.map((r, i) => {
      if (r) return r;
      const meta = details.seasons?.find(s => s.season_number === numbers[i]);
      const n = meta?.episode_count ?? 0;
      return {
        season_number: numbers[i], air_date: meta?.air_date,
        episodes: Array.from({ length: n }, () => ({ air_date: meta?.air_date })),
      };
    });
  }

  return {
    item: buildTrackable(details, mediaType, seasons),
    meta: {
      backdropPath: details.backdrop_path ?? null,
      voteCount: details.vote_count ?? 0,
      overview: details.overview ?? '',
      releaseDate: details.release_date || details.first_air_date || '',
    },
  };
}

/** Payload plus extra metadata (cached for the session; failures are not cached). */
export function fetchTrackableBundle(mediaType: 'movie' | 'tv', tmdbId: number): Promise<TrackableBundle> {
  const key = `${mediaType}-${tmdbId}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) {
    const fresh = load(mediaType, tmdbId);
    hit = { at: Date.now(), p: fresh };
    cache.set(key, hit);
    const entry = hit;
    fresh.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  }
  // Fresh id per call so two starts never share an id.
  return hit.p.then(b => ({ ...b, item: { ...b.item, id: Date.now() } }));
}

/** Full start-watching payload for a title. */
export async function fetchTrackable(mediaType: 'movie' | 'tv', tmdbId: number): Promise<TrackablePayload> {
  return (await fetchTrackableBundle(mediaType, tmdbId)).item;
}
