import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useGuardedPush } from '../navGuard';
import { Ionicons } from '@expo/vector-icons';
import { ContentType, MONTH_NAMES, WatchingStatus, WatchLogEntry, titleKey } from '../../types';
import { LibraryEntry, formatDuration } from '../../services/statsInsights';
import StatusPill from '../tracking/StatusPill';
import {
  ACCENT, CHART_ORDER_CFG, ScalePressable, SectionTitle, TYPE_CFG, relativeTime, sh,
} from './shared';

type StatusFilter = 'all' | 'watching' | 'caught_up' | 'completed' | 'on_hold' | 'dropped';
type Sort = 'recent' | 'time' | 'title';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watching', label: 'Watching' },
  { key: 'caught_up', label: 'Caught Up' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'dropped', label: 'Dropped' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'time', label: 'Most time' },
  { key: 'title', label: 'Title' },
];

const matchStatus = (s: WatchingStatus, f: StatusFilter) =>
  f === 'all' || s === f || (f === 'watching' && s === 'rewatching');

function Chip({ label, count, active, onPress, dot }: { label: string; count: number; active: boolean; onPress: () => void; dot?: string }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]} hitSlop={4}>
      {dot ? <View style={[s.chipDot, { backgroundColor: dot }]} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      <Text style={[s.chipCount, active && s.chipTextActive]}>{count}</Text>
    </Pressable>
  );
}

// Static on purpose: a list can hold many rows, and animating each one
// would compete with scrolling.
function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={s.progTrack}>
      <View style={[s.progFill, { backgroundColor: color, width: `${Math.min(1, ratio) * 100}%` }]} />
    </View>
  );
}

const Row = memo(function Row({ item, onOpen }: { item: LibraryEntry; onOpen: (item: LibraryEntry) => void }) {
  const cfg = TYPE_CFG[item.contentType];
  const isTv = item.mediaType === 'tv';
  const hasProg = isTv && !!item.totalEpisodes && item.episodesWatched != null;
  return (
    <ScalePressable onPress={() => onOpen(item)} style={s.row}>
      {item.posterUrl
        ? <Image source={{ uri: item.posterUrl }} style={s.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={item.key} />
        : <View style={[s.poster, s.posterEmpty]}><Ionicons name={cfg.icon as any} size={18} color="#3F3F46" /></View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title} numberOfLines={1}>{item.title}</Text>
        <View style={s.metaRow}>
          <View style={[s.dot, { backgroundColor: cfg.color }]} />
          <Text style={s.meta} numberOfLines={1}>{cfg.label}{item.year ? ` · ${item.year}` : ''}</Text>
        </View>
        <View style={s.metaRow}>
          <StatusPill status={item.status} />
          {item.timesCompleted > 1 ? <Text style={s.meta}>Watched {item.timesCompleted}×</Text> : null}
        </View>
        {hasProg ? (
          <View style={s.progRow}>
            <ProgressBar ratio={(item.episodesWatched ?? 0) / (item.totalEpisodes || 1)} color={ACCENT} />
            <Text style={s.progText}>ep {item.episodesWatched}/{item.totalEpisodes}</Text>
          </View>
        ) : null}
        <Text style={s.foot} numberOfLines={1}>
          {item.minutes > 0 ? `${formatDuration(item.minutes)} watched · ` : ''}{relativeTime(item.lastWatchedAt)}
        </Text>
      </View>
    </ScalePressable>
  );
});

const PAGE = 15;
const MORE = 30;

export default function LibraryList({
  library, watchLog, year, typeFilter, onTypeFilter, month, onClearMonth,
}: {
  library: LibraryEntry[]; watchLog: WatchLogEntry[]; year: number;
  typeFilter: ContentType | null; onTypeFilter: (t: ContentType | null) => void;
  month: number | null; onClearMonth: () => void;
}) {
  const push = useGuardedPush();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [limit, setLimit] = useState(PAGE);

  // Titles with positive log entries in the selected month.
  const monthKeys = useMemo(() => {
    if (!month) return null;
    const set = new Set<string>();
    for (const e of watchLog) {
      if (e.episodes <= 0) continue;
      const d = new Date(e.at);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) set.add(titleKey(e.mediaType, e.tmdbId));
    }
    return set;
  }, [watchLog, year, month]);

  const base = useMemo(() => (monthKeys ? library.filter(l => monthKeys.has(l.key)) : library), [library, monthKeys]);
  const byType = useMemo(() => (typeFilter ? base.filter(l => l.contentType === typeFilter) : base), [base, typeFilter]);

  const rows = useMemo(() => {
    const out = byType.filter(l => matchStatus(l.status, status));
    if (sort === 'time') out.sort((a, b) => b.minutes - a.minutes);
    else if (sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title));
    return out; // base is already newest-first
  }, [byType, status, sort]);

  useEffect(() => { setLimit(PAGE); }, [typeFilter, status, sort, month]);

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const openItem = useCallback(
    (item: LibraryEntry) => push({ pathname: '/content/[id]', params: { id: item.tmdbId, media_type: item.mediaType } }),
    [push],
  );
  const filtered = !!typeFilter || !!month;

  return (
    <View style={sh.section}>
      <SectionTitle title="Your library" right={<Text style={s.total}>{rows.length} title{rows.length === 1 ? '' : 's'}</Text>} />

      {filtered && (
        <View style={s.banner}>
          <Ionicons name="funnel" size={13} color={ACCENT} />
          <Text style={s.bannerText} numberOfLines={1}>
            {[typeFilter ? TYPE_CFG[typeFilter].label : null, month ? `${MONTH_NAMES[month - 1]} ${year}` : null].filter(Boolean).join(' · ')}
          </Text>
          <Pressable
            onPress={() => { onTypeFilter(null); onClearMonth(); }}
            hitSlop={10} style={s.bannerClear} accessibilityLabel="Clear filters"
          >
            <Text style={s.bannerClearText}>Clear</Text>
            <Ionicons name="close" size={14} color="#fff" />
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="All types" count={base.filter(l => matchStatus(l.status, status)).length} active={!typeFilter} onPress={() => onTypeFilter(null)} />
        {CHART_ORDER_CFG.map(c => (
          <Chip
            key={c.key} label={c.label} dot={c.color} active={typeFilter === c.key}
            count={base.filter(l => l.contentType === c.key && matchStatus(l.status, status)).length}
            onPress={() => onTypeFilter(typeFilter === c.key ? null : c.key)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {STATUS_CHIPS.map(c => (
          <Chip
            key={c.key} label={c.label} active={status === c.key}
            count={byType.filter(l => matchStatus(l.status, c.key)).length}
            onPress={() => setStatus(c.key)}
          />
        ))}
      </ScrollView>

      <View style={s.sortRow}>
        <Text style={s.sortLabel}>Sort</Text>
        {SORTS.map(o => (
          <Pressable key={o.key} onPress={() => setSort(o.key)} style={[s.sortBtn, sort === o.key && s.sortBtnActive]} hitSlop={6}>
            <Text style={[s.sortText, sort === o.key && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <View style={[sh.card, s.empty]}>
          <Ionicons name="film-outline" size={28} color="#3F3F46" />
          <Text style={s.emptyTitle}>Nothing matches</Text>
          <Text style={s.emptySub}>Try a different filter{filtered ? ' or clear the current one.' : '.'}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {visible.map(item => (
            <Row key={item.key} item={item} onOpen={openItem} />
          ))}
          {rows.length > PAGE && (
            <Pressable
              onPress={() => setLimit(l => (l < rows.length ? l + MORE : PAGE))}
              style={s.showAll} hitSlop={6}
            >
              <Text style={s.showAllText}>
                {limit < rows.length ? `Show more (${rows.length - limit} left)` : 'Show less'}
              </Text>
              <Ionicons name={limit < rows.length ? 'chevron-down' : 'chevron-up'} size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  total: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 10,
    backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  bannerText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerClear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  bannerClearText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chips: { gap: 6, paddingBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)' },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipCount: { color: '#71717A', fontSize: 11, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sortLabel: { color: '#71717A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginRight: 4 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sortBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sortText: { color: '#71717A', fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row', gap: 12, padding: 10, backgroundColor: '#121212', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  poster: { width: 62, height: 92, borderRadius: 10, backgroundColor: '#1A1A1A' },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { color: '#A1A1AA', fontSize: 11, fontWeight: '600' },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4 },
  progText: { color: '#A1A1AA', fontSize: 10, fontWeight: '700' },
  foot: { color: '#71717A', fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptySub: { color: '#71717A', fontSize: 12, textAlign: 'center' },
  showAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  showAllText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
