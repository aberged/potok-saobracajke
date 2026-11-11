/// <reference types="node" />
// The real files from data.gov.rs, when they lie next to this project in
// ../saobracajke (they are not in the repository). Without them these tests
// are skipped. `ALL_YEARS=1 npm test` reads every year and prints its numbers.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAccidents, yearFromName } from './data/accidents';
import { isSkip } from './data/normalize';
import { readSources } from './data/read';
import { MAX_NAME } from './describe/describe';
import { childOf } from './import/children';

const DATA = path.resolve(process.cwd(), '..', 'saobracajke');
const files = existsSync(DATA) ? readdirSync(DATA).filter((name) => /^nez-opendata-.*\.xlsx$/i.test(name)).sort() : [];
const find = (year: string) => files.find((name) => name.startsWith(`nez-opendata-${year}`)) ?? null;

async function read(name: string) {
  const file = path.join(DATA, name);
  return readSources([{ name, bytes: async () => new Uint8Array(readFileSync(file)) }], { yieldNow: async () => {} });
}

const ids = (rows: Awaited<ReturnType<typeof read>>['rows']) => new Set(rows.map((row) => row.id));

const file2015 = find('2015');
const file2024 = find('2024');

describe.skipIf(!file2015)('nez-opendata-2015', () => {
  it('gives one accident per id and nothing outside Serbia', async () => {
    const { rows, perFile } = await read(file2015!);
    expect(rows).toHaveLength(6_763);
    expect(perFile[0]).toMatchObject({ rows: 6_763, header: false });

    const { accidents, summary } = buildAccidents(rows, 2015);
    expect(accidents.length).toBe(ids(rows).size);
    expect(summary.skipped.outsideSerbia.count).toBe(0);
    expect(summary.skippedRows).toBe(0);
    expect(summary.unknownKinds).toBe(0);

    const children = accidents.map(childOf);
    expect(new Set(children.map((child) => child.key)).size).toBe(children.length);
    expect(children.every((child) => [...child.name].length <= MAX_NAME && child.key.length <= 64)).toBe(true);
    expect(children.find((child) => child.key === 'mup:1110717')!.description).toContain('- **Situacije:**\n  - ');
  }, 60_000);
});

describe.skipIf(!file2024)('nez-opendata-2024', () => {
  it('fixes the coordinates written without a decimal point; two rows stay outside Serbia', async () => {
    const { rows } = await read(file2024!);
    expect(rows).toHaveLength(32_330);

    const { accidents, summary } = buildAccidents(rows, 2024);
    expect(summary.skipped.outsideSerbia.count).toBe(2);
    expect(summary.skipped.outsideSerbia.examples.map((skip) => skip.id).sort()).toEqual(['1461279', '1502573']);
    expect(summary.skippedRows).toBe(2);
    expect(accidents.find((accident) => accident.id === '1497334')).toMatchObject({ lat: 45.249695, lng: 19.75001 });
    expect(accidents.find((accident) => accident.id === '1457983')).toMatchObject({ lat: 44.623482, lng: 20.358773 });
  }, 60_000);
});

describe.runIf(process.env.ALL_YEARS && files.length > 0)('every year', () => {
  it('accounts for every row', async () => {
    const lines: string[] = [];
    for (const name of files) {
      const started = performance.now();
      const { rows } = await read(name);
      const year = yearFromName(name.replace(/^nez-opendata-/, ''));
      const { accidents, summary } = buildAccidents(rows, year);
      const kept = accidents.reduce((sum, accident) => sum + accident.rows.length, 0);
      expect(kept + summary.skippedRows).toBe(rows.length);
      expect(rows.filter(isSkip).length).toBe(summary.skippedRows - summary.skipped.otherYear.count);

      const reasons = Object.entries(summary.skipped)
        .filter(([, group]) => group.count > 0)
        .map(([reason, group]) => `${reason} ${group.count}`)
        .join(', ');
      lines.push(
        `${name} (${statSync(path.join(DATA, name)).size} B, ${Math.round(performance.now() - started)} ms): ` +
          `${rows.length} rows, ${accidents.length} accidents (${ids(rows).size} ids), ` +
          `killed ${summary.bySeverity.killed}, injured ${summary.bySeverity.injured}, damage ${summary.bySeverity.damage}, ` +
          `multi-row ${summary.multiRow}, conflicts ${summary.conflicts}, swapped ${summary.swapped}, unknown kinds ${summary.unknownKinds}` +
          (reasons ? `; skipped: ${reasons}` : ''),
      );
    }
    console.log(lines.join('\n'));
  }, 600_000);
});
