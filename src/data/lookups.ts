// What columns G (consequences) and H (kind) say, whatever the spelling: the
// files write "Sa mat.stetom" and "SN SA NAJMANjE DVA VOZILA – BEZ SKRETANjA",
// with an en dash or a hyphen, and without diacritics in some years.

/** Lower case, "đ" as "dj", no diacritics, and only letters and digits between single spaces. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type Severity = 'killed' | 'injured' | 'damage';

/** The worst first. */
export const SEVERITIES: Severity[] = ['killed', 'injured', 'damage'];

export const SEVERITY_RANK: Record<Severity, number> = { damage: 0, injured: 1, killed: 2 };

export function severityOf(raw: string): Severity | null {
  const folded = fold(raw);
  if (folded === '') return null;
  if (/\bpogin/.test(folded)) return 'killed';
  if (/\bpovre?dj?en/.test(folded)) return 'injured';
  if (/\bmat(\b|erijal)/.test(folded) && /\bstet/.test(folded)) return 'damage';
  return null;
}

export type Kind = 'single' | 'twoStraight' | 'twoTurning' | 'parked' | 'pedestrians';

const KINDS: Record<string, Kind> = {
  'sn sa jednim vozilom': 'single',
  'sn sa najmanje dva vozila bez skretanja': 'twoStraight',
  'sn sa najmanje dva vozila skretanje ili prelazak': 'twoTurning',
  'sn sa parkiranim vozilima': 'parked',
  'sn sa pesacima': 'pedestrians',
};

export function kindOf(raw: string): Kind | null {
  const folded = fold(raw).replace(/^saobracajna nezgoda /, 'sn ');
  return KINDS[folded] ?? null;
}

// The words of a description, always in Latin: a description is data, the
// same for every reader, whatever the language of the page.

export const KIND_TEXT: Record<Kind, string> = {
  single: 'nezgoda sa jednim vozilom',
  twoStraight: 'nezgoda sa najmanje dva vozila, bez skretanja',
  twoTurning: 'nezgoda sa najmanje dva vozila, sa skretanjem ili prelaskom',
  parked: 'nezgoda sa parkiranim vozilima',
  pedestrians: 'nezgoda sa pešacima',
};

/** The heading: "Saobraćajna nezgoda sa …". */
export const SEVERITY_TITLE: Record<Severity, string> = {
  killed: 'Saobraćajna nezgoda sa poginulim licima',
  injured: 'Saobraćajna nezgoda sa povređenim licima',
  damage: 'Saobraćajna nezgoda sa materijalnom štetom',
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  killed: 'poginula lica',
  injured: 'povređena lica',
  damage: 'samo materijalna šteta',
};

/** The start of a group's name. */
export const SEVERITY_NAME: Record<Severity, string> = {
  killed: 'Poginuli',
  injured: 'Povređeni',
  damage: 'Materijalna šteta',
};

/** The pin on the map: its tone colours the clusters' rings too. */
export const SEVERITY_PIN: Record<Severity, string> = {
  killed: 'problem',
  injured: 'warning',
  damage: 'transport',
};

/** "SN SA NEČIM" → "Sn sa nečim": a kind the tables do not know, kept as written. */
export function sentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
