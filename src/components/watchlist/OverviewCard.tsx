import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistItem, WatchlistPriority } from '../../services/watchlistStore';
import { formatDuration } from '../../services/statsInsights';
import { CONTENT_TYPES } from '../../types';
import { PRIORITIES, priorityOf } from '../lists/priority';
import { COLORS } from './utils';

interface Props {
  items: WatchlistItem[];
  stats: { total: number; movies: number; series: number; hours: number };
  selectedPriority: WatchlistPriority | null;
  onSelectPriority: (p: WatchlistPriority | null) => void;
}

const movieCfg = CONTENT_TYPES.find(c => c.key === 'movie')!;
const seriesCfg = CONTENT_TYPES.find(c => c.key === 'series')!;

function OverviewCard({ items, stats, selectedPriority, onSelectPriority }: Props) {
  const minutes = stats.hours * 60;
  const [shown, setShown] = useState(0);
  const count = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    return () => count.removeListener(id);
  }, [count]);

  useEffect(() => {
    // Count-up drives text, so it must run on the JS driver.
    Animated.timing(count, { toValue: minutes, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [minutes, count]);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 600, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const counts = useMemo(() => {
    const c: Record<WatchlistPriority, number> = { high: 0, medium: 0, low: 0 };
    items.forEach(i => { c[priorityOf(i)] += 1; });
    return c;
  }, [items]);

  const toggle = (p: WatchlistPriority) => onSelectPriority(selectedPriority === p ? null : p);

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TIME TO FINISH EVERYTHING</Text>
          <Text style={s.big}>{minutes > 0 ? formatDuration(shown) : '-'}</Text>
        </View>
        <View style={s.typeCol}>
          <View style={s.typeRow}>
            <Ionicons name={movieCfg.icon as any} size={14} color={movieCfg.color} />
            <Text style={s.typeCount}>{stats.movies}</Text>
            <Text style={s.typeLabel}>Movies</Text>
          </View>
          <View style={s.typeRow}>
            <Ionicons name={seriesCfg.icon as any} size={14} color={seriesCfg.color} />
            <Text style={s.typeCount}>{stats.series}</Text>
            <Text style={s.typeLabel}>Series</Text>
          </View>
        </View>
      </View>

      <Text style={s.eyebrow2}>PRIORITY SPLIT</Text>
      <Animated.View
        style={[s.bar, {
          opacity: enter,
          transform: [{ scaleY: enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }]}
      >
        {PRIORITIES.filter(p => counts[p.key] > 0).map(p => {
          const dim = selectedPriority && selectedPriority !== p.key;
          return (
            <Pressable
              key={p.key}
              accessibilityLabel={`${p.label} priority, ${counts[p.key]} items`}
              onPress={() => toggle(p.key)}
              style={[s.seg, { flex: counts[p.key], backgroundColor: p.color, opacity: dim ? 0.3 : 1 }]}
            />
          );
        })}
      </Animated.View>

      <View style={s.legend}>
        {PRIORITIES.map(p => {
          const active = selectedPriority === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => toggle(p.key)}
              style={[s.legendItem, active && s.legendActive]}
            >
              <View style={[s.dot, { backgroundColor: p.color }]} />
              <Text style={s.legendLabel}>{p.label}</Text>
              <Text style={s.legendCount}>{counts[p.key]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export default React.memo(OverviewCard);

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 18,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  eyebrow: { color: COLORS.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  eyebrow2: { color: COLORS.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  big: { color: COLORS.text, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  typeCol: { gap: 8, paddingLeft: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeCount: { color: COLORS.text, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  typeLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '500', width: 44 },
  bar: { flexDirection: 'row', height: 12, gap: 2 },
  seg: { height: 12, borderRadius: 4 },
  legend: { flexDirection: 'row', gap: 8, marginTop: 12 },
  legendItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  legendActive: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.08)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', flex: 1 },
  legendCount: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
});
