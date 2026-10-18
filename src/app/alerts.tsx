import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOttData } from '../components/alerts/useOtt';
import { OttEvent, OttEventKind, markAllRead } from '../services/ottStore';
import { formatOttDate, refreshAll } from '../services/ottTracker';

const KIND_ICON: Record<OttEventKind, keyof typeof Ionicons.glyphMap> = {
  ott_date: 'calendar-outline',
  ott_arrived: 'play-circle-outline',
  new_season: 'albums-outline',
  season_date: 'calendar-outline',
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { events, titles, unread } = useOttData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshAll({ force: true }); } finally { setRefreshing(false); }
  };

  const open = (e: { tmdbId: number; mediaType: 'movie' | 'tv' }) =>
    router.push({ pathname: '/content/[id]', params: { id: e.tmdbId, media_type: e.mediaType } } as any);

  const sortedTitles = [...titles].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Alerts</Text>
        <Pressable onPress={() => markAllRead()} disabled={unread === 0} hitSlop={8}>
          <Text style={[styles.markAll, unread === 0 && { opacity: 0.35 }]}>Mark all read</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />}
      >
        <Text style={styles.section}>Updates (India)</Text>
        {events.length === 0 ? (
          <Text style={styles.empty}>No updates yet. Pull down to check for OTT and new-season news.</Text>
        ) : (
          events.map((e: OttEvent) => (
            <Pressable key={e.id} style={[styles.event, !e.read && styles.eventUnread]} onPress={() => open(e)}>
              <Ionicons name={KIND_ICON[e.kind]} size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.eventMsg}>{e.message}</Text>
              </View>
              <Text style={styles.time}>{timeAgo(e.createdAt)}</Text>
            </Pressable>
          ))
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>Tracking</Text>
        {sortedTitles.length === 0 ? (
          <Text style={styles.empty}>Titles from Upcoming, your watchlist and shows you are watching appear here.</Text>
        ) : (
          sortedTitles.map(t => (
            <Pressable key={t.titleKey} style={styles.track} onPress={() => open(t)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{t.title}</Text>
                {t.mediaType === 'movie' && (
                  <Text style={t.digitalDate ? styles.trackInfo : styles.trackMuted}>
                    {t.digitalDate ? `OTT: ${formatOttDate(t.digitalDate)}` : 'No India OTT date yet'}
                  </Text>
                )}
                {t.mediaType === 'tv' && t.nextAirDate && (
                  <Text style={styles.trackInfo}>Season {t.nextSeason} premieres {formatOttDate(t.nextAirDate)}</Text>
                )}
                <Text style={t.providers.length ? styles.trackInfo : styles.trackMuted}>
                  {t.providers.length ? t.providers.join(', ') : 'No India streaming yet'}
                </Text>
              </View>
              <Ionicons name={t.mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={18} color="#737373" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  markAll: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  section: { color: '#A3A3A3', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  empty: { color: '#737373', fontSize: 14, lineHeight: 20 },
  event: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: '#1A1A1A', marginBottom: 8,
  },
  eventUnread: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.4)' },
  eventTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  eventMsg: { color: '#D4D4D4', fontSize: 13, marginTop: 2 },
  time: { color: '#737373', fontSize: 11 },
  track: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: '#1A1A1A', marginBottom: 8,
  },
  trackInfo: { color: '#D4D4D4', fontSize: 13, marginTop: 2 },
  trackMuted: { color: '#737373', fontSize: 13, marginTop: 2 },
});
