import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import StatusPill from './StatusPill';
import { WatchingStatus } from '../../types';

const ACCENT = '#10B981';
export const SHEET_BG = '#141414';
const BACKDROP_H = 150;

interface Props {
  title: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  meta: string;
  status?: WatchingStatus;
  progress?: string | null;
  historyCount: number;
  onClose: () => void;
}

/** Backdrop + overlapping poster + title/meta/state. Sits in the draggable header. */
function SheetHero({ title, backdropUrl, posterUrl, meta, status, progress, historyCount, onClose }: Props) {
  return (
    <View style={s.hero}>
      <View style={s.backdrop}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        ) : (
          <LinearGradient
            colors={['rgba(16,185,129,0.38)', 'rgba(16,185,129,0.10)', 'rgba(16,185,129,0.04)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(20,20,20,0)', 'rgba(20,20,20,0.55)', SHEET_BG]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.handle} />
      <Pressable style={s.close} onPress={onClose} hitSlop={8} accessibilityLabel="Close">
        <Ionicons name="close" size={16} color="#E4E4E7" />
      </Pressable>

      <View style={s.row}>
        <View style={s.posterShadow}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={s.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          ) : (
            <View style={[s.poster, s.posterFallback]}>
              <Ionicons name="film-outline" size={26} color="#52525B" />
            </View>
          )}
        </View>
        <View style={s.info}>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          <View style={s.stateRow}>
            {status ? (
              <>
                <StatusPill status={status} />
                {progress ? <Text style={s.stateText}>{progress}</Text> : null}
              </>
            ) : (
              <Text style={s.stateText}>Not tracked</Text>
            )}
            {historyCount > 0 ? (
              <Text style={s.stateText}>{status ? '· ' : ''}Watched {historyCount}× before</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(SheetHero);

const s = StyleSheet.create({
  hero: { height: 222 },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: BACKDROP_H,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  handle: {
    position: 'absolute', top: 8, alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)',
  },
  close: {
    position: 'absolute', top: 14, right: 16, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  row: { position: 'absolute', top: 84, left: 20, right: 20, flexDirection: 'row', gap: 14 },
  posterShadow: {
    borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  poster: {
    width: 84, height: 126, borderRadius: 12, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, paddingTop: 34, gap: 5 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 24 },
  meta: { color: '#9A9AA3', fontSize: 13, fontWeight: '600' },
  stateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  stateText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
});

export { ACCENT };
