import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOttData } from '../components/alerts/useOtt';
import { OttEvent, OttEventKind, clearEvents, markAllRead, markRead } from '../services/ottStore';
import { refreshAll } from '../services/ottTracker';

// Only real updates are shown here — what's being tracked stays behind the scenes.
const KIND: Record<OttEventKind, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = {
  ott_date: { icon: 'calendar', label: 'OTT date', color: '#3B82F6' },
  ott_arrived: { icon: 'play-circle', label: 'Now streaming', color: '#10B981' },
  new_season: { icon: 'albums', label: 'New season', color: '#A855F7' },
  season_date: { icon: 'time', label: 'Premiere date', color: '#F59E0B' },
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function EventCard({ e, index, onPress }: { e: OttEvent; index: number; onPress: () => void }) {
  const k = KIND[e.kind];
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 350, delay: Math.min(index, 8) * 40, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.event, !e.read && styles.eventUnread, pressed && { opacity: 0.8 }]}>
        <View style={[styles.kindBadge, { backgroundColor: k.color + '22' }]}>
          <Ionicons name={k.icon} size={18} color={k.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.eventTop}>
            <Text style={styles.kindLabel}>{k.label}</Text>
            <Text style={styles.time}>{timeAgo(e.createdAt)}</Text>
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
          <Text style={styles.eventMsg}>{e.message}</Text>
        </View>
        {!e.read && <View style={styles.unreadDot} />}
      </Pressable>
    </Animated.View>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { events, titles, unread, lastRefresh } = useOttData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshAll({ force: true }); } finally { setRefreshing(false); }
  };

  const open = (e: OttEvent) => {
    if (!e.read) markRead(e.id);
    router.push({ pathname: '/content/[id]', params: { id: e.tmdbId, media_type: e.mediaType } } as any);
  };

  const { fresh, earlier } = useMemo(() => ({
    fresh: events.filter(e => !e.read),
    earlier: events.filter(e => e.read),
  }), [events]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Alerts</Text>
        {unread > 0 ? (
          <Pressable onPress={() => markAllRead()} hitSlop={8}>
            <Text style={styles.headerAction}>Mark all read</Text>
          </Pressable>
        ) : events.length > 0 ? (
          <Pressable onPress={() => clearEvents()} hitSlop={8}>
            <Text style={[styles.headerAction, { color: '#A1A1AA' }]}>Clear</Text>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />}
      >
        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={34} color="#52525B" />
            </View>
            <Text style={styles.emptyTitle}>No alerts right now</Text>
            <Text style={styles.emptyText}>
              {titles.length > 0
                ? `Keeping an eye on ${titles.length} title${titles.length === 1 ? '' : 's'} for India OTT releases and new seasons. You'll see updates here as soon as something changes.`
                : 'Add titles to your watchlist, upcoming list or start watching something — new OTT releases and seasons will show up here.'}
            </Text>
            {lastRefresh && <Text style={styles.lastChecked}>Last checked {timeAgo(lastRefresh)} · pull down to check now</Text>}
          </View>
        ) : (
          <>
            {fresh.length > 0 && <Text style={styles.section}>New</Text>}
            {fresh.map((e, i) => <EventCard key={e.id} e={e} index={i} onPress={() => open(e)} />)}
            {earlier.length > 0 && <Text style={[styles.section, fresh.length > 0 && { marginTop: 18 }]}>Earlier</Text>}
            {earlier.map((e, i) => <EventCard key={e.id} e={e} index={fresh.length + i} onPress={() => open(e)} />)}
            {lastRefresh && <Text style={[styles.lastChecked, { textAlign: 'center', marginTop: 16 }]}>Last checked {timeAgo(lastRefresh)}</Text>}
          </>
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
  headerAction: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  section: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  event: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: '#121212', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10,
  },
  eventUnread: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.06)' },
  kindBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  kindLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  eventTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  eventMsg: { color: '#D4D4D8', fontSize: 13, marginTop: 2, lineHeight: 18 },
  time: { color: '#71717A', fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginTop: 4 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#71717A', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  lastChecked: { color: '#52525B', fontSize: 11, fontWeight: '600', marginTop: 14 },
});
