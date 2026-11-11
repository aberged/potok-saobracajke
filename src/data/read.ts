// From picked files to rows, on the main thread: a year is a few seconds of
// work, so it goes a slice at a time and hands the page back between slices
// to draw the progress. (A Web Worker would need a blob URL, which a frame
// without `allow-same-origin` cannot count on.)

import { isHeaderRow, parseSharedStrings, RowReader } from '../xlsx/sheet';
import { readWorkbook, XlsxError } from '../xlsx/unzip';
import { blankRow, normalizeRow, type Row, type Skip } from './normalize';

export type Source = { name: string; bytes: () => Promise<Uint8Array> };

export type ReadStage = 'reading' | 'unzipping' | 'rows';

export type ReadProgress = {
  /** From 0. */
  file: number;
  files: number;
  name: string;
  stage: ReadStage;
  /** How far through all the files, from 0 to 1. */
  overall: number;
};

export type ReadErrorCode = 'not_xlsx' | 'no_sheet' | 'unreadable' | 'empty';

export class ReadError extends Error {
  readonly file: string;
  readonly code: ReadErrorCode;

  constructor(file: string, code: ReadErrorCode) {
    super(`${file}: ${code}`);
    this.file = file;
    this.code = code;
  }
}

export type ReadResult = {
  rows: (Row | Skip)[];
  /** Data rows in each file. */
  perFile: { name: string; rows: number; header: boolean }[];
};

type Options = {
  onProgress?: (progress: ReadProgress) => void;
  /** Hands the page back for a moment. */
  yieldNow?: () => Promise<void>;
  /** Work this long before handing back, in ms. */
  slice?: number;
  now?: () => number;
};

const handBack = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function readSources(sources: Source[], options: Options = {}): Promise<ReadResult> {
  const yieldNow = options.yieldNow ?? handBack;
  const now = options.now ?? (() => performance.now());
  const slice = options.slice ?? 30;
  const rows: (Row | Skip)[] = [];
  const perFile: ReadResult['perFile'] = [];

  for (const [file, source] of sources.entries()) {
    const report = (stage: ReadStage, fraction: number) =>
      options.onProgress?.({ file, files: sources.length, name: source.name, stage, overall: (file + fraction) / sources.length });

    report('reading', 0);
    await yieldNow();

    let bytes: Uint8Array;
    try {
      bytes = await source.bytes();
    } catch {
      throw new ReadError(source.name, 'unreadable');
    }

    report('unzipping', 0.02);
    await yieldNow();

    let sheet: string;
    let strings: string[];
    try {
      const workbook = readWorkbook(bytes);
      sheet = workbook.sheet;
      strings = parseSharedStrings(workbook.sharedStrings);
    } catch (error) {
      throw new ReadError(source.name, error instanceof XlsxError ? error.code : 'not_xlsx');
    }

    const reader = new RowReader(sheet, strings);
    let count = 0;
    let header = false;
    let first = true;

    while (!reader.done) {
      const started = now();
      while (!reader.done && now() - started < slice) {
        for (const row of reader.read(500)) {
          if (first) {
            first = false;
            if (isHeaderRow(row)) {
              header = true;
              continue;
            }
          }
          if (blankRow(row.cells)) continue;
          rows.push(normalizeRow(row.cells, row.line, source.name));
          count++;
        }
      }
      report('rows', 0.05 + 0.95 * reader.progress);
      await yieldNow();
    }

    if (count === 0) throw new ReadError(source.name, 'empty');
    perFile.push({ name: source.name, rows: count, header });
  }

  return { rows, perFile };
}
