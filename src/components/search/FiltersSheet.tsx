import React, { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GenreOption } from './useGenres';
import { DEFAULT_FILTERS, LANGUAGES, RATINGS, SORTS, SearchFilters } from './types';

const { height: SH } = Dimensions.get('window');
const MIN_YEAR = 1950;

interface Props {
  visible: boolean;
  filters: SearchFilters;
  year: number | null;
  genres: GenreOption[];
  genresLoading: boolean;
  genresError: boolean;
  onRetryGenres: () => void;
  onApply: (filters: SearchFilters, year: number | null) => void;
  onClose: () => void;
}

interface ChipProps { label: string; active: boolean; onPress: () => void }

const OptionChip = memo(function OptionChip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Bottom sheet with genre, language, rating, sort and year filters. Applied on "Show results". */
function FiltersSheet({ visible, filters, year, genres, genresLoading, genresError, onRetryGenres, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [draftYear, setDraftYear] = useState<number | null>(year);

  useEffect(() => {
    if (visible) { setDraft(filters); setDraftYear(year); }
    // Only re-seed when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const years = useMemo(() => {
    const max = new Date().getFullYear() + 1;
    return Array.from({ length: max - MIN_YEAR + 1 }, (_, i) => max - i);
  }, []);

  const toggleGenre = (id: number) =>
    setDraft(d => ({ ...d, genres: d.genres.includes(id) ? d.genres.filter(g => g !== id) : [...d.genres, id] }));

  const reset = () => { setDraft(DEFAULT_FILTERS); setDraftYear(null); };
  const apply = () => { onApply(draft, draftYear); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: SH * 0.6 }} showsVerticalScrollIndicator={false}>
            <Section title="Genre">
              {genresLoading && genres.length === 0 ? (
                <ActivityIndicator color="#10B981" style={{ alignSelf: 'flex-start' }} />
              ) : genresError && genres.length === 0 ? (
                <Pressable onPress={onRetryGenres}>
                  <Text style={styles.errorText}>Couldn't load genres. Tap to retry.</Text>
                </Pressable>
              ) : (
                <View style={styles.wrapRow}>
                  {genres.map(g => (
                    <OptionChip key={g.id} label={g.name} active={draft.genres.includes(g.id)} onPress={() => toggleGenre(g.id)} />
                  ))}
                </View>
              )}
            </Section>

            <Section title="Original language">
              <View style={styles.wrapRow}>
                {LANGUAGES.map(l => (
                  <OptionChip key={l.label} label={l.label} active={draft.language === l.code} onPress={() => setDraft(d => ({ ...d, language: l.code }))} />
                ))}
              </View>
            </Section>

            <Section title="Minimum rating">
              <View style={styles.wrapRow}>
                {RATINGS.map(r => (
                  <OptionChip key={r.label} label={r.label} active={draft.minRating === r.value} onPress={() => setDraft(d => ({ ...d, minRating: r.value }))} />
                ))}
              </View>
            </Section>

            <Section title="Sort by">
              <View style={styles.wrapRow}>
                {SORTS.map(s => (
                  <OptionChip key={s.key} label={s.label} active={draft.sort === s.key} onPress={() => setDraft(d => ({ ...d, sort: s.key }))} />
                ))}
              </View>
            </Section>

            <Section title="Release year">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
                <OptionChip label="Any" active={draftYear === null} onPress={() => setDraftYear(null)} />
                {years.map(y => (
                  <OptionChip key={y} label={String(y)} active={draftYear === y} onPress={() => setDraftYear(y)} />
                ))}
              </ScrollView>
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={apply}>
              <Text style={styles.applyText}>Show results</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default memo(FiltersSheet);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3F3F46', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  section: { marginTop: 16 },
  sectionTitle: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)' },
  chipText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#10B981' },
  errorText: { color: '#F87171', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 20 },
  resetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  resetText: { color: '#E5E2E1', fontSize: 15, fontWeight: '700' },
  applyBtn: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#10B981' },
  applyText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
