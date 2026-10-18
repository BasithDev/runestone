import React, { useState } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpcoming } from '../../context/UpcomingContext';

interface Props {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  fallbackReleaseDate?: string | null;
}

/** Save / unsave a title to the "My Upcoming" list. Needs <UpcomingProvider>. */
export default function UpcomingToggleButton({ tmdbId, mediaType, title, posterPath, fallbackReleaseDate }: Props) {
  const { isSaved, add, remove } = useUpcoming();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(mediaType, tmdbId);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) await remove(mediaType, tmdbId);
      else await add({ tmdbId, mediaType, title, posterPath, releaseDate: fallbackReleaseDate ?? null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable style={[s.btn, saved && s.btnActive]} onPress={toggle} disabled={busy}>
      {busy ? (
        <ActivityIndicator size="small" color="#10B981" />
      ) : (
        <Ionicons name={saved ? 'notifications' : 'notifications-outline'} size={16} color={saved ? '#10B981' : '#A1A1AA'} />
      )}
      <Text style={[s.text, saved && s.textActive]}>{saved ? 'In My Upcoming' : 'Add to Upcoming'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnActive: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' },
  text: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  textActive: { color: '#10B981' },
});
