import React, { useState, useMemo } from 'react';
import {
  View, Text, Image, FlatList, Pressable, StyleSheet, Dimensions, Platform,
  TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWatchlist } from '../../context/WatchlistContext';
import { WatchlistItem } from '../../services/watchlistStore';

const { width } = Dimensions.get('window');
const IMG_W500 = 'https://image.tmdb.org/t/p/w342';

// ── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon as any} size={16} color="#10B981" style={{ marginBottom: 6 }} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Watchlist Item Card ────────────────────────────────
function WatchlistCard({ item, onPress }: { item: WatchlistItem; onPress: () => void }) {
  const posterUri = Platform.OS !== 'web' && item.local_poster_uri
    ? item.local_poster_uri
    : item.poster_path
      ? `${IMG_W500}${item.poster_path}`
      : null;

  const dateStr = item.release_date
    ? new Date(item.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const addedStr = new Date(item.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Poster */}
      <View style={s.cardPosterWrap}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={s.cardPoster} />
        ) : (
          <View style={[s.cardPoster, s.cardPosterFallback]}>
            <Ionicons name="film-outline" size={24} color="#52525B" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Text style={s.cardBadge}>{item.media_type === 'tv' ? 'Series' : 'Movie'}</Text>
          {dateStr ? <Text style={s.cardDate}>{dateStr}</Text> : null}
        </View>

        {/* Rating */}
        {item.vote_average > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Ionicons name="star" size={12} color="#10B981" />
            <Text style={s.cardRating}>{item.vote_average.toFixed(1)}</Text>
          </View>
        )}

        {/* Genres */}
        {item.genres.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {item.genres.slice(0, 3).map(g => (
              <Text key={g} style={s.cardGenre}>{g}</Text>
            ))}
          </View>
        )}

        {/* Added date */}
        <Text style={s.cardAdded}>Added {addedStr}</Text>
      </View>

      {/* Chevron */}
      <View style={{ justifyContent: 'center', paddingLeft: 4 }}>
        <Ionicons name="chevron-forward" size={16} color="#3F3F46" />
      </View>
    </Pressable>
  );
}

// ── Empty State ────────────────────────────────────────
function EmptyState({ onDiscover }: { onDiscover: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconCircle}>
        <Ionicons name="bookmark-outline" size={40} color="#3F3F46" />
      </View>
      <Text style={s.emptyTitle}>Your watchlist is empty</Text>
      <Text style={s.emptySubtitle}>
        Save movies and series you want to watch.{'\n'}They'll appear here for easy access.
      </Text>
      <Pressable style={s.emptyBtn} onPress={onDiscover}>
        <Ionicons name="search" size={16} color="#000" />
        <Text style={s.emptyBtnText}>Discover Content</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────
export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { watchlist, loading, stats } = useWatchlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'added' | 'rating' | 'title' | 'release'>('added');

  // Extract all unique genres from watchlist
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    watchlist.forEach(item => item.genres.forEach(g => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [watchlist]);

  // Filter watchlist by search query + genre
  const filteredWatchlist = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = watchlist.filter(item => {
      const nameMatch = !q || item.title.toLowerCase().includes(q);
      const genreTextMatch = !q || item.genres.some(g => g.toLowerCase().includes(q));
      const genreChipMatch = !selectedGenre || item.genres.includes(selectedGenre);
      return (nameMatch || genreTextMatch) && genreChipMatch;
    });

    // Sort
    switch (sortBy) {
      case 'rating':
        result = [...result].sort((a, b) => b.vote_average - a.vote_average);
        break;
      case 'title':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'release':
        result = [...result].sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
        break;
      case 'added':
      default:
        result = [...result].sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''));
        break;
    }

    return result;
  }, [watchlist, searchQuery, selectedGenre, sortBy]);

  const handlePress = (item: WatchlistItem) => {
    router.push({
      pathname: '/content/[id]',
      params: { id: item.id, media_type: item.media_type, from: 'watchlist' },
    } as any);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedGenre(null);
  };

  const isFiltering = searchQuery.length > 0 || selectedGenre !== null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={filteredWatchlist}
        keyExtractor={item => `${item.media_type}-${item.id}`}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 90,
          paddingHorizontal: 20,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            {/* Title */}
            <Text style={s.pageTitle}>Watchlist</Text>

            {/* Stats */}
            {watchlist.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <StatCard label="Total" value={stats.total} icon="layers-outline" />
                <StatCard label="Movies" value={stats.movies} icon="film-outline" />
                <StatCard label="Series" value={stats.series} icon="tv-outline" />
                <StatCard label="Hours" value={stats.hours > 0 ? `~${stats.hours}h` : '-'} icon="time-outline" />
              </View>
            )}

            {/* Search Bar */}
            {watchlist.length > 0 && (
              <View style={s.searchBar}>
                <Ionicons name="search" size={16} color="#52525B" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search by name or genre..."
                  placeholderTextColor="#3F3F46"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#52525B" />
                  </Pressable>
                )}
              </View>
            )}

            {/* Genre Chips */}
            {allGenres.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginTop: 12 }}
              >
                {selectedGenre && (
                  <Pressable
                    style={s.clearChip}
                    onPress={() => setSelectedGenre(null)}
                  >
                    <Ionicons name="close" size={12} color="#F87171" />
                    <Text style={s.clearChipText}>Clear</Text>
                  </Pressable>
                )}
                {allGenres.map(genre => {
                  const isActive = selectedGenre === genre;
                  const count = watchlist.filter(i => i.genres.includes(genre)).length;
                  return (
                    <Pressable
                      key={genre}
                      style={[s.genreFilterChip, isActive && s.genreFilterChipActive]}
                      onPress={() => setSelectedGenre(isActive ? null : genre)}
                    >
                      <Text style={[s.genreFilterText, isActive && s.genreFilterTextActive]}>
                        {genre}
                      </Text>
                      <View style={[s.genreFilterCount, isActive && s.genreFilterCountActive]}>
                        <Text style={[s.genreFilterCountText, isActive && s.genreFilterCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Sort Options */}
            {watchlist.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginTop: 12 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                  <Ionicons name="swap-vertical" size={13} color="#52525B" />
                </View>
                {([
                  { key: 'added' as const, label: 'Date Added' },
                  { key: 'rating' as const, label: 'Rating' },
                  { key: 'title' as const, label: 'Title' },
                  { key: 'release' as const, label: 'Release' },
                ]).map(opt => (
                  <Pressable
                    key={opt.key}
                    style={[s.genreFilterChip, sortBy === opt.key && s.genreFilterChipActive]}
                    onPress={() => setSortBy(opt.key)}
                  >
                    <Text style={[s.genreFilterText, sortBy === opt.key && s.genreFilterTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {/* Active filter indicator */}
            {isFiltering && filteredWatchlist.length > 0 && (
              <View style={s.filterInfo}>
                <Text style={s.filterInfoText}>
                  Showing {filteredWatchlist.length} of {watchlist.length} items
                </Text>
                <Pressable onPress={clearSearch}>
                  <Text style={s.filterClearText}>Clear all</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            watchlist.length === 0 ? (
              <EmptyState onDiscover={() => router.push('/(tabs)/search' as any)} />
            ) : (
              <View style={s.noResultsWrap}>
                <Ionicons name="search-outline" size={32} color="#3F3F46" />
                <Text style={s.noResultsTitle}>No matches found</Text>
                <Text style={s.noResultsSubtitle}>
                  Try a different search term or genre filter.
                </Text>
                <Pressable style={s.noResultsBtn} onPress={clearSearch}>
                  <Text style={s.noResultsBtnText}>Clear Filters</Text>
                </Pressable>
              </View>
            )
          )
        }
        renderItem={({ item }) => (
          <WatchlistCard item={item} onPress={() => handlePress(item)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  pageTitle: {
    color: '#fff', fontSize: 28, fontWeight: '800',
    letterSpacing: -0.8,
  },
  // Stats
  statCard: {
    flex: 1, backgroundColor: '#121212', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 12, alignItems: 'center',
  },
  statValue: {
    color: '#fff', fontSize: 18, fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    color: '#52525B', fontSize: 10, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2,
  },
  // Card
  card: {
    flexDirection: 'row', backgroundColor: '#121212',
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardPosterWrap: { marginRight: 14 },
  cardPoster: {
    width: 72, height: 108, borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  cardPosterFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: {
    color: '#fff', fontSize: 15, fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardBadge: {
    color: '#A1A1AA', fontSize: 11, fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  cardDate: { color: '#52525B', fontSize: 11, fontWeight: '500' },
  cardRating: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  cardGenre: {
    color: '#71717A', fontSize: 10, fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  cardAdded: {
    color: '#3F3F46', fontSize: 10, fontWeight: '500',
    marginTop: 6,
  },
  // Empty state
  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    letterSpacing: -0.3, marginBottom: 8,
  },
  emptySubtitle: {
    color: '#52525B', fontSize: 13, fontWeight: '500',
    textAlign: 'center', lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#10B981',
  },
  emptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#121212', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 16,
  },
  searchInput: {
    flex: 1, color: '#fff', fontSize: 14, fontWeight: '500',
    padding: 0,
  },
  // Genre filter chips
  genreFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  genreFilterChipActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  genreFilterText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  genreFilterTextActive: { color: '#10B981' },
  genreFilterCount: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6,
  },
  genreFilterCountActive: { backgroundColor: 'rgba(16,185,129,0.25)' },
  genreFilterCountText: { color: '#52525B', fontSize: 10, fontWeight: '700' },
  genreFilterCountTextActive: { color: '#10B981' },
  clearChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  clearChipText: { color: '#F87171', fontSize: 12, fontWeight: '600' },
  // Filter info
  filterInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 12,
  },
  filterInfoText: { color: '#52525B', fontSize: 12, fontWeight: '500' },
  filterClearText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  // No results
  noResultsWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  noResultsTitle: {
    color: '#E5E2E1', fontSize: 16, fontWeight: '700',
    marginTop: 12, marginBottom: 6,
  },
  noResultsSubtitle: {
    color: '#52525B', fontSize: 13, fontWeight: '500',
    textAlign: 'center',
  },
  noResultsBtn: {
    marginTop: 16, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  noResultsBtnText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
});
