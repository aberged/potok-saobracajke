// Pieces every screen uses, drawn with daisyUI (prefix `d-`) in the colours
// of the page's theme.

import { html, nothing, type TemplateResult } from 'lit-html';
import { translator, type Translate } from '../i18n';
import { icon, type IconName } from './icons';

export const ui: { t: Translate } = { t: translator('sr') };

export function setUi(lang: string) {
  ui.t = translator(lang);
}

export const num = (n: number, digits = 0) => ui.t.number(n, digits);

export type NoticeKind = 'info' | 'warning' | 'error' | 'success';

const NOTICE_CLASS: Record<NoticeKind, string> = {
  info: 'd-alert d-alert-info d-alert-soft',
  warning: 'd-alert d-alert-warning d-alert-soft',
  error: 'd-alert d-alert-error d-alert-soft',
  success: 'd-alert d-alert-success d-alert-soft',
};

const NOTICE_ICON: Record<NoticeKind, IconName> = { info: 'info', warning: 'warning', error: 'error', success: 'checkCircle' };

export function notice(text: string | TemplateResult, kind: NoticeKind = 'info', id?: string) {
  return html`<div role=${kind === 'error' ? 'alert' : 'status'} class=${NOTICE_CLASS[kind]} id=${id ?? nothing}>
    ${icon(NOTICE_ICON[kind], 'size-5 shrink-0')}<span>${text}</span>
  </div>`;
}

export function card(content: unknown, options: { id?: string; title?: string; symbol?: IconName } = {}) {
  return html`<section class="d-card d-card-border ps-card" id=${options.id ?? nothing}>
    <div class="d-card-body gap-3">
      ${options.title
        ? html`<h2 class="d-card-title text-base">
            ${options.symbol ? html`<span class="ps-tile ps-tile-small" aria-hidden="true">${icon(options.symbol, 'size-4')}</span>` : nothing}${options.title}
          </h2>`
        : nothing}
      ${content}
    </div>
  </section>`;
}

export function stat(label: string, value: string, options: { id?: string; hint?: string; color?: string } = {}) {
  return html`<div class="d-stat" id=${options.id ?? nothing}>
    <div class="d-stat-title flex items-center gap-1.5">
      ${options.color ? html`<span class="ps-dot" style="background:${options.color}" aria-hidden="true"></span>` : nothing}${label}
    </div>
    <div class="d-stat-value text-2xl">${value}</div>
    ${options.hint ? html`<div class="d-stat-desc">${options.hint}</div>` : nothing}
  </div>`;
}

export function progressBar(done: number, total: number, id?: string) {
  const percent = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return html`<progress class="d-progress d-progress-primary h-3 w-full" id=${id ?? nothing} value=${percent.toFixed(1)} max="100"></progress>`;
}

/** Seconds as "1 h 5 min", "12 min" or "under a minute". */
export function duration(seconds: number | null): string {
  const t = ui.t;
  if (seconds === null || !Number.isFinite(seconds)) return t('empty');
  if (seconds < 60) return t('etaSeconds');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('etaMinutes', { m: minutes });
  return t('etaHours', { h: Math.floor(minutes / 60), m: minutes % 60 });
}
