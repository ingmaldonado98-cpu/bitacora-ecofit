// lev-consumo.js — Recibos CFE, aparatos eléctricos y cargas off-grid
// Extraído de documentacion.js — accede a window._lev (expuesto por documentacion.js)

import { esc, fotoMini, capturePhoto, toast, uuid } from './utils.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';

// ── Recibos CFE ───────────────────────────────────────────────────────────────
export const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
window.MESES_FULL = MESES_FULL; // exponer para onchange inline

// state en window._lev.recibos
export function renderRecibos(recibos, edit, pid) {
  window._lev.recibos = [...recibos];
  const limite   = 12;
  const puedeAgregar = edit && window._lev.recibos.length < limite;
  const anioActual   = new Date().getFullYear();
  const anios        = [anioActual, anioActual-1, anioActual-2, anioActual-3];

  if (!recibos.length && !edit) return '<p class="empty-msg-sm">Sin recibos CFE capturados.</p>';

  // Resumen estadístico (a partir de 2 registros con kWh)
  const conKwh    = window._lev.recibos.filter(r => r.kwh > 0);
  const conImp    = window._lev.recibos.filter(r => r.importe > 0);
  const resumen   = conKwh.length >= 2 ? (() => {
    const avgKwh  = Math.round(conKwh.reduce((s,r)=>s+r.kwh,0)/conKwh.length);
    const avgImp  = conImp.length ? Math.round(conImp.reduce((s,r)=>s+r.importe,0)/conImp.length) : 0;
    const peak    = conKwh.reduce((a,b)=>a.kwh>b.kwh?a:b);
    const low     = conKwh.reduce((a,b)=>a.kwh<b.kwh?a:b);
    const peakLbl = peak.mes ? MESES_CORTO[peak.mes-1] + (peak.anio?' '+peak.anio:'') : '';
    const lowLbl  = low.mes  ? MESES_CORTO[low.mes-1]  + (low.anio?' '+low.anio:'')  : '';
    return `<div class="recibo-resumen">
      <div class="res-stat">
        <span class="res-lbl">Promedio mensual</span>
        <strong>${avgKwh} kWh</strong>
        ${avgImp ? `<span class="res-imp">$${avgImp.toLocaleString('es-MX')}/mes</span>` : ''}
      </div>
      <div class="res-stat res-peak">
        <span class="res-lbl">Mes pico</span>
        <strong>${peak.kwh} kWh</strong>
        ${peakLbl ? `<span class="res-mes">${peakLbl}</span>` : ''}
      </div>
      <div class="res-stat res-low">
        <span class="res-lbl">Mes bajo</span>
        <strong>${low.kwh} kWh</strong>
        ${lowLbl ? `<span class="res-mes">${lowLbl}</span>` : ''}
      </div>
    </div>
    <button type="button" class="btn-outline btn-sm" style="margin-top:6px" onclick="navigate('#proyecto/${window._lev.pid}/dimensionamiento')">
      ${icon('calculator', 14)} Ver dimensionamiento sugerido con este consumo
    </button>`;
  })() : '';

  return `
  <div class="recibos-header">
    <span class="recibo-count">${window._lev.recibos.length} / ${limite} recibos</span>
    ${puedeAgregar ? `<button type="button" class="btn-outline btn-sm" onclick="addRecibo()">+ Recibo</button>` : ''}
  </div>
  ${window._lev.recibos.map((r,i)=>`
    <div class="recibo-card">
      <div class="recibo-top">
        <div class="recibo-fecha">
          <select class="sel-mes" ${edit?`onchange="(function(v){window._lev.recibos[${i}].mes=parseInt(v)||null;window._lev.recibos[${i}].mesLabel=MESES_FULL[(parseInt(v)||1)-1];}).call(this,this.value)"`:'disabled'}>
            <option value="">Mes</option>
            ${MESES_CORTO.map((m,mi)=>`<option value="${mi+1}" ${r.mes===mi+1?'selected':''}>${m}</option>`).join('')}
          </select>
          <select class="sel-anio" ${edit?`onchange="window._lev.recibos[${i}].anio=parseInt(this.value)||null"`:'disabled'}>
            <option value="">Año</option>
            ${anios.map(a=>`<option value="${a}" ${r.anio===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="recibo-foto-slot">
          ${r.foto
            ? `${fotoMini(r.foto,'Recibo')}${edit?`<button type="button" class="btn-del-foto" onclick="window._lev.recibos[${i}].foto=null;refreshRecibos()">✕</button>`:''}`
            : (edit ? `<button type="button" class="btn-foto-sm" onclick="capReciboFoto(${i})">${icon('receipt', 14)} Foto</button>` : '<span style="color:var(--text-muted);font-size:.75rem">Sin foto</span>')}
        </div>
        ${edit?`<button type="button" class="btn-del-sm" onclick="delRecibo(${i})" title="Eliminar">✕</button>`:''}
      </div>
      <div class="recibo-nums">
        <label class="recibo-num-group">
          <span>kWh / mes</span>
          <input type="number" placeholder="0" value="${r.kwh||''}" min="0" step="1"
            ${edit?`oninput="window._lev.recibos[${i}].kwh=parseFloat(this.value)||0"`:'disabled'}/>
        </label>
        <label class="recibo-num-group">
          <span>$ Importe</span>
          <input type="number" placeholder="0" value="${r.importe||''}" min="0" step="1"
            ${edit?`oninput="window._lev.recibos[${i}].importe=parseFloat(this.value)||0"`:'disabled'}/>
        </label>
      </div>
    </div>`).join('')}
  ${resumen}
  `;
};

window.addRecibo = function() {
  if (window._lev.recibos.length >= 12) { toast('Máximo 12 recibos', 'error'); return; }
  // Auto-sugerir: retroceder un mes desde el último capturado
  const ultimo = window._lev.recibos.slice().reverse().find(r => r.mes && r.anio);
  let mes = null, anio = null;
  if (ultimo) {
    mes  = ultimo.mes === 1 ? 12 : ultimo.mes - 1;
    anio = ultimo.mes === 1 ? ultimo.anio - 1 : ultimo.anio;
  }
  window._lev.recibos.push({ foto:null, mes, anio, mesLabel: mes ? MESES_FULL[mes-1] : '', kwh:0, importe:0 });
  refreshRecibos();
};
window.delRecibo = function(i) { window._lev.recibos.splice(i,1); refreshRecibos(); };
window.capReciboFoto = function(i) {
  capturePhoto(async b64 => {
    toast('Subiendo foto del recibo…');
    const fid = uuid();
    const pid = window._lev?.pid;
    const path = pid ? `projects/${pid}/recibo_${fid}.jpg` : `levantamiento/recibo_${fid}.jpg`;
    const result = await uploadPhotoQueued(b64, path, pid || 'levantamiento_temp', 'reciboFoto');
    window._lev.recibos[i].foto = result.url
      || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    refreshRecibos();
    if (result.url) toast('✅ Foto del recibo guardada');
  });
};
window.refreshRecibos = function() {
  const panel = document.getElementById('panel-recibos');
  if (panel) panel.innerHTML = renderRecibos(window._lev.recibos, true, null);
};

// ── Aparatos eléctricos ───────────────────────────────────────────────────────
// state en window._lev.aparatos
const APARATOS_RAPIDOS = [
  {nombre:'Minisplit 1 ton',potencia:900,horas:8},{nombre:'Minisplit 1.5 ton',potencia:1350,horas:8},
  {nombre:'Minisplit 2 ton',potencia:1800,horas:8},{nombre:'Calentador eléctrico',potencia:1200,horas:2},
  {nombre:'Bomba de agua',potencia:750,horas:4},{nombre:'Bomba de alberca',potencia:1100,horas:6},
  {nombre:'Refrigerador residencial',potencia:200,horas:24},{nombre:'Refrigerador comercial',potencia:500,horas:24},
  {nombre:'Lavadora',potencia:500,horas:1},
];
const AREAS_CONSUMO = ['General','Sala/Comedor','Cocina','Habitación 1','Habitación 2','Habitación 3',
                       'Baño','Cuarto de lavado','Cochera','Entrada','Patio/Jardín','Sala de máquinas','Otro'];

function _areaOpts(sel) {
  return AREAS_CONSUMO.map(a=>`<option ${a===sel?'selected':''}>${a}</option>`).join('');
}
function _aparatoRow(a, i, edit) {
  return `<div class="aparato-row" data-idx="${i}">
    ${edit ? `<select class="aprow-area" onchange="window._lev.aparatos[${i}].area=this.value;refreshAparatos()">${_areaOpts(a.area||'General')}</select>` : ''}
    <input type="text" value="${esc(a.nombre)}" placeholder="Nombre" ${edit?`oninput="window._lev.aparatos[${i}].nombre=this.value"`:'disabled'}/>
    <input type="number" value="${a.potencia}" placeholder="W" min="0" ${edit?`oninput="window._lev.aparatos[${i}].potencia=parseFloat(this.value)||0"`:'disabled'}/>
    <input type="number" value="${a.horas}" placeholder="h/día" min="0" step="0.5" ${edit?`oninput="window._lev.aparatos[${i}].horas=parseFloat(this.value)||0"`:'disabled'}/>
    <input type="number" value="${a.cantidad||1}" placeholder="Cant." min="1" ${edit?`oninput="window._lev.aparatos[${i}].cantidad=parseInt(this.value)||1"`:'disabled'}/>
    ${edit?`<button type="button" class="btn-del-sm" onclick="delAparato(${i})">✕</button>`:''}
  </div>`;
}

function _renderAparatosByZone(edit) {
  if (!window._lev.aparatos.length) {
    return '<p class="empty-msg-sm">Sin aparatos. Usa los accesos rápidos o agrega uno.</p>';
  }
  const inOrder  = AREAS_CONSUMO.filter(z => window._lev.aparatos.some(a => (a.area||'General') === z));
  const custom   = [...new Set(window._lev.aparatos.map(a => a.area||'General').filter(z => !AREAS_CONSUMO.includes(z)))];
  const zones    = [...inOrder, ...custom];
  return zones.map(zone => {
    const items = window._lev.aparatos.map((a,i)=>({a,i})).filter(({a})=>(a.area||'General')===zone);
    const zKwh  = items.reduce((s,{a})=>s+a.potencia*a.horas*(a.cantidad||1)*30/1000, 0);
    return `<div class="aparatos-zona">
      <div class="zona-hdr">
        <span class="zona-name">${esc(zone)}</span>
        <span class="zona-kwh">${zKwh.toFixed(0)} kWh/mes</span>
      </div>
      ${items.map(({a,i})=>_aparatoRow(a,i,edit)).join('')}
    </div>`;
  }).join('');
}

export function renderAparatos(aparatos, edit) {
  window._lev.aparatos = aparatos.map(a => ({...a, area: a.area || 'General'}));
  const totalKwh = window._lev.aparatos.reduce((s,a)=>s+(a.potencia*a.horas*(a.cantidad||1)*30/1000),0);
  return `
    ${edit?`<div class="aparatos-rapidos">
      <p class="hint">Acceso rápido:</p>
      <div class="chip-group">
        ${APARATOS_RAPIDOS.map(a=>`<button type="button" class="chip chip-sm" onclick="addAparatoRapido(${JSON.stringify(a).replace(/"/g,'&quot;')})">${a.nombre}</button>`).join('')}
      </div>
    </div>`:''}
    <div id="lista-aparatos">
      ${_renderAparatosByZone(edit)}
    </div>
    ${edit?`<button type="button" class="btn-outline btn-sm" onclick="addAparato()">+ Aparato</button>`:''}
    <p class="kwh-total">Total estimado: <strong>${totalKwh.toFixed(0)} kWh/mes</strong></p>
  `;
}

const _triggerLevSave = () => { if (window._lev.pid) window._levAutoSave(window._lev.pid); };
window.addAparatoRapido = function(a) { window._lev.aparatos.push({...a,cantidad:1,area:'General'}); refreshAparatos(); _triggerLevSave(); };
window.addAparato = function() { window._lev.aparatos.push({nombre:'',potencia:0,horas:0,cantidad:1,area:'General'}); refreshAparatos(); _triggerLevSave(); };
window.delAparato = function(i) { window._lev.aparatos.splice(i,1); refreshAparatos(); _triggerLevSave(); };
window.refreshAparatos = function() {
  const el = document.getElementById('lista-aparatos');
  if (el) {
    el.innerHTML = _renderAparatosByZone(true);
    const totalKwh = window._lev.aparatos.reduce((s,a) => s + (a.potencia * a.horas * (a.cantidad||1) * 30 / 1000), 0);
    const totEl = el.closest('.card, [id^="panel-aparatos"]')?.querySelector('.kwh-total');
    if (totEl) totEl.innerHTML = `Total estimado: <strong>${totalKwh.toFixed(0)} kWh/mes</strong>`;
  }
};

window.setModoConsumo = function(modo) {
  document.querySelectorAll('#chip-consumo .chip').forEach(c => {
    c.classList.toggle('chip-active', c.textContent.trim().startsWith(modo==='recibo'?'Con':'Por'));
  });
  document.getElementById('panel-recibos').style.display  = modo==='recibo' ?'':'none';
  document.getElementById('panel-aparatos').style.display = modo==='aparatos'?'':'none';
  document.getElementById('form-levantamiento').dataset.modoConsumo = modo;
};

// ── Cargas (off-grid/respaldo) ────────────────────────────────────────────────
// state en window._lev.cargas

const CARGAS_RAPIDAS = [
  {nombre:'Minisplit 1 ton',    potencia:900,  horas:8 },
  {nombre:'Minisplit 1.5 ton',  potencia:1350, horas:8 },
  {nombre:'Refrigerador',       potencia:150,  horas:24},
  {nombre:'Bomba de agua',      potencia:750,  horas:4 },
  {nombre:'Televisor',          potencia:100,  horas:6 },
  {nombre:'Foco LED',           potencia:10,   horas:8 },
  {nombre:'Lavadora',           potencia:500,  horas:1 },
];

function _cargaAreaOpts(sel) {
  return AREAS_CONSUMO.map(a=>`<option ${(a===(sel||'General'))?'selected':''}>${a}</option>`).join('');
}
function _cargasResumen(tipo) {
  const map = {};
  window._lev.cargas[tipo].forEach(c => {
    const k = c.area || 'General';
    if (!map[k]) map[k] = 0;
    map[k] += (c.potencia * c.horas * (c.cantidad||1)) / 1000;
  });
  const items = Object.entries(map).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if (items.length <= 1) return '';
  return `<div class="aparatos-resumen">
    ${items.map(([k,v])=>`<div class="apres-row"><span>${esc(k)}</span><strong>${v.toFixed(2)} kWh/día</strong></div>`).join('')}
  </div>`;
}
export function renderCargas(cargas, edit, tipo) {
  window._lev.cargas[tipo] = [...cargas];
  const totalW   = window._lev.cargas[tipo].reduce((s,c) => s + c.potencia * (c.cantidad||1), 0);
  const totalWh  = window._lev.cargas[tipo].reduce((s,c) => s + c.potencia * c.horas * (c.cantidad||1), 0);
  const labelBtn = tipo === 'critica' ? '+ Carga crítica' : tipo === 'secundaria' ? '+ Carga no crítica' : '+ Carga';
  const aparatosDisp = (window._lev.aparatos || []).length;
  return `
    ${edit && aparatosDisp > 0 ? `
    <button type="button" class="btn-outline btn-sm" style="margin-bottom:8px" onclick="copiarAparatosACargas('${tipo}')">
      ↓ Copiar desde "Consumo del cliente" (${aparatosDisp})
    </button>
    <p class="hint" style="margin-top:-4px;margin-bottom:8px">No vuelvas a escribir los aparatos — cópialos de arriba y solo deja los que deben seguir prendidos sin luz.</p>` : ''}
    ${edit ? `<div class="aparatos-rapidos">
      <p class="hint">Acceso rápido:</p>
      <div class="chip-group">
        ${CARGAS_RAPIDAS.map(a=>`<button type="button" class="chip chip-sm" onclick="addCargaRapida('${tipo}',${JSON.stringify(a).replace(/"/g,'&quot;')})">${a.nombre}</button>`).join('')}
      </div>
    </div>` : ''}
    ${window._lev.cargas[tipo].length > 0 ? `
    <div class="carga-row carga-row-header">
      <span>Área</span>
      <span>Equipo</span>
      <span title="Potencia en watts">W</span>
      <span title="Horas de uso al día">h/día</span>
      <span title="Número de unidades">Cant.</span>
      ${edit ? '<span></span>' : ''}
    </div>` : ''}
    <div id="lista-cargas-${tipo}">
      ${window._lev.cargas[tipo].map((c,i)=>`
        <div class="carga-row">
          ${edit
            ? `<select class="aprow-area" onchange="window._lev.cargas['${tipo}'][${i}].area=this.value;_refreshCargasResumen('${tipo}')">${_cargaAreaOpts(c.area)}</select>`
            : `<span class="aprow-area-ro">${esc(c.area||'General')}</span>`}
          <input type="text" value="${esc(c.nombre)}" placeholder="Nombre del equipo" ${edit?`oninput="window._lev.cargas['${tipo}'][${i}].nombre=this.value"`:'disabled'}/>
          <input type="number" value="${c.potencia}" placeholder="0" min="0" ${edit?`oninput="window._lev.cargas['${tipo}'][${i}].potencia=parseFloat(this.value)||0;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          <input type="number" value="${c.horas}" placeholder="0" min="0" step="0.5" ${edit?`oninput="window._lev.cargas['${tipo}'][${i}].horas=parseFloat(this.value)||0;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          <input type="number" value="${c.cantidad||1}" placeholder="1" min="1" ${edit?`oninput="window._lev.cargas['${tipo}'][${i}].cantidad=parseInt(this.value)||1;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          ${edit?`<button type="button" class="btn-del-sm" onclick="delCarga('${tipo}',${i})">✕</button>`:''}
        </div>`).join('')}
    </div>
    <div id="cargas-resumen-${tipo}">${_cargasResumen(tipo)}</div>
    ${edit?`<button type="button" class="btn-outline btn-sm" style="margin-top:6px" onclick="addCarga('${tipo}')">${labelBtn}</button>`:''}
    <p class="kwh-total" id="cargas-total-${tipo}">Total: <strong>${totalW} W</strong> — <strong>${(totalWh/1000).toFixed(2)} kWh/día</strong></p>
  `;
}
// Evita doble captura: trae los aparatos ya escritos en "Consumo del cliente"
// en vez de obligar a re-teclearlos aquí. El técnico solo borra los que no
// deban seguir prendidos sin luz.
window.copiarAparatosACargas = function(tipo) {
  const fuente = window._lev.aparatos || [];
  if (!fuente.length) { toast('No hay aparatos capturados en "Consumo del cliente"', 'error'); return; }
  const yaCopiados = new Set(window._lev.cargas[tipo].map(c => c.nombre));
  let copiados = 0;
  fuente.forEach(a => {
    if (yaCopiados.has(a.nombre)) return;
    window._lev.cargas[tipo].push({ nombre: a.nombre, potencia: a.potencia, horas: a.horas, cantidad: a.cantidad || 1, area: a.area || 'General' });
    copiados++;
  });
  refreshCargas(tipo);
  _triggerLevSave();
  toast(copiados ? `✅ ${copiados} aparato${copiados>1?'s':''} copiado${copiados>1?'s':''} — quita los que no apliquen` : 'Ya estaban copiados todos', copiados?'success':'info');
};
window.addCargaRapida = function(tipo, a) { window._lev.cargas[tipo].push({...a, cantidad:1, area:'General'}); refreshCargas(tipo); _triggerLevSave(); };
window.addCarga = function(tipo) { window._lev.cargas[tipo].push({nombre:'',potencia:0,horas:0,cantidad:1,area:'General'}); refreshCargas(tipo); };
window.delCarga = function(tipo,i) { window._lev.cargas[tipo].splice(i,1); refreshCargas(tipo); _triggerLevSave(); };
window._refreshCargasResumen = function(tipo) {
  const el = document.getElementById(`cargas-resumen-${tipo}`);
  if (el) el.innerHTML = _cargasResumen(tipo);
};
window.refreshCargasTotales = function(tipo) {
  const el = document.getElementById(`cargas-total-${tipo}`);
  if (!el) return;
  const totalW  = window._lev.cargas[tipo].reduce((s,c) => s + c.potencia * (c.cantidad||1), 0);
  const totalWh = window._lev.cargas[tipo].reduce((s,c) => s + c.potencia * c.horas * (c.cantidad||1), 0);
  el.innerHTML = `Total: <strong>${totalW} W</strong> — <strong>${(totalWh/1000).toFixed(2)} kWh/día</strong>`;
  window._refreshCargasResumen(tipo);
};
// El contenedor real en lev-campos.js es "cargas-criticas" / "cargas-secundarias" (plural)
function refreshCargas(tipo) { const el=document.getElementById(`cargas-${tipo}s`); if(el) el.innerHTML=renderCargas(window._lev.cargas[tipo],true,tipo); }

window.toggleGenerador = function(val) {
  document.getElementById('gen-extra').style.display = val==='no' ? 'none' : '';
};
