// documentacion.js — Módulo 2: Progreso de obra (Antes/Durante/Después)

import { projects } from './db.js';
import { esc, calcFaseEstado, countFotos } from './utils.js';
import { renderFirmaBlock } from './project.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';
import { getExecBlocks } from '../modules/checklist/index.js';
import { renderSitio, _countCierreExtra } from './doc-sitio.js';
import { renderNotasDoc } from './lev-notas.js';
import { EXEC_POR_SITIO, renderExecPorSitio } from './doc-exec.js';

export { renderLevantamientoView } from './lev-form.js';

// ── Vista principal — Progreso de obra ────────────────────────────────────────
export async function renderDocumentacion(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const cl   = project.checklistData || {};
  const techo = project.projectConfig?.techo || cl.techo || 'cemento';

  // Contar fotos por sitio para badges del tab
  const fases = project.documentacion?.fases || {};
  const cTecho   = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'techo',f), 0)
    + _countCierreExtra(project, 'techo');
  const cCentros = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'centrosCarga',f), 0)
    + _countCierreExtra(project, 'centrosCarga');
  const cZona    = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'zonaDelSistema',f), 0)
    + _countCierreExtra(project, 'zonaDelSistema');
  const cNotas   = (project.documentacion?.notas || []).length;

  // Exec blocks por sección
  const allExecBlocks = getExecBlocks(project, techo);
  const _exCount = (sitio) => {
    const items = allExecBlocks.filter(b => EXEC_POR_SITIO[sitio]?.includes(b.id)).flatMap(b => b.items);
    return { done: items.filter(it => cl.exec?.[it.id]).length, total: items.length };
  };
  const exT = _exCount('techo');
  const exC = _exCount('centrosCarga');
  const exZ = _exCount('zonaDelSistema');

  const _badge = (fotos, ex) => {
    if (!fotos && !ex.total) return '';
    if (fotos > 0 && ex.total > 0 && ex.done === ex.total) return `<span class="tab-badge tab-ok">✓</span>`;
    const parts = [];
    if (fotos)    parts.push(`${fotos}📷`);
    if (ex.total) parts.push(`${ex.done}/${ex.total}`);
    return `<span class="tab-badge">${parts.join(' · ')}</span>`;
  };

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Progreso de obra</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <div class="tab-bar" id="doc-tabs" role="tablist" aria-label="Secciones de progreso de obra">
    <button class="tab-btn tab-active" role="tab" aria-selected="true"  aria-controls="d-techo"   tabindex="0"  data-tab="d-techo"   onclick="switchTab('doc-tabs','d-techo',this)">
      🏠 Techo${_badge(cTecho, exT)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-centros" tabindex="-1" data-tab="d-centros" onclick="switchTab('doc-tabs','d-centros',this)">
      ⚡ Centros${_badge(cCentros, exC)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-zona"    tabindex="-1" data-tab="d-zona"    onclick="switchTab('doc-tabs','d-zona',this)">
      🔌 Zona${_badge(cZona, exZ)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-notas"   tabindex="-1" data-tab="d-notas"   onclick="switchTab('doc-tabs','d-notas',this)">
      ${icon('note', 14)} Notas${cNotas ? `<span class="tab-badge tab-ok">${cNotas}</span>` : ''}
    </button>
  </div>

  <!-- Techo -->
  <div id="d-techo" class="tab-panel tab-panel-active">
    ${renderSitio(project, 'techo', edit, projectId)}
    ${renderExecPorSitio(project, 'techo', allExecBlocks, edit)}
  </div>

  <!-- Centros de carga -->
  <div id="d-centros" class="tab-panel">
    ${renderSitio(project, 'centrosCarga', edit, projectId)}
    ${renderExecPorSitio(project, 'centrosCarga', allExecBlocks, edit)}
  </div>

  <!-- Zona del sistema -->
  <div id="d-zona" class="tab-panel">
    ${renderSitio(project, 'zonaDelSistema', edit, projectId)}
    ${renderExecPorSitio(project, 'zonaDelSistema', allExecBlocks, edit)}
  </div>

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
      const tabTarget   = sessionStorage.getItem('doc-tab-target');
      const subfaTarget = sessionStorage.getItem('doc-subfa-target');
      sessionStorage.removeItem('doc-tab-target');
      sessionStorage.removeItem('doc-subfa-target');
      sessionStorage.removeItem('doc-sitio-target');
      if (tabTarget) {
        const tabBtn = document.querySelector('[data-tab="' + tabTarget + '"]');
        if (tabBtn) tabBtn.click();
      }
      if (subfaTarget && tabTarget) {
        const sitioMap = { 'd-techo':'techo', 'd-centros':'centrosCarga', 'd-zona':'zonaDelSistema' };
        const sitio = sitioMap[tabTarget] || 'techo';
        setTimeout(() => {
          const btn = document.getElementById('sf-btn-' + sitio + '-' + subfaTarget);
          if (btn) btn.click();
        }, 50);
      }
    })();
  </script>
  `;
}

// ── Verificación de cierre — renderSitio y handlers viven en doc-sitio.js ─────

// ── Exec toggle — disponibles aquí para cuando Progreso de obra se carga sin checklist.js
{
  let _docExecTextTimer = null;
  window.clToggleExec   = (pid, id, v)   => projects.setField(pid, `checklistData.exec.${id}`, v);
  window.clSaveExecText = (pid, id, val) => {
    clearTimeout(_docExecTextTimer);
    _docExecTextTimer = setTimeout(() => projects.setField(pid, `checklistData.execText.${id}`, val), 600);
  };
}
