import React, { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistPriority } from '../../services/watchlistStore';
import { PRIORITIES } from '../lists/priority';

interface Props {
  saving?: boolean;
  onBack: () => void;
  onSave: (priority: WatchlistPriority, why: string) => void;
}

/** Inline "add to watchlist" step: priority segmented control, why-added input, Save. */
function WatchlistStep({ saving, onBack, onSave }: Props) {
  const [priority, setPriority] = useState<WatchlistPriority>('medium');
  const [why, setWhy] = useState('');

  return (
    <View style={s.box}>
      <Pressable onPress={onBack} hitSlop={8} style={s.back} disabled={saving}>
        <Ionicons name="chevron-back" size={16} color="#A1A1AA" />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      <Text style={s.label}>Priority</Text>
      <View style={s.segment}>
        {PRIORITIES.map(p => {
          const active = priority === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPriority(p.key)}
              style={[s.seg, active && { backgroundColor: `${p.color}26`, borderColor: p.color }]}
            >
              <View style={[s.dot, { backgroundColor: p.color }]} />
              <Text style={[s.segText, active && { color: p.color }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Why are you adding this? (optional)</Text>
      <TextInput
        style={s.input}
        value={why}
        onChangeText={setWhy}
        placeholder="e.g. Recommended by a friend"
        placeholderTextColor="#52525B"
        multiline
        maxLength={200}
      />

      <Pressable
        style={[s.save, saving && { opacity: 0.6 }]}
        disabled={saving}
        onPress={() => onSave(priority, why.trim())}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <>
            <Ionicons name="bookmark" size={17} color="#000" />
            <Text style={s.saveText}>Add to Watchlist</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default memo(WatchlistStep);

const s = StyleSheet.create({
  box: { gap: 8 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginBottom: 4 },
  backText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  label: {
    color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 6,
  },
  segment: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 72, textAlignVertical: 'top',
  },
  save: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, marginTop: 8, backgroundColor: '#10B981',
  },
  saveText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
