import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { WatchLogEntry } from '../../types';
import { recentActivity } from '../../services/statsInsights';
import { SectionTitle, TYPE_CFG, relativeTime, sh } from './shared';

export default function RecentActivity({ watchLog }: { watchLog: WatchLogEntry[] }) {
  const items = useMemo(() => recentActivity(watchLog, 10), [watchLog]);
  if (items.length === 0) return null;
  return (
    <View style={sh.section}>
      <SectionTitle title="Recent activity" />
      <View style={sh.card}>
        {items.map((e, i) => {
          const cfg = TYPE_CFG[e.contentType];
          const verb = e.mediaType === 'movie'
            ? 'Finished'
            : `+${e.episodes} episode${e.episodes === 1 ? '' : 's'}`;
          return (
            <View key={e.id} style={[s.row, i > 0 && s.border]}>
              <View style={s.iconWrap}>
                <Ionicons name={cfg.icon as any} size={16} color="#A1A1AA" />
                <View style={[s.dot, { backgroundColor: cfg.color }]} />
              </View>
              <Text style={s.text} numberOfLines={1}>
                <Text style={s.verb}>{verb}</Text>
                <Text style={s.sep}> · </Text>
                {e.title}
              </Text>
              <Text style={s.time}>{relativeTime(e.at)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  border: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { position: 'absolute', right: 3, bottom: 3, width: 7, height: 7, borderRadius: 4 },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' },
  verb: { color: '#fff', fontWeight: '800' },
  sep: { color: '#71717A' },
  time: { color: '#71717A', fontSize: 11, fontWeight: '600' },
});
