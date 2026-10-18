export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
  original_language?: string;
}

export type SortKey = 'relevance' | 'popularity' | 'rating' | 'newest';

export interface SearchFilters {
  genres: number[];
  language: string | null;
  minRating: number | null;
  sort: SortKey;
}

export const DEFAULT_FILTERS: SearchFilters = { genres: [], language: null, minRating: null, sort: 'relevance' };

export const LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: 'Any' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

export const RATINGS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 6, label: '6+' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
];

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'rating', label: 'Rating' },
  { key: 'newest', label: 'Newest' },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

export function mediaTypeOf(i: MediaItem): 'movie' | 'tv' {
  return i.media_type === 'tv' || (!i.media_type && !i.title && !!i.name) ? 'tv' : 'movie';
}

export function itemDate(i: MediaItem): string {
  return i.release_date || i.first_air_date || '';
}

/** Number of active filters (each genre counts, year counts). */
export function countActiveFilters(f: SearchFilters, year: number | null): number {
  return f.genres.length + (f.language ? 1 : 0) + (f.minRating ? 1 : 0) + (f.sort !== 'relevance' ? 1 : 0) + (year != null ? 1 : 0);
}

export function sortItems(items: MediaItem[], sort: SortKey): MediaItem[] {
  if (sort === 'relevance') return items;
  const key = (i: MediaItem): number | string =>
    sort === 'popularity' ? i.popularity ?? 0 : sort === 'rating' ? i.vote_average || 0 : itemDate(i);
  return [...items].sort((a, b) => {
    const x = key(a), y = key(b);
    return x < y ? 1 : x > y ? -1 : 0;
  });
}

/** On-device filters + sort (TMDb search can't filter by these). */
export function applyClientFilters(items: MediaItem[], f: SearchFilters): MediaItem[] {
  let out = items;
  if (f.genres.length) out = out.filter(i => i.genre_ids?.some(g => f.genres.includes(g)));
  if (f.language) out = out.filter(i => i.original_language === f.language);
  if (f.minRating) out = out.filter(i => (i.vote_average || 0) >= f.minRating!);
  return sortItems(out, f.sort);
}
