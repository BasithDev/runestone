import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT, CountUp, ScalePressable, SectionTitle, sh } from './shared';

function Card({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <ScalePressable style={s.card}>
        <Ionicons name={icon} size={24} color={color} />
        <View style={s.valRow}>
          <CountUp value={value} style={s.val} />
          <Text style={s.unit}>{value === 1 ? 'day' : 'days'}</Text>
        </View>
        <Text style={s.label}>{label}</Text>
      </ScalePressable>
    </View>
  );
}

export default function StreakCards({ current, best }: { current: number; best: number }) {
  return (
    <View style={sh.section}>
      <SectionTitle title="Streaks" />
      <View style={s.row}>
        <Card icon="flame" color={ACCENT} value={current} label="Current" />
        <Card icon="trophy" color="#F59E0B" value={best} label="Best" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: '#121212', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 18, gap: 8, alignItems: 'flex-start',
  },
  valRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  val: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  unit: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  label: { color: '#71717A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
