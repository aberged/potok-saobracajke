// Choosing the files and the year, and reading them.

import { html, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Key } from '../i18n';
import { applyYear, pickFiles, typeYear } from '../store/actions';
import { state } from '../store/state';
import { card, notice, num, progressBar, ui } from './common';
import { icon } from './icons';

const READ_REASON: Record<string, Key> = {
  not_xlsx: 'reasonNotXlsx',
  no_sheet: 'reasonNoSheet',
  unreadable: 'reasonUnreadable',
  empty: 'reasonEmpty',
};

const XLSX_TYPES = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function chosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  void pickFiles(files);
}

function dropped(event: DragEvent) {
  event.preventDefault();
  void pickFiles([...(event.dataTransfer?.files ?? [])].filter((file) => /\.xlsx$/i.test(file.name)));
}

export function yearView() {
  const t = ui.t;
  const name = state.groupName || t('empty');
  const changed = state.groupYear !== null && state.year !== state.groupYear;

  return html`<div class="flex flex-col gap-2" id="year">
    <p class="text-sm">
      ${state.groupYear === null ? t('yearNone', { name }) : t('yearFromGroup', { name, year: state.groupYear })}
    </p>
    <label class="flex flex-wrap items-center gap-2" for="year-input">
      <span class="text-sm font-medium">${t('yearField')}</span>
      <input
        id="year-input"
        class="d-input d-input-sm w-24 ${state.yearError ? 'd-input-error' : ''}"
        inputmode="numeric"
        maxlength="4"
        placeholder=${t('yearAll')}
        .value=${live(state.yearText)}
        @input=${(event: Event) => typeYear((event.target as HTMLInputElement).value)}
        @change=${applyYear}
        @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
      />
      <span class="text-xs opacity-70">${t('yearAll')}</span>
    </label>
    ${state.yearError ? html`<p class="text-error text-sm">${t('yearBad')}</p>` : nothing}
    ${changed && !state.yearError ? html`<p class="text-warning text-sm">${t('yearChanged', { year: state.groupYear! })}</p>` : nothing}
  </div>`;
}

function cursorNotice() {
  const cursor = state.cursor;
  if (!cursor) return nothing;
  const t = ui.t;
  const values = {
    files: cursor.files.join(', ') || t('empty'),
    next: num(cursor.next),
    total: num(cursor.total),
    when: cursor.savedAt ? new Date(cursor.savedAt).toLocaleString(t.lang === 'en' ? 'en-GB' : 'sr-Latn-RS') : t('empty'),
  };
  return cursor.next >= cursor.total ? notice(t('cursorDone', values), 'info', 'cursor') : notice(t('cursorFound', values), 'warning', 'cursor');
}

export function pickView() {
  const t = ui.t;
  const error = state.readError;

  return html`
    ${cursorNotice()}
    ${card(
      html`<p class="text-sm opacity-80">${t('pickHint')}</p>
        <label
          class="ps-drop"
          for="file-input"
          @dragover=${(event: DragEvent) => event.preventDefault()}
          @drop=${dropped}
        >
          <span class="ps-tile" aria-hidden="true">${icon('upload', 'size-6')}</span>
          <span class="d-btn d-btn-primary">${icon('file', 'size-5')}${t('pickButton')}</span>
          <input id="file-input" class="sr-only" type="file" accept=${XLSX_TYPES} multiple @change=${chosen} />
        </label>
        ${error ? notice(t('parseFailed', { name: error.file, reason: t(READ_REASON[error.code]) }), 'error', 'read-error') : nothing}`,
      { title: t('pickTitle'), symbol: 'file', id: 'pick' },
    )}
    ${card(yearView(), { title: t('yearTitle'), symbol: 'calendar' })}
  `;
}

export function parsingView() {
  const t = ui.t;
  const reading = state.reading;
  const stage: Key = reading?.stage === 'rows' ? 'stageRows' : reading?.stage === 'unzipping' ? 'stageUnzipping' : 'stageReading';

  return card(
    html`<p class="text-sm" id="parsing-file">
        ${reading ? t('parsingFile', { name: reading.name, n: reading.file + 1, count: reading.files }) : t('stageReading')}
      </p>
      ${progressBar(reading?.overall ?? 0, 1, 'parsing-progress')}
      <p class="flex items-center gap-2 text-sm opacity-70">
        <span class="d-loading d-loading-spinner d-loading-xs" aria-hidden="true"></span>${t(stage)} ·
        ${num(Math.round((reading?.overall ?? 0) * 100))} %
      </p>`,
    { title: t('parsingTitle'), symbol: 'table', id: 'parsing' },
  );
}
