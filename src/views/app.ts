// The whole app: a header with the group and the year, the steps, and the
// screen of the moment.

import { html, nothing } from 'lit-html';
import type { Key } from '../i18n';
import { boot } from '../store/actions';
import { state, type Blocked, type Screen } from '../store/state';
import { notice, ui } from './common';
import { icon } from './icons';
import { parsingView, pickView } from './pick';
import { previewView } from './preview';
import { importingView, reportView } from './run';

const STEPS: { key: Key; screens: Screen[] }[] = [
  { key: 'stepFiles', screens: ['pick', 'parsing'] },
  { key: 'stepPreview', screens: ['preview'] },
  { key: 'stepImport', screens: ['importing'] },
  { key: 'stepReport', screens: ['report'] },
];

function steps() {
  const at = STEPS.findIndex((step) => step.screens.includes(state.screen));
  if (at === -1) return nothing;
  return html`<ul class="d-steps w-full text-xs" id="steps">
    ${STEPS.map((step, index) => html`<li class="d-step ${index <= at ? 'd-step-primary' : ''}">${ui.t(step.key)}</li>`)}
  </ul>`;
}

function header() {
  const t = ui.t;
  const sub = [state.groupName, state.year === null ? null : String(state.year)].filter(Boolean).join(' · ');
  return html`<header class="flex items-start gap-3" id="app-header">
    <span class="ps-tile" aria-hidden="true">${icon('pin', 'size-6')}</span>
    <div class="flex min-w-0 flex-col">
      <h1 class="text-lg leading-tight font-semibold">${t('appName')}</h1>
      <p class="text-sm opacity-70">${sub || t('appSub')}</p>
    </div>
  </header>`;
}

const BLOCKED_TEXT: Record<Blocked, Key> = {
  preview: 'blockedPreview',
  rights: 'blockedRights',
  outdated: 'blockedOutdated',
  noWarning: 'blockedNoWarning',
  pins: 'blockedPins',
  failed: 'blockedFailed',
};

function blockedView() {
  const t = ui.t;
  const reason = state.blocked ?? 'failed';
  const text = t(BLOCKED_TEXT[reason], { pins: state.missingPins.join(', ') });
  const kind = reason === 'preview' ? 'info' : reason === 'failed' ? 'error' : 'warning';

  return html`<div class="flex flex-col gap-3" id="blocked" data-reason=${reason}>
    ${notice(text, kind, 'blocked-text')}
    ${reason === 'failed'
      ? html`<div><button type="button" class="d-btn" id="retry-check" @click=${() => void boot()}>${icon('retry', 'size-4')}${t('retry')}</button></div>`
      : nothing}
  </div>`;
}

function screenView() {
  switch (state.screen) {
    case 'checking':
      return html`<p class="flex items-center gap-2 text-sm opacity-80" id="checking" role="status">
        <span class="d-loading d-loading-spinner d-loading-sm" aria-hidden="true"></span>${ui.t('checking')}
      </p>`;
    case 'blocked':
      return blockedView();
    case 'pick':
      return pickView();
    case 'parsing':
      return parsingView();
    case 'preview':
      return previewView();
    case 'importing':
      return importingView();
    case 'report':
      return reportView();
  }
}

export function appView() {
  return html`<div class="ps-root">${header()} ${steps()}
    <main class="flex flex-col gap-4">${screenView()}</main>
  </div>`;
}
