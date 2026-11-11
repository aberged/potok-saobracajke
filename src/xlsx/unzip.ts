// The parts of an xlsx file the import reads: the first sheet and the shared
// strings. An xlsx is a zip; fflate inflates only the entries asked for, so
// styles, themes and the rest stay packed.

import { strFromU8, unzipSync } from 'fflate';

export type WorkbookXml = {
  /** The first sheet's XML. */
  sheet: string;
  /** `xl/sharedStrings.xml`, or null for a workbook without one. */
  sharedStrings: string | null;
  /** Where the sheet was found in the zip, for messages. */
  sheetPath: string;
};

export class XlsxError extends Error {
  readonly code: 'not_xlsx' | 'no_sheet';

  constructor(code: 'not_xlsx' | 'no_sheet') {
    super(code);
    this.code = code;
  }
}

const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const FALLBACK_SHEET = 'xl/worksheets/sheet1.xml';
const FALLBACK_STRINGS = 'xl/sharedStrings.xml';

function unzip(data: Uint8Array, wanted: Set<string>): Record<string, Uint8Array> {
  try {
    return unzipSync(data, { filter: (file) => wanted.has(file.name) });
  } catch {
    throw new XlsxError('not_xlsx');
  }
}

/** A relationship's target as a path in the zip: relative to `xl/`, or absolute from the root. */
export function resolveTarget(target: string): string {
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  return match ? (match[2] ?? match[3]) : null;
}

/**
 * Where the first sheet and the shared strings are, from `xl/workbook.xml` and
 * its relationships. Anything missing falls back to the usual names.
 */
export function locateParts(workbook: string | null, rels: string | null): { sheet: string; strings: string } {
  const targets = new Map<string, { type: string; target: string }>();
  for (const tag of rels?.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = attribute(tag, 'Id');
    const target = attribute(tag, 'Target');
    if (id && target) targets.set(id, { type: attribute(tag, 'Type') ?? '', target });
  }

  const firstSheet = workbook?.match(/<sheet\b[^>]*>/)?.[0];
  const sheetId = firstSheet ? (attribute(firstSheet, 'r:id') ?? attribute(firstSheet, 'id')) : null;
  const sheetTarget = sheetId ? targets.get(sheetId)?.target : undefined;
  const stringsTarget = [...targets.values()].find((rel) => rel.type.endsWith('/sharedStrings'))?.target;

  return {
    sheet: sheetTarget ? resolveTarget(sheetTarget) : FALLBACK_SHEET,
    strings: stringsTarget ? resolveTarget(stringsTarget) : FALLBACK_STRINGS,
  };
}

export function readWorkbook(data: Uint8Array): WorkbookXml {
  const head = unzip(data, new Set([WORKBOOK, WORKBOOK_RELS]));
  const text = (name: string) => (head[name] ? strFromU8(head[name]) : null);
  const located = locateParts(text(WORKBOOK), text(WORKBOOK_RELS));

  let parts = unzip(data, new Set([located.sheet, located.strings]));
  let sheetPath = located.sheet;

  if (!parts[sheetPath] && sheetPath !== FALLBACK_SHEET) {
    parts = { ...parts, ...unzip(data, new Set([FALLBACK_SHEET])) };
    sheetPath = FALLBACK_SHEET;
  }
  if (!parts[sheetPath]) throw new XlsxError(head[WORKBOOK] ? 'no_sheet' : 'not_xlsx');

  return {
    sheet: strFromU8(parts[sheetPath]),
    sharedStrings: parts[located.strings] ? strFromU8(parts[located.strings]) : null,
    sheetPath,
  };
}
