import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, Image, ScrollView, Pressable, StyleSheet,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatching } from '../../context/WatchingContext';
import {
  CONTENT_TYPES, ContentType, WatchingItem, SeasonBreakdown,
} from '../../types';

function getTypeConfig(type: ContentType) {
  return CONTENT_TYPES.find(c => c.key === type) || CONTENT_TYPES[0];
}

// ── Stepper Component ─────────────────────────────────
function Stepper({
  value, min, max, label, color, onChange,
}: {
  value: number; min: number; max: number; label: string; color: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={st.stepperWrap}>
      <Text style={st.stepperLabel}>{label}</Text>
      <View style={st.stepperRow}>
        <Pressable
          style={[st.stepperBtn, value <= min && st.stepperBtnDisabled]}
          onPress={() => value > min && onChange(value - 1)}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={20} color={value <= min ? '#3F3F46' : color} />
        </Pressable>
        <View style={[st.stepperValueWrap, { borderColor: color + '40' }]}>
          <Text style={[st.stepperValue, { color }]}>{value}</Text>
        </View>
        <Pressable
          style={[st.stepperBtn, value >= max && st.stepperBtnDisabled]}
          onPress={() => value < max && onChange(value + 1)}
          disabled={value >= max}
        >
          <Ionicons name="add" size={20} color={value >= max ? '#3F3F46' : color} />
        </Pressable>
      </View>
      <Text style={st.stepperRange}>of {max}</Text>
    </View>
  );
}

// ── Season Selector ───────────────────────────────────
function SeasonChip({
  season, isActive, color, onPress,
}: {
  season: SeasonBreakdown; isActive: boolean; color: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={[st.seasonChip, isActive && { backgroundColor: color + '20', borderColor: color + '40' }]}
      onPress={onPress}
    >
      <Text style={[st.seasonChipText, isActive && { color }]}>
        {season.title || `S${season.season}`}
      </Text>
      <Text style={[st.seasonChipEps, isActive && { color: color + 'AA' }]}>
        {season.episodes} ep
      </Text>
    </Pressable>
  );
}

// ── Progress Circle ───────────────────────────────────
function ProgressCircle({ percentage, color }: { percentage: number; color: string }) {
  return (
    <View style={st.circleWrap}>
      <View style={[st.circleBg, { borderColor: color + '40' }]}>
        <View style={st.circleInner}>
          <Text style={[st.circlePercent, { color }]}>{percentage}%</Text>
          <Text style={st.circleLabel}>complete</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────
export default function WatchingProgressScreen() {
  const { id, media_type } = useLocalSearchParams<{ id: string; media_type: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getItem, updateProgress, markCompleted, markCaughtUp, remove } = useWatching();

  // Find the item from real store
  const item = getItem(Number(id), media_type || 'movie');

  // Local state for editing
  const [season, setSeason] = useState(item?.currentSeason || 1);
  const [episode, setEpisode] = useState(item?.currentEpisode || 1);
  const [movieDone, setMovieDone] = useState(item?.movieCompleted ?? false);
  const [saving, setSaving] = useState(false);

  // Sync local state once the item arrives (e.g. context still loading on mount)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!item || syncedRef.current) return;
    syncedRef.current = true;
    setSeason(item.currentSeason || 1);
    setEpisode(item.currentEpisode || 1);
    setMovieDone(item.movieCompleted ?? false);
  }, [item]);

  // Fade in
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Compute real total episodes from season data (only seasons with actual episodes)
  const totalEps = useMemo(() => {
    if (!item) return 1;
    const seasons = item.seasonEpisodes || [];
    if (seasons.length > 0) {
      return seasons.reduce((sum, s) => sum + s.episodes, 0);
    }
    return item.totalEpisodes || 1;
  }, [item]);

  // Calculate total episodes watched based on season/episode
  const totalWatched = useMemo(() => {
    if (!item) return 0;
    const isMovie = item.contentType === 'movie';
    const seasons = item.seasonEpisodes || [];
    if (isMovie) return movieDone ? 1 : 0;
    let count = 0;
    for (const s of seasons) {
      if (s.season < season) {
        count += s.episodes;
      } else if (s.season === season) {
        count += episode;
        break;
      }
    }
    // Clamp to totalEps
    return Math.min(count || episode, totalEps);
  }, [item, season, episode, totalEps, movieDone]);

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={40} color="#52525B" />
        <Text style={{ color: '#A1A1AA', fontSize: 16, fontWeight: '600', marginTop: 12 }}>Content not found</Text>
        <Text style={{ color: '#52525B', fontSize: 12, marginTop: 4 }}>Start watching from a content details page</Text>
        <Pressable onPress={() => router.back()} style={st.backLink}>
          <Text style={{ color: '#10B981', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const typeCfg = getTypeConfig(item.contentType);
  const isMovie = item.contentType === 'movie';
  const seasons = item.seasonEpisodes || [];

  // Current season's max episodes
  const currentSeasonData = seasons.find(s => s.season === season);
  const maxEps = currentSeasonData?.episodes || 0; // 0 means unaired season

  // Clamp episode when switching seasons
  const handleSeasonChange = (newSeason: number) => {
    setSeason(newSeason);
    const newSeasonData = seasons.find(s => s.season === newSeason);
    const newMax = newSeasonData?.episodes || 0;
    if (newMax === 0) {
      setEpisode(0);
    } else if (episode > newMax) {
      setEpisode(newMax);
    } else if (episode === 0) {
      setEpisode(1);
    }
  };

  const percentage = isMovie
    ? (movieDone ? 100 : 0)
    : totalEps > 0 ? Math.min(100, Math.round((totalWatched / totalEps) * 100)) : 0;

  // Save progress to real store
  const handleSave = async () => {
    setSaving(true);
    try {
      if (isMovie) {
        await updateProgress(item.tmdbId, item.mediaType, {
          movieCompleted: movieDone,
          status: movieDone ? 'completed' : 'watching',
        });
        if (movieDone) {
          await markCompleted(item.tmdbId, item.mediaType);
        }
      } else {
        await updateProgress(item.tmdbId, item.mediaType, {
          currentSeason: season,
          currentEpisode: episode,
          episodesWatched: totalWatched,
        });
      }
    } catch { /* silently */ }
    setSaving(false);
    router.back();
  };

  // Mark caught up
  const handleCaughtUp = async () => {
    await markCaughtUp(item.tmdbId, item.mediaType);
    router.back();
  };

  // Remove from watching
  const handleRemove = async () => {
    await remove(item.tmdbId, item.mediaType);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn }}>

          {/* ── Hero header ─────────────────────────────── */}
          <View style={st.hero}>
            <Image source={{ uri: item.posterUrl || undefined }} style={st.heroPoster} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)', '#000']}
              locations={[0, 0.6, 1]}
              style={[StyleSheet.absoluteFill, { top: 0 }]}
            />

            {/* Back */}
            <Pressable onPress={() => router.back()} style={[st.backBtn, { top: insets.top + 10 }]}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>

            {/* Title area */}
            <View style={st.heroInfo}>
              <View style={[st.typePill, { backgroundColor: typeCfg.color + '20' }]}>
                <Ionicons name={typeCfg.icon as any} size={12} color={typeCfg.color} />
                <Text style={[st.typePillText, { color: typeCfg.color }]}>
                  {item.contentType.charAt(0).toUpperCase() + item.contentType.slice(1)}
                </Text>
              </View>
              <Text style={st.heroTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={st.heroYear}>{item.year} · ★ {item.rating.toFixed(1)}</Text>
            </View>
          </View>

          {/* ── Progress Overview ───────────────────────── */}
          <View style={st.section}>
            <View style={st.progressOverview}>
              <ProgressCircle percentage={percentage} color={typeCfg.color} />
              <View style={st.progressStats}>
                {!isMovie && (
                  <>
                    <View style={st.progressStatRow}>
                      <Ionicons name="layers-outline" size={14} color="#A1A1AA" />
                      <Text style={st.progressStatText}>
                        Season <Text style={{ color: typeCfg.color, fontWeight: '800' }}>{season}</Text> of {item.totalSeasons}
                      </Text>
                    </View>
                    <View style={st.progressStatRow}>
                      <Ionicons name="play-outline" size={14} color="#A1A1AA" />
                      <Text style={st.progressStatText}>
                        Episode <Text style={{ color: typeCfg.color, fontWeight: '800' }}>{episode}</Text> of {maxEps}
                      </Text>
                    </View>
                    <View style={st.progressStatRow}>
                      <Ionicons name="checkmark-done-outline" size={14} color="#A1A1AA" />
                      <Text style={st.progressStatText}>
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{totalWatched}</Text> / {totalEps} total episodes
                      </Text>
                    </View>
                  </>
                )}
                {isMovie && (
                  <View style={st.progressStatRow}>
                    <Ionicons name={movieDone ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={movieDone ? '#10B981' : '#52525B'} />
                    <Text style={st.progressStatText}>
                      {movieDone ? 'Completed' : 'Not yet completed'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Movie Toggle ───────────────────────────── */}
          {isMovie && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Watch Status</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  style={[st.movieToggle, !movieDone && st.movieToggleActive]}
                  onPress={() => setMovieDone(false)}
                >
                  <Ionicons name="pause-circle-outline" size={22} color={!movieDone ? '#F59E0B' : '#52525B'} />
                  <Text style={[st.movieToggleText, !movieDone && { color: '#F59E0B' }]}>Not Completed</Text>
                </Pressable>
                <Pressable
                  style={[st.movieToggle, movieDone && { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }]}
                  onPress={() => setMovieDone(true)}
                >
                  <Ionicons name="checkmark-circle" size={22} color={movieDone ? '#10B981' : '#52525B'} />
                  <Text style={[st.movieToggleText, movieDone && { color: '#10B981' }]}>Completed</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Season Selector (Series/Anime) ──────────── */}
          {!isMovie && seasons.length > 0 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Select Season</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {seasons.map(s => (
                  <SeasonChip
                    key={s.season}
                    season={s}
                    isActive={s.season === season}
                    color={typeCfg.color}
                    onPress={() => handleSeasonChange(s.season)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Episode Stepper (Series/Anime) ──────────── */}
          {!isMovie && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Update Episode</Text>
              <View style={st.stepperCard}>
                <Stepper
                  value={episode}
                  min={1}
                  max={maxEps}
                  label={`Episode in ${currentSeasonData?.title || `Season ${season}`}`}
                  color={typeCfg.color}
                  onChange={setEpisode}
                />
                <View style={st.quickActions}>
                  <Pressable style={st.quickBtn} onPress={() => setEpisode(1)}>
                    <Text style={st.quickBtnText}>First</Text>
                  </Pressable>
                  <Pressable style={st.quickBtn} onPress={() => setEpisode(Math.min(episode + 1, maxEps))}>
                    <Ionicons name="add" size={14} color="#A1A1AA" />
                    <Text style={st.quickBtnText}>Next Ep</Text>
                  </Pressable>
                  <Pressable
                    style={[st.quickBtn, { backgroundColor: typeCfg.color + '15', borderColor: typeCfg.color + '30' }]}
                    onPress={() => setEpisode(maxEps)}
                  >
                    <Ionicons name="checkmark-done" size={14} color={typeCfg.color} />
                    <Text style={[st.quickBtnText, { color: typeCfg.color }]}>Finish Season</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ── Season Progress Grid ───────────────────── */}
          {!isMovie && seasons.length > 1 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Season Progress</Text>
              <View style={st.seasonGrid}>
                {seasons.map(s => {
                  const hasEps = s.episodes > 0;
                  const isComplete = hasEps && (s.season < season || (s.season === season && episode >= s.episodes));
                  const isCurrent = s.season === season;
                  const epsInSeason = s.season === season ? episode : (s.season < season ? s.episodes : 0);
                  const pct = hasEps ? Math.min(100, Math.round((epsInSeason / s.episodes) * 100)) : 0;
                  return (
                    <View key={s.season} style={[st.seasonGridItem, isComplete && { borderColor: typeCfg.color + '30' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={[st.seasonGridName, isCurrent && { color: typeCfg.color }]}>
                          {s.title || `S${s.season}`}
                        </Text>
                        {isComplete && <Ionicons name="checkmark-circle" size={14} color={typeCfg.color} />}
                        {!hasEps && <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '700' }}>TBA</Text>}
                      </View>
                      <View style={st.seasonProgressBg}>
                        <View style={[st.seasonProgressFill, { width: `${pct}%`, backgroundColor: typeCfg.color }]} />
                      </View>
                      <Text style={st.seasonProgressText}>
                        {hasEps ? `${epsInSeason}/${s.episodes} episodes` : 'Not yet aired'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Danger Zone ─────────────────────────────── */}
          {!isMovie && (
            <View style={st.section}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={st.dangerBtn} onPress={handleCaughtUp}>
                  <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
                  <Text style={[st.dangerBtnText, { color: '#F59E0B' }]}>Mark Caught Up</Text>
                </Pressable>
                <Pressable style={st.dangerBtn} onPress={handleRemove}>
                  <Ionicons name="trash-outline" size={14} color="#F87171" />
                  <Text style={[st.dangerBtnText, { color: '#F87171' }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Save Button ────────────────────────────────── */}
      <View style={[st.saveBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable
          style={[st.saveBtn, { backgroundColor: typeCfg.color, opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={20} color="#000" />
          <Text style={st.saveBtnText}>{saving ? 'Saving...' : 'Save Progress'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────
const st = StyleSheet.create({
  hero: { height: 320, position: 'relative' },
  heroPoster: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroInfo: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  heroYear: { color: '#71717A', fontSize: 13, fontWeight: '600', marginTop: 4 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  typePillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  backBtn: {
    position: 'absolute', left: 16, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  backLink: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)' },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },

  progressOverview: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#121212', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 20 },
  progressStats: { flex: 1, gap: 10 },
  progressStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressStatText: { color: '#A1A1AA', fontSize: 13, fontWeight: '500' },

  circleWrap: { alignItems: 'center' },
  circleBg: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  circleInner: { alignItems: 'center' },
  circlePercent: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  circleLabel: { color: '#52525B', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  movieToggle: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 20, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  movieToggleActive: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' },
  movieToggleText: { color: '#52525B', fontSize: 13, fontWeight: '700' },

  seasonChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', gap: 2,
  },
  seasonChipText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  seasonChipEps: { color: '#52525B', fontSize: 10, fontWeight: '600' },

  stepperCard: {
    backgroundColor: '#121212', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 24,
  },
  stepperWrap: { alignItems: 'center' },
  stepperLabel: { color: '#71717A', fontSize: 12, fontWeight: '600', marginBottom: 14, textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperValueWrap: {
    width: 80, height: 56, borderRadius: 16, borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  stepperRange: { color: '#52525B', fontSize: 11, fontWeight: '600', marginTop: 8 },

  quickActions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  quickBtnText: { color: '#A1A1AA', fontSize: 11, fontWeight: '700' },

  seasonGrid: { gap: 8 },
  seasonGridItem: {
    backgroundColor: '#121212', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14,
  },
  seasonGridName: { color: '#E5E2E1', fontSize: 13, fontWeight: '700' },
  seasonProgressBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  seasonProgressFill: { height: '100%', borderRadius: 2 },
  seasonProgressText: { color: '#52525B', fontSize: 10, fontWeight: '600', marginTop: 6 },

  dangerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dangerBtnText: { fontSize: 12, fontWeight: '700' },

  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16,
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
