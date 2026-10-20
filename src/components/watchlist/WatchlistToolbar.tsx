import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistPriority } from '../../services/watchlistStore';
import { PRIORITIES } from '../lists/priority';
import { COLORS, SORT_OPTIONS, SortKey, TypeFilter } from './utils';

interface Props {
  searchQuery: string;
  onSearch: (q: string) => void;
  typeFilter: TypeFilter;
  onType: (t: TypeFilter) => void;
  priority: WatchlistPriority | null;
  onPriority: (p: WatchlistPriority | null) => void;
  genres: { name: string; count: number }[];
  genre: string | null;
  onGenre: (g: string | null) => void;
  sortBy: SortKey;
  onSort: (k: SortKey) => void;
  isFiltering: boolean;
  shownCount: number;
  totalCount: number;
  onClearAll: () => void;
}

const TYPES: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'Series' },
];
const GENRE_ROW_H = 44;

function Chip({ label, active, onPress, icon, dot, count }: {
  label: string; active?: boolean; onPress: () => void;
  icon?: string; dot?: string; count?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
      {icon ? <Ionicons name={icon as any} size={13} color={active ? COLORS.accent : COLORS.dim} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      {count !== undefined ? <Text style={[s.chipCount, active && s.chipTextActive]}>{count}</Text> : null}
    </Pressable>
  );
}

function WatchlistToolbar(p: Props) {
  const [open, setOpen] = useState(false);
  const h = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.parallel([
      Animated.timing(h, { toValue: open ? GENRE_ROW_H : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(fade, { toValue: open ? 1 : 0, duration: open ? 260 : 140, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [open, h, fade]);

  return (
    <View style={{ marginTop: 24 }}>
      <View style={s.search}>
        <Ionicons name="search" size={16} color={COLORS.dim} />
        <TextInput
          style={s.input}
          placeholder="Search by name or genre..."
          placeholderTextColor="#52525B"
          value={p.searchQuery}
          onChangeText={p.onSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {p.searchQuery.length > 0 && (
          <Pressable onPress={() => p.onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.dim} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow} keyboardShouldPersistTaps="handled">
        {TYPES.map(t => (
          <Chip key={t.key} label={t.label} active={p.typeFilter === t.key} onPress={() => p.onType(t.key)} />
        ))}
        <View style={s.divider} />
        {PRIORITIES.map(pr => (
          <Chip
            key={pr.key}
            label={pr.label}
            dot={pr.color}
            active={p.priority === pr.key}
            onPress={() => p.onPriority(p.priority === pr.key ? null : pr.key)}
          />
        ))}
        <View style={s.divider} />
        <Chip
          label={p.genre ? p.genre : 'Filters'}
          icon={open ? 'chevron-up' : 'options-outline'}
          active={open || !!p.genre}
          onPress={() => setOpen(o => !o)}
        />
      </ScrollView>

      <Animated.View style={{ height: h, overflow: 'hidden' }}>
        <Animated.View style={{ opacity: fade }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipRow, { paddingTop: 10 }]} keyboardShouldPersistTaps="handled">
            {p.genres.map(g => (
              <Chip
                key={g.name}
                label={g.name}
                count={g.count}
                active={p.genre === g.name}
                onPress={() => p.onGenre(p.genre === g.name ? null : g.name)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipRow, { alignItems: 'center' }]} keyboardShouldPersistTaps="handled">
        <Ionicons name="swap-vertical" size={14} color={COLORS.dim} style={{ marginRight: 2 }} />
        {SORT_OPTIONS.map(o => (
          <Pressable key={o.key} onPress={() => p.onSort(o.key)} style={[s.sort, p.sortBy === o.key && s.sortActive]}>
            <Text style={[s.sortText, p.sortBy === o.key && s.sortTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {p.isFiltering && (
        <View style={s.summary}>
          <Text style={s.summaryText}>Showing {p.shownCount} of {p.totalCount}</Text>
          <Pressable onPress={p.onClearAll} hitSlop={8}>
            <Text style={s.clear}>Clear all</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
export default React.memo(WatchlistToolbar);

const s = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '500', padding: 0 },
  chipRow: { gap: 8, paddingTop: 12, paddingRight: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)' },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: COLORS.text },
  chipCount: { color: COLORS.dim, fontSize: 10, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  divider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center' },
  sort: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  sortActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sortText: { color: COLORS.dim, fontSize: 12, fontWeight: '600' },
  sortTextActive: { color: COLORS.text },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  summaryText: { color: COLORS.muted, fontSize: 12, fontWeight: '500' },
  clear: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
});
