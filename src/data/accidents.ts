// Rows into accidents: one accident per id. An id on several rows is one
// accident in several situations (2,303 of them across the files), so its
// kinds and situations all go into one description. Rows of another year than
// the group's are left out.

import { SEVERITIES, SEVERITY_RANK, type Severity } from './lookups';
import { isSkip, SKIP_REASONS, type Row, type Skip, type SkipReason, type When } from './normalize';

export type Accident = {
  /** The group's key in Potok: `mup:<id>`. */
  key: string;
  id: string;
  when: When;
  lat: number;
  lng: number;
  severity: Severity;
  district: string;
  municipality: string;
  /** Distinct, in the order of the rows. */
  kinds: string[];
  situations: string[];
  /** The rows it came from. */
  rows: Row[];
  /** Its rows said different consequences; the worst is kept. */
  conflict: boolean;
};

export type SkipGroup = { count: number; examples: Skip[] };

export type Summary = {
  /** Rows with data: every row but a header and empty ones. */
  rows: number;
  accidents: number;
  bySeverity: Record<Severity, number>;
  skipped: Record<SkipReason, SkipGroup>;
  skippedRows: number;
  /** Accidents whose rows said different consequences. */
  conflicts: number;
  conflictIds: string[];
  /** Accidents on more than one row. */
  multiRow: number;
  /** Rows whose kind the tables do not know, kept with the file's text. */
  unknownKinds: number;
  /** Rows whose longitude and latitude were turned round. */
  swapped: number;
  year: number | null;
  /** The years of the rows left out as another year's, with their counts. */
  otherYears: Record<number, number>;
};

export const MAX_EXAMPLES = 5;

export const keyOf = (id: string) => `mup:${id}`;

/** The year in a group's name: "Nezgode 2025" → 2025. */
export function yearFromName(name: string): number | null {
  const match = /(?:^|\D)((?:19|20)\d\d)(?!\d)/.exec(name);
  return match ? Number(match[1]) : null;
}

const byId = (a: Accident, b: Accident) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function emptySkipped(): Record<SkipReason, SkipGroup> {
  return Object.fromEntries(SKIP_REASONS.map((reason) => [reason, { count: 0, examples: [] }])) as unknown as Record<SkipReason, SkipGroup>;
}

export type Built = { accidents: Accident[]; summary: Summary; skipped: Skip[] };

/** Accidents sorted by id, what was left out and the numbers for the preview. */
export function buildAccidents(rows: (Row | Skip)[], year: number | null): Built {
  const found = new Map<string, Accident>();
  const skipped: Skip[] = [];
  const summary: Summary = {
    rows: rows.length,
    accidents: 0,
    bySeverity: { killed: 0, injured: 0, damage: 0 },
    skipped: emptySkipped(),
    skippedRows: 0,
    conflicts: 0,
    conflictIds: [],
    multiRow: 0,
    unknownKinds: 0,
    swapped: 0,
    year,
    otherYears: {},
  };

  const leaveOut = (skip: Skip) => {
    skipped.push(skip);
    const group = summary.skipped[skip.skip];
    group.count++;
    if (group.examples.length < MAX_EXAMPLES) group.examples.push(skip);
  };

  for (const row of rows) {
    if (isSkip(row)) {
      leaveOut(row);
      continue;
    }
    if (year !== null && row.when.year !== year) {
      summary.otherYears[row.when.year] = (summary.otherYears[row.when.year] ?? 0) + 1;
      leaveOut({ skip: 'otherYear', file: row.file, line: row.line, id: row.id, cells: row.cells });
      continue;
    }

    if (row.kind === null && row.kindText !== '') summary.unknownKinds++;
    if (row.swapped) summary.swapped++;

    const known = found.get(row.id);
    if (!known) {
      found.set(row.id, {
        key: keyOf(row.id),
        id: row.id,
        when: row.when,
        lat: row.lat,
        lng: row.lng,
        severity: row.severity,
        district: row.district,
        municipality: row.municipality,
        kinds: row.kindText ? [row.kindText] : [],
        situations: row.situation ? [row.situation] : [],
        rows: [row],
        conflict: false,
      });
      continue;
    }

    known.rows.push(row);
    if (row.kindText && !known.kinds.includes(row.kindText)) known.kinds.push(row.kindText);
    if (row.situation && !known.situations.includes(row.situation)) known.situations.push(row.situation);
    if (row.severity !== known.severity) {
      known.conflict = true;
      if (SEVERITY_RANK[row.severity] > SEVERITY_RANK[known.severity]) known.severity = row.severity;
    }
  }

  const accidents = [...found.values()].sort(byId);
  for (const accident of accidents) {
    summary.bySeverity[accident.severity]++;
    if (accident.rows.length > 1) summary.multiRow++;
    if (accident.conflict) {
      summary.conflicts++;
      if (summary.conflictIds.length < MAX_EXAMPLES) summary.conflictIds.push(accident.id);
    }
  }
  summary.accidents = accidents.length;
  summary.skippedRows = skipped.length;

  return { accidents, summary, skipped };
}

/** Up to `count` accidents to show first: the worst kind of each, then the rest in order. */
export function samples(accidents: Accident[], count = 3): Accident[] {
  const picked: Accident[] = [];
  for (const severity of SEVERITIES) {
    const first = accidents.find((accident) => accident.severity === severity && accident.situations.length > 1)
      ?? accidents.find((accident) => accident.severity === severity);
    if (first && picked.length < count) picked.push(first);
  }
  for (const accident of accidents) {
    if (picked.length >= count) break;
    if (!picked.includes(accident)) picked.push(accident);
  }
  return picked;
}
