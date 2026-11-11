import { describe, expect, it } from 'vitest';
import { buildAccidents, samples, yearFromName } from './accidents';
import { fold, kindOf, severityOf } from './lookups';
import { isSkip, normalizeRow, parseCoordinate, parseId, parseWhen, placeOf, type Row, type Skip } from './normalize';
import { titleCase } from './title-case';

// Rows as the files have them (columns A–I).
const FIRST_2025 = ['1510533', 'BEOGRAD', 'BARAJEVO', '05.01.2025,18:50', '20.366175', '44.619215', 'Sa mat.stetom', 'SN SA PARKIRANIM VOZILIMA', 'Ostali sudari sa parkiranim vozilom'];
const FIRST_2024 = ['1457983', 'BEOGRAD', 'BARAJEVO', '01.01.2024,08:00', '20358773', '44623482', 'Sa mat.stetom', 'SN SA JEDNIM VOZILOM', 'Nezgoda sa jednim vozilom – silazak sa kolovoza u krivini'];
const TWO_ROWS_1110717 = [
  ['1110717', 'BEOGRAD', 'ČUKARICA', '19.11.2015,15:42', '20.4068209622', '44.767086659', 'Sa povredjenim', 'SN SA NAJMANjE DVA VOZILA – SKRETANjE ILI PRELAZAK', 'Najmanje dva vozila koja se kreću istim putem u istom smeru uz skretanje, skretanje ulevo ispred drugog vozila'],
  ['1110717', 'BEOGRAD', 'ČUKARICA', '19.11.2015,15:42', '20.4068209622', '44.767086659', 'Sa povredjenim', 'SN SA NAJMANjE DVA VOZILA – BEZ SKRETANjA', 'Najmanje dva vozila koja se kreću u istom smeru – preticanje'],
];
const PETROVAC = ['1508368', 'POŽAREVAC', 'PETROVAC NA MLAVI', '10.01.2025,08:20', '21.46158917', '44.37750204', 'Sa povredjenim', 'SN SA JEDNIM VOZILOM', 'Nezgoda sa jednim vozilom – silazak ulevo sa kolovoza na pravcu'];
const SPACE_COMMA = ['1113387', 'BEOGRAD', 'BARAJEVO', '11.12.2015,15:15', '20.310298', '44.594627', 'Sa povredjenim', 'SN SA PEŠACIMA', 'Prelazak pešaka sleva, van raskrsnice , bez skretanja vozila'];
const OUTSIDE_2024 = ['1461279', 'BEOGRAD', 'NOVI BEOGRAD', '24.01.2024,08:50', '45767', '44803348', 'Sa mat.stetom', 'SN SA PARKIRANIM VOZILIMA', 'Sudar sa parkiranim vozilom sa leve strane kolovoza'];

const row = (cells: string[], line = 1) => {
  const result = normalizeRow(cells, line, 'test.xlsx');
  if (isSkip(result)) throw new Error(`skipped: ${result.skip}`);
  return result;
};

const skipOf = (cells: string[]) => {
  const result = normalizeRow(cells, 9, 'test.xlsx');
  if (!isSkip(result)) throw new Error('not skipped');
  return result.skip;
};

describe('coordinates', () => {
  it('puts the point after two digits in 2024', () => {
    expect(parseCoordinate('20358773')).toBe(20.358773);
    expect(parseCoordinate('2041225')).toBe(20.41225);
    expect(parseCoordinate('204688932')).toBe(20.468893);
    expect(parseCoordinate('20255599344')).toBe(20.255599);
    // ID 1497334 of 2024: Excel wrote the latitude's digits in scientific notation.
    expect(parseCoordinate('4.5249694523101998E+18')).toBe(45.249695);
  });

  it('rounds float noise to six decimals', () => {
    expect(parseCoordinate('44.592669999999998')).toBe(44.59267);
    expect(parseCoordinate('20.4180857555')).toBe(20.418086);
    expect(String(parseCoordinate('44.619215'))).toBe('44.619215');
  });

  it('takes a comma as the decimal point and refuses what is not a number', () => {
    expect(parseCoordinate('44,619215')).toBe(44.619215);
    expect(parseCoordinate(' 20 ')).toBe(20);
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('n/a')).toBeNull();
    expect(parseCoordinate('20.1.2')).toBeNull();
  });

  it('turns a swapped pair and leaves out a place outside Serbia', () => {
    expect(placeOf('20.366175', '44.619215')).toEqual({ lat: 44.619215, lng: 20.366175, swapped: false });
    expect(placeOf('44.619215', '20.366175')).toEqual({ lat: 44.619215, lng: 20.366175, swapped: true });
    expect(placeOf('45767', '44803348')).toBe('outsideSerbia');
    expect(placeOf('197500096', '4.5249694523101998E+18')).toEqual({ lat: 45.249695, lng: 19.75001, swapped: false });
    expect(placeOf('', '44.6')).toBe('noCoordinates');
  });
});

describe('dates', () => {
  it('reads "dd.mm.yyyy,HH:MM"', () => {
    expect(parseWhen('05.01.2025,18:50')).toEqual({ year: 2025, month: 1, day: 5, hour: 18, minute: 50 });
    expect(parseWhen('5.1.2025. 8:05')).toEqual({ year: 2025, month: 1, day: 5, hour: 8, minute: 5 });
  });

  it('reads a date Excel keeps as days', () => {
    expect(parseWhen('45662.78472222222')).toEqual({ year: 2025, month: 1, day: 5, hour: 18, minute: 50 });
  });

  it('refuses a bad date', () => {
    expect(parseWhen('31.02.2025,10:00')).toBeNull();
    expect(parseWhen('05.01.2025,24:10')).toBeNull();
    expect(parseWhen('05.01.2025')).toBeNull();
    expect(parseWhen('')).toBeNull();
  });
});

describe('lookups', () => {
  it('folds case, diacritics and dashes', () => {
    expect(fold('SN SA NAJMANjE DVA VOZILA – BEZ SKRETANjA')).toBe('sn sa najmanje dva vozila bez skretanja');
    expect(fold('SN SA NAJMANJE DVA VOZILA - BEZ SKRETANJA')).toBe('sn sa najmanje dva vozila bez skretanja');
    expect(fold('Sa povređenim')).toBe('sa povredjenim');
  });

  it('knows the kinds with an en dash or a hyphen', () => {
    expect(kindOf('SN SA NAJMANjE DVA VOZILA – SKRETANjE ILI PRELAZAK')).toBe('twoTurning');
    expect(kindOf('SN SA NAJMANjE DVA VOZILA - SKRETANjE ILI PRELAZAK')).toBe('twoTurning');
    expect(kindOf('SN SA NAJMANjE DVA VOZILA – BEZ SKRETANjA')).toBe('twoStraight');
    expect(kindOf('SN SA PEŠACIMA')).toBe('pedestrians');
    expect(kindOf('SN SA PESACIMA')).toBe('pedestrians');
    expect(kindOf('SN SA TRAMVAJEM')).toBeNull();
  });

  it('knows the consequences', () => {
    expect(severityOf('Sa mat.stetom')).toBe('damage');
    expect(severityOf('Sa povredjenim')).toBe('injured');
    expect(severityOf('Sa poginulim')).toBe('killed');
    expect(severityOf('Sa materijalnom štetom')).toBe('damage');
    expect(severityOf('Nepoznato')).toBeNull();
  });
});

describe('names', () => {
  it('writes names as names', () => {
    expect(titleCase('PETROVAC NA MLAVI')).toBe('Petrovac na Mlavi');
    expect(titleCase('ČUKARICA')).toBe('Čukarica');
    expect(titleCase('KNjAŽEVAC')).toBe('Knjaževac');
    expect(titleCase('KNJAŽEVAC')).toBe('Knjaževac');
    expect(titleCase('NOVI  BEOGRAD')).toBe('Novi Beograd');
    expect(titleCase('2. MZ SLOBODAN BAJIĆ PAJA')).toBe('2. MZ Slobodan Bajić Paja');
    expect(titleCase('SREMSKA MITROVICA-ISTOK (CENTAR)')).toBe('Sremska Mitrovica-Istok (Centar)');
  });
});

describe('a row', () => {
  it('reads the first row of 2025', () => {
    expect(row(FIRST_2025)).toMatchObject({
      id: '1510533',
      district: 'Beograd',
      municipality: 'Barajevo',
      when: { year: 2025, month: 1, day: 5, hour: 18, minute: 50 },
      lat: 44.619215,
      lng: 20.366175,
      swapped: false,
      severity: 'damage',
      kind: 'parked',
      kindText: 'nezgoda sa parkiranim vozilima',
      situation: 'Ostali sudari sa parkiranim vozilom',
    });
  });

  it('reads 2024 with its numbers for coordinates', () => {
    expect(row(FIRST_2024)).toMatchObject({ lat: 44.623482, lng: 20.358773, kind: 'single' });
  });

  it('closes up a space before a comma', () => {
    expect(row(SPACE_COMMA).situation).toBe('Prelazak pešaka sleva, van raskrsnice, bez skretanja vozila');
  });

  it('keeps "na" small in a municipality', () => {
    expect(row(PETROVAC)).toMatchObject({ municipality: 'Petrovac na Mlavi', district: 'Požarevac' });
  });

  it('keeps an unknown kind as the file writes it', () => {
    const unknown = row([...FIRST_2025.slice(0, 7), 'SN SA TRAMVAJEM', FIRST_2025[8]]);
    expect(unknown).toMatchObject({ kind: null, kindText: 'Sn sa tramvajem' });
  });

  it('says why a row is left out', () => {
    expect(skipOf(OUTSIDE_2024)).toBe('outsideSerbia');
    expect(skipOf([...FIRST_2025.slice(0, 3), '32.01.2025,18:50', ...FIRST_2025.slice(4)])).toBe('badDate');
    expect(skipOf([...FIRST_2025.slice(0, 6), 'Nepoznato', ...FIRST_2025.slice(7)])).toBe('unknownSeverity');
    expect(skipOf(['', ...FIRST_2025.slice(1)])).toBe('noId');
    expect(skipOf([...FIRST_2025.slice(0, 4), '', '', ...FIRST_2025.slice(6)])).toBe('noCoordinates');
  });

  it('reads an id written as a number', () => {
    expect(parseId('1510533')).toBe('1510533');
    expect(parseId('1510533.0')).toBe('1510533');
    expect(parseId('ID')).toBeNull();
  });
});

describe('accidents', () => {
  const rows = (list: string[][]): (Row | Skip)[] => list.map((cells, i) => normalizeRow(cells, i + 1, 'test.xlsx'));

  it('makes one accident of an id on two rows', () => {
    const { accidents, summary } = buildAccidents(rows(TWO_ROWS_1110717), 2015);
    expect(accidents).toHaveLength(1);
    expect(accidents[0]).toMatchObject({
      key: 'mup:1110717',
      municipality: 'Čukarica',
      severity: 'injured',
      kinds: ['nezgoda sa najmanje dva vozila, sa skretanjem ili prelaskom', 'nezgoda sa najmanje dva vozila, bez skretanja'],
      situations: [
        'Najmanje dva vozila koja se kreću istim putem u istom smeru uz skretanje, skretanje ulevo ispred drugog vozila',
        'Najmanje dva vozila koja se kreću u istom smeru – preticanje',
      ],
      conflict: false,
    });
    expect(accidents[0].rows).toHaveLength(2);
    expect(summary).toMatchObject({ rows: 2, accidents: 1, multiRow: 1, conflicts: 0 });
  });

  it('keeps the worst of differing consequences and counts the conflict', () => {
    const second = [...TWO_ROWS_1110717[1]];
    second[6] = 'Sa poginulim';
    const { accidents, summary } = buildAccidents(rows([TWO_ROWS_1110717[0], second]), null);
    expect(accidents[0]).toMatchObject({ severity: 'killed', conflict: true });
    expect(summary).toMatchObject({ conflicts: 1, conflictIds: ['1110717'], bySeverity: { killed: 1, injured: 0, damage: 0 } });
  });

  it('leaves out other years, sorts by id and counts what was left out', () => {
    const { accidents, summary, skipped } = buildAccidents(rows([FIRST_2025, PETROVAC, ...TWO_ROWS_1110717, OUTSIDE_2024, FIRST_2024]), 2025);
    expect(accidents.map((a) => a.id)).toEqual(['1508368', '1510533']);
    expect(summary.skipped.otherYear.count).toBe(3);
    expect(summary.otherYears).toEqual({ 2015: 2, 2024: 1 });
    expect(summary.skipped.outsideSerbia.count).toBe(1);
    expect(summary.skipped.outsideSerbia.examples[0]).toMatchObject({ id: '1461279', line: 5, file: 'test.xlsx' });
    expect(summary.skippedRows).toBe(4);
    expect(skipped).toHaveLength(4);
    expect(summary.bySeverity).toEqual({ killed: 0, injured: 1, damage: 1 });
  });

  it('keeps at most five examples of a reason', () => {
    const many = Array.from({ length: 8 }, (_, i) => [String(1461279 + i), ...OUTSIDE_2024.slice(1)]);
    const { summary } = buildAccidents(rows(many), null);
    expect(summary.skipped.outsideSerbia).toMatchObject({ count: 8 });
    expect(summary.skipped.outsideSerbia.examples).toHaveLength(5);
  });

  it('takes the year from the group name', () => {
    expect(yearFromName('Nezgode 2025')).toBe(2025);
    expect(yearFromName('2015 – saobraćajke')).toBe(2015);
    expect(yearFromName('Nezgode')).toBeNull();
    expect(yearFromName('Grupa 12025')).toBeNull();
  });

  it('shows the worst kind first among the samples', () => {
    const { accidents } = buildAccidents(rows([FIRST_2025, PETROVAC, ...TWO_ROWS_1110717]), null);
    expect(samples(accidents).map((a) => a.id)).toEqual(['1110717', '1510533', '1508368']);
  });
});
