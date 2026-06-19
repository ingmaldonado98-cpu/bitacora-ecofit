// doc-exec.js — renderExecPorSitio: bloques de ejecución del checklist en Progreso de obra
// Extraído de documentacion.js. Sin estado propio.
//
// Candado por fase: un bloque de la Fase N solo se puede marcar si TODAS las
// fases anteriores (1..N-1) están completas — en cualquier pestaña de sitio,
// no solo la actual, ya que una fase puede repartirse entre Techo/Centros/Zona.
// Admin puede desbloquear una fase por excepción (queda registrado en
// checklistData.faseOverride y en el historial de cambios del proyecto).

import { esc } from './utils.js';
import { icon } from './icons.js';
import { FASE_LABELS, FASE_DESC } from '../modules/checklist/index.js';

export const EXEC_POR_SITIO = {
  techo:          ['anclaje', 'armazon', 'canal', 'panel-fix', 'cable-dc'],
  centrosCarga:   ['cfe'],
  zonaDelSistema: ['inv-fix', 'prot-dc', 'tierra', 'cable-ac', 'baterias', 'bomba',
                    'etiquetado', 'verificacion', 'puesta-marcha', 'cierre'],
};

// Progreso por fase, calculado sobre TODOS los bloques del proyecto (no solo
// los del sitio actual) — necesario porque una fase cruza varias pestañas.
function _faseStatus(allExecBlocks, cl) {
  const status = {};
  for (const b of allExecBlocks) {
    if (!status[b.fase]) status[b.fase] = { done: 0, total: 0 };
    status[b.fase].total += b.items.length;
    status[b.fase].done  += b.items.filter(it => cl.exec?.[it.id]).length;
  }
  return status;
}

// ¿Está desbloqueada la fase N? — natural (fases previas 100%) u override de admin.
function _faseGate(faseStatus, fase, overrides) {
  if (fase <= 1) return { unlocked: true, overridden: false };
  let natural = true;
  for (let f = 1; f < fase; f++) {
    const s = faseStatus[f];
    if (s && s.done < s.total) { natural = false; break; }
  }
  if (natural) return { unlocked: true, overridden: false };
  if (overrides?.[fase]) return { unlocked: true, overridden: true };
  return { unlocked: false, overridden: false };
}

export function renderExecPorSitio(project, sitio, allExecBlocks, edit, admin) {
  const cl        = project.checklistData || {};
  const overrides = cl.faseOverride || {};
  const faseStatus = _faseStatus(allExecBlocks, cl);
  const blocks     = allExecBlocks.filter(b => EXEC_POR_SITIO[sitio]?.includes(b.id));
  if (!blocks.length) return '';
  const allItems = blocks.flatMap(b => b.items);
  const done     = allItems.filter(it => cl.exec?.[it.id]).length;
  const total    = allItems.length;
  const pct      = total ? Math.round(done / total * 100) : 0;
  const pid      = project.id;

  const _item = (it, forceDisabled) => {
    const dis = !edit || forceDisabled;
    const savedVal = cl.execText?.[it.id] || '';
    if (it.isNav) return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${dis ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span class="cl-item-name">${esc(it.n)}</span>
          <button class="btn-outline btn-sm" style="flex-shrink:0"
            onclick="event.preventDefault();event.stopPropagation();navigate('#${esc(it.navRoute)}/${pid}')">Ir →</button>
        </div>
      </label>`;
    return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${dis ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%">
          <span class="cl-item-name">${esc(it.n)}</span>
          ${it.hasInput ? `<div style="margin-top:6px">
            <input type="text" class="torq-input" style="max-width:180px"
              placeholder="${esc(it.inputPlaceholder||'Valor medido')}" ${dis ? 'disabled' : ''}
              value="${esc(savedVal)}"
              onchange="clSaveExecText('${pid}','${it.id}',this.value)"
              onclick="event.stopPropagation()">
          </div>` : ''}
        </div>
      </label>`;
  };

  return `
  <div class="card exec-section">
    <div class="card-title-row">
      <h3 class="card-title">Ejecución</h3>
      <span class="cl-prog-lbl">${done}/${total}</span>
    </div>
    <div class="cl-prog-bar-wrap">
      <div class="cl-prog-bar${pct===100?' cl-prog-done':''}" style="width:${pct}%"></div>
    </div>
    ${blocks.map(block => {
      const bd   = block.items.filter(it => cl.exec?.[it.id]).length;
      const bt   = block.items.length;
      const ok   = bd === bt;
      const gate = _faseGate(faseStatus, block.fase, overrides);
      return `
      <details class="cl-exec-block ${gate.unlocked ? '' : 'cl-exec-locked'}" ${(ok || !gate.unlocked) ? '' : 'open'}>
        <summary class="cl-exec-block-hdr">
          <span class="cl-exec-fase-badge" title="${esc(FASE_DESC[block.fase] || '')}">${esc(FASE_LABELS[block.fase] || '')}</span>
          <span class="cl-exec-block-title">${esc(block.label)}</span>
          ${!gate.unlocked
            ? `<span class="cl-exec-lock-icon" title="Bloqueado">${icon('lock', 14)}</span>`
            : `<span class="cl-exec-block-badge ${ok ? 'cl-exec-ok' : ''}">${ok ? '✓' : `${bd}/${bt}`}</span>`}
          <span class="cl-exec-caret">▾</span>
        </summary>
        ${!gate.unlocked ? `
        <div class="cl-exec-gate-msg cl-exec-gate-locked">
          ${icon('lock', 14)} Completa primero ${esc(FASE_LABELS[block.fase - 1] || '')} — ${esc(FASE_DESC[block.fase - 1] || '')}.
          ${admin ? `<button class="btn-outline btn-sm" onclick="_clOverrideFase('${pid}',${block.fase},true)">Desbloquear (excepción)</button>` : ''}
        </div>` : gate.overridden ? `
        <div class="cl-exec-gate-msg cl-exec-gate-override">
          ${icon('warning', 14)} Desbloqueada manualmente por excepción.
          ${admin ? `<button class="btn-outline btn-sm" onclick="_clOverrideFase('${pid}',${block.fase},false)">Re-bloquear</button>` : ''}
        </div>` : ''}
        <div class="cl-item-list" style="padding:0 4px 8px">
          ${block.items.map(it => _item(it, !gate.unlocked)).join('')}
        </div>
      </details>`;
    }).join('')}
  </div>`;
}
