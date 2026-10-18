import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { GenreStats } from '../../types';
import { DirectorStat } from '../../services/watchingStore';
import { ACCENT, SectionTitle, sh } from './shared';

function Row({ g, ratio, i }: { g: GenreStats; ratio: number; i: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: ratio, duration: 700, delay: 200 + i * 80, useNativeDriver: false }).start();
  }, [ratio]);
  return (
    <View style={s.row}>
      <Text style={s.name} numberOfLines={1}>{g.name}</Text>
      <View style={s.track}>
        <Animated.View style={[s.fill, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={s.count}>{g.count}</Text>
    </View>
  );
}

export default function GenreBars({ genres, directors }: { genres: GenreStats[]; directors: DirectorStat[] }) {
  const top = genres.slice(0, 5);
  const max = Math.max(1, ...top.map(g => g.count));
  return (
    <>
      {top.length > 0 && (
        <View style={sh.section}>
          <SectionTitle title="Top genres" />
          <View style={[sh.card, { gap: 12 }]}>
            {top.map((g, i) => <Row key={g.name} g={g} ratio={g.count / max} i={i} />)}
          </View>
        </View>
      )}
      {directors.length > 0 && (
        <View style={sh.section}>
          <SectionTitle title="Top directors" />
          <View style={sh.card}>
            {directors.map((d, idx) => (
              <View key={d.name} style={[s.dRow, idx > 0 && s.dBorder]}>
                <Text style={s.rank}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.dName} numberOfLines={1}>{d.name}</Text>
                  <Text style={s.dTitles} numberOfLines={1}>{d.titles.slice(0, 3).join(' · ')}</Text>
                </View>
                <Text style={s.dCount}>{d.count}</Text>
                <Text style={s.dUnit}>{d.count === 1 ? 'title' : 'titles'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600', width: 92 },
  track: { flex: 1, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: ACCENT },
  count: { color: '#fff', fontSize: 13, fontWeight: '800', minWidth: 24, textAlign: 'right' },
  dRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rank: { color: '#71717A', fontSize: 13, fontWeight: '800', width: 18, textAlign: 'center' },
  dName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dTitles: { color: '#71717A', fontSize: 11, fontWeight: '500', marginTop: 2 },
  dCount: { color: '#fff', fontSize: 16, fontWeight: '800' },
  dUnit: { color: '#71717A', fontSize: 10, fontWeight: '600', width: 30 },
});
