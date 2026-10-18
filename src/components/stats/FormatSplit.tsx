import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ContentType } from '../../types';
import { LibraryEntry, CHART_TYPE_ORDER } from '../../services/statsInsights';
import { SectionTitle, TYPE_CFG, sh } from './shared';

export default function FormatSplit({
  library, selected, onSelect,
}: {
  library: LibraryEntry[]; selected: ContentType | null; onSelect: (t: ContentType | null) => void;
}) {
  const [tipType, setTipType] = useState<ContentType | null>(null);
  const [w, setW] = useState(0);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, []);

  const rows = useMemo(() => {
    const total = library.length || 1;
    return CHART_TYPE_ORDER.map(t => {
      const count = library.filter(l => l.contentType === t).length;
      return { type: t, count, pct: Math.round((count / total) * 100) };
    });
  }, [library]);

  const shown = rows.filter(r => r.count > 0);
  const tipRow = rows.find(r => r.type === tipType);
  const tip = tipRow
    ? `${TYPE_CFG[tipRow.type].label} · ${tipRow.count} title${tipRow.count === 1 ? '' : 's'} · ${tipRow.pct}%`
    : null;

  return (
    <View style={sh.section}>
      <SectionTitle title="What you watch" />
      <View style={sh.card}>
        <Text style={[sh.tip, !tip && sh.tipHint]}>{tip ?? 'Tap a segment or a row'}</Text>

        <View style={s.track} onLayout={e => setW(e.nativeEvent.layout.width)}>
          <Animated.View style={{ width: grow.interpolate({ inputRange: [0, 1], outputRange: [0, w] }), overflow: 'hidden', borderRadius: 4 }}>
            <View style={[s.barRow, { width: w }]}>
              {shown.map(r => (
                <Pressable
                  key={r.type}
                  hitSlop={{ top: 12, bottom: 12 }}
                  style={{ flex: r.count, opacity: selected && selected !== r.type ? 0.3 : 1 }}
                  onPress={() => setTipType(tipType === r.type ? null : r.type)}
                  accessibilityLabel={`${TYPE_CFG[r.type].label} ${r.count} titles`}
                >
                  <View style={[s.seg, { backgroundColor: TYPE_CFG[r.type].color }]} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>

        <View style={{ marginTop: 14 }}>
          {rows.map(r => {
            const cfg = TYPE_CFG[r.type];
            const active = selected === r.type;
            return (
              <Pressable
                key={r.type}
                onPress={() => { onSelect(active ? null : r.type); setTipType(active ? null : r.type); }}
                style={[s.legendRow, active && s.legendActive]}
              >
                <View style={[s.dot, { backgroundColor: cfg.color }]} />
                <Ionicons name={cfg.icon as any} size={16} color="#A1A1AA" />
                <Text style={s.legendLabel}>{cfg.label}</Text>
                <Text style={s.legendCount}>{r.count}</Text>
                <Text style={s.legendPct}>{r.pct}%</Text>
                <Ionicons name={active ? 'funnel' : 'funnel-outline'} size={13} color={active ? '#10B981' : '#3F3F46'} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: 22, borderRadius: 4 },
  barRow: { flexDirection: 'row', height: 22, gap: 2 },
  seg: { flex: 1, borderRadius: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  legendActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  legendCount: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  legendPct: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', minWidth: 36, textAlign: 'right' },
});
