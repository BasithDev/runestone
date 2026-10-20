import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WatchLogEntry } from '../../types';
import { dailyActivity, formatDuration } from '../../services/statsInsights';
import { ACCENT, CountUp, EMPTY_CELL, GrowBar } from './shared';

function StripBar({ ratio, today, i }: { ratio: number; today: boolean; i: number }) {
  return (
    <View style={s.stripCol}>
      <GrowBar
        axis="y"
        delay={300 + i * 30}
        replayKey={ratio}
        style={[
          s.stripBar,
          { height: 3 + ratio * 41, backgroundColor: ratio > 0 ? ACCENT : EMPTY_CELL, opacity: today ? 1 : 0.55 },
        ]}
      />
    </View>
  );
}

export default function HeroCard({ watchLog, titles, streak }: { watchLog: WatchLogEntry[]; titles: number; streak: number }) {
  const totalMinutes = useMemo(() => Math.max(0, watchLog.reduce((a, e) => a + e.minutes, 0)), [watchLog]);
  const episodes = useMemo(() => watchLog.reduce((a, e) => a + (e.episodes > 0 ? e.episodes : 0), 0), [watchLog]);
  const days = useMemo(() => dailyActivity(watchLog, 14), [watchLog]);
  const max = Math.max(1, ...days.map(d => d.minutes));
  const last14 = days.reduce((a, d) => a + d.minutes, 0);

  return (
    <View style={s.card}>
      <LinearGradient
        colors={['rgba(16,185,129,0.10)', 'rgba(16,185,129,0.02)', 'transparent']}
        style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <View style={s.topRow}>
        <Ionicons name="time-outline" size={16} color={ACCENT} />
        <Text style={s.label}>Total watch time</Text>
      </View>
      <CountUp value={totalMinutes} style={s.big} format={n => formatDuration(n)} />

      <View style={s.miniRow}>
        <View style={s.mini}>
          <CountUp value={titles} style={s.miniVal} />
          <Text style={s.miniLabel}>Titles</Text>
        </View>
        <View style={s.divider} />
        <View style={s.mini}>
          <CountUp value={episodes} style={s.miniVal} />
          <Text style={s.miniLabel}>Episodes</Text>
        </View>
        <View style={s.divider} />
        <View style={s.mini}>
          <View style={s.flameRow}>
            <Ionicons name="flame" size={18} color={ACCENT} />
            <CountUp value={streak} style={s.miniVal} />
          </View>
          <Text style={s.miniLabel}>Day streak</Text>
        </View>
      </View>

      <View style={s.stripHead}>
        <Text style={s.stripTitle}>Last 14 days</Text>
        <Text style={s.stripTitle}>{formatDuration(last14)}</Text>
      </View>
      <View style={s.strip}>
        {days.map((d, i) => (
          <StripBar key={d.date} ratio={d.minutes / max} today={i === days.length - 1} i={i} />
        ))}
      </View>
      <View style={s.stripFoot}>
        <Text style={s.stripTitle}>14d ago</Text>
        <Text style={[s.stripTitle, { color: '#fff' }]}>Today</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.18)',
    backgroundColor: '#121212', padding: 20, overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  big: { color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -2, marginBottom: 16 },
  miniRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  mini: { flex: 1, alignItems: 'center' },
  miniVal: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  miniLabel: { color: '#71717A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.08)' },
  stripHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stripTitle: { color: '#71717A', fontSize: 10, fontWeight: '700' },
  strip: { flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 2 },
  stripCol: { flex: 1, justifyContent: 'flex-end', height: 48 },
  stripBar: { width: '100%', borderRadius: 4 },
  stripFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
