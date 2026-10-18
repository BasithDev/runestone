// Quick-track sheet: log a title straight from search results, no details page.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, Image, Pressable, ScrollView, ActivityIndicator, Animated,
  PanResponder, StyleSheet, Dimensions, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWatching } from '../../context/WatchingContext';
import { useWatchlist } from '../../context/WatchlistContext';
import { useUpcoming } from '../../context/UpcomingContext';
import { AddToWatchlistSheet } from '../lists';
import StatusPill from './StatusPill';
import { WatchlistPriority } from '../../services/watchlistStore';
import {
  isEndedStatus, localDateKey, positionFromWatched, watchedAtPosition,
} from '../../services/watchingStore';
import { fetchTrackableBundle, TrackableBundle } from '../../services/titleTracking';
import { tmdbImage } from '../../services/tmdb';

export interface QuickTrackTarget {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  /** YYYY-MM-DD (release_date / first_air_date) if known. */
  releaseDate?: string | null;
}

export interface QuickTrackSheetProps {
  visible: boolean;
  target: QuickTrackTarget | null;
  onClose: () => void;
  /** Called after an action succeeded, with a short message for a toast/snackbar. */
  onDone?: (message: string) => void;
}

const ACCENT = '#10B981';
const SCREEN_H = Dimensions.get('window').height;

function Skeleton() {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: 10 }}>
      {[0, 1, 2].map(i => <View key={i} style={s.skeletonRow} />)}
    </Animated.View>
  );
}

interface ActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}
function ActionButton({ icon, label, sub, onPress, disabled, primary }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.action, primary && s.actionPrimary, disabled && { opacity: 0.45 }, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={20} color={primary ? '#000' : ACCENT} />
      <View style={{ flex: 1 }}>
        <Text style={[s.actionLabel, primary && { color: '#000' }]}>{label}</Text>
        {sub ? <Text style={[s.actionSub, primary && { color: 'rgba(0,0,0,0.6)' }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function QuickTrackSheet({ visible, target, onClose, onDone }: QuickTrackSheetProps) {
  const router = useRouter();
  const {
    startWatching, updateProgress, markCompleted, markCaughtUp, resume, getItem, getHistoryEntries,
  } = useWatching();
  const { isInWatchlist, addItem: addToWatchlist, removeItem: removeFromWatchlist } = useWatchlist();
  const { add: addUpcoming, isSaved: isUpcomingSaved } = useUpcoming();

  // Keep the Modal mounted while the exit animation plays.
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(SCREEN_H)).current;

  const [bundle, setBundle] = useState<TrackableBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFrom, setShowFrom] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [pickSeason, setPickSeason] = useState(1);
  const [pickEpisode, setPickEpisode] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const tmdbId = target?.tmdbId;
  const mediaType = target?.mediaType;
  const isTv = mediaType === 'tv';

  const tracked = target ? getItem(target.tmdbId, target.mediaType) : undefined;
  const historyCount = target ? getHistoryEntries(target.tmdbId, target.mediaType).length : 0;
  const inWatchlist = target ? isInWatchlist(target.tmdbId, target.mediaType) : false;
  const upcomingSaved = target ? isUpcomingSaved(target.mediaType, target.tmdbId) : false;

  // ── Show / hide animation ───────────────────────────
  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(SCREEN_H);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slide, { toValue: SCREEN_H, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Drag the handle down to dismiss.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slide.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 90 || g.vy > 0.9) onCloseRef.current();
      else Animated.timing(slide, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    },
  }), [slide]);

  // ── Lazy fetch on open ──────────────────────────────
  useEffect(() => {
    if (!visible || tmdbId == null || !mediaType) return;
    let cancelled = false;
    setBundle(null);
    setLoadError(false);
    setLoading(true);
    setSaveError(null);
    setShowFrom(false);
    fetchTrackableBundle(mediaType, tmdbId)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, tmdbId, mediaType, retryKey]);

  const seasons = useMemo(
    () => (bundle?.item.seasonEpisodes ?? []).filter(x => x.episodes > 0).sort((a, b) => a.season - b.season),
    [bundle],
  );
  const showStatus = bundle?.item.showStatus ?? tracked?.showStatus;
  const ended = isEndedStatus(showStatus);

  // Preselect the current position when already tracked, otherwise the first episode.
  useEffect(() => {
    if (!bundle) return;
    const watched = tracked?.episodesWatched ?? 0;
    if (tracked && watched > 0 && seasons.length > 0) {
      const pos = positionFromWatched(seasons, watched);
      setPickSeason(pos.season);
      setPickEpisode(pos.episode);
    } else if (tracked && watched > 0) {
      setPickSeason(tracked.currentSeason ?? 1);
      setPickEpisode(tracked.currentEpisode ?? watched);
    } else {
      setPickSeason(seasons[0]?.season ?? 1);
      setPickEpisode(1);
    }
    // Only re-seed when the data loads, not on every tracked-state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  const seasonEpCount = seasons.find(x => x.season === pickSeason)?.episodes ?? 999;
  const chooseSeason = (n: number) => {
    setPickSeason(n);
    const max = seasons.find(x => x.season === n)?.episodes ?? 999;
    setPickEpisode(e => Math.min(Math.max(1, e), max));
  };

  // ── Actions ─────────────────────────────────────────
  const run = useCallback(async (work: () => Promise<string>) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const message = await work();
      onDone?.(message);
      onClose();
    } catch {
      setSaveError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, onDone, onClose]);

  /** Start tracking if needed; removes the title from the watchlist like the details screen. */
  const ensureTracked = async () => {
    if (!target || !bundle) throw new Error('not loaded');
    if (!tracked) {
      await startWatching(bundle.item);
      if (inWatchlist) await removeFromWatchlist(target.tmdbId, target.mediaType);
    }
  };

  const name = target?.title ?? '';

  const watchedMovie = () => run(async () => {
    if (!target) return '';
    await ensureTracked();
    await updateProgress(target.tmdbId, 'movie', { movieCompleted: true });
    await markCompleted(target.tmdbId, 'movie');
    return historyCount > 0 ? `Logged a rewatch of ${name}` : `Marked ${name} as watched`;
  });

  const watchingNow = () => run(async () => {
    if (!target) return '';
    if (tracked) await resume(target.tmdbId, target.mediaType);
    else await ensureTracked();
    return `Started watching ${name}`;
  });

  const caughtUp = () => run(async () => {
    if (!target) return '';
    await ensureTracked();
    await markCaughtUp(target.tmdbId, 'tv');
    return `Marked ${name} as caught up`;
  });

  const completed = () => run(async () => {
    if (!target) return '';
    await ensureTracked();
    await markCompleted(target.tmdbId, 'tv');
    return `Marked ${name} as completed`;
  });

  const watchingFrom = () => run(async () => {
    if (!target || !bundle) return '';
    await ensureTracked();
    const watched = watchedAtPosition(seasons, pickSeason, pickEpisode);
    const resumeStatus = tracked && tracked.status !== 'watching' && tracked.status !== 'rewatching'
      ? { status: 'watching' as const } : {};
    await updateProgress(target.tmdbId, 'tv', {
      currentSeason: pickSeason,
      currentEpisode: pickEpisode,
      episodesWatched: watched,
      ...resumeStatus,
    });
    return `${name}: watched through S${pickSeason} E${pickEpisode}`;
  });

  const confirmWatchlist = async (priority: WatchlistPriority, whyAdded: string) => {
    if (!target || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const it = bundle?.item;
      await addToWatchlist({
        priority,
        why_added: whyAdded.trim() || undefined,
        id: target.tmdbId,
        media_type: target.mediaType,
        title: target.title,
        poster_path: target.posterPath,
        backdrop_path: bundle?.meta.backdropPath ?? null,
        vote_average: it?.rating ?? 0,
        vote_count: bundle?.meta.voteCount ?? 0,
        runtime: it?.runtime ?? null,
        episode_count: it?.totalEpisodes ?? null,
        episode_runtime: it?.episodeRuntime ?? null,
        genres: it?.genres ?? [],
        release_date: bundle?.meta.releaseDate || target.releaseDate || '',
        overview: bundle?.meta.overview ?? '',
      });
      setShowWatchlist(false);
      onDone?.(`Added ${name} to your watchlist`);
      onClose();
    } catch {
      setShowWatchlist(false);
      setSaveError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addToUpcoming = () => run(async () => {
    if (!target) return '';
    await addUpcoming({
      tmdbId: target.tmdbId,
      mediaType: target.mediaType,
      title: target.title,
      posterPath: target.posterPath,
      releaseDate: bundle?.meta.releaseDate || target.releaseDate || null,
    });
    return `Added ${name} to Upcoming`;
  });

  const openDetails = () => {
    if (!target) return;
    onClose();
    router.push({ pathname: '/content/[id]', params: { id: target.tmdbId, media_type: target.mediaType } } as any);
  };

  if (!mounted || !target) return null;

  const releaseDate = bundle?.meta.releaseDate || target.releaseDate || '';
  const isUnreleased = !!releaseDate && releaseDate.slice(0, 10) > localDateKey();
  const year = releaseDate.slice(0, 4);
  const poster = tmdbImage(target.posterPath, 'w185');
  const canWatchlist = !inWatchlist && !tracked;
  const disabled = saving;

  const trackedProgress = tracked && isTv
    ? `S${tracked.currentSeason ?? 1} E${tracked.currentEpisode ?? 1}` +
      (tracked.episodesWatched ? ` · ${tracked.episodesWatched} watched` : '')
    : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdrop }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
          <View style={s.handleArea} {...pan.panHandlers}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            {poster ? (
              <Image source={{ uri: poster }} style={s.poster} />
            ) : (
              <View style={[s.poster, s.posterFallback]}>
                <Ionicons name="film-outline" size={22} color="#52525B" />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.title} numberOfLines={2}>{target.title}</Text>
              <Text style={s.meta}>
                {[year, isTv ? 'TV Series' : 'Movie'].filter(Boolean).join(' · ')}
              </Text>
              <View style={s.stateRow}>
                {tracked ? (
                  <>
                    <StatusPill status={tracked.status} />
                    {trackedProgress ? <Text style={s.stateText}>{trackedProgress}</Text> : null}
                  </>
                ) : (
                  <Text style={s.stateText}>Not tracked</Text>
                )}
                {historyCount > 0 ? (
                  <Text style={s.stateText}>
                    {tracked ? '· ' : ''}Watched {historyCount}× before
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: SCREEN_H * 0.55 }}
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <Skeleton />
            ) : loadError ? (
              <View style={s.errorBox}>
                <Ionicons name="cloud-offline-outline" size={26} color="#71717A" />
                <Text style={s.errorText}>Couldn't load this title.</Text>
                <Pressable style={s.retry} onPress={() => setRetryKey(k => k + 1)}>
                  <Ionicons name="refresh" size={14} color={ACCENT} />
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : bundle ? (
              <>
                {!isTv ? (
                  <>
                    <ActionButton
                      primary icon="checkmark-circle" disabled={disabled}
                      label="Watched it"
                      sub={historyCount > 0 ? 'Log another watch' : undefined}
                      onPress={watchedMovie}
                    />
                    {tracked?.status !== 'watching' && tracked?.status !== 'rewatching' ? (
                      <ActionButton icon="play-circle-outline" label="Watching now" disabled={disabled} onPress={watchingNow} />
                    ) : null}
                  </>
                ) : (
                  <>
                    {ended ? (
                      <ActionButton
                        primary icon="checkmark-done-circle" label="Completed" disabled={disabled}
                        sub="Watched every episode" onPress={completed}
                      />
                    ) : (
                      <ActionButton
                        primary icon="checkmark-done" label="Caught up" disabled={disabled}
                        sub="Watched every aired episode" onPress={caughtUp}
                      />
                    )}
                    <ActionButton
                      icon="play-skip-forward-outline" label="Watching from…" disabled={disabled}
                      sub={showFrom ? undefined : 'Pick the last episode you watched'}
                      onPress={() => setShowFrom(v => !v)}
                    />
                    {showFrom ? (
                      <View style={s.fromBox}>
                        {seasons.length > 1 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {seasons.map(x => {
                              const active = x.season === pickSeason;
                              return (
                                <Pressable
                                  key={x.season} onPress={() => chooseSeason(x.season)}
                                  style={[s.chip, active && s.chipActive]}
                                >
                                  <Text style={[s.chipText, active && s.chipTextActive]}>S{x.season}</Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        ) : null}
                        <Text style={s.fromLabel}>Last episode watched</Text>
                        <View style={s.stepper}>
                          <Pressable
                            style={s.stepBtn} disabled={pickEpisode <= 1}
                            onPress={() => setPickEpisode(e => Math.max(1, e - 1))}
                          >
                            <Ionicons name="remove" size={20} color={pickEpisode <= 1 ? '#3F3F46' : '#fff'} />
                          </Pressable>
                          <Text style={s.stepValue}>S{pickSeason} · E{pickEpisode}
                            {seasonEpCount < 999 ? <Text style={s.stepOf}>{`  / ${seasonEpCount}`}</Text> : null}
                          </Text>
                          <Pressable
                            style={s.stepBtn} disabled={pickEpisode >= seasonEpCount}
                            onPress={() => setPickEpisode(e => Math.min(seasonEpCount, e + 1))}
                          >
                            <Ionicons name="add" size={20} color={pickEpisode >= seasonEpCount ? '#3F3F46' : '#fff'} />
                          </Pressable>
                        </View>
                        {seasonEpCount < 999 ? (
                          <ScrollView style={{ maxHeight: 108 }} nestedScrollEnabled>
                            <View style={s.grid}>
                              {Array.from({ length: seasonEpCount }, (_, i) => i + 1).map(n => {
                                const active = n === pickEpisode;
                                return (
                                  <Pressable
                                    key={n} onPress={() => setPickEpisode(n)}
                                    style={[s.cell, n < pickEpisode && s.cellDone, active && s.cellActive]}
                                  >
                                    <Text style={[s.cellText, active && { color: '#000' }]}>{n}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </ScrollView>
                        ) : null}
                        <Pressable style={[s.save, disabled && { opacity: 0.5 }]} disabled={disabled} onPress={watchingFrom}>
                          <Text style={s.saveText}>Save progress</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            {/* Actions that don't need the fetched payload */}
            {canWatchlist && !loading ? (
              <ActionButton
                icon="bookmark-outline" label="Add to Watchlist" disabled={disabled}
                onPress={() => setShowWatchlist(true)}
              />
            ) : null}
            {isUnreleased && !upcomingSaved ? (
              <ActionButton
                icon="notifications-outline" label="Add to Upcoming" disabled={disabled}
                sub={`Releases ${releaseDate.slice(0, 10)}`} onPress={addToUpcoming}
              />
            ) : null}
            <ActionButton icon="open-outline" label="Open details" disabled={disabled} onPress={openDetails} />

            {saveError ? <Text style={s.saveError}>{saveError}</Text> : null}
            {saving ? <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 4 }} /> : null}
          </ScrollView>
        </Animated.View>
      </View>

      <AddToWatchlistSheet
        visible={showWatchlist}
        title={target.title}
        loading={saving}
        onConfirm={confirmWatchlist}
        onCancel={() => setShowWatchlist(false)}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 28,
  },
  handleArea: { paddingTop: 10, paddingBottom: 14, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  header: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingBottom: 16 },
  poster: { width: 64, height: 96, borderRadius: 10, backgroundColor: '#1A1A1A' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  meta: { color: '#71717A', fontSize: 13, fontWeight: '500' },
  stateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  stateText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  body: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  skeletonRow: { height: 56, borderRadius: 14, backgroundColor: '#1F1F1F' },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
  actionLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionSub: { color: '#71717A', fontSize: 12, fontWeight: '500', marginTop: 1 },
  fromBox: {
    gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fromLabel: {
    color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: ACCENT },
  chipText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: ACCENT },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  stepValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  stepOf: { color: '#52525B', fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    minWidth: 36, height: 32, paddingHorizontal: 6, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cellDone: { backgroundColor: 'rgba(16,185,129,0.14)' },
  cellActive: { backgroundColor: ACCENT },
  cellText: { color: '#D4D4D8', fontSize: 12, fontWeight: '700' },
  save: { alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: ACCENT },
  saveText: { color: '#000', fontSize: 14, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  errorText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: ACCENT,
  },
  retryText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  saveError: { color: '#F87171', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
