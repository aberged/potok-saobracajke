// The import under way and its report.

import { html, nothing } from 'lit-html';
import type { Key } from '../i18n';
import type { Progress } from '../import/runner';
import { continueImport, csvShown, fittingCursor, newImport, pause, resume } from '../store/actions';
import { state } from '../store/state';
import { card, duration, notice, num, progressBar, stat, ui } from './common';
import { icon } from './icons';

function statusLine(progress: Progress) {
  const t = ui.t;
  if (progress.status === 'paused') return notice(t('statusPaused'), 'info', 'import-status');
  if (progress.pausing) return notice(t('statusPausing'), 'info', 'import-status');
  if (progress.status === 'waiting') return notice(t('statusWaiting'), 'warning', 'import-status');
  if (progress.status === 'retrying') return notice(t('statusRetrying', { reason: progress.reason ?? 'timeout' }), 'warning', 'import-status');
  return html`<p class="flex items-center gap-2 text-sm opacity-80" id="import-status">
    <span class="d-loading d-loading-spinner d-loading-xs" aria-hidden="true"></span>${t('statusRunning')}
  </p>`;
}

function counts(progress: Progress, withPace: boolean) {
  const t = ui.t;
  return html`<div class="d-stats d-stats-vertical sm:d-stats-horizontal ps-stats w-full" id="import-numbers">
      ${stat(t('statCreated'), num(progress.created), { id: 'stat-created' })} ${stat(t('statExisting'), num(progress.existing), { id: 'stat-existing' })}
      ${stat(t('statFailed'), num(progress.failed.length), { id: 'stat-failed' })}
    </div>
    ${withPace
      ? html`<div class="d-stats d-stats-vertical sm:d-stats-horizontal ps-stats w-full" id="import-pace">
          ${stat(t('statRate'), progress.rate === null ? t('empty') : t('ratePerSecond', { n: num(progress.rate, 1) }), {
            id: 'stat-rate',
            hint: t('batchSize', { n: progress.batchSize }),
          })}
          ${stat(t('statEta'), duration(progress.eta), { id: 'stat-eta' })}
        </div>`
      : nothing}`;
}

export function importingView() {
  const t = ui.t;
  const progress = state.progress;
  if (!progress) return nothing;
  const paused = progress.status === 'paused';

  return html`${notice(t('keepOpen'), 'warning', 'keep-open')}
  ${card(
    html`<div class="flex items-baseline justify-between gap-2">
        <strong class="text-lg" id="import-count">${t('progressOf', { done: num(progress.next), total: num(progress.total) })}</strong>
        <span class="text-sm opacity-70">${num(progress.total ? (progress.next / progress.total) * 100 : 0, 1)} %</span>
      </div>
      ${progressBar(progress.next, progress.total, 'import-progress')} ${statusLine(progress)} ${counts(progress, true)}
      <div class="flex flex-wrap gap-2">
        ${paused
          ? html`<button type="button" class="d-btn d-btn-primary" id="import-resume" @click=${resume}>${icon('play', 'size-4')}${t('resume')}</button>`
          : html`<button type="button" class="d-btn" id="import-pause" ?disabled=${progress.pausing} @click=${pause}>
              ${icon('pause', 'size-4')}${t('pause')}
            </button>`}
      </div>`,
    { title: t('importingTitle'), symbol: 'upload', id: 'importing' },
  )}`;
}

const STOP_TEXT: Record<string, Key> = {
  forbidden: 'stopForbidden',
  not_a_member: 'stopForbidden',
  stale_app: 'stopStale',
  unknown_method: 'stopOutdated',
};

function stopNotice(progress: Progress) {
  const t = ui.t;
  const reason = progress.reason ?? 'unknown';
  const key = STOP_TEXT[reason];
  const text = key ? t(key) : t('stopOther', { error: reason });
  return notice(progress.message ? `${text} ${progress.message}` : text, 'error', 'import-stopped');
}

function failures(progress: Progress) {
  const t = ui.t;
  if (progress.failed.length === 0) return nothing;
  const accidents = state.built?.accidents ?? [];
  return html`<div class="flex flex-col gap-1" id="import-failures">
    <strong class="text-sm">${t('reportFailedTitle')}</strong>
    <ul class="flex flex-col gap-1 text-xs">
      ${progress.failed.slice(0, 20).map((failure) => {
        const accident = accidents[failure.index];
        return html`<li><code>${failure.key ?? accident?.key ?? failure.index}</code> ${failure.message ?? failure.error}</li>`;
      })}
    </ul>
    ${progress.failed.length > 20 ? html`<p class="text-xs opacity-70">${t('moreSkipped', { n: num(progress.failed.length - 20) })}</p>` : nothing}
  </div>`;
}

function csv() {
  const t = ui.t;
  if (state.csvLines === 0) return nothing;
  return html`<div class="flex flex-col gap-2" id="report-csv">
    ${state.csvUrl
      ? html`<a class="d-btn d-btn-soft self-start" id="download-csv" href=${state.csvUrl} download="saobracajke-izvestaj.csv">
          ${icon('download', 'size-4')}${t('downloadCsv')}
        </a>`
      : nothing}
    <details class="text-sm">
      <summary class="cursor-pointer opacity-80">${t('csvFallback')}</summary>
      <textarea class="d-textarea mt-2 h-40 w-full font-mono text-xs" readonly .value=${state.csvText}></textarea>
      ${state.csvLines > csvShown ? html`<p class="text-xs opacity-70">${t('csvCut', { n: num(csvShown) })}</p>` : nothing}
    </details>
  </div>`;
}

export function reportView() {
  const t = ui.t;
  const progress = state.progress;
  if (!progress) return nothing;
  const done = progress.status === 'done';
  const canGoOn = !done && fittingCursor() !== null;

  return card(
    html`${done ? nothing : stopNotice(progress)}
      ${progressBar(progress.next, progress.total)}
      <p class="text-sm">${t('progressOf', { done: num(progress.next), total: num(progress.total) })}</p>
      ${counts(progress, false)}
      <p class="text-sm opacity-80" id="report-skipped">${t('reportSkipped', { n: num(state.built?.summary.skippedRows ?? 0) })}</p>
      ${failures(progress)} ${csv()}
      <div class="flex flex-wrap gap-2">
        ${canGoOn
          ? html`<button type="button" class="d-btn d-btn-primary" id="continue-import" @click=${continueImport}>
              ${icon('play', 'size-4')}${t('continueImport')}
            </button>`
          : nothing}
        <button type="button" class="d-btn ${canGoOn ? '' : 'd-btn-primary'}" id="new-import" @click=${newImport}>
          ${icon('file', 'size-4')}${t('newImport')}
        </button>
      </div>`,
    { title: done ? t('reportDone') : t('reportStopped'), symbol: done ? 'checkCircle' : 'warning', id: 'report' },
  );
}
