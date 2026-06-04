// garantia.js — Módulo 1: Garantía (fotos técnicas, equipos, estructura, paneles)

import { projects } from './db.js';
import { esc, fmtFechaHora, fotoMini, capturePhoto, compressImage, toast, confirmDialog, inputDialog,
         uploadProgressBar, uuid, isoNow, MARCAS_EQUIPOS, MARCAS_ESTRUCTURA, SISTEMAS_ESTRUCTURALES, TIPOS_FIJACION } from './utils.js';
import { canEdit, isAdmin } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';
import { scanOnce, startContinuousScan, stopScanner } from './scanner.js';

// ── Vista principal del módulo ─────────────────────────────────────────────────
export async function renderGarantia(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const g = project.garantia || {};

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Garantía</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <!-- Tabs internos -->
  <div class="tab-bar" id="garantia-tabs">
    <button class="tab-btn tab-active" data-tab="g-general"   onclick="switchTab('garantia-tabs','g-general',this)">General</button>
    <button class="tab-btn" data-tab="g-equipos"              onclick="switchTab('garantia-tabs','g-equipos',this)">Equipos</button>
    <button class="tab-btn" data-tab="g-estructura"           onclick="switchTab('garantia-tabs','g-estructura',this)">Estructura</button>
    <button class="tab-btn" data-tab="g-paneles"              onclick="switchTab('garantia-tabs','g-paneles',this)">Paneles</button>
    <button class="tab-btn" data-tab="g-notas"                onclick="switchTab('garantia-tabs','g-notas',this)">
      Notas${(g.notas||[]).length ? `<span class="tab-badge tab-ok">${(g.notas||[]).length}</span>` : ''}
    </button>
  </div>

  <!-- 1A: Foto general + 1B: Fotos técnicas -->
  <div id="g-general" class="tab-panel tab-panel-active">
    <div class="card">
      <h3 class="card-title">1A · Foto general del sistema <span class="req-badge">OBLIGATORIA</span></h3>
      <div class="foto-slot" id="slot-foto-sistema">
        ${g.fotoSistema
          ? `${fotoMini(g.fotoSistema,'Foto general')}<button class="btn-del-foto" onclick="delFotoGeneral('${projectId}')">✕</button>`
          : (edit ? `<button class="btn-foto-add" onclick="capturarFotoSistema('${projectId}')">
              ${icon('camera', 32)}<span>Tomar foto</span>
            </button>` : '<p class="empty-msg-sm">Sin foto.</p>')}
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">1B · Fotos técnicas de cierre</h3>
      ${renderFotosTecnicas(g.fotosTecnicas || {}, projectId, edit)}
    </div>
    <div class="card">
      ${renderFotosAdicionales(g.fotosAdicionales || [], projectId, edit)}
    </div>
  </div>

  <!-- 1C: Equipos -->
  <div id="g-equipos" class="tab-panel">
    <div class="card-title-row" style="padding:0 0 12px">
      <h3 class="card-title">1C · Equipos instalados (${(g.equipos||[]).length})</h3>
      ${edit ? `<button class="btn-primary btn-sm" onclick="showFormEquipo('${projectId}')">+ Equipo</button>` : ''}
    </div>
    <div id="lista-equipos">
      ${renderEquipos(g.equipos || [], projectId, edit, isAdmin(session))}
    </div>
    <div id="form-equipo" style="display:none" class="card">
      ${formEquipo(projectId)}
    </div>
  </div>

  <!-- 1D: Estructura -->
  <div id="g-estructura" class="tab-panel">
    <div class="card">
      <h3 class="card-title">1D · Estructura de montaje</h3>
      ${renderEstructura(g.estructura, projectId, edit, project.projectConfig)}
    </div>
  </div>

  <!-- 1E: Paneles -->
  <div id="g-paneles" class="tab-panel">
    ${renderPaneles(g.paneles || { marca:'', modelo:'', wp:0, strings:[] }, projectId, edit)}
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
  `;
}

// ── 1A Foto del sistema ────────────────────────────────────────────────────────
window.capturarFotoSistema = function(projectId) {
  capturePhoto(async (b64) => {
    toast(navigator.onLine ? 'Subiendo foto…' : 'Sin conexión — foto guardada localmente');
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
    const slot = document.getElementById('slot-foto-sistema');
    const displaySrc = result.url || (result.pending ? b64 : '');
    slot.innerHTML = `${fotoMini(displaySrc,'Foto general')}<button class="btn-del-foto" onclick="delFotoGeneral('${projectId}')">✕</button>`;
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotoSistema = result.url || null;
    if (result.pending) p.garantia._fotoSistemaPending = result.pendingId;
    await projects.update(projectId, { garantia: p.garantia });
    if (!result.pending) toast('✅ Foto guardada');
  });
};

window.delFotoGeneral = async function(projectId) {
  if (!await confirmDialog('¿Eliminar foto del sistema?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotoSistema = null;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1B+ Fotos adicionales de cierre ──────────────────────────────────────────
function renderFotosAdicionales(fotos, projectId, edit) {
  return `
  <div class="card-title-row">
    <h3 class="card-title">1B+ · Fotos adicionales de cierre</h3>
    ${edit ? `<button class="btn-primary btn-sm" onclick="capFotoAdicional('${projectId}')">
      ${icon('camera')} Agregar fotos</button>` : ''}
  </div>
  ${fotos.length === 0
    ? (edit
        ? `<div class="empty-state"><div class="empty-state-icon">📷</div>
           <p class="empty-state-msg">Sin fotos adicionales de cierre.<br>Puedes seleccionar varias a la vez.</p>
           <button class="empty-state-cta" onclick="capFotoAdicional('${projectId}')">Agregar fotos</button></div>`
        : '<p class="empty-msg-sm">Sin fotos adicionales.</p>')
    : `<div class="fotos-grid">
        ${fotos.map((f, i) => `
          <div class="foto-card">
            ${fotoMini(f.data, `Foto ${i + 1}`)}
            ${f.nota ? `<p class="foto-nota">${esc(f.nota)}</p>` : ''}
            ${edit ? `
              <button class="btn-del-foto-abs" onclick="editFotoAdicionalNota('${projectId}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoAdicional('${projectId}',${i})">✕</button>
            ` : ''}
          </div>`).join('')}
      </div>`}
  `;
}

window.capFotoAdicional = function(projectId) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i], `projects/${projectId}/adicional_${fid}.jpg`,
        projectId, 'fotoAdicional', { itemId: fid });
      nuevas.push({
        data: result.url || (result.pending ? fotos[i] : null),
        nota: '', id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    if (total === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }

    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotosAdicionales = [...(p.garantia.fotosAdicionales || []), ...nuevas];
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoAdicional = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotosAdicionales.splice(idx, 1);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

window.editFotoAdicionalNota = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const actual = p.garantia.fotosAdicionales[idx].nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  p.garantia.fotosAdicionales[idx].nota = nueva;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1B Fotos técnicas ─────────────────────────────────────────────────────────
// Retrocompat: el campo puede ser string (viejo) o array [{url,id,createdAt}] (nuevo)
function getFotosTecnicas(ft, key) {
  const v = ft[key];
  if (!v) return [];
  if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
  return Array.isArray(v) ? v : [];
}

function renderFotosTecnicas(ft, projectId, edit) {
  const slots = [
    { key:'tableroAC',          label:'Tablero AC terminado',       req:true  },
    { key:'tableroDC',          label:'Tablero DC terminado',       req:true  },
    { key:'protecciones',       label:'Protecciones instaladas',    req:false },
    { key:'inversorEnergizado', label:'Inversor energizado',        req:true  },
    { key:'puestaATierra',      label:'Puesta a tierra',            req:false },
    { key:'etiquetado',         label:'Etiquetado',                 req:false },
  ];

  return slots.map(s => {
    const fotos = getFotosTecnicas(ft, s.key);
    const tiene = fotos.length > 0;
    return `
    <div class="foto-tecnica-row">
      <div class="ft-label">
        <ph-icon name="${tiene ? 'check-circle' : 'circle'}" class="${tiene ? 'icon-ok' : 'icon-pending'}"></ph-icon>
        ${s.label}
        ${s.req ? '<span class="req-badge">OBLIG.</span>' : '<span class="opt-badge">Rec.</span>'}
        ${tiene ? `<span class="ft-count">${fotos.length}</span>` : ''}
      </div>
      <div class="ft-fotos-grid">
        ${fotos.map((f, i) => `
          <div class="ft-foto-item">
            ${fotoMini(f.url, s.label)}
            ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnica('${projectId}','${s.key}',${i})">✕</button>` : ''}
          </div>`).join('')}
        ${edit ? `<button class="btn-foto-sm ft-add-btn" onclick="capFotoTecnica('${projectId}','${s.key}')">
            ${icon('camera')} ${tiene ? '+' : 'Tomar'}
          </button>` : (!tiene ? '<span class="ft-empty">—</span>' : '')}
      </div>
    </div>`;
  }).join('');
}

window.capFotoTecnica = function(projectId, key) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(projectId);
    p.garantia.fotosTecnicas = p.garantia.fotosTecnicas || {};

    // Normalizar valor existente a array
    const existentes = getFotosTecnicas(p.garantia.fotosTecnicas, key);

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i], `projects/${projectId}/tecnica_${key}_${fid}.jpg`,
        projectId, 'fotoTecnica', { key, itemId: fid });
      existentes.push({
        url: result.url || null,
        id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    p.garantia.fotosTecnicas[key] = existentes;
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoTecnica = async function(projectId, key, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const fotos = getFotosTecnicas(p.garantia.fotosTecnicas, key);
  fotos.splice(idx, 1);
  p.garantia.fotosTecnicas[key] = fotos.length ? fotos : null;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1C Equipos ────────────────────────────────────────────────────────────────
function renderEquipos(equipos, projectId, edit, admin) {
  if (!equipos.length) return edit
    ? `<div class="empty-state"><div class="empty-state-icon">⚡</div>
       <p class="empty-state-msg">Sin equipos registrados.<br>Agrega inversor, microinversor o cargador.</p>
       <button class="empty-state-cta" onclick="document.getElementById('form-equipo')?.scrollIntoView({behavior:'smooth'})">+ Agregar equipo</button></div>`
    : '<p class="empty-msg-sm">Sin equipos registrados.</p>';
  return equipos.map((eq, i) => `
    <div class="equipo-card">
      <div class="eq-header">
        <span class="eq-marca">${esc(eq.marca)}</span>
        <span class="eq-modelo">${esc(eq.modelo)}</span>
        ${admin ? `<button class="btn-del-sm" onclick="delEquipo('${projectId}',${i})">✕</button>` : ''}
      </div>
      <div class="eq-serial">
        ${icon('barcode')}
        <span>${esc(eq.serial || '—')}</span>
      </div>
      <div class="eq-fotos">
        ${fotoMini(eq.fotoPlaca, 'Placa S/N')}
        ${fotoMini(eq.fotoFrontal, 'Frontal')}
        ${fotoMini(eq.fotoAngulo, 'Ángulo')}
      </div>
      ${eq.notas ? `<p class="eq-notas">${esc(eq.notas)}</p>` : ''}
    </div>
  `).join('');
}

function formEquipo(projectId) {
  return `
    <h3 class="card-title">Agregar equipo</h3>
    <div class="form-group">
      <label>Marca *</label>
      <select id="eq-marca">
        ${MARCAS_EQUIPOS.map(m => `<option>${m}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Modelo *</label>
      <input type="text" id="eq-modelo" placeholder="Ej: LXP-5K-48" />
    </div>
    <div class="form-group">
      <label>Número de serie</label>
      <div class="serial-row">
        <input type="text" id="eq-serial" placeholder="Escribe o escanea el serial" />
        <button type="button" class="btn-icon" onclick="scanSerial()" title="Escanear con cámara">
          ${icon('barcode')}
        </button>
      </div>
    </div>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-eq-placa">
        <button class="btn-foto-sm" onclick="capEqFoto('placa','slot-eq-placa')">
          ${icon('camera')} Placa S/N
        </button>
      </div>
      <div class="foto-cap-slot" id="slot-eq-frontal">
        <button class="btn-foto-sm" onclick="capEqFoto('frontal','slot-eq-frontal')">
          ${icon('camera')} Frontal
        </button>
      </div>
      <div class="foto-cap-slot" id="slot-eq-angulo">
        <button class="btn-foto-sm" onclick="capEqFoto('angulo','slot-eq-angulo')">
          ${icon('camera')} Ángulo
        </button>
      </div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <textarea id="eq-notas" rows="2" placeholder="Observaciones opcionales…"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-outline btn-sm" onclick="document.getElementById('form-equipo').style.display='none'">Cancelar</button>
      <button class="btn-primary btn-sm" onclick="guardarEquipo('${projectId}')">Guardar equipo</button>
    </div>
  `;
}

const _eqFotos = {};
window.capEqFoto = function(tipo, slotId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    const url = await uploadPhoto(b64, `projects/equipo_${tipo}_${Date.now()}.jpg`);
    _eqFotos[tipo] = url;
    const slot = document.getElementById(slotId);
    slot.innerHTML = fotoMini(url, tipo);
  });
};

window.scanSerial = function() {
  scanOnce(
    (code) => { document.getElementById('eq-serial').value = code; toast('Serial escaneado'); },
    () => {}
  );
};

window.showFormEquipo = function(projectId) {
  const form = document.getElementById('form-equipo');
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

window.guardarEquipo = async function(projectId) {
  const marca  = document.getElementById('eq-marca').value;
  const modelo = document.getElementById('eq-modelo').value.trim();
  if (!modelo) { toast('El modelo es requerido','error'); return; }

  const equipo = {
    id: uuid(),
    marca, modelo,
    serial:      document.getElementById('eq-serial').value.trim(),
    fotoPlaca:   _eqFotos.placa   || null,
    fotoFrontal: _eqFotos.frontal || null,
    fotoAngulo:  _eqFotos.angulo  || null,
    notas:       document.getElementById('eq-notas').value.trim(),
    createdAt:   isoNow(),
  };

  const p = await projects.getById(projectId);
  p.garantia = p.garantia || {};
  p.garantia.equipos = [...(p.garantia.equipos || []), equipo];
  await projects.update(projectId, { garantia: p.garantia });
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
  toast('✅ Equipo registrado');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delEquipo = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este equipo?')) return;
  const p = await projects.getById(projectId);
  p.garantia.equipos = p.garantia.equipos.filter((_,i) => i !== idx);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1D Estructura ─────────────────────────────────────────────────────────────
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
  const paneles         = cfg.layout?.totalPanels || '—';
  const modelo          = cfg.panel?.model || (cfg.panel?.width ? `${cfg.panel.width}×${cfg.panel.height} m` : '—');
  const rows            = cfg.layout?.rowsData || [];
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

function renderEstructura(est, projectId, edit, cfg) {
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
        <div class="meta-item"><span class="meta-lbl">Lote</span><span class="meta-val">${esc(est.numLote||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Metros riel</span><span class="meta-val">${est.metrosRiel||'—'} m</span></div>
        <div class="meta-item"><span class="meta-lbl">Fijación</span><span class="meta-val">${esc(est.tipoFijacion||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Mid-clamps</span><span class="meta-val">${est.midClamps||0} pzas</span></div>
        <div class="meta-item"><span class="meta-lbl">End-clamps</span><span class="meta-val">${est.endClamps||0} pzas</span></div>
      </div>
      <div class="eq-fotos">
        ${fotoMini(est.fotoEtiqueta,'Etiqueta lote')}
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
  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}/garantia')">${icon('caret-left')}</button>
    <h1 class="hdr-title">Estructura de montaje</h1>
  </div>
  <form class="form-card" onsubmit="guardarEstructura(event,'${projectId}')">
    <div class="form-group"><label>Marca *</label>
      <select name="marca">${MARCAS_ESTRUCTURA.map(m=>`<option ${est.marca===m?'selected':''}>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Sistema estructural</label>
      <select name="sistemaEstructural">${SISTEMAS_ESTRUCTURALES.map(s=>`<option ${est.sistemaEstructural===s?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Modelo / Referencia</label>
      <input type="text" name="modelo" value="${esc(est.modelo||'')}" /></div>
    <div class="form-group"><label>Número de lote</label>
      <div class="serial-row">
        <input type="text" name="numLote" id="est-lote" value="${esc(est.numLote||'')}" />
        <button type="button" class="btn-icon" onclick="capEqFoto('etiqueta','slot-est-etiq')">${icon('camera')}</button>
      </div>
      <div id="slot-est-etiq">${fotoMini(est.fotoEtiqueta,'Etiqueta lote')}</div>
    </div>
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

window.guardarEstructura = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = await projects.getById(projectId);
  p.garantia.estructura = {
    marca:             fd.get('marca'),
    sistemaEstructural:fd.get('sistemaEstructural'),
    modelo:            fd.get('modelo').trim(),
    numLote:           fd.get('numLote').trim(),
    metrosRiel:        parseFloat(fd.get('metrosRiel'))||0,
    tipoFijacion:      fd.get('tipoFijacion'),
    midClamps:         parseInt(fd.get('midClamps'))||0,
    endClamps:         parseInt(fd.get('endClamps'))||0,
    fotoEtiqueta:      _eqFotos.etiqueta || p.garantia.estructura?.fotoEtiqueta || null,
    fotoFrontal:       _eqFotos.frontal  || p.garantia.estructura?.fotoFrontal  || null,
    fotoAngulo:        _eqFotos.angulo   || p.garantia.estructura?.fotoAngulo   || null,
    notas:             fd.get('notas').trim(),
  };
  await projects.update(projectId, { garantia: p.garantia });
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
  toast('✅ Estructura guardada');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1E Paneles + escaneo continuo ────────────────────────────────────────────
function renderPaneles(paneles, projectId, edit) {
  const totalPaneles = (paneles.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  const totalKwp     = totalPaneles * ((paneles.wp||0)/1000);

  return `
  <div class="card">
    <h3 class="card-title">1E · Paneles solares</h3>
    <div class="form-row">
      <div class="form-group">
        <label>Marca</label>
        <input type="text" id="panel-marca" value="${esc(paneles.marca||'')}" placeholder="Ej: Jinko" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Modelo</label>
        <input type="text" id="panel-modelo" value="${esc(paneles.modelo||'')}" placeholder="Ej: Tiger Neo" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Potencia (Wp)</label>
        <input type="number" id="panel-wp" value="${paneles.wp||''}" min="1" ${!edit?'disabled':''} />
      </div>
    </div>
    ${edit ? `<button class="btn-outline btn-sm" onclick="guardarInfoPanel('${projectId}')">Guardar info del panel</button>` : ''}

    <div class="panel-stats">
      <span><strong>${totalPaneles}</strong> paneles registrados</span>
      <span><strong>${totalKwp.toFixed(2)}</strong> kWp instalado</span>
    </div>
  </div>

  <div class="card-title-row">
    <h3 class="card-title">Strings (${(paneles.strings||[]).length})</h3>
    ${edit ? `<button class="btn-primary btn-sm" onclick="agregarString('${projectId}')">+ String</button>` : ''}
  </div>

  ${(paneles.strings||[]).map((str,si) => renderString(str, si, projectId, edit)).join('')}
  `;
}

function renderString(str, idx, projectId, edit) {
  return `
  <div class="string-card">
    <div class="string-header">
      <span class="string-nombre">${esc(str.nombre)} (${str.paneles?.length||0} paneles)</span>
      <div class="string-actions">
        ${edit ? `
          <button class="btn-icon-sm" onclick="startScanString('${projectId}',${idx})" title="Escaneo continuo">
            ${icon('barcode')}
          </button>
          <button class="btn-icon-sm" onclick="addPanelManual('${projectId}',${idx})" title="Agregar manual">
            ${icon('plus')}
          </button>
          <button class="btn-del-sm" onclick="delString('${projectId}',${idx})">✕</button>
        ` : ''}
      </div>
    </div>

    <!-- Viewport del scanner continuo para este string -->
    <div id="scanner-${idx}" class="scanner-cont-container" style="display:none"></div>

    <div class="panel-list" id="panels-${idx}">
      ${(str.paneles||[]).map((pan,pi) => `
        <div class="panel-row">
          <span class="panel-letra">${pan.letra}</span>
          <span class="panel-serial ${!pan.serial?'panel-serial-empty':''}">${esc(pan.serial||'— sin serial')}</span>
          ${fotoMini(pan.fotoRespaldo,'Foto código')}
          ${edit ? `<button class="btn-del-sm" onclick="delPanel('${projectId}',${idx},${pi})">✕</button>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
  `;
}

window.guardarInfoPanel = async function(projectId) {
  const p = await projects.getById(projectId);
  p.garantia.paneles.marca  = document.getElementById('panel-marca').value.trim();
  p.garantia.paneles.modelo = document.getElementById('panel-modelo').value.trim();
  p.garantia.paneles.wp     = parseFloat(document.getElementById('panel-wp').value)||0;
  await projects.update(projectId, { garantia: p.garantia });
  toast('✅ Info del panel guardada');
};

window.agregarString = async function(projectId) {
  const p = await projects.getById(projectId);
  const n = (p.garantia.paneles.strings||[]).length + 1;
  p.garantia.paneles.strings = [...(p.garantia.paneles.strings||[]), { nombre:`String ${n}`, paneles:[] }];
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
  // Switch to paneles tab after re-render
  setTimeout(() => {
    const tabs = document.getElementById('garantia-tabs');
    if (tabs) {
      const panelesTab = tabs.querySelector('[data-tab="g-paneles"]');
      if (panelesTab) panelesTab.click();
    }
  }, 200);
};

window.delString = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este string y todos sus paneles?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings.splice(idx,1);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Escaneo continuo de paneles ───────────────────────────────────────────────
let _activeScanStringIdx = -1;

window.startScanString = async function(projectId, stringIdx) {
  const containerId = `scanner-${stringIdx}`;
  const container = document.getElementById(containerId);

  if (_activeScanStringIdx === stringIdx) {
    // Detener
    stopScanner();
    container.style.display = 'none';
    _activeScanStringIdx = -1;
    return;
  }

  // Cerrar cualquier scanner activo
  if (_activeScanStringIdx >= 0) {
    stopScanner();
    document.getElementById(`scanner-${_activeScanStringIdx}`).style.display = 'none';
  }

  _activeScanStringIdx = stringIdx;
  container.style.display = 'block';

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  startContinuousScan(containerId, async (serial) => {
    const p = await projects.getById(projectId);
    const str = p.garantia.paneles.strings[stringIdx];
    const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;

    str.paneles.push({ letra: nextLetra, serial, fotoRespaldo: null, createdAt: isoNow() });
    await projects.update(projectId, { garantia: p.garantia });

    // Actualizar lista en UI sin re-render completo
    const listEl = document.getElementById(`panels-${stringIdx}`);
    if (listEl) {
      const pi = str.paneles.length - 1;
      const pan = str.paneles[pi];
      const row = document.createElement('div');
      row.className = 'panel-row';
      row.innerHTML = `
        <span class="panel-letra">${pan.letra}</span>
        <span class="panel-serial">${esc(pan.serial)}</span>
        <button class="btn-del-sm" onclick="delPanel('${projectId}',${stringIdx},${pi})">✕</button>
      `;
      listEl.appendChild(row);
    }
    // Actualizar contador del string
    const header = document.querySelector(`#panels-${stringIdx}`)?.previousElementSibling?.previousElementSibling;
    if (header) {
      header.querySelector('.string-nombre').textContent =
        `String ${stringIdx+1} (${str.paneles.length} paneles)`;
    }
  }, () => {});
};

window.addPanelManual = async function(projectId, stringIdx) {
  const serial = await inputDialog('Número de serie del panel:');
  if (serial === null) return;
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const p = await projects.getById(projectId);
  const str = p.garantia.paneles.strings[stringIdx];
  const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
  str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delPanel = async function(projectId, stringIdx, panelIdx) {
  if (!await confirmDialog('¿Eliminar este panel?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings[stringIdx].paneles.splice(panelIdx,1);
  await projects.update(projectId, { garantia: p.garantia });
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
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
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
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
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

// ── Tab switcher ───────────────────────────────────────────────────────────────
window.switchTab = function(tabBarId, targetId, btn) {
  const bar = document.getElementById(tabBarId);
  bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  btn.classList.add('tab-active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel-active'));
  const target = document.getElementById(targetId);
  if (target) target.classList.add('tab-panel-active');
  // Detener scanner si cambia de tab
  if (_activeScanStringIdx >= 0) {
    stopScanner();
    const sc = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (sc) sc.style.display = 'none';
    _activeScanStringIdx = -1;
  }
};
