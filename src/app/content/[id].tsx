import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, Pressable,
  ActivityIndicator, FlatList, Dimensions, StyleSheet, Linking,
  Animated, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatchlist } from '../../context/WatchlistContext';
import { useWatching } from '../../context/WatchingContext';
import { detectContentType, parseLocalDate, SeasonBreakdown, WatchingStatus, WATCHING_STATUS_LABELS } from '../../types';
import { tmdbGet, REGION } from '../../services/tmdb';
import { WatchlistPriority } from '../../services/watchlistStore';
import { AddToWatchlistSheet, UpcomingToggleButton } from '../../components/lists';
import OttInfoCard from '../../components/alerts/OttInfoCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { PirataOne_400Regular } from '@expo-google-fonts/pirata-one';
import { getSpecialTheme, SpecialThemeContext, useSpecialTheme } from '../../components/special/specialThemes';
import BountyPoster from '../../components/special/BountyPoster';
import SpinningEmblem from '../../components/special/SpinningEmblem';

const IMG_W500 = 'https://image.tmdb.org/t/p/w500';
const IMG_W780 = 'https://image.tmdb.org/t/p/w780';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';
const { width: SW } = Dimensions.get('window');

// ── Helpers ───────────────────────────────────────────
function fmt$(n: number) {
  if (!n) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}
function fmtVotes(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function fmtRuntime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Types ─────────────────────────────────────────────
interface CastMember { id: number; name: string; character: string; profile_path: string | null; }
interface CrewMember { id: number; name: string; job: string; profile_path: string | null; }
interface Company { id: number; name: string; logo_path: string | null; }
interface Provider { provider_id: number; provider_name: string; logo_path: string; }
interface SimilarItem { id: number; title?: string; name?: string; poster_path: string | null; vote_average: number; media_type?: string; }
interface CollectionPart { id: number; title: string; poster_path: string | null; release_date: string; }
interface Details {
  id: number;
  title?: string; name?: string;
  poster_path: string | null; backdrop_path: string | null;
  vote_average: number; vote_count: number;
  release_date?: string; first_air_date?: string;
  runtime?: number; episode_run_time?: number[];
  number_of_seasons?: number; number_of_episodes?: number;
  status?: string;
  created_by?: { id: number; name: string }[];
  genres?: { id: number; name: string }[];
  overview?: string;
  budget?: number; revenue?: number;
  belongs_to_collection?: { id: number; name: string } | null;
  production_companies?: Company[];
  credits?: { cast: CastMember[]; crew: CrewMember[] };
  'watch/providers'?: { results?: Record<string, { flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[] }> };
  similar?: { results: SimilarItem[] };
  recommendations?: { results: SimilarItem[] };
}
interface Collection { parts: CollectionPart[]; name: string; }
interface SeasonInfo { season_number: number; name: string; episode_count: number; air_date: string | null; }

// ── Sub-components ─────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const theme = useSpecialTheme();
  if (!theme) return <Text style={s.sectionHeader}>{title}</Text>;
  const fontReady = Font.isLoaded(theme.displayFont);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <MaterialCommunityIcons name={theme.sectionIcon} size={16} color={theme.secondary} />
      <Text
        style={[
          s.sectionHeader,
          { marginBottom: 0, color: theme.accent },
          fontReady && { fontFamily: theme.displayFont, fontWeight: 'normal', fontSize: 21, letterSpacing: 0.5 },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

function GenreChip({ label }: { label: string }) {
  const theme = useSpecialTheme();
  return (
    <View style={[s.genreChip, theme && { backgroundColor: theme.secondary + '22', borderColor: theme.secondary + '66' }]}>
      <Text style={[s.genreChipText, theme && { color: '#F5E6C8' }]}>{label}</Text>
    </View>
  );
}

function CastCard({ item, onPress }: { item: CastMember; onPress?: () => void }) {
  return (
    <Pressable style={s.castCard} onPress={onPress}>
      <View style={s.castAvatarWrap}>
        {item.profile_path ? (
          <Image source={{ uri: `${IMG_W500}${item.profile_path}` }} style={s.castAvatar} />
        ) : (
          <View style={[s.castAvatar, s.castAvatarFallback]}>
            <Ionicons name="person" size={22} color="#52525B" />
          </View>
        )}
      </View>
      <Text style={s.castName} numberOfLines={2}>{item.name}</Text>
      <Text style={s.castChar} numberOfLines={1}>{item.character}</Text>
    </Pressable>
  );
}

function PosterCard({ item, onPress }: { item: SimilarItem | CollectionPart; onPress: () => void }) {
  const title = (item as any).title || (item as any).name || '';
  return (
    <Pressable onPress={onPress} style={s.miniCard}>
      {(item as any).poster_path ? (
        <Image source={{ uri: `${IMG_W500}${(item as any).poster_path}` }} style={s.miniPoster} resizeMode="cover" />
      ) : (
        <View style={[s.miniPoster, s.miniPosterFallback]}>
          <Ionicons name="film-outline" size={24} color="#52525B" />
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.miniCardInfo}>
        <Text style={s.miniCardTitle} numberOfLines={2}>{title}</Text>
        {(item as any).vote_average > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <Ionicons name="star" size={9} color="#10B981" />
            <Text style={s.miniRating}>{(item as any).vote_average.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ProviderLogo({ p }: { p: Provider }) {
  return (
    <View style={s.providerWrap}>
      <Image source={{ uri: `${IMG_W500}${p.logo_path}` }} style={s.providerLogo} />
      <Text style={s.providerName} numberOfLines={1}>{p.provider_name}</Text>
    </View>
  );
}

// ── Watch status display ──────────────────────────────
type StatusStyle = { icon: string; color: string; bg: string; border: string };
const mkStyle = (icon: string, c: string, rgb: string): StatusStyle =>
  ({ icon, color: c, bg: `rgba(${rgb},0.12)`, border: `rgba(${rgb},0.25)` });
const NOT_TRACKED_STYLE: StatusStyle = {
  icon: 'eye-off-outline', color: '#71717A', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
};
const WATCHED_STYLE = mkStyle('checkmark-circle', '#3B82F6', '59,130,246');
const TRACKED_STYLES: Record<WatchingStatus, StatusStyle> = {
  watching: mkStyle('play-circle', '#10B981', '16,185,129'),
  rewatching: mkStyle('repeat', '#A855F7', '168,85,247'),
  completed: WATCHED_STYLE,
  caught_up: mkStyle('time', '#F59E0B', '245,158,11'),
  on_hold: mkStyle('pause-circle', '#F59E0B', '245,158,11'),
  dropped: mkStyle('close-circle', '#F87171', '248,113,113'),
};

// ── Main Screen ────────────────────────────────────────
export default function ContentDetailsScreen() {
  const { id, media_type, from } = useLocalSearchParams<{ id: string; media_type: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const type = (media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
  const isFromWatchlist = from === 'watchlist';

  // Hand-picked titles get a premium themed page (see components/special).
  const theme = getSpecialTheme(type, Number(id));
  const [fontLoaded] = Font.useFonts(theme ? { PirataOne_400Regular } : {});
  const fontReady = !!theme && fontLoaded;
  const pageBg = theme?.background ?? '#000';

  const [details, setDetails] = useState<Details | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [seasonDetails, setSeasonDetails] = useState<SeasonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { isInWatchlist, addItem, removeItem } = useWatchlist();
  const { startWatching, getItem, getHistoryEntries } = useWatching();
  const inWatchlist = details ? isInWatchlist(details.id, type) : false;

  // Animation for watch status
  const statusOpacity = useRef(new Animated.Value(1)).current;

  // Status: watching list (its status) -> history (watched) -> not watched
  const trackedItem = getItem(Number(id), type);
  const historyCount = getHistoryEntries(Number(id), type).length;

  const handleStatusPress = () => {
    if (!details) return;
    if (trackedItem) {
      router.push({ pathname: '/watching-progress/[id]', params: { id: details.id, media_type: type } } as any);
      return;
    }

    Animated.timing(statusOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(async () => {
      const contentType = detectContentType(type, undefined, details.genres);
      const seasonEpisodes: SeasonBreakdown[] = seasonDetails.map(s => ({
        season: s.season_number,
        episodes: s.episode_count,
        title: s.name,
      }));
      const directors = type === 'movie'
        ? (details.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name)
        : (details.created_by || []).map(c => c.name);

      // The store flips this to 'rewatching' when the title is already in history
      await startWatching({
        id: Date.now(),
        tmdbId: details.id,
        mediaType: type,
        contentType,
        title: details.title || details.name || '',
        posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : null,
        year: (details.release_date || details.first_air_date || '').split('-')[0] || '',
        status: 'watching',
        currentSeason: type === 'tv' ? 1 : undefined,
        currentEpisode: type === 'tv' ? 1 : undefined,
        totalSeasons: details.number_of_seasons || undefined,
        totalEpisodes: details.number_of_episodes || undefined,
        episodesWatched: 0,
        seasonEpisodes: seasonEpisodes.length > 0 ? seasonEpisodes : undefined,
        movieCompleted: false,
        genres: (details.genres || []).map(g => g.name),
        rating: details.vote_average || 0,
        runtime: details.runtime || null,
        episodeRuntime: details.episode_run_time?.[0] || null,
        directors: directors.length > 0 ? directors : undefined,
        showStatus: type === 'tv' ? details.status : undefined,
      });

      // Remove from watchlist if present
      if (inWatchlist) removeItem(details.id, type);

      Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleAddToWatchlist = async (priority: WatchlistPriority, whyAdded: string) => {
    if (!details) return;
    await addItem({
      priority,
      why_added: whyAdded.trim() || undefined,
      id: details.id,
      media_type: type,
      title: details.title || details.name || '',
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      vote_average: details.vote_average,
      vote_count: details.vote_count,
      runtime: details.runtime || null,
      episode_count: details.number_of_episodes || null,
      episode_runtime: details.episode_run_time?.[0] || (details as any).last_episode_to_air?.runtime || null,
      genres: (details.genres || []).map(g => g.name),
      release_date: details.release_date || details.first_air_date || '',
      overview: details.overview || '',
    });
    setShowModal(false);
  };

  const handleRemoveFromWatchlist = async () => {
    if (!details) return;
    await removeItem(details.id, type);
  };

  const navigateToPerson = (personId: number, name: string) => {
    router.push({ pathname: '/search', params: { person_id: personId, person_name: name } } as any);
  };

  const navigateToCompany = (companyId: number, name: string) => {
    router.push({ pathname: '/search', params: { company_id: companyId, company_name: name } } as any);
  };

  // ── Fetch ─────────────────────────────────────────
  const fetchDetails = useCallback(async () => {
    if (!id) { setError(true); setLoading(false); return; }
    try {
      const json = await tmdbGet<Details>(`${type}/${id}`, {
        append_to_response: 'credits,watch/providers,similar,recommendations',
      });
      setDetails(json);

      // Fetch collection if movie belongs to one
      if (type === 'movie' && json.belongs_to_collection?.id) {
        const colJson = await tmdbGet<Collection>(`collection/${json.belongs_to_collection.id}`).catch(() => null);
        if (colJson && colJson.parts?.length > 1) setCollection(colJson);
      }

      // Fetch per-season episode info for TV
      if (type === 'tv' && json.number_of_seasons) {
        const seasonResults = await Promise.all(
          Array.from({ length: json.number_of_seasons }, (_, i) =>
            tmdbGet<any>(`tv/${id}/season/${i + 1}`).catch(() => null)
          )
        );
        const seasons: SeasonInfo[] = seasonResults
          .filter(Boolean)
          .map((sr: any) => ({
            season_number: sr.season_number,
            name: sr.name,
            episode_count: sr.episodes?.length ?? 0,
            air_date: sr.air_date,
          }));
        setSeasonDetails(seasons);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const navigateToContent = (itemId: number, mediaType: string) => {
    router.push({ pathname: '/content/[id]', params: { id: itemId, media_type: mediaType } } as any);
  };

  // ── Loading ───────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme?.accent ?? '#10B981'} />
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────
  if (error || !details) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <Ionicons name="cloud-offline-outline" size={40} color="#52525B" />
        <Text style={{ color: '#E5E2E1', fontSize: 16, fontWeight: '700', marginTop: 16 }}>Failed to load</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: '#10B981', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Data extraction ────────────────────────────────
  const title = details.title || details.name || '';
  const year = (details.release_date || details.first_air_date || '').slice(0, 4);
  const rawDate = details.release_date || details.first_air_date || '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isUnreleased = !rawDate || parseLocalDate(rawDate).getTime() > today.getTime();
  const releaseDate = rawDate
    ? parseLocalDate(rawDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const runtime = type === 'movie'
    ? (details.runtime ? fmtRuntime(details.runtime) : null)
    : (details.episode_run_time?.[0] ? `~${details.episode_run_time[0]}m/ep` : null);
  const rating = details.vote_average;
  const voteCount = details.vote_count;
  const genres = details.genres || [];
  const overview = details.overview || '';
  const cast = details.credits?.cast?.slice(0, 15) || [];
  const directors = details.credits?.crew?.filter(c => c.job === 'Director') || [];
  const producers = details.credits?.crew?.filter(c => c.job === 'Producer' || c.job === 'Executive Producer').slice(0, 3) || [];
  const prodCompanies = details.production_companies?.filter(p => p.logo_path).slice(0, 6) || [];
  const budget = type === 'movie' ? fmt$(details.budget || 0) : null;
  const revenue = type === 'movie' ? fmt$(details.revenue || 0) : null;
  const seasons = details.number_of_seasons;
  const episodes = details.number_of_episodes;

  // Watch providers — India only (no fallback to other countries)
  const providerData = details['watch/providers']?.results || {};
  const regionData = providerData[REGION] || {};
  const streamProviders: Provider[] = regionData.flatrate || [];
  const rentProviders: Provider[] = regionData.rent || [];
  const buyProviders: Provider[] = regionData.buy || [];
  const hasProviders = streamProviders.length + rentProviders.length + buyProviders.length > 0;

  const similarItems: SimilarItem[] = [
    ...(details.recommendations?.results?.filter(i => i.poster_path).slice(0, 10) || []),
    ...(details.similar?.results?.filter(i => i.poster_path).slice(0, 10) || []),
  ].filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i).slice(0, 12);

  const collectionParts = collection?.parts?.filter(p => p.id !== details.id) || [];

  const overviewLong = overview.length > 180;
  const overviewText = overviewLong && !overviewExpanded ? overview.slice(0, 180) + '…' : overview;
  const statusCfg = trackedItem
    ? TRACKED_STYLES[trackedItem.status]
    : historyCount > 0 ? WATCHED_STYLE : NOT_TRACKED_STYLE;
  const statusLabel = trackedItem
    ? WATCHING_STATUS_LABELS[trackedItem.status]
    : historyCount > 0 ? 'Watched' : 'Not Watched';
  const statusHint = trackedItem ? 'View progress' : historyCount > 0 ? 'Tap to rewatch' : 'Tap to start';

  return (
    <SpecialThemeContext.Provider value={theme}>
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── HERO ───────────────────────────────────────── */}
        <View style={{ height: 420 }}>
          {details.backdrop_path ? (
            <Image source={{ uri: `${IMG_ORIG}${details.backdrop_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : details.poster_path ? (
            <Image source={{ uri: `${IMG_W780}${details.poster_path}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={theme ? theme.heroGradient : ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)', '#000']}
            locations={theme ? undefined : [0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          {theme && (
            <SpinningEmblem
              icon={theme.heroIcon}
              color={theme.accent + '2E'}
              size={170}
              style={{ top: insets.top + 30, right: -40 }}
            />
          )}

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={[s.backCircle, { top: insets.top + 10 }]}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          {/* Poster + meta bottom area */}
          <View style={s.heroBottom}>
            {details.poster_path && (
              <Image
                source={{ uri: `${IMG_W500}${details.poster_path}` }}
                style={[
                  s.heroPoster,
                  theme && { borderWidth: 2, borderColor: theme.accent },
                ]}
                resizeMode="cover"
              />
            )}
            <View style={s.heroMeta}>
              <Text
                style={[
                  s.heroTitle,
                  theme && {
                    color: theme.accent,
                    textShadowColor: theme.secondary,
                    textShadowOffset: { width: 2, height: 2 },
                    textShadowRadius: 0,
                  },
                  fontReady && { fontFamily: theme!.displayFont, fontWeight: 'normal', fontSize: 38, lineHeight: 42, letterSpacing: 1 },
                ]}
                numberOfLines={3}
              >
                {title}
              </Text>
              {theme && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MaterialCommunityIcons name="compass-rose" size={13} color={theme.secondary} />
                  <Text style={{ color: '#F5E6C8', fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>
                    {theme.tagline}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {[year, runtime, type === 'tv' ? 'Series' : 'Movie'].filter(Boolean).map(label => (
                  <Text
                    key={label as string}
                    style={[
                      s.heroBadge,
                      theme && { color: theme.accent, backgroundColor: 'rgba(6,20,46,0.6)', borderWidth: 1, borderColor: theme.accent + '55' },
                    ]}
                  >
                    {label}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>

          {/* ── RATING + WATCHLIST ──────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {theme?.ratingCard === 'bounty' && rating > 0 ? (
              <BountyPoster
                theme={theme}
                rating={rating}
                voteCount={voteCount}
                sinceYear={year}
                ongoing={details.status === 'Returning Series' || details.status === 'In Production'}
                fontReady={fontReady}
              />
            ) : rating > 0 ? (
              <View style={s.ratingRow}>
                <View style={s.ratingBig}>
                  <Ionicons name="star" size={18} color="#10B981" />
                  <Text style={s.ratingBigNum}>{rating.toFixed(1)}</Text>
                </View>
                {voteCount > 0 && (
                  <Text style={s.ratingCount} className='text-lg'>({fmtVotes(voteCount)})</Text>
                )}
              </View>
            ) : <View />}
            <Pressable
              onPress={() => inWatchlist ? handleRemoveFromWatchlist() : setShowModal(true)}
              style={[s.watchlistBtn, inWatchlist && s.watchlistBtnActive]}
            >
              <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={16} color={inWatchlist ? '#10B981' : '#A1A1AA'} />
              <Text style={[s.watchlistBtnText, inWatchlist && s.watchlistBtnTextActive]}>
                {inWatchlist ? 'Saved' : 'Add'}
              </Text>
            </Pressable>
          </View>

          {/* ── RELEASE DATE ───────────────────────────── */}
          {releaseDate && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Ionicons name="calendar-outline" size={14} color="#10B981" />
              <Text style={{ color: '#A1A1AA', fontSize: 13, fontWeight: '500' }}>{releaseDate}</Text>
            </View>
          )}

          {/* ── TV SERIES INFO ──────────────────────────── */}
          {type === 'tv' && (seasons || episodes) ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: seasonDetails.length > 0 ? 10 : 0 }}>
                {seasons ? (
                  <View style={s.tvInfoBadge}>
                    <Ionicons name="layers-outline" size={13} color="#10B981" />
                    <Text style={s.tvInfoText}>{seasons} {seasons === 1 ? 'Season' : 'Seasons'}</Text>
                  </View>
                ) : null}
                {episodes ? (
                  <View style={s.tvInfoBadge}>
                    <Ionicons name="list-outline" size={13} color="#10B981" />
                    <Text style={s.tvInfoText}>{episodes} Total Episodes</Text>
                  </View>
                ) : null}
              </View>
              {/* Per-season breakdown */}
              {seasonDetails.length > 0 && (
                <View style={s.seasonList}>
                  {seasonDetails.map(sn => (
                    <View key={sn.season_number} style={s.seasonRow}>
                      <Text style={s.seasonName}>{sn.name}</Text>
                      <Text style={s.seasonEps}>{sn.episode_count} eps</Text>
                      {sn.air_date ? (
                        <Text style={s.seasonDate}>
                          {parseLocalDate(sn.air_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── WATCH STATUS ────────────────────────────── */}
          <Pressable onPress={handleStatusPress} style={[s.watchStatusBtn, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
            <Animated.View style={{ opacity: statusOpacity, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={statusCfg.icon as any} size={18} color={statusCfg.color} />
              <Text style={[s.watchStatusText, { color: statusCfg.color }]}>{statusLabel}</Text>
              <Text style={{ color: statusCfg.color, opacity: 0.6, fontSize: 11, fontWeight: '600' }}>· {statusHint}</Text>
            </Animated.View>
          </Pressable>

          {/* ── UPCOMING (unreleased titles) ────────────── */}
          {isUnreleased && (
            <View style={{ marginTop: 10 }}>
              <UpcomingToggleButton
                tmdbId={details.id}
                mediaType={type}
                title={title}
                posterPath={details.poster_path}
                fallbackReleaseDate={rawDate || null}
              />
            </View>
          )}

          {/* ── GENRES ─────────────────────────────────── */}
          {genres.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {genres.map(g => <GenreChip key={g.id} label={g.name} />)}
            </ScrollView>
          )}

          {/* ── OVERVIEW ───────────────────────────────── */}
          {overview ? (
            <View style={{ marginTop: 20 }}>
              <SectionHeader title="Overview" />
              <Text style={s.overviewText}>{overviewText}</Text>
              {overviewLong && (
                <Pressable onPress={() => setOverviewExpanded(e => !e)}>
                  <Text style={s.readMore}>{overviewExpanded ? 'Read less' : 'Read more'}</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* ── INDIA OTT ──────────────────────────────── */}
          <View style={{ marginTop: 22 }}>
            <OttInfoCard tmdbId={details.id} mediaType={type} />
          </View>

          {/* ── WATCH PROVIDERS ────────────────────────── */}
          {hasProviders && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Available On" />
              {streamProviders.length > 0 && (
                <>
                  <Text style={s.providerLabel}>Stream</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                    {streamProviders.map(p => <ProviderLogo key={p.provider_id} p={p} />)}
                  </ScrollView>
                </>
              )}
              {rentProviders.length > 0 && (
                <>
                  <Text style={[s.providerLabel, { marginTop: 10 }]}>Rent</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                    {rentProviders.map(p => <ProviderLogo key={p.provider_id} p={p} />)}
                  </ScrollView>
                </>
              )}
              {buyProviders.length > 0 && (
                <>
                  <Text style={[s.providerLabel, { marginTop: 10 }]}>Buy</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                    {buyProviders.map(p => <ProviderLogo key={p.provider_id} p={p} />)}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          {/* ── CAST ───────────────────────────────────── */}
          {cast.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Cast" />
              <FlatList
                horizontal
                data={cast}
                keyExtractor={i => String(i.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, marginHorizontal: -20, paddingHorizontal: 20 }}
                renderItem={({ item }) => <CastCard item={item} onPress={isFromWatchlist ? undefined : () => navigateToPerson(item.id, item.name)} />}
              />
            </View>
          )}

          {/* ── DIRECTOR ───────────────────────────────── */}
          {directors.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Director" />
              <View style={{ gap: 10 }}>
                {directors.map(d => (
                  <Pressable key={d.id} style={s.crewRow} onPress={isFromWatchlist ? undefined : () => navigateToPerson(d.id, d.name)}>
                    {d.profile_path ? (
                      <Image source={{ uri: `${IMG_W500}${d.profile_path}` }} style={s.crewAvatar} />
                    ) : (
                      <View style={[s.crewAvatar, s.castAvatarFallback]}>
                        <Ionicons name="person" size={16} color="#52525B" />
                      </View>
                    )}
                    <Text style={s.crewName}>{d.name}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#52525B" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── PRODUCTION ─────────────────────────────── */}
          {prodCompanies.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Production" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, alignItems: 'center' }}>
                {prodCompanies.map(c => (
                  <Pressable key={c.id} style={s.companyWrap} onPress={isFromWatchlist ? undefined : () => navigateToCompany(c.id, c.name)}>
                    <Image source={{ uri: `${IMG_W500}${c.logo_path}` }} style={s.companyLogo} resizeMode="contain" />
                    <Text style={s.companyName} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── BOX OFFICE ─────────────────────────────── */}
          {(budget || revenue) && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="Box Office" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {budget && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Budget</Text>
                    <Text style={s.statValue}>{budget}</Text>
                  </View>
                )}
                {revenue && (
                  <View style={s.statCard}>
                    <Text style={s.statLabel}>Revenue</Text>
                    <Text style={s.statValue}>{revenue}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── COLLECTION / SEQUELS ───────────────────── */}
          {collectionParts.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title={collection?.name || 'Collection'} />
              <FlatList
                horizontal
                data={collectionParts}
                keyExtractor={i => String(i.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, marginHorizontal: -20, paddingHorizontal: 20 }}
                renderItem={({ item }) => (
                  <PosterCard
                    item={item}
                    onPress={() => navigateToContent(item.id, 'movie')}
                  />
                )}
              />
            </View>
          )}

          {/* ── SIMILAR CONTENT ────────────────────────── */}
          {similarItems.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionHeader title="You Might Also Like" />
              <FlatList
                horizontal
                data={similarItems}
                keyExtractor={i => String(i.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, marginHorizontal: -20, paddingHorizontal: 20 }}
                renderItem={({ item }) => (
                  <PosterCard
                    item={item}
                    onPress={() => navigateToContent(item.id, item.media_type || type)}
                  />
                )}
              />
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── ADD TO WATCHLIST SHEET ────────────────── */}
      <AddToWatchlistSheet
        visible={showModal}
        title={title}
        subtitle={`${type === 'tv' ? 'Series' : 'Movie'}${runtime ? ` · ${runtime}` : ''}`}
        onConfirm={handleAddToWatchlist}
        onCancel={() => setShowModal(false)}
      />
    </View>
    </SpecialThemeContext.Provider>
  );
}

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  backCircle: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  backBtn: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  heroBottom: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'flex-end', gap: 14,
  },
  heroPoster: {
    width: 100, height: 150, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMeta: { flex: 1, paddingBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28 },
  heroBadge: {
    color: '#A1A1AA', fontSize: 12, fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingBig: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  ratingBigNum: { color: '#10B981', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  ratingBigMax: { color: '#71717A', fontSize: 14, fontWeight: '500' },
  ratingCount: { color: '#52525B', fontSize: 13, fontWeight: '500' },
  sectionHeader: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.4, marginBottom: 12 },
  genreChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  genreChipText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  overviewText: { color: '#A1A1AA', fontSize: 14, lineHeight: 22, fontWeight: '400' },
  readMore: { color: '#10B981', fontSize: 13, fontWeight: '600', marginTop: 6 },
  providerLabel: { color: '#52525B', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  providerWrap: { alignItems: 'center', gap: 5 },
  providerLogo: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#1A1A1A' },
  providerName: { color: '#71717A', fontSize: 10, fontWeight: '500', textAlign: 'center', maxWidth: 56 },
  castCard: { width: 80, alignItems: 'center' },
  castAvatarWrap: { marginBottom: 6 },
  castAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A1A1A' },
  castAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  castName: { color: '#E5E2E1', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  castChar: { color: '#52525B', fontSize: 10, textAlign: 'center', marginTop: 2 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A' },
  crewName: { color: '#E5E2E1', fontSize: 14, fontWeight: '600' },
  companyWrap: { alignItems: 'center', gap: 6, maxWidth: 80 },
  companyLogo: { width: 70, height: 38, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 },
  companyName: { color: '#71717A', fontSize: 10, textAlign: 'center' },
  statCard: {
    flex: 1, backgroundColor: '#121212', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  statLabel: { color: '#52525B', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  statValue: { color: '#10B981', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  miniCard: {
    width: 130, height: 195, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  miniPoster: { width: '100%', height: '100%' },
  miniPosterFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  miniCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  miniCardTitle: { color: '#fff', fontSize: 11, fontWeight: '700' },
  miniRating: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  tvInfoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  tvInfoText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  seasonList: {
    backgroundColor: '#121212', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  seasonRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  seasonName: { color: '#E5E2E1', fontSize: 13, fontWeight: '600', flex: 1 },
  seasonEps: { color: '#10B981', fontSize: 12, fontWeight: '600', marginRight: 12 },
  seasonDate: { color: '#52525B', fontSize: 11, fontWeight: '500' },
  watchStatusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1,
  },
  watchStatusText: { fontSize: 14, fontWeight: '700' },
  // Watchlist button
  watchlistBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  watchlistBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  watchlistBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  watchlistBtnTextActive: { color: '#10B981' },
  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  modalConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#10B981',
  },
  modalConfirmText: { color: '#000', fontSize: 15, fontWeight: '700' },
  modalCancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});
