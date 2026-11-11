// Names written in capitals ("PETROVAC NA MLAVI", "KNjAŽEVAC") as names are
// written. A port of potok-ide's AreaImport.title_case/1, so a municipality
// reads the same here as the areas imported there.

// Words that stay lowercase inside a name. Not "do": in "Suvi Do" it is a
// valley, not a preposition.
const LOWERCASE = new Set(['i', 'u', 'na', 'od', 'iz', 'sa', 'za', 'uz', 'po', 'pri', 'kod', 'pod', 'nad']);

/** Elixir's String.capitalize: the first letter up, the rest down. */
function capitalizeWord(text: string): string {
  const [first = '', ...rest] = [...text];
  return first.toUpperCase() + rest.join('').toLowerCase();
}

// "(BEOGRAD)" is "(Beograd)": what comes before the first letter stays.
function capitalize(part: string): string {
  const match = /^([^\p{L}]*)([\s\S]*)$/u.exec(part)!;
  return match[1] + capitalizeWord(match[2]);
}

function word(text: string, first: boolean, last: boolean): string {
  const lower = text.toLowerCase();

  // A lone "I" at the end is a numeral ("Kumodraž I"), anywhere else "and".
  if (text === 'I' && last && !first) return text;
  if (LOWERCASE.has(lower) && !first) return lower;
  if (text === 'MZ') return text;
  if (/^[IVX]{2,}$/.test(text)) return text;
  if ([...text].length === 1) return text;
  return text.split('-').map(capitalize).join('-');
}

/** "PETROVAC NA MLAVI" → "Petrovac na Mlavi", "ČUKARICA" → "Čukarica". */
export function titleCase(name: string): string {
  const words = name.split(/\s+/u).filter(Boolean);
  const last = words.length - 1;
  return words.map((text, index) => word(text, index === 0, index === last)).join(' ');
}
