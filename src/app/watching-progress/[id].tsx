import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatching } from '../../context/WatchingContext';
import {
  CONTENT_TYPES, ContentType, SeasonBreakdown, WATCHING_STATUS_LABELS, WatchingStatus,
} from '../../types';
import {
  getProgress, getTotalEpisodes, watchedAtPosition, positionFromWatched, seasonOffset,
  markSeasonWatchedCount, unmarkSeasonWatchedCount, isEndedStatus,
} from '../../services/watchingStore';
import { tmdbGet } from '../../services/tmdb';
import StatusModal from '../../components/tracking/StatusModal';

const STATUS_COLORS: Record<WatchingStatus, string> = {
  watching: '#3B82F6',
  rewatching: '#A855F7',
  completed: '#10B981',
  caught_up: '#F59E0B',
  on_hold: '#F59E0B',
  dropped: '#F87171',
};

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
  const {
    getItem, updateProgress, markCompleted, markCaughtUp, remove,
    putOnHold, dropItem, resume,
  } = useWatching();

  // Find the item from real store
  const item = getItem(Number(id), media_type || 'movie');

  // Local state for editing
  const [season, setSeason] = useState(item?.currentSeason || 1);
  const [episode, setEpisode] = useState(item?.currentEpisode || 1);
  const [movieDone, setMovieDone] = useState(item?.movieCompleted ?? false);
  const [saving, setSaving] = useState(false);
  const [watched, setWatched] = useState(item?.episodesWatched ?? 0);
  const [modalMode, setModalMode] = useState<'hold' | 'drop' | null>(null);

  // Sync local state once the item arrives (e.g. context still loading on mount)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!item || syncedRef.current) return;
    syncedRef.current = true;
    setSeason(item.currentSeason || 1);
    setEpisode(item.currentEpisode || 1);
    setMovieDone(item.movieCompleted ?? false);
    setWatched(item.episodesWatched ?? 0);
  }, [item]);

  // Lazily capture the show's TMDb status when missing (older items)
  useEffect(() => {
    if (!item || item.mediaType !== 'tv' || item.showStatus) return;
    tmdbGet<{ status?: string }>(`tv/${item.tmdbId}`)
      .then(d => { if (d.status) updateProgress(item.tmdbId, item.mediaType, { showStatus: d.status }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.tmdbId, item?.showStatus]);

  // Fade in
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [fadeIn]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // Actions that leave the screen run once: a double-tap must not pop two screens.
  const leaving = useRef(false);
  const leave = useCallback(async (work: () => Promise<void>) => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      await work();
      goBack();
    } catch {
      leaving.current = false;
    }
  }, [goBack]);

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={40} color="#52525B" />
        <Text style={{ color: '#A1A1AA', fontSize: 16, fontWeight: '600', marginTop: 12 }}>Content not found</Text>
        <Text style={{ color: '#52525B', fontSize: 12, marginTop: 4 }}>Start watching from a content details page</Text>
        <Pressable onPress={goBack} style={st.backLink}>
          <Text style={{ color: '#10B981', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const typeCfg = getTypeConfig(item.contentType);
  const isMovie = item.mediaType === 'movie';
  const seasons = item.seasonEpisodes || [];
  const totalEps = getTotalEpisodes(item) || 1;
  const totalWatched = isMovie ? (movieDone ? 1 : 0) : Math.min(watched, totalEps);

  // Move the position (and the watched count that follows it)
  const setPos = (sNum: number, ep: number) => {
    setSeason(sNum);
    setEpisode(ep);
    setWatched(watchedAtPosition(seasons, sNum, ep));
  };
  const setWatchedCount = (count: number) => {
    const pos = positionFromWatched(seasons, count);
    setSeason(pos.season);
    setEpisode(pos.episode);
    setWatched(count);
  };

  // Current season's max episodes
  const currentSeasonData = seasons.find(s => s.season === season);
  const maxEps = currentSeasonData?.episodes || 0; // 0 means unaired season

  // Clamp episode when switching seasons
  const handleSeasonChange = (newSeason: number) => {
    const newSeasonData = seasons.find(s => s.season === newSeason);
    const newMax = newSeasonData?.episodes || 0;
    if (newMax === 0) setPos(newSeason, 0);
    else setPos(newSeason, Math.min(Math.max(episode, 1), newMax));
  };

  // Same math as every list/home card
  const percentage = getProgress({
    ...item, movieCompleted: movieDone, episodesWatched: totalWatched,
  }).percent;
  const allWatched = !isMovie && totalEps > 0 && totalWatched >= totalEps;
  const status = item.status;
  const inactive = status === 'on_hold' || status === 'dropped';
  const statusColor = STATUS_COLORS[status] ?? '#71717A';

  // Save progress to real store
  const handleSave = () => leave(async () => {
    setSaving(true);
    try {
      if (isMovie) {
        if (movieDone) {
          await updateProgress(item.tmdbId, item.mediaType, { movieCompleted: true });
          await markCompleted(item.tmdbId, item.mediaType);
        } else {
          await updateProgress(item.tmdbId, item.mediaType, {
            movieCompleted: false,
            ...(status === 'caught_up' || status === 'completed' ? { status: 'watching' as const } : {}),
          });
        }
      } else {
        const finished = totalEps > 0 && totalWatched >= totalEps;
        await updateProgress(item.tmdbId, item.mediaType, {
          currentSeason: season,
          currentEpisode: episode,
          episodesWatched: totalWatched,
        });
        if (finished) {
          // Finished everything aired: complete if the show is over, else wait for new episodes
          let showStatus = item.showStatus;
          if (!isEndedStatus(showStatus)) {
            try {
              const d = await tmdbGet<{ status?: string }>(`tv/${item.tmdbId}`);
              if (d.status) showStatus = d.status;
            } catch { /* keep stored status */ }
          }
          if (isEndedStatus(showStatus)) {
            await updateProgress(item.tmdbId, item.mediaType, { showStatus });
            await markCompleted(item.tmdbId, item.mediaType);
          } else {
            await updateProgress(item.tmdbId, item.mediaType, {
              status: 'caught_up', ...(showStatus ? { showStatus } : {}),
            });
          }
        } else if (status === 'caught_up') {
          await updateProgress(item.tmdbId, item.mediaType, { status: 'watching' });
        }
      }
    } catch { /* silently */ }
    setSaving(false);
  });

  // Explicit completion for series/anime
  const handleMarkCompleted = () => leave(() => markCompleted(item.tmdbId, item.mediaType));

  // Mark caught up
  const handleCaughtUp = () => leave(() => markCaughtUp(item.tmdbId, item.mediaType));

  const handleConfirmModal = (text: string, rating: number | null) => {
    const mode = modalMode;
    setModalMode(null);
    return leave(async () => {
      if (mode === 'hold') await putOnHold(item.tmdbId, item.mediaType, text);
      else if (mode === 'drop') await dropItem(item.tmdbId, item.mediaType, text, rating);
    });
  };

  const handleResume = async () => {
    await resume(item.tmdbId, item.mediaType);
  };

  // Season card toggle
  const toggleSeason = (sNum: number, isDone: boolean) => {
    setWatchedCount(
      isDone
        ? unmarkSeasonWatchedCount(seasons, totalWatched, sNum)
        : markSeasonWatchedCount(seasons, totalWatched, sNum),
    );
  };

  // Remove from watching
  const handleRemove = () => leave(() => remove(item.tmdbId, item.mediaType));

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn }}>

          {/* ── Hero header ─────────────────────────────── */}
          <View style={st.hero}>
            <Image
              source={{ uri: item.posterUrl || undefined }}
              style={st.heroPoster}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)', '#000']}
              locations={[0, 0.6, 1]}
              style={[StyleSheet.absoluteFill, { top: 0 }]}
            />

            {/* Back */}
            <Pressable onPress={goBack} style={[st.backBtn, { top: insets.top + 10 }]}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>

            {/* Title area */}
            <View style={st.heroInfo}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={[st.typePill, { backgroundColor: typeCfg.color + '20' }]}>
                <Ionicons name={typeCfg.icon as any} size={12} color={typeCfg.color} />
                <Text style={[st.typePillText, { color: typeCfg.color }]}>
                  {item.contentType === 'other' ? 'Docs & Other' : item.contentType.charAt(0).toUpperCase() + item.contentType.slice(1)}
                </Text>
              </View>
              <View style={[st.statusPill, { backgroundColor: statusColor + '20' }]}>
                <Text style={[st.typePillText, { color: statusColor }]}>{WATCHING_STATUS_LABELS[status]}</Text>
              </View>
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
                  onChange={(v) => setPos(season, v)}
                />
                <View style={st.quickActions}>
                  <Pressable style={st.quickBtn} onPress={() => setPos(season, 1)}>
                    <Text style={st.quickBtnText}>First</Text>
                  </Pressable>
                  <Pressable style={st.quickBtn} onPress={() => setPos(season, Math.min(episode + 1, maxEps))}>
                    <Ionicons name="add" size={14} color="#A1A1AA" />
                    <Text style={st.quickBtnText}>Next Ep</Text>
                  </Pressable>
                  <Pressable
                    style={[st.quickBtn, { backgroundColor: typeCfg.color + '15', borderColor: typeCfg.color + '30' }]}
                    onPress={() => setPos(season, maxEps)}
                  >
                    <Ionicons name="checkmark-done" size={14} color={typeCfg.color} />
                    <Text style={[st.quickBtnText, { color: typeCfg.color }]}>Finish Season</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ── Season Progress Grid ───────────────────── */}
          {!isMovie && seasons.length > 0 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Season Progress</Text>
              <View style={st.seasonGrid}>
                {seasons.map(s => {
                  const hasEps = s.episodes > 0;
                  const epsInSeason = hasEps
                    ? Math.max(0, Math.min(s.episodes, totalWatched - seasonOffset(seasons, s.season)))
                    : 0;
                  const isComplete = hasEps && epsInSeason >= s.episodes;
                  const isCurrent = s.season === season;
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
                      {hasEps && (
                        <Pressable
                          style={[st.seasonToggle, isComplete && { borderColor: typeCfg.color + '40', backgroundColor: typeCfg.color + '12' }]}
                          onPress={() => toggleSeason(s.season, isComplete)}
                        >
                          <Ionicons
                            name={isComplete ? 'close-circle-outline' : 'checkmark-done'}
                            size={13}
                            color={isComplete ? '#A1A1AA' : typeCfg.color}
                          />
                          <Text style={[st.seasonToggleText, !isComplete && { color: typeCfg.color }]}>
                            {isComplete ? 'Unmark' : 'Mark watched'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Status ─────────────────────────────────── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Status</Text>
            {status === 'on_hold' && !!item.holdNote && (
              <View style={[st.noteBox, { borderColor: '#F59E0B40' }]}>
                <Ionicons name="pause-circle" size={14} color="#F59E0B" />
                <Text style={st.noteText}>{item.holdNote}</Text>
              </View>
            )}
            {status === 'dropped' && (
              <View style={[st.noteBox, { borderColor: '#F8717140' }]}>
                <Ionicons name="close-circle" size={14} color="#F87171" />
                <Text style={st.noteText}>
                  {item.dropReason}
                  {item.dropRating != null ? `  ·  ★ ${item.dropRating.toFixed(1)}/10` : ''}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {inactive ? (
                <Pressable style={st.dangerBtn} onPress={handleResume}>
                  <Ionicons name="play-circle-outline" size={14} color="#10B981" />
                  <Text style={[st.dangerBtnText, { color: '#10B981' }]}>Resume</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={st.dangerBtn} onPress={() => setModalMode('hold')}>
                    <Ionicons name="pause-circle-outline" size={14} color="#F59E0B" />
                    <Text style={[st.dangerBtnText, { color: '#F59E0B' }]}>Put On Hold</Text>
                  </Pressable>
                  <Pressable style={st.dangerBtn} onPress={() => setModalMode('drop')}>
                    <Ionicons name="close-circle-outline" size={14} color="#F87171" />
                    <Text style={[st.dangerBtnText, { color: '#F87171' }]}>Drop</Text>
                  </Pressable>
                </>
              )}
            </View>
            {!isMovie && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable style={st.dangerBtn} onPress={handleMarkCompleted}>
                  <Ionicons name="checkmark-done-circle-outline" size={14} color="#10B981" />
                  <Text style={[st.dangerBtnText, { color: '#10B981' }]}>Mark Completed</Text>
                </Pressable>
                {status !== 'caught_up' && (
                  <Pressable style={st.dangerBtn} onPress={handleCaughtUp}>
                    <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
                    <Text style={[st.dangerBtnText, { color: '#F59E0B' }]}>Mark Caught Up</Text>
                  </Pressable>
                )}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Pressable style={st.dangerBtn} onPress={handleRemove}>
                <Ionicons name="trash-outline" size={14} color="#F87171" />
                <Text style={[st.dangerBtnText, { color: '#F87171' }]}>Remove</Text>
              </Pressable>
            </View>
          </View>

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
          <Text style={st.saveBtnText}>
            {saving ? 'Saving...' : allWatched ? 'Save & Finish' : 'Save Progress'}
          </Text>
        </Pressable>
      </View>

      <StatusModal
        visible={modalMode !== null}
        mode={modalMode ?? 'hold'}
        title={item.title}
        onCancel={() => setModalMode(null)}
        onConfirm={handleConfirmModal}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────
const st = StyleSheet.create({
  hero: { height: 320, position: 'relative' },
  heroPoster: { width: '100%', height: '100%' },
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
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12,
    backgroundColor: '#121212', borderWidth: 1, marginBottom: 12,
  },
  noteText: { flex: 1, color: '#D4D4D8', fontSize: 13, lineHeight: 18 },
  seasonToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  seasonToggleText: { color: '#A1A1AA', fontSize: 11, fontWeight: '700' },
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
