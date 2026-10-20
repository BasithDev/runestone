import React, { useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../components/ui/Text';
import { useGoBack } from '../components/navGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWatching } from '../context/WatchingContext';
import { useWatchlist } from '../context/WatchlistContext';
import { useUpcoming } from '../context/UpcomingContext';
import { BackupCounts, BackupFile, countsOf, exportBackup, pickBackup, restoreBackup } from '../services/backup';
import { ensureNotificationPermission, scheduleNotificationAt, syncReleaseReminders } from '../services/notifications';
import { refreshAll } from '../services/ottTracker';

function CountsRow({ counts }: { counts: BackupCounts }) {
  const cells = [
    { label: 'Watching', value: counts.watching },
    { label: 'History', value: counts.history },
    { label: 'Watchlist', value: counts.watchlist },
    { label: 'Upcoming', value: counts.upcoming },
  ];
  return (
    <View style={st.countsRow}>
      {cells.map(c => (
        <View key={c.label} style={st.countCell}>
          <Text style={st.countValue}>{c.value}</Text>
          <Text style={st.countLabel}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function BackupScreen() {
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const watching = useWatching();
  const watchlist = useWatchlist();
  const upcoming = useUpcoming();

  const [busy, setBusy] = useState<'export' | 'pick' | 'restore' | 'test' | 'ott' | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const current: BackupCounts = {
    watching: watching.watchingItems.length + watching.awaitingItems.length
      + watching.onHoldItems.length + watching.droppedItems.length,
    history: watching.history.length,
    watchlist: watchlist.watchlist.length,
    upcoming: upcoming.items.length,
  };

  const handleExport = async () => {
    setBusy('export'); setMessage(null);
    try {
      await exportBackup();
      setMessage({ kind: 'ok', text: 'Backup created. Save it somewhere safe, like Google Drive.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Export failed.' });
    } finally { setBusy(null); }
  };

  const handlePick = async () => {
    setBusy('pick'); setMessage(null);
    try {
      const file = await pickBackup();
      if (file) setPending(file);
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Could not read that file.' });
    } finally { setBusy(null); }
  };

  const handleRestore = async () => {
    if (!pending) return;
    setBusy('restore'); setMessage(null);
    try {
      await restoreBackup(pending);
      await Promise.all([watching.refresh(), watchlist.refresh(), upcoming.refresh()]);
      setPending(null);
      setMessage({ kind: 'ok', text: 'Backup restored. Alerts and reminders are being rebuilt.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Restore failed.' });
    } finally { setBusy(null); }
  };

  // ── Developer tools (development builds only) ───────
  const handleTestNotification = async () => {
    setBusy('test'); setMessage(null);
    try {
      if (!(await ensureNotificationPermission())) {
        setMessage({ kind: 'error', text: 'Notification permission is off. Enable it in Android settings for Runestone.' });
        return;
      }
      const id = await scheduleNotificationAt(
        new Date(Date.now() + 5000), 'Runestone test', 'Notifications are working.', { screen: 'alerts' },
      );
      setMessage(id
        ? { kind: 'ok', text: 'Test notification scheduled — it arrives in 5 seconds (try locking the phone).' }
        : { kind: 'error', text: 'Could not schedule a notification on this build.' });
    } finally { setBusy(null); }
  };

  const handleOttCheck = async () => {
    setBusy('ott'); setMessage(null);
    try {
      await syncReleaseReminders();
      await refreshAll({ force: true });
      setMessage({ kind: 'ok', text: 'OTT check finished and reminders re-synced. See the Alerts screen.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'OTT check failed.' });
    } finally { setBusy(null); }
  };

  const exportedOn = pending?.exportedAt
    ? new Date(pending.exportedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={goBack} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
        <Text style={st.headerTitle}>Backup & Restore</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }}>
        <Text style={st.intro}>
          Your data lives only on this phone. Export a backup regularly so you don't lose your history
          if you change or reset your phone.
        </Text>

        {/* ── On this device ─────────────────────────── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>On this phone</Text>
          <CountsRow counts={current} />
        </View>

        {/* ── Export ─────────────────────────────────── */}
        <View style={st.card}>
          <View style={st.cardHeadRow}>
            <Ionicons name="cloud-upload-outline" size={18} color="#10B981" />
            <Text style={st.cardTitle}>Export backup</Text>
          </View>
          <Text style={st.cardText}>
            Saves everything you track to a .json file you can keep in Drive, send to yourself, or store in Files.
          </Text>
          <Pressable style={[st.primaryBtn, busy && st.btnDisabled]} onPress={handleExport} disabled={!!busy}>
            {busy === 'export' ? <ActivityIndicator color="#000" /> : (
              <>
                <Ionicons name="share-outline" size={18} color="#000" />
                <Text style={st.primaryBtnText}>Export & Share</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── Restore ────────────────────────────────── */}
        <View style={st.card}>
          <View style={st.cardHeadRow}>
            <Ionicons name="cloud-download-outline" size={18} color="#3B82F6" />
            <Text style={st.cardTitle}>Restore backup</Text>
          </View>
          <Text style={st.cardText}>
            Pick a Runestone backup file. Restoring replaces everything currently on this phone.
          </Text>

          {!pending ? (
            <Pressable style={[st.secondaryBtn, busy && st.btnDisabled]} onPress={handlePick} disabled={!!busy}>
              {busy === 'pick' ? <ActivityIndicator color="#3B82F6" /> : (
                <>
                  <Ionicons name="document-outline" size={18} color="#3B82F6" />
                  <Text style={st.secondaryBtnText}>Choose Backup File</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={st.preview}>
              <Text style={st.previewTitle}>Backup{exportedOn ? ` from ${exportedOn}` : ''}</Text>
              <CountsRow counts={countsOf(pending.data)} />
              <View style={st.warnRow}>
                <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                <Text style={st.warnText}>This will replace your current data on this phone.</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={[st.cancelBtn, { flex: 1 }]} onPress={() => setPending(null)} disabled={!!busy}>
                  <Text style={st.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[st.dangerBtn, { flex: 1 }, busy && st.btnDisabled]} onPress={handleRestore} disabled={!!busy}>
                  {busy === 'restore' ? <ActivityIndicator color="#000" /> : <Text style={st.dangerBtnText}>Replace & Restore</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {__DEV__ && (
          <View style={st.card}>
            <View style={st.cardHeadRow}>
              <Ionicons name="construct-outline" size={18} color="#A1A1AA" />
              <Text style={st.cardTitle}>Developer tools</Text>
            </View>
            <Text style={st.cardText}>Only visible in development builds.</Text>
            <Pressable style={[st.cancelBtn, busy && st.btnDisabled]} onPress={handleTestNotification} disabled={!!busy}>
              {busy === 'test' ? <ActivityIndicator color="#A1A1AA" /> : <Text style={st.cancelBtnText}>Send test notification (5s)</Text>}
            </Pressable>
            <Pressable style={[st.cancelBtn, busy && st.btnDisabled]} onPress={handleOttCheck} disabled={!!busy}>
              {busy === 'ott' ? <ActivityIndicator color="#A1A1AA" /> : <Text style={st.cancelBtnText}>Run OTT check + reminder sync now</Text>}
            </Pressable>
          </View>
        )}

        {message && (
          <View style={[st.message, message.kind === 'error' ? st.messageError : st.messageOk]}>
            <Ionicons
              name={message.kind === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={16}
              color={message.kind === 'error' ? '#F87171' : '#10B981'}
            />
            <Text style={[st.messageText, { color: message.kind === 'error' ? '#F87171' : '#10B981' }]}>{message.text}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  intro: { color: '#A1A1AA', fontSize: 13, lineHeight: 19 },

  card: { backgroundColor: '#121212', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 18, gap: 12 },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardText: { color: '#71717A', fontSize: 13, lineHeight: 18 },

  countsRow: { flexDirection: 'row', gap: 8 },
  countCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  countValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  countLabel: { color: '#71717A', fontSize: 10, fontWeight: '600', marginTop: 2 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 14, paddingVertical: 14,
  },
  secondaryBtnText: { color: '#3B82F6', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },

  preview: { gap: 12 },
  previewTitle: { color: '#E5E2E1', fontSize: 13, fontWeight: '700' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: { color: '#A1A1AA', fontSize: 14, fontWeight: '700' },
  dangerBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, backgroundColor: '#F59E0B' },
  dangerBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  message: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  messageOk: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  messageError: { backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.25)' },
  messageText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
