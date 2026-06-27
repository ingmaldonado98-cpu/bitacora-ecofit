// inv-captura.js — Tab Captura: render, bind y exportación Excel

import { toast, confirmDialog, inputDialog } from './utils.js';
import { S, getSem, SEM, getCats, isAdmin, whoami, invSave, nowLabel } from './inv-state.js';
import { CAT_C } from './inv-data.js';

export function renderCaptura(){
  const noMin=S.materials.filter(m=>+m.stockMin===0).length;
  const summary=S.materials.reduce((a,m)=>{
    const s=getSem(S.stock[m.id],m.stockMin);
    if(s!=='none')a[s]=(a[s]||0)+1;return a;},{});
  const filled=S.materials.filter(m=>S.stock[m.id]!==''&&S.stock[m.id]!=null).length;
  const pct=S.materials.length?Math.round(filled/S.materials.length*100):0;
  const pctColor=pct===100?'#4ade80':pct>60?'#fbbf24':'#f87171';
  const filtered=S.materials.filter(m=>S.catFilter==='Todos'||m.categoria===S.catFilter);
  const cats=getCats();

  const chips=['Todos',...cats].map((cat,i)=>`
    <span class="inv-chip ${S.catFilter===cat?'inv-chip-on':''}"
      onclick="window._invFilter('${cat.replace(/'/g,"\\'")}')">
      ${cat!=='Todos'?`<span style="width:5px;height:5px;border-radius:50%;background:${cats[i-1]&&(CAT_C[cat]||'#60a5fa')};display:inline-block;flex-shrink:0"></span>`:''}
      ${cat}
    </span>`).join('');

  const rows=filtered.map(m=>{
    const val=S.stock[m.id]??'';
    const s=getSem(val,m.stockMin);
    const cfg=SEM[s];
    const bc=s==='rojo'?'var(--red)':s==='amarillo'?'var(--yellow)':s==='verde'?'var(--green-vivo)':'var(--border2)';
    const cc=CAT_C[m.categoria]||'#60a5fa';
    const hasVal=val!==''&&val!=null;
    return`<tr class="inv-row">
      <td style="padding:8px 12px;text-align:left">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:7px;height:7px;border-radius:50%;background:${cc};display:inline-block;flex-shrink:0"></span>
          <span style="font-weight:600;font-size:.86rem;color:var(--text)">${m.material}</span>
        </div>
        <div style="font-size:.7rem;color:var(--text-muted);padding-left:13px;margin-top:1px">${m.categoria}</div>
      </td>
      <td style="padding:8px 12px;width:120px">
        <input type="number" min="0" placeholder="—" value="${val}" data-id="${m.id}"
          class="inv-stock-inp"
          style="border-color:${hasVal?bc:'var(--border2)'};
                 color:${hasVal?'var(--text)':'var(--text-muted)'};
                 background:${hasVal?'var(--surface2)':'var(--surface)'}">
      </td>
      <td style="padding:8px 12px;width:90px">
        <span id="inv-sem-${m.id}" class="inv-sem-badge"
          style="color:${cfg.c};background:${cfg.bg};border:1px solid ${cfg.c}40">
          ${cfg.label}
        </span>
      </td>
    </tr>`;
  }).join('');

  return`
  ${noMin>0&&isAdmin()?`
    <div class="inv-alert">
      <ph-icon name="warning" size="16"></ph-icon>
      <span><b>${noMin} materiales</b> con Stock Mínimo = 0. El semáforo no se activará. Configura en ⚙️ Catálogo.</span>
    </div>`:''}

  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:.8rem;color:var(--text-muted)">Progreso de captura</span>
      <span style="font-size:.85rem;font-weight:800;color:${pctColor};font-family:monospace">
        ${filled}/${S.materials.length} · ${pct}%
      </span>
    </div>
    <div style="background:var(--surface3);border-radius:99px;height:8px;overflow:hidden">
      <div style="height:100%;width:${pct}%;border-radius:99px;transition:width .4s;
        background:${pct===100?'var(--green-vivo)':pct>60?'var(--yellow)':'var(--red)'}"></div>
    </div>
  </div>

  <div class="card" style="padding:10px 14px;margin-bottom:10px;display:flex;gap:20px;flex-wrap:wrap">
    ${['verde','amarillo','rojo'].map(s=>`
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${SEM[s].c};display:inline-block"></span>
        <span style="font-size:.75rem;color:var(--text-muted)">${SEM[s].label}</span>
        <span style="font-size:1.2rem;font-weight:800;color:${SEM[s].c};font-family:monospace">${summary[s]||0}</span>
      </div>`).join('')}
  </div>

  <div class="inv-chips">${chips}</div>

  <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th class="inv-th" style="text-align:left;padding-left:12px">MATERIAL</th>
          <th class="inv-th" style="width:120px">STOCK ACTUAL</th>
          <th class="inv-th" style="width:90px">ESTADO</th>
        </tr></thead>
        <tbody>${rows||'<tr><td colspan="3" class="empty-msg" style="padding:24px">Sin resultados para este filtro</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="inv-actbar">
    ${isAdmin()?'<button class="btn-outline btn-sm" id="inv-btn-nuevo" style="border-color:var(--red);color:var(--red)">🗑 Nuevo mes</button>':''}
    <div style="flex:1"></div>
    <button class="btn-outline btn-sm" id="inv-btn-export">📊 Excel</button>
    <button class="btn-primary" id="inv-btn-guardar" ${S.saving?'disabled':''}>
      ${S.saving?'Guardando…':'💾 Guardar "'+S.month+'"'}
    </button>
  </div>`;
}

export function bindCaptura(){
  document.querySelectorAll('.inv-stock-inp').forEach(inp=>{
    inp.oninput=e=>{
      const id=e.target.dataset.id;
      const val=e.target.value;
      S.stock[id]=val===''?null:val;
      const mat=S.materials.find(m=>m.id===id);
      if(!mat)return;
      const s=getSem(val,mat.stockMin);
      const cfg=SEM[s];
      const bc=s==='rojo'?'var(--red)':s==='amarillo'?'var(--yellow)':s==='verde'?'var(--green-vivo)':'var(--border2)';
      const hasVal=val!==''&&val!=null;
      e.target.style.borderColor=hasVal?bc:'var(--border2)';
      e.target.style.background=hasVal?'var(--surface2)':'var(--surface)';
      e.target.style.color=hasVal?'var(--text)':'var(--text-muted)';
      const sem=document.getElementById('inv-sem-'+id);
      if(sem){
        sem.textContent=cfg.label;
        sem.style.color=cfg.c;
        sem.style.background=cfg.bg;
        sem.style.borderColor=cfg.c+'40';
      }
    };
  });

  const bg=document.getElementById('inv-btn-guardar');
  if(bg) bg.onclick=async()=>{
    if(!S.month.trim()){toast('Ingresa el mes antes de guardar','error');return;}
    const nota=await inputDialog('¿Alguna observación del inventario? (opcional)','','Ej: "Falta revisar Estante B"');
    if(nota===null)return;
    S.saving=true;window._invRender();
    const mesGuardado=S.month;
    try{
      const records=S.materials.map(m=>({
        ...m,
        stockActual:S.stock[m.id]!==''&&S.stock[m.id]!=null?+S.stock[m.id]:null,
        estado:getSem(S.stock[m.id],m.stockMin)
      }));
      const entry={fecha:mesGuardado,capturadoPor:whoami(),savedAt:new Date().toISOString(),nota:nota.trim()||null,records};
      S.history=[entry,...S.history.filter(h=>h.fecha!==mesGuardado)];
      await invSave();
      S.saving=false;
      const iniciar=await confirmDialog('✅ Mes "'+mesGuardado+'" guardado.\n\n¿Deseas limpiar Stock Actual e iniciar el nuevo mes?');
      if(iniciar){
        S.stock={};S.month=nowLabel();
        await invSave();
        toast('Nuevo mes iniciado: '+S.month);
      } else {
        toast('Mes "'+mesGuardado+'" guardado ✓');
      }
    }catch(e){toast(e.message,'error');}
    S.saving=false;window._invRender();
  };

  const bn=document.getElementById('inv-btn-nuevo');
  if(bn) bn.onclick=async()=>{
    if(!await confirmDialog('¿Iniciar nuevo mes?\nSe borrará el Stock Actual.\nAsegúrate de haber guardado "'+S.month+'" primero.'))return;
    S.stock={};S.month=nowLabel();
    try{await invSave();toast('Inventario limpiado. Listo para '+S.month);}
    catch(e){toast(e.message,'error');}
    window._invRender();
  };

  const be=document.getElementById('inv-btn-export');
  if(be) be.onclick=()=>exportarCaptura();
}

export function loadXLSX(cb){
  if(window.XLSX){cb();return;}
  if(!navigator.onLine){
    toast('Sin conexión — usa el botón Excel estando en línea la primera vez para cachear la librería','error',6000);
    return;
  }
  toast('Preparando Excel…','info');
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  // Timeout: online pero el CDN cuelga (señal lenta/CDN bloqueado) — sin esto
  // el usuario quedaba sin feedback tras "Preparando Excel…".
  const to=setTimeout(()=>{ s.remove(); toast('El cargador de Excel tardó demasiado — revisa tu conexión e intenta de nuevo','error',6000); },15000);
  s.onload=()=>{ clearTimeout(to); cb(); };
  s.onerror=()=>{ clearTimeout(to); s.remove(); toast('No se pudo cargar la librería Excel (CDN inaccesible) — reintenta','error',6000); };
  document.head.appendChild(s);
}

export function exportarCaptura(){
  loadXLSX(()=>{
    if(!window.XLSX)return;
    const wb=XLSX.utils.book_new();
    const hdr=[['ID','Material','Categoría','Unidad','Stock Mínimo','Stock Actual','Estado','Mes','Capturista']];
    const data=S.materials.map(m=>{
      const val=S.stock[m.id]!=null&&S.stock[m.id]!==''?+S.stock[m.id]:null;
      return[m.id,m.material,m.categoria||'',m.unidad,m.stockMin,val??'',SEM[getSem(val,m.stockMin)]?.label||'—',S.month,whoami()];
    });
    const ws=XLSX.utils.aoa_to_sheet([...hdr,...data]);
    ws['!cols']=[{wch:12},{wch:35},{wch:18},{wch:8},{wch:12},{wch:13},{wch:10},{wch:10},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws,'Inventario '+S.month);
    if(S.history.length){
      const hdr2=[['Mes','Fecha guardado','Capturado por','ID','Material','Categoría','Mín.','Actual','Estado']];
      const data2=[];
      S.history.forEach(h=>{
        h.records.forEach(r=>{
          data2.push([h.fecha,new Date(h.savedAt).toLocaleDateString('es-MX'),h.capturadoPor||'',
            r.id,r.material,r.categoria||'',r.stockMin,r.stockActual??'',SEM[r.estado]?.label||'—']);
        });
      });
      const ws2=XLSX.utils.aoa_to_sheet([...hdr2,...data2]);
      ws2['!cols']=[{wch:12},{wch:16},{wch:16},{wch:12},{wch:35},{wch:18},{wch:8},{wch:13},{wch:10}];
      XLSX.utils.book_append_sheet(wb,ws2,'Historial completo');
    }
    XLSX.writeFile(wb,'Inventario_'+S.month+'_'+new Date().toLocaleDateString('es-MX').replace(/\//g,'-')+'.xlsx');
    toast('Excel descargado ✓');
  });
}

export function exportarHistorial(idx){
  loadXLSX(()=>{
    if(!window.XLSX)return;
    const h=S.history[idx];
    if(!h)return;
    const wb=XLSX.utils.book_new();
    const hdr=[['ID','Material','Categoría','Unidad','Stock Mínimo','Stock Actual','Estado']];
    const data=h.records.map(r=>[r.id,r.material,r.categoria||'',r.unidad,r.stockMin,r.stockActual??'',SEM[r.estado]?.label||'—']);
    const ws=XLSX.utils.aoa_to_sheet([...hdr,...data]);
    ws['!cols']=[{wch:12},{wch:35},{wch:18},{wch:8},{wch:12},{wch:13},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws,'Inventario '+h.fecha);
    XLSX.writeFile(wb,'Inventario_'+h.fecha+'_'+new Date().toLocaleDateString('es-MX').replace(/\//g,'-')+'.xlsx');
    toast('Excel de "'+h.fecha+'" descargado ✓');
  });
}
