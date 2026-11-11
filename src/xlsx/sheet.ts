// Reading a sheet's XML without a DOM: the rows and their cells by column
// letter, shared strings, inline strings, formula strings and plain numbers.
// A year's sheet is about 13 MB, so the rows come a slice at a time and the
// page can draw its progress between slices.

export type SheetRow = {
  /** The row's number in the sheet (1 for the first). */
  line: number;
  /** Text of columns A, B, ... as written: a number stays its digits ("4.5E+18" too). */
  cells: string[];
};

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** XML entities, then Excel's `_xHHHH_` escapes (`_x000D_`, and `_x005F_` for a literal underscore). */
export function decodeXml(text: string): string {
  let out = text;
  if (out.includes('&')) {
    out = out.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name: string) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name] ?? whole;
    });
  }
  if (out.includes('_x')) {
    out = out.replace(/_x([0-9a-fA-F]{4})_/g, (_whole, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }
  return out;
}

/** The text of every `<t>` inside `xml`, with phonetic runs (`<rPh>`) left out. */
function textRuns(xml: string): string {
  const body = xml.includes('<rPh') ? xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '') : xml;
  let out = '';
  for (const match of body.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) out += match[1] ?? '';
  return decodeXml(out);
}

export function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) strings.push(match[1] ? textRuns(match[1]) : '');
  return strings;
}

/** "E2" → 4; -1 for a reference without letters. */
export function columnIndex(ref: string): number {
  let index = 0;
  let letters = 0;
  for (const char of ref) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) index = index * 26 + (code - 64);
    else if (code >= 97 && code <= 122) index = index * 26 + (code - 96);
    else break;
    letters++;
  }
  return letters === 0 ? -1 : index - 1;
}

/** An attribute's value in a tag's attribute text, e.g. ` r="E2" t="s"`. */
function attr(attrs: string, name: string): string | null {
  let from = 0;
  for (;;) {
    const at = attrs.indexOf(`${name}=`, from);
    if (at === -1) return null;
    const before = attrs.charCodeAt(at - 1);
    // Only a whole name: " t=" but not " xt=".
    if (at === 0 || before === 32 || before === 9 || before === 10 || before === 13) {
      const quote = attrs[at + name.length + 1];
      const end = attrs.indexOf(quote, at + name.length + 2);
      return end === -1 ? null : attrs.slice(at + name.length + 2, end);
    }
    from = at + 1;
  }
}

function cellText(type: string | null, inner: string, strings: string[]): string {
  if (type === 'inlineStr') return textRuns(inner);

  const start = inner.indexOf('<v');
  if (start === -1) return '';
  const open = inner.indexOf('>', start);
  if (inner[open - 1] === '/') return '';
  const end = inner.indexOf('</v>', open);
  const raw = inner.slice(open + 1, end === -1 ? undefined : end);

  if (type === 's') return strings[parseInt(raw, 10)] ?? '';
  return decodeXml(raw);
}

const ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

/** Reads the rows of a sheet a slice at a time. */
export class RowReader {
  private readonly row = new RegExp(ROW.source, 'g');
  private readonly xml: string;
  private readonly strings: string[];
  private readonly columns: number;
  private last = 0;
  done = false;

  constructor(xml: string, strings: string[], columns = 9) {
    this.xml = xml;
    this.strings = strings;
    this.columns = columns;
    const data = xml.indexOf('<sheetData');
    this.row.lastIndex = data === -1 ? xml.length : data;
    if (data === -1) this.done = true;
  }

  /** How far through the sheet it has read, from 0 to 1. */
  get progress(): number {
    return this.done ? 1 : this.row.lastIndex / Math.max(1, this.xml.length);
  }

  /** Up to `max` rows; empty once the sheet has no more. */
  read(max: number): SheetRow[] {
    const rows: SheetRow[] = [];
    while (rows.length < max && !this.done) {
      const match = this.row.exec(this.xml);
      if (!match) {
        this.done = true;
        break;
      }

      const r = attr(match[1], 'r');
      const line = r ? parseInt(r, 10) : this.last + 1;
      this.last = line;

      const cells = new Array<string>(this.columns).fill('');
      if (match[2]) {
        const cell = new RegExp(CELL.source, 'g');
        let position = -1;
        for (let c = cell.exec(match[2]); c; c = cell.exec(match[2])) {
          const ref = attr(c[1], 'r');
          position = ref ? columnIndex(ref) : position + 1;
          if (position >= 0 && position < this.columns && c[2]) cells[position] = cellText(attr(c[1], 't'), c[2], this.strings);
        }
      }
      rows.push({ line, cells });
    }
    return rows;
  }
}

/** A first row whose A is not a number is a header. */
export function isHeaderRow(row: SheetRow | undefined): boolean {
  return row !== undefined && row.line === 1 && !/^\s*-?\d+(\.\d+)?([eE][+-]?\d+)?\s*$/.test(row.cells[0] ?? '');
}

/** Every row at once, without a header (for tests and small sheets). */
export function parseRows(xml: string, strings: string[], columns = 9): { rows: SheetRow[]; header: boolean } {
  const rows = new RowReader(xml, strings, columns).read(Number.POSITIVE_INFINITY);
  const header = isHeaderRow(rows[0]);
  return { rows: header ? rows.slice(1) : rows, header };
}
