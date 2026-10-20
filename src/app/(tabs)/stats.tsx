import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ScrollView, View, Pressable, StyleSheet, Modal } from 'react-native';
import { Text } from '../../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedPush } from '../../components/navGuard';
import { Ionicons } from '@expo/vector-icons';
import { useWatching } from '../../context/WatchingContext';
import { ContentType } from '../../types';
import { useTabBarPadding } from '../../components/navGuard';
import { FadeSlide } from '../../components/stats/shared';
import HeroCard from '../../components/stats/HeroCard';
import ActivityHeatmap from '../../components/stats/ActivityHeatmap';
import FormatSplit from '../../components/stats/FormatSplit';
import MonthBars from '../../components/stats/MonthBars';
import GenreBars from '../../components/stats/GenreBars';
import StreakCards from '../../components/stats/StreakCards';
import LibraryList from '../../components/stats/LibraryList';
import RecentActivity from '../../components/stats/RecentActivity';

/**
 * Mount the screen in stages so the tab transition and the first cards
 * animate smoothly: 0 = hero + format split, 1 = charts, 2 = library + feed.
 */
function useStagedMount(stages: number): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= stages) return;
    let raf = 0;
    const t = setTimeout(() => { raf = requestAnimationFrame(() => setStage(n => n + 1)); }, stage === 0 ? 120 : 80);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [stage, stages]);
  return stage;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();
  const bottomPad = useTabBarPadding(20);
  const stage = useStagedMount(2);
  const {
    library, watchLog, currentStreak, longestStreak, availableYears,
    getPeriodStats, getGenreStats, directorStats,
  } = useWatching();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<ContentType | null>(null);
  const [yearModalVisible, setYearModalVisible] = useState(false);

  const periodStats = useMemo(
    () => getPeriodStats(selectedYear, selectedMonth),
    [selectedYear, selectedMonth, getPeriodStats],
  );
  const genreStats = useMemo(() => getGenreStats(), [getGenreStats]);

  const clearMonth = useCallback(() => setSelectedMonth(null), []);
  const isEmpty = library.length === 0 && watchLog.length === 0;

  let idx = 0;
  const next = () => idx++;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <FadeSlide index={next()}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Stats</Text>
          <Pressable
            onPress={() => push('/backup')}
            hitSlop={8}
            accessibilityLabel="Backup and restore"
            style={s.backupBtn}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#A1A1AA" />
          </Pressable>
        </View>
      </FadeSlide>

      {isEmpty ? (
        <FadeSlide index={next()} style={s.emptyWrap}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="bar-chart-outline" size={40} color="#3F3F46" />
          </View>
          <Text style={s.emptyTitle}>No watch history yet</Text>
          <Text style={s.emptySubtext}>
            Start watching something and log episodes — everything you watch shows up here.
          </Text>
        </FadeSlide>
      ) : (
        <>
          <FadeSlide index={next()} style={s.pad}>
            <HeroCard watchLog={watchLog} titles={library.length} streak={currentStreak} />
          </FadeSlide>
          <FadeSlide index={next()}>
            <FormatSplit library={library} selected={typeFilter} onSelect={setTypeFilter} />
          </FadeSlide>
          {stage >= 1 && (<>
          <FadeSlide index={next()}>
            <ActivityHeatmap watchLog={watchLog} />
          </FadeSlide>
          <FadeSlide index={next()}>
            <MonthBars
              watchLog={watchLog} year={selectedYear} onYearPress={() => setYearModalVisible(true)}
              selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} periodStats={periodStats}
            />
          </FadeSlide>
          <FadeSlide index={next()}>
            <GenreBars genres={genreStats} directors={directorStats} />
          </FadeSlide>
          <FadeSlide index={next()}>
            <StreakCards current={currentStreak} best={longestStreak} />
          </FadeSlide>
          </>)}
          {stage >= 2 && (<>
          <FadeSlide index={next()}>
            <LibraryList
              library={library} watchLog={watchLog} year={selectedYear}
              typeFilter={typeFilter} onTypeFilter={setTypeFilter}
              month={selectedMonth} onClearMonth={clearMonth}
            />
          </FadeSlide>
          <FadeSlide index={next()}>
            <RecentActivity watchLog={watchLog} />
          </FadeSlide>
          </>)}
        </>
      )}

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
  header: { paddingHorizontal: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  backupBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  pad: { paddingHorizontal: 20, marginBottom: 24 },

  emptyWrap: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 80 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  emptySubtext: { color: '#71717A', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

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
