import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useGuardedPush } from '../../components/navGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWatchlist } from '../../context/WatchlistContext';
import { WatchlistItem, WatchlistPriority } from '../../services/watchlistStore';
import AddToWatchlistSheet from '../../components/lists/AddToWatchlistSheet';
import { priorityOf, priorityMeta } from '../../components/lists/priority';
import WatchlistHeader from '../../components/watchlist/WatchlistHeader';
import OverviewCard from '../../components/watchlist/OverviewCard';
import UpNextCarousel from '../../components/watchlist/UpNextCarousel';
import WatchlistToolbar from '../../components/watchlist/WatchlistToolbar';
import WatchlistGridItem from '../../components/watchlist/WatchlistGridItem';
import WatchlistListItem from '../../components/watchlist/WatchlistListItem';
import { NoResults, WatchlistEmpty } from '../../components/watchlist/EmptyStates';
import { COLORS, SortKey, TypeFilter, ViewMode, itemKey } from '../../components/watchlist/utils';

const SCREEN_W = Dimensions.get('window').width;
const PAD = 20;
const GRID_GAP = 10;
const GRID_COLS = 3;
const GRID_ITEM_W = Math.floor((SCREEN_W - PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

const byAdded = (a: WatchlistItem, b: WatchlistItem) => (b.added_at || '').localeCompare(a.added_at || '');

function ListSeparator() { return <View style={{ height: 12 }} />; }

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();
  const { watchlist, loading, stats, updateItem } = useWatchlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedPriority, setSelectedPriority] = useState<WatchlistPriority | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('priority');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editing, setEditing] = useState<WatchlistItem | null>(null);

  const fade = useRef(new Animated.Value(1)).current;

  const genres = useMemo(() => {
    const m = new Map<string, number>();
    watchlist.forEach(i => i.genres.forEach(g => m.set(g, (m.get(g) ?? 0) + 1)));
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [watchlist]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = watchlist.filter(item => {
      const textMatch = !q || item.title.toLowerCase().includes(q) || item.genres.some(g => g.toLowerCase().includes(q));
      const genreMatch = !selectedGenre || item.genres.includes(selectedGenre);
      const priMatch = !selectedPriority || priorityOf(item) === selectedPriority;
      const typeMatch = typeFilter === 'all' || item.media_type === typeFilter;
      return textMatch && genreMatch && priMatch && typeMatch;
    });
    switch (sortBy) {
      case 'priority': {
        const rank = (i: WatchlistItem) => priorityMeta(priorityOf(i)).rank;
        return result.sort((a, b) => rank(a) - rank(b) || byAdded(a, b));
      }
      case 'rating': return result.sort((a, b) => b.vote_average - a.vote_average);
      case 'title': return result.sort((a, b) => a.title.localeCompare(b.title));
      case 'release': return result.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
      case 'added':
      default: return result.sort(byAdded);
    }
  }, [watchlist, searchQuery, selectedGenre, selectedPriority, typeFilter, sortBy]);

  const isFiltering = searchQuery.length > 0 || selectedGenre !== null || selectedPriority !== null || typeFilter !== 'all';

  const handlePress = useCallback((item: WatchlistItem) => {
    push({
      pathname: '/content/[id]',
      params: { id: item.id, media_type: item.media_type, from: 'watchlist' },
    });
  }, [push]);

  const handleLongPress = useCallback((item: WatchlistItem) => setEditing(item), []);

  const clearAll = useCallback(() => {
    setSearchQuery('');
    setSelectedGenre(null);
    setSelectedPriority(null);
    setTypeFilter('all');
  }, []);

  const toggleView = useCallback(() => {
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setViewMode(m => (m === 'grid' ? 'list' : 'grid'));
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [fade]);

  const goDiscover = useCallback(() => push('/(tabs)/search'), [push]);

  const renderGrid = useCallback(
    ({ item, index }: { item: WatchlistItem; index: number }) => (
      <WatchlistGridItem item={item} index={index} width={GRID_ITEM_W} onPress={handlePress} onLongPress={handleLongPress} />
    ),
    [handlePress, handleLongPress],
  );
  const renderList = useCallback(
    ({ item, index }: { item: WatchlistItem; index: number }) => (
      <WatchlistListItem item={item} index={index} onPress={handlePress} onLongPress={handleLongPress} />
    ),
    [handlePress, handleLongPress],
  );

  const header = useMemo(() => (
    <View style={{ marginBottom: 20 }}>
      <WatchlistHeader total={stats.total} viewMode={viewMode} onToggleView={toggleView} />
      {watchlist.length > 0 && (
        <>
          <OverviewCard items={watchlist} stats={stats} selectedPriority={selectedPriority} onSelectPriority={setSelectedPriority} />
          <UpNextCarousel items={watchlist} onPress={handlePress} onLongPress={handleLongPress} />
          <WatchlistToolbar
            searchQuery={searchQuery} onSearch={setSearchQuery}
            typeFilter={typeFilter} onType={setTypeFilter}
            priority={selectedPriority} onPriority={setSelectedPriority}
            genres={genres} genre={selectedGenre} onGenre={setSelectedGenre}
            sortBy={sortBy} onSort={setSortBy}
            isFiltering={isFiltering} shownCount={filtered.length} totalCount={watchlist.length}
            onClearAll={clearAll}
          />
        </>
      )}
    </View>
  ), [stats, viewMode, toggleView, watchlist, selectedPriority, handlePress, handleLongPress, searchQuery,
    typeFilter, genres, selectedGenre, sortBy, isFiltering, filtered.length, clearAll]);

  const empty = loading ? null : watchlist.length === 0
    ? <WatchlistEmpty onDiscover={goDiscover} />
    : <NoResults onClear={clearAll} />;

  const isGrid = viewMode === 'grid';

  return (
    <View style={s.root}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <FlatList
          key={isGrid ? 'grid' : 'list'}
          data={filtered}
          numColumns={isGrid ? GRID_COLS : 1}
          columnWrapperStyle={isGrid ? s.gridRow : undefined}
          keyExtractor={itemKey}
          renderItem={isGrid ? renderGrid : renderList}
          ItemSeparatorComponent={isGrid ? undefined : ListSeparator}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={9}
          windowSize={7}
          maxToRenderPerBatch={9}
          removeClippedSubviews
          contentContainerStyle={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 110,
            paddingHorizontal: PAD,
            flexGrow: 1,
          }}
        />
      </Animated.View>
      <AddToWatchlistSheet
        visible={!!editing}
        mode="edit"
        title={editing?.title ?? ''}
        subtitle="Edit priority and note"
        initialPriority={editing ? priorityOf(editing) : 'medium'}
        initialWhy={editing?.why_added ?? ''}
        onCancel={() => setEditing(null)}
        onConfirm={async (priority, why) => {
          if (editing) await updateItem(editing.id, editing.media_type, { priority, why_added: why });
          setEditing(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  gridRow: { gap: GRID_GAP, marginBottom: 16 },
});
