// doc-sitio.js — Progreso de obra: renderSitio, fotos de cierre y foto-handlers de sitio
// Extraído de documentacion.js para reducir su tamaño (>2000 líneas)

import { projects }                                    from './db.js';
import { esc, fotoMini, capturePhoto, toast, uuid,
         isoNow, confirmDialog, inputDialog,
         uploadProgressBar, getFotosTecnicas }         from './utils.js';
import { uploadPhotoQueued }                           from './firebase.js';
import { icon }                                        from './icons.js';

// ── Slots técnicos de cierre por sitio ───────────────────────────────────────
// `bloque` es solo de presentación: decide en qué pestaña de bloque se PINTA
// el slot — el dato sigue guardándose siempre en garantia.fotosTecnicas[key]
// del mismo `sitio` de siempre (centrosCarga/zonaDelSistema), sin crear un
// sitio/bloque nuevo en el modelo de datos.
const SLOTS_CIERRE_SITIO = {
  centrosCarga: [
    { key:'tableroAC',          label:'Tablero AC terminado',           req:true,  bloque:3 },
    { key:'tableroDC',          label:'Tablero DC terminado',           req:true,  bloque:3 },
    { key:'protecciones',       label:'Protecciones instaladas',        req:false, bloque:3 },
    { key:'puestaATierra',      label:'Puesta a tierra',                req:false, bloque:3 },
    { key:'inversorMontado',    label:'Inversor montado y nivelado',    req:true,  bloque:2 },
    { key:'bancoBaterias',      label:'Banco de baterías anclado',      req:false, bloque:2 },
    { key:'seccionadorCD',      label:'Seccionador de CD en posición',  req:false, bloque:2 },
    { key:'barraColectora',     label:'Detalle de barra colectora',     req:false, bloque:2 },
  ],
  zonaDelSistema: [
    { key:'inversorEnergizado', label:'Inversor energizado',     req:true,  bloque:3 },
    { key:'etiquetado',         label:'Etiquetado',              req:false, bloque:3 },
  ],
};

function _sitioForFTKey(key) {
  return SLOTS_CIERRE_SITIO.centrosCarga.some(s => s.key === key) ? 'centrosCarga' : 'zonaDelSistema';
}

// ── Bloque de cierre por sitio ────────────────────────────────────────────────
// `bloqueFiltro` opcional: si se pasa, solo renderiza los slots de
// SLOTS_CIERRE_SITIO[sitio] cuyo `bloque === bloqueFiltro` (para repartir un
// mismo sitio entre dos pestañas de bloque sin duplicar slots). Sin filtro,
// renderiza todos — compatibilidad con otros llamadores existentes.
function renderCierreSitio(project, sitio, edit, projectId, bloqueFiltro) {
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
                ${icon('camera', 16)} Tomar foto</button>
             </div>` : '<p class="empty-msg-sm">Sin foto.</p>')}
      </div>
    </div>
    ${(g.fotosAdicionales || []).length ? `
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Fotos adicionales de cierre</h3>
        ${edit ? `<button class="btn-primary btn-sm" onclick="capFotoAdicionalDoc('${projectId}')">
          ${icon('camera', 16)} Agregar</button>` : ''}
      </div>
      <div class="fotos-grid">
        ${(g.fotosAdicionales || []).map((f, i) => `
          <div class="foto-card">
            ${fotoMini(f, 'Foto '+(i+1))}
            ${f.nota ? `<p class="foto-nota">${esc(f.nota)}</p>` : ''}
            ${edit ? `
              <button class="btn-del-foto-abs" onclick="editFotoAdicionalDoc('${projectId}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoAdicionalDoc('${projectId}',${i})">✕</button>
            ` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  const slots = (SLOTS_CIERRE_SITIO[sitio] || [])
    .filter(s => bloqueFiltro == null || s.bloque === bloqueFiltro);
  if (!slots.length) return '';

  // Render compacto: cuando se filtra por bloque, los slots se ven como una
  // sola cuadrícula de tarjetas pequeñas (foto/botón + caption corta) en vez
  // de una fila completa por slot — evita scroll largo para revisar 4+ puntos.
  if (bloqueFiltro != null) {
    return `
    <div class="card">
      <h3 class="card-title">Fotos técnicas de cierre</h3>
      <div class="ft-slot-grid">
        ${slots.map(s => {
          const fotos = getFotosTecnicas(g.fotosTecnicas, s.key);
          const tiene = fotos.length > 0;
          const primera = fotos[0];
          return `
          <div class="ft-slot-card" title="${esc(s.label)}${s.req ? ' (obligatoria)' : ''}">
            ${tiene ? `
              <div class="ft-slot-thumb">
                ${fotoMini(primera, s.label)}
                ${fotos.length > 1 ? `<span class="ft-slot-more">+${fotos.length - 1}</span>` : ''}
                ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnicaDoc('${projectId}','${s.key}',0)">✕</button>` : ''}
              </div>
            ` : (edit ? `
              <button class="btn-foto-sm ft-slot-addbtn" onclick="capFotoTecnicaDoc('${projectId}','${s.key}')">
                ${icon('camera', 16)}
              </button>
            ` : `<div class="ft-slot-thumb ft-slot-empty">—</div>`)}
            <span class="ft-slot-caption">${s.req ? '<span class="ft-slot-req">•</span> ' : ''}${esc(s.label)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

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
              ${fotoMini(f, s.label)}
              ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnicaDoc('${projectId}','${s.key}',${i})">✕</button>` : ''}
            </div>`).join('')}
          ${edit ? `<button class="btn-foto-sm ft-add-btn" onclick="capFotoTecnicaDoc('${projectId}','${s.key}')">
            ${icon('camera', 16)} ${tiene ? '+' : 'Tomar'}
          </button>` : (!tiene ? '<span class="ft-empty">—</span>' : '')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Refresco parcial tras una acción de foto — sin navigate() completo ───────
// renderSitio() ya envuelve su salida en un <div id="sitio-cierre-{sitio}[-b{N}]">
// (ver más abajo). documentacion.js siempre pasa el número de bloque actual
// como bloqueFiltro al llamar renderSitio — incluso para 'techo', que solo
// aparece en su bloque primario pero igual queda con sufijo (ej. "-b1"). Por
// eso se prueban las 4 variantes posibles (1/2/3/sin sufijo) para cualquier
// sitio y se omite la que no exista en el DOM. Un mismo sitio físico puede
// aparecer repartido en más de un bloque (ej. centrosCarga en Bloque 2 Y
// Bloque 3, cada uno con su propio filtro de slots). Estos handlers escriben
// en garantia.* — una ruta de datos separada de checklistData.fotosCierre.*
// (de donde salen los badges de % de los tabs de bloque), así que no hace
// falta recalcular ningún badge aquí.
async function _refreshSitioCierre(projectId, sitio) {
  const p = await projects.getById(projectId);
  if (!p) return;
  for (const b of [1, 2, 3, undefined]) {
    const id = `sitio-cierre-${sitio}${b != null ? '-b' + b : ''}`;
    const el = document.getElementById(id);
    if (el) el.outerHTML = renderSitio(p, sitio, true, projectId, b);
  }
}

// ── Handlers de fotos de cierre (guardan en garantia.*) ──────────────────────
window.capFotoSistemaDoc = function(projectId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    try {
      const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
      const fotoSistema = result.url
        || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
      // setField puntual en vez de getById+update completo — evita pisar cambios
      // de otro técnico editando el mismo proyecto al mismo tiempo.
      await projects.setField(projectId, 'garantia.fotoSistema', fotoSistema);
      await _refreshSitioCierre(projectId, 'techo');
      if (!result.pending) toast('✅ Foto guardada');
    } catch (err) {
      console.error('capFotoSistemaDoc error:', err);
      toast('⚠ No se pudo guardar la foto — revisa tu conexión e intenta de nuevo', 'error', 5000);
    }
  }, { preview: true });
};

window.delFotoSistemaDoc = async function(projectId) {
  if (!await confirmDialog('¿Eliminar foto del sistema?')) return;
  await projects.setField(projectId, 'garantia.fotoSistema', null);
  await _refreshSitioCierre(projectId, 'techo');
};

window.capFotoTecnicaDoc = function(projectId, key) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(projectId);
    const existentes = (() => {
      const v = p.garantia?.fotosTecnicas?.[key];
      if (!v) return [];
      if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
      return Array.isArray(v) ? v : [];
    })();
    let subidas = 0, fallo = null;
    try {
      for (let i = 0; i < total; i++) {
        prog.update(i + 1);
        const fid = uuid();
        const result = await uploadPhotoQueued(fotos[i],
          `projects/${projectId}/tecnica_${key}_${fid}.jpg`, projectId, 'fotoTecnica', { key, itemId: fid });
        existentes.push({ url: result.url || null, id: fid, createdAt: isoNow(),
          ...(result.pending && { pending: true, pendingId: result.pendingId }) });
        subidas++;
      }
    } catch (err) {
      console.error('capFotoTecnicaDoc error:', err);
      fallo = err;
    } finally {
      prog.done();
    }
    // Guardar lo que sí se subió, aunque haya fallado a la mitad — setField
    // puntual en la clave exacta, no pisa el resto de garantia.fotosTecnicas
    // ni otros campos editados por otro técnico al mismo tiempo.
    await projects.setField(projectId, `garantia.fotosTecnicas.${key}`, existentes);
    await _refreshSitioCierre(projectId, _sitioForFTKey(key));
    if (fallo) {
      toast(`⚠ Se guardaron ${subidas} de ${total} foto${total>1?'s':''}. Revisa tu conexión e intenta de nuevo con las que faltan.`, 'error', 6000);
      return;
    }
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoTecnicaDoc = async function(projectId, key, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const v = p.garantia?.fotosTecnicas?.[key];
  const fotos = typeof v === 'string' ? [{ url: v, id: 'legacy' }] : (Array.isArray(v) ? v : []);
  fotos.splice(idx, 1);
  await projects.setField(projectId, `garantia.fotosTecnicas.${key}`, fotos.length ? fotos : null);
  await _refreshSitioCierre(projectId, _sitioForFTKey(key));
};

window.capFotoAdicionalDoc = function(projectId) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];
    let fallo = null;
    try {
      for (let i = 0; i < total; i++) {
        prog.update(i + 1);
        const fid = uuid();
        const result = await uploadPhotoQueued(fotos[i],
          `projects/${projectId}/adicional_${fid}.jpg`, projectId, 'fotoAdicional', { itemId: fid });
        nuevas.push({ data: result.url || null,
          nota: '', id: fid, createdAt: isoNow(),
          ...(result.pending && { pending: true, pendingId: result.pendingId }) });
      }
    } catch (err) {
      console.error('capFotoAdicionalDoc error:', err);
      fallo = err;
    } finally {
      prog.done();
    }
    if (!fallo && total === 1 && nuevas.length === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }
    const p = await projects.getById(projectId);
    const fotosAdicionales = [...(p.garantia?.fotosAdicionales || []), ...nuevas];
    await projects.setField(projectId, 'garantia.fotosAdicionales', fotosAdicionales);
    await _refreshSitioCierre(projectId, 'techo');
    if (fallo) {
      toast(`⚠ Se guardaron ${nuevas.length} de ${total} foto${total>1?'s':''}. Revisa tu conexión e intenta de nuevo con las que faltan.`, 'error', 6000);
      return;
    }
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoAdicionalDoc = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const fotosAdicionales = [...(p.garantia?.fotosAdicionales || [])];
  fotosAdicionales.splice(idx, 1);
  await projects.setField(projectId, 'garantia.fotosAdicionales', fotosAdicionales);
  await _refreshSitioCierre(projectId, 'techo');
};

window.editFotoAdicionalDoc = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const fotosAdicionales = [...(p.garantia?.fotosAdicionales || [])];
  const actual = fotosAdicionales[idx]?.nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  fotosAdicionales[idx] = { ...fotosAdicionales[idx], nota: nueva };
  await projects.setField(projectId, 'garantia.fotosAdicionales', fotosAdicionales);
  await _refreshSitioCierre(projectId, 'techo');
};

// ── Acordeón helper ───────────────────────────────────────────────────────────
window.toggleAcc = function(btn, bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = btn.classList.toggle('acc-open');
  body.classList.toggle('acc-collapsed', !isOpen);
};

// ── Render sitio — evidencia de cierre integrada, sin pestañas Antes/Durante/
// Cierre (se quitaron: la galería genérica era redundante con los slots
// técnicos nombrados de renderCierreSitio, y obligaba a un clic extra para
// llegar a la evidencia real).
export function renderSitio(project, sitio, edit, projectId, bloqueFiltro) {
  const id = `sitio-cierre-${sitio}${bloqueFiltro != null ? '-b' + bloqueFiltro : ''}`;
  return `<div id="${id}">${renderCierreSitio(project, sitio, edit, projectId, bloqueFiltro)}</div>`;
}

