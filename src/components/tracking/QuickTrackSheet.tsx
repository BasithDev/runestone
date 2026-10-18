// Quick-track sheet: pick what to do with a title straight from search results.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWatching } from '../../context/WatchingContext';
import { useWatchlist } from '../../context/WatchlistContext';
import { useUpcoming } from '../../context/UpcomingContext';
import { STATUS_STYLE } from './StatusPill';
import StatusModal, { StatusModalMode } from './StatusModal';
import ActionTile from './ActionTile';
import EpisodePicker from './EpisodePicker';
import Expandable from './Expandable';
import SheetHero, { SHEET_BG } from './SheetHero';
import SheetSkeleton from './SheetSkeleton';
import WatchlistStep from './WatchlistStep';
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
  /** Optional: called when the user picks "Open details" (e.g. to record a recent title). */
  onOpenDetails?: (target: QuickTrackTarget) => void;
}

const ACCENT = '#10B981';
const SCREEN_H = Dimensions.get('window').height;
const MAX_H = SCREEN_H * 0.88;
const NEUTRAL_PILL = '#A1A1AA';
const noop = () => {};

interface PillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
const PillButton = memo(function PillButton({ icon, label, color, busy, disabled, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.pillBtn, { borderColor: `${color}55`, backgroundColor: `${color}18` },
        (disabled && !busy) && { opacity: 0.4 }, pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={busy ? 'hourglass-outline' : icon} size={14} color={color} />
      <Text style={[s.pillBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
});

type RunKey =
  | 'open' | 'watched' | 'watching' | 'caughtUp' | 'completed' | 'from'
  | 'watchlist' | 'upcoming' | 'hold' | 'drop' | 'resume' | 'remove';

export default function QuickTrackSheet({ visible, target, onClose, onDone, onOpenDetails }: QuickTrackSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    startWatching, updateProgress, markCompleted, markCaughtUp, resume, putOnHold, dropItem, remove,
    getItem, getHistoryEntries,
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
  const [busy, setBusy] = useState<RunKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFrom, setShowFrom] = useState(false);
  const [step, setStep] = useState<'main' | 'watchlist'>('main');
  const [statusMode, setStatusMode] = useState<StatusModalMode | null>(null);
  const [pickSeason, setPickSeason] = useState(1);
  const [pickEpisode, setPickEpisode] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const lastRun = useRef<{ key: RunKey; work: () => Promise<string> } | null>(null);

  const tmdbId = target?.tmdbId;
  const mediaType = target?.mediaType;
  const isTv = mediaType === 'tv';

  const tracked = target ? getItem(target.tmdbId, target.mediaType) : undefined;
  const historyCount = target ? getHistoryEntries(target.tmdbId, target.mediaType).length : 0;
  const inWatchlist = target ? isInWatchlist(target.tmdbId, target.mediaType) : false;
  const upcomingSaved = target ? isUpcomingSaved(target.mediaType, target.tmdbId) : false;

  // ── Show / hide animation ───────────────────────────
  const enter = useCallback(() => {
    slide.setValue(SCREEN_H);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, [slide, backdrop]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdrop.setValue(0);
      enter();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: SCREEN_H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The sheet is hidden while StatusModal shows (no stacked Modals); slide back in after.
  const prevStatusMode = useRef<StatusModalMode | null>(null);
  useEffect(() => {
    if (prevStatusMode.current && !statusMode && visible) enter();
    prevStatusMode.current = statusMode;
  }, [statusMode, visible, enter]);

  // Drag the header down to dismiss; resists when pulled up.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => slide.setValue(g.dy > 0 ? g.dy : g.dy / 8),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.8) onCloseRef.current();
      else Animated.spring(slide, { toValue: 0, tension: 120, friction: 12, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(slide, { toValue: 0, tension: 120, friction: 12, useNativeDriver: true }).start();
    },
  }), [slide]);

  // ── Lazy fetch on open ──────────────────────────────
  useEffect(() => {
    if (!visible || tmdbId == null || !mediaType) return;
    let cancelled = false;
    setBundle(null);
    setLoadError(false);
    setLoading(true);
    fetchTrackableBundle(mediaType, tmdbId)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, tmdbId, mediaType, retryKey]);

  // Fresh UI state for each opened title.
  useEffect(() => {
    if (!visible) return;
    setSaveError(null);
    setShowFrom(false);
    setStep('main');
    setStatusMode(null);
    setBusy(null);
  }, [visible, tmdbId, mediaType]);

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

  const chooseSeason = useCallback((n: number) => {
    setPickSeason(n);
    const max = seasons.find(x => x.season === n)?.episodes ?? 9999;
    setPickEpisode(e => Math.min(Math.max(1, e), max));
  }, [seasons]);

  // ── Actions ─────────────────────────────────────────
  const run = useCallback(async (key: RunKey, work: () => Promise<string>) => {
    if (busy) return;
    lastRun.current = { key, work };
    setBusy(key);
    setSaveError(null);
    try {
      const message = await work();
      onDone?.(message);
      onClose();
    } catch {
      setSaveError("Couldn't save. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [busy, onDone, onClose]);

  const retryLast = useCallback(() => {
    const l = lastRun.current;
    if (l) run(l.key, l.work);
  }, [run]);

  /** Start tracking if needed; removes the title from the watchlist like the details screen. */
  const ensureTracked = async () => {
    if (!target || !bundle) throw new Error('not loaded');
    if (!tracked) {
      await startWatching(bundle.item);
      if (inWatchlist) await removeFromWatchlist(target.tmdbId, target.mediaType);
    }
  };

  const name = target?.title ?? '';

  const watchedMovie = () => run('watched', async () => {
    if (!target) return '';
    await ensureTracked();
    await updateProgress(target.tmdbId, 'movie', { movieCompleted: true });
    await markCompleted(target.tmdbId, 'movie');
    return historyCount > 0 ? `Logged a rewatch of ${name}` : `Marked ${name} as watched`;
  });

  const watchingNow = () => run('watching', async () => {
    if (!target) return '';
    if (tracked) await resume(target.tmdbId, target.mediaType);
    else await ensureTracked();
    return `Started watching ${name}`;
  });

  const caughtUp = () => run('caughtUp', async () => {
    if (!target) return '';
    await ensureTracked();
    await markCaughtUp(target.tmdbId, 'tv');
    return `Marked ${name} as caught up`;
  });

  const completed = () => run('completed', async () => {
    if (!target) return '';
    await ensureTracked();
    await markCompleted(target.tmdbId, 'tv');
    return `Marked ${name} as completed`;
  });

  const watchingFrom = () => run('from', async () => {
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

  const confirmWatchlist = (priority: WatchlistPriority, whyAdded: string) => run('watchlist', async () => {
    if (!target) return '';
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
    return `Added ${name} to your watchlist`;
  });

  const addToUpcoming = () => run('upcoming', async () => {
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

  const resumeTracked = () => run('resume', async () => {
    if (!target) return '';
    await resume(target.tmdbId, target.mediaType);
    return `Resumed ${name}`;
  });

  const confirmRemove = () => {
    if (!target) return;
    Alert.alert('Remove from tracking?', `${name} will no longer be tracked.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => run('remove', async () => {
          await remove(target.tmdbId, target.mediaType);
          return `Removed ${name} from tracking`;
        }),
      },
    ]);
  };

  const onStatusConfirm = (text: string, rating: number | null) => {
    const mode = statusMode;
    setStatusMode(null);
    if (!target || !mode) return;
    if (mode === 'hold') {
      run('hold', async () => { await putOnHold(target.tmdbId, target.mediaType, text); return `Put ${name} on hold`; });
    } else {
      run('drop', async () => { await dropItem(target.tmdbId, target.mediaType, text, rating); return `Dropped ${name}`; });
    }
  };
  const cancelStatus = useCallback(() => setStatusMode(null), []);

  const openDetails = () => {
    if (!target) return;
    onOpenDetails?.(target);
    onClose();
    router.push({ pathname: '/content/[id]', params: { id: target.tmdbId, media_type: target.mediaType } } as any);
  };

  const toggleFrom = useCallback(() => setShowFrom(v => !v), []);
  const backToMain = useCallback(() => setStep('main'), []);

  // ── Derived display data ────────────────────────────
  const releaseDate = bundle?.meta.releaseDate || target?.releaseDate || '';
  const isUnreleased = !!releaseDate && releaseDate.slice(0, 10) > localDateKey();
  const rating = bundle?.item.rating ?? 0;
  const meta = useMemo(() => {
    const parts = [releaseDate.slice(0, 4), isTv ? 'Series' : 'Movie'].filter(Boolean);
    if (rating > 0) parts.push(`★ ${rating.toFixed(1)}`);
    return parts.join(' · ');
  }, [releaseDate, isTv, rating]);
  const posterUrl = tmdbImage(target?.posterPath, 'w342');
  const backdropUrl = tmdbImage(bundle?.meta.backdropPath, 'w780');
  const progress = tracked && isTv
    ? `S${tracked.currentSeason ?? 1} E${tracked.currentEpisode ?? 1}` +
      (tracked.episodesWatched ? ` · ${tracked.episodesWatched} watched` : '')
    : null;

  if (!mounted || !target) return null;

  const anyBusy = busy !== null;
  const status = tracked?.status;
  const isActive = status === 'watching' || status === 'rewatching';
  const canHold = isActive || status === 'caught_up';
  const canDrop = !!tracked && status !== 'dropped';
  const canResume = status === 'on_hold' || status === 'dropped';
  const rewatchTone = historyCount > 0;

  return (
    <>
      {!statusMode ? (
        <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
          <View style={{ flex: 1 }}>
            <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdrop }]}>
              <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
            </Animated.View>

            <KeyboardAvoidingView
              style={s.kav}
              pointerEvents="box-none"
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Animated.View
                style={[s.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slide }] }]}
              >
                <View {...pan.panHandlers}>
                  <SheetHero
                    title={target.title}
                    backdropUrl={backdropUrl}
                    posterUrl={posterUrl}
                    meta={meta}
                    status={tracked?.status}
                    progress={progress}
                    historyCount={historyCount}
                    onClose={onClose}
                  />
                </View>

                <ScrollView
                  contentContainerStyle={s.body}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {step === 'watchlist' ? (
                    <WatchlistStep
                      saving={busy === 'watchlist'}
                      onBack={backToMain}
                      onSave={confirmWatchlist}
                    />
                  ) : (
                    <>
                      <View style={s.grid}>
                        <ActionTile
                          icon="open-outline" label="Open details" sub="See the full page"
                          disabled={anyBusy} onPress={openDetails}
                        />

                        {loading ? <SheetSkeleton count={3} /> : null}

                        {bundle && !isTv ? (
                          <>
                            <ActionTile
                              icon="checkmark-circle"
                              color={rewatchTone ? STATUS_STYLE.rewatching.color : STATUS_STYLE.completed.color}
                              label="Watched it"
                              sub={rewatchTone ? 'Log another watch' : 'Mark as completed'}
                              loading={busy === 'watched'} disabled={anyBusy} onPress={watchedMovie}
                            />
                            {!isActive ? (
                              <ActionTile
                                icon="play-circle" color={STATUS_STYLE.watching.color}
                                label="Watching now" sub="Start tracking"
                                loading={busy === 'watching'} disabled={anyBusy} onPress={watchingNow}
                              />
                            ) : null}
                          </>
                        ) : null}

                        {bundle && isTv ? (
                          <>
                            <ActionTile
                              icon="time" color={STATUS_STYLE.caught_up.color}
                              label="Caught up" sub="Watched all aired"
                              loading={busy === 'caughtUp'} disabled={anyBusy} onPress={caughtUp}
                            />
                            {ended ? (
                              <ActionTile
                                icon="checkmark-done-circle" color={STATUS_STYLE.completed.color}
                                label="Completed" sub="Watched every episode"
                                loading={busy === 'completed'} disabled={anyBusy} onPress={completed}
                              />
                            ) : null}
                            <ActionTile
                              icon="play-skip-forward" color={STATUS_STYLE.watching.color}
                              label="Watching from…" sub="Pick an episode"
                              selected={showFrom} disabled={anyBusy} onPress={toggleFrom}
                            />
                          </>
                        ) : null}

                        {!loading && !tracked ? (
                          inWatchlist ? (
                            <ActionTile icon="bookmark" label="In Watchlist" sub="Already saved" disabled onPress={noop} />
                          ) : (
                            <ActionTile
                              icon="bookmark-outline" label="Add to Watchlist" sub="Watch it later"
                              disabled={anyBusy} onPress={() => setStep('watchlist')}
                            />
                          )
                        ) : null}

                        {!loading && isUnreleased && !upcomingSaved ? (
                          <ActionTile
                            icon="notifications-outline" label="Add to Upcoming"
                            sub={`Releases ${releaseDate.slice(0, 10)}`}
                            loading={busy === 'upcoming'} disabled={anyBusy} onPress={addToUpcoming}
                          />
                        ) : null}
                      </View>

                      {loadError ? (
                        <View style={s.errorBox}>
                          <Ionicons name="cloud-offline-outline" size={24} color="#71717A" />
                          <Text style={s.errorText}>Couldn't load this title.</Text>
                          <Pressable style={s.retry} onPress={() => setRetryKey(k => k + 1)}>
                            <Ionicons name="refresh" size={14} color={ACCENT} />
                            <Text style={s.retryText}>Retry</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {bundle && isTv ? (
                        <Expandable open={showFrom}>
                          <EpisodePicker
                            seasons={seasons}
                            season={pickSeason}
                            episode={pickEpisode}
                            onSeason={chooseSeason}
                            onEpisode={setPickEpisode}
                            onSave={watchingFrom}
                            saving={busy === 'from'}
                            disabled={anyBusy}
                          />
                        </Expandable>
                      ) : null}

                      {tracked ? (
                        <View style={s.statusRow}>
                          {canResume ? (
                            <PillButton
                              icon="play" label="Resume" color={STATUS_STYLE.watching.color}
                              busy={busy === 'resume'} disabled={anyBusy} onPress={resumeTracked}
                            />
                          ) : null}
                          {canHold ? (
                            <PillButton
                              icon="pause" label="Put On Hold" color={STATUS_STYLE.on_hold.color}
                              disabled={anyBusy} onPress={() => setStatusMode('hold')}
                            />
                          ) : null}
                          {canDrop ? (
                            <PillButton
                              icon="close-circle-outline" label="Drop" color={STATUS_STYLE.dropped.color}
                              disabled={anyBusy} onPress={() => setStatusMode('drop')}
                            />
                          ) : null}
                          <PillButton
                            icon="trash-outline" label="Remove" color={NEUTRAL_PILL}
                            busy={busy === 'remove'} disabled={anyBusy} onPress={confirmRemove}
                          />
                        </View>
                      ) : null}
                    </>
                  )}

                  {saveError ? (
                    <View style={s.errRow}>
                      <Ionicons name="alert-circle" size={15} color="#F87171" />
                      <Text style={s.saveError}>{saveError}</Text>
                      <Pressable onPress={retryLast} hitSlop={8} disabled={anyBusy}>
                        <Text style={s.retryInline}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </ScrollView>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}

      <StatusModal
        visible={!!statusMode}
        mode={statusMode ?? 'hold'}
        title={target.title}
        onCancel={cancelStatus}
        onConfirm={onStatusConfirm}
      />
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.7)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: MAX_H,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1,
  },
  pillBtnText: { fontSize: 12, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  errorText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: ACCENT,
  },
  retryText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  errRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveError: { color: '#F87171', fontSize: 13, fontWeight: '600' },
  retryInline: { color: '#F87171', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
});
