// ui-states.js — Helpers reusables de estados de interfaz (empty state, skeleton).
// Antes cada vista repetía su propio string HTML de empty-state; esto centraliza
// la estructura ya existente en CSS (.empty-state / .sk-block / .sk-card / .sk-row)
// para que cualquier vista nueva o sin estos estados los obtenga gratis.

import { esc } from './utils.js';

// ── Empty state con CTA opcional ──────────────────────────────────────────────
// role="status" para que un lector de pantalla anuncie el estado vacío sin que
// el usuario tenga que buscarlo.
export function emptyState({ icon = '📭', msg = 'Sin datos todavía.', ctaLabel, ctaOnclick } = {}) {
  return `
  <div class="empty-state" role="status">
    <div class="empty-state-icon" aria-hidden="true">${icon}</div>
    <p class="empty-state-msg">${esc(msg)}</p>
    ${ctaLabel && ctaOnclick ? `<button type="button" class="empty-state-cta" onclick="${ctaOnclick}">${esc(ctaLabel)}</button>` : ''}
  </div>`;
}

// ── Skeleton genérico — header + N tarjetas con shimmer ───────────────────────
// Mismo patrón visual que skeletonDashboard/skeletonProject (app.js), pero
// genérico para cualquier vista que solo necesite "encabezado + N cards".
export function skeletonBlock(rows = 3) {
  return `
  <div class="sk-header">
    <div class="sk-block" style="width:32px;height:32px;border-radius:50%"></div>
    <div class="sk-block" style="width:140px;height:18px"></div>
  </div>
  ${Array.from({ length: rows }).map(() => `
  <div class="sk-card">
    <div class="sk-row" style="margin-bottom:10px">
      <div class="sk-block" style="width:50%;height:14px"></div>
    </div>
    <div class="sk-block" style="width:90%;height:10px;margin-bottom:6px"></div>
    <div class="sk-block" style="width:70%;height:10px"></div>
  </div>`).join('')}`;
}
