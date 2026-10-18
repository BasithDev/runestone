// ── Background + foreground refresh ───────────────────
// NOTE: background tasks and scheduled notifications need a development
// build (not Expo Go). `TaskManager.defineTask` must run at module top level,
// so this file is imported from app/_layout.tsx.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { refreshAll, refreshIfStale } from './ottTracker';
import { syncReleaseReminders } from './notifications';
import { subscribeUpcoming } from './upcomingStore';

export const BACKGROUND_TASK = 'runestone-alerts-refresh';
const MIN_INTERVAL_MINUTES = 12 * 60;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      await refreshAll();
      await syncReleaseReminders();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function registerBackgroundTask() {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: MIN_INTERVAL_MINUTES });
  } catch { /* unavailable (e.g. Expo Go) */ }
}

/**
 * Call once from the root layout: registers the background task, runs a
 * refresh on start and when returning to foreground (if > 6 h since the last
 * one), and re-syncs release reminders whenever the upcoming list changes.
 */
export function useAlertsBootstrap() {
  useEffect(() => {
    registerBackgroundTask();
    syncReleaseReminders().catch(() => {});
    refreshIfStale().catch(() => {});

    const unsubUpcoming = subscribeUpcoming(() => { syncReleaseReminders().catch(() => {}); });
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshIfStale().catch(() => {});
        syncReleaseReminders().catch(() => {});
      }
    });
    return () => { unsubUpcoming(); sub.remove(); };
  }, []);
}
