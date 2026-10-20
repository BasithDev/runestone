import React, { useEffect, useState } from 'react';
import {
  Modal, View, Pressable, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { WatchlistPriority } from '../../services/watchlistStore';
import { PRIORITIES } from './priority';

interface Props {
  visible: boolean;
  title: string;
  onConfirm: (priority: WatchlistPriority, whyAdded: string) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Edit mode changes labels; pass initial values to pre-fill. */
  mode?: 'add' | 'edit';
  initialPriority?: WatchlistPriority;
  initialWhy?: string;
  subtitle?: string;
}

export default function AddToWatchlistSheet({
  visible, title, onConfirm, onCancel, loading, mode = 'add',
  initialPriority = 'medium', initialWhy = '', subtitle,
}: Props) {
  const [priority, setPriority] = useState<WatchlistPriority>(initialPriority);
  const [why, setWhy] = useState(initialWhy);

  // Reset whenever the sheet is (re)opened.
  useEffect(() => {
    if (visible) {
      setPriority(initialPriority);
      setWhy(initialWhy);
    }
  }, [visible, initialPriority, initialWhy]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <Pressable style={s.overlay} onPress={onCancel}>
          <Pressable style={s.content} onPress={e => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.title} numberOfLines={2}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

            <Text style={s.label}>Priority</Text>
            <View style={s.row}>
              {PRIORITIES.map(p => {
                const active = priority === p.key;
                return (
                  <Pressable
                    key={p.key}
                    style={[s.pill, active && { backgroundColor: p.color + '26', borderColor: p.color }]}
                    onPress={() => setPriority(p.key)}
                  >
                    <View style={[s.dot, { backgroundColor: p.color }]} />
                    <Text style={[s.pillText, active && { color: p.color }]}>{p.label}</Text>
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
              placeholderTextColor="#3F3F46"
              multiline
              maxLength={200}
            />

            <Pressable style={s.confirm} onPress={() => onConfirm(priority, why.trim())} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name={mode === 'edit' ? 'checkmark' : 'bookmark'} size={18} color="#000" />
                  <Text style={s.confirmText}>{mode === 'edit' ? 'Save' : 'Add to Watchlist'}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={s.cancel} onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  content: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: '#71717A', fontSize: 13, fontWeight: '500', marginTop: 4 },
  label: {
    color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#121212', borderRadius: 12, color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 64, textAlignVertical: 'top',
  },
  confirm: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 22,
    backgroundColor: '#10B981',
  },
  confirmText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancel: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});
