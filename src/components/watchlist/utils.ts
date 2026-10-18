import { Platform } from 'react-native';
import { WatchlistItem } from '../../services/watchlistStore';
import { formatDuration } from '../../services/statsInsights';

const IMG_W342 = 'https://image.tmdb.org/t/p/w342';

export type SortKey = 'priority' | 'added' | 'rating' | 'title' | 'release';
export type TypeFilter = 'all' | 'movie' | 'tv';
export type ViewMode = 'grid' | 'list';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'added', label: 'Date Added' },
  { key: 'rating', label: 'Rating' },
  { key: 'title', label: 'Title' },
  { key: 'release', label: 'Release' },
];

export const COLORS = {
  bg: '#000',
  card: '#121212',
  border: 'rgba(255,255,255,0.06)',
  accent: '#10B981',
  text: '#fff',
  muted: '#A1A1AA',
  dim: '#71717A',
};

export function itemKey(item: WatchlistItem): string {
  return `${item.media_type}-${item.id}`;
}

export function posterUriOf(item: WatchlistItem): string | null {
  if (Platform.OS !== 'web' && item.local_poster_uri) return item.local_poster_uri;
  return item.poster_path ? `${IMG_W342}${item.poster_path}` : null;
}

export function yearOf(item: WatchlistItem): string {
  return item.release_date ? item.release_date.slice(0, 4) : '';
}

export function runtimeLabel(item: WatchlistItem): string {
  if (item.media_type === 'movie') {
    return item.runtime ? formatDuration(item.runtime) : '';
  }
  if (item.episode_count) {
    const total = item.episode_count * (item.episode_runtime || 45);
    return `${item.episode_count} eps · ~${formatDuration(total)}`;
  }
  return item.runtime ? formatDuration(item.runtime) : '';
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
