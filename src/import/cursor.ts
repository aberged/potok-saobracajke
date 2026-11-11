// Where an import got to, so that it can go on after the frame reloads (Potok
// reloads an app after a lost connection). Only a fingerprint of the files and
// the confirmed index are kept: an app has 256 KB of localStorage, and the
// files themselves are picked again.

export type FileInfo = { name: string; size: number; lastModified: number };

export type Cursor = {
  fingerprint: string;
  /** Every accident before this one is in Potok or failed. */
  next: number;
  total: number;
  /** The batch size at the time: a resumed import starts one batch earlier. */
  batch: number;
  /** The files, for the words on screen. */
  files: string[];
  savedAt: string;
};

export type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const CURSOR_KEY = 'saobracajke:cursor';

/** cyrb53: a 53-bit hash, enough to tell two lists of keys apart. */
export function hash(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The files (names, sizes, when they changed), how many accidents they gave
 * and the first and last 100 keys: the same files read the same way give the
 * same fingerprint, and another year or another file does not.
 */
export function fingerprint(files: FileInfo[], keys: string[]): string {
  const list = [...files]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.size - b.size))
    .map((file) => `${file.name}|${file.size}|${file.lastModified}`)
    .join('\n');
  const ends = [...keys.slice(0, 100), '…', ...keys.slice(-100)].join(',');
  return `v1:${keys.length}:${hash(list)}:${hash(ends)}`;
}

export function loadCursor(storage: Storage | null): Cursor | null {
  try {
    const stored: unknown = JSON.parse(storage?.getItem(CURSOR_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return null;
    const cursor = stored as Partial<Cursor>;
    const ok =
      typeof cursor.fingerprint === 'string' &&
      typeof cursor.next === 'number' &&
      typeof cursor.total === 'number' &&
      typeof cursor.batch === 'number' &&
      Array.isArray(cursor.files);
    return ok ? (cursor as Cursor) : null;
  } catch {
    return null;
  }
}

export function saveCursor(storage: Storage | null, cursor: Cursor): boolean {
  try {
    storage?.setItem(CURSOR_KEY, JSON.stringify(cursor));
    return storage !== null;
  } catch {
    return false;
  }
}

export function clearCursor(storage: Storage | null) {
  try {
    storage?.removeItem(CURSOR_KEY);
  } catch {
    // Blocked storage: nothing to clear.
  }
}

/** Where a resumed import starts: one batch before the last confirmed index. */
export function resumeIndex(cursor: Cursor): number {
  return Math.max(0, Math.min(cursor.total, cursor.next) - Math.max(0, cursor.batch));
}

/** The cursor fits these accidents: same files, same reading. */
export const cursorFits = (cursor: Cursor | null, print: string): cursor is Cursor => cursor !== null && cursor.fingerprint === print;

/** localStorage, or null where the frame blocks it. */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
