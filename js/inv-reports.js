// inv-reports.js — Tabs Estado, Historial y Consumo: render, bind y exportación

import { toast } from './utils.js';
import { projects } from './db.js';
import { S, SEM, avColor, avInitials } from './inv-state.js';
import { CAT_C } from './inv-data.js';
import { exportarHistorial } from './inv-captura.js';

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function renderEstado(){
  const conMin=S.materials.filter(m=>+m.stockMin>0);
  if(!conMin.length)return`
    <div class="empty-msg" style="padding:40px 0">
      <ph-icon name="wrench" size="40"></ph-icon>
      <p style="margin-top:12px">Sin stocks mínimos configurados.</p>
      <p style="font-size:.8rem">Ve a ⚙️ Catálogo y define los valores mínimos.</p>
    </div>`;

  const grupos={rojo:[],amarillo:[],verde:[],none:[]};
  conMin.forEach(m=>{
    const s=S.stock[m.id]===''||S.stock[m.id]==null?'none'
      :(+S.stock[m.id]<=+m.stockMin*0.2?'rojo':+S.stock[m.id]<+m.stockMin?'amarillo':'verde');
    grupos[s].push(m);
  });
  const sinCapturar=conMin.filter(m=>S.stock[m.id]===''||S.stock[m.id]==null).length;

  const seccion=(key,titulo,emoji)=>{
    const items=grupos[key];
    if(!items.length)return'';
    const cfg=SEM[key];
    return`
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:15px">${emoji}</span>
          <span style="font-weight:700;color:${cfg.c};font-size:.9rem">${titulo}</span>
          <span style="background:${cfg.bg};color:${cfg.c};border:1px solid ${cfg.c}50;
            border-radius:20px;padding:1px 9px;font-size:.75rem;font-weight:800;font-family:monospace">
            ${items.length}
          </span>
        </div>
        <div style="background:var(--surface);border:1px solid ${cfg.c}30;border-radius:var(--radius);overflow:hidden">
          ${items.map((m,i)=>{
            const val=S.stock[m.id];
            const hasVal=val!==''&&val!=null;
            const cc=CAT_C[m.categoria]||'#94a3b8';
            return`<div style="display:flex;align-items:center;justify-content:space-between;
              padding:9px 14px;background:${i%2===0?'var(--surface)':'var(--surface2)'};
              border-bottom:1px solid ${cfg.c}15">
              <div>
                <div style="font-weight:600;font-size:.88rem;color:var(--text)">${m.material}</div>
                <div style="font-size:.7rem;color:var(--text-muted);margin-top:1px;display:flex;align-items:center;gap:4px">
                  <span style="width:5px;height:5px;border-radius:50%;background:${cc};display:inline-block"></span>
                  ${m.categoria}
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-family:monospace;font-size:1.2rem;font-weight:900;color:${hasVal?cfg.c:'var(--text-muted)'}">
                  ${hasVal?val:'—'}
                </div>
                <div style="font-size:.7rem;color:var(--text-muted)">mín: ${m.stockMin} ${m.unidad}</div>
              </div>
            </div>`;}).join('')}
        </div>
      </div>`;
  };

  return`
  <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;gap:20px;flex-wrap:wrap">
    ${['rojo','amarillo','verde'].map(s=>`
      <div style="text-align:center">
        <div style="font-size:1.5rem;font-weight:900;color:${SEM[s].c};font-family:monospace">${grupos[s].length}</div>
        <div style="font-size:.68rem;color:${SEM[s].c};font-weight:700;letter-spacing:.05em">${SEM[s].label}</div>
      </div>`).join('')}
    <div style="width:1px;background:var(--border);margin:0 2px"></div>
    <div style="text-align:center">
      <div style="font-size:1.5rem;font-weight:900;color:var(--text-muted);font-family:monospace">${sinCapturar}</div>
      <div style="font-size:.68rem;color:var(--text-muted);font-weight:700;letter-spacing:.05em">SIN CAPTURAR</div>
    </div>
  </div>
  ${seccion('rojo','Crítico — requiere reposición urgente','🔴')}
  ${seccion('amarillo','Alerta — por debajo del mínimo','🟡')}
  ${seccion('verde','Bien — stock suficiente','🟢')}
  ${grupos.none.length?`<div class="empty-msg-sm">+ ${grupos.none.length} materiales sin stock capturado</div>`:''}`;
}

export function renderHistorial(){
  if(!S.history.length)return`
    <div class="empty-msg" style="padding:40px 0">
      <ph-icon name="calendar" size="40"></ph-icon>
      <p style="margin-top:12px">No hay meses guardados aún.</p>
      <p style="font-size:.8rem">Captura el inventario y presiona Guardar.</p>
    </div>`;

  return S.history.map((h,i)=>{
    const counts=h.records.reduce((a,r)=>{if(r.estado&&r.estado!=='none')a[r.estado]=(a[r.estado]||0)+1;return a;},{});
    const semBadges=['verde','amarillo','rojo'].filter(s=>counts[s])
      .map(s=>`<span style="color:${SEM[s].c};font-family:monospace;font-size:.8rem">${counts[s]} ${SEM[s].label}</span>`)
      .join(' · ');

    const rows=h.records.map((r,j)=>{
      const cfg=SEM[r.estado]||SEM.none;
      const cc=CAT_C[r.categoria]||'#64748b';
      return`<tr style="background:${j%2===0?'var(--surface)':'var(--surface2)'}">
        <td style="padding:6px 12px;font-size:.83rem;color:var(--text)">${r.material}</td>
        <td style="padding:6px 12px;font-size:.72rem;color:${cc}">
          <span style="display:inline-flex;align-items:center;gap:3px">
            <span style="width:5px;height:5px;border-radius:50%;background:${cc};display:inline-block"></span>
            ${r.categoria||''}
          </span>
        </td>
        <td style="padding:6px 12px;font-family:monospace;color:var(--text-muted);font-size:.78rem">${r.stockMin||'—'}</td>
        <td style="padding:6px 12px;font-family:monospace;color:var(--g100);font-weight:700">${r.stockActual??'—'}</td>
        <td style="padding:6px 12px">
          <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:700;
            color:${cfg.c};background:${cfg.bg};border:1px solid ${cfg.c}40;font-family:monospace">
            ${cfg.label}
          </span>
        </td>
      </tr>`;
    }).join('');

    return`
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
      <div class="inv-hhead hist-toggle" data-idx="${i}">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-family:monospace;color:var(--g100);font-size:1rem;font-weight:800">${h.fecha}</span>
            ${h.capturadoPor?`<span style="display:flex;align-items:center;gap:5px;font-size:.8rem;color:var(--text)">
              <span style="width:20px;height:20px;border-radius:50%;background:${avColor(h.capturadoPor)};
                display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;
                color:#fff;flex-shrink:0">${avInitials(h.capturadoPor)}</span>
              <b>${h.capturadoPor}</b>
            </span>`:''}
            <span style="color:var(--text-muted);font-size:.78rem">
              ${new Date(h.savedAt).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
            </span>
          </div>
          ${h.nota?`<div style="margin-top:4px;font-size:.78rem;color:var(--text-muted);font-style:italic">📝 ${h.nota}</div>`:''}
          <div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap">${semBadges}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button class="btn-outline btn-sm export-hist" data-idx="${i}"
            style="font-size:.72rem;padding:4px 8px" onclick="event.stopPropagation()">
            📊 Excel
          </button>
          <span style="color:var(--g300);font-size:.85rem" class="hist-arrow">▼</span>
        </div>
      </div>
      <div id="inv-hbody-${i}" style="display:none;border-top:1px solid var(--border)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th class="inv-th" style="text-align:left">MATERIAL</th>
              <th class="inv-th" style="text-align:left;width:130px">CATEGORÍA</th>
              <th class="inv-th" style="width:60px">MÍN.</th>
              <th class="inv-th" style="width:70px">ACTUAL</th>
              <th class="inv-th" style="width:90px">ESTADO</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function renderConsumo() {
  const now = new Date();
  const selMes  = S.consumoMes  ?? now.getMonth();
  const selAnio = S.consumoAnio ?? now.getFullYear();

  return `
  <div class="card" style="margin-top:12px">
    <div class="card-title-row">
      <h3 class="card-title">Reporte de consumo mensual</h3>
    </div>
    <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 12px">
      Consolida los materiales (BOM) de todos los proyectos cerrados en el mes seleccionado.
    </p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="cons-mes" class="select-field" style="flex:1;min-width:120px">
        ${MESES_ES.map((m,i)=>`<option value="${i}" ${i===selMes?'selected':''}>${m}</option>`).join('')}
      </select>
      <input id="cons-anio" type="number" class="inv-mes-inp" style="width:90px"
             value="${selAnio}" min="2020" max="2099" />
      <button class="btn-primary btn-sm" onclick="window._invGenConsumo()">
        Generar reporte
      </button>
    </div>
  </div>
  <div id="cons-resultado"></div>`;
}

export function bindHistorial(){
  document.querySelectorAll('.hist-toggle').forEach(h=>{
    h.onclick=()=>{
      const body=document.getElementById('inv-hbody-'+h.dataset.idx);
      const arrow=h.querySelector('.hist-arrow');
      const open=body.style.display==='none';
      body.style.display=open?'block':'none';
      if(arrow)arrow.textContent=open?'▲':'▼';
    };
  });
  document.querySelectorAll('.export-hist').forEach(b=>{
    b.onclick=()=>exportarHistorial(+b.dataset.idx);
  });
}

window._invGenConsumo = async function() {
  const mes  = parseInt(document.getElementById('cons-mes').value);
  const anio = parseInt(document.getElementById('cons-anio').value);
  S.consumoMes  = mes;
  S.consumoAnio = anio;

  const todos = await projects.getAll();

  const cerrados = todos.filter(p => {
    if (p.estado !== 'cerrado') return false;
    const entrada = (p.statusLog || []).find(e => e.to === 'cerrado');
    if (!entrada) return false;
    const d = new Date(entrada.at);
    return d.getMonth() === mes && d.getFullYear() === anio;
  });

  const el = document.getElementById('cons-resultado');
  if (!cerrados.length) {
    el.innerHTML = `<div class="card" style="margin-top:8px">
      <p style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:16px 0">
        Sin proyectos cerrados en ${MESES_ES[mes]} ${anio}.
      </p>
    </div>`;
    return;
  }

  const totales = {};
  const proyectosConBOM = [];
  const proyectosSinBOM = [];

  cerrados.forEach(p => {
    const bom = p.projectConfig?.computed?.bom || [];
    if (bom.length) {
      proyectosConBOM.push(p);
      bom.forEach(item => {
        const key = item.partNum || item.name;
        if (!totales[key]) totales[key] = { name: item.name, partNum: item.partNum||'—', qty: 0, unit: item.unit, grp: item.grp||'General' };
        totales[key].qty += item.qty;
      });
    } else {
      proyectosSinBOM.push(p);
    }
  });

  const grupos = {};
  Object.values(totales).forEach(item => {
    if (!grupos[item.grp]) grupos[item.grp] = [];
    grupos[item.grp].push(item);
  });

  const tablaHtml = Object.entries(grupos).map(([grp, items]) => `
    <tr style="background:var(--surface2)">
      <td colspan="4" style="padding:6px 10px;font-weight:700;font-size:.8rem;color:var(--accent)">
        ${grp}
      </td>
    </tr>
    ${items.map(it=>`
    <tr>
      <td style="padding:5px 10px;font-size:.82rem">${it.name}</td>
      <td style="padding:5px 10px;font-size:.78rem;color:var(--text-muted)">${it.partNum}</td>
      <td style="padding:5px 10px;font-weight:700;text-align:right">${it.qty}</td>
      <td style="padding:5px 10px;font-size:.78rem;color:var(--text-muted)">${it.unit}</td>
    </tr>`).join('')}
  `).join('');

  const sinBOMMsg = proyectosSinBOM.length
    ? `<p style="font-size:.78rem;color:var(--yellow);margin:8px 0 0">
        ⚠ ${proyectosSinBOM.length} proyecto(s) sin BOM calculado:
        ${proyectosSinBOM.map(p=>`<strong>${p.displayId}</strong>`).join(', ')}
       </p>` : '';

  el.innerHTML = `
  <div class="card" style="margin-top:8px">
    <div class="card-title-row">
      <h3 class="card-title">${MESES_ES[mes]} ${anio} — ${cerrados.length} proyecto(s) cerrado(s)</h3>
      <button class="btn-outline btn-sm" onclick="window._invExportConsumo()" style="flex-shrink:0">
        Exportar Excel
      </button>
    </div>
    ${sinBOMMsg}
    <div style="margin-top:10px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.83rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border2)">
            <th style="text-align:left;padding:6px 10px">Material</th>
            <th style="text-align:left;padding:6px 10px">Parte #</th>
            <th style="text-align:right;padding:6px 10px">Cantidad</th>
            <th style="text-align:left;padding:6px 10px">Unidad</th>
          </tr>
        </thead>
        <tbody>${tablaHtml}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border2)">
      <p style="font-size:.78rem;color:var(--text-muted);margin:0">
        Proyectos incluidos: ${proyectosConBOM.map(p=>`<strong>${p.displayId}</strong> (${p.clientName})`).join(' · ')}
      </p>
    </div>
  </div>`;

  window._consumoExportData = { mes, anio, grupos, cerrados, proyectosSinBOM };
};

window._invExportConsumo = async function() {
  const d = window._consumoExportData;
  if (!d) { toast('Genera el reporte primero', 'error'); return; }

  toast('Preparando Excel…', 'info', 3000);
  let XLSX;
  try {
    const mod = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
    XLSX = mod;
  } catch {
    toast('Sin conexión para cargar exportador', 'error'); return;
  }

  const rows = [['Material','Parte #','Cantidad','Unidad','Categoría']];
  Object.entries(d.grupos).forEach(([grp, items]) => {
    items.forEach(it => rows.push([it.name, it.partNum, it.qty, it.unit, grp]));
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:40},{wch:16},{wch:10},{wch:8},{wch:18}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${MESES_ES[d.mes]} ${d.anio}`);
  XLSX.writeFile(wb, `Consumo_${MESES_ES[d.mes]}_${d.anio}.xlsx`);
  toast('✅ Excel exportado');
};
