import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, FlatList, Pressable,
  ActivityIndicator, StyleSheet, Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { parseLocalDate } from '../types';

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';
const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 52) / 2;
const CARD_H = CARD_W * 1.5;

export default function UpcomingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const fetchUpcoming = async (pageNum: number, append = false) => {
    const key = process.env.EXPO_PUBLIC_TMDB_API_KEY;
    if (!key) { setError(true); setLoading(false); return; }

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/upcoming?api_key=${key}&language=en-US&page=${pageNum}`
      );
      const json = await res.json();

      if (json.results) {
        const todayStr = new Date().toISOString().split('T')[0];
        const filtered = json.results
          .filter((i: MediaItem) => i.poster_path && i.release_date && i.release_date > todayStr)
          .sort((a: MediaItem, b: MediaItem) => {
            const da = a.release_date ? new Date(a.release_date).getTime() : Infinity;
            const db = b.release_date ? new Date(b.release_date).getTime() : Infinity;
            return da - db;
          });

        setMovies(prev => {
          // TMDb pages can overlap, so dedupe by id
          const merged: MediaItem[] = append ? [...prev, ...filtered] : filtered;
          const combined = Array.from(new Map(merged.map(m => [m.id, m])).values());
          // Re-sort the full list to maintain order across pages
          return combined.sort((a: MediaItem, b: MediaItem) => {
            const da = a.release_date ? new Date(a.release_date).getTime() : Infinity;
            const db = b.release_date ? new Date(b.release_date).getTime() : Infinity;
            return da - db;
          });
        });
        setTotalPages(json.total_pages || 1);
        setPage(pageNum);
      }
    } catch {
      if (!append) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchUpcoming(1); }, []);

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    fetchUpcoming(page + 1, true);
  };

  const renderItem = ({ item }: { item: MediaItem }) => {
    const title = item.title || item.name || '';
    const date = item.release_date || item.first_air_date || '';
    const formatted = date
      ? parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return (
      <Pressable
        style={st.card}
        onPress={() =>
          router.push({ pathname: '/content/[id]', params: { id: item.id, media_type: 'movie' } } as any)
        }
      >
        <Image
          source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          locations={[0.5, 1]}
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 12 }]}
        >
          <Text style={st.cardTitle} numberOfLines={2}>{title}</Text>
          {formatted ? (
            <View style={st.dateRow}>
              <Ionicons name="calendar-outline" size={10} color="#10B981" />
              <Text style={st.dateText}>{formatted}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Text style={st.headerTitle}>Upcoming & Anticipated</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="cloud-offline-outline" size={40} color="#52525B" />
          <Text style={{ color: '#E5E2E1', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
            Failed to load
          </Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.4,
  },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.3,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
  },
  dateText: {
    color: '#10B981', fontSize: 11, fontWeight: '600',
  },
});
