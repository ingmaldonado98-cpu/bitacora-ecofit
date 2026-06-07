// garantia.js — Módulo 1: Garantía (fotos técnicas, equipos, estructura, paneles)

import { projects, logChange } from './db.js';
import { esc, fmtFechaHora, fotoMini, capturePhoto, compressImage, toast, confirmDialog, inputDialog,
         uploadProgressBar, uuid, isoNow, MARCAS_EQUIPOS, MARCAS_ESTRUCTURA, SISTEMAS_ESTRUCTURALES, TIPOS_FIJACION,
         openScannerOverlay } from './utils.js';
import { canEdit, isAdmin, isLider, getSession } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';
import { scanOnce, startContinuousScan, stopScanner } from './scanner.js';

// ── Vista principal del módulo ─────────────────────────────────────────────────
export async function renderGarantia(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const g = project.garantia || {};
  _clearEqFotos(); // limpiar fotos temporales de sesiones anteriores

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Garantía</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <!-- Tabs internos — General movido a Documentación > Cierre -->
  <div class="garantia-notice card" style="margin-bottom:8px;padding:10px 14px;border-color:var(--border2)">
    <span style="color:var(--text-muted);font-size:.82rem">
      ${icon('info', 14)} La foto general y fotos técnicas de cierre están en
      <button class="btn-link" onclick="navigate('#proyecto/${projectId}/documentacion')">
        Documentación → Cierre
      </button>
    </span>
  </div>

  <div class="tab-bar" id="garantia-tabs">
    <button class="tab-btn tab-active" data-tab="g-equipos"   onclick="switchTab('garantia-tabs','g-equipos',this)">Equipos</button>
    <button class="tab-btn" data-tab="g-voc"                  onclick="switchTab('garantia-tabs','g-voc',this)">
      Voc${(() => { const v = project.garantia?.validacionVoc; return v ? `<span class="tab-badge ${v.resultado==='seguro'?'tab-ok':v.resultado==='excede'?'tab-err':''}">${v.resultado==='seguro'?'✓':v.resultado==='excede'?'⚠':'~'}</span>` : ''; })()}
    </button>
    <button class="tab-btn" data-tab="g-estructura"           onclick="switchTab('garantia-tabs','g-estructura',this)">Estructura</button>
    <button class="tab-btn" data-tab="g-paneles"              onclick="switchTab('garantia-tabs','g-paneles',this)">Paneles</button>
    <button class="tab-btn" data-tab="g-notas"                onclick="switchTab('garantia-tabs','g-notas',this)">
      Notas${(g.notas||[]).length ? `<span class="tab-badge tab-ok">${(g.notas||[]).length}</span>` : ''}
    </button>
  </div>

  <!-- Equipos — ahora es el tab activo por defecto -->
  <div id="g-equipos" class="tab-panel tab-panel-active">
    <div class="card-title-row" style="padding:0 0 12px">
      <h3 class="card-title">Equipos instalados (${(g.equipos||[]).length})</h3>
      ${edit ? `<button class="btn-primary btn-sm" onclick="showFormEquipo('${projectId}')">+ Equipo</button>` : ''}
    </div>
    <div id="lista-equipos">
      ${renderEquipos(g.equipos || [], projectId, edit, isAdmin(session))}
    </div>
    <div id="form-equipo" style="display:none" class="card">
      ${formEquipo(projectId)}
    </div>
  </div>

  <!-- Validación Voc -->
  <div id="g-voc" class="tab-panel">
    ${renderVocTab(project, projectId, edit)}
  </div>

  <!-- 1D: Estructura -->
  <div id="g-estructura" class="tab-panel">
    <div class="card">
      <h3 class="card-title">Estructura de montaje</h3>
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
  ${(isAdmin(session) || isLider(session)) ? (() => {
    const firma = project.fases?.firmas?.gar;
    return `
  <div class="fase-firma-wrap">
    ${firma
      ? `<div class="fase-firma-ok">
           ${icon('seal-check', 16)} Garantía firmada por <b>${esc(firma.nombre || firma.firmado_por)}</b>
           <span class="fase-firma-fecha">${fmtFechaHora(firma.firmado_en)}</span>
         </div>`
      : `<button class="btn-firma-fase" onclick="window._firmarFase('${projectId}','gar')">
           ${icon('signature', 16)} Firmar Garantía
         </button>`
    }
  </div>`;
  })() : ''}

  <script>
    (function() {
      const target = sessionStorage.getItem('garantia-tab-target');
      if (target) {
        sessionStorage.removeItem('garantia-tab-target');
        const bar = document.getElementById('garantia-tabs');
        const btn = bar?.querySelector('[data-tab="' + target + '"]');
        if (btn) btn.click();
      }
    })();
  </script>
  `;
}

// ── Validación Voc ────────────────────────────────────────────────────────────
function renderVocTab(project, projectId, edit) {
  const g       = project.garantia || {};
  const inversor = (g.equipos || []).find(e => e.tipo === 'inversor');
  const vd       = g.validacionVoc || {};

  const vocMaxPre   = inversor?.vocMax  || vd.vocMaxInversor || '';
  const vocPanel    = vd.vocPanel    || '';
  const panelesSerie= vd.panelesSerie || '';
  const tMin        = vd.tMin        ?? -5;
  const coefVoc     = vd.coefVoc     ?? -0.29;
  const resultado   = vd.resultado;

  const semaforo = resultado === 'seguro'  ? { cls: 'voc-ok',   ico: '🟢', txt: 'Configuración segura' }
                 : resultado === 'limite'  ? { cls: 'voc-warn', ico: '🟡', txt: 'En el límite — sin margen' }
                 : resultado === 'excede'  ? { cls: 'voc-err',  ico: '🔴', txt: 'Excede el límite del inversor' }
                 : null;

  return `
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Validación Voc de string</h3>
      ${semaforo ? `<span class="voc-badge ${semaforo.cls}">${semaforo.ico} ${semaforo.txt}</span>` : ''}
    </div>
    ${inversor
      ? inversor.vocMax
        ? `<p class="voc-inversor-hint">${icon('cpu', 14)} Inversor detectado: <b>${esc(inversor.marca)} ${esc(inversor.modelo)}</b> · Voc máx: <b>${inversor.vocMax} V</b></p>`
        : `<div class="voc-no-inversor">${icon('warning-circle', 16)}
            <div>
              <strong>Inversor sin Voc máx registrado</strong><br>
              <span>Edita el inversor en la pestaña <em>Equipos</em> y completa el campo "Voc máx. inversor".<br>
              Sin este dato el cálculo usa el valor ingresado manualmente y no queda vinculado al equipo real.</span>
            </div>
           </div>`
      : `<div class="voc-no-inversor">${icon('warning-circle', 16)}
           <div>
             <strong>Sin inversor registrado</strong><br>
             <span>Agrega un inversor en la pestaña <em>Equipos</em> antes de validar el Voc.
             Sin inversor registrado el cálculo no queda vinculado a ningún equipo y no podrás firmar la Garantía con advertencias pendientes.</span>
           </div>
         </div>`
    }
    <div class="form-row">
      <div class="form-group">
        <label>Voc del panel (V)</label>
        <input type="number" id="voc-panel" step="0.1" min="0" placeholder="Ej: 41.2"
               value="${vocPanel}" ${!edit?'disabled':''} oninput="calcVoc()" />
      </div>
      <div class="form-group">
        <label>Paneles en serie</label>
        <input type="number" id="voc-serie" step="1" min="1" max="30" placeholder="Ej: 10"
               value="${panelesSerie}" ${!edit?'disabled':''} oninput="calcVoc()" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Temp. mínima sitio (°C)</label>
        <input type="number" id="voc-tmin" step="1" placeholder="-5"
               value="${tMin}" ${!edit?'disabled':''} oninput="calcVoc()" />
      </div>
      <div class="form-group">
        <label>Coef. temp. Voc (%/°C)</label>
        <input type="number" id="voc-coef" step="0.01" placeholder="-0.29"
               value="${coefVoc}" ${!edit?'disabled':''} oninput="calcVoc()" />
      </div>
    </div>
    <div class="form-group">
      <label>Voc máx. inversor (V)</label>
      <input type="number" id="voc-max-inv" step="1" min="0"
             placeholder="${inversor?.vocMax ? inversor.vocMax : 'Ej: 600'}"
             value="${vocMaxPre}" ${!edit?'disabled':''} oninput="calcVoc()" />
    </div>

    <!-- Resultado en tiempo real -->
    <div id="voc-resultado" class="voc-resultado" style="${resultado ? '' : 'display:none'}">
      <div class="voc-res-row"><span>Voc corregido por temp.</span><strong id="voc-r-corr">${vd.vocCorregido?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Voc del string completo</span><strong id="voc-r-str">${vd.vocString?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Margen de seguridad</span><strong id="voc-r-margen">${vd.margen != null ? vd.margen.toFixed(1) + '%' : '—'}</strong></div>
      <div id="voc-r-msg" class="voc-res-msg ${semaforo?.cls || ''}">${semaforo ? semaforo.ico + ' ' + (vd.mensaje || semaforo.txt) : ''}</div>
    </div>

    ${edit ? `
    <div class="form-actions" style="margin-top:12px">
      <button class="btn-outline btn-sm" onclick="calcVoc()">Calcular</button>
      <button class="btn-primary btn-sm" onclick="guardarVoc('${projectId}')">Guardar resultado</button>
    </div>` : ''}
  </div>`;
}

// Clave para la calc: lee los campos y muestra el resultado en tiempo real
window.calcVoc = function() {
  const vocP   = parseFloat(document.getElementById('voc-panel')?.value)   || 0;
  const serie  = parseInt(document.getElementById('voc-serie')?.value)      || 0;
  const tMin   = parseFloat(document.getElementById('voc-tmin')?.value)     ?? -5;
  const coef   = parseFloat(document.getElementById('voc-coef')?.value)     ?? -0.29;
  const vocMax = parseFloat(document.getElementById('voc-max-inv')?.value)  || 0;

  if (!vocP || !serie || !vocMax) return;

  const vocCorr  = vocP * (1 + (coef / 100) * (tMin - 25));
  const vocStr   = vocCorr * serie;
  const margen   = ((vocMax - vocStr) / vocMax) * 100;
  const maxSerie = Math.floor(vocMax * 0.90 / vocCorr);

  let resultado, mensaje;
  if (vocStr <= vocMax * 0.90)    { resultado = 'seguro'; mensaje = `✅ Seguro. Margen: ${margen.toFixed(1)}%. Máximo recomendado: ${maxSerie} paneles en serie.`; }
  else if (vocStr <= vocMax)       { resultado = 'limite'; mensaje = `⚠️ En el límite (${margen.toFixed(1)}% de margen). Considera reducir 1 panel en serie.`; }
  else                             { resultado = 'excede'; mensaje = `🚨 Excede el límite por ${(vocStr - vocMax).toFixed(1)} V. Máximo seguro: ${maxSerie} paneles en serie.`; }

  const wrap = document.getElementById('voc-resultado');
  if (wrap) {
    wrap.style.display = '';
    document.getElementById('voc-r-corr').textContent   = vocCorr.toFixed(2) + ' V';
    document.getElementById('voc-r-str').textContent    = vocStr.toFixed(2)  + ' V';
    document.getElementById('voc-r-margen').textContent = margen.toFixed(1)  + '%';
    const msg = document.getElementById('voc-r-msg');
    msg.textContent  = mensaje;
    msg.className    = `voc-res-msg ${resultado === 'seguro' ? 'voc-ok' : resultado === 'limite' ? 'voc-warn' : 'voc-err'}`;
  }

  // Guardar en estado temporal para persistir
  window._vocTemp = { vocPanel: vocP, panelesSerie: serie, tMin, coefVoc: coef,
    vocMaxInversor: vocMax, vocCorregido: vocCorr, vocString: vocStr, margen, resultado, mensaje };
};

window.guardarVoc = async function(projectId) {
  if (!window._vocTemp) { toast('Primero calcula el Voc', 'warn'); return; }

  // ── Critical #3: Validar consistencia con el inversor registrado ───────────
  const proj     = await projects.getById(projectId);
  const inversor = (proj?.garantia?.equipos || []).find(e => e.tipo === 'inversor');
  const savedVocMax = window._vocTemp.vocMaxInversor;

  if (!inversor) {
    // No hay inversor — advertir y pedir confirmación
    const ok = await confirmDialog(
      '⚠️ Sin inversor registrado. El Voc máximo fue ingresado manualmente y no quedará vinculado a ningún equipo real. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  } else if (!inversor.vocMax || inversor.vocMax === 0) {
    // Hay inversor pero sin vocMax — bloquear
    toast('El inversor no tiene Voc máx registrado. Edítalo en la pestaña Equipos antes de guardar.', 'warn', 6000);
    return;
  } else if (Math.abs(inversor.vocMax - savedVocMax) > 0.5) {
    // El valor ingresado difiere del registrado en el equipo
    const ok = await confirmDialog(
      `⚠️ El inversor registrado tiene Voc máx = ${inversor.vocMax} V, pero se calculó con ${savedVocMax} V. ¿Guardar con el valor ingresado manualmente?`
    );
    if (!ok) return;
  }

  const data = { ...window._vocTemp, savedAt: isoNow(), savedBy: getSession()?.uid || '' };
  await projects.setField(projectId, 'garantia.validacionVoc', data);
  const resMsg = data.resultado === 'seguro' ? 'configuración segura'
               : data.resultado === 'excede' ? '⚠️ excede el límite'
               : 'en el límite';
  toast(`✅ Voc guardado — ${resMsg}`);
  sessionStorage.setItem('garantia-tab-target', 'g-voc');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1A Foto del sistema ────────────────────────────────────────────────────────
window.capturarFotoSistema = function(projectId) {
  capturePhoto(async (b64, _files, fileMeta) => {
    toast(navigator.onLine ? 'Subiendo foto…' : 'Sin conexión — foto guardada localmente');
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
    const slot = document.getElementById('slot-foto-sistema');
    const displaySrc = result.url || (result.pending ? b64 : '');
    slot.innerHTML = `${fotoMini(displaySrc,'Foto general')}<button class="btn-del-foto" onclick="delFotoGeneral('${projectId}')">✕</button>`;
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotoSistema = result.url || null;
    p.garantia.fotoSistemaFuente = fileMeta?.fuente || 'camera';
    if (result.pending) p.garantia._fotoSistemaPending = result.pendingId;
    await projects.update(projectId, { garantia: p.garantia });
    if (!result.pending) toast('✅ Foto guardada');
  }, { projectId, fase: 'cierre', campo: 'SistemaGeneral', preview: true });
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

// ── Tipos de equipo ────────────────────────────────────────────────────────────
const TIPOS_EQUIPO = [
  { value: '',              label: '— Seleccionar tipo —' },
  { value: 'inversor',      label: 'Inversor' },
  { value: 'microinversor', label: 'Microinversor' },
  { value: 'bateria',       label: 'Batería' },
  { value: 'controladora',  label: 'Controladora / MPPT' },
  { value: 'cargador',      label: 'Cargador' },
  { value: 'optimizador',   label: 'Optimizador de potencia' },
  { value: 'monitor',       label: 'Monitor / Gateway' },
  { value: 'otro',          label: 'Otro' },
];

// ── 1C Equipos ────────────────────────────────────────────────────────────────
function renderEquipos(equipos, projectId, edit, admin) {
  if (!equipos.length) return edit
    ? `<div class="empty-state"><div class="empty-state-icon">⚡</div>
       <p class="empty-state-msg">Sin equipos registrados.<br>Agrega inversor, batería, controladora…</p>
       <button class="empty-state-cta" onclick="showFormEquipo('${projectId}')">+ Agregar equipo</button></div>`
    : '<p class="empty-msg-sm">Sin equipos registrados.</p>';

  return equipos.map((eq, i) => {
    const tipoLabel = TIPOS_EQUIPO.find(t => t.value === eq.tipo)?.label || eq.tipo || '';
    return `
    <div class="equipo-card" id="eq-card-${i}">
      <div class="eq-header">
        <div class="eq-id-info">
          ${tipoLabel ? `<span class="eq-tipo-badge">${tipoLabel}</span>` : ''}
          <span class="eq-marca">${esc(eq.marca)}</span>
          <span class="eq-modelo">${esc(eq.modelo)}</span>
        </div>
        <div class="eq-actions">
          ${edit ? `<button class="btn-icon-sm" onclick="editarEquipo('${projectId}',${i})" title="Editar equipo">✎</button>` : ''}
          ${admin ? `<button class="btn-del-sm" onclick="delEquipo('${projectId}',${i})" title="Eliminar equipo">✕</button>` : ''}
        </div>
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
    </div>`;
  }).join('');
}

function formEquipo(projectId, eq = null, editIdx = -1) {
  const isEdit = editIdx >= 0 && eq;
  return `
    <h3 class="card-title">${isEdit ? 'Editar equipo' : 'Agregar equipo'}</h3>
    <input type="hidden" id="eq-editing-idx" value="${editIdx}" />
    <div class="form-row">
      <div class="form-group">
        <label>Tipo *</label>
        <select id="eq-tipo" onchange="toggleVocMaxField()">
          ${TIPOS_EQUIPO.map(t =>
            `<option value="${t.value}" ${(isEdit ? eq.tipo : '') === t.value ? 'selected' : ''}>${t.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Marca *</label>
        <select id="eq-marca">
          ${MARCAS_EQUIPOS.map(m => `<option ${(isEdit ? eq.marca : '') === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Modelo *</label>
      <input type="text" id="eq-modelo" placeholder="Ej: LXP-5K-48"
             value="${isEdit ? esc(eq.modelo) : ''}"
             oninput="toggleVocMaxField()" />
    </div>
    <!-- vocMax: solo para inversores -->
    <div class="form-group" id="eq-vocmax-wrap" style="${(isEdit ? eq.tipo : '') === 'inversor' ? '' : 'display:none'}">
      <label>Voc máx. entrada CD (V) <span class="form-hint">Del datasheet del inversor</span></label>
      <input type="number" id="eq-vocmax" placeholder="Ej: 600" step="1" min="0"
             value="${isEdit ? esc(eq.vocMax || '') : ''}" />
    </div>
    <div class="form-group">
      <label>Número de serie</label>
      <div class="serial-row">
        <input type="text" id="eq-serial" placeholder="Escribe o escanea el serial"
               value="${isEdit ? esc(eq.serial || '') : ''}" />
        <button type="button" class="btn-icon" onclick="scanSerial()" title="Escanear con cámara">
          ${icon('barcode')}
        </button>
      </div>
    </div>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-eq-placa">
        ${isEdit && eq.fotoPlaca
          ? fotoMini(eq.fotoPlaca, 'Placa S/N')
          : `<button class="btn-foto-sm" onclick="capEqFoto('placa','slot-eq-placa')">${icon('camera')} Placa S/N</button>`}
      </div>
      <div class="foto-cap-slot" id="slot-eq-frontal">
        ${isEdit && eq.fotoFrontal
          ? fotoMini(eq.fotoFrontal, 'Frontal')
          : `<button class="btn-foto-sm" onclick="capEqFoto('frontal','slot-eq-frontal')">${icon('camera')} Frontal</button>`}
      </div>
      <div class="foto-cap-slot" id="slot-eq-angulo">
        ${isEdit && eq.fotoAngulo
          ? fotoMini(eq.fotoAngulo, 'Ángulo')
          : `<button class="btn-foto-sm" onclick="capEqFoto('angulo','slot-eq-angulo')">${icon('camera')} Ángulo</button>`}
      </div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <textarea id="eq-notas" rows="2" placeholder="Observaciones opcionales…">${isEdit ? esc(eq.notas || '') : ''}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn-outline btn-sm" onclick="_cancelarFormEquipo()">Cancelar</button>
      <button class="btn-primary btn-sm" onclick="guardarEquipo('${projectId}')">
        ${isEdit ? 'Actualizar equipo' : 'Guardar equipo'}
      </button>
    </div>
  `;
}

const _eqFotos = {};

// Limpiar fotos temporales al navegar a la vista de garantía
function _clearEqFotos() {
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
}
window.capEqFoto = function(tipo, slotId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    // Usar un projectId genérico para fotos de equipo no vinculadas aún
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `projects/equipo_${tipo}_${fid}.jpg`,
      'equipo_temp', 'eqFoto', { tipo });
    _eqFotos[tipo] = result.url || b64; // fallback a b64 si está offline
    const slot = document.getElementById(slotId);
    if (slot) slot.innerHTML = fotoMini(_eqFotos[tipo], tipo);
    if (result.url) toast('✅ Foto guardada');
  });
};

// Mostrar/ocultar campo vocMax según tipo de equipo seleccionado
window.toggleVocMaxField = function() {
  const tipo = document.getElementById('eq-tipo')?.value;
  const wrap = document.getElementById('eq-vocmax-wrap');
  if (wrap) wrap.style.display = tipo === 'inversor' ? '' : 'none';
};

window.scanSerial = function() {
  openScannerOverlay(
    (code) => {
      const inp = document.getElementById('eq-serial');
      if (inp) { inp.value = code; inp.focus(); }
      toast(`✅ Serial escaneado: ${code}`);
    },
    { continuous: false, title: 'Escanear serial del equipo' }
  );
};

// scanLoteEstructura eliminado — campo Lote removido del formulario de estructura

window.showFormEquipo = function(projectId) {
  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId); // siempre limpio al abrir
  _clearEqFotos();
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

window.editarEquipo = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const eq = p.garantia.equipos[idx];
  if (!eq) return;
  // Pre-cargar fotos existentes en _eqFotos para que guardarEquipo las conserve
  _clearEqFotos();
  if (eq.fotoPlaca)   _eqFotos.placa   = eq.fotoPlaca;
  if (eq.fotoFrontal) _eqFotos.frontal = eq.fotoFrontal;
  if (eq.fotoAngulo)  _eqFotos.angulo  = eq.fotoAngulo;

  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId, eq, idx);
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

window._cancelarFormEquipo = function() {
  const form = document.getElementById('form-equipo');
  form.style.display = 'none';
  _clearEqFotos();
};

window.guardarEquipo = async function(projectId) {
  const tipo   = document.getElementById('eq-tipo').value;
  const marca  = document.getElementById('eq-marca').value;
  const modelo = document.getElementById('eq-modelo').value.trim();
  if (!tipo)   { toast('Selecciona el tipo de equipo', 'error'); return; }
  if (!modelo) { toast('El modelo es requerido', 'error'); return; }

  const editIdx = parseInt(document.getElementById('eq-editing-idx')?.value ?? '-1');
  const isEdit  = editIdx >= 0;

  const p = await projects.getById(projectId);
  p.garantia = p.garantia || {};
  p.garantia.equipos = p.garantia.equipos || [];

  const vocMaxRaw = document.getElementById('eq-vocmax')?.value?.trim();
  const equipo = {
    id:          isEdit ? (p.garantia.equipos[editIdx]?.id || uuid()) : uuid(),
    tipo, marca, modelo,
    ...(tipo === 'inversor' && vocMaxRaw ? { vocMax: parseFloat(vocMaxRaw) } : {}),
    serial:      document.getElementById('eq-serial').value.trim(),
    fotoPlaca:   _eqFotos.placa   || (isEdit ? p.garantia.equipos[editIdx]?.fotoPlaca   : null),
    fotoFrontal: _eqFotos.frontal || (isEdit ? p.garantia.equipos[editIdx]?.fotoFrontal : null),
    fotoAngulo:  _eqFotos.angulo  || (isEdit ? p.garantia.equipos[editIdx]?.fotoAngulo  : null),
    notas:       document.getElementById('eq-notas').value.trim(),
    createdAt:   isEdit ? (p.garantia.equipos[editIdx]?.createdAt || isoNow()) : isoNow(),
    updatedAt:   isoNow(),
  };

  let newEquipos;
  if (isEdit) {
    newEquipos = [...p.garantia.equipos];
    newEquipos[editIdx] = equipo;
    toast('✅ Equipo actualizado');
  } else {
    newEquipos = [...p.garantia.equipos, equipo];
    toast('✅ Equipo registrado');
  }

  // setField en lugar de update() — escribe solo garantia.equipos, no el doc completo
  await projects.setField(projectId, 'garantia.equipos', newEquipos);
  logChange(projectId, {
    modulo: 'Garantía',
    accion: isEdit ? 'equipo editado' : 'equipo agregado',
    detalle: `${equipo.tipo}: ${equipo.marca} ${equipo.modelo}`,
    quien: getSession(),
  });
  _clearEqFotos();
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delEquipo = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este equipo?')) return;
  const p = await projects.getById(projectId);
  const newEquipos = (p.garantia?.equipos || []).filter((_,i) => i !== idx);
  await projects.setField(projectId, 'garantia.equipos', newEquipos);
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
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

window.guardarEstructura = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = await projects.getById(projectId);
  p.garantia.estructura = {
    marca:             fd.get('marca'),
    sistemaEstructural:fd.get('sistemaEstructural'),
    modelo:            fd.get('modelo').trim(),
    // numLote eliminado (no se incluye en factura para identificación)
    metrosRiel:        parseFloat(fd.get('metrosRiel'))||0,
    tipoFijacion:      fd.get('tipoFijacion'),
    midClamps:         parseInt(fd.get('midClamps'))||0,
    endClamps:         parseInt(fd.get('endClamps'))||0,
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
    <h3 class="card-title">Paneles solares</h3>
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
  // Guardar target tab en sessionStorage para activarlo después del render
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
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
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Cerrar viejo scanner ZXing inline si estaba activo
  if (_activeScanStringIdx >= 0) {
    stopScanner();
    const old = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (old) old.style.display = 'none';
    _activeScanStringIdx = -1;
  }

  const strHeader = document.querySelector(`#scanner-${stringIdx}`)
    ?.closest('.string-card')
    ?.querySelector('.string-nombre')
    ?.textContent || `String ${stringIdx + 1}`;

  openScannerOverlay(
    async (serial) => {
      // Deduplicar: no agregar si el serial ya existe en este string
      const pCheck = await projects.getById(projectId);
      const strCheck = pCheck?.garantia?.paneles?.strings?.[stringIdx];
      if (strCheck?.paneles?.some(pan => pan.serial === serial)) {
        toast(`⚠ Serial ya registrado: ${serial}`, 'warning', 3000);
        return;
      }

      const p = await projects.getById(projectId);
      const str = p.garantia.paneles.strings[stringIdx];
      const nextLetra = letras[str.paneles.length] || `P${str.paneles.length + 1}`;

      str.paneles.push({ letra: nextLetra, serial, fotoRespaldo: null, createdAt: isoNow() });
      await projects.update(projectId, { garantia: p.garantia });

      // Actualizar lista en UI sin re-render completo
      const listEl = document.getElementById(`panels-${stringIdx}`);
      if (listEl) {
        const pi = str.paneles.length - 1;
        const row = document.createElement('div');
        row.className = 'panel-row';
        row.innerHTML = `
          <span class="panel-letra">${nextLetra}</span>
          <span class="panel-serial">${esc(serial)}</span>
          <button class="btn-del-sm" onclick="delPanel('${projectId}',${stringIdx},${pi})">✕</button>`;
        listEl.appendChild(row);
      }
      // Actualizar contador en el header del string
      const headerEl = document.querySelector(`#scanner-${stringIdx}`)
        ?.closest('.string-card')?.querySelector('.string-nombre');
      if (headerEl) {
        const p2 = await projects.getById(projectId);
        const count = p2?.garantia?.paneles?.strings?.[stringIdx]?.paneles?.length || 0;
        headerEl.textContent = `${strHeader.replace(/\(\d+.*\)/, '').trim()} (${count} paneles)`;
      }
      toast(`✅ Panel ${nextLetra}: ${serial}`);
    },
    {
      continuous: true,
      title: `Escanear paneles — ${strHeader}`,
      onClose: () => { _activeScanStringIdx = -1; }
    }
  );
  _activeScanStringIdx = stringIdx;
};

window.addPanelManual = async function(projectId, stringIdx) {
  // Mostrar modal de elección: escáner o texto manual
  const choice = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <p class="modal-confirm-msg">¿Cómo quieres agregar el panel?</p>
        <div class="modal-confirm-actions" style="flex-direction:column;gap:8px">
          <button class="btn-primary modal-btn-scan" style="width:100%">
            🔲 Escanear código de barras
          </button>
          <button class="btn-outline modal-btn-text" style="width:100%">
            ✏️ Escribir serial manualmente
          </button>
          <button class="btn-outline modal-btn-cancel" style="width:100%;color:var(--text-muted)">
            Cancelar
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-btn-scan').onclick   = () => { overlay.remove(); resolve('scan'); };
    overlay.querySelector('.modal-btn-text').onclick   = () => { overlay.remove(); resolve('text'); };
    overlay.querySelector('.modal-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
  });

  if (!choice) return;

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (choice === 'scan') {
    const strNombre = (await projects.getById(projectId))
      ?.garantia?.paneles?.strings?.[stringIdx]?.nombre || `String ${stringIdx + 1}`;
    openScannerOverlay(
      async (serial) => {
        // Deduplicar
        const pCheck = await projects.getById(projectId);
        if (pCheck?.garantia?.paneles?.strings?.[stringIdx]?.paneles?.some(p => p.serial === serial)) {
          toast(`⚠ Serial ya registrado: ${serial}`, 'warning', 3000);
          return;
        }
        const p = await projects.getById(projectId);
        const str = p.garantia.paneles.strings[stringIdx];
        const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
        str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
        await projects.update(projectId, { garantia: p.garantia });
        navigate(`#proyecto/${projectId}/garantia`);
      },
      { continuous: false, title: `Escanear panel — ${strNombre}` }
    );
  } else {
    const serial = await inputDialog('Número de serie del panel:');
    if (!serial?.trim()) return;
    const p = await projects.getById(projectId);
    const str = p.garantia.paneles.strings[stringIdx];
    const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
    str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
  }
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

// ── Hook de tab para el módulo de Garantía (detener scanner al cambiar de tab)
// switchTab está definida globalmente en app.js — este hook añade el side-effect del scanner
window._onTabChange = function(tabBarId) {
  if (tabBarId === 'garantia-tabs' && _activeScanStringIdx >= 0) {
    stopScanner();
    const sc = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (sc) sc.style.display = 'none';
    _activeScanStringIdx = -1;
  }
};
