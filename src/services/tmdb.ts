// ── TMDb client ───────────────────────────────────────
// Single place for every TMDb call. Defaults to India (region IN) for
// release dates, upcoming lists and streaming providers.

export const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
export const REGION = 'IN';
export const LANGUAGE = 'en-US';

const BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 15000;

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

  const url = `${BASE}/${path.replace(/^\//, '')}?${qs}`;
  // Never hang forever (a stuck request would keep screens in "loading"), and
  // retry once on a rate limit (429) honouring Retry-After.
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    init?.signal?.addEventListener('abort', onAbort);
    if (init?.signal?.aborted) ctrl.abort();
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.status === 429 && attempt === 0) {
        const wait = Math.min(Number(res.headers.get('retry-after')) || 1, 5);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.success === false) {
        throw new TmdbError(res.status, json?.status_message || `TMDb request failed (${res.status})`);
      }
      return json as T;
    } finally {
      clearTimeout(timer);
      init?.signal?.removeEventListener('abort', onAbort);
    }
  }
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
  return (json.results ?? []).find(r => r.iso_3166_1 === region)?.release_dates ?? [];
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
