// @ts-nocheck (node-only script; no @types/node in the app)
// Sanity checks for the pure data/stat functions and the watch log.
// Run: npx tsx scripts/check-stats.ts
import Module from 'module';
import assert from 'assert';

// Stub the native AsyncStorage with an in-memory map before the store loads.
const mem = new Map<string, string>();
const asyncStorage = {
  getItem: async (k: string) => mem.get(k) ?? null,
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
};
const origLoad = (Module as any)._load;
(Module as any)._load = function (req: string, ...rest: any[]) {
  if (req === '@react-native-async-storage/async-storage') return { default: asyncStorage, ...asyncStorage };
  return origLoad.call(this, req, ...rest);
};

let failed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); console.log('ok   ', name); } catch (e: any) { failed++; console.log('FAIL ', name, '\n     ', e.message); }
};

async function main() {
  const ws = require('../src/services/watchingStore');
  const si = require('../src/services/statsInsights');
  const tt = require('../src/services/titleTracking');

  const seasons = [{ season: 1, episodes: 3 }, { season: 2, episodes: 0 }, { season: 3, episodes: 2 }];
  await test('positionFromWatched skips 0-episode seasons', () => {
    assert.deepStrictEqual(ws.positionFromWatched(seasons, 0), { season: 1, episode: 1 });
    assert.deepStrictEqual(ws.positionFromWatched(seasons, 3), { season: 1, episode: 3 });
    assert.deepStrictEqual(ws.positionFromWatched(seasons, 4), { season: 3, episode: 1 });
    assert.deepStrictEqual(ws.positionFromWatched(seasons, 99), { season: 3, episode: 2 });
    assert.deepStrictEqual(ws.positionFromWatched([], 5), { season: 1, episode: 5 });
  });
  await test('watchedAtPosition round-trips and handles unsorted/missing seasons', () => {
    for (let w = 1; w <= 5; w++) {
      const p = ws.positionFromWatched(seasons, w);
      assert.strictEqual(ws.watchedAtPosition(seasons, p.season, p.episode), w);
    }
    assert.strictEqual(ws.watchedAtPosition([...seasons].reverse(), 3, 1), 4);
    assert.strictEqual(ws.watchedAtPosition([], 1, 7), 7);
  });
  await test('1000+ episode single-season show', () => {
    const op = [{ season: 1, episodes: 1100 }];
    assert.strictEqual(ws.watchedAtPosition(op, 1, 1000), 1000);
    assert.deepStrictEqual(ws.positionFromWatched(op, 1100), { season: 1, episode: 1100 });
  });
  await test('airedSeasonBreakdown ignores specials and future episodes', () => {
    const out = tt.airedSeasonBreakdown([
      { season_number: 0, episodes: [{ air_date: '2020-01-01' }] },
      { season_number: 1, episodes: [{ air_date: '2020-01-01' }, { air_date: '2999-01-01' }, {}] },
      { season_number: 2, air_date: '2999-01-01', episodes: [] },
      { season_number: 3 },
    ], '2024-06-01');
    assert.deepStrictEqual(out.map((s: any) => [s.season, s.episodes]), [[1, 1], [2, 0]]);
  });

  const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
  const e = (at: string, episodes = 1, minutes = 45, id = 1) => ({
    id: String(Math.random()), tmdbId: id, mediaType: 'tv', contentType: 'series', title: 't', at, episodes, minutes,
  });
  await test('streak spans month and year boundary', () => {
    const now = new Date();
    const mk = (back: number) => day(now.getFullYear(), now.getMonth() + 1, now.getDate() - back);
    const log = [e(mk(0)), e(mk(1)), e(mk(2)), e(mk(10)), e(mk(11))];
    assert.deepStrictEqual(ws.computeStreak(log), { current: 3, longest: 3 });
    const ny = [e(day(2023, 12, 30)), e(day(2023, 12, 31)), e(day(2024, 1, 1)), e(day(2024, 1, 2))];
    assert.strictEqual(ws.computeStreak(ny).longest, 4);
  });
  await test('streak ignores a day fully unmarked again', () => {
    const now = new Date();
    const t = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
    assert.deepStrictEqual(ws.computeStreak([e(t), e(t, -1, -45)]), { current: 0, longest: 0 });
  });
  await test('period stats use local month and net negative corrections', () => {
    const log = [e(day(2024, 3, 31, 23), 2, 90), e(day(2024, 4, 1, 0), 1, 45, 2), e(day(2024, 4, 2), -1, -45, 2)];
    const mar = ws.computePeriodStats(log, 2024, 3);
    const apr = ws.computePeriodStats(log, 2024, 4);
    assert.strictEqual(mar.series, 1);
    assert.strictEqual(apr.series, 1);
    assert.strictEqual(apr.hours, 0);
    assert.strictEqual(ws.computePeriodStats(log, 2024).series, 2);
  });
  await test('buildLibrary merges history + items and sorts by activity', () => {
    const hist = [{ id: 'h', tmdbId: 1, mediaType: 'movie', contentType: 'movie', title: 'A', posterUrl: null, genres: [], rating: 7, completedAt: day(2024, 1, 1), year: '2020' }];
    const items = [
      { id: 1, tmdbId: 2, mediaType: 'tv', contentType: 'series', title: 'B', posterUrl: null, year: '', status: 'watching', episodesWatched: 2, seasonEpisodes: [{ season: 1, episodes: 10 }], genres: [], rating: 1, startedAt: day(2024, 2, 1), lastWatched: day(2024, 2, 5) },
      { id: 2, tmdbId: 3, mediaType: 'tv', contentType: 'series', title: 'C', posterUrl: null, year: '', status: 'watching', episodesWatched: 0, genres: [], rating: 1, startedAt: day(2024, 2, 1), lastWatched: day(2024, 2, 5) },
    ];
    const lib = si.buildLibrary(hist, items, []);
    assert.deepStrictEqual(lib.map((x: any) => x.title), ['B', 'A']);
    assert.strictEqual(lib[0].totalEpisodes, 10);
  });

  await test('watch log: add / advance / patch / complete log each episode once', async () => {
    const base = { id: 1, tmdbId: 10, mediaType: 'tv', contentType: 'series', title: 'Show', posterUrl: null, year: '', status: 'watching',
      episodesWatched: 0, seasonEpisodes: [{ season: 1, episodes: 3 }], genres: [], rating: 1, episodeRuntime: 30 };
    await ws.addWatchingItem(base);
    await ws.advanceWatchingItem(10, 'tv');
    await ws.patchWatchingItem(10, 'tv', { episodesWatched: 3 });
    await ws.patchWatchingItem(10, 'tv', { episodesWatched: 2 });
    await ws.markAsCompleted(10, 'tv');
    const log = await ws.getWatchLog();
    assert.strictEqual(log.reduce((a: number, x: any) => a + x.episodes, 0), 3);
    assert.strictEqual(log.reduce((a: number, x: any) => a + x.minutes, 0), 90);
    const hist = await ws.getWatchHistory();
    assert.strictEqual(hist.length, 1);
    // rewatch
    const again = await ws.addWatchingItem(base);
    assert.strictEqual(again.status, 'rewatching');
  });
  await test('metadata-only patch does not bump lastWatched', async () => {
    const before = (await ws.getWatchingItem(10, 'tv')).lastWatched;
    await new Promise(r => setTimeout(r, 5));
    await ws.patchWatchingItem(10, 'tv', { showStatus: 'Ended' });
    assert.strictEqual((await ws.getWatchingItem(10, 'tv')).lastWatched, before);
  });
  await test('backfill from legacy data counts once; caches reset on restore', async () => {
    mem.clear();
    ws.resetWatchCaches();
    mem.set('@runestone_watching', JSON.stringify([{ id: 1, tmdbId: 5, mediaType: 'tv', contentType: 'series', title: 'X', status: 'watching', episodesWatched: 4, episodeRuntime: 20, genres: [], rating: 0, startedAt: day(2024, 1, 1), lastWatched: day(2024, 1, 2) }]));
    await ws.patchWatchingItem(5, 'tv', { episodesWatched: 5 });
    const log = await ws.getWatchLog();
    assert.strictEqual(log.reduce((a: number, x: any) => a + x.episodes, 0), 5);
    mem.delete('@runestone_watch_log');
    ws.resetWatchCaches();
    assert.strictEqual((await ws.getWatchLog()).reduce((a: number, x: any) => a + x.episodes, 0), 5);
  });
  await test('corrupt JSON does not crash and is preserved', async () => {
    mem.set('@runestone_watching', '{oops');
    ws.resetWatchCaches();
    assert.deepStrictEqual(await ws.getWatchingItems(), []);
    await new Promise(r => setTimeout(r, 5));
    assert.strictEqual(mem.get('@runestone_watching_corrupt'), '{oops');
  });
  await test('2000-entry log: stats compute quickly', () => {
    const big = Array.from({ length: 5000 }, (_, i) => e(day(2023, 1 + (i % 12), 1 + (i % 28)), 1, 45, i % 300));
    const t0 = Date.now();
    ws.computeStreak(big); ws.computePeriodStats(big, 2023); si.buildLibrary([], [], big); si.dailyActivity(big, 90); si.monthlyActivity(big, 2023);
    assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0}ms`);
  });

  if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
  console.log('\nall passed');
}
main();
