// garantia.js — Módulo 1: Garantía (vista principal, vencimientos, notas)
// Secciones extraídas: gar-voc.js, gar-equipos.js, gar-estructura.js, gar-paneles.js

import { projects, kv } from './db.js';
import { esc, fmtFechaHora, toast, calcFaseEstado, uuid, isoNow, confirmDialog } from './utils.js';
import { canEdit, isAdmin, getSession } from './auth.js';
import { icon } from './icons.js';
import { renderFirmaBlock } from './project.js';
import { renderVocTab, vocEstaDesactualizado } from './gar-voc.js';
import { renderEquipos, formEquipo, _clearEqFotos, renderEquiposSugeridos } from './gar-equipos.js';
import { renderEstructura } from './gar-estructura.js';
import { renderPaneles } from './gar-paneles.js';
import './pdf-garantia.js'; // registra window.exportarCertificadoGarantia

// Re-exportar calcVocPuro para que lev-guardar.js no necesite cambiar su import
export { calcVocPuro } from './gar-voc.js';

// Re-exportar renderEstructuraForm para app.js (sub-ruta #proyecto/*/garantia/estructura)
export { renderEstructuraForm } from './gar-estructura.js';

// ── Vista principal del módulo ─────────────────────────────────────────────────
export async function renderGarantia(projectId, session) {
  const [project, customPanels] = await Promise.all([
    projects.getById(projectId),
    kv.get('panel_presets_custom').catch(() => []),
  ]);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const g = project.garantia || {};
  _clearEqFotos(); // limpiar fotos temporales de sesiones anteriores

  // ── Detectar fuente de pre-llenado para la sección Paneles ───────────────────
  const panelYaCapturado = !!(g.paneles?.marca && g.paneles?.wp);
  const panelCalcConfig  = project.projectConfig?.panel;
  let fuenteCalcPanel    = null;
  if (!panelYaCapturado && panelCalcConfig?.presetId && (customPanels||[]).length > 0) {
    const found = customPanels.find(p => p.id === panelCalcConfig.presetId);
    if (found) fuenteCalcPanel = found;
  }

  const esAmpliacion = project.tipoSistema === 'ampliacion';
  const tabDefault   = esAmpliacion ? 'g-estructura' : 'g-equipos';

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Garantía</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
    <button class="btn-outline btn-sm" onclick="exportarCertificadoGarantia('${projectId}')" title="Descargar certificado de garantía (Word)">
      ${icon('file-arrow-down', 15)} Certificado
    </button>
  </div>

  <!-- Puesta en marcha + vencimientos -->
  ${renderVencimientos(g, projectId, edit)}

  <div class="tab-bar" id="garantia-tabs" role="tablist" aria-label="Secciones de garantía">
    ${!esAmpliacion ? `
    <button class="tab-btn ${tabDefault==='g-equipos'?'tab-active':''}" role="tab" aria-selected="${tabDefault==='g-equipos'}" aria-controls="g-equipos" tabindex="${tabDefault==='g-equipos'?'0':'-1'}" data-tab="g-equipos" onclick="switchTab('garantia-tabs','g-equipos',this)">Equipos</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-voc" tabindex="-1" data-tab="g-voc" onclick="switchTab('garantia-tabs','g-voc',this)">
      Voc${(() => { const v = project.garantia?.validacionVoc; return v ? `<span class="tab-badge ${v.resultado==='seguro'?'tab-ok':v.resultado==='excede'?'tab-err':''}">${v.resultado==='seguro'?'✓':v.resultado==='excede'?'⚠':'~'}</span>` : ''; })()}
    </button>` : ''}
    <button class="tab-btn ${tabDefault==='g-estructura'?'tab-active':''}" role="tab" aria-selected="${tabDefault==='g-estructura'}" aria-controls="g-estructura" tabindex="${tabDefault==='g-estructura'?'0':'-1'}" data-tab="g-estructura" onclick="switchTab('garantia-tabs','g-estructura',this)">Estructura</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-paneles"   tabindex="-1" data-tab="g-paneles"   onclick="switchTab('garantia-tabs','g-paneles',this)">Paneles</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-notas"     tabindex="-1" data-tab="g-notas"     onclick="switchTab('garantia-tabs','g-notas',this)">
      Notas${(g.notas||[]).length ? `<span class="tab-badge tab-ok">${(g.notas||[]).length}</span>` : ''}
    </button>
  </div>

  <!-- Equipos — solo para tipos con equipos nuevos -->
  <div id="g-equipos" class="tab-panel ${tabDefault==='g-equipos'?'tab-panel-active':''}" ${esAmpliacion?'hidden':''}>
    <div class="card-title-row" style="padding:0 0 12px">
      <h3 class="card-title">Equipos instalados (${(g.equipos||[]).length})</h3>
      ${edit ? `<button class="btn-primary btn-sm" onclick="showFormEquipo('${projectId}')">+ Equipo</button>` : ''}
    </div>
    ${renderEquiposSugeridos(project, projectId, edit)}
    <div id="lista-equipos">
      ${renderEquipos(g.equipos || [], projectId, edit, isAdmin(session))}
    </div>
    ${renderKitPendientes(project.checklistData?.kitEquipo || {}, projectId, edit)}
    <div id="form-equipo" style="display:none" class="card">
      ${formEquipo(projectId)}
    </div>
  </div>

  <!-- Validación Voc — solo para tipos con inversor de red -->
  <div id="g-voc" class="tab-panel" ${esAmpliacion?'hidden':''}>
    ${esAmpliacion ? '' : renderVocTab(project, projectId, edit)}
  </div>

  <!-- Estructura -->
  <div id="g-estructura" class="tab-panel ${tabDefault==='g-estructura'?'tab-panel-active':''}">
    <div class="card">
      <h3 class="card-title">Estructura de montaje</h3>
      ${renderEstructura(g.estructura, projectId, edit, project.projectConfig)}
    </div>
  </div>

  <!-- 1E: Paneles -->
  <div id="g-paneles" class="tab-panel">
    ${renderPaneles(g.paneles || { marca:'', modelo:'', wp:0, strings:[] }, projectId, edit, customPanels || [], fuenteCalcPanel, isAdmin(session))}
  </div>

  <!-- Notas de garantía -->
  <div id="g-notas" class="tab-panel">
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Notas de garantía</h3>
        ${edit ? `<button class="btn-sm btn-outline" onclick="_showNotaGarantia('${projectId}')">+ Nota</button>` : ''}
      </div>
      <div id="gnotas-list">
        ${renderNotas(g.notas || [], session, 'garantia', projectId)}
      </div>
      <div id="gnotas-form" style="display:none" class="nota-form">
        <textarea id="gnotas-texto" rows="3" placeholder="Escribe tu nota…" class="textarea-field"></textarea>
        <div class="nota-form-actions">
          <button class="btn-outline btn-sm" onclick="document.getElementById('gnotas-form').style.display='none'">Cancelar</button>
          <button class="btn-primary btn-sm" onclick="_submitNotaGarantia('${projectId}')">Guardar nota</button>
        </div>
      </div>
    </div>
  </div>
  ${(() => {
    const fe = calcFaseEstado(project);
    const vocStale = vocEstaDesactualizado(project);
    const faltantes = [...fe.garFaltantes, ...(vocStale ? ['Voc recalculado (los datos cambiaron)'] : [])];
    return renderFirmaBlock(project, projectId, 'gar', session, {
      ready: fe.garPct === 100 && !vocStale,
      hint:  `Faltan: ${faltantes.join(', ')}`,
    });
  })()}

  <script>
    (function() {
      const target = sessionStorage.getItem('garantia-tab-target');
      if (target) {
        sessionStorage.removeItem('garantia-tab-target');
        const bar = document.getElementById('garantia-tabs');
        const btn = bar?.querySelector('[data-tab="' + target + '"]');
        if (btn) btn.click();
      }
      // Si viene del Kit de obra (Checklist), abre el form de equipo pre-llenado
      const kitPrefillRaw = sessionStorage.getItem('garantia-kit-prefill');
      if (kitPrefillRaw) {
        sessionStorage.removeItem('garantia-kit-prefill');
        try {
          const { kitId, nombre } = JSON.parse(kitPrefillRaw);
          setTimeout(() => {
            if (typeof showFormEquipoFromKit === 'function') showFormEquipoFromKit('${projectId}', kitId, nombre);
          }, 150);
        } catch (_) {}
      }
      // Auto-calcular Voc si hay datos pre-cargados
      setTimeout(() => { if (typeof calcVoc === 'function') calcVoc(); }, 50);
    })();
  </script>
  `;
}

// ── Tarjetas de Kit pendientes (sin serial registrado en Garantía) ───────────
function renderKitPendientes(kitEquipo, projectId, edit) {
  if (!edit) return '';
  const pendientes = Object.entries(kitEquipo).filter(([, it]) => !it?.garantiaEquipoId);
  if (!pendientes.length) return '';
  return `
  <div class="kit-pendientes">
    <p class="form-hint">Equipos del Kit de obra sin serial registrado:</p>
    ${pendientes.map(([kid, it]) => `
      <div class="kit-pend-card" data-kit-id="${esc(kid)}" data-kit-nombre="${esc(it.nombre || '')}"
           onclick="showFormEquipoFromKit('${projectId}',this.dataset.kitId,this.dataset.kitNombre)">
        <span>⚠️ Pendiente de serial</span>
        <span class="kit-pend-nombre">${esc(it.nombre || 'Sin nombre')}</span>
      </div>`).join('')}
  </div>`;
}

// ── Puesta en marcha + vencimientos de garantía ───────────────────────────────
export const GARANTIAS_STD = [
  { key: 'paneles',    label: 'Paneles — producto',    anios: 10 },
  { key: 'paneles25',  label: 'Paneles — desempeño',   anios: 25 },
  { key: 'inversor',   label: 'Inversor',              anios: 10 },
  { key: 'estructura', label: 'Estructura',            anios: 10 },
  { key: 'manoObra',   label: 'Mano de obra',          anios:  1 },
];

function renderVencimientos(g, projectId, edit) {
  const fi = g.fechaInstalacion || '';

  const chips = fi ? GARANTIAS_STD.map(gar => {
    const base   = new Date(fi);
    const vence  = new Date(base);
    vence.setFullYear(vence.getFullYear() + gar.anios);
    const hoy    = new Date();
    const diasLeft = Math.ceil((vence - hoy) / 86400000);
    const pct    = Math.max(0, Math.min(100, ((gar.anios * 365 - diasLeft) / (gar.anios * 365)) * 100));
    const cls    = diasLeft < 0 ? 'venc-vencida' : diasLeft < 180 ? 'venc-proxima' : 'venc-vigente';
    const badge  = diasLeft < 0 ? '✗ Vencida' : diasLeft < 180 ? `⚠ ${diasLeft}d` : '✓ Vigente';
    const fechaStr = vence.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
    return `
    <div class="venc-item ${cls}">
      <div class="venc-barra-wrap"><div class="venc-barra" style="width:${pct.toFixed(0)}%"></div></div>
      <span class="venc-label">${esc(gar.label)}</span>
      <span class="venc-fecha">${fechaStr}</span>
      <span class="venc-badge">${badge}</span>
    </div>`;
  }).join('') : '';

  return `
  <div class="card" style="margin-bottom:8px">
    <div class="card-title-row">
      <h3 class="card-title">${icon('calendar-check', 15)} Puesta en marcha</h3>
    </div>
    <div class="form-row" style="align-items:flex-end;gap:10px">
      <div class="form-group" style="flex:1;margin:0">
        <label style="font-size:.78rem">Fecha de instalación / comisionamiento</label>
        <input type="date" id="gar-fecha-instalacion" value="${esc(fi)}"
               ${!edit ? 'disabled' : ''}
               style="max-width:180px"
               onchange="guardarFechaInstalacion('${projectId}',this.value)" />
      </div>
      ${fi ? `<span style="font-size:.75rem;color:var(--text-muted);padding-bottom:6px">
        ${Math.floor((new Date() - new Date(fi)) / (365.25 * 86400000))} año(s) en servicio
      </span>` : ''}
    </div>
    ${chips ? `<div class="venc-lista" style="margin-top:10px">${chips}</div>` : `
    <p style="font-size:.78rem;color:var(--text-muted);margin-top:6px">
      ${icon('info', 13)} Ingresa la fecha para ver el estado de las garantías.
    </p>`}
  </div>`;
}

window.guardarFechaInstalacion = async function(projectId, fecha) {
  if (!fecha) return;
  await projects.setField(projectId, 'garantia.fechaInstalacion', fecha);
  toast('✅ Fecha guardada');
  sessionStorage.setItem('garantia-scroll-top', '1');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Notas de garantía ──────────────────────────────────────────────────────────
function renderNotas(notas, session, scope, projectId) {
  if (!notas.length) return '<p class="empty-msg-sm">Sin notas aún.</p>';
  return notas.map((n, i) => `
    <div class="nota-item">
      <div class="nota-header">
        <span class="nota-autor">${esc(n.autorNombre || '—')}</span>
        <span class="nota-fecha">${fmtFechaHora(n.createdAt)}</span>
        ${isAdmin(session) || session?.id === n.autorId
          ? `<button class="btn-del-sm" onclick="_delNota('${projectId}','${scope}',${i})">✕</button>` : ''}
      </div>
      <p class="nota-texto">${esc(n.texto)}</p>
    </div>
  `).join('');
}

window._showNotaGarantia = function(projectId) {
  document.getElementById('gnotas-form').style.display = 'block';
  document.getElementById('gnotas-texto').focus();
};

window._submitNotaGarantia = async function(projectId) {
  const texto = document.getElementById('gnotas-texto').value.trim();
  if (!texto) { toast('Escribe una nota','error'); return; }
  const session = await getSession();
  const p = await projects.getById(projectId);
  const nota = { id: uuid(), texto, autorId: session?.id, autorNombre: session?.nombre || session?.username, createdAt: isoNow() };
  p.garantia.notas = [...(p.garantia.notas || []), nota];
  await projects.update(projectId, { garantia: p.garantia });
  document.getElementById('gnotas-list').innerHTML = renderNotas(p.garantia.notas, session, 'garantia', projectId);
  document.getElementById('gnotas-form').style.display = 'none';
  document.getElementById('gnotas-texto').value = '';
  // Actualizar badge del tab
  const tabBtn = document.querySelector('[data-tab="g-notas"]');
  if (tabBtn) tabBtn.innerHTML = `Notas<span class="tab-badge tab-ok">${p.garantia.notas.length}</span>`;
  toast('✅ Nota guardada');
};

window._delNota = async function(projectId, scope, idx) {
  if (!await confirmDialog('¿Eliminar esta nota?')) return;
  const session = await getSession();
  const p = await projects.getById(projectId);
  if (scope === 'garantia') {
    p.garantia.notas = (p.garantia.notas || []).filter((_,i) => i !== idx);
    await projects.update(projectId, { garantia: p.garantia });
    document.getElementById('gnotas-list').innerHTML = renderNotas(p.garantia.notas, session, 'garantia', projectId);
    const tabBtn = document.querySelector('[data-tab="g-notas"]');
    if (tabBtn) tabBtn.innerHTML = p.garantia.notas.length
      ? `Notas<span class="tab-badge tab-ok">${p.garantia.notas.length}</span>` : 'Notas';
  }
  toast('Nota eliminada');
};
