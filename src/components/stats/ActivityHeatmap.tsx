import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MONTH_NAMES, WatchLogEntry } from '../../types';
import { dailyActivity, DayActivity, formatDuration } from '../../services/statsInsights';
import { EMPTY_CELL, HEAT_STEPS, SectionTitle, sh } from './shared';

const WEEKS = 18;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const dowIdx = (d: Date) => (d.getDay() + 6) % 7; // Mon=0
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function level(min: number, max: number) {
  if (min <= 0) return 0;
  const r = min / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

export default function ActivityHeatmap({ watchLog }: { watchLog: WatchLogEntry[] }) {
  const [sel, setSel] = useState<string | null>(null);

  const { cols, max, monthLabels, byDate } = useMemo(() => {
    const days = dailyActivity(watchLog, 126);
    const byDate = new Map(days.map(d => [d.date, d]));
    // Last column is the current week (Mon..Sun); 18 columns total.
    const today = parse(days[days.length - 1].date);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dowIdx(today) - (WEEKS - 1) * 7);
    const cols: (DayActivity | null)[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: (DayActivity | null)[] = [];
      for (let r = 0; r < 7; r++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + r);
        col.push(byDate.get(keyOf(d)) ?? null);
      }
      cols.push(col);
    }
    const monthLabels: (string | null)[] = cols.map((col, w) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
      const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w - 1) * 7);
      return col.some(Boolean) && (w === 0 || d.getMonth() !== prev.getMonth()) ? MONTH_NAMES[d.getMonth()] : null;
    });
    return { cols, max: Math.max(1, ...days.map(d => d.minutes)), monthLabels, byDate };
  }, [watchLog]);

  const tip = useMemo(() => {
    if (!sel) return null;
    const a = byDate.get(sel);
    if (!a) return null;
    const d = parse(sel);
    const label = `${DOW[dowIdx(d)]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    if (a.episodes <= 0 && a.minutes <= 0) return `${label} · nothing watched`;
    return `${label} · ${a.episodes} episode${a.episodes === 1 ? '' : 's'} · ${formatDuration(a.minutes)}`;
  }, [sel, byDate]);

  return (
    <View style={sh.section}>
      <SectionTitle title="Activity" />
      <View style={sh.card}>
        <Text style={[sh.tip, !tip && sh.tipHint]}>{tip ?? 'Tap a day for details'}</Text>
        <View style={s.monthRow}>
          <View style={s.dowSpacer} />
          {monthLabels.map((m, i) => (
            <View key={i} style={s.monthCell}>
              {m ? <Text style={s.monthText} numberOfLines={1}>{m}</Text> : null}
            </View>
          ))}
        </View>
        <View style={s.grid}>
          <View style={s.dowCol}>
            {DOW.map((d, i) => (
              <View key={d} style={s.dowCell}>
                {i % 2 === 0 ? <Text style={s.dowText}>{d}</Text> : null}
              </View>
            ))}
          </View>
          {cols.map((col, w) => (
            <View key={w} style={s.col}>
              {col.map((c, r) => (
                <Pressable
                  key={r} style={s.cellHit} disabled={!c} hitSlop={2}
                  onPress={() => c && setSel(sel === c.date ? null : c.date)}
                  accessibilityLabel={c ? `${c.date}: ${c.episodes} episodes` : undefined}
                >
                  <View
                    style={[
                      s.cell,
                      { backgroundColor: c ? HEAT_STEPS[level(c.minutes, max)] : 'transparent' },
                      c && sel === c.date && s.cellSel,
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        <View style={s.legend}>
          <Text style={s.legendText}>Less</Text>
          {HEAT_STEPS.map((c, i) => <View key={i} style={[s.legendCell, { backgroundColor: c }]} />)}
          <Text style={s.legendText}>More</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  monthRow: { flexDirection: 'row', height: 14, marginBottom: 2 },
  dowSpacer: { width: 28 },
  monthCell: { flex: 1 },
  monthText: { color: '#71717A', fontSize: 9, fontWeight: '700', width: 30 },
  grid: { flexDirection: 'row' },
  dowCol: { width: 28 },
  dowCell: { flex: 1, justifyContent: 'center' },
  dowText: { color: '#71717A', fontSize: 9, fontWeight: '600' },
  col: { flex: 1 },
  cellHit: { aspectRatio: 1, padding: 1 },
  cell: { flex: 1, borderRadius: 4 },
  cellSel: { borderWidth: 1.5, borderColor: '#fff' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 10 },
  legendText: { color: '#71717A', fontSize: 10, fontWeight: '600', marginHorizontal: 3 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
});
