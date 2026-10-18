// ── TMDb client ───────────────────────────────────────
// Single place for every TMDb call. Defaults to India (region IN) for
// release dates, upcoming lists and streaming providers.

export const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
export const REGION = 'IN';
export const LANGUAGE = 'en-US';

const BASE = 'https://api.themoviedb.org/3';

export type ImageSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

export function tmdbImage(path: string | null | undefined, size: ImageSize = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export class TmdbError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * GET a TMDb endpoint. Throws TmdbError on missing key, HTTP errors and
 * TMDb error payloads (`success: false`), so callers can rely on the result.
 */
export async function tmdbGet<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  init?: { signal?: AbortSignal },
): Promise<T> {
  if (!TMDB_KEY) throw new TmdbError(0, 'Missing EXPO_PUBLIC_TMDB_API_KEY');

  const qs = new URLSearchParams({ api_key: TMDB_KEY, language: LANGUAGE });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }

  const res = await fetch(`${BASE}/${path.replace(/^\//, '')}?${qs}`, { signal: init?.signal });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    throw new TmdbError(res.status, json?.status_message || `TMDb request failed (${res.status})`);
  }
  return json as T;
}

// ── Release dates (movies) ────────────────────────────
// TMDb release types: 1 Premiere, 2 Theatrical (limited), 3 Theatrical,
// 4 Digital (OTT), 5 Physical, 6 TV.
export const RELEASE_TYPE = {
  PREMIERE: 1, THEATRICAL_LIMITED: 2, THEATRICAL: 3, DIGITAL: 4, PHYSICAL: 5, TV: 6,
} as const;

export interface RegionRelease {
  type: number;
  release_date: string; // ISO datetime
  certification?: string;
  note?: string;
}

/** Release dates for one movie in the given region (default India). */
export async function getMovieReleaseDates(movieId: number, region = REGION): Promise<RegionRelease[]> {
  const json = await tmdbGet<{ results: { iso_3166_1: string; release_dates: RegionRelease[] }[] }>(
    `movie/${movieId}/release_dates`,
  );
  return json.results.find(r => r.iso_3166_1 === region)?.release_dates ?? [];
}

// ── Watch providers ───────────────────────────────────
export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface RegionProviders {
  link?: string;
  flatrate?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
  free?: Provider[];
  ads?: Provider[];
}

/** Streaming providers for a title in the given region (default India). */
export async function getWatchProviders(
  mediaType: 'movie' | 'tv', id: number, region = REGION,
): Promise<RegionProviders> {
  const json = await tmdbGet<{ results: Record<string, RegionProviders> }>(`${mediaType}/${id}/watch/providers`);
  return json.results?.[region] ?? {};
}
