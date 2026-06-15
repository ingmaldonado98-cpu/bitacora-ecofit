// inv-admin.js — Tabs Catálogo y Áreas: render y bind

import { toast, confirmDialog, inputDialog } from './utils.js';
import { S, getCats, catColor, isAdmin, invSave } from './inv-state.js';
import { CAT_C, CATS_DEFAULT } from './inv-data.js';

export function renderCatalogo(){
  const cats=getCats();
  const rows=S.materials.map((m,i)=>{
    const cc=CAT_C[m.categoria]||'#94a3b8';
    return`<tr style="background:${i%2===0?'var(--surface)':'var(--surface2)'}">
      <td style="padding:7px 12px;font-family:monospace">
        <span style="display:inline-block;font-size:.7rem;background:var(--surface3);
          border:1px solid ${cc}50;border-radius:4px;padding:2px 6px;color:${cc};font-weight:700">${m.id}</span>
      </td>
      <td style="padding:7px 12px;font-weight:600;font-size:.86rem;color:var(--text)">${m.material}</td>
      <td style="padding:7px 12px">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:.78rem;color:var(--text-muted)">
          <span style="width:6px;height:6px;border-radius:50%;background:${cc};display:inline-block;flex-shrink:0"></span>
          ${m.categoria}
        </span>
      </td>
      <td style="padding:7px 12px;width:90px">
        <input type="number" min="0" value="${m.stockMin}" data-id="${m.id}"
          class="inv-min-inp" style="width:72px;font-family:monospace;
          color:${+m.stockMin===0?'var(--text-muted)':'var(--yellow)'}">
      </td>
      <td style="padding:7px 12px;font-size:.8rem;color:var(--text-muted);width:60px">${m.unidad}</td>
      <td style="padding:7px 12px;width:80px">
        <div style="display:flex;gap:4px">
          <button class="btn-sm btn-outline edit-mat" data-id="${m.id}" style="padding:3px 7px">✏️</button>
          <button class="btn-sm del-mat" data-id="${m.id}"
            style="padding:3px 7px;background:var(--surface3);border:1px solid var(--red);
              color:var(--red);border-radius:var(--radius-sm)">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return`
  <div class="card" style="margin-bottom:10px">
    <div style="font-size:.78rem;color:var(--g300);font-weight:700;letter-spacing:.06em;margin-bottom:11px">
      + AGREGAR MATERIAL
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:flex-end">
      <input id="nm-mat" placeholder="Nombre del material" class="input-field" style="flex:1;min-width:150px">
      <input id="nm-min" placeholder="Mín." type="number" class="input-field" style="width:70px">
      <input id="nm-uni" placeholder="Unidad" class="input-field" style="width:70px">
      <select id="nm-cat" class="select-field" style="min-width:120px">
        <option value="">Categoría…</option>
        ${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
      <button class="btn-primary btn-sm" id="btn-addmat">Agregar</button>
    </div>
    <span class="hint">El ID se genera automáticamente según la categoría.</span>
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th class="inv-th" style="text-align:left;width:90px">ID</th>
          <th class="inv-th" style="text-align:left">MATERIAL</th>
          <th class="inv-th" style="text-align:left;width:140px">CATEGORÍA</th>
          <th class="inv-th" style="width:90px">STOCK MÍN.</th>
          <th class="inv-th" style="width:60px">UNIDAD</th>
          <th class="inv-th" style="width:80px"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderAreas(){
  const cats=getCats();
  const rows=cats.map((cat,i)=>{
    const cc=catColor(cat,i);
    const count=S.materials.filter(m=>m.categoria===cat).length;
    return`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
      background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px">
      <span style="width:14px;height:14px;border-radius:4px;background:${cc};display:inline-block;flex-shrink:0"></span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:.9rem;color:var(--text)">${cat}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${count} material${count!==1?'es':''}</div>
      </div>
      <div style="display:flex;gap:5px">
        <button class="btn-sm btn-outline edit-area" data-idx="${i}" data-cat="${cat}" style="padding:3px 7px">✏️</button>
        <button class="btn-sm del-area" data-idx="${i}" data-cat="${cat}"
          style="padding:3px 7px;background:var(--surface3);border:1px solid var(--red);
            color:var(--red);border-radius:var(--radius-sm)">✕</button>
      </div>
    </div>`;
  }).join('');

  return`
  <div class="card" style="margin-bottom:10px">
    <div style="font-size:.78rem;color:var(--g300);font-weight:700;letter-spacing:.06em;margin-bottom:10px">
      + AGREGAR ÁREA
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="na-nombre" placeholder="Nombre del área (ej: Estante D1)" class="input-field" style="flex:1;min-width:180px">
      <button class="btn-primary btn-sm" id="btn-addarea">Agregar</button>
    </div>
    <span class="hint">El área aparecerá en los filtros de Captura y en el Catálogo.</span>
  </div>
  <div>${rows||'<p class="empty-msg">Sin áreas configuradas.</p>'}</div>
  <div class="card" style="background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3);margin-top:10px">
    <p style="font-size:.8rem;color:var(--yellow);line-height:1.6">
      ⚠️ Eliminar un área no borra los materiales — los mueve a <b>General</b>.
      Reasígnalos desde Catálogo.
    </p>
  </div>`;
}

export function bindCatalogo(){
  document.querySelectorAll('.inv-min-inp').forEach(inp=>{
    inp.onchange=async e=>{
      const id=e.target.dataset.id;
      const m=S.materials.find(x=>x.id===id);
      if(m){
        m.stockMin=+e.target.value||0;
        e.target.style.color=+m.stockMin===0?'var(--text-muted)':'var(--yellow)';
      }
      try{await invSave();toast('Stock mínimo actualizado');}
      catch(er){toast(er.message,'error');}
    };
  });
  document.querySelectorAll('.del-mat').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('¿Eliminar este material?'))return;
    const id=b.dataset.id;
    S.materials=S.materials.filter(m=>m.id!==id);
    delete S.stock[id];
    try{await invSave();toast('Material eliminado');}
    catch(e){toast(e.message,'error');}
    window._invRender();
  });
  document.querySelectorAll('.edit-mat').forEach(b=>b.onclick=async()=>{
    const mat=S.materials.find(m=>m.id===b.dataset.id);
    if(!mat)return;
    const nuevoNombre=await inputDialog('Editar nombre:',mat.material);
    if(nuevoNombre===null)return;
    if(!nuevoNombre.trim()){toast('El nombre no puede estar vacío','error');return;}
    const nuevaUnidad=await inputDialog('Editar unidad:',mat.unidad||'pzas');
    if(nuevaUnidad===null)return;
    const cats=getCats();
    const nuevaCat=await inputDialog('Editar categoría:',mat.categoria||'General',cats.join(' | '));
    if(nuevaCat===null)return;
    mat.material=nuevoNombre.trim();
    mat.unidad=nuevaUnidad.trim()||'pzas';
    mat.categoria=cats.includes(nuevaCat.trim())?nuevaCat.trim():(mat.categoria||'General');
    invSave().then(()=>toast('Material actualizado: '+mat.material)).catch(e=>toast(e.message,'error'));
    window._invRender();
  });
  document.getElementById('btn-addmat')?.addEventListener('click',async()=>{
    const mat=document.getElementById('nm-mat').value.trim();
    const min=+document.getElementById('nm-min').value||0;
    const uni=document.getElementById('nm-uni').value.trim()||'pzas';
    const cat=document.getElementById('nm-cat').value||'General';
    if(!mat){toast('El nombre del material es obligatorio','error');return;}
    const id=autoGenId(cat,S.materials);
    S.materials.push({id,material:mat,stockMin:min,unidad:uni,categoria:cat});
    try{await invSave();toast('"'+mat+'" agregado con ID: '+id);}
    catch(e){toast(e.message,'error');}
    window._invRender();
  });
}

export function bindAreas(){
  const btnAddArea=document.getElementById('btn-addarea');
  if(btnAddArea) btnAddArea.onclick=async()=>{
    const nombre=document.getElementById('na-nombre').value.trim();
    if(!nombre){toast('Ingresa el nombre del área','error');return;}
    const cats=getCats();
    if(cats.find(c=>c.toLowerCase()===nombre.toLowerCase())){toast('Esa área ya existe','error');return;}
    if(!S.areas)S.areas=[...CATS_DEFAULT];
    S.areas.push(nombre);
    try{await invSave();toast('"'+nombre+'" agregada ✓');}
    catch(e){toast(e.message,'error');}
    window._invRender();
  };
  document.querySelectorAll('.edit-area').forEach(b=>b.onclick=async()=>{
    const cat=b.dataset.cat;
    const nuevoNombre=await inputDialog('Editar nombre del área:',cat);
    if(!nuevoNombre?.trim()||nuevoNombre.trim()===cat)return;
    const nuevo=nuevoNombre.trim();
    const cats=getCats();
    if(cats.find(c=>c.toLowerCase()===nuevo.toLowerCase()&&c!==cat)){toast('Ese nombre ya existe','error');return;}
    if(!S.areas)S.areas=[...CATS_DEFAULT];
    const idx=S.areas.indexOf(cat);
    if(idx!==-1)S.areas[idx]=nuevo;
    S.materials.forEach(m=>{if(m.categoria===cat)m.categoria=nuevo;});
    S.history.forEach(h=>{h.records.forEach(r=>{if(r.categoria===cat)r.categoria=nuevo;});});
    try{await invSave();toast('Área actualizada a "'+nuevo+'"');}
    catch(e){toast(e.message,'error');}
    window._invRender();
  });
  document.querySelectorAll('.del-area').forEach(b=>b.onclick=async()=>{
    const cat=b.dataset.cat;
    const count=S.materials.filter(m=>m.categoria===cat).length;
    const msg=count>0
      ?'El área "'+cat+'" tiene '+count+' material(es).\nEstos pasarán a "General".\n\n¿Continuar?'
      :'¿Eliminar el área "'+cat+'"?';
    if(!await confirmDialog(msg))return;
    if(!S.areas)S.areas=[...CATS_DEFAULT];
    S.areas=S.areas.filter(c=>c!==cat);
    S.materials.forEach(m=>{if(m.categoria===cat)m.categoria='General';});
    try{await invSave();toast('Área "'+cat+'" eliminada');}
    catch(e){toast(e.message,'error');}
    window._invRender();
  });
}

export function autoGenId(cat,materials){
  const MAP={'Estante A2':'A2','Estante A3':'A3','Estante A4':'A4','Estante A5':'A5',
    'Estante A6':'A6','Estante B':'EB','Estante B3':'B3','Estante B5':'B5',
    'Estante B6':'B6','Estante B7':'B7','Estante C2':'C2','Cableado':'CAB',
    'Eléctrica':'ELE','Estructura':'EST','Tornillería':'TOR','K2 Systems':'K2','General':'GEN'};
  const prefix=MAP[cat]||cat.replace(/[^A-Z0-9]/gi,'').slice(0,4).toUpperCase()||'MAT';
  const existing=materials.filter(m=>m.id.startsWith(prefix+'-'))
    .map(m=>parseInt(m.id.split('-')[1]||0)).filter(n=>!isNaN(n));
  const next=(existing.length?Math.max(...existing):0)+1;
  return prefix+'-'+String(next).padStart(3,'0');
}
