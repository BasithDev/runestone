import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ScrollView, Text, View, Pressable, StyleSheet, Dimensions,
  Animated, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWatching } from '../../context/WatchingContext';
import {
  CONTENT_TYPES, MONTH_NAMES,
} from '../../types';

const { width: SW } = Dimensions.get('window');

// ── Animated Counter ──────────────────────────────────
function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    return () => anim.removeListener(listener);
  }, [value]);

  return <Text style={[s.counterValue, { color }]}>{display.toLocaleString()}</Text>;
}

// ── Stats Card ────────────────────────────────────────
function StatMetric({ label, value, shortLabel, color }: { label: string; value: number; shortLabel: string; color: string }) {
  return (
    <View style={s.metricCard}>
      <View style={[s.metricIcon, { backgroundColor: color + '18' }]}>
        <Text style={[s.metricShort, { color }]}>{shortLabel}</Text>
      </View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

// ── Progress Bar ──────────────────────────────────────
function GenreBar({ name, percentage, color, count }: { name: string; percentage: number; color: string; count: number }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: percentage, duration: 800, useNativeDriver: false }).start();
  }, [percentage]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.genreRow}>
      <View style={s.genreLabelRow}>
        <Text style={s.genreName}>{name}</Text>
        <Text style={[s.genreCount, { color }]}>{count}</Text>
      </View>
      <View style={s.genreTrack}>
        <Animated.View style={[s.genreFill, { width: animatedWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const {
    lifetimeStats, currentStreak, longestStreak,
    availableYears, history,
    getPeriodStats, getGenreStats, directorStats,
  } = useWatching();

  // Year/month filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [yearModalVisible, setYearModalVisible] = useState(false);

  // Derived
  const periodStats = useMemo(
    () => getPeriodStats(selectedYear, selectedMonth),
    [selectedYear, selectedMonth, getPeriodStats]
  );
  const genreStats = useMemo(() => getGenreStats(), [getGenreStats]);
  const totalContent = lifetimeStats.movies + lifetimeStats.series + lifetimeStats.anime + lifetimeStats.other;

  // Hours breakdown
  const totalHours = lifetimeStats.totalHours;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Current year months for chips
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthsToShow = selectedYear === currentYear
    ? MONTH_NAMES.slice(0, currentMonth)
    : MONTH_NAMES;

  const isEmpty = history.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

        {/* ── Header ──────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Stats</Text>
        </View>

        {isEmpty ? (
          /* ── Empty State ─────────────────────────────── */
          <View style={s.emptyWrap}>
            <View style={s.emptyIconCircle}>
              <Ionicons name="bar-chart-outline" size={40} color="#3F3F46" />
            </View>
            <Text style={s.emptyTitle}>No watch history yet</Text>
            <Text style={s.emptySubtext}>
              Start watching content and mark items as completed to see your stats here.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Time Invested Hero ───────────────────── */}
            <View style={s.heroCard}>
              <LinearGradient
                colors={['rgba(16,185,129,0.08)', 'rgba(16,185,129,0.02)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={s.heroTopRow}>
                <Ionicons name="time-outline" size={16} color="#10B981" />
                <Text style={s.heroLabel}>Total Time Invested</Text>
              </View>
              <View style={s.heroValueRow}>
                <AnimatedCounter value={days} color="#fff" />
                <Text style={s.heroUnit}>d</Text>
                <AnimatedCounter value={hours} color="#fff" />
                <Text style={s.heroUnit}>h</Text>
              </View>
              <Text style={s.heroSubtext}>{totalHours.toLocaleString()} hours across {totalContent} titles</Text>
            </View>

            {/* ── Lifetime Collection ──────────────────── */}
            <View style={s.sectionWrap}>
              <Text style={s.sectionTitle}>Lifetime Collection</Text>
              <View style={s.metricsGrid}>
                {CONTENT_TYPES.map(ct => (
                  <StatMetric
                    key={ct.key}
                    label={ct.label}
                    shortLabel={ct.shortLabel}
                    color={ct.color}
                    value={lifetimeStats[ct.key as keyof typeof lifetimeStats] as number || 0}
                  />
                ))}
              </View>
            </View>

            {/* ── Year/Month Filter ─────────────────────── */}
            <View style={s.sectionWrap}>
              <View style={s.filterHeaderRow}>
                <Text style={s.sectionTitle}>Period Breakdown</Text>
                <Pressable style={s.yearPicker} onPress={() => setYearModalVisible(true)}>
                  <Text style={s.yearPickerText}>{selectedYear}</Text>
                  <Ionicons name="chevron-down" size={14} color="#10B981" />
                </Pressable>
              </View>

              {/* Month chips */}
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginBottom: 16 }}
              >
                <Pressable
                  style={[s.monthChip, selectedMonth === null && s.monthChipActive]}
                  onPress={() => setSelectedMonth(null)}
                >
                  <Text style={[s.monthChipText, selectedMonth === null && s.monthChipTextActive]}>All</Text>
                </Pressable>
                {monthsToShow.map((m, idx) => (
                  <Pressable
                    key={idx}
                    style={[s.monthChip, selectedMonth === idx + 1 && s.monthChipActive]}
                    onPress={() => setSelectedMonth(selectedMonth === idx + 1 ? null : idx + 1)}
                  >
                    <Text style={[s.monthChipText, selectedMonth === idx + 1 && s.monthChipTextActive]}>{m}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Period stats card */}
              <View style={s.periodCard}>
                <View style={s.periodRow}>
                  <View style={s.periodItem}>
                    <Text style={[s.periodValue, { color: '#10B981' }]}>{periodStats.movies}</Text>
                    <Text style={s.periodLabel}>Movies</Text>
                  </View>
                  <View style={s.periodItem}>
                    <Text style={[s.periodValue, { color: '#3B82F6' }]}>{periodStats.series}</Text>
                    <Text style={s.periodLabel}>Series</Text>
                  </View>
                  <View style={s.periodItem}>
                    <Text style={[s.periodValue, { color: '#A855F7' }]}>{periodStats.anime}</Text>
                    <Text style={s.periodLabel}>Anime</Text>
                  </View>
                  <View style={s.periodItem}>
                    <Text style={[s.periodValue, { color: '#F59E0B' }]}>{periodStats.other}</Text>
                    <Text style={s.periodLabel}>Docs & Other</Text>
                  </View>
                </View>
                <View style={s.periodHours}>
                  <Ionicons name="time-outline" size={13} color="#52525B" />
                  <Text style={s.periodHoursText}>{periodStats.hours}h this {selectedMonth ? MONTH_NAMES[(selectedMonth || 1) - 1] : 'year'}</Text>
                </View>
              </View>
            </View>

            {/* ── Most Watched Genres ──────────────────── */}
            {genreStats.length > 0 && (
              <View style={s.sectionWrap}>
                <Text style={s.sectionTitle}>Most Watched Genres</Text>
                <View style={s.genresCard}>
                  {genreStats.slice(0, 5).map(g => (
                    <GenreBar key={g.name} name={g.name} percentage={g.percentage} color={g.color} count={g.count} />
                  ))}
                </View>
              </View>
            )}

            {/* ── Top Directors ───────────────────────── */}
            {directorStats.length > 0 && (
              <View style={s.sectionWrap}>
                <Text style={s.sectionTitle}>Top Directors</Text>
                <View style={s.genresCard}>
                  {directorStats.map((d, idx) => (
                    <View key={d.name} style={s.directorRow}>
                      <Text style={s.directorRank}>{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.directorName} numberOfLines={1}>{d.name}</Text>
                        <Text style={s.directorTitles} numberOfLines={1}>{d.titles.slice(0, 3).join(' · ')}</Text>
                      </View>
                      <Text style={s.directorCount}>{d.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Streak ──────────────────────────────── */}
            <View style={s.sectionWrap}>
              <Text style={s.sectionTitle}>Watching Streak</Text>
              <View style={s.streakRow}>
                <View style={s.streakCard}>
                  <Ionicons name="flame" size={22} color="#10B981" />
                  <Text style={s.streakValue}>{currentStreak}</Text>
                  <Text style={s.streakLabel}>Current</Text>
                </View>
                <View style={s.streakCard}>
                  <Ionicons name="trophy" size={22} color="#F59E0B" />
                  <Text style={s.streakValue}>{longestStreak}</Text>
                  <Text style={s.streakLabel}>Best</Text>
                </View>
              </View>
            </View>
          </>
        )}

      </Animated.View>

      {/* ── Year Picker Modal ──────────────────────────── */}
      <Modal visible={yearModalVisible} transparent animationType="fade" onRequestClose={() => setYearModalVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setYearModalVisible(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Select Year</Text>
            {availableYears.map(y => (
              <Pressable
                key={y}
                style={[s.modalItem, y === selectedYear && s.modalItemActive]}
                onPress={() => { setSelectedYear(y); setSelectedMonth(null); setYearModalVisible(false); }}
              >
                <Text style={[s.modalItemText, y === selectedYear && s.modalItemTextActive]}>{y}</Text>
                {y === selectedYear && <Ionicons name="checkmark" size={18} color="#10B981" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  directorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  directorRank: { color: '#52525B', fontSize: 13, fontWeight: '800', width: 18, textAlign: 'center' },
  directorName: { color: '#E5E2E1', fontSize: 14, fontWeight: '700' },
  directorTitles: { color: '#52525B', fontSize: 11, fontWeight: '500', marginTop: 2 },
  directorCount: { color: '#10B981', fontSize: 16, fontWeight: '800' },

  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },

  // Empty state
  emptyWrap: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 80 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  emptySubtext: { color: '#52525B', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  // Hero
  heroCard: {
    marginHorizontal: 20, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)', padding: 24, overflow: 'hidden', marginBottom: 24,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  heroLabel: { color: '#71717A', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  heroUnit: { color: '#52525B', fontSize: 16, fontWeight: '600' },
  heroSubtext: { color: '#3F3F46', fontSize: 11, fontWeight: '500' },
  counterValue: { fontSize: 42, fontWeight: '900', letterSpacing: -2 },

  // Section
  sectionWrap: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { color: '#E5E2E1', fontSize: 16, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },

  // Metrics
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, backgroundColor: '#121212', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 14, alignItems: 'center',
  },
  metricIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  metricShort: { fontSize: 12, fontWeight: '900' },
  metricValue: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  metricLabel: { color: '#52525B', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Filter
  filterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  yearPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  yearPickerText: { color: '#10B981', fontSize: 13, fontWeight: '700' },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  monthChipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' },
  monthChipText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  monthChipTextActive: { color: '#10B981' },

  // Period
  periodCard: {
    backgroundColor: '#121212', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 18,
  },
  periodRow: { flexDirection: 'row', justifyContent: 'space-around' },
  periodItem: { alignItems: 'center' },
  periodValue: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  periodLabel: { color: '#52525B', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  periodHours: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  periodHoursText: { color: '#52525B', fontSize: 12, fontWeight: '600' },

  // Genres
  genresCard: {
    backgroundColor: '#121212', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 18, gap: 14,
  },
  genreRow: { gap: 6 },
  genreLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  genreName: { color: '#E5E2E1', fontSize: 13, fontWeight: '600' },
  genreCount: { fontSize: 12, fontWeight: '800' },
  genreTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  genreFill: { height: '100%', borderRadius: 3 },

  // Streak
  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1, backgroundColor: '#121212', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 20, alignItems: 'center', gap: 8,
  },
  streakValue: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  streakLabel: { color: '#52525B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  modalContent: {
    width: '100%', backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', padding: 20,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4,
  },
  modalItemActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
  modalItemText: { color: '#A1A1AA', fontSize: 16, fontWeight: '600' },
  modalItemTextActive: { color: '#10B981' },
});
