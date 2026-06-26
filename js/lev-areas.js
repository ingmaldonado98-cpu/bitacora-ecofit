// lev-areas.js — Áreas del techo: render, edición y handlers
// Extraído de documentacion.js — accede a window._lev (expuesto por documentacion.js)

import { esc, fotoMini, confirmDialog } from './utils.js';
import { icon } from './icons.js';

// ── Sujeción automática según tipo de techo ───────────────────────────────────
const _SUJECION_MAP = {
  'Losa de concreto': 'Anclaje químico (epóxico + taquete)',
  'Lámina':           'Tornillo autoperforante',
  'Carport':          'Abrazadera estructural / varilla roscada',
  'Madera':           'Tirafondo 3/8" + flashing impermeable',
  'Otro':             'Por definir',
};
export function _sujecionPorTecho(tipTecho) {
  return _SUJECION_MAP[tipTecho] || 'Selecciona tipo de techo';
}

// ── Áreas del techo — state y render ─────────────────────────────────────────
// state en window.window._lev.areasTecho
// state en window.window._lev.pid


// Tipo de techo por área — cada área define el suyo (ya no hay un "general"
// del sitio: tener ambos llevaba a seleccionar dos cosas que podían contradecirse).
const TIPOS_TECHO_AREA = ['Losa de concreto','Lámina','Carport','Madera','Otro'];

// Opciones de estado de la madera — mismas que el bloque general (lev-form.js)
const ESTADOS_MADERA = ['Nueva (< 2 años)','Buena (2–10 años)','Regular (10–20 años)','Deteriorada (requiere revisión)'];

// Catálogo de soporte PTR — usado cuando el techo es Lámina o Carport
const PTR_TIPOS    = ['PTR 2"x2"','PTR 2"x4"','PTR 4"x4"','PTR redondo 2"','Otro'];
const PTR_CALIBRES = ['Cal. 12','Cal. 14','Cal. 16','Cal. 18','Cal. 20'];

// Posición de referencia — esquina/borde desde donde se ancla el layout de paneles
const POSICIONES_REFERENCIA = ['Esquina Norte-Oriente','Esquina Norte-Poniente','Esquina Sur-Oriente','Esquina Sur-Poniente','Borde Norte','Borde Sur','Borde Oriente','Borde Poniente','Centro','Otro'];

// Categoría de evidencia — usada para agrupar las fotos en el Word/PDF
export const CATEGORIAS_FOTO = ['Estructura/anclaje','Cableado','Paneles','Tablero/conexión','Vista general'];

// Calidad/resistencia de la losa — solo para Losa de concreto; alimenta la
// alerta del paso de Perforación y Anclaje en Progreso de obra.
const CALIDAD_LOSA = ['Buena','Regular','Pobre'];

// ── Cambiar la categoría de una foto ya subida (persiste directo a Firestore) ──
window._setFotoCategoria = async function(pid, areaIdx, fotoId, categoria) {
  const { projects } = await import('./db.js');
  const p = await projects.getById(pid);
  const areas = p.documentacion?.levantamiento?.areasTecho || [];
  let foto;
  if (areaIdx != null) {
    foto = areas[areaIdx]?.fotos?.find(f => f.id === fotoId);
  } else {
    foto = (p.documentacion?.levantamiento?.fotosLevantamiento || []).find(f => f.id === fotoId);
  }
  if (!foto) return;
  foto.categoria = categoria || null;
  await projects.update(pid, { documentacion: p.documentacion });
};

// ── Mostrar/ocultar bloque estructural (madera/PTR/losa) y badge de sujeción por área ──
window._onAreaTipTechoChange = function(i, val, sel) {
  window._updateAreaTecho(i, 'tipTecho', val);
  const efectivo = val || '';
  const losaEl = document.getElementById(`losa-fields-${i}`);
  if (losaEl) losaEl.style.display = efectivo === 'Losa de concreto' ? '' : 'none';
  const maderaEl = document.getElementById(`madera-fields-${i}`);
  if (maderaEl) maderaEl.style.display = efectivo === 'Madera' ? '' : 'none';
  const ptrEl = document.getElementById(`ptr-fields-${i}`);
  if (ptrEl) ptrEl.style.display = (efectivo === 'Lámina' || efectivo === 'Carport') ? '' : 'none';
  const badge = document.getElementById(`sujecion-area-${i}`);
  if (badge) badge.textContent = _sujecionPorTecho(efectivo);
};

export function _renderAreasTecho(areas, edit, pid, tipTechoGeneral) {
  if (!areas.length && !edit) return '';
  const ORIENTACIONES = ['Sur','Poniente','Oriente','Norte','Sur-Poniente','Sur-Oriente'];
  return areas.map((a, i) => {
    const fotos = Array.isArray(a.fotos) ? a.fotos : [];
    const totalFotos = fotos.length;
    // Fallback solo para áreas migradas de proyectos viejos sin tipo propio
    const efectivo = a.tipTecho || tipTechoGeneral || 'Losa de concreto';
    // Resumen colapsado — antes cada área se mostraba con su formulario completo
    // expandido siempre, sin contador ni forma de ver de un vistazo qué áreas ya
    // tienen datos; con 3-4 áreas obligaba a scrollear todo para verificar.
    const completa  = !!(a.nombre && a.ancho && a.largo);
    const dimTxt     = (a.ancho && a.largo) ? `${a.ancho}×${a.largo} m` : 'sin dimensiones';
    const resumenTxt = `${esc(a.nombre || `Área ${i + 1}`)} — ${esc(efectivo)} · ${dimTxt}`;
    return `
  <div class="lev-area-item" id="lev-area-${i}">
    ${edit ? `<button type="button" class="lev-area-del-btn"
      onclick="window._removeAreaTecho(${i})" title="Eliminar área">✕</button>` : ''}
    <button type="button" class="accordion-toggle lev-area-toggle ${completa ? '' : 'acc-open'}"
            aria-expanded="${completa ? 'false' : 'true'}" aria-controls="lev-area-body-${i}"
            onclick="toggleAcc(this,'lev-area-body-${i}')">
      <span class="acc-icon" aria-hidden="true">🏠</span>
      <span class="acc-title">Área ${i + 1} de ${areas.length} <span class="lev-area-resumen">— ${resumenTxt}</span></span>
      <span class="acc-arrow" aria-hidden="true">▾</span>
    </button>
    <div class="accordion-body ${completa ? 'acc-collapsed' : ''}" id="lev-area-body-${i}">
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group" style="flex:2">
        <label>Nombre del área</label>
        <input type="text" class="input-field" value="${esc(a.nombre||'')}"
               placeholder="Ej: Techo sur, Bodega…"
               ${edit?`oninput="window._updateAreaTecho(${i},'nombre',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group" style="flex:1">
        <label>Tipo de techo</label>
        <select ${edit?`onchange="window._onAreaTipTechoChange(${i},this.value,this)"`:''} ${edit?'':'disabled'}>
          ${TIPOS_TECHO_AREA.map(t=>`<option ${efectivo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label>Sujeción / anclaje</label>
        <div id="sujecion-area-${i}" class="input-info-badge">${_sujecionPorTecho(efectivo)}</div>
      </div>
      <div class="form-group" style="flex:1">
        <label>Ancho (m)</label>
        <input type="number" class="input-field" value="${a.ancho||''}" step="0.5" placeholder="4.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'ancho',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group" style="flex:1">
        <label>Largo (m)</label>
        <input type="number" class="input-field" value="${a.largo||''}" step="0.5" placeholder="8.0"
               ${edit?`oninput="window._updateAreaTecho(${i},'largo',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group lev-area-result" style="flex:1">
        <label>Área</label>
        <div class="input-info-badge" id="lev-area-res-${i}">
          ${a.ancho && a.largo ? `<strong>${(a.ancho*a.largo).toFixed(1)} m²</strong>` : '—'}
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Orientación</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'orientacion',this.value)"`:''} ${edit?'':'disabled'}>
          ${ORIENTACIONES.map(t=>`<option ${(a.orientacion||'Sur')===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Número de pisos</label>
        <input type="number" value="${a.pisos||''}" placeholder="1" min="1" max="30"
               ${edit?`oninput="window._updateAreaTecho(${i},'pisos',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Inclinación (°)</label>
        <input type="number" value="${a.inclinacion||''}" placeholder="15" min="0" max="90"
               ${edit?`oninput="window._updateAreaTecho(${i},'inclinacion',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <!-- Punto de partida — referencia desde dónde se mide/instala el arreglo en esta área -->
    <div class="form-row">
      <div class="form-group">
        <label>Posición de referencia</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'posicionReferencia',this.value)"`:''} ${edit?'':'disabled'}>
          <option value="">— Seleccionar —</option>
          ${POSICIONES_REFERENCIA.map(t=>`<option ${a.posicionReferencia===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Punto de referencia <span class="form-hint">descripción</span></label>
        <input type="text" value="${esc(a.puntoReferencia||'')}" placeholder="Ej: junto al tinaco, esquina de la cumbrera…"
               ${edit?`oninput="window._updateAreaTecho(${i},'puntoReferencia',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <!-- Estructura — solo visible cuando el tipo de techo efectivo del área es Losa de concreto -->
    <div class="form-row" id="losa-fields-${i}" style="display:${efectivo==='Losa de concreto'?'':'none'}">
      <div class="form-group"><label>Grosor de losa (cm)</label>
        <input type="number" value="${a.grosorLosa||''}" placeholder="Ej: 10" min="5" max="40" step="0.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'grosorLosa',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group"><label>Calidad de la losa <span class="form-hint">para la profundidad de anclaje</span></label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'calidadLosa',this.value)"`:''} ${edit?'':'disabled'}>
          <option value="">— Seleccionar —</option>
          ${CALIDAD_LOSA.map(t=>`<option ${a.calidadLosa===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <!-- Estructura — solo visible cuando el tipo de techo efectivo del área es Madera -->
    <div class="form-row" id="madera-fields-${i}" style="display:${efectivo==='Madera'?'':'none'}">
      <div class="form-group"><label>Estado de la madera</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'estadoMadera',this.value)"`:''} ${edit?'':'disabled'}>
          <option value="">— Seleccionar —</option>
          ${ESTADOS_MADERA.map(t=>`<option ${a.estadoMadera===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Distancia entre vigas (cm)</label>
        <input type="number" value="${a.distVigas||''}" placeholder="40–60 típico BCS" min="10" max="150"
               ${edit?`oninput="window._updateAreaTecho(${i},'distVigas',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <!-- Soporte PTR — solo visible cuando el tipo de techo efectivo del área es Lámina o Carport -->
    <div class="form-row" id="ptr-fields-${i}" style="display:${(efectivo==='Lámina'||efectivo==='Carport')?'':'none'}">
      <div class="form-group"><label>Distancia entre PTR (cm)</label>
        <input type="number" value="${a.distVigas||''}" placeholder="40–60 típico"
               ${edit?`oninput="window._updateAreaTecho(${i},'distVigas',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group"><label>Tipo de PTR</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'tipoPTR',this.value)"`:''} ${edit?'':'disabled'}>
          <option value="">— Seleccionar —</option>
          ${PTR_TIPOS.map(t=>`<option ${a.tipoPTR===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Calibre</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'calibrePTR',this.value)"`:''} ${edit?'':'disabled'}>
          <option value="">— Seleccionar —</option>
          ${PTR_CALIBRES.map(t=>`<option ${a.calibrePTR===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Grosor (mm) <span class="form-hint">opcional</span></label>
        <input type="number" value="${a.grosorPTRmm||''}" step="0.1" placeholder="Ej: 1.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'grosorPTRmm',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Dist. tablero→inversor (m)</label>
        <input type="number" value="${a.distTableroInversor||''}" step="0.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'distTableroInversor',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group">
        <label>Dist. inversor→paneles (m)</label>
        <input type="number" value="${a.distInversorPaneles||''}" step="0.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'distInversorPaneles',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    ${!edit ? `
    <button type="button" class="lev-area-fotos-toggle"
            onclick="const s=document.getElementById('laf-sec-${i}');const open=s.style.display==='none';s.style.display=open?'':'none';this.querySelector('.laft-caret').textContent=open?'▾':'▸'">
      ${icon('camera', 13)} Fotos (${totalFotos}) <span class="laft-caret">▸</span>
    </button>` : ''}
    <div class="lev-area-fotos-section" id="laf-sec-${i}" ${!edit ? 'style="display:none"' : ''}>
      <div class="lev-area-fotos-grid">
        ${fotos.map((f, fi) => `
          <div class="lev-area-foto-wrap">
            ${fotoMini(f.url || f, `Foto ${fi+1}`)}
            ${edit && f.id ? `<select class="foto-categoria-select" title="Tipo de evidencia"
                onchange="window._setFotoCategoria('${pid||''}',${i},'${f.id}',this.value)">
              ${CATEGORIAS_FOTO.map(c=>`<option ${(f.categoria||'Vista general')===c?'selected':''}>${c}</option>`).join('')}
            </select>` : ''}
            ${edit ? `<button type="button" class="btn-del-foto"
              onclick="window.delFotoArea('${pid||''}',${i},${fi})">✕</button>` : ''}
          </div>`).join('')}
      </div>
      ${edit ? `<button type="button" class="btn-foto-sm lev-area-add-foto"
        onclick="window.capFotoArea('${pid||''}',${i})">${icon('camera')} Foto</button>` : ''}
    </div>
    </div>
  </div>`;
  }).join('');
}

window._addAreaTecho = function() {
  const n = window._lev.areasTecho.length + 1;
  window._lev.areasTecho.push({ nombre: `Área ${n}`, tipTecho: 'Losa de concreto', ancho: null, largo: null, orientacion: 'Sur', pisos: null, inclinacion: null, posicionReferencia: null, puntoReferencia: null, distTableroInversor: null, distInversorPaneles: null, grosorLosa: null, calidadLosa: null, estadoMadera: null, distVigas: null, tipoPTR: null, calibrePTR: null, grosorPTRmm: null, fotos: [] });
  const list = document.getElementById('lev-areas-list');
  if (list) list.innerHTML = _renderAreasTecho(window._lev.areasTecho, true, window._lev.pid);
};

window._removeAreaTecho = async function(idx) {
  const nombre = window._lev.areasTecho[idx]?.nombre || `Área ${idx + 1}`;
  const ok = await confirmDialog(`¿Eliminar "${nombre}"? Se perderán sus medidas y fotos.`);
  if (!ok) return;
  window._lev.areasTecho.splice(idx, 1);
  const list = document.getElementById('lev-areas-list');
  if (list) list.innerHTML = _renderAreasTecho(window._lev.areasTecho, true, window._lev.pid);
};

window._updateAreaTecho = function(idx, campo, val) {
  if (!window._lev.areasTecho[idx]) return;
  const isStr = campo === 'nombre' || campo === 'orientacion' || campo === 'tipTecho' ||
                campo === 'estadoMadera' || campo === 'tipoPTR' || campo === 'calibrePTR' ||
                campo === 'posicionReferencia' || campo === 'puntoReferencia' || campo === 'calidadLosa';
  window._lev.areasTecho[idx][campo] = isStr ? (val || null) : (parseFloat(val) || null);
  const a = window._lev.areasTecho[idx];
  const res = document.getElementById(`lev-area-res-${idx}`);
  if (res) res.innerHTML = (a.ancho && a.largo)
    ? `<strong>${(a.ancho * a.largo).toFixed(1)} m²</strong>` : '—';
};
