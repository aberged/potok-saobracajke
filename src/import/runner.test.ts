import { describe, expect, it, vi } from 'vitest';
import type { PotokError, PotokNewChild, PotokSdk } from '../potok';
import { clearCursor, cursorFits, fingerprint, loadCursor, resumeIndex, saveCursor, type Cursor } from './cursor';
import { csvOf } from './report';
import { createRunner, type Progress } from './runner';

type Reply = Awaited<ReturnType<PotokSdk['createChildren']>>;

/**
 * A Potok that keeps keys as the server does: a child whose key is there
 * already comes back with `created: false`. `script` can answer a call
 * otherwise, by its number (from 0); `'lost'` makes the children and then
 * rejects, as a call whose answer never came back.
 */
function fakePotok(script: (call: number, children: PotokNewChild[]) => Reply | 'lost' | null = () => null) {
  const keys = new Map<string, number>();
  let nextId = 1000;
  let call = 0;

  const make = (children: PotokNewChild[]): Reply => ({
    ok: true,
    groups: children.map((child) => {
      const known = keys.get(child.key!);
      if (known !== undefined) return { id: known, key: child.key!, created: false };
      keys.set(child.key!, nextId);
      return { id: nextId++, key: child.key!, created: true };
    }),
  });

  const createChildren = vi.fn<PotokSdk['createChildren']>(async (children) => {
    const answer = script(call++, children);
    if (answer === 'lost') {
      make(children);
      throw new Error('timeout');
    }
    return answer ?? make(children);
  });

  return { api: { createChildren }, keys };
}

const child = (index: number): PotokNewChild => ({ key: `mup:${100_000 + index}`, name: `Nezgoda ${index}`, lat: 44.8, lng: 20.4, pin: 'warning' });

function clock(step = 1_500) {
  let at = 0;
  return { now: () => (at += step), sleep: vi.fn(async (ms: number) => void (at += ms)) };
}

function setup(total: number, api: ReturnType<typeof fakePotok>['api'], extra: Partial<Parameters<typeof createRunner>[0]> = {}) {
  const time = clock();
  const seen: Progress[] = [];
  const confirmed: number[] = [];
  const runner = createRunner({
    api,
    total,
    child,
    now: time.now,
    sleep: time.sleep,
    onProgress: (p) => seen.push(p),
    onConfirmed: (next) => confirmed.push(next),
    ...extra,
  });
  return { runner, seen, confirmed, sleep: time.sleep };
}

const rateLimited: PotokError = { ok: false, error: 'rate_limited' };

describe('runner', () => {
  it('sends every child once, in batches of 50 to start with', async () => {
    const { api, keys } = fakePotok();
    const { runner, confirmed } = setup(120, api);
    const done = await runner.run();

    expect(done).toMatchObject({ status: 'done', next: 120, created: 120, existing: 0, failed: [] });
    expect(keys.size).toBe(120);
    expect(api.createChildren.mock.calls[0][0]).toHaveLength(50);
    expect(api.createChildren.mock.calls[0][1]).toEqual({ onExisting: 'skip' });
    expect(confirmed[0]).toBe(50);
    expect(confirmed.at(-1)).toBe(120);
  });

  it('waits 1, 2 and 4 s when rate limited, then sends the same batch', async () => {
    const { api } = fakePotok((call) => (call < 4 ? rateLimited : null));
    const { runner, sleep, seen } = setup(30, api);
    const done = await runner.run();

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1_000, 2_000, 4_000, 4_000]);
    expect(done).toMatchObject({ status: 'done', created: 30, waits: 4 });
    expect(seen.some((p) => p.status === 'waiting' && p.reason === 'rate_limited')).toBe(true);
    expect(api.createChildren.mock.calls[4][0]).toEqual(api.createChildren.mock.calls[0][0]);
  });

  it('sends a batch again after a timeout, and Potok answers created: false', async () => {
    const { api, keys } = fakePotok((call) => (call === 1 ? 'lost' : null));
    const { runner } = setup(100, api);
    const done = await runner.run();

    const calls = api.createChildren.mock.calls.map(([children]) => children.map((c) => c.key));
    expect(calls).toHaveLength(3);
    expect(calls[2]).toEqual(calls[1]);
    // The lost call made its 50; the runner never heard so, and the same
    // batch sent again finds them there.
    expect(done).toMatchObject({ status: 'done', next: 100, retries: 1, created: 50, existing: 50 });
    expect(keys.size).toBe(100);
  });

  it('treats disconnected like a timeout', async () => {
    const { api } = fakePotok((call) => (call === 0 ? { ok: false, error: 'disconnected' } : null));
    const done = await setup(10, api).runner.run();
    expect(done).toMatchObject({ status: 'done', created: 10, retries: 1 });
  });

  it('notes the child at a bad index as failed and sends the rest', async () => {
    const bad = child(7).key;
    const { api, keys } = fakePotok((_call, children) => {
      const index = children.findIndex((c) => c.key === bad);
      return index === -1 ? null : { ok: false, error: 'invalid_group', index, message: 'Naziv je predugačak.' };
    });
    const { runner } = setup(20, api);
    const done = await runner.run();

    expect(done.failed).toEqual([{ index: 7, key: bad, error: 'invalid_group', message: 'Naziv je predugačak.' }]);
    expect(done).toMatchObject({ status: 'done', next: 20, created: 19 });
    expect(keys.has(bad!)).toBe(false);
    expect(api.createChildren.mock.calls[1][0]).toHaveLength(19);
  });

  it('halves a batch Potok calls invalid without an index', async () => {
    const bad = child(3).key;
    const { api } = fakePotok((_call, children) => (children.some((c) => c.key === bad) ? { ok: false, error: 'invalid_group' } : null));
    const done = await setup(8, api).runner.run();
    expect(done.failed.map((f) => f.index)).toEqual([3]);
    expect(done.created).toBe(7);
  });

  it('stops on forbidden, stale_app and unknown_method', async () => {
    for (const error of ['forbidden', 'stale_app', 'unknown_method'] as const) {
      const { api } = fakePotok((call) => (call === 1 ? { ok: false, error } : null));
      const { runner, confirmed } = setup(200, api);
      const done = await runner.run();
      expect(done).toMatchObject({ status: 'stopped', reason: error, next: 50 });
      expect(confirmed).toEqual([50]);
    }
  });

  it('pauses after the call under way and goes on when resumed', async () => {
    const { api } = fakePotok();
    let runner = null as ReturnType<typeof createRunner> | null;
    const paused = new Promise<void>((resolve) => {
      const made = setup(150, api, {
        onConfirmed: (next) => next === 50 && runner!.pause(),
        onProgress: (p) => p.status === 'paused' && resolve(),
      });
      runner = made.runner;
    });

    const finished = runner!.run();
    await paused;
    expect(runner!.progress).toMatchObject({ status: 'paused', next: 50 });
    expect(api.createChildren).toHaveBeenCalledTimes(1);

    runner!.resume();
    expect(await finished).toMatchObject({ status: 'done', next: 150, created: 150 });
  });

  it('moves the batch size between 25 and 100 toward one to two seconds a call', async () => {
    const fast = fakePotok();
    let at = 0;
    const quick = createRunner({ api: fast.api, total: 400, child, now: () => (at += 100), sleep: async () => {} });
    await quick.run();
    const sizes = fast.api.createChildren.mock.calls.map(([children]) => children.length);
    expect(sizes[0]).toBe(50);
    expect(sizes[1]).toBe(75);
    expect(Math.max(...sizes)).toBe(100);

    const slow = fakePotok();
    let t = 0;
    const heavy = createRunner({ api: slow.api, total: 200, child, now: () => (t += 3_000), sleep: async () => {} });
    await heavy.run();
    expect(slow.api.createChildren.mock.calls.map(([children]) => children.length).slice(0, 3)).toEqual([50, 25, 25]);
  });

  it('says the rate and the time left', async () => {
    const { api } = fakePotok();
    const { runner, seen } = setup(200, api);
    await runner.run();
    const middle = seen.find((p) => p.next === 100 && p.status === 'running')!;
    expect(middle.rate).toBeGreaterThan(0);
    expect(middle.eta).toBeCloseTo(100 / middle.rate!, 5);
  });
});

describe('cursor', () => {
  function memory() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
      size: () => [...map.values()].join('').length,
    };
  }

  const files = [{ name: 'nez-opendata-2025-20260125.xlsx', size: 2_147_424, lastModified: 1_762_868_580_000 }];
  const keys = Array.from({ length: 33_187 }, (_, i) => `mup:${1_510_000 + i}`);

  it('fingerprints the files and the accidents they gave', () => {
    const print = fingerprint(files, keys);
    expect(fingerprint([...files], [...keys])).toBe(print);
    expect(fingerprint([{ ...files[0], lastModified: 1 }], keys)).not.toBe(print);
    expect(fingerprint(files, keys.slice(0, -1))).not.toBe(print);
    expect(fingerprint(files, ['mup:1', ...keys.slice(1)])).not.toBe(print);
    expect(print.length).toBeLessThan(64);
  });

  it('keeps only the fingerprint and the index, and resumes a batch earlier', async () => {
    const storage = memory();
    const print = fingerprint(files, keys);
    const cursor: Cursor = { fingerprint: print, next: 1_250, total: 33_187, batch: 50, files: [files[0].name], savedAt: '2026-11-11T12:00:00Z' };
    expect(saveCursor(storage, cursor)).toBe(true);
    expect(storage.size()).toBeLessThan(400);

    const loaded = loadCursor(storage);
    expect(cursorFits(loaded, print)).toBe(true);
    expect(cursorFits(loaded, 'v1:other')).toBe(false);
    expect(resumeIndex(loaded!)).toBe(1_200);
    expect(resumeIndex({ ...cursor, next: 30 })).toBe(0);

    clearCursor(storage);
    expect(loadCursor(storage)).toBeNull();
  });

  it('goes on from the cursor without making anything twice', async () => {
    const { api, keys: made } = fakePotok();
    const storage = memory();
    const print = 'v1:test';

    // The first run stops (the frame reloads) after three batches.
    let stop = false;
    const first = createRunner({
      api: {
        createChildren: async (children, options) => {
          if (stop) return { ok: false, error: 'stale_app' };
          return api.createChildren(children, options);
        },
      },
      total: 300,
      child,
      now: (() => {
        let t = 0;
        return () => (t += 1_500);
      })(),
      sleep: async () => {},
      onConfirmed: (next, batch) => {
        saveCursor(storage, { fingerprint: print, next, total: 300, batch, files: [], savedAt: '' });
        if (next >= 150) stop = true;
      },
    });
    expect(await first.run()).toMatchObject({ status: 'stopped', next: 150 });

    const cursor = loadCursor(storage)!;
    expect(cursor.next).toBe(150);
    const start = resumeIndex(cursor);
    expect(start).toBe(100);

    api.createChildren.mockClear();
    const second = createRunner({ api, total: 300, child, start, now: () => 0, sleep: async () => {}, batch: { initial: 50 } });
    const done = await second.run();

    expect(api.createChildren.mock.calls[0][0][0].key).toBe(child(100).key);
    expect(done).toMatchObject({ status: 'done', start: 100, next: 300, existing: 50, created: 150 });
    expect(made.size).toBe(300);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCursor(broken)).toBeNull();
    expect(saveCursor(broken, { fingerprint: '', next: 0, total: 0, batch: 50, files: [], savedAt: '' })).toBe(false);
    expect(() => clearCursor(broken)).not.toThrow();
  });
});

describe('report', () => {
  it('writes a CSV Excel reads', () => {
    const csv = csvOf(
      [{ file: 'nez-opendata-2024.xlsx', line: 4, id: '1461279', reason: 'van Srbije', cells: ['1461279', 'BEOGRAD', 'NOVI BEOGRAD', '24.01.2024,08:50', '45767', '44803348', 'Sa mat.stetom', 'SN, "X"', ''] }],
      ['fajl', 'red', 'ID', 'razlog', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    );
    expect(csv.startsWith('﻿fajl,red,ID,razlog,A,')).toBe(true);
    expect(csv).toContain('\r\nnez-opendata-2024.xlsx,4,1461279,van Srbije,1461279,BEOGRAD,NOVI BEOGRAD,"24.01.2024,08:50",45767,44803348,Sa mat.stetom,"SN, ""X""",\r\n');
  });
});
