// doc-exec.js — renderExecPorSitio: bloques de ejecución del checklist en Progreso de obra
// Extraído de documentacion.js. Sin estado propio.

import { esc } from './utils.js';
import { icon } from './icons.js';
import { FASE_LABELS, FASE_DESC } from '../modules/checklist/index.js';

export const EXEC_POR_SITIO = {
  techo:          ['anclaje', 'armazon', 'canal', 'panel-fix', 'cable-dc'],
  centrosCarga:   ['cfe'],
  zonaDelSistema: ['inv-fix', 'prot-dc', 'tierra', 'cable-ac', 'baterias', 'bomba',
                    'etiquetado', 'verificacion', 'puesta-marcha', 'cierre'],
};

export function renderExecPorSitio(project, sitio, allExecBlocks, edit) {
  const cl     = project.checklistData || {};
  const blocks = allExecBlocks.filter(b => EXEC_POR_SITIO[sitio]?.includes(b.id));
  if (!blocks.length) return '';
  const allItems = blocks.flatMap(b => b.items);
  const done     = allItems.filter(it => cl.exec?.[it.id]).length;
  const total    = allItems.length;
  const pct      = total ? Math.round(done / total * 100) : 0;
  const pid      = project.id;

  const _item = (it) => {
    const savedVal = cl.execText?.[it.id] || '';
    if (it.isNav) return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span class="cl-item-name">${esc(it.n)}</span>
          <button class="btn-outline btn-sm" style="flex-shrink:0"
            onclick="event.preventDefault();event.stopPropagation();navigate('#${esc(it.navRoute)}/${pid}')">Ir →</button>
        </div>
      </label>`;
    return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%">
          <span class="cl-item-name">${esc(it.n)}</span>
          ${it.hasInput ? `<div style="margin-top:6px">
            <input type="text" class="torq-input" style="max-width:180px"
              placeholder="${esc(it.inputPlaceholder||'Valor medido')}" ${!edit ? 'disabled' : ''}
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
      const bd = block.items.filter(it => cl.exec?.[it.id]).length;
      const bt = block.items.length;
      const ok = bd === bt;
      return `
      <details class="cl-exec-block" ${ok ? '' : 'open'}>
        <summary class="cl-exec-block-hdr">
          <span class="cl-exec-fase-badge" title="${esc(FASE_DESC[block.fase] || '')}">${esc(FASE_LABELS[block.fase] || '')}</span>
          <span class="cl-exec-block-title">${esc(block.label)}</span>
          <span class="cl-exec-block-badge ${ok ? 'cl-exec-ok' : ''}">${ok ? '✓' : `${bd}/${bt}`}</span>
          <span class="cl-exec-caret">▾</span>
        </summary>
        <div class="cl-item-list" style="padding:0 4px 8px">
          ${block.items.map(_item).join('')}
        </div>
      </details>`;
    }).join('')}
  </div>`;
}
