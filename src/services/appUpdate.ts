// ── In-app update check (GitHub Releases) ─────────────
// The APK is distributed only through GitHub Releases. On launch (when
// online) the app asks GitHub for the latest release; if its version is
// newer than the installed one, the user sees the changelog and can
// download the new APK. The repository must be public for this to work.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const GITHUB_REPO = 'BasithDev/runestone';
export const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

const SKIP_KEY = '@runestone_update_skip';      // version the user chose to skip
const SNOOZE_KEY = '@runestone_update_snooze';  // ISO time until which "Later" applies
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface UpdateInfo {
  version: string;        // e.g. "1.1.0"
  name: string;           // release title
  notes: string;          // release body (markdown changelog)
  publishedAt: string;
  apkUrl: string | null;  // direct APK download, if attached
  apkSize: number | null; // bytes
  pageUrl: string;        // release page on GitHub
}

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Compares "1.2.10" vs "1.2.9" numerically. Returns >0 if a is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Latest release from GitHub, or null when offline / unavailable. */
export async function fetchLatestRelease(timeoutMs = 8000): Promise<UpdateInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null; // 404 when there are no releases or the repo is private
    const r = await res.json();
    const apk = (r.assets ?? []).find((a: any) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk'));
    return {
      version: String(r.tag_name ?? '').replace(/^v/i, ''),
      name: r.name || r.tag_name || 'New version',
      notes: r.body ?? '',
      publishedAt: r.published_at ?? '',
      apkUrl: apk?.browser_download_url ?? null,
      apkSize: typeof apk?.size === 'number' ? apk.size : null,
      pageUrl: r.html_url ?? RELEASES_PAGE,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Update to offer right now, respecting "Skip this version" and "Later".
 * `manual` ignores both (used by an explicit "Check for updates" button).
 */
export async function checkForUpdate(opts: { manual?: boolean } = {}): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null; // APK updates only make sense on Android
  const latest = await fetchLatestRelease();
  if (!latest || !latest.version || compareVersions(latest.version, currentVersion()) <= 0) return null;
  if (opts.manual) return latest;

  try {
    const [skip, snooze] = await Promise.all([AsyncStorage.getItem(SKIP_KEY), AsyncStorage.getItem(SNOOZE_KEY)]);
    if (skip === latest.version) return null;
    if (snooze && Date.now() < Date.parse(snooze)) return null;
  } catch { /* show it */ }
  return latest;
}

export async function snoozeUpdate(): Promise<void> {
  try { await AsyncStorage.setItem(SNOOZE_KEY, new Date(Date.now() + SNOOZE_MS).toISOString()); } catch { /* ignore */ }
}

export async function skipVersion(version: string): Promise<void> {
  try { await AsyncStorage.setItem(SKIP_KEY, version); } catch { /* ignore */ }
}
