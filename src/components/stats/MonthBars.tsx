import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MONTH_NAMES, PeriodStats, WatchLogEntry } from '../../types';
import { formatDuration, monthlyActivity } from '../../services/statsInsights';
import { ACCENT, CHART_ORDER_CFG, EMPTY_CELL, GrowBar, SectionTitle, sh } from './shared';

const BAR_H = 120;

function Bar({ ratio, selected, dim, i, year }: { ratio: number; selected: boolean; dim: boolean; i: number; year: number }) {
  return (
    <GrowBar
      axis="y"
      delay={i * 40}
      duration={550}
      replayKey={`${year}-${ratio}`}
      style={[
        s.bar,
        { height: 4 + ratio * (BAR_H - 4), backgroundColor: ratio > 0 ? ACCENT : EMPTY_CELL, opacity: dim ? 0.35 : 1 },
        selected && s.barSel,
      ]}
    />
  );
}

export default function MonthBars({
  watchLog, year, onYearPress, selectedMonth, onSelectMonth, periodStats,
}: {
  watchLog: WatchLogEntry[]; year: number; onYearPress: () => void;
  selectedMonth: number | null; onSelectMonth: (m: number | null) => void; periodStats: PeriodStats;
}) {
  const months = useMemo(() => monthlyActivity(watchLog, year), [watchLog, year]);
  const max = Math.max(1, ...months.map(m => m.minutes));
  const sel = selectedMonth ? months[selectedMonth - 1] : null;
  const tip = sel
    ? `${MONTH_NAMES[sel.month - 1]} ${year} · ${formatDuration(sel.minutes)} · ${sel.titles} title${sel.titles === 1 ? '' : 's'}`
    : null;

  return (
    <View style={sh.section}>
      <SectionTitle
        title="Year in review"
        right={
          <Pressable style={s.yearPicker} onPress={onYearPress} hitSlop={8}>
            <Text style={s.yearText}>{year}</Text>
            <Ionicons name="chevron-down" size={14} color={ACCENT} />
          </Pressable>
        }
      />
      <View style={sh.card}>
        <Text style={[sh.tip, !tip && sh.tipHint]}>{tip ?? 'Tap a month to filter your library'}</Text>
        <View style={s.chart}>
          {months.map((m, i) => (
            <Pressable
              key={m.month} style={s.col}
              onPress={() => onSelectMonth(selectedMonth === m.month ? null : m.month)}
              accessibilityLabel={`${MONTH_NAMES[i]} ${formatDuration(m.minutes)}`}
            >
              <Bar ratio={m.minutes / max} selected={selectedMonth === m.month} dim={!!selectedMonth && selectedMonth !== m.month} i={i} year={year} />
              <Text style={[s.mLabel, selectedMonth === m.month && { color: '#fff' }]}>{MONTH_NAMES[i][0]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.period}>
          <Text style={s.periodHead}>
            {selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} ${year}` : `All of ${year}`} · {periodStats.hours}h
          </Text>
          <View style={s.periodRow}>
            {CHART_ORDER_CFG.map(c => (
              <View key={c.key} style={s.periodItem}>
                <View style={s.pLine}>
                  <View style={[s.dot, { backgroundColor: c.color }]} />
                  <Text style={s.pVal}>{periodStats[c.key === 'movie' ? 'movies' : c.key]}</Text>
                </View>
                <Text style={s.pLabel} numberOfLines={1}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  yearPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  yearText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_H + 22, gap: 2 },
  col: { flex: 1, height: BAR_H + 22, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barSel: { borderWidth: 1.5, borderColor: '#fff' },
  mLabel: { color: '#71717A', fontSize: 10, fontWeight: '700', marginTop: 6, height: 16 },
  period: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  periodHead: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  periodRow: { flexDirection: 'row', gap: 2 },
  periodItem: { flex: 1 },
  pLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  pLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '600', marginTop: 2 },
});
