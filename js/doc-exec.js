// doc-exec.js — renderExecPorBloque: bloques de ejecución del checklist en Progreso de obra
// Extraído de documentacion.js. Sin estado propio.
//
// Candado por bloque: un paso del Bloque N solo se puede marcar si TODOS los
// bloques anteriores (1..N-1) están REALMENTE completos — checklist al 100% Y
// evidencias obligatorias de "fotosCierre" satisfechas (foto o justificación).
// Admin puede desbloquear un bloque por excepción (queda registrado en
// checklistData.bloqueOverride y en el historial de cambios del proyecto).
//
// "Cierre por Hito Desbloqueable": mientras el técnico trabaja un paso, solo
// ve checkboxes — sin botones de cámara estorbando. Al marcar el último ítem
// del paso se revela la sección de evidencias (tarjetas de cámara nombradas).
// Esa revelación es solo ergonomía de campo (bd===bt); para que el paso cuente
// como REALMENTE completo (borde verde, desbloquea el siguiente bloque, ✓ en
// el reporte) además se exige que los slots `obligatoria:true` tengan foto o
// justificación — ver _pasoCompleto().
//
// "Progreso de obra" navega por los 3 bloques del checklist (no por sitio
// físico) — cada paso ya trae su `bloque` (1-3) desde modules/checklist/index.js.
// Las fotos (antes/durante/cierre) sí siguen viviendo por sitio —
// SITIO_BLOQUE_PRIMARIA asigna cada sitio al bloque donde se muestra su
// galería, para no duplicar el mismo widget de fotos en varias pestañas.

import { esc, isoNow, fotoMini, capturePhoto, toast, uuid, inputDialog } from './utils.js';
import { icon } from './icons.js';
import { BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';
import { calcVocEsperadoString } from './gar-voc.js';
import { getRowsData, getPanelWidth, railCutForRow, buildTorqueTable } from '../modules/calculadora/index.js';
import { renderTrayectoriasResumen } from './trayectorias.js';

// ── Tarjeta de referencia de ingeniería ──────────────────────────────────────
// Inyecta datos que ya calcula la Calculadora (mismas funciones puras que usa
// gar-estructura.js::importarHerrajes — solo se reutiliza el cálculo, esta
// tarjeta es de solo lectura y no muta ningún formulario) directamente en el
// flujo de Progreso de obra, para no obligar al técnico a ir a buscarlos a
// Garantía → Estructura. Bloque 1: estructura/riel/clamps/torque + trayectoria
// FV ya documentada. Bloque 2: solo trayectoria de canalización central — no
// existe ningún cálculo de "canalización central" en la Calculadora hoy.
export function renderReferenciaIngenieria(project, bloque) {
  const cfg = project.projectConfig;

  if (bloque === 1) {
    if (!cfg) return '';
    const marca = cfg.estructura === 'k2' ? 'K2 Systems' : cfg.estructura === 'aluminex' ? 'Aluminex' : cfg.estructura || '—';
    const pW = getPanelWidth(cfg) || 1.134;
    const rowsData = getRowsData(cfg);
    const metrosRiel = rowsData.reduce((s, c) => s + 2 * railCutForRow(c, pW, cfg.estructura), 0);
    const bom = cfg.computed?.bom || [];
    const sumBom = re => bom.filter(it => re.test(it.name || '')).reduce((s, it) => s + (it.qty || 0), 0);
    const midClamps = sumBom(/mid.?clamp/i);
    const endClamps = sumBom(/end.?clamp/i);
    const lFeet     = sumBom(/l.?foot/i);
    const torques = buildTorqueTable(cfg.estructura, cfg.techo);
    const torqueEstructural = torques.find(t => /clamp|l-?foot|base/i.test(t.comp));

    return `
    <details class="calc-info-banner" open>
      <summary class="cib-header" style="cursor:pointer">${icon('calculator', 14)}<span>Referencia de ingeniería — Estructura y canalización FV</span></summary>
      <div class="card-row"><div class="meta-item meta-item-full"><span class="meta-lbl">Sistema</span><span class="meta-val">${esc(marca)}</span></div></div>
      <div class="card-row"><div class="meta-item meta-item-full"><span class="meta-lbl">Metros totales de riel necesarios</span><span class="meta-val">${metrosRiel.toFixed(2)} m</span></div></div>
      <div class="card-row"><div class="meta-item meta-item-full"><span class="meta-lbl">BOM</span><span class="meta-val">${midClamps} Mid-Clamps · ${endClamps} End-Clamps${lFeet ? ` · ${lFeet} L-Feet` : ''}</span></div></div>
      ${torqueEstructural ? `<div class="card-row"><div class="meta-item meta-item-full"><span class="meta-lbl">Torque estructural recomendado</span><span class="meta-val">${esc(torqueEstructural.torque)}</span></div></div>` : ''}
      ${renderTrayectoriasResumen(project)}
    </details>`;
  }

  if (bloque === 2) {
    return `
    <details class="calc-info-banner" open>
      <summary class="cib-header" style="cursor:pointer">${icon('calculator', 14)}<span>Referencia de ingeniería — Canalización central</span></summary>
      ${renderTrayectoriasResumen(project)}
    </details>`;
  }

  return '';
}

// Sitio físico → bloque donde se documenta con fotos (evita repetir la misma
// galería en más de una pestaña). 'techo' aquí no son fotos del techo en sí
// (no tiene slots propios en SLOTS_CIERRE_SITIO) sino la tarjeta de "Foto
// general del sistema" + fotos adicionales de cierre — por eso vive en el
// Bloque 3 (Cierre), igual que zonaDelSistema/centrosCarga. centrosCarga
// además se repite filtrado en el Bloque 2 (ver documentacion.js, llamada
// hardcodeada con bloqueFiltro=2 para sus slots de equipos). El Bloque 1 no
// tiene galería propia — su evidencia sale del checklist por paso
// (fotosCierre de cada bloque, ver _pasoCompleto más abajo).
export const SITIO_BLOQUE_PRIMARIA = {
  techo:          3,
  zonaDelSistema: 3,
  centrosCarga:   3,
};

// Progreso por bloque, calculado sobre TODOS los pasos del proyecto — solo
// checklist (lo que se ve en el badge numérico de cada pestaña/tarjeta).
export function computeBloqueStatus(allExecBlocks, cl) {
  const status = {};
  for (const b of allExecBlocks) {
    if (!status[b.bloque]) status[b.bloque] = { done: 0, total: 0 };
    status[b.bloque].total += b.items.length;
    status[b.bloque].done  += b.items.filter(it => cl.exec?.[it.id]).length;
  }
  return status;
}

// ── Evidencias de cierre por paso ─────────────────────────────────────────────
function _slotData(cl, blockId, slotId) {
  return cl.fotosCierre?.[blockId]?.[slotId] || null;
}
function _slotSatisfecho(cl, blockId, slotId) {
  const d = _slotData(cl, blockId, slotId);
  return !!(d && (d.url || d.pending || d.justificacion));
}
// ¿El paso está REALMENTE completo? — checklist 100% + evidencias obligatorias
// satisfechas (foto o justificación). Distinto de "bd===bt" (que solo revela
// la sección de evidencias por ergonomía, sin exigir todavía las fotos).
function _pasoCompleto(block, cl) {
  const bd = block.items.filter(it => cl.exec?.[it.id]).length;
  const bt = block.items.length;
  if (bd !== bt || bt === 0) return false;
  return (block.fotosCierre || []).filter(s => s.obligatoria).every(s => _slotSatisfecho(cl, block.id, s.id));
}

// ¿Está desbloqueado el bloque N? — natural (bloques previos REALMENTE
// completos, no solo con checklist marcado) u override de admin.
function _bloqueGate(allExecBlocks, cl, bloque, overrides) {
  if (bloque <= 1) return { unlocked: true, overridden: false };
  let natural = true;
  for (const b of allExecBlocks) {
    if (b.bloque < bloque && !_pasoCompleto(b, cl)) { natural = false; break; }
  }
  if (natural) return { unlocked: true, overridden: false };
  if (overrides?.[bloque]) return { unlocked: true, overridden: true };
  return { unlocked: false, overridden: false };
}

function _fmtFecha(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
}

// ── Hitos de fecha por bloque (inicio / cierre / quién cerró) ────────────────
// Se llama después de marcar/desmarcar un ítem del checklist.
export async function recalcBloqueMilestone(pid, bloque) {
  const { projects } = await import('./db.js');
  const { getExecBlocks } = await import('../modules/checklist/index.js');
  const p = await projects.getById(pid);
  if (!p) return;
  const cl    = p.checklistData || {};
  const techo = p.projectConfig?.techo || cl.techo || 'cemento';
  const blocks = getExecBlocks(p, techo).filter(b => b.bloque === bloque);
  if (!blocks.length) return;
  const items   = blocks.flatMap(b => b.items);
  const done    = items.filter(it => cl.exec?.[it.id]).length;
  const total   = items.length;
  const fechas  = cl.bloqueFechas?.[bloque] || {};
  const completo = blocks.every(b => _pasoCompleto(b, cl));

  if (done > 0 && !fechas.inicio) {
    await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.inicio`, isoNow());
  }
  if (completo && !fechas.cierre) {
    const { getSession } = await import('./auth.js');
    const session = await getSession();
    await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.cierre`, isoNow());
    await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.cerradoPor`, session);
  } else if (!completo && fechas.cierre) {
    await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.cierre`, null);
    await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.cerradoPor`, null);
  }
}

// Guarda el toggle de un ítem del checklist Y recalcula el hito de su bloque —
// punto único usado tanto por Progreso de obra (documentacion.js) como por el
// checklist standalone (cl-actions.js), para que el hito se actualice sin
// importar desde cuál vista se marcó el ítem. Retorna el bloque del ítem (o null).
export async function toggleExecItem(pid, id, v) {
  const { projects } = await import('./db.js');
  await projects.setField(pid, `checklistData.exec.${id}`, v);
  const { getExecBlocks } = await import('../modules/checklist/index.js');
  const p = await projects.getById(pid);
  if (!p) return null;
  const cl    = p.checklistData || {};
  const techo = p.projectConfig?.techo || cl.techo || 'cemento';
  const block = getExecBlocks(p, techo).find(b => b.items.some(it => it.id === id));
  if (!block) return null;
  await recalcBloqueMilestone(pid, block.bloque);
  return block.bloque;
}

// Marca la fecha de inicio de un bloque aunque no haya checklist marcado
// todavía — subir la primera foto de su sitio también cuenta como "se empezó".
export async function stampBloqueInicio(pid, bloque) {
  if (!bloque) return;
  const { projects } = await import('./db.js');
  const p = await projects.getById(pid);
  if (p?.checklistData?.bloqueFechas?.[bloque]?.inicio) return;
  await projects.setField(pid, `checklistData.bloqueFechas.${bloque}.inicio`, isoNow());
}

function _hitosBloqueHtml(fechas) {
  if (!fechas?.inicio) return '';
  const partes = [`Iniciado ${_fmtFecha(fechas.inicio)}`];
  if (fechas.cierre) partes.push(`Cerrado ${_fmtFecha(fechas.cierre)}${fechas.cerradoPor ? ` por ${esc(fechas.cerradoPor)}` : ''}`);
  return `<p class="cl-bloque-hitos">${partes.join(' · ')}</p>`;
}

// Panel de nota informativa: herramientas + instrucción del paso, plegado por
// default — accesible con el botón [ℹ️] junto al título de cada paso.
function _notaInfoHtml(stepIdx, herramientas, nota) {
  if (!herramientas?.length && !nota) return '';
  return `
  <div class="cl-step-nota" id="cl-step-nota-${stepIdx}" style="display:none">
    ${nota ? `<p class="cl-step-nota-texto">${esc(nota)}</p>` : ''}
    ${herramientas?.length ? `<p class="cl-step-nota-herr"><strong>Herramientas:</strong> ${herramientas.map(esc).join(', ')}</p>` : ''}
  </div>`;
}

// Tarjeta de un slot de evidencia: foto guardada / justificación / vacío.
function _slotFotoHtml(block, slot, pid, cl, edit) {
  const d = _slotData(cl, block.id, slot.id);
  const reqBadge = slot.obligatoria ? `<span class="cl-foto-cierre-obligatoria">* Obligatoria</span>` : '';
  if (d?.url || d?.pending) {
    return `
    <div class="cl-foto-cierre-slot cl-foto-cierre-lista">
      ${fotoMini(d.url || d, slot.label)}
      <span class="cl-foto-cierre-label">${esc(slot.label)}</span> ${reqBadge}
      ${edit ? `<button type="button" class="btn-sm btn-outline" onclick="capFotoCierrePaso('${pid}','${block.id}','${slot.id}')">Retomar</button>` : ''}
    </div>`;
  }
  if (d?.justificacion) {
    return `
    <div class="cl-foto-cierre-slot cl-foto-cierre-justificada">
      ${icon('warning', 16)}
      <div>
        <span class="cl-foto-cierre-label">${esc(slot.label)}</span> ${reqBadge}
        <p class="cl-foto-cierre-nota">⚠ Justificado: ${esc(d.justificacion)}</p>
      </div>
      ${edit ? `<button type="button" class="btn-sm btn-outline" onclick="quitarJustificacionCierre('${pid}','${block.id}','${slot.id}')">Quitar justificación</button>` : ''}
    </div>`;
  }
  return `
  <div class="cl-foto-cierre-slot cl-foto-cierre-vacia">
    <button type="button" class="cl-foto-cierre-tile" ${edit ? `onclick="capFotoCierrePaso('${pid}','${block.id}','${slot.id}')"` : 'disabled'}>
      ${icon('camera', 22)}
      <span>${esc(slot.label)}</span>
      ${reqBadge}
    </button>
    ${edit ? `<button type="button" class="cl-foto-cierre-omitir" onclick="justificarCierrePaso('${pid}','${block.id}','${slot.id}')">Omitir con justificación</button>` : ''}
  </div>`;
}

export function renderExecPorBloque(project, bloque, allExecBlocks, edit, admin) {
  const cl        = project.checklistData || {};
  const overrides = cl.bloqueOverride || {};
  const blocks     = allExecBlocks.filter(b => b.bloque === bloque);
  if (!blocks.length) return '';
  const allItems = blocks.flatMap(b => b.items);
  const done     = allItems.filter(it => cl.exec?.[it.id]).length;
  const total    = allItems.length;
  const pct      = total ? Math.round(done / total * 100) : 0;
  const pid      = project.id;
  const fechas   = cl.bloqueFechas?.[bloque] || {};

  const _vocHint = (it) => {
    const m = it.id.match(/^med-voc-(\d+)$/);
    if (!m) return '';
    const g = project.garantia || {};
    const str = g.paneles?.strings?.[parseInt(m[1], 10)];
    const panelesSerie = str?.paneles?.length || null;
    const vocPanel = g.paneles?.voc || null;
    const lev = project.documentacion?.levantamiento || {};
    const esperado = calcVocEsperadoString({
      vocPanel, panelesSerie,
      tMin: lev.tMin, coefVoc: g.validacionVoc?.coefVoc,
    });
    return esperado != null
      ? `<span class="input-hint">Esperado: ~${esperado.toFixed(1)} V (${panelesSerie} en serie)</span>`
      : '';
  };

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
            ${_vocHint(it)}
          </div>` : ''}
        </div>
      </label>`;
  };

  return `
  <div class="card exec-section">
    <div class="card-title-row">
      <h3 class="card-title">Ejecución — ${esc(BLOQUE_DESC[bloque] || '')}</h3>
      <span class="cl-prog-lbl">${done}/${total}</span>
    </div>
    <div class="cl-prog-bar-wrap">
      <div class="cl-prog-bar${pct===100?' cl-prog-done':''}" style="width:${pct}%"></div>
    </div>
    <div id="cl-bloque-hitos-${bloque}">${_hitosBloqueHtml(fechas)}</div>
    ${blocks.map((block, stepIdx) => {
      const bd        = block.items.filter(it => cl.exec?.[it.id]).length;
      const bt        = block.items.length;
      const chkDone   = bd === bt; // ergonomía: revela la sección de evidencias
      const completo  = _pasoCompleto(block, cl); // checklist + evidencias obligatorias
      const gate      = _bloqueGate(allExecBlocks, cl, block.bloque, overrides);
      const notaId    = `${bloque}-${stepIdx}`;
      const progClass = bd === 0 ? 'cl-prog-0' : completo ? 'cl-prog-completo' : 'cl-prog-parcial';
      return `
      ${_notaInfoHtml(notaId, block.herramientas, block.nota)}
      <details class="cl-exec-block ${progClass} ${gate.unlocked ? '' : 'cl-exec-locked'}" ${(completo || !gate.unlocked) ? '' : 'open'}>
        <summary class="cl-exec-block-hdr">
          ${(block.herramientas?.length || block.nota) ? `<button type="button" class="cl-step-info-btn" title="Herramientas e instrucción"
              onclick="event.preventDefault();event.stopPropagation();const n=document.getElementById('cl-step-nota-${notaId}');n.style.display=n.style.display==='none'?'':'none'">ℹ️</button>` : ''}
          <span class="cl-exec-block-title">${esc(block.label)}</span>
          ${!gate.unlocked
            ? `<span class="cl-exec-lock-icon" title="Bloqueado">${icon('lock', 14)}</span>`
            : `<span class="cl-exec-block-badge ${completo ? 'cl-exec-ok' : ''}">${completo ? '✓' : `${bd}/${bt}`}</span>`}
          <span class="cl-exec-caret">▾</span>
        </summary>
        ${!gate.unlocked ? `
        <div class="cl-exec-gate-msg cl-exec-gate-locked">
          ${icon('lock', 14)} Completa primero ${esc(BLOQUE_LABELS[block.bloque - 1] || '')} — ${esc(BLOQUE_DESC[block.bloque - 1] || '')}.
          ${admin ? `<button class="btn-outline btn-sm" onclick="_clOverrideBloque('${pid}',${block.bloque},true)">Desbloquear (excepción)</button>` : ''}
        </div>` : gate.overridden ? `
        <div class="cl-exec-gate-msg cl-exec-gate-override">
          ${icon('warning', 14)} Desbloqueada manualmente por excepción.
          ${admin ? `<button class="btn-outline btn-sm" onclick="_clOverrideBloque('${pid}',${block.bloque},false)">Re-bloquear</button>` : ''}
        </div>` : ''}
        <div class="cl-item-list" style="padding:0 4px 8px">
          ${block.items.map(it => _item(it, !gate.unlocked)).join('')}
        </div>
        ${block.fotosCierre?.length ? `
        <div class="cl-cierre ${chkDone ? 'cl-cierre-activa' : 'cl-cierre-bloqueada'}">
          <p class="cl-cierre-hdr">${chkDone ? '📸 Evidencias de cierre técnico' : `${icon('lock', 13)} Completa las tareas para habilitar la captura`}</p>
          ${chkDone ? block.fotosCierre.map(slot => _slotFotoHtml(block, slot, pid, cl, edit)).join('') : ''}
        </div>` : ''}
      </details>`;
    }).join('')}
  </div>`;
}

// ── Handlers de evidencias de cierre ──────────────────────────────────────────
window.capFotoCierrePaso = function(projectId, blockId, slotId) {
  capturePhoto(async (b64) => {
    const { uploadPhotoQueued } = await import('./firebase.js');
    const { projects } = await import('./db.js');
    toast('Subiendo foto…');
    const fid = uuid();
    const result = await uploadPhotoQueued(b64,
      `projects/${projectId}/cierre_${blockId}_${slotId}_${fid}.jpg`, projectId,
      'fotoCierrePaso', { blockId, slotId, itemId: fid });
    const foto = {
      url: result.url || null, id: fid, createdAt: isoNow(),
      ...(result.pending && { pending: true, pendingId: result.pendingId }),
    };
    // setField reemplaza por completo el valor en esa ruta (no hace merge) —
    // una foto real automáticamente borra cualquier justificación previa del
    // mismo slot sin necesidad de deleteField() explícito.
    await projects.setField(projectId, `checklistData.fotosCierre.${blockId}.${slotId}`, foto);
    navigate(window.location.hash);
    if (!result.pending) toast('✅ Evidencia guardada');
  }, { preview: true });
};

window.justificarCierrePaso = async function(projectId, blockId, slotId) {
  const nota = await inputDialog('Justificación (qué cambió y por qué no hay foto):', '');
  if (!nota) return;
  const { projects } = await import('./db.js');
  const { getSession } = await import('./auth.js');
  const session = await getSession();
  await projects.setField(projectId, `checklistData.fotosCierre.${blockId}.${slotId}`, {
    justificacion: nota, justificadoPor: session, justificadoAt: isoNow(),
  });
  navigate(window.location.hash);
};

window.quitarJustificacionCierre = async function(projectId, blockId, slotId) {
  const { confirmDialog } = await import('./utils.js');
  if (!await confirmDialog('¿Quitar esta justificación? El slot quedará pendiente de evidencia otra vez.')) return;
  const { projects } = await import('./db.js');
  await projects.setField(projectId, `checklistData.fotosCierre.${blockId}.${slotId}`, null);
  navigate(window.location.hash);
};
