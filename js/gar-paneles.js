// gar-paneles.js — Paneles + strings + escaneo continuo
// Extraído de garantia.js. Exporta renderPaneles.

import { projects } from './db.js';
import { esc, fotoMini, toast, confirmDialog, inputDialog, uuid, isoNow,
         openScannerOverlay } from './utils.js';
import { icon } from './icons.js';
import { stopScanner } from './scanner.js';
import { _serialUbicacion } from './gar-equipos.js';

// ── 1E Paneles + escaneo continuo ────────────────────────────────────────────
let _activeScanStringIdx = -1;

export function renderPaneles(paneles, projectId, edit, catalog = [], fuenteCalc = null) {
  const totalPaneles = (paneles.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  const totalKwp     = totalPaneles * ((paneles.wp||0)/1000);

  // Tarjeta de sugerencia desde calculadora (solo cuando edit y hay fuente y no hay datos)
  const sugerenciaCard = edit && fuenteCalc ? `
  <div class="panel-sugerencia-wrap">
    <div class="panel-sugerencia-card" onclick="usarFuentePanel('${esc(fuenteCalc.id)}')">
      <span style="font-size:1.3rem">☀️</span>
      <div class="psc-info">
        <span class="psc-label">${esc(fuenteCalc.label)}</span>
        <span class="psc-origen">${fuenteCalc.wp}W · Registrado en Calculadora</span>
      </div>
      <button class="btn-primary btn-sm">Usar estos datos</button>
    </div>
    <div class="panel-sugerencia-card psc-manual" onclick="document.getElementById('panel-form-campos').style.display=''">
      <span style="font-size:1.1rem">✏️</span>
      <span>Ingresar datos manualmente</span>
    </div>
  </div>
  <div id="panel-form-campos" style="display:none">` : '';

  const cierreSugerencia = edit && fuenteCalc ? `</div>` : '';

  return `
  <script>window._panelCatalogData = ${JSON.stringify(catalog).replace(/<\//g, '<\\/')};<\/script>
  <div class="card">
    <h3 class="card-title">Paneles solares</h3>
    ${sugerenciaCard}
    ${edit && catalog.length > 0 && !fuenteCalc ? `
    <div class="form-group" style="margin-bottom:14px">
      <label>Seleccionar del catálogo</label>
      <select id="panel-catalogo-sel" class="select-field" onchange="seleccionarPanelCatalogo(this)">
        <option value="">— Elige un modelo para rellenar automáticamente —</option>
        ${catalog.map(p => `<option value="${esc(p.id)}">${esc(p.label)} — ${p.wp}W</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="form-row">
      <div class="form-group">
        <label>Marca</label>
        <input type="text" id="panel-marca" value="${esc(paneles.marca||'')}" placeholder="Ej: Jinko" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Modelo</label>
        <input type="text" id="panel-modelo" value="${esc(paneles.modelo||'')}" placeholder="Ej: Tiger Neo" ${!edit?'disabled':''} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Potencia (Wp)</label>
        <input type="number" id="panel-wp" value="${paneles.wp||''}" min="1" placeholder="Ej: 580" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Voc — Voltaje circuito abierto (V)</label>
        <input type="number" id="panel-voc" value="${paneles.voc||''}" min="0" step="0.1" placeholder="Ej: 49.8"
               ${!edit?'disabled':''} oninput="syncVocFromPanel()" />
      </div>
      <div class="form-group">
        <label>Imp — Corriente punto máximo (A)</label>
        <input type="number" id="panel-imp" value="${paneles.imp||''}" min="0" step="0.01" placeholder="Ej: 13.95" ${!edit?'disabled':''} />
      </div>
    </div>
    ${!edit && (paneles.voc || paneles.imp) ? `
    <div class="panel-elec-vals">
      ${paneles.voc ? `<span class="pe-val">Voc <strong>${paneles.voc} V</strong></span>` : ''}
      ${paneles.imp ? `<span class="pe-val">Imp <strong>${paneles.imp} A</strong></span>` : ''}
    </div>` : ''}
    ${edit ? `<button class="btn-outline btn-sm" onclick="guardarInfoPanel('${projectId}')">Guardar info del panel</button>` : ''}
    ${cierreSugerencia}

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
  p.garantia.paneles.wp     = parseFloat(document.getElementById('panel-wp').value)  || 0;
  p.garantia.paneles.voc    = parseFloat(document.getElementById('panel-voc').value)  || null;
  p.garantia.paneles.imp    = parseFloat(document.getElementById('panel-imp').value)  || null;
  await projects.update(projectId, { garantia: p.garantia });
  toast('✅ Info del panel guardada');
};

window.agregarString = async function(projectId) {
  const p = await projects.getById(projectId);
  const n = (p.garantia.paneles.strings||[]).length + 1;
  p.garantia.paneles.strings = [...(p.garantia.paneles.strings||[]), { nombre:`String ${n}`, paneles:[] }];
  await projects.update(projectId, { garantia: p.garantia });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delString = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este string y todos sus paneles?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings.splice(idx,1);
  await projects.update(projectId, { garantia: p.garantia });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};

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
      // Deduplicar contra TODO el proyecto (todos los strings + equipos)
      const pCheck = await projects.getById(projectId);
      const dup = _serialUbicacion(pCheck, serial);
      if (dup) {
        toast(`⚠ Serial ya registrado en ${dup}: ${serial}`, 'warning', 3500);
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
        // Deduplicar contra TODO el proyecto
        const pCheck = await projects.getById(projectId);
        const dup = _serialUbicacion(pCheck, serial);
        if (dup) {
          toast(`⚠ Serial ya registrado en ${dup}: ${serial}`, 'warning', 3500);
          return;
        }
        const p = await projects.getById(projectId);
        const str = p.garantia.paneles.strings[stringIdx];
        const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
        str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
        await projects.update(projectId, { garantia: p.garantia });
        sessionStorage.setItem('garantia-tab-target', 'g-paneles');
        navigate(`#proyecto/${projectId}/garantia`);
      },
      { continuous: false, title: `Escanear panel — ${strNombre}` }
    );
  } else {
    const serial = await inputDialog('Número de serie del panel:');
    if (!serial?.trim()) return;
    const p = await projects.getById(projectId);
    const dup = _serialUbicacion(p, serial);
    if (dup) {
      toast(`⚠ Serial ya registrado en ${dup}: ${serial.trim()}`, 'warning', 3500);
      return;
    }
    const str = p.garantia.paneles.strings[stringIdx];
    const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
    str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
    await projects.update(projectId, { garantia: p.garantia });
    sessionStorage.setItem('garantia-tab-target', 'g-paneles');
    navigate(`#proyecto/${projectId}/garantia`);
  }
};

window.delPanel = async function(projectId, stringIdx, panelIdx) {
  if (!await confirmDialog('¿Eliminar este panel?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings[stringIdx].paneles.splice(panelIdx,1);
  await projects.update(projectId, { garantia: p.garantia });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Hook de tab — detener scanner al cambiar de tab
// switchTab está definida globalmente en app.js — este hook añade el side-effect del scanner
window._onTabChange = function(tabBarId) {
  if (tabBarId === 'garantia-tabs' && _activeScanStringIdx >= 0) {
    stopScanner();
    const sc = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (sc) sc.style.display = 'none';
    _activeScanStringIdx = -1;
  }
};
