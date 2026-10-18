import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StatusModalMode = 'hold' | 'drop';

interface Props {
  visible: boolean;
  mode: StatusModalMode;
  title: string;
  onCancel: () => void;
  onConfirm: (text: string, rating: number | null) => void;
}

/** In-app input sheet for "Put on hold" (note) and "Drop" (reason + optional rating). */
export default function StatusModal({ visible, mode, title, onCancel, onConfirm }: Props) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    if (visible) { setText(''); setRating(null); }
  }, [visible, mode]);

  const isDrop = mode === 'drop';
  const accent = isDrop ? '#F87171' : '#F59E0B';
  const canConfirm = text.trim().length > 0;
  const step = (d: number) =>
    setRating(r => Math.max(0, Math.min(10, (r ?? 5) + d)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={m.card}>
          <Text style={m.title}>{isDrop ? 'Drop' : 'Put On Hold'}</Text>
          <Text style={m.subtitle} numberOfLines={1}>{title}</Text>

          <Text style={m.label}>{isDrop ? 'Why are you dropping it? (required)' : 'Note (required)'}</Text>
          <TextInput
            style={m.input}
            value={text}
            onChangeText={setText}
            placeholder={isDrop ? 'e.g. Lost interest after season 2' : 'e.g. Resume after exams'}
            placeholderTextColor="#52525B"
            multiline
            maxLength={300}
            autoFocus
          />

          {isDrop && (
            <View style={{ marginTop: 16 }}>
              <Text style={m.label}>Your rating (optional)</Text>
              <View style={m.ratingRow}>
                <Pressable style={m.ratingBtn} onPress={() => step(-0.5)} disabled={rating === 0}>
                  <Ionicons name="remove" size={18} color="#A1A1AA" />
                </Pressable>
                <View style={m.ratingValue}>
                  <Ionicons name="star" size={14} color={rating == null ? '#3F3F46' : '#10B981'} />
                  <Text style={[m.ratingText, rating == null && { color: '#52525B' }]}>
                    {rating == null ? '—' : rating.toFixed(1)} / 10
                  </Text>
                </View>
                <Pressable style={m.ratingBtn} onPress={() => step(0.5)} disabled={rating === 10}>
                  <Ionicons name="add" size={18} color="#A1A1AA" />
                </Pressable>
                {rating != null && (
                  <Pressable onPress={() => setRating(null)} hitSlop={8}>
                    <Text style={m.clear}>Clear</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={m.actions}>
            <Pressable style={m.cancelBtn} onPress={onCancel}>
              <Text style={m.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[m.confirmBtn, { backgroundColor: accent, opacity: canConfirm ? 1 : 0.35 }]}
              disabled={!canConfirm}
              onPress={() => onConfirm(text.trim(), isDrop ? rating : null)}
            >
              <Text style={m.confirmText}>{isDrop ? 'Drop' : 'Put On Hold'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#121212', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#71717A', fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 16 },
  label: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    minHeight: 80, maxHeight: 140, textAlignVertical: 'top',
    color: '#fff', fontSize: 14, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBtn: {
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 86, justifyContent: 'center' },
  ratingText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  clear: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: { color: '#A1A1AA', fontSize: 14, fontWeight: '700' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#000', fontSize: 14, fontWeight: '800' },
});
