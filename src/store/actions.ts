// What the app does: checks the server and the viewer's rights, reads the
// files, builds the accidents, asks Potok for sample descriptions, runs the
// import and writes the report.

import { buildAccidents, samples as pickSamples, yearFromName } from '../data/accidents';
import { ReadError, readSources } from '../data/read';
import { skipKey, type Translate } from '../i18n';
import { childOf } from '../import/children';
import { browserStorage, cursorFits, fingerprint, loadCursor, resumeIndex, saveCursor, type Cursor } from '../import/cursor';
import { csvOf, type ReportLine } from '../import/report';
import { createRunner, type Progress, type Runner } from '../import/runner';
import type { PotokError } from '../potok';
import { state, update, type Blocked } from './state';

let t: Translate;

export function setActionsTranslator(translate: Translate) {
  t = translate;
}

const storage = browserStorage();
let runner: Runner | null = null;
/** Counts sample requests, so that an answer for older accidents is dropped. */
let sampleRound = 0;

/** The pins accidents use: killed, injured, material damage. */
export const ACCIDENT_PINS = ['problem', 'warning', 'transport'];

/** The colour of each pin, from the map's config, for the dots on screen. */
export const pinColors: Record<string, string> = {};

function block(reason: Blocked) {
  update((s) => {
    s.screen = 'blocked';
    s.blocked = reason;
  });
}

function blockFor(error: PotokError['error']): Blocked {
  if (error === 'preview') return 'preview';
  if (error === 'unknown_method') return 'outdated';
  if (error === 'forbidden' || error === 'not_a_member') return 'rights';
  return 'failed';
}

/**
 * The guard: a Potok with `createChildren` and the `warning` pin, and a viewer
 * who may edit the group and make sub-groups in it.
 */
export async function boot() {
  update((s) => {
    s.screen = 'checking';
    s.blocked = null;
    s.cursor = loadCursor(storage);
  });

  const sdk = window.potok;
  if (!sdk || typeof sdk.createChildren !== 'function' || typeof sdk.getMapConfig !== 'function') return block('outdated');

  let group: Awaited<ReturnType<typeof sdk.getGroup>>;
  let map: Awaited<ReturnType<typeof sdk.getMapConfig>>;
  try {
    group = await sdk.getGroup();
    if (!group.ok) return block(blockFor(group.error));
    if (!group.group.can_manage_children || !group.group.can_create_children) return block('rights');

    map = await sdk.getMapConfig();
    if (!map.ok) return block(blockFor(map.error));
  } catch {
    return block('failed');
  }

  const icons = new Map(map.pins.icons.map((look) => [look.key, look]));
  for (const [key, look] of icons) pinColors[key] = map.pins.tones[look.tone] ?? '';
  if (!icons.has('warning')) return block('noWarning');

  const missing = ACCIDENT_PINS.filter((pin) => !icons.has(pin));
  if (missing.length > 0) {
    update((s) => (s.missingPins = missing));
    return block('pins');
  }

  const name = group.group.name;
  const year = yearFromName(name);
  update((s) => {
    s.groupName = name;
    s.groupYear = year;
    s.year = year;
    s.yearText = year === null ? '' : String(year);
    s.screen = 'pick';
  });
}

// --- Year

function readYear(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^(19|20)\d\d$/.test(trimmed) ? Number(trimmed) : undefined;
}

export function typeYear(text: string) {
  update((s) => {
    s.yearText = text;
    s.yearError = readYear(text) === undefined;
  });
}

/** The year field was left: the accidents are built again for the new year. */
export function applyYear() {
  const year = readYear(state.yearText);
  if (year === undefined || year === state.year) return;
  update((s) => (s.year = year));
  if (state.rows.length > 0) {
    rebuild();
    void loadSamples();
  }
}

// --- Files

function rebuild() {
  const built = buildAccidents(state.rows, state.year);
  update((s) => {
    s.built = built;
    s.fingerprint = fingerprint(
      s.files,
      built.accidents.map((accident) => accident.key),
    );
    s.samples = [];
  });
}

export async function pickFiles(list: File[]) {
  if (list.length === 0 || state.screen === 'parsing' || state.screen === 'importing') return;

  update((s) => {
    s.screen = 'parsing';
    s.files = list.map((file) => ({ name: file.name, size: file.size, lastModified: file.lastModified }));
    s.reading = null;
    s.readError = null;
    s.rows = [];
    s.perFile = [];
    s.built = null;
    s.samples = [];
  });

  try {
    const result = await readSources(
      list.map((file) => ({ name: file.name, bytes: async () => new Uint8Array(await file.arrayBuffer()) })),
      { onProgress: (progress) => update((s) => (s.reading = progress)) },
    );
    update((s) => {
      s.rows = result.rows;
      s.perFile = result.perFile;
    });
  } catch (error) {
    update((s) => {
      s.screen = 'pick';
      s.readError = error instanceof ReadError ? { file: error.file, code: error.code } : { file: list[0].name, code: 'unreadable' };
    });
    return;
  }

  rebuild();
  update((s) => (s.screen = 'preview'));
  void loadSamples();
}

/** Three descriptions as Potok will show them; each counts as a write. */
async function loadSamples() {
  const round = ++sampleRound;
  const picked = pickSamples(state.built?.accidents ?? []);
  update((s) => {
    s.samples = picked.map((accident) => ({ accident, child: childOf(accident), html: null, error: null, loading: true }));
  });

  for (const [index, sample] of state.samples.entries()) {
    let html: string | null = null;
    let error: string | null = null;
    try {
      const reply = await window.potok.previewDescription(sample.child.description ?? '', { descriptionFormat: 'markdown' });
      if (reply.ok) html = reply.html;
      else error = reply.message ?? reply.error;
    } catch {
      error = 'timeout';
    }
    if (round !== sampleRound) return;
    update((s) => (s.samples[index] = { ...s.samples[index], html, error, loading: false }));
  }
}

export function otherFiles() {
  update((s) => {
    s.screen = 'pick';
    s.readError = null;
  });
}

// --- Import

/** Where an earlier import of these very files got to, if it did. */
export function fittingCursor(): Cursor | null {
  return cursorFits(state.cursor, state.fingerprint ?? '') ? state.cursor : null;
}

export function startImport(from = 0) {
  const built = state.built;
  const print = state.fingerprint;
  if (!built || !print || built.accidents.length === 0 || state.screen === 'importing') return;

  const accidents = built.accidents;
  const files = state.files.map((file) => file.name);
  const save = (next: number, batch: number) => {
    const cursor: Cursor = { fingerprint: print, next, total: accidents.length, batch, files, savedAt: new Date().toISOString() };
    saveCursor(storage, cursor);
    state.cursor = cursor;
  };

  // Nothing past `from` is confirmed yet, so a reload now starts right there.
  save(from, 0);

  runner = createRunner({
    api: { createChildren: (children, options) => window.potok.createChildren(children, options) },
    total: accidents.length,
    start: from,
    child: (index) => childOf(accidents[index]),
    onProgress: (progress) => update((s) => (s.progress = progress)),
    onConfirmed: save,
  });

  update((s) => {
    s.screen = 'importing';
    s.progress = runner!.progress;
  });
  dropCsv();
  void runner.run().then(finish);
}

export const pause = () => runner?.pause();
export const resume = () => runner?.resume();

/** After a stop: on from one batch before the last confirmed one. */
export function continueImport() {
  const cursor = fittingCursor();
  startImport(cursor ? resumeIndex(cursor) : 0);
}

export function newImport() {
  runner = null;
  dropCsv();
  update((s) => {
    s.screen = 'pick';
    s.progress = null;
    s.readError = null;
  });
}

// --- Report

const CSV_SHOWN = 2_000;

function dropCsv() {
  if (state.csvUrl) URL.revokeObjectURL(state.csvUrl);
  update((s) => {
    s.csvUrl = null;
    s.csvText = '';
    s.csvLines = 0;
  });
}

function reportLines(progress: Progress): ReportLine[] {
  const built = state.built!;
  const lines: ReportLine[] = built.skipped.map((skip) => ({
    file: skip.file,
    line: skip.line,
    id: skip.id,
    reason: t(skipKey(skip.skip)),
    cells: skip.cells,
  }));

  for (const failure of progress.failed) {
    const accident = built.accidents[failure.index];
    for (const row of accident?.rows ?? []) {
      lines.push({ file: row.file, line: row.line, id: row.id, reason: `${t('csvFailed')}: ${failure.message ?? failure.error}`, cells: row.cells });
    }
  }
  return lines;
}

function finish(progress: Progress) {
  const lines = reportLines(progress);
  const header = [t('csvFile'), t('csvLine'), t('csvId'), t('csvReason'), 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  let url: string | null = null;
  let text = '';
  if (lines.length > 0) {
    const csv = csvOf(lines, header);
    try {
      url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    } catch {
      url = null;
    }
    text = csvOf(lines.slice(0, CSV_SHOWN), header).replace(/^﻿/, '');
  }

  update((s) => {
    s.progress = progress;
    s.screen = 'report';
    s.csvUrl = url;
    s.csvText = text;
    s.csvLines = lines.length;
  });
}

export const csvShown = CSV_SHOWN;
