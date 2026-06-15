// lev-areas.js — Áreas del techo: render, edición y handlers
// Extraído de documentacion.js — accede a window._lev (expuesto por documentacion.js)

import { esc, fotoMini, confirmDialog } from './utils.js';
import { icon } from './icons.js';

// ── Sujeción automática según tipo de techo ───────────────────────────────────
const _SUJECION_MAP = {
  'Losa de concreto': 'Anclaje químico (epóxico + taquete)',
  'Lámina':           'Tornillo autoperforante',
  'Metálico':         'Abrazadera estructural / varilla roscada',
  'Madera':           'Tirafondo 3/8" + flashing impermeable',
  'Otro':             'Por definir',
};
export function _sujecionPorTecho(tipTecho) {
  return _SUJECION_MAP[tipTecho] || 'Selecciona tipo de techo';
}

// ── Mostrar / ocultar campos de madera al cambiar tipo de techo ──────────────
window._onTipTechoChange = function(sel) {
  const maderaFields = document.getElementById('madera-fields');
  if (maderaFields) maderaFields.style.display = sel.value === 'Madera' ? '' : 'none';
  // Actualizar badge de sujeción
  const badge = document.getElementById('sujecion-label');
  if (badge) badge.textContent = _sujecionPorTecho(sel.value);
};

// ── Áreas del techo — state y render ─────────────────────────────────────────
// state en window.window._lev.areasTecho
// state en window.window._lev.pid


export function _renderAreasTecho(areas, edit, pid) {
  if (!areas.length && !edit) return '';
  const ORIENTACIONES = ['Sur','Poniente','Oriente','Norte','Sur-Poniente','Sur-Oriente'];
  return areas.map((a, i) => {
    const fotos = Array.isArray(a.fotos) ? a.fotos : [];
    const totalFotos = fotos.length;
    return `
  <div class="lev-area-item" id="lev-area-${i}">
    ${edit ? `<button type="button" class="lev-area-del-btn"
      onclick="window._removeAreaTecho(${i})" title="Eliminar área">✕</button>` : ''}
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group" style="flex:2">
        <label>Nombre del área</label>
        <input type="text" class="input-field" value="${esc(a.nombre||'')}"
               placeholder="Ej: Techo sur, Bodega…"
               ${edit?`oninput="window._updateAreaTecho(${i},'nombre',this.value)"`:''} ${edit?'':'disabled'} />
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
        <input type="number" value="${a.inclinacion||''}" placeholder="15"
               ${edit?`oninput="window._updateAreaTecho(${i},'inclinacion',this.value)"`:''} ${edit?'':'disabled'} />
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
            ${edit ? `<button type="button" class="btn-del-foto"
              onclick="window.delFotoArea('${pid||''}',${i},${fi})">✕</button>` : ''}
          </div>`).join('')}
      </div>
      ${edit ? `<button type="button" class="btn-foto-sm lev-area-add-foto"
        onclick="window.capFotoArea('${pid||''}',${i})">${icon('camera')} Foto</button>` : ''}
    </div>
  </div>`;
  }).join('');
}

window._addAreaTecho = function() {
  const n = window._lev.areasTecho.length + 1;
  window._lev.areasTecho.push({ nombre: `Área ${n}`, ancho: null, largo: null, orientacion: 'Sur', pisos: null, inclinacion: null, distTableroInversor: null, distInversorPaneles: null, fotos: [] });
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
  const isStr = campo === 'nombre' || campo === 'orientacion';
  window._lev.areasTecho[idx][campo] = isStr ? val : (parseFloat(val) || null);
  const a = window._lev.areasTecho[idx];
  const res = document.getElementById(`lev-area-res-${idx}`);
  if (res) res.innerHTML = (a.ancho && a.largo)
    ? `<strong>${(a.ancho * a.largo).toFixed(1)} m²</strong>` : '—';
};
