// doc-sitio.js — Progreso de obra: renderSitio, fotos de cierre y foto-handlers de sitio
// Extraído de documentacion.js para reducir su tamaño (>2000 líneas)

import { projects }                                    from './db.js';
import { esc, fotoMini, capturePhoto, toast, uuid,
         isoNow, confirmDialog, inputDialog,
         uploadProgressBar, getFotosTecnicas }         from './utils.js';
import { uploadPhotoQueued }                           from './firebase.js';
import { icon }                                        from './icons.js';

// ── Mapeo sitio → tab ID  (también usado en documentacion.js) ────────────────
export const SITIO_TAB = {
  techo:          'd-techo',
  centrosCarga:   'd-centros',
  zonaDelSistema: 'd-zona',
};

// ── Slots técnicos de cierre por sitio ───────────────────────────────────────
const SLOTS_CIERRE_SITIO = {
  centrosCarga: [
    { key:'tableroAC',          label:'Tablero AC terminado',    req:true  },
    { key:'tableroDC',          label:'Tablero DC terminado',    req:true  },
    { key:'protecciones',       label:'Protecciones instaladas', req:false },
    { key:'puestaATierra',      label:'Puesta a tierra',         req:false },
  ],
  zonaDelSistema: [
    { key:'inversorEnergizado', label:'Inversor energizado',     req:true  },
    { key:'etiquetado',         label:'Etiquetado',              req:false },
  ],
};

function _sitioForFTKey(key) {
  return SLOTS_CIERRE_SITIO.centrosCarga.some(s => s.key === key) ? 'centrosCarga' : 'zonaDelSistema';
}

export function _countCierreExtra(project, sitio) {
  const g = project.garantia || {};
  if (sitio === 'techo') {
    return (g.fotoSistema ? 1 : 0) + (g.fotosAdicionales || []).length;
  }
  return (SLOTS_CIERRE_SITIO[sitio] || []).reduce((s, slot) => s + getFotosTecnicas(g.fotosTecnicas, slot.key).length, 0);
}

// ── Bloque de cierre por sitio ────────────────────────────────────────────────
function renderCierreSitio(project, sitio, edit, projectId) {
  const g = project.garantia || {};

  if (sitio === 'techo') {
    return `
    <div class="card">
      <h3 class="card-title">Foto general del sistema <span class="req-badge">OBLIGATORIA</span></h3>
      <div class="foto-slot" id="slot-foto-sistema-doc">
        ${g.fotoSistema
          ? `${fotoMini(g.fotoSistema,'Foto general')}
             ${edit ? `<button class="btn-del-foto" onclick="delFotoSistemaDoc('${projectId}')">✕</button>` : ''}`
          : (edit ? `<div class="empty-state">
              <div class="empty-state-icon">📷</div>
              <p class="empty-state-msg">Foto general del sistema terminado.</p>
              <button class="empty-state-cta" onclick="capFotoSistemaDoc('${projectId}')">
                ${icon('camera')} Tomar foto</button>
             </div>` : '<p class="empty-msg-sm">Sin foto.</p>')}
      </div>
    </div>
    ${(g.fotosAdicionales || []).length ? `
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Fotos adicionales de cierre</h3>
        ${edit ? `<button class="btn-primary btn-sm" onclick="capFotoAdicionalDoc('${projectId}')">
          ${icon('camera')} Agregar</button>` : ''}
      </div>
      <div class="fotos-grid">
        ${(g.fotosAdicionales || []).map((f, i) => `
          <div class="foto-card">
            ${fotoMini(f.data, 'Foto '+(i+1))}
            ${f.nota ? `<p class="foto-nota">${esc(f.nota)}</p>` : ''}
            ${edit ? `
              <button class="btn-del-foto-abs" onclick="editFotoAdicionalDoc('${projectId}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoAdicionalDoc('${projectId}',${i})">✕</button>
            ` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  const slots = SLOTS_CIERRE_SITIO[sitio] || [];
  if (!slots.length) return '';
  return `
  <div class="card">
    <h3 class="card-title">Fotos técnicas de cierre</h3>
    ${slots.map(s => {
      const fotos = getFotosTecnicas(g.fotosTecnicas, s.key);
      const tiene = fotos.length > 0;
      return `
      <div class="foto-tecnica-row">
        <div class="ft-label">
          <ph-icon name="${tiene ? 'check-circle' : 'circle'}" class="${tiene ? 'icon-ok' : 'icon-pending'}"></ph-icon>
          ${s.label}
          ${s.req ? '<span class="req-badge">OBLIG.</span>' : ''}
          ${tiene ? `<span class="ft-count">${fotos.length}</span>` : ''}
        </div>
        <div class="ft-fotos-grid">
          ${fotos.map((f, i) => `
            <div class="ft-foto-item">
              ${fotoMini(f.url, s.label)}
              ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnicaDoc('${projectId}','${s.key}',${i})">✕</button>` : ''}
            </div>`).join('')}
          ${edit ? `<button class="btn-foto-sm ft-add-btn" onclick="capFotoTecnicaDoc('${projectId}','${s.key}')">
            ${icon('camera')} ${tiene ? '+' : 'Tomar'}
          </button>` : (!tiene ? '<span class="ft-empty">—</span>' : '')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function _gotoCierre(sitio) {
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', 'cierre');
}

// ── Handlers de fotos de cierre (guardan en garantia.*) ──────────────────────
window.capFotoSistemaDoc = function(projectId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotoSistema = result.url || null;
    if (result.pending) p.garantia._fotoSistemaPending = result.pendingId;
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre('techo');
    navigate(`#proyecto/${projectId}/documentacion`);
    if (!result.pending) toast('✅ Foto guardada');
  });
};

window.delFotoSistemaDoc = async function(projectId) {
  if (!await confirmDialog('¿Eliminar foto del sistema?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotoSistema = null;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.capFotoTecnicaDoc = function(projectId, key) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(projectId);
    p.garantia.fotosTecnicas = p.garantia.fotosTecnicas || {};
    const existentes = (() => {
      const v = p.garantia.fotosTecnicas[key];
      if (!v) return [];
      if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
      return Array.isArray(v) ? v : [];
    })();
    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i],
        `projects/${projectId}/tecnica_${key}_${fid}.jpg`, projectId, 'fotoTecnica', { key, itemId: fid });
      existentes.push({ url: result.url || null, id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }) });
    }
    prog.done();
    p.garantia.fotosTecnicas[key] = existentes;
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre(_sitioForFTKey(key));
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoTecnicaDoc = async function(projectId, key, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const v = p.garantia.fotosTecnicas[key];
  const fotos = typeof v === 'string' ? [{ url: v, id: 'legacy' }] : (Array.isArray(v) ? v : []);
  fotos.splice(idx, 1);
  p.garantia.fotosTecnicas[key] = fotos.length ? fotos : null;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre(_sitioForFTKey(key));
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.capFotoAdicionalDoc = function(projectId) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];
    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i],
        `projects/${projectId}/adicional_${fid}.jpg`, projectId, 'fotoAdicional', { itemId: fid });
      nuevas.push({ data: result.url || null,
        nota: '', id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }) });
    }
    prog.done();
    if (total === 1) nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotosAdicionales = [...(p.garantia.fotosAdicionales || []), ...nuevas];
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre('techo');
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoAdicionalDoc = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotosAdicionales.splice(idx, 1);
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.editFotoAdicionalDoc = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const actual = p.garantia.fotosAdicionales[idx]?.nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  p.garantia.fotosAdicionales[idx].nota = nueva;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

// ── Acordeón helper ───────────────────────────────────────────────────────────
window.toggleAcc = function(btn, bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = btn.classList.toggle('acc-open');
  body.classList.toggle('acc-collapsed', !isOpen);
};

// ── Render sitio (3 subfases: Antes / Durante / Cierre) ──────────────────────
export function renderSitio(project, sitio, edit, projectId) {
  const SUBFASES = [
    { id: 'antes',   ico: '📷', label: 'Antes',   hint: 'Referencia visual previa al trabajo' },
    { id: 'durante', ico: '🔧', label: 'Durante',  hint: 'Proceso y avances de instalación' },
    { id: 'cierre',  ico: '✅', label: 'Cierre',   hint: 'Estado final del sitio' },
  ];
  const fases = project.documentacion?.fases || {};

  const getFotos = (sub) => {
    if (fases?.[sitio]?.[sub]?.length) return fases[sitio][sub];
    if (sitio === 'techo') {
      const m = { antes:'antes', durante:'durante', cierre:'despues' };
      return fases?.[m[sub]] || [];
    }
    return [];
  };

  const cierreExtra = _countCierreExtra(project, sitio);

  return `
  <div class="subfase-bar" id="sfbar-${sitio}">
    ${SUBFASES.map((sf, idx) => {
      const cnt = getFotos(sf.id).length + (sf.id === 'cierre' ? cierreExtra : 0);
      return `<button class="subfase-btn ${idx===0?'sf-active':''}"
                      id="sf-btn-${sitio}-${sf.id}"
                      onclick="switchSubfase('${sitio}','${sf.id}',this)"
                      title="${sf.hint}">
        <span>${sf.ico} ${sf.label}</span>
        ${cnt ? `<span class="subfase-count">${cnt}</span>` : ''}
      </button>`;
    }).join('')}
  </div>
  ${SUBFASES.map((sf, idx) => {
    const fotos = getFotos(sf.id);
    return `
    <div id="sf-panel-${sitio}-${sf.id}" class="subfase-panel ${idx===0?'sf-active':''}">
      ${sf.id === 'cierre' ? renderCierreSitio(project, sitio, edit, projectId) : ''}
      ${renderFotosGrid(fotos, sitio, sf.id, sf.label, projectId, edit)}
    </div>`;
  }).join('')}`;
}

function renderFotosGrid(fotos, sitio, subfase, titulo, projectId, edit) {
  if (!fotos.length) {
    return edit ? `
    <div class="empty-state">
      <div class="empty-state-icon">📷</div>
      <p class="empty-state-msg">Sin fotos de <strong>${titulo}</strong> aún.</p>
      <button class="empty-state-cta" onclick="agregarFotoSitio('${projectId}','${sitio}','${subfase}')">
        ${icon('camera')} Agregar fotos
      </button>
    </div>` : `<p class="empty-msg-sm">Sin fotos aún.</p>`;
  }
  return `
  <div class="fotos-grid-header">
    ${edit ? `<button class="btn-sm btn-outline" onclick="agregarFotoSitio('${projectId}','${sitio}','${subfase}')">
      ${icon('camera')} + Agregar fotos
    </button>` : ''}
  </div>
  <div class="fotos-grid" id="fotos-${sitio}_${subfase}">
    ${fotos.map((f,i)=>`
      <div class="foto-card">
        ${fotoMini(f.data,`Foto ${i+1}`)}
        ${f.nota?`<p class="foto-nota">${esc(f.nota)}</p>`:''}
        ${edit?`
          <button class="btn-del-foto-abs" onclick="editFotoNotaSitio('${projectId}','${sitio}','${subfase}',${i})">✎</button>
          <button class="btn-del-foto" onclick="delFotoSitio('${projectId}','${sitio}','${subfase}',${i})">✕</button>
        `:''}
      </div>`).join('')}
  </div>`;
}

// ── Navegación de subfases ────────────────────────────────────────────────────
window.switchSitio = function(sitio, btn) {
  document.querySelectorAll('.sitio-btn').forEach(b => b.classList.remove('sitio-active'));
  btn.classList.add('sitio-active');
  document.querySelectorAll('.sitio-panel').forEach(p => p.classList.remove('sitio-panel-active'));
  const panel = document.getElementById(`sitio-panel-${sitio}`);
  if (panel) panel.classList.add('sitio-panel-active');
};

window.switchSubfase = function(sitio, subfase, btn) {
  const bar = document.getElementById(`sfbar-${sitio}`);
  bar?.querySelectorAll('.subfase-btn').forEach(b => b.classList.remove('sf-active'));
  btn.classList.add('sf-active');
  const panelContainer = document.getElementById(`sitio-panel-${sitio}`);
  panelContainer?.querySelectorAll('.subfase-panel').forEach(p => p.classList.remove('sf-active'));
  const panel = document.getElementById(`sf-panel-${sitio}-${subfase}`);
  if (panel) panel.classList.add('sf-active');
};

function _ensureFasesSitio(p, sitio, subfase) {
  p.documentacion = p.documentacion || {};
  p.documentacion.fases = p.documentacion.fases || {};
  p.documentacion.fases[sitio] = p.documentacion.fases[sitio] || {};
  p.documentacion.fases[sitio][subfase] = p.documentacion.fases[sitio][subfase] || [];
  return p.documentacion.fases[sitio][subfase];
}

// ── Handlers de fotos de sitio (fases: antes / durante / cierre) ─────────────
window.agregarFotoSitio = function(projectId, sitio, subfase) {
  capturePhoto(async (b64Array, _files, fileMeta) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog  = uploadProgressBar(total);
    const nuevas = [];

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(
        fotos[i], `projects/${projectId}/${sitio}_${subfase}_${fid}.jpg`,
        projectId, 'fotoFase', { sitio, subfase, itemId: fid }
      );
      nuevas.push({
        data: result.url || null,
        nota: '', id: fid, createdAt: isoNow(),
        fuente: fileMeta?.fuente || 'camera',
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    if (total === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }

    const p = await projects.getById(projectId);
    const arr = _ensureFasesSitio(p, sitio, subfase);
    arr.push(...nuevas);
    await projects.update(projectId, { documentacion: p.documentacion });

    sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
    sessionStorage.setItem('doc-subfa-target', subfase);
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true, projectId, fase: sitio, campo: subfase });
};

window.delFotoSitio = async function(projectId, sitio, subfase, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const arr = p.documentacion?.fases?.[sitio]?.[subfase];
  if (arr) {
    arr.splice(idx, 1);
  } else if (sitio === 'techo') {
    const m = { antes:'antes', durante:'durante', cierre:'despues' };
    (p.documentacion.fases[m[subfase]] || []).splice(idx, 1);
  }
  await projects.update(projectId, { documentacion: p.documentacion });
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', subfase);
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.editFotoNotaSitio = async function(projectId, sitio, subfase, idx) {
  const p = await projects.getById(projectId);
  const arr = p.documentacion?.fases?.[sitio]?.[subfase]
    || (sitio==='techo' ? p.documentacion?.fases?.[ {antes:'antes',durante:'durante',cierre:'despues'}[subfase] ] : null)
    || [];
  const actual = arr[idx]?.nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  if (arr[idx]) arr[idx].nota = nueva;
  await projects.update(projectId, { documentacion: p.documentacion });
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', subfase);
  navigate(`#proyecto/${projectId}/documentacion`);
};
