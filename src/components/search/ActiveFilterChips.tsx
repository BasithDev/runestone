import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { GenreOption } from './useGenres';
import { SORTS, SearchFilters, languageLabel } from './types';

interface Props {
  filters: SearchFilters;
  year: number | null;
  genres: GenreOption[];
  onChange: (next: SearchFilters) => void;
  onClearYear: () => void;
  onClearAll: () => void;
}

interface Entry { key: string; label: string; remove: () => void }

/** Removable chips for every active filter, shown under the search bar. */
function ActiveFilterChips({ filters, year, genres, onChange, onClearYear, onClearAll }: Props) {
  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const id of filters.genres) {
      const name = genres.find(g => g.id === id)?.name ?? `Genre ${id}`;
      out.push({ key: `g${id}`, label: name, remove: () => onChange({ ...filters, genres: filters.genres.filter(g => g !== id) }) });
    }
    if (filters.language) out.push({ key: 'lang', label: languageLabel(filters.language), remove: () => onChange({ ...filters, language: null }) });
    if (filters.minRating) out.push({ key: 'rating', label: `${filters.minRating}+ rating`, remove: () => onChange({ ...filters, minRating: null }) });
    if (filters.sort !== 'relevance') {
      out.push({ key: 'sort', label: `Sort: ${SORTS.find(s => s.key === filters.sort)?.label}`, remove: () => onChange({ ...filters, sort: 'relevance' }) });
    }
    if (year != null) out.push({ key: 'year', label: String(year), remove: onClearYear });
    return out;
  }, [filters, year, genres, onChange, onClearYear]);

  if (entries.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {entries.map(e => (
        <Pressable key={e.key} style={styles.chip} onPress={e.remove} accessibilityLabel={`Remove filter ${e.label}`}>
          <Text style={styles.text}>{e.label}</Text>
          <Ionicons name="close" size={13} color="#10B981" />
        </Pressable>
      ))}
      {entries.length > 1 && (
        <Pressable onPress={onClearAll} style={styles.clear}>
          <Text style={styles.clearText}>Clear all</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

export default memo(ActiveFilterChips);

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: 20, paddingBottom: 8, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  text: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  clear: { paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
});
