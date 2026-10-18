// ── Local notifications ───────────────────────────────
// NOTE: scheduled local notifications need a development build
// (`npx expo run:android` / EAS dev build). They are not supported in Expo Go
// (Android, SDK 53+) and are skipped entirely on web.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getUpcomingItems } from './upcomingStore';
import { titleKey, parseLocalDate } from '../types';

export const RELEASES_CHANNEL = 'releases';
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

let channelReady = false;
async function ensureChannel() {
  if (!supported || channelReady || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(RELEASES_CHANNEL, {
      name: 'Releases & OTT',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    channelReady = true;
  } catch { /* ignore */ }
}

// Permission is requested lazily. A grant is cached for the session; a denial
// is cached too (so we never nag), except when we merely couldn't ask: in the
// background task there is no UI to show the prompt, so only check there.
let permissionPromise: Promise<boolean> | null = null;

export function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return Promise.resolve(false);
  if (!permissionPromise) {
    const p = (async () => {
      try {
        await ensureChannel();
        const cur = await Notifications.getPermissionsAsync();
        if (cur.granted) return true;
        if (!cur.canAskAgain) return false;
        if (AppState.currentState !== 'active') { permissionPromise = null; return false; }
        const res = await Notifications.requestPermissionsAsync();
        return res.granted;
      } catch { permissionPromise = null; return false; }
    })();
    permissionPromise = p;
  }
  return permissionPromise;
}

export interface NotifData {
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  screen?: 'alerts';
}

/** Schedule at a future date. Returns the notification id, or null. */
export async function scheduleNotificationAt(
  date: Date, title: string, body: string, data: NotifData,
): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null;
  if (!(await ensureNotificationPermission())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data as Record<string, unknown> },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: RELEASES_CHANNEL },
    });
  } catch { return null; }
}

/** Show a notification right now. */
export async function notifyNow(title: string, body: string, data: NotifData): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data as Record<string, unknown> },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: RELEASES_CHANNEL },
    });
  } catch { /* ignore */ }
}

export async function cancelNotification(id: string | null | undefined): Promise<void> {
  if (!supported || !id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
}

/** Opens the right screen when a notification is tapped. Use once in the root layout. */
export function useNotificationRouting() {
  // Required lazily so the background-task path (which imports this file) never loads the router.
  const router = (require('expo-router') as typeof import('expo-router')).useRouter();
  const last = Notifications.useLastNotificationResponse();
  const id = last?.notification.request.identifier;

  useEffect(() => {
    if (!last) return;
    const data = (last.notification.request.content.data ?? {}) as NotifData;
    if (data.screen === 'alerts') {
      router.push('/alerts' as any);
    } else if (data.tmdbId) {
      router.push({
        pathname: '/content/[id]',
        params: { id: data.tmdbId, media_type: data.mediaType ?? 'movie' },
      } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

// ── Release reminders ─────────────────────────────────
// 7 days before at 10:00 and on release day at 09:00 (local time).
const REMINDERS_KEY = '@runestone_release_reminders';

interface ReminderEntry { date: string; ids: string[] }
type ReminderMap = Record<string, ReminderEntry>;

async function loadReminders(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

let syncChain: Promise<void> = Promise.resolve();

/** Reconciles scheduled release reminders with the upcoming list. Calls are serialised. */
export function syncReleaseReminders(): Promise<void> {
  if (!supported) return Promise.resolve();
  const run = syncChain.then(doSync, doSync);
  syncChain = run.catch(() => {});
  return run;
}

async function doSync(): Promise<void> {
  const items = await getUpcomingItems();
  const stored = await loadReminders();
  const next: ReminderMap = {};
  const now = Date.now();

  const wanted = new Map<string, (typeof items)[number]>();
  for (const it of items) {
    if (it.releaseDate && parseLocalDate(it.releaseDate).getTime() + 86400000 > now) {
      wanted.set(titleKey(it.mediaType, it.tmdbId), it);
    }
  }

  // Cancel removed items and changed dates.
  for (const [key, entry] of Object.entries(stored)) {
    const it = wanted.get(key);
    if (it && it.releaseDate === entry.date) {
      next[key] = entry;
    } else {
      await Promise.all(entry.ids.map(cancelNotification));
    }
  }

  // Schedule new ones.
  for (const [key, it] of wanted) {
    if (next[key]) continue;
    const rel = parseLocalDate(it.releaseDate!);
    const before = new Date(rel); before.setDate(before.getDate() - 7); before.setHours(10, 0, 0, 0);
    const day = new Date(rel); day.setHours(9, 0, 0, 0);
    const data: NotifData = { tmdbId: it.tmdbId, mediaType: it.mediaType };
    const ids: string[] = [];
    const a = await scheduleNotificationAt(before, `${it.title} releases in 1 week`, `Coming ${it.releaseDate} in India.`, data);
    if (a) ids.push(a);
    const b = await scheduleNotificationAt(day, `${it.title} releases today`, 'Out in India today.', data);
    if (b) ids.push(b);
    // Only remember entries that actually scheduled something (or whose times are all past).
    if (ids.length > 0 || day.getTime() <= now) next[key] = { date: it.releaseDate!, ids };
  }

  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
}
