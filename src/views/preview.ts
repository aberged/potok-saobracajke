// What the files gave, before anything is sent: the numbers, the rows left
// out and why, and three descriptions as Potok will show them.

import { html, nothing } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { SEVERITIES, SEVERITY_PIN, type Severity } from '../data/lookups';
import { SKIP_REASONS } from '../data/normalize';
import { skipKey, type Key } from '../i18n';
import { resumeIndex } from '../import/cursor';
import { fittingCursor, otherFiles, pinColors, startImport } from '../store/actions';
import { state, type Sample } from '../store/state';
import { card, notice, num, stat, ui } from './common';
import { icon } from './icons';
import { yearView } from './pick';

export const SEVERITY_LABEL: Record<Severity, Key> = { killed: 'sevKilled', injured: 'sevInjured', damage: 'sevDamage' };

export const severityColor = (severity: Severity) => pinColors[SEVERITY_PIN[severity]] || 'currentColor';

function numbers() {
  const t = ui.t;
  const built = state.built!;
  const summary = built.summary;

  return html`<div class="d-stats d-stats-vertical sm:d-stats-horizontal ps-stats w-full" id="preview-numbers">
      ${stat(t('statRows'), num(summary.rows), { id: 'stat-rows' })} ${stat(t('statAccidents'), num(summary.accidents), { id: 'stat-accidents' })}
      ${stat(t('statSkipped'), num(summary.skippedRows), { id: 'stat-skipped' })}
    </div>
    <div class="d-stats d-stats-vertical sm:d-stats-horizontal ps-stats w-full" id="preview-severity">
      ${SEVERITIES.map((severity) =>
        stat(t(SEVERITY_LABEL[severity]), num(summary.bySeverity[severity]), { id: `stat-${severity}`, color: severityColor(severity), hint: SEVERITY_PIN[severity] }),
      )}
    </div>
    <ul class="flex flex-col gap-1 text-sm opacity-80" id="preview-files">
      ${state.perFile.map((file) => html`<li>${t(file.header ? 'perFileHeader' : 'perFile', { name: file.name, rows: num(file.rows) })}</li>`)}
    </ul>`;
}

function notes() {
  const t = ui.t;
  const summary = state.built!.summary;
  const lines = [
    summary.multiRow > 0 ? t('multiRow', { n: num(summary.multiRow) }) : null,
    summary.conflicts > 0 ? t('conflicts', { n: num(summary.conflicts), ids: summary.conflictIds.join(', ') }) : null,
    summary.unknownKinds > 0 ? t('unknownKinds', { n: num(summary.unknownKinds) }) : null,
    summary.swapped > 0 ? t('swapped', { n: num(summary.swapped) }) : null,
  ].filter((line): line is string => line !== null);

  return lines.length > 0 ? html`<div class="flex flex-col gap-2" id="preview-notes">${lines.map((line) => notice(line, 'info'))}</div>` : nothing;
}

/** "2015: 6.763, 2016: 2" */
function otherYears(): string {
  return Object.entries(state.built!.summary.otherYears)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => `${year}: ${num(count)}`)
    .join(', ');
}

function skipped() {
  const t = ui.t;
  const summary = state.built!.summary;
  const reasons = SKIP_REASONS.filter((reason) => summary.skipped[reason].count > 0);

  const body =
    reasons.length === 0
      ? html`<p class="text-sm opacity-80">${t('noneSkipped')}</p>`
      : reasons.map((reason) => {
          const group = summary.skipped[reason];
          return html`<details class="d-collapse d-collapse-arrow ps-reason" id="skip-${reason}">
            <summary class="d-collapse-title flex items-center gap-2 text-sm font-medium">
              <span class="d-badge d-badge-neutral d-badge-sm">${num(group.count)}</span>${t(skipKey(reason))}
            </summary>
            <div class="d-collapse-content">
              ${reason === 'otherYear' ? html`<p class="mb-2 text-sm" id="other-years">${t('otherYears', { years: otherYears() })}</p>` : nothing}
              <ul class="flex flex-col gap-1.5 text-xs">
                ${group.examples.map(
                  (example) => html`<li class="ps-example">
                    <span class="font-medium">${t('exampleRow', { file: example.file, line: example.line })}</span>
                    <code>${example.cells.map((cell) => cell || '∅').join(' | ')}</code>
                  </li>`,
                )}
              </ul>
              ${group.count > group.examples.length
                ? html`<p class="mt-1 text-xs opacity-70">${t('moreSkipped', { n: num(group.count - group.examples.length) })}</p>`
                : nothing}
            </div>
          </details>`;
        });

  return card(body, { title: t('skippedTitle'), symbol: 'skip', id: 'preview-skipped' });
}

function sampleView(sample: Sample) {
  const t = ui.t;
  const severity = sample.accident.severity;

  return html`<article class="ps-sample" data-key=${sample.child.key}>
    <header class="flex flex-wrap items-center gap-2">
      <span class="ps-pin" style="background:${severityColor(severity)}" title=${sample.child.pin} aria-hidden="true">${icon('pin', 'size-4')}</span>
      <strong class="text-sm">${sample.child.name}</strong>
      <span class="d-badge d-badge-ghost d-badge-sm">${sample.child.pin}</span>
    </header>
    ${sample.loading
      ? html`<p class="flex items-center gap-2 text-sm opacity-70">
          <span class="d-loading d-loading-spinner d-loading-xs" aria-hidden="true"></span>${t('sampleLoading')}
        </p>`
      : sample.error
        ? notice(t('sampleFailed', { error: sample.error }), 'warning')
        : html`<div class="rich-content ps-rich">${unsafeHTML(sample.html ?? '')}</div>`}
  </article>`;
}

function samples() {
  const t = ui.t;
  if (state.samples.length === 0) return nothing;
  return card(html`<p class="text-sm opacity-70">${t('samplesHint')}</p>${state.samples.map(sampleView)}`, {
    title: t('samplesTitle'),
    symbol: 'pin',
    id: 'preview-samples',
  });
}

function actions() {
  const t = ui.t;
  const total = state.built!.accidents.length;
  if (total === 0) {
    const years = otherYears();
    return notice(years ? `${t('nothingToImport')} ${t('otherYears', { years })}` : t('nothingToImport'), 'warning', 'nothing-to-import');
  }

  const cursor = fittingCursor();
  const back = html`<button type="button" class="d-btn d-btn-ghost" id="other-files" @click=${otherFiles}>${icon('back', 'size-4')}${t('otherFiles')}</button>`;

  if (cursor && cursor.next < cursor.total) {
    const from = resumeIndex(cursor);
    return html`${notice(t('resumeText', { next: num(cursor.next), total: num(cursor.total), from: num(from) }), 'warning', 'resume')}
      <div class="flex flex-wrap gap-2">
        <button type="button" class="d-btn d-btn-primary" id="resume-import" @click=${() => startImport(from)}>
          ${icon('play', 'size-4')}${t('resumeButton', { from: num(from) })}
        </button>
        <button type="button" class="d-btn" id="restart-import" @click=${() => startImport(0)}>${icon('retry', 'size-4')}${t('restartButton')}</button>
        ${back}
      </div>`;
  }

  return html`${cursor ? notice(t('doneBefore'), 'info', 'done-before') : nothing}
    <p class="text-sm opacity-80">${t('importNote')}</p>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="d-btn d-btn-primary" id="start-import" @click=${() => startImport(0)}>
        ${icon('upload', 'size-4')}${t.plural('import', total, { n: num(total) })}
      </button>
      ${back}
    </div>`;
}

export function previewView() {
  const t = ui.t;
  if (!state.built) return nothing;

  return html`${card(html`${numbers()}${notes()}`, { title: t('previewTitle'), symbol: 'chart', id: 'preview' })}
    ${card(yearView(), { title: t('yearTitle'), symbol: 'calendar' })} ${skipped()} ${samples()}
    <div class="flex flex-col gap-3" id="preview-actions">${actions()}</div>`;
}
