// Sends the accidents to Potok in batches through `createChildren`. Every
// child has a key, so a batch sent twice makes nothing twice: what was there
// already comes back with `created: false`. That makes every retry safe.
//
// - Batches start at 50 and move between 25 and 100, so that a call takes
//   one to two seconds.
// - `rate_limited`: wait 1, 2, then 4 s, and send the same batch again.
// - A call that never answers (the SDK gives up after 10 s), `disconnected`,
//   `timeout` or `conflict`: send the same batch again, after a pause that
//   grows.
// - `invalid_group` with `index`: Potok saved nothing. That one child is
//   noted as failed and the rest of the batch goes again.
// - `forbidden`, `stale_app`, `unknown_method` and anything unknown: stop.

import type { PotokError, PotokNewChild, PotokSdk } from '../potok';

export type RunnerApi = Pick<PotokSdk, 'createChildren'>;

export type RunnerStatus = 'idle' | 'running' | 'waiting' | 'retrying' | 'paused' | 'done' | 'stopped';

export type Failure = { index: number; key: string | null; error: string; message: string | null };

export type Progress = {
  status: RunnerStatus;
  /** Every child before this one is in Potok or failed; the next batch starts here. */
  next: number;
  total: number;
  /** Where this run started (a resumed run starts past 0). */
  start: number;
  created: number;
  existing: number;
  failed: Failure[];
  batchSize: number;
  /** Children a second over the last 30 s; null until a batch is through. */
  rate: number | null;
  /** Seconds left at that rate. */
  eta: number | null;
  /** Batches sent again after a call that did not answer. */
  retries: number;
  /** Waits for the rate limit. */
  waits: number;
  /** A pause was asked for and comes after the call under way. */
  pausing: boolean;
  /** Why it waits, retries or stopped: Potok's error code. */
  reason: string | null;
  message: string | null;
};

export type RunnerOptions = {
  api: RunnerApi;
  total: number;
  /** The child at `index`, made when its batch goes out. */
  child: (index: number) => PotokNewChild;
  start?: number;
  onProgress?: (progress: Progress) => void;
  /** After each batch: every child before `next` is in Potok or failed. */
  onConfirmed?: (next: number, batchSize: number) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  batch?: { initial?: number; min?: number; max?: number };
  /** How long a call should take, in ms. */
  target?: { low: number; high: number };
};

export const STOP_ERRORS = new Set(['forbidden', 'stale_app', 'unknown_method', 'not_a_member', 'preview']);
export const RETRY_ERRORS = new Set(['disconnected', 'timeout', 'conflict']);
export const RATE_BACKOFF = [1_000, 2_000, 4_000];
export const RETRY_BACKOFF = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
export const RATE_WINDOW = 30_000;
export const BATCH = { initial: 50, min: 25, max: 100 };
/** Potok takes at most this many children a call. */
export const MAX_CHILDREN = 100;

type Item = { index: number; child: PotokNewChild };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createRunner(options: RunnerOptions) {
  const api = options.api;
  const sleep = options.sleep ?? wait;
  const now = options.now ?? (() => Date.now());
  const min = Math.max(1, options.batch?.min ?? BATCH.min);
  let max = Math.min(MAX_CHILDREN, Math.max(min, options.batch?.max ?? BATCH.max));
  const target = options.target ?? { low: 1_000, high: 2_000 };
  const start = Math.max(0, Math.min(options.total, options.start ?? 0));

  const progress: Progress = {
    status: 'idle',
    next: start,
    total: options.total,
    start,
    created: 0,
    existing: 0,
    failed: [],
    batchSize: Math.min(max, Math.max(min, options.batch?.initial ?? BATCH.initial)),
    rate: null,
    eta: null,
    retries: 0,
    waits: 0,
    pausing: false,
    reason: null,
    message: null,
  };

  let samples: { at: number; count: number }[] = [];
  let since = now();
  let resumeNow: (() => void) | null = null;
  let running: Promise<Progress> | null = null;
  let lastCall: { ms: number; size: number } | null = null;

  const snapshot = (): Progress => ({ ...progress, failed: [...progress.failed] });
  const emit = () => options.onProgress?.(snapshot());

  function measure() {
    const at = now();
    samples = samples.filter((sample) => sample.at > at - RATE_WINDOW);
    const seconds = (at - Math.max(since, at - RATE_WINDOW)) / 1_000;
    const count = samples.reduce((sum, sample) => sum + sample.count, 0);
    progress.rate = seconds > 0 && count > 0 ? count / seconds : null;
    progress.eta = progress.rate ? (progress.total - progress.next) / progress.rate : null;
  }

  /** The next batch's size from how long the last call took. */
  function adapt() {
    if (!lastCall || lastCall.size === 0) return;
    const { ms, size } = lastCall;
    if (ms >= target.low && ms <= target.high) return;

    const aim = (target.low + target.high) / 2;
    const wanted = Math.round((size * aim) / Math.max(ms, 1));
    const current = progress.batchSize;
    const bounded = Math.min(Math.ceil(current * 1.5), Math.max(Math.floor(current / 2), wanted));
    progress.batchSize = Math.min(max, Math.max(min, bounded));
  }

  async function holdIfPaused() {
    if (!progress.pausing) return;
    progress.status = 'paused';
    progress.pausing = false;
    emit();
    await new Promise<void>((resolve) => (resumeNow = resolve));
    resumeNow = null;
    progress.status = 'running';
    progress.reason = null;
    samples = [];
    since = now();
    emit();
  }

  const fail = (item: Item, reply: PotokError) =>
    progress.failed.push({ index: item.index, key: item.child.key ?? null, error: reply.error, message: reply.message ?? null });

  /** Sends `items` until each is in Potok or failed; false if the run stopped. */
  async function send(items: Item[]): Promise<boolean> {
    let pending = items;
    let rateTries = 0;
    let retryTries = 0;

    while (pending.length > 0) {
      await holdIfPaused();

      let reply: Awaited<ReturnType<RunnerApi['createChildren']>>;
      const sent = now();
      try {
        reply = await api.createChildren(
          pending.map((item) => item.child),
          { onExisting: 'skip' },
        );
      } catch {
        // The SDK rejects a call the page did not answer within 10 s. It may
        // have been done all the same, which the keys take care of.
        reply = { ok: false, error: 'timeout' };
      }

      if (reply.ok) {
        for (const group of reply.groups) {
          if (group.created) progress.created++;
          else progress.existing++;
        }
        lastCall = { ms: now() - sent, size: pending.length };
        progress.status = 'running';
        progress.reason = null;
        progress.message = null;
        return true;
      }

      const { error } = reply;
      const index = reply.index;

      if (error === 'invalid_group' && typeof index === 'number' && index >= 0 && index < pending.length) {
        fail(pending[index], reply);
        pending = pending.filter((_, i) => i !== index);
        emit();
        continue;
      }

      if (error === 'invalid_group' || error === 'too_large') {
        if (pending.length === 1) {
          fail(pending[0], reply);
          emit();
          return true;
        }
        // Without an index, or too much at once: the halves, one by one.
        if (error === 'too_large') {
          max = Math.max(1, Math.min(max, Math.floor(pending.length / 2)));
          progress.batchSize = Math.min(progress.batchSize, max);
        }
        const half = Math.ceil(pending.length / 2);
        return (await send(pending.slice(0, half))) && send(pending.slice(half));
      }

      if (error === 'rate_limited') {
        progress.waits++;
        progress.status = 'waiting';
        progress.reason = error;
        progress.message = reply.message ?? null;
        emit();
        await sleep(RATE_BACKOFF[Math.min(rateTries++, RATE_BACKOFF.length - 1)]);
        continue;
      }

      if (RETRY_ERRORS.has(error)) {
        progress.retries++;
        progress.status = 'retrying';
        progress.reason = error;
        progress.message = reply.message ?? null;
        // A call that took too long: the batches after this one are smaller.
        if (error === 'timeout') progress.batchSize = Math.max(min, Math.floor(progress.batchSize / 2));
        emit();
        await sleep(RETRY_BACKOFF[Math.min(retryTries++, RETRY_BACKOFF.length - 1)]);
        continue;
      }

      progress.status = 'stopped';
      progress.reason = error;
      progress.message = reply.message ?? null;
      emit();
      return false;
    }

    return true;
  }

  async function loop(): Promise<Progress> {
    progress.status = 'running';
    since = now();
    emit();

    while (progress.next < progress.total) {
      await holdIfPaused();

      const size = Math.min(progress.batchSize, progress.total - progress.next);
      const items: Item[] = [];
      for (let index = progress.next; index < progress.next + size; index++) items.push({ index, child: options.child(index) });

      lastCall = null;
      if (!(await send(items))) return snapshot();

      progress.next += size;
      samples.push({ at: now(), count: size });
      adapt();
      measure();
      options.onConfirmed?.(progress.next, progress.batchSize);
      emit();
    }

    progress.status = 'done';
    progress.pausing = false;
    progress.eta = 0;
    emit();
    return snapshot();
  }

  return {
    /** Runs to the end or until it stops; a second call gets the same run. */
    run(): Promise<Progress> {
      running ??= loop();
      return running;
    },
    /** Stops after the call under way; `resume` goes on from there. */
    pause() {
      if (progress.status === 'done' || progress.status === 'stopped' || progress.status === 'paused') return;
      progress.pausing = true;
      emit();
    },
    resume() {
      progress.pausing = false;
      if (resumeNow) resumeNow();
      else emit();
    },
    get progress(): Progress {
      return snapshot();
    },
  };
}

export type Runner = ReturnType<typeof createRunner>;
