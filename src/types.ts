// ── Content Categories ─────────────────────────────────
export type ContentType = 'movie' | 'series' | 'anime' | 'other';

export interface ContentTypeConfig {
  key: ContentType;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

export const CONTENT_TYPES: ContentTypeConfig[] = [
  { key: 'movie', label: 'Movies', shortLabel: 'M', icon: 'film-outline', color: '#10B981' },
  { key: 'series', label: 'Series', shortLabel: 'S', icon: 'tv-outline', color: '#3B82F6' },
  { key: 'anime', label: 'Anime', shortLabel: 'A', icon: 'sparkles-outline', color: '#A855F7' },
  { key: 'other', label: 'Other', shortLabel: 'OC', icon: 'albums-outline', color: '#F59E0B' },
];

// ── Watch Status ───────────────────────────────────────
export type WatchingStatus = 'watching' | 'completed' | 'caught_up';

// ── Season Breakdown ───────────────────────────────────
export interface SeasonBreakdown {
  season: number;
  episodes: number;
  title?: string;
}

// ── Watching Item (persisted) ──────────────────────────
export interface WatchingItem {
  id: number;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  contentType: ContentType;
  title: string;
  posterUrl: string | null;
  year: string;
  status: WatchingStatus;
  // Series/Anime progress
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  episodesWatched?: number;
  seasonEpisodes?: SeasonBreakdown[];
  // Movie status
  movieCompleted?: boolean;
  // Metadata
  genres: string[];
  rating: number;
  runtime?: number | null;       // minutes for movie
  episodeRuntime?: number | null; // avg episode runtime
  // Timestamps
  startedAt: string;   // ISO date — when added to watching
  lastWatched: string;  // ISO date — last progress update
  completedAt?: string; // ISO date — when marked complete
}

// ── Watch History Entry ────────────────────────────────
export interface WatchHistoryEntry {
  id: string;          // unique log id
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  contentType: ContentType;
  title: string;
  posterUrl: string | null;
  genres: string[];
  rating: number;
  runtime?: number | null;
  totalEpisodes?: number;
  episodeRuntime?: number | null;
  completedAt: string; // ISO date
  year: string;
}

// ── Computed Stats ─────────────────────────────────────
export interface ComputedStats {
  lifetime: {
    movies: number;
    series: number;
    anime: number;
    other: number;
    totalHours: number;
  };
  currentStreak: number;
  longestStreak: number;
  lastWatchedDate: string | null;
}

export interface PeriodStats {
  movies: number;
  series: number;
  anime: number;
  other: number;
  hours: number;
}

export interface GenreStats {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

// ── TMDb Media Item (shared search result type) ───────
export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: MediaItem[];
}

// ── Month Helpers ──────────────────────────────────────
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Genre colors for bar charts
export const GENRE_COLORS = [
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#6366F1',
  '#A855F7', '#EC4899', '#F43F5E', '#F59E0B', '#84CC16',
];

// ── Helper: detect content type from TMDb data ────────
export function detectContentType(
  mediaType: 'movie' | 'tv',
  genreIds?: number[],
  genres?: { id: number; name: string }[],
): ContentType {
  const ids = genreIds || genres?.map(g => g.id) || [];
  // Animation (16) genre → anime
  if (mediaType === 'tv' && ids.includes(16)) return 'anime';
  if (mediaType === 'movie') return 'movie';
  if (mediaType === 'tv') return 'series';
  return 'other';
}
