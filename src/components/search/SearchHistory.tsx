import React, { memo, useCallback } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecentTitle } from './useSearchHistory';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';

interface Props {
  history: string[];
  recentTitles: RecentTitle[];
  onSelectQuery: (q: string) => void;
  onRemoveQuery: (q: string) => void;
  onClearAll: () => void;
  onOpenTitle: (t: RecentTitle) => void;
}

const titleKey = (t: RecentTitle) => `${t.media_type}-${t.id}`;

const TitleThumb = memo(function TitleThumb({ t, onOpen }: { t: RecentTitle; onOpen: (t: RecentTitle) => void }) {
  return (
    <Pressable style={styles.thumb} onPress={() => onOpen(t)}>
      {t.poster_path ? (
        <Image source={{ uri: `${TMDB_IMG}${t.poster_path}` }} style={styles.thumbImg} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbImg, styles.thumbEmpty]}>
          <Ionicons name="film-outline" size={20} color="#52525B" />
        </View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>{t.title}</Text>
    </Pressable>
  );
});

/** "Recent searches" rows and a "Recently viewed" poster row. */
function SearchHistory({ history, recentTitles, onSelectQuery, onRemoveQuery, onClearAll, onOpenTitle }: Props) {
  const renderTitle = useCallback(
    ({ item }: { item: RecentTitle }) => <TitleThumb t={item} onOpen={onOpenTitle} />,
    [onOpenTitle],
  );

  if (history.length === 0 && recentTitles.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {history.length > 0 && (
        <View style={styles.block}>
          <View style={styles.headerRow}>
            <Text style={styles.section}>Recent searches</Text>
            <Pressable onPress={onClearAll} hitSlop={8}>
              <Text style={styles.clear}>Clear all</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {history.map(q => (
              <View key={q} style={styles.chip}>
                <Pressable style={styles.chipMain} onPress={() => onSelectQuery(q)}>
                  <Ionicons name="time-outline" size={14} color="#71717A" />
                  <Text style={styles.chipText} numberOfLines={1}>{q}</Text>
                </Pressable>
                <Pressable onPress={() => onRemoveQuery(q)} hitSlop={8} style={styles.chipX} accessibilityLabel={`Remove ${q}`}>
                  <Ionicons name="close" size={14} color="#71717A" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {recentTitles.length > 0 && (
        <View style={styles.block}>
          <Text style={[styles.section, styles.sectionPad]}>Recently viewed</Text>
          <FlatList
            horizontal
            data={recentTitles}
            keyExtractor={titleKey}
            renderItem={renderTitle}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}

export default memo(SearchHistory);

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  block: { marginBottom: 22 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  section: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  sectionPad: { paddingHorizontal: 20, marginBottom: 12 },
  clear: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', maxWidth: '100%',
    backgroundColor: '#121212', borderRadius: 9999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingVertical: 8, flexShrink: 1 },
  chipText: { color: '#D4D4D8', fontSize: 13, fontWeight: '500', flexShrink: 1 },
  chipX: { paddingHorizontal: 10, paddingVertical: 8 },
  thumbList: { paddingHorizontal: 20, gap: 12 },
  thumb: { width: 82 },
  thumbImg: {
    width: 82, height: 123, borderRadius: 12, backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbTitle: { color: '#A1A1AA', fontSize: 11, fontWeight: '600', marginTop: 6 },
});
