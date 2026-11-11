// One row of the sheet as an accident's row, or the reason it is left out.
// Columns: A id, B police district, C municipality, D "dd.mm.yyyy,HH:MM",
// E longitude, F latitude, G consequences, H kind, I situation.

import { kindOf, KIND_TEXT, sentenceCase, severityOf, type Kind, type Severity } from './lookups';
import { titleCase } from './title-case';

/** A moment as the file writes it: local time in Serbia, with no zone to move it. */
export type When = { year: number; month: number; day: number; hour: number; minute: number };

export type Row = {
  id: string;
  file: string;
  line: number;
  district: string;
  municipality: string;
  when: When;
  lat: number;
  lng: number;
  /** Longitude and latitude came the other way round. */
  swapped: boolean;
  severity: Severity;
  kind: Kind | null;
  /** The kind as a description says it; for an unknown kind, the file's text. */
  kindText: string;
  situation: string;
  cells: string[];
};

export type SkipReason = 'noId' | 'badDate' | 'noCoordinates' | 'outsideSerbia' | 'unknownSeverity' | 'otherYear';

export const SKIP_REASONS: SkipReason[] = ['outsideSerbia', 'noCoordinates', 'badDate', 'unknownSeverity', 'noId', 'otherYear'];

export type Skip = { skip: SkipReason; file: string; line: number; id: string; cells: string[] };

/** Serbia's box, with some room around the border. */
export const SERBIA = { south: 41.8, north: 46.3, west: 18.8, east: 23.1 };

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const clean = (text: string) => text.replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();

/**
 * A coordinate: a comma is a decimal point, and digits alone get the point
 * after the first two (2024 writes 20.358773 as 20358773, with any number of
 * digits: Serbia lies between 18 and 23° E and 41 and 46° N). Six decimals.
 */
export function parseCoordinate(raw: string): number | null {
  let text = raw.trim().replace(/,/g, '.');
  if (text === '') return null;
  // A whole number Excel wrote in scientific notation (4.5249694523101998E+18)
  // is the same digits without the point as the others of 2024.
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isSafeInteger(n) || (Number.isInteger(n) && n >= 1e15)) text = BigInt(n).toString();
  }
  if (/^\d+$/.test(text) && text.length > 2) text = `${text.slice(0, 2)}.${text.slice(2)}`;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return null;

  const n = Number(text);
  return Number.isFinite(n) ? round6(n) : null;
}

export const insideSerbia = (lat: number, lng: number) =>
  lat >= SERBIA.south && lat <= SERBIA.north && lng >= SERBIA.west && lng <= SERBIA.east;

export type Place = { lat: number; lng: number; swapped: boolean };

/** E is the longitude and F the latitude; a pair the wrong way round is turned. */
export function placeOf(e: string, f: string): Place | 'noCoordinates' | 'outsideSerbia' {
  const lng = parseCoordinate(e);
  const lat = parseCoordinate(f);
  if (lng === null || lat === null) return 'noCoordinates';
  if (insideSerbia(lat, lng)) return { lat, lng, swapped: false };
  if (insideSerbia(lng, lat)) return { lat: lng, lng: lat, swapped: true };
  return 'outsideSerbia';
}

function validWhen(when: When): When | null {
  const { year, month, day, hour, minute } = when;
  if (year < 1990 || year > 2100 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? when : null;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** "05.01.2025,18:50", or a date Excel keeps as a number of days. */
export function parseWhen(raw: string): When | null {
  const text = raw.trim();
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*[,\sT]\s*(\d{1,2})[:.](\d{2})(?::\d{2})?$/.exec(text);
  if (match) {
    const [, day, month, year, hour, minute] = match.map(Number);
    return validWhen({ year, month, day, hour, minute });
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial < 1 || serial > 100_000) return null;
    const date = new Date(EXCEL_EPOCH + Math.round(serial * 1440) * 60_000);
    return validWhen({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    });
  }

  return null;
}

/** An id is a whole number; a numeric cell may write it as "1510533.0". */
export function parseId(raw: string): string | null {
  const match = /^\s*0*(\d+)(\.0*)?\s*$/.exec(raw);
  return match && match[1] !== '' ? match[1] : null;
}

/** All of a row's cells are empty: not a row at all. */
export const blankRow = (cells: string[]) => cells.every((cell) => cell.trim() === '');

export function normalizeRow(cells: string[], line: number, file = ''): Row | Skip {
  const [a = '', b = '', c = '', d = '', e = '', f = '', g = '', h = '', i = ''] = cells;
  const skip = (reason: SkipReason, id = ''): Skip => ({ skip: reason, file, line, id, cells });

  const id = parseId(a);
  if (id === null) return skip('noId');

  const when = parseWhen(d);
  if (!when) return skip('badDate', id);

  const place = placeOf(e, f);
  if (typeof place === 'string') return skip(place, id);

  const severity = severityOf(g);
  if (!severity) return skip('unknownSeverity', id);

  const kind = kindOf(h);
  const kindText = kind ? KIND_TEXT[kind] : sentenceCase(clean(h));

  return {
    id,
    file,
    line,
    district: titleCase(clean(b)),
    municipality: titleCase(clean(c)),
    when,
    lat: place.lat,
    lng: place.lng,
    swapped: place.swapped,
    severity,
    kind,
    kindText,
    situation: clean(i),
    cells,
  };
}

export const isSkip = (row: Row | Skip): row is Skip => 'skip' in row;
