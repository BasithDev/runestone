import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ScrollView,
  Text,
  View,
  Image,
  FlatList,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWatching } from '../../context/WatchingContext';
import AlertsBellButton from '../../components/alerts/AlertsBellButton';
import StatusPill from '../../components/tracking/StatusPill';
import { parseLocalDate, WatchingItem } from '../../types';
import { tmdbGet, REGION } from '../../services/tmdb';
import { getProgress, localDateKey } from '../../services/watchingStore';

// ── Types ──────────────────────────────────────────────
interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv';
}

// ── Constants ──────────────────────────────────────────
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const CARD_W = 150;
const CARD_H = 220;
const CARD_GAP = 12;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Skeleton card ──────────────────────────────────────
function Skeleton({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <Animated.View
      className="rounded-2xl overflow-hidden bg-surface-light border border-white/5"
      style={{ width: CARD_W, height: CARD_H, opacity: shimmer, marginRight: CARD_GAP }}
    />
  );
}

// ── Poster card ────────────────────────────────────────
function PosterCard({ item }: { item: MediaItem }) {
  const router = useRouter();
  const title = item.title || item.name || '';
  const date = item.release_date || item.first_air_date || '';
  const month = date ? parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

  return (
    <Pressable
      style={{ marginRight: CARD_GAP }}
      onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id, media_type: mediaType } } as any)}
    >
      <View
        className="rounded-2xl overflow-hidden bg-surface-light border border-white/5"
        style={{ width: CARD_W, height: CARD_H }}
      >
        <Image
          source={{ uri: `${TMDB_IMG}${item.poster_path}` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          locations={[0.45, 1]}
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 12 }]}
        >
          <Text className="text-white text-[13px] font-bold mb-1" numberOfLines={1}>{title}</Text>
          {month ? (
            <View className="flex-row items-center py-0.5 rounded-full gap-1">
              <Text className="text-zinc-300 text-[10px] font-bold">{month}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
}


const quickStyles = StyleSheet.create({
  plus: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
  },
  finish: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, height: 26, borderRadius: 13, backgroundColor: '#10B981',
  },
  finishText: { color: '#000', fontSize: 10, fontWeight: '800' },
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [upcoming, setUpcoming] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { lifetimeStats, currentStreak, watchingItems, advance } = useWatching();

  // Compute real insights from watching context
  const insights = useMemo(() => {
    const totalHours = lifetimeStats.totalHours;
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const timeStr = totalHours > 0 ? `${days}d ${hours}h` : '0h';

    return [
      { label: 'Total Time', value: timeStr, icon: 'time-outline' as const, color: '#10B981' },
      { label: 'Movies', value: String(lifetimeStats.movies), icon: 'film-outline' as const, color: '#10B981' },
      { label: 'Series', value: String(lifetimeStats.series + lifetimeStats.anime), icon: 'tv-outline' as const, color: '#10B981' },
      { label: 'Streak', value: currentStreak > 0 ? `${currentStreak} days` : '0 days', icon: 'flame' as const, color: '#10B981' },
    ];
  }, [lifetimeStats, currentStreak]);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const shimmer = useRef(new Animated.Value(0.25)).current;

  // ── Shimmer pulse ────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  // ── Fetch TMDb upcoming ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Fetch pages 1 and 2 (India region) to get a wider selection of unreleased movies
        const [json1, json2] = await Promise.all([
          tmdbGet<{ results?: MediaItem[] }>('movie/upcoming', { region: REGION, page: 1 }),
          tmdbGet<{ results?: MediaItem[] }>('movie/upcoming', { region: REGION, page: 2 }),
        ]);

        const allResults = [...(json1.results || []), ...(json2.results || [])];

        if (allResults.length) {
          const todayStr = localDateKey();
          
          // Filter strictly for future releases (unreleased)
          const strictlyUpcoming = allResults.filter((i: MediaItem) => {
            return i.poster_path && i.release_date && i.release_date > todayStr;
          });

          // Deduplicate by ID
          const uniqueUpcoming = Array.from(new Map(strictlyUpcoming.map(item => [item.id, item])).values());

          // Sort by nearest release date (ascending)
          uniqueUpcoming.sort((a, b) => {
            const dateA = a.release_date ? new Date(a.release_date).getTime() : Infinity;
            const dateB = b.release_date ? new Date(b.release_date).getTime() : Infinity;
            return dateA - dateB;
          });

          setUpcoming(uniqueUpcoming.slice(0, 10));
        } else {
          setError(true);
        }
      } catch { setError(true); }
      finally {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      }
    })();
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 85 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────── */}
      <View className="flex-row items-center justify-center px-5 mb-5">
        <Text className="text-emerald-500 text-2xl font-extrabold tracking-[5px]">RUNESTONE</Text>
        <View style={{ position: 'absolute', right: 20 }}>
          <AlertsBellButton />
        </View>
      </View>

      {/* ── Insights Stats (2×2 Grid) ────────────── */}
      <View className="px-5 mb-6">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {insights.map((stat) => (
            <View
              key={stat.label}
              style={{
                width: (SCREEN_WIDTH - 40 - 10) / 2,
                backgroundColor: '#141414',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name={stat.icon} size={14} color={stat.color} />
                <Text style={{ color: '#71717A', fontSize: 12, fontWeight: '500' }}>{stat.label}</Text>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Upcoming & Anticipated ───────────────────── */}
      <View className="mb-7">
        <View className="flex-row justify-between items-center px-5 mb-3.5">
          <Text className="text-white text-lg font-bold -tracking-tight">Upcoming & Anticipated</Text>
          <Pressable onPress={() => router.push('/upcoming' as any)}>
            <Text className="text-emerald-500 text-xs font-semibold">See All</Text>
          </Pressable>
        </View>

        {loading ? (
          <FlatList
            data={[1, 2, 3]}
            keyExtractor={(i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            renderItem={() => <Skeleton shimmer={shimmer} />}
          />
        ) : error ? (
          <View className="mx-5 bg-surface rounded-2xl border border-white/5 p-7 items-center">
            <Ionicons name="cloud-offline-outline" size={28} color="#52525B" />
            <Text className="text-zinc-200 text-sm font-semibold mt-2.5">Unable to load content</Text>
            <Text className="text-zinc-600 text-xs mt-1">Check your connection or API key.</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
            <FlatList
              data={upcoming}
              keyExtractor={(i) => String(i.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              snapToInterval={CARD_W + CARD_GAP}
              decelerationRate="fast"
              renderItem={({ item }) => <PosterCard item={item} />}
              ListFooterComponent={
                <Pressable style={{ marginRight: CARD_GAP }} onPress={() => router.push('/upcoming' as any)}>
                  <View
                    className="rounded-2xl overflow-hidden border border-dashed items-center justify-center"
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      borderColor: 'rgba(16,185,129,0.25)',
                      backgroundColor: 'rgba(16,185,129,0.04)',
                    }}
                  >
                    <View className="w-11 h-11 rounded-full bg-emerald-500/10 items-center justify-center mb-2.5">
                      <Ionicons name="arrow-forward" size={22} color="#10B981" />
                    </View>
                    <Text className="text-emerald-500 text-[13px] font-bold tracking-wide">View All</Text>
                  </View>
                </Pressable>
              }
            />
          </Animated.View>
        )}
      </View>

      {/* ── Currently Watching ─────────────────────── */}
      <View className="px-5">
        <View className="flex-row justify-between items-center px-5 mb-3.5">
          <Text className="text-white text-lg font-bold -tracking-tight">Currently Watching</Text>
          {watchingItems.length > 0 && (
            <Pressable onPress={() => router.navigate('/(tabs)/watching' as any)}>
              <Text className="text-emerald-500 text-xs font-semibold">See All</Text>
            </Pressable>
          )}
        </View>

        {watchingItems.length > 0 ? (
          <FlatList
            data={watchingItems.slice(0, 5)}
            keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMovie = item.mediaType === 'movie';
              const { percent: percentage, watched, total } = getProgress(item);
              const atEnd = !isMovie && total > 0 && watched >= total;
              const openProgress = () => router.push({ pathname: '/watching-progress/[id]', params: { id: item.tmdbId, media_type: item.mediaType } } as any);
              return (
                <Pressable
                  style={{ marginRight: CARD_GAP }}
                  onPress={openProgress}
                >
                  <View
                    className="rounded-2xl overflow-hidden bg-surface-light border border-white/5"
                    style={{ width: CARD_W, height: CARD_H }}
                  >
                    <Image
                      source={{ uri: item.posterUrl || undefined }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.9)']}
                      locations={[0.4, 1]}
                      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 10 }]}
                    >
                      <Text className="text-white text-[12px] font-bold mb-1" numberOfLines={1}>{item.title}</Text>
                      {/* Progress bar */}
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 2 }}>
                        <View style={{ height: '100%', borderRadius: 2, backgroundColor: '#10B981', width: `${percentage}%` }} />
                      </View>
                      <Text style={{ color: '#71717A', fontSize: 9, fontWeight: '700', marginTop: 3 }}>
                        {isMovie
                          ? (item.movieCompleted ? 'Completed' : 'In Progress')
                          : `S${item.currentSeason} E${item.currentEpisode} • ${percentage}%`}
                      </Text>
                    </LinearGradient>
                    <StatusPill status={item.status} solid style={{ position: 'absolute', top: 8, left: 8 }} />
                    {!isMovie && (
                      atEnd ? (
                        <Pressable onPress={openProgress} hitSlop={6} style={quickStyles.finish}>
                          <Ionicons name="checkmark-done" size={12} color="#000" />
                          <Text style={quickStyles.finishText}>Finish</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => { advance(item.tmdbId, item.mediaType); }} hitSlop={6} style={quickStyles.plus}>
                          <Ionicons name="add" size={18} color="#000" />
                        </Pressable>
                      )
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : (
          <View className="bg-surface rounded-3xl border border-white/5 p-7 items-center">
            <View className="w-14 h-14 rounded-full bg-emerald-500/10 items-center justify-center mb-4">
              <Ionicons name="film-outline" size={28} color="#10B981" />
            </View>
            <Text className="text-zinc-200 text-base font-bold mb-1.5">No Active Screenings</Text>
            <Text className="text-zinc-500 text-[13px] text-center leading-5 px-2.5">
              Start exploring trending titles or search to begin tracking your watchlist.
            </Text>
            <Pressable
              onPress={() => router.replace('/search' as any)}
              className="flex-row items-center justify-center bg-emerald-500 rounded-xl py-3.5 px-5 mt-5 w-full gap-1.5"
            >
              <Ionicons name="search" size={15} color="#000" />
              <Text className="text-black text-sm font-bold">Discover Content</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
