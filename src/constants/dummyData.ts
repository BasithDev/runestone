// ── Content Types ──────────────────────────────────────
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

// ── Lifetime Stats ─────────────────────────────────────
export interface LifetimeStats {
  movies: number;
  series: number;
  anime: number;
  other: number;
  totalHours: number; // total hours spent across all content
}

export const LIFETIME_STATS: LifetimeStats = {
  movies: 342,
  series: 89,
  anime: 156,
  other: 23,
  totalHours: 2847, // ~118 days
};

// ── Monthly Stats ──────────────────────────────────────
export interface MonthStats {
  month: number; // 1-12
  movies: number;
  series: number;
  anime: number;
  other: number;
  hours: number;
}

export interface YearStats {
  year: number;
  months: MonthStats[];
  totals: {
    movies: number;
    series: number;
    anime: number;
    other: number;
    hours: number;
  };
}

export const YEARLY_STATS: YearStats[] = [
  {
    year: 2026,
    months: [
      { month: 1, movies: 8, series: 2, anime: 5, other: 1, hours: 62 },
      { month: 2, movies: 6, series: 1, anime: 7, other: 0, hours: 54 },
      { month: 3, movies: 10, series: 3, anime: 4, other: 2, hours: 78 },
      { month: 4, movies: 5, series: 2, anime: 6, other: 1, hours: 51 },
      { month: 5, movies: 9, series: 1, anime: 8, other: 0, hours: 68 },
      { month: 6, movies: 3, series: 0, anime: 2, other: 0, hours: 18 },
    ],
    totals: { movies: 41, series: 9, anime: 32, other: 4, hours: 331 },
  },
  {
    year: 2025,
    months: [
      { month: 1, movies: 7, series: 3, anime: 6, other: 1, hours: 72 },
      { month: 2, movies: 5, series: 2, anime: 4, other: 0, hours: 48 },
      { month: 3, movies: 9, series: 1, anime: 8, other: 2, hours: 85 },
      { month: 4, movies: 6, series: 4, anime: 5, other: 1, hours: 67 },
      { month: 5, movies: 8, series: 2, anime: 7, other: 0, hours: 74 },
      { month: 6, movies: 11, series: 3, anime: 9, other: 2, hours: 96 },
      { month: 7, movies: 4, series: 1, anime: 3, other: 1, hours: 38 },
      { month: 8, movies: 7, series: 2, anime: 6, other: 0, hours: 62 },
      { month: 9, movies: 6, series: 3, anime: 5, other: 1, hours: 58 },
      { month: 10, movies: 10, series: 2, anime: 8, other: 2, hours: 88 },
      { month: 11, movies: 8, series: 1, anime: 7, other: 0, hours: 65 },
      { month: 12, movies: 12, series: 4, anime: 10, other: 3, hours: 112 },
    ],
    totals: { movies: 93, series: 28, anime: 78, other: 13, hours: 865 },
  },
  {
    year: 2024,
    months: [
      { month: 1, movies: 6, series: 2, anime: 4, other: 0, hours: 52 },
      { month: 2, movies: 4, series: 1, anime: 3, other: 1, hours: 38 },
      { month: 3, movies: 8, series: 3, anime: 6, other: 1, hours: 74 },
      { month: 4, movies: 5, series: 2, anime: 5, other: 0, hours: 48 },
      { month: 5, movies: 7, series: 1, anime: 4, other: 2, hours: 56 },
      { month: 6, movies: 9, series: 3, anime: 7, other: 1, hours: 82 },
      { month: 7, movies: 6, series: 2, anime: 5, other: 0, hours: 54 },
      { month: 8, movies: 8, series: 1, anime: 6, other: 1, hours: 65 },
      { month: 9, movies: 5, series: 2, anime: 4, other: 0, hours: 46 },
      { month: 10, movies: 7, series: 3, anime: 8, other: 2, hours: 78 },
      { month: 11, movies: 10, series: 2, anime: 6, other: 1, hours: 72 },
      { month: 12, movies: 11, series: 4, anime: 9, other: 2, hours: 98 },
    ],
    totals: { movies: 86, series: 26, anime: 67, other: 11, hours: 763 },
  },
];

// ── Genre Distribution ─────────────────────────────────
export interface GenreStats {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export const GENRE_DISTRIBUTION: GenreStats[] = [
  { name: 'Action', count: 127, percentage: 34, color: '#10B981' },
  { name: 'Sci-Fi', count: 82, percentage: 22, color: '#14B8A6' },
  { name: 'Drama', count: 67, percentage: 18, color: '#06B6D4' },
  { name: 'Thriller', count: 52, percentage: 14, color: '#0EA5E9' },
  { name: 'Comedy', count: 45, percentage: 12, color: '#6366F1' },
];

// ── Streak Data ────────────────────────────────────────
export interface StreakData {
  current: number;
  longest: number;
  lastWatched: string; // ISO date
}

export const STREAK_DATA: StreakData = {
  current: 12,
  longest: 34,
  lastWatched: '2026-06-05',
};

// ── Currently Watching ─────────────────────────────────
export type WatchingStatus = 'watching' | 'completed' | 'not_completed' | 'caught_up';

export interface SeasonBreakdown {
  season: number;
  episodes: number;
  title?: string; // e.g. "Season 1", "Final Season"
}

export interface WatchingItem {
  id: number;
  title: string;
  posterUrl: string;
  type: ContentType;
  status: WatchingStatus;
  year: string;
  // For series/anime
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  episodesWatched?: number;
  seasonEpisodes?: SeasonBreakdown[]; // per-season episode counts
  // For movies
  movieCompleted?: boolean;
  // Metadata
  genres: string[];
  rating: number;
  lastWatched: string; // ISO date
}

export const CURRENTLY_WATCHING: WatchingItem[] = [
  {
    id: 1,
    title: 'Interstellar',
    posterUrl: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    type: 'movie',
    status: 'completed',
    year: '2014',
    movieCompleted: true,
    genres: ['Sci-Fi', 'Drama'],
    rating: 8.7,
    lastWatched: '2026-06-03',
  },
  {
    id: 2,
    title: 'Tenet',
    posterUrl: 'https://image.tmdb.org/t/p/w342/k68nPLbIST6NP96JmTxmZijEvCA.jpg',
    type: 'movie',
    status: 'not_completed',
    year: '2020',
    movieCompleted: false,
    genres: ['Action', 'Sci-Fi', 'Thriller'],
    rating: 7.3,
    lastWatched: '2026-06-01',
  },
  {
    id: 3,
    title: 'Breaking Bad',
    posterUrl: 'https://image.tmdb.org/t/p/w342/ztkUQFLlC19CCMYHW73FExTpMfR.jpg',
    type: 'series',
    status: 'watching',
    year: '2008',
    currentSeason: 3,
    currentEpisode: 7,
    totalSeasons: 5,
    totalEpisodes: 62,
    episodesWatched: 27,
    seasonEpisodes: [
      { season: 1, episodes: 7, title: 'Season 1' },
      { season: 2, episodes: 13, title: 'Season 2' },
      { season: 3, episodes: 13, title: 'Season 3' },
      { season: 4, episodes: 13, title: 'Season 4' },
      { season: 5, episodes: 16, title: 'Season 5' },
    ],
    genres: ['Drama', 'Crime', 'Thriller'],
    rating: 9.5,
    lastWatched: '2026-06-05',
  },
  {
    id: 4,
    title: 'Attack on Titan',
    posterUrl: 'https://image.tmdb.org/t/p/w342/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
    type: 'anime',
    status: 'watching',
    year: '2013',
    currentSeason: 2,
    currentEpisode: 8,
    totalSeasons: 4,
    totalEpisodes: 87,
    episodesWatched: 33,
    seasonEpisodes: [
      { season: 1, episodes: 25, title: 'Season 1' },
      { season: 2, episodes: 12, title: 'Season 2' },
      { season: 3, episodes: 22, title: 'Season 3' },
      { season: 4, episodes: 28, title: 'The Final Season' },
    ],
    genres: ['Action', 'Fantasy', 'Drama'],
    rating: 9.1,
    lastWatched: '2026-06-04',
  },
  {
    id: 5,
    title: 'One Piece',
    posterUrl: 'https://image.tmdb.org/t/p/w342/cMD9Ygz11zjJzAEnBoE2y80UEbw.jpg',
    type: 'anime',
    status: 'watching',
    year: '1999',
    currentSeason: 1,
    currentEpisode: 340,
    totalSeasons: 1,
    totalEpisodes: 1100,
    episodesWatched: 340,
    seasonEpisodes: [
      { season: 1, episodes: 1100, title: 'Season 1' },
    ],
    genres: ['Action', 'Adventure', 'Comedy'],
    rating: 8.9,
    lastWatched: '2026-06-05',
  },
  {
    id: 6,
    title: 'The Oppenheimer',
    posterUrl: 'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    type: 'movie',
    status: 'completed',
    year: '2023',
    movieCompleted: true,
    genres: ['Drama', 'History'],
    rating: 8.3,
    lastWatched: '2026-05-28',
  },
];

export const AWAITING_NEW_SEASON: WatchingItem[] = [
  {
    id: 101,
    title: 'Stranger Things',
    posterUrl: 'https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    type: 'series',
    status: 'caught_up',
    year: '2016',
    currentSeason: 4,
    currentEpisode: 9,
    totalSeasons: 4,
    totalEpisodes: 34,
    episodesWatched: 34,
    seasonEpisodes: [
      { season: 1, episodes: 8, title: 'Season 1' },
      { season: 2, episodes: 9, title: 'Season 2' },
      { season: 3, episodes: 8, title: 'Season 3' },
      { season: 4, episodes: 9, title: 'Season 4' },
    ],
    genres: ['Sci-Fi', 'Horror', 'Drama'],
    rating: 8.7,
    lastWatched: '2026-03-15',
  },
  {
    id: 102,
    title: 'Jujutsu Kaisen',
    posterUrl: 'https://image.tmdb.org/t/p/w342/hFWP5HkbVEe40hrXgtCeQxoccHB.jpg',
    type: 'anime',
    status: 'caught_up',
    year: '2020',
    currentSeason: 2,
    currentEpisode: 23,
    totalSeasons: 2,
    totalEpisodes: 47,
    episodesWatched: 47,
    seasonEpisodes: [
      { season: 1, episodes: 24, title: 'Season 1' },
      { season: 2, episodes: 23, title: 'Season 2' },
    ],
    genres: ['Action', 'Fantasy', 'Supernatural'],
    rating: 8.6,
    lastWatched: '2026-04-20',
  },
  {
    id: 103,
    title: 'Arcane',
    posterUrl: 'https://image.tmdb.org/t/p/w342/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
    type: 'anime',
    status: 'caught_up',
    year: '2021',
    currentSeason: 2,
    currentEpisode: 9,
    totalSeasons: 2,
    totalEpisodes: 18,
    episodesWatched: 18,
    seasonEpisodes: [
      { season: 1, episodes: 9, title: 'Season 1' },
      { season: 2, episodes: 9, title: 'Season 2' },
    ],
    genres: ['Animation', 'Action', 'Fantasy'],
    rating: 9.0,
    lastWatched: '2026-01-10',
  },
  {
    id: 104,
    title: 'The Last of Us',
    posterUrl: 'https://image.tmdb.org/t/p/w342/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
    type: 'series',
    status: 'caught_up',
    year: '2023',
    currentSeason: 2,
    currentEpisode: 7,
    totalSeasons: 2,
    totalEpisodes: 16,
    episodesWatched: 16,
    seasonEpisodes: [
      { season: 1, episodes: 9, title: 'Season 1' },
      { season: 2, episodes: 7, title: 'Season 2' },
    ],
    genres: ['Drama', 'Action', 'Sci-Fi'],
    rating: 8.8,
    lastWatched: '2026-05-01',
  },
];

// ── Month names helper ─────────────────────────────────
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
