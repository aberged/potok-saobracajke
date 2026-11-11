import { describe, expect, it } from 'vitest';
import { buildAccidents, type Accident } from '../data/accidents';
import { normalizeRow } from '../data/normalize';
import { childOf } from '../import/children';
import { dayPart, longDate, shortDate, weekday } from './dates';
import { descriptionOf, escapeMarkdown, MAX_NAME, nameOf, osmLink, pinOf } from './describe';

const FIRST_2025 = ['1510533', 'BEOGRAD', 'BARAJEVO', '05.01.2025,18:50', '20.366175', '44.619215', 'Sa mat.stetom', 'SN SA PARKIRANIM VOZILIMA', 'Ostali sudari sa parkiranim vozilom'];
const TWO_ROWS_1110717 = [
  ['1110717', 'BEOGRAD', 'ČUKARICA', '19.11.2015,15:42', '20.4068209622', '44.767086659', 'Sa povredjenim', 'SN SA NAJMANjE DVA VOZILA – SKRETANjE ILI PRELAZAK', 'Najmanje dva vozila koja se kreću istim putem u istom smeru uz skretanje, skretanje ulevo ispred drugog vozila'],
  ['1110717', 'BEOGRAD', 'ČUKARICA', '19.11.2015,15:42', '20.4068209622', '44.767086659', 'Sa povredjenim', 'SN SA NAJMANjE DVA VOZILA – BEZ SKRETANjA', 'Najmanje dva vozila koja se kreću u istom smeru – preticanje'],
];

function accident(...rows: string[][]): Accident {
  return buildAccidents(rows.map((cells, i) => normalizeRow(cells, i + 1, 'test.xlsx')), null).accidents[0];
}

const when = (day: number, month: number, year: number, hour = 12, minute = 0) => ({ year, month, day, hour, minute });

describe('dates', () => {
  it('knows the weekday, whatever the zone', () => {
    expect(weekday(when(5, 1, 2025))).toBe('nedelja');
    expect(weekday(when(19, 11, 2015))).toBe('četvrtak');
    expect(weekday(when(29, 2, 2024, 0, 0))).toBe('četvrtak');
  });

  it('splits the day', () => {
    expect([0, 4, 5, 8, 9, 11, 12, 16, 17, 21, 22, 23].map(dayPart)).toEqual([
      'noć',
      'noć',
      'jutro',
      'jutro',
      'prepodne',
      'prepodne',
      'popodne',
      'popodne',
      'veče',
      'veče',
      'noć',
      'noć',
    ]);
  });

  it('writes dates in Serbian', () => {
    expect(longDate(when(5, 1, 2025, 18, 50))).toBe('Nedelja, 5. januar 2025. u 18:50');
    expect(longDate(when(19, 11, 2015, 15, 42))).toBe('Četvrtak, 19. novembar 2015. u 15:42');
    expect(shortDate(when(5, 1, 2025, 8, 5))).toBe('05.01.2025. 08:05');
  });
});

describe('an accident as a group', () => {
  it('names it by consequences, municipality and time', () => {
    const first = accident(FIRST_2025);
    expect(nameOf(first)).toBe('Materijalna šteta · Barajevo · 05.01.2025. 18:50');
    expect(nameOf({ ...first, severity: 'injured' })).toBe('Povređeni · Barajevo · 05.01.2025. 18:50');
    expect(nameOf({ ...first, severity: 'killed' })).toBe('Poginuli · Barajevo · 05.01.2025. 18:50');
  });

  it('keeps a name within 120 characters', () => {
    const long = { ...accident(FIRST_2025), municipality: 'Opština '.repeat(30) };
    const name = nameOf(long);
    expect([...name].length).toBeLessThanOrEqual(MAX_NAME);
    expect(name.endsWith('… · 05.01.2025. 18:50')).toBe(true);
  });

  it('pins it by consequences', () => {
    expect([pinOf('killed'), pinOf('injured'), pinOf('damage')]).toEqual(['problem', 'warning', 'transport']);
  });

  it('describes it as the plan shows (the first accident of 2025, with injuries)', () => {
    const injured = accident([...FIRST_2025.slice(0, 6), 'Sa povredjenim', ...FIRST_2025.slice(7)]);
    expect(descriptionOf(injured)).toBe(
      [
        '## Saobraćajna nezgoda sa povređenim licima',
        '',
        '**Nedelja, 5. januar 2025. u 18:50** · Barajevo (PU Beograd)',
        '',
        '- **Posledice:** povređena lica',
        '- **Vrsta:** nezgoda sa parkiranim vozilima',
        '- **Situacija:** Ostali sudari sa parkiranim vozilom',
        '- **Doba dana:** veče',
        '- **Mesto:** [44.619215, 20.366175](https://www.openstreetmap.org/?mlat=44.619215&mlon=20.366175#map=18/44.619215/20.366175)',
        '',
        'Izvor: MUP Republike Srbije, data.gov.rs, 2025. · ID nezgode: 1510533',
      ].join('\n'),
    );
  });

  it('describes the real first row of 2025, with material damage', () => {
    const text = descriptionOf(accident(FIRST_2025));
    expect(text.startsWith('## Saobraćajna nezgoda sa materijalnom štetom\n\n')).toBe(true);
    expect(text).toContain('- **Posledice:** samo materijalna šteta\n');
  });

  it('lists every kind and situation of an accident on two rows', () => {
    expect(descriptionOf(accident(...TWO_ROWS_1110717))).toBe(
      [
        '## Saobraćajna nezgoda sa povređenim licima',
        '',
        '**Četvrtak, 19. novembar 2015. u 15:42** · Čukarica (PU Beograd)',
        '',
        '- **Posledice:** povređena lica',
        '- **Vrste:** nezgoda sa najmanje dva vozila, sa skretanjem ili prelaskom; nezgoda sa najmanje dva vozila, bez skretanja',
        '- **Situacije:**',
        '  - Najmanje dva vozila koja se kreću istim putem u istom smeru uz skretanje, skretanje ulevo ispred drugog vozila',
        '  - Najmanje dva vozila koja se kreću u istom smeru – preticanje',
        '- **Doba dana:** popodne',
        '- **Mesto:** [44.767087, 20.406821](https://www.openstreetmap.org/?mlat=44.767087&mlon=20.406821#map=18/44.767087/20.406821)',
        '',
        'Izvor: MUP Republike Srbije, data.gov.rs, 2015. · ID nezgode: 1110717',
      ].join('\n'),
    );
  });

  it('escapes markdown in the data', () => {
    expect(escapeMarkdown('Sudar *brzo* [link](x) _a_ `b` {c} \\')).toBe('Sudar \\*brzo\\* \\[link\\](x) \\_a\\_ \\`b\\` \\{c\\} \\\\');
    expect(escapeMarkdown('<script> ~~x~~ &amp;')).toBe('&lt;script> &#126;&#126;x&#126;&#126; &amp;amp;');
    expect(escapeMarkdown('# naslov')).toBe('\\# naslov');
    expect(escapeMarkdown('- stavka')).toBe('\\- stavka');
    expect(escapeMarkdown('1. stavka')).toBe('1\\. stavka');
    expect(escapeMarkdown('Najmanje dva vozila – čeoni sudar (bez podataka o smeru)')).toBe('Najmanje dva vozila – čeoni sudar (bez podataka o smeru)');
  });

  it('links the place on OpenStreetMap', () => {
    expect(osmLink(44.59267, 20)).toBe('[44.59267, 20](https://www.openstreetmap.org/?mlat=44.59267&mlon=20#map=18/44.59267/20)');
  });

  it('makes the child createChildren gets', () => {
    expect(childOf(accident(FIRST_2025))).toEqual({
      key: 'mup:1510533',
      name: 'Materijalna šteta · Barajevo · 05.01.2025. 18:50',
      description: descriptionOf(accident(FIRST_2025)),
      descriptionFormat: 'markdown',
      lat: 44.619215,
      lng: 20.366175,
      pin: 'transport',
      isPublic: true,
      inheritsMembers: false,
    });
  });
});
