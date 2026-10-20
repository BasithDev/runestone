import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { OttInfo } from '../../types';
import { formatOttDate, getOttForTitle } from '../../services/ottTracker';

interface Props {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
}

/** India OTT date + streaming providers for a title. */
export default function OttInfoCard({ tmdbId, mediaType }: Props) {
  const [info, setInfo] = useState<OttInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getOttForTitle(tmdbId, mediaType)
      .then(r => { if (alive) setInfo(r); })
      .catch(() => { if (alive) setInfo(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tmdbId, mediaType]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="tv-outline" size={16} color="#10B981" />
        <Text style={styles.title}>Streaming in India</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#10B981" style={{ alignSelf: 'flex-start' }} />
      ) : !info ? (
        <Text style={styles.muted}>Could not load streaming info.</Text>
      ) : (
        <>
          {mediaType === 'movie' && (
            <Text style={info.digitalDate ? styles.value : styles.muted}>
              {info.digitalDate ? `OTT release: ${formatOttDate(info.digitalDate)}` : 'No India OTT date yet'}
            </Text>
          )}
          <Text style={[info.providers.length ? styles.value : styles.muted, mediaType === 'movie' && styles.gap]}>
            {info.providers.length ? `On ${info.providers.join(', ')}` : 'Not streaming in India yet'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1F1F1F' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  value: { color: '#E5E5E5', fontSize: 14 },
  muted: { color: '#737373', fontSize: 14 },
  gap: { marginTop: 4 },
});
