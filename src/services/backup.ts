// ── Backup & restore ──────────────────────────────────
// Exports the user's own data (watching, history, watchlist, upcoming) as a
// JSON file and restores it. Device-specific state — OTT check cache,
// alert feed and scheduled notification ids — is not exported; it is
// cleared on restore and rebuilt by the alerts services.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { syncReleaseReminders } from './notifications';
import { refreshAll } from './ottTracker';
import { resetOttStore } from './ottStore';
import { runExclusiveWrite } from './watchingStore';

const BACKUP_APP = 'runestone';
const BACKUP_VERSION = 1;

/** Keys holding user data, all JSON arrays. */
const DATA_KEYS = {
  watching: '@runestone_watching',
  history: '@runestone_watch_history',
  watchlist: '@runestone_watchlist',
  upcoming: '@runestone_upcoming',
  watchLog: '@runestone_watch_log',
} as const;
type DataName = keyof typeof DATA_KEYS;

/** Device-specific caches, wiped on restore so they rebuild cleanly. */
const DEVICE_KEYS = ['@runestone_ott', '@runestone_release_reminders'];

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<DataName, unknown[]>;
}

export interface BackupCounts {
  watching: number;
  history: number;
  watchlist: number;
  upcoming: number;
}

// Older backups have no watch log; it's rebuilt from history on restore.

async function readArray(key: string): Promise<unknown[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function countsOf(data: Record<DataName, unknown[]>): BackupCounts {
  return {
    watching: data.watching.length,
    history: data.history.length,
    watchlist: data.watchlist.length,
    upcoming: data.upcoming.length,
  };
}

export async function buildBackup(): Promise<BackupFile> {
  const names = Object.keys(DATA_KEYS) as DataName[];
  const arrays = await Promise.all(names.map(n => readArray(DATA_KEYS[n])));
  const data = Object.fromEntries(names.map((n, i) => [n, arrays[i]])) as Record<DataName, unknown[]>;
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Writes the backup to a file and opens the share sheet (Drive, WhatsApp, Files…). */
export async function exportBackup(): Promise<BackupCounts> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const stamp = backup.exportedAt.slice(0, 10);
  const filename = `runestone-backup-${stamp}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return countsOf(backup.data);
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save Runestone backup',
  });
  return countsOf(backup.data);
}

/** Validates parsed JSON; throws a readable error when it isn't a Runestone backup. */
export function parseBackup(raw: string): BackupFile {
  let json: any;
  try { json = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON.'); }
  if (json?.app !== BACKUP_APP || typeof json.data !== 'object' || json.data === null) {
    throw new Error('This is not a Runestone backup file.');
  }
  if (typeof json.version !== 'number' || json.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Runestone.');
  }
  const data = {} as Record<DataName, unknown[]>;
  for (const name of Object.keys(DATA_KEYS) as DataName[]) {
    const arr = json.data[name] ?? [];
    if (!Array.isArray(arr)) throw new Error(`Backup section "${name}" is damaged.`);
    // Drop null / non-object entries: one bad row would crash every screen that maps over the list.
    data[name] = arr.filter(x => x !== null && typeof x === 'object' && !Array.isArray(x));
  }
  return { app: BACKUP_APP, version: json.version, exportedAt: String(json.exportedAt ?? ''), data };
}

/** Lets the user pick a backup file. Returns null when cancelled. */
export async function pickBackup(): Promise<BackupFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const raw = Platform.OS === 'web' && asset.file
    ? await asset.file.text()
    : await FileSystem.readAsStringAsync(asset.uri);
  return parseBackup(raw);
}

/**
 * Replaces all user data with the backup's. Callers must refresh the
 * contexts afterwards. Alerts are rebuilt in the background.
 */
export async function restoreBackup(backup: BackupFile): Promise<BackupCounts> {
  // Local poster files are device paths; drop them so posters load from TMDb.
  const watchlist = backup.data.watchlist.map((w: any) => ({ ...w, local_poster_uri: null }));

  // Run after pending watching writes (so none lands on top of the restore) and
  // drop the store's in-memory caches afterwards.
  await runExclusiveWrite(async () => {
    await AsyncStorage.multiSet([
      [DATA_KEYS.watching, JSON.stringify(backup.data.watching)],
      [DATA_KEYS.history, JSON.stringify(backup.data.history)],
      [DATA_KEYS.watchlist, JSON.stringify(watchlist)],
      [DATA_KEYS.upcoming, JSON.stringify(backup.data.upcoming)],
    ]);
    // No log in the file (older backup) → remove it so it rebuilds from the restored data.
    if (backup.data.watchLog.length > 0) {
      await AsyncStorage.setItem(DATA_KEYS.watchLog, JSON.stringify(backup.data.watchLog));
    } else {
      await AsyncStorage.removeItem(DATA_KEYS.watchLog);
    }
    await AsyncStorage.multiRemove(DEVICE_KEYS);
  });
  resetOttStore(); // in-memory OTT cache would otherwise outlive the wiped key

  if (Platform.OS !== 'web') {
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
  }
  syncReleaseReminders()
    .then(() => refreshAll({ force: true }))
    .catch(() => {});

  return countsOf(backup.data);
}
