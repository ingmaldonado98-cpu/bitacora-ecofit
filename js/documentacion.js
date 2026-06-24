// documentacion.js — Módulo 2: Progreso de obra
// Navega por los 3 bloques del checklist de instalación (no por sitio físico) —
// ver doc-exec.js para el porqué.

import { projects, logChange } from './db.js';
import { esc, calcFaseEstado } from './utils.js';
import { renderFirmaBlock } from './project.js';
import { canEdit, isAdmin, getSession } from './auth.js';
import { icon } from './icons.js';
import { getExecBlocks, BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';
import { renderSitio } from './doc-sitio.js';
import { renderNotasDoc } from './lev-notas.js';
import { renderExecPorBloque, computeBloqueStatus, toggleExecItem, SITIO_BLOQUE_PRIMARIA, renderReferenciaIngenieria } from './doc-exec.js';
import './pdf-avance.js'; // registra window.exportarAvanceObra

export { renderLevantamientoView } from './lev-form.js';

// Sitio(s) cuya galería de fotos se muestra en cada bloque — inverso de SITIO_BLOQUE_PRIMARIA.
const _SITIOS_POR_BLOQUE = Object.entries(SITIO_BLOQUE_PRIMARIA).reduce((acc, [sitio, bloque]) => {
  (acc[bloque] = acc[bloque] || []).push(sitio);
  return acc;
}, {});

const SITIO_LABEL = { techo: '📷 Cierre del sistema', centrosCarga: '⚡ Centros de carga', zonaDelSistema: '🔌 Zona del sistema' };

// ── Vista principal — Progreso de obra ────────────────────────────────────────
export async function renderDocumentacion(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit  = canEdit(session, project);
  const admin = isAdmin(session);
  const cl    = project.checklistData || {};
  const techo = project.projectConfig?.techo || cl.techo || 'cemento';

  const allExecBlocks = getExecBlocks(project, techo);
  const bloqueStatus   = computeBloqueStatus(allExecBlocks, cl);
  const cNotas        = (project.documentacion?.notas || []).length;

  const _badge = (bloque) => {
    const s = bloqueStatus[bloque];
    if (!s || !s.total) return '';
    if (s.done === s.total) return `<span class="tab-badge tab-ok">✓</span>`;
    if (s.done === 0) return '';
    return `<span class="tab-badge">${s.done}/${s.total}</span>`;
  };

  const BLOQUES = [1, 2, 3];

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Progreso de obra</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
    <button class="btn-outline btn-sm" onclick="exportarAvanceObra('${projectId}')" title="Descargar reporte de avance (Word)">
      ${icon('file-arrow-down', 15)} Avance
    </button>
  </div>

  <div class="tab-bar" id="doc-tabs" role="tablist" aria-label="Bloques de progreso de obra">
    ${BLOQUES.map((b, i) => `
    <button class="tab-btn ${i===0?'tab-active':''}" role="tab" aria-selected="${i===0}" aria-controls="d-bloque${b}" tabindex="${i===0?'0':'-1'}"
            data-tab="d-bloque${b}" onclick="switchTab('doc-tabs','d-bloque${b}',this)" title="${esc(BLOQUE_DESC[b])}">
      ${esc(BLOQUE_LABELS[b])}${_badge(b)}
    </button>`).join('')}
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-notas" tabindex="-1" data-tab="d-notas" onclick="switchTab('doc-tabs','d-notas',this)">
      ${icon('note', 14)} Notas${cNotas ? `<span class="tab-badge tab-ok">${cNotas}</span>` : ''}
    </button>
  </div>

  ${BLOQUES.map((b, i) => `
  <div id="d-bloque${b}" class="tab-panel ${i===0?'tab-panel-active':''}">
    <p class="form-hint" style="margin:0 0 10px">${esc(BLOQUE_DESC[b])}</p>
    ${renderReferenciaIngenieria(project, b)}
    ${b === 2 ? `
      <details class="cl-exec-block" open>
        <summary class="cl-exec-block-hdr"><span class="cl-exec-block-title">⚡ Equipos (Cuarto de máquinas)</span><span class="cl-exec-caret">▾</span></summary>
        <div style="padding:0 4px 8px">${renderSitio(project, 'centrosCarga', edit, projectId, 2)}</div>
      </details>` : ''}
    ${(_SITIOS_POR_BLOQUE[b] || []).map(sitio => `
      <details class="cl-exec-block" open>
        <summary class="cl-exec-block-hdr"><span class="cl-exec-block-title">${SITIO_LABEL[sitio] || sitio}</span><span class="cl-exec-caret">▾</span></summary>
        <div style="padding:0 4px 8px">${renderSitio(project, sitio, edit, projectId, b)}</div>
      </details>
    `).join('')}
    ${renderExecPorBloque(project, b, allExecBlocks, edit, admin)}
  </div>`).join('')}

  <!-- Notas -->
  <div id="d-notas" class="tab-panel">
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Notas de progreso</h3>
        ${edit ? `<button class="btn-sm btn-outline" onclick="_showNotaDoc('${projectId}')">+ Nota</button>` : ''}
      </div>
      <div id="dnotas-list">
        ${renderNotasDoc(project.documentacion?.notas || [], session, projectId)}
      </div>
      <div id="dnotas-form" style="display:none" class="nota-form">
        <textarea id="dnotas-texto" rows="3" placeholder="Escribe tu nota…" class="textarea-field"></textarea>
        <div class="nota-form-actions">
          <button class="btn-outline btn-sm" onclick="document.getElementById('dnotas-form').style.display='none'">Cancelar</button>
          <button class="btn-primary btn-sm" onclick="_submitNotaDoc('${projectId}')">Guardar nota</button>
        </div>
      </div>
    </div>
  </div>
  ${(() => {
    const fe = calcFaseEstado(project);
    return renderFirmaBlock(project, projectId, 'doc', session, {
      ready: fe.docPct === 100,
      hint:  `Faltan: ${fe.docFaltantes.join(', ')}`,
    });
  })()}

  <script>
    (function() {
      const tabTarget = sessionStorage.getItem('doc-tab-target');
      sessionStorage.removeItem('doc-tab-target');
      sessionStorage.removeItem('doc-sitio-target');
      if (tabTarget) {
        const tabBtn = document.querySelector('[data-tab="' + tabTarget + '"]');
        if (tabBtn) tabBtn.click();
      }
    })();
  </script>
  `;
}

// ── Verificación de cierre — renderSitio y handlers viven en doc-sitio.js ─────

// ── Exec toggle — disponibles aquí para cuando Progreso de obra se carga sin checklist.js
{
  let _docExecTextTimer = null;
  window.clToggleExec   = async (pid, id, v) => {
    const bloque = await toggleExecItem(pid, id, v);
    if (bloque == null) return;
    const wrap = document.getElementById(`cl-bloque-hitos-${bloque}`);
    if (!wrap) return;
    const p  = await projects.getById(pid);
    const ft = p.checklistData?.bloqueFechas?.[bloque];
    if (ft?.inicio) {
      const fmt = iso => new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
      const partes = [`Iniciado ${fmt(ft.inicio)}`];
      if (ft.cierre) partes.push(`Cerrado ${fmt(ft.cierre)}${ft.cerradoPor ? ` por ${ft.cerradoPor}` : ''}`);
      wrap.innerHTML = `<p class="cl-bloque-hitos">${partes.join(' · ')}</p>`;
    }
  };
  window.clSaveExecText = (pid, id, val) => {
    clearTimeout(_docExecTextTimer);
    _docExecTextTimer = setTimeout(() => projects.setField(pid, `checklistData.execText.${id}`, val), 600);
  };
}

// ── Candado por bloque: override de admin (excepción registrada en el historial) ─
window._clOverrideBloque = async function(pid, bloque, on) {
  await projects.setField(pid, `checklistData.bloqueOverride.${bloque}`, on || null);
  const session = await getSession();
  logChange(pid, {
    modulo: 'Checklist',
    accion: on ? `Bloque ${bloque} desbloqueado manualmente (excepción)` : `Bloque ${bloque} re-bloqueado`,
    detalle: '',
    quien: session,
  });
  navigate(window.location.hash);
};
