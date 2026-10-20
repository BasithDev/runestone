import React, { useCallback, useMemo } from 'react';
import { Modal, View, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Text } from './ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MIN_YEAR = 1950;
const COLUMNS = 4;
const { height: SH } = Dimensions.get('window');

interface Props {
  visible: boolean;
  value: number | null;
  onSelect: (year: number | null) => void;
  onClose: () => void;
}

/** Bottom sheet to pick a release year (or "Any year"). Next year first, back to 1950. */
export default function YearPickerSheet({ visible, value, onSelect, onClose }: Props) {
  const years = useMemo(() => {
    const max = new Date().getFullYear() + 1; // include announced titles
    const list: (number | null)[] = Array.from({ length: max - MIN_YEAR + 1 }, (_, i) => max - i);
    while (list.length % COLUMNS !== 0) list.push(null); // keep the last row's cells grid-sized
    return list;
  }, []);
  const insets = useSafeAreaInsets();

  const pick = useCallback((y: number | null) => { onSelect(y); onClose(); }, [onSelect, onClose]);

  const renderYear = useCallback(({ item: y }: { item: number | null }) =>
    y === null ? <View style={s.cellSpacer} /> : (
      <Pressable style={[s.cell, value === y && s.cellActive]} onPress={() => pick(y)}>
        <Text style={[s.cellText, value === y && s.cellTextActive]}>{y}</Text>
      </Pressable>
    ), [value, pick]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(32, insets.bottom + 16) }]} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>Release year</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#A1A1AA" />
            </Pressable>
          </View>

          <Pressable style={[s.anyBtn, value === null && s.cellActive]} onPress={() => pick(null)}>
            <Text style={[s.cellText, value === null && s.cellTextActive]}>Any year</Text>
          </Pressable>

          <FlatList
            data={years}
            keyExtractor={(y, i) => (y === null ? `pad-${i}` : String(y))}
            numColumns={COLUMNS}
            style={{ maxHeight: SH * 0.45 }}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={renderYear}
            extraData={value}
            initialNumToRender={20}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3F3F46', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  anyBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cellSpacer: { flex: 1 },
  cellActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)' },
  cellText: { color: '#A1A1AA', fontSize: 14, fontWeight: '700' },
  cellTextActive: { color: '#10B981' },
});
