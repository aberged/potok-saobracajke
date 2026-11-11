// An accident's name, pin and description. The description is markdown that
// Potok renders with Earmark (`breaks: true`, so blocks are kept apart by an
// empty line) and cleans with its scrubber, which keeps headings, lists,
// `strong` and https links.

import type { Accident } from '../data/accidents';
import { SEVERITY_NAME, SEVERITY_PIN, SEVERITY_TEXT, SEVERITY_TITLE, type Severity } from '../data/lookups';
import { dayPart, longDate, shortDate } from './dates';

/**
 * Who the data comes from, in every description's last line. Check the data
 * set's exact name, its address on data.gov.rs and the licence's wording
 * before the first import on production, and write them here.
 */
export const SOURCE = 'MUP Republike Srbije, data.gov.rs';

export const MAX_NAME = 120;

export const pinOf = (severity: Severity) => SEVERITY_PIN[severity];

/**
 * Text from the file, safe inside a line of markdown: what Earmark reads as
 * emphasis, code, links or attributes gets a backslash, `<` and `~` become
 * entities, and so does an `&` that would start one. What could open a block
 * at the start (a heading, a list, a quote) is escaped too.
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/&(?=#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/[\\`*_{}[\]]/g, (char) => `\\${char}`)
    .replace(/</g, '&lt;')
    .replace(/~/g, '&#126;')
    .replace(/^(\s*)([#>+=-])/, '$1\\$2')
    .replace(/^(\s*\d+)([.)])/, '$1\\$2');
}

/** A link to the place on OpenStreetMap, the coordinates as its text. */
export function osmLink(lat: number, lng: number): string {
  return `[${lat}, ${lng}](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng})`;
}

const length = (text: string) => [...text].length;

/** "Povređeni · Barajevo · 05.01.2025. 18:50", at most 120 characters. */
export function nameOf(accident: Accident): string {
  const head = SEVERITY_NAME[accident.severity];
  const tail = shortDate(accident.when);
  const name = [head, accident.municipality || accident.district, tail].filter(Boolean).join(' · ');
  if (length(name) <= MAX_NAME) return name;

  const room = MAX_NAME - length(`${head} ·  · ${tail}`) - 1;
  const place = [...(accident.municipality || accident.district)].slice(0, Math.max(0, room)).join('');
  return `${head} · ${place}… · ${tail}`;
}

function placeLine(accident: Accident): string {
  const municipality = escapeMarkdown(accident.municipality);
  const district = escapeMarkdown(accident.district);
  if (municipality && district) return `${municipality} (PU ${district})`;
  return municipality || (district ? `PU ${district}` : '');
}

export function footerOf(accident: Accident): string {
  return `Izvor: ${SOURCE}, ${accident.when.year}. · ID nezgode: ${accident.id}`;
}

export function descriptionOf(accident: Accident): string {
  const list = [`- **Posledice:** ${SEVERITY_TEXT[accident.severity]}`];

  const kinds = accident.kinds.map(escapeMarkdown);
  if (kinds.length === 1) list.push(`- **Vrsta:** ${kinds[0]}`);
  else if (kinds.length > 1) list.push(`- **Vrste:** ${kinds.join('; ')}`);

  const situations = accident.situations.map(escapeMarkdown);
  if (situations.length === 1) list.push(`- **Situacija:** ${situations[0]}`);
  else if (situations.length > 1) list.push('- **Situacije:**', ...situations.map((situation) => `  - ${situation}`));

  list.push(`- **Doba dana:** ${dayPart(accident.when.hour)}`);
  list.push(`- **Mesto:** ${osmLink(accident.lat, accident.lng)}`);

  const place = placeLine(accident);
  const when = `**${longDate(accident.when)}**${place ? ` · ${place}` : ''}`;

  return [`## ${SEVERITY_TITLE[accident.severity]}`, when, list.join('\n'), footerOf(accident)].join('\n\n');
}
