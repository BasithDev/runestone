import { WatchlistPriority, WatchlistItem } from '../../services/watchlistStore';

export const PRIORITIES: { key: WatchlistPriority; label: string; color: string; rank: number }[] = [
  { key: 'high', label: 'High', color: '#F87171', rank: 0 },
  { key: 'medium', label: 'Medium', color: '#F59E0B', rank: 1 },
  { key: 'low', label: 'Low', color: '#60A5FA', rank: 2 },
];

export function priorityOf(item: Pick<WatchlistItem, 'priority'>): WatchlistPriority {
  return item.priority ?? 'medium';
}

export function priorityMeta(p: WatchlistPriority) {
  return PRIORITIES.find(x => x.key === p) ?? PRIORITIES[1];
}
