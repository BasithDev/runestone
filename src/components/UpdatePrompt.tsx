import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateInfo, checkForUpdate, currentVersion, skipVersion, snoozeUpdate } from '../services/appUpdate';

const ACCENT = '#10B981';

/** Minimal markdown for release notes: headings, bullets, bold, plain lines. */
function ChangelogText({ notes }: { notes: string }) {
  const lines = notes.replace(/\r/g, '').split('\n').map(l => l.trimEnd());
  const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\(.+?\)/g, '$1');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((l, i) => {
        if (!l.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = l.match(/^#{1,6}\s+(.*)/);
        if (h) return <Text key={i} style={s.noteHeading}>{clean(h[1])}</Text>;
        const b = l.match(/^\s*[-*+]\s+(.*)/);
        if (b) {
          return (
            <View key={i} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.noteText}>{clean(b[1])}</Text>
            </View>
          );
        }
        return <Text key={i} style={s.noteText}>{clean(l)}</Text>;
      })}
    </View>
  );
}

/**
 * Checks GitHub for a newer APK on launch and whenever the app returns to the
 * foreground (at most every 6 h), and shows the changelog with a download button.
 */
export default function UpdatePrompt() {
  const insets = useSafeAreaInsets();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const lastCheck = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      if (Date.now() - lastCheck.current < 6 * 60 * 60 * 1000) return;
      lastCheck.current = Date.now();
      checkForUpdate().then(u => { if (u) setUpdate(u); }).catch(() => {});
    };
    const t = setTimeout(run, 2500); // let the first screen settle
    const sub = AppState.addEventListener('change', st => { if (st === 'active') run(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  useEffect(() => {
    if (update) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [update, slide]);

  if (!update) return null;

  const close = () => setUpdate(null);
  const download = () => {
    Linking.openURL(update.apkUrl ?? update.pageUrl).catch(() => {});
    close();
  };
  const later = () => { snoozeUpdate(); close(); };
  const skip = () => { skipVersion(update.version); close(); };
  const sizeMb = update.apkSize ? `${(update.apkSize / (1024 * 1024)).toFixed(1)} MB` : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={s.overlay}>
        <Animated.View
          style={[
            s.card,
            { marginBottom: insets.bottom + 16 },
            { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
          ]}
        >
          <View style={s.iconWrap}>
            <Ionicons name="rocket" size={26} color={ACCENT} />
          </View>
          <Text style={s.title}>Update available</Text>
          <Text style={s.versions}>
            v{currentVersion()} <Text style={{ color: '#52525B' }}>→</Text> <Text style={{ color: ACCENT }}>v{update.version}</Text>
            {sizeMb ? <Text style={{ color: '#71717A' }}>  ·  {sizeMb}</Text> : null}
          </Text>

          <Text style={s.sectionLabel}>What's new</Text>
          <ScrollView style={s.notes} contentContainerStyle={{ paddingBottom: 4 }}>
            {update.notes.trim()
              ? <ChangelogText notes={update.notes} />
              : <Text style={s.noteText}>Bug fixes and improvements.</Text>}
          </ScrollView>

          <Pressable style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]} onPress={download}>
            <Ionicons name="download-outline" size={18} color="#000" />
            <Text style={s.primaryText}>Download update</Text>
          </Pressable>
          <Text style={s.hint}>
            Opens the APK download. After it finishes, tap it to install
            {update.apkUrl ? '' : ' (from the release page)'} — your data stays on the phone.
          </Text>
          <View style={s.row}>
            <Pressable style={s.secondary} onPress={later}><Text style={s.secondaryText}>Later</Text></Pressable>
            <Pressable style={s.secondary} onPress={skip}><Text style={[s.secondaryText, { color: '#71717A' }]}>Skip this version</Text></Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', paddingHorizontal: 14 },
  card: {
    backgroundColor: '#141414', borderRadius: 26, padding: 22, maxHeight: '82%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  versions: { color: '#A1A1AA', fontSize: 13, fontWeight: '700', marginTop: 4 },
  sectionLabel: {
    color: '#71717A', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 18, marginBottom: 8,
  },
  notes: { maxHeight: 260, marginBottom: 18 },
  noteHeading: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 6 },
  noteText: { color: '#D4D4D8', fontSize: 13.5, lineHeight: 20, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginTop: 7 },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 15,
  },
  primaryText: { color: '#000', fontSize: 15, fontWeight: '800' },
  hint: { color: '#52525B', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 15 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondary: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: { color: '#D4D4D8', fontSize: 14, fontWeight: '700' },
});
