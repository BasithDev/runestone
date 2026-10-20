import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { SeasonBreakdown } from '../../types';
import { watchedAtPosition } from '../../services/watchingStore';

const ACCENT = '#10B981';
const GRID_MAX = 60;

interface Props {
  seasons: SeasonBreakdown[];
  season: number;
  episode: number;
  onSeason: (n: number) => void;
  onEpisode: (n: number) => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
}

const Cell = memo(function Cell({ n, filled, onPick }: { n: number; filled: boolean; onPick: (n: number) => void }) {
  return (
    <View style={s.cellWrap}>
      <Pressable
        onPress={() => onPick(n)}
        style={[s.cell, filled ? s.cellFilled : s.cellEmpty]}
        accessibilityLabel={`Episode ${n}`}
      >
        <Text style={[s.cellText, filled && s.cellTextFilled]}>{n}</Text>
      </Pressable>
    </View>
  );
});

const SeasonChip = memo(function SeasonChip({
  season, episodes, active, onPick,
}: { season: number; episodes: number; active: boolean; onPick: (n: number) => void }) {
  return (
    <Pressable onPress={() => onPick(season)} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipTitle, active && s.chipTitleActive]}>S{season}</Text>
      <Text style={[s.chipSub, active && s.chipSubActive]}>{episodes} ep</Text>
    </Pressable>
  );
});

/** Season chips, episode grid (or stepper for long seasons), summary and save button. */
function EpisodePicker({ seasons, season, episode, onSeason, onEpisode, onSave, saving, disabled }: Props) {
  const epCount = seasons.find(x => x.season === season)?.episodes ?? 0;
  const useGrid = epCount > 0 && epCount <= GRID_MAX;

  const total = useMemo(() => seasons.reduce((a, x) => a + x.episodes, 0), [seasons]);
  const watched = useMemo(() => watchedAtPosition(seasons, season, episode), [seasons, season, episode]);
  const numbers = useMemo(() => Array.from({ length: useGrid ? epCount : 0 }, (_, i) => i + 1), [useGrid, epCount]);

  const maxEp = epCount > 0 ? epCount : 9999;

  return (
    <View style={s.box}>
      {seasons.length > 1 ? (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow} nestedScrollEnabled
        >
          {seasons.map(x => (
            <SeasonChip
              key={x.season} season={x.season} episodes={x.episodes}
              active={x.season === season} onPick={onSeason}
            />
          ))}
        </ScrollView>
      ) : null}

      <Text style={s.label}>Last episode watched</Text>

      {useGrid ? (
        <View style={s.grid}>
          {numbers.map(n => <Cell key={n} n={n} filled={n <= episode} onPick={onEpisode} />)}
        </View>
      ) : (
        <View style={s.stepper}>
          <Pressable
            style={s.stepBtn} disabled={episode <= 1}
            onPress={() => onEpisode(Math.max(1, episode - 1))}
          >
            <Ionicons name="remove" size={22} color={episode <= 1 ? '#3F3F46' : '#fff'} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.stepValue}>{episode}</Text>
            {epCount > 0 ? <Text style={s.stepOf}>of {epCount}</Text> : null}
          </View>
          <Pressable
            style={s.stepBtn} disabled={episode >= maxEp}
            onPress={() => onEpisode(Math.min(maxEp, episode + 1))}
          >
            <Ionicons name="add" size={22} color={episode >= maxEp ? '#3F3F46' : '#fff'} />
          </Pressable>
        </View>
      )}

      <Text style={s.summary}>
        {`You've watched up to S${season} E${episode}`}
        {total > 0 ? ` · ${watched} of ${total} episodes` : ''}
      </Text>

      <Pressable
        style={[s.save, (disabled || saving) && { opacity: 0.55 }]}
        disabled={disabled || saving}
        onPress={onSave}
      >
        {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.saveText}>Save progress</Text>}
      </Pressable>
    </View>
  );
}

export default memo(EpisodePicker);

const s = StyleSheet.create({
  box: {
    gap: 12, padding: 14, marginTop: 2, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipRow: { gap: 8 },
  chip: {
    minWidth: 56, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTitle: { color: '#D4D4D8', fontSize: 14, fontWeight: '800' },
  chipTitleActive: { color: '#000' },
  chipSub: { color: '#71717A', fontSize: 10, fontWeight: '600', marginTop: 1 },
  chipSubActive: { color: 'rgba(0,0,0,0.65)' },
  label: {
    color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cellWrap: { width: `${100 / 6}%`, padding: 3 },
  cell: { height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cellFilled: { backgroundColor: ACCENT, borderColor: ACCENT },
  cellEmpty: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.14)' },
  cellText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700' },
  cellTextFilled: { color: '#000' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  stepBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  stepValue: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  stepOf: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  summary: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  save: {
    alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, backgroundColor: ACCENT,
  },
  saveText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
