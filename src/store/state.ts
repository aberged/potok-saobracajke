// One state for the whole app and one way to change it. Every change draws the
// page again on the next frame; lit-html touches only what changed.

import type { Accident, Built } from '../data/accidents';
import type { Row, Skip } from '../data/normalize';
import type { ReadErrorCode, ReadProgress } from '../data/read';
import type { AccidentChild } from '../import/children';
import type { Cursor, FileInfo } from '../import/cursor';
import type { Progress } from '../import/runner';

export type Screen = 'checking' | 'blocked' | 'pick' | 'parsing' | 'preview' | 'importing' | 'report';

export type Blocked = 'preview' | 'rights' | 'outdated' | 'noWarning' | 'pins' | 'failed';

export type Sample = { accident: Accident; child: AccidentChild; html: string | null; error: string | null; loading: boolean };

export type State = {
  screen: Screen;
  blocked: Blocked | null;
  missingPins: string[];
  groupName: string;
  /** The year in the group's name. */
  groupYear: number | null;
  /** The year the import keeps; null for every year. */
  year: number | null;
  yearText: string;
  yearError: boolean;
  /** Where an earlier import got to, from localStorage. */
  cursor: Cursor | null;
  files: FileInfo[];
  reading: ReadProgress | null;
  readError: { file: string; code: ReadErrorCode } | null;
  rows: (Row | Skip)[];
  perFile: { name: string; rows: number; header: boolean }[];
  built: Built | null;
  /** The fingerprint of these files and accidents (src/import/cursor.ts). */
  fingerprint: string | null;
  samples: Sample[];
  progress: Progress | null;
  /** The address of the report's CSV, while it lives. */
  csvUrl: string | null;
  csvText: string;
  csvLines: number;
};

export const state: State = {
  screen: 'checking',
  blocked: null,
  missingPins: [],
  groupName: '',
  groupYear: null,
  year: null,
  yearText: '',
  yearError: false,
  cursor: null,
  files: [],
  reading: null,
  readError: null,
  rows: [],
  perFile: [],
  built: null,
  fingerprint: null,
  samples: [],
  progress: null,
  csvUrl: null,
  csvText: '',
  csvLines: 0,
};

let draw: () => void = () => {};
let scheduled = false;

export function onChange(render: () => void) {
  draw = render;
}

/** Changes the state and draws on the next frame. */
export function update(change: (current: State) => void) {
  change(state);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    draw();
  });
}
