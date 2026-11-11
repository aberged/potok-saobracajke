// Dates in a description, in Serbian Latin. The file's times are local and
// carry no zone, so the weekday comes from Date.UTC and getUTCDay: the
// viewer's own zone never moves an accident to another day.

import type { When } from '../data/normalize';

export const WEEKDAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];

export const MONTHS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function weekday(when: When): string {
  return WEEKDAYS[new Date(Date.UTC(when.year, when.month - 1, when.day)).getUTCDay()];
}

/** Night 22–05, morning 05–09, before noon 09–12, afternoon 12–17, evening 17–22. */
export function dayPart(hour: number): string {
  if (hour >= 22 || hour < 5) return 'noć';
  if (hour < 9) return 'jutro';
  if (hour < 12) return 'prepodne';
  if (hour < 17) return 'popodne';
  return 'veče';
}

export const clock = (when: When) => `${pad2(when.hour)}:${pad2(when.minute)}`;

/** "Nedelja, 5. januar 2025. u 18:50" */
export function longDate(when: When): string {
  const day = weekday(when);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${when.day}. ${MONTHS[when.month - 1]} ${when.year}. u ${clock(when)}`;
}

/** "05.01.2025. 18:50" */
export function shortDate(when: When): string {
  return `${pad2(when.day)}.${pad2(when.month)}.${when.year}. ${clock(when)}`;
}
