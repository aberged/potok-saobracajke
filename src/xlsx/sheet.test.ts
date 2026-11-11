import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { columnIndex, decodeXml, isHeaderRow, parseRows, parseSharedStrings, RowReader } from './sheet';
import { locateParts, readWorkbook, resolveTarget, XlsxError } from './unzip';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

// The first row of 2015 and of 2024 as the files write them: shared strings,
// and in 2024 coordinates as numbers without a decimal point.
const STRINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst ${NS} count="9" uniqueCount="9">
<si><t>BEOGRAD</t></si><si><t>BARAJEVO</t></si><si><t>01.10.2015,12:05</t></si>
<si><t>20.4180857555</t></si><si><t>44.5788977355</t></si><si><t>Sa mat.stetom</t></si>
<si><t>SN SA JEDNIM VOZILOM</t></si>
<si><r><rPr><b/></rPr><t xml:space="preserve">Nezgode sa učešćem </t></r><r><t>jednog vozila</t></r><rPh sb="0" eb="1"><t>FURIGANA</t></rPh></si>
<si><t>Prelazak pešaka sleva, van raskrsnice , bez skretanja vozila &amp; _x000D_x</t></si>
</sst>`;

const SHEET = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS}><dimension ref="A1:I3"/><sheetData>
<row r="1" spans="1:9"><c r="A1"><v>1106801</v></c><c r="B1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c><c r="E1" s="1" t="s"><v>3</v></c><c r="F1" s="1" t="s"><v>4</v></c><c r="G1" t="s"><v>5</v></c><c r="H1" t="s"><v>6</v></c><c r="I1" t="s"><v>7</v></c></row>
<row r="2" spans="1:9"><c r="A2"><v>1457983</v></c><c r="B2" t="s"><v>0</v></c><c r="C2" t="inlineStr"><is><t>BARAJEVO</t></is></c><c r="D2" t="str"><f>X</f><v>01.01.2024,08:00</v></c><c r="E2" s="2"><v>20358773</v></c><c r="F2" s="2"><v>44623482</v></c><c r="G2" t="s"><v>5</v></c><c r="H2" t="s"/><c r="I2" t="s"><v>8</v></c></row>
<row r="4"><c r="A4"><v>44.592669999999998</v></c><c r="F4"><v>4.5249694523101998E+18</v></c></row>
<row r="5"/>
</sheetData></worksheet>`;

describe('decodeXml', () => {
  it('reads entities and Excel escapes', () => {
    expect(decodeXml('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos; &#268;&#x10C;')).toBe('a & b <c> "d" \'e\' ČČ');
    expect(decodeXml('red_x000D_dva')).toBe('red\rdva');
    expect(decodeXml('_x005F_x0041_')).toBe('_x0041_');
    expect(decodeXml('&unknown; plain')).toBe('&unknown; plain');
  });
});

describe('shared strings', () => {
  it('joins rich runs and leaves out phonetic ones', () => {
    const strings = parseSharedStrings(STRINGS);
    expect(strings).toHaveLength(9);
    expect(strings[0]).toBe('BEOGRAD');
    expect(strings[7]).toBe('Nezgode sa učešćem jednog vozila');
    expect(strings[8]).toBe('Prelazak pešaka sleva, van raskrsnice , bez skretanja vozila & \rx');
  });

  it('takes an empty item and no file', () => {
    expect(parseSharedStrings(`<sst><si/><si><t/></si><si><t>x</t></si></sst>`)).toEqual(['', '', 'x']);
    expect(parseSharedStrings(null)).toEqual([]);
  });
});

describe('rows', () => {
  it('reads cells by column letter, of every type', () => {
    const { rows, header } = parseRows(SHEET, parseSharedStrings(STRINGS));
    expect(header).toBe(false);
    expect(rows.map((row) => row.line)).toEqual([1, 2, 4, 5]);
    expect(rows[0].cells).toEqual([
      '1106801',
      'BEOGRAD',
      'BARAJEVO',
      '01.10.2015,12:05',
      '20.4180857555',
      '44.5788977355',
      'Sa mat.stetom',
      'SN SA JEDNIM VOZILOM',
      'Nezgode sa učešćem jednog vozila',
    ]);
    expect(rows[1].cells.slice(0, 6)).toEqual(['1457983', 'BEOGRAD', 'BARAJEVO', '01.01.2024,08:00', '20358773', '44623482']);
    expect(rows[1].cells[7]).toBe('');
    expect(rows[2].cells).toEqual(['44.592669999999998', '', '', '', '', '4.5249694523101998E+18', '', '', '']);
    expect(rows[3].cells.every((cell) => cell === '')).toBe(true);
  });

  it('takes cells without a reference in order', () => {
    const { rows } = parseRows(`<sheetData><row><c><v>1</v></c><c t="inlineStr"><is><t>b</t></is></c></row></sheetData>`, []);
    expect(rows[0]).toEqual({ line: 1, cells: ['1', 'b', '', '', '', '', '', '', ''] });
  });

  it('skips a header: A1 that is not a number', () => {
    const xml = `<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ID</t></is></c></row><row r="2"><c r="A2"><v>7</v></c></row></sheetData>`;
    const { rows, header } = parseRows(xml, []);
    expect(header).toBe(true);
    expect(rows.map((row) => row.cells[0])).toEqual(['7']);
    expect(isHeaderRow({ line: 1, cells: ['1510533'] })).toBe(false);
    expect(isHeaderRow({ line: 2, cells: ['ID'] })).toBe(false);
  });

  it('reads a slice at a time and says how far it is', () => {
    const reader = new RowReader(SHEET, parseSharedStrings(STRINGS));
    expect(reader.read(2)).toHaveLength(2);
    expect(reader.progress).toBeGreaterThan(0);
    expect(reader.progress).toBeLessThan(1);
    expect(reader.read(10)).toHaveLength(2);
    expect(reader.read(10)).toHaveLength(0);
    expect(reader.done).toBe(true);
    expect(reader.progress).toBe(1);
  });

  it('knows column letters', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('I6763')).toBe(8);
    expect(columnIndex('AA2')).toBe(26);
    expect(columnIndex('12')).toBe(-1);
  });
});

describe('unzip', () => {
  const workbook = `<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="NEZ" sheetId="1" r:id="rId7"/><sheet name="Drugi" sheetId="2" r:id="rId8"/></sheets></workbook>`;
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/podaci.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="strings.xml"/></Relationships>`;

  it('finds the first sheet through the workbook and its relationships', () => {
    expect(locateParts(workbook, rels)).toEqual({ sheet: 'xl/worksheets/podaci.xml', strings: 'xl/strings.xml' });
    expect(locateParts(null, null)).toEqual({ sheet: 'xl/worksheets/sheet1.xml', strings: 'xl/sharedStrings.xml' });
    expect(resolveTarget('../xl/./worksheets/a.xml')).toBe('xl/worksheets/a.xml');
  });

  it('reads only the sheet and the strings out of the zip', () => {
    const zip = zipSync({
      'xl/workbook.xml': strToU8(workbook),
      'xl/_rels/workbook.xml.rels': strToU8(rels),
      'xl/worksheets/podaci.xml': strToU8(SHEET),
      'xl/worksheets/sheet2.xml': strToU8('<worksheet/>'),
      'xl/strings.xml': strToU8(STRINGS),
    });
    const read = readWorkbook(zip);
    expect(read.sheetPath).toBe('xl/worksheets/podaci.xml');
    expect(read.sheet).toBe(SHEET);
    expect(parseSharedStrings(read.sharedStrings)[1]).toBe('BARAJEVO');
  });

  it('falls back to sheet1.xml and says what is wrong', () => {
    const zip = zipSync({ 'xl/worksheets/sheet1.xml': strToU8(SHEET) });
    expect(readWorkbook(zip).sharedStrings).toBeNull();
    expect(() => readWorkbook(strToU8('not a zip'))).toThrow(XlsxError);
    expect(() => readWorkbook(zipSync({ 'xl/workbook.xml': strToU8(workbook) }))).toThrow('no_sheet');
  });
});
