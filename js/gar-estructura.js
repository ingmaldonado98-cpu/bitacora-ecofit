// gar-estructura.js — Estructura de montaje: render, form y guardar
// Extraído de garantia.js. Exporta renderEstructura, renderEstructuraForm.

import { projects, logChange } from './db.js';
import { esc, fotoMini, toast, MARCAS_ESTRUCTURA, SISTEMAS_ESTRUCTURALES, TIPOS_FIJACION } from './utils.js';
import { getSession } from './auth.js';
import { icon } from './icons.js';
import { updateQueueItem } from './photo-queue.js';
import { buildFotoPath } from './firebase.js';
import { _eqFotos, _clearEqFotos } from './gar-equipos.js';
import { railCutForRow, getRowsData, getTotalPanels, getPanelWidth, getPanelHeight, buildTorqueTable } from '../modules/calculadora/index.js';

function renderCalcInfo(cfg, projectId) {
  if (!cfg) return `
  <div class="calc-info-banner calc-info-empty">
    <div class="cib-header">
      ${icon('calculator', 14)}
      <span>Sin datos de calculadora</span>
    </div>
    <p class="cib-hint">Genera el BOM en la calculadora para ver la estructura aquí.</p>
    <button class="btn-outline btn-sm" onclick="navigate('#calculadora/${projectId}')">
      ${icon('calculator', 14)} Abrir calculadora
    </button>
  </div>`;
  const estructuraLabel = cfg.estructura === 'k2' ? 'K2 Systems' : cfg.estructura === 'aluminex' ? 'Aluminex' : cfg.estructura || '—';
  const techoLabel      = cfg.techo === 'cemento' ? 'Concreto/losa' : cfg.techo === 'metal' ? 'Metálico/lámina' : cfg.techo || '—';
  const paneles         = getTotalPanels(cfg) || '—';
  const modelo          = cfg.panel?.model || (getPanelWidth(cfg) ? `${getPanelWidth(cfg)}×${getPanelHeight(cfg)} m` : '—');
  const rows            = getRowsData(cfg);
  const layout          = rows.length ? rows.map((c,i)=>`F${i+1}: ${c}`).join(' · ') : '—';
  const ts              = cfg.timestamp ? new Date(cfg.timestamp).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric'}) : '';
  return `
  <div class="calc-info-banner">
    <div class="cib-header">
      ${icon('calculator', 14)}
      <span>Datos de calculadora</span>
      ${ts ? `<span class="cib-ts">${ts}</span>` : ''}
      <button class="btn-icon-xs" onclick="navigate('#calculadora/${projectId}')" title="Editar en calculadora">
        ${icon('pencil-simple', 12)}
      </button>
    </div>
    <div class="card-row">
      <div class="meta-item"><span class="meta-lbl">Sistema</span><span class="meta-val">${esc(estructuraLabel)}</span></div>
      <div class="meta-item"><span class="meta-lbl">Techo</span><span class="meta-val">${esc(techoLabel)}</span></div>
    </div>
    <div class="card-row">
      <div class="meta-item"><span class="meta-lbl">Paneles</span><span class="meta-val">${paneles}</span></div>
      <div class="meta-item"><span class="meta-lbl">Modelo</span><span class="meta-val">${esc(modelo)}</span></div>
    </div>
    <div class="card-row">
      <div class="meta-item meta-item-full"><span class="meta-lbl">Distribución</span><span class="meta-val">${esc(layout)}</span></div>
    </div>
  </div>`;
}

export function renderEstructura(est, projectId, edit, cfg) {
  const calcBanner = renderCalcInfo(cfg, projectId);
  if (!est && !edit) return `${calcBanner}<p class="empty-msg-sm">Sin estructura registrada.</p>`;
  if (!est && edit) {
    return `${calcBanner}<button class="btn-primary btn-sm" onclick="navigate('#proyecto/${projectId}/garantia/estructura')">
      + Registrar estructura</button>`;
  }
  return `
    ${calcBanner}
    <div class="struct-info">
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Marca</span><span class="meta-val">${esc(est.marca||'—')}</span></div>
        <div class="meta-item"><span class="meta-lbl">Sistema</span><span class="meta-val">${esc(est.sistemaEstructural||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Modelo</span><span class="meta-val">${esc(est.modelo||'—')}</span></div>
        <div class="meta-item"><span class="meta-lbl">Fijación</span><span class="meta-val">${esc(est.tipoFijacion||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Metros riel</span><span class="meta-val">${est.metrosRiel||'—'} m</span></div>
        <div class="meta-item"><span class="meta-lbl">Mid-clamps</span><span class="meta-val">${est.midClamps||0} pzas</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">End-clamps</span><span class="meta-val">${est.endClamps||0} pzas</span></div>
      </div>
      <div class="eq-fotos">
        ${fotoMini(est.fotoFrontal,'Frontal')}
        ${fotoMini(est.fotoAngulo,'Ángulo')}
      </div>
      ${est.notas ? `<p class="eq-notas">${esc(est.notas)}</p>` : ''}
    </div>
    ${edit ? `<button class="btn-outline btn-sm" onclick="navigate('#proyecto/${projectId}/garantia/estructura')">Editar estructura</button>` : ''}
  `;
}

// Form de estructura (como sub-ruta)
export async function renderEstructuraForm(projectId, session) {
  const project = await projects.getById(projectId);
  const est = project?.garantia?.estructura || {};
  _clearEqFotos(); // limpiar fotos temporales de sesiones anteriores
  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}/garantia')">${icon('caret-left')}</button>
    <h1 class="hdr-title">Estructura de montaje</h1>
  </div>
  <form class="form-card" onsubmit="guardarEstructura(event,'${projectId}')">
    ${project?.projectConfig ? `<button type="button" class="btn-outline btn-sm" onclick="importarHerrajes('${projectId}')" style="margin-bottom:14px">
      ${icon('calculator', 14)} Importar herrajes de ingeniería</button>
      <div id="torque-ref-box" style="display:none;margin-bottom:14px"></div>` : ''}
    <div class="form-group"><label>Marca *</label>
      <select name="marca">${MARCAS_ESTRUCTURA.map(m=>`<option ${est.marca===m?'selected':''}>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Sistema estructural</label>
      <select name="sistemaEstructural">${SISTEMAS_ESTRUCTURALES.map(s=>`<option ${est.sistemaEstructural===s?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Modelo / Referencia</label>
      <input type="text" name="modelo" value="${esc(est.modelo||'')}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Metros de riel (m)</label>
        <input type="number" name="metrosRiel" min="0" step="0.1" value="${est.metrosRiel||''}" /></div>
      <div class="form-group"><label>Tipo de fijación</label>
        <select name="tipoFijacion">${TIPOS_FIJACION.map(t=>`<option ${est.tipoFijacion===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Mid-clamps (pzas)</label>
        <input type="number" name="midClamps" min="0" value="${est.midClamps||0}" /></div>
      <div class="form-group"><label>End-clamps (pzas)</label>
        <input type="number" name="endClamps" min="0" value="${est.endClamps||0}" /></div>
    </div>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-est-frontal">
        <button type="button" class="btn-foto-sm" onclick="capEqFoto('frontal','slot-est-frontal')">
          ${icon('camera')} Frontal</button>
        ${fotoMini(est.fotoFrontal,'Frontal')}
      </div>
      <div class="foto-cap-slot" id="slot-est-angulo">
        <button type="button" class="btn-foto-sm" onclick="capEqFoto('angulo','slot-est-angulo')">
          ${icon('camera')} Ángulo</button>
        ${fotoMini(est.fotoAngulo,'Ángulo')}
      </div>
    </div>
    <div class="form-group"><label>Notas (tipo de techo, observaciones)</label>
      <textarea name="notas" rows="2">${esc(est.notas||'')}</textarea></div>
    <div class="form-actions">
      <button type="button" class="btn-outline" onclick="navigate('#proyecto/${projectId}/garantia')">Cancelar</button>
      <button type="submit" class="btn-primary">Guardar estructura</button>
    </div>
  </form>`;
}

// Precarga marca/metros de riel/clamps a partir de la Calculadora — los campos
// importados se marcan como "sugeridos" (azul) hasta que el usuario los edite.
window.importarHerrajes = async function(projectId) {
  const p = await projects.getById(projectId);
  const cfg = p?.projectConfig;
  if (!cfg) { toast('Sin datos de calculadora para importar', 'error'); return; }

  const marca     = cfg.estructura === 'k2' ? 'K2 Systems' : cfg.estructura === 'aluminex' ? 'Aluminex' : '';
  const pW        = getPanelWidth(cfg) || 1.134;
  const rowsData  = getRowsData(cfg);
  const metrosRiel = rowsData.reduce((s, c) => s + 2 * railCutForRow(c, pW, cfg.estructura), 0);
  const bom       = cfg.computed?.bom || [];
  const sumBom    = re => bom.filter(it => re.test(it.name || '')).reduce((s, it) => s + (it.qty || 0), 0);
  const midClamps = sumBom(/mid.?clamp/i);
  const endClamps = sumBom(/end.?clamp/i);

  const marcarSugerido = (selector, value) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.value = value;
    el.classList.add('field-sugerido');
    el.addEventListener('input', () => el.classList.remove('field-sugerido'), { once: true });
  };

  if (marca) marcarSugerido('[name="marca"]', marca);
  marcarSugerido('[name="metrosRiel"]', metrosRiel.toFixed(1));
  if (midClamps) marcarSugerido('[name="midClamps"]', midClamps);
  if (endClamps) marcarSugerido('[name="endClamps"]', endClamps);

  const torques = buildTorqueTable(cfg.estructura, cfg.techo);
  const box = document.getElementById('torque-ref-box');
  if (box && torques.length) {
    box.style.display = '';
    box.innerHTML = `
      <div class="calc-info-banner">
        <div class="cib-header">${icon('calculator', 14)}<span>Torques de referencia</span></div>
        ${torques.map(t => `
          <div class="card-row">
            <div class="meta-item meta-item-full">
              <span class="meta-lbl">${esc(t.comp)}</span>
              <span class="meta-val">${esc(t.torque)} — ${esc(t.nota)}</span>
            </div>
          </div>`).join('')}
      </div>`;
  }

  toast('✅ Herrajes importados de la calculadora — revisa y confirma');
};

window.guardarEstructura = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = await projects.getById(projectId);
  p.garantia.estructura = {
    marca:             fd.get('marca'),
    sistemaEstructural:fd.get('sistemaEstructural'),
    modelo:            fd.get('modelo').trim(),
    metrosRiel:        parseFloat(fd.get('metrosRiel'))||0,
    tipoFijacion:      fd.get('tipoFijacion'),
    midClamps:         parseInt(fd.get('midClamps'))||0,
    endClamps:         parseInt(fd.get('endClamps'))||0,
    fotoFrontal:       _eqFotos.frontal  || p.garantia.estructura?.fotoFrontal  || null,
    fotoAngulo:        _eqFotos.angulo   || p.garantia.estructura?.fotoAngulo   || null,
    notas:             fd.get('notas').trim(),
  };
  await projects.update(projectId, { garantia: p.garantia });

  // Reparchar items de cola con el projectId real y el campo correcto —
  // mismo fix que ya tiene gar-equipos.js::guardarEquipo (capEqFoto sube con
  // projectId:'equipo_temp' porque la estructura aún no tiene fotos guardadas
  // al momento de tomarlas; sin esto, una foto que cae a la cola offline
  // quedaba huérfana para siempre).
  const _fotoCampos = [['frontal','fotoFrontal'], ['angulo','fotoAngulo']];
  for (const [tipo, campo] of _fotoCampos) {
    const fotoMem = _eqFotos[tipo];
    if (fotoMem && typeof fotoMem === 'object' && fotoMem.pending && fotoMem.pendingId) {
      await updateQueueItem(fotoMem.pendingId, {
        projectId,
        storagePath: buildFotoPath(projectId, `estructura_${tipo}_${fotoMem.pendingId}.jpg`),
        op: 'estructuraFoto',
        opArgs: { campo },
      });
    }
  }

  logChange(projectId, {
    modulo: 'Garantía', accion: 'estructura guardada',
    detalle: `${p.garantia.estructura.marca} — ${p.garantia.estructura.sistemaEstructural}`,
    quien: await getSession(),
  });

  _clearEqFotos();
  toast('✅ Estructura guardada');
  navigate(`#proyecto/${projectId}/garantia`);
};
