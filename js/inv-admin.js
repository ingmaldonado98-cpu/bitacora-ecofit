// inv-admin.js — Tabs Catálogo y Áreas: render y bind

import { toast, confirmDialog, inputDialog } from './utils.js';
import { S, getCats, catColor, isAdmin,
         invSaveCatalogItem, invDeleteCatalogItem,
         invSaveAreas, invDeleteStockKey,
         invRenameCategoriaEnCatalogo, invRenameCategoriaEnHistorial } from './inv-state.js';
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
      if(!m)return;
      // Un stockMin negativo rompia getSem(): mv*0.2 se vuelve negativo y
      // av<=mv*0.2 practicamente nunca es cierto, asi que el semaforo dejaba
      // de marcar CRITICO/ALERTA para ese material para siempre, sin aviso.
      const val=Math.max(0,+e.target.value||0);
      m.stockMin=val;
      e.target.value=val;
      e.target.style.color=val===0?'var(--text-muted)':'var(--yellow)';
      try{await invSaveCatalogItem(m);toast('Stock mínimo actualizado');}
      catch(er){toast(er.message,'error');}
    };
  });
  document.querySelectorAll('.del-mat').forEach(b=>b.onclick=async()=>{
    if(!await confirmDialog('¿Eliminar este material?'))return;
    const id=b.dataset.id;
    try{
      await invDeleteCatalogItem(id);
      await invDeleteStockKey(id);
      toast('Material eliminado');
    }catch(e){toast(e.message,'error');}
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
    // Antes, si el texto no coincidia exactamente con una categoria existente,
    // se descartaba en silencio (se quedaba con la categoria vieja) pero igual
    // se mostraba "Material actualizado" — el admin creia que el cambio de
    // categoria aplico cuando no. Match insensible a mayusculas/espacios; si
    // aun asi no hay coincidencia, se aborta TODO el edit (nombre y unidad
    // incluidos) con un error claro, en vez de aplicar solo una parte.
    const catMatch=cats.find(c=>c.trim().toLowerCase()===nuevaCat.trim().toLowerCase());
    if(!catMatch){
      toast(`Categoría "${nuevaCat.trim()}" no existe — usa una de: ${cats.join(', ')}`,'error',6000);
      return;
    }
    mat.material=nuevoNombre.trim();
    mat.unidad=nuevaUnidad.trim()||'pzas';
    mat.categoria=catMatch;
    try{await invSaveCatalogItem(mat);toast('Material actualizado: '+mat.material);}
    catch(e){toast(e.message,'error');}
    window._invRender();
  });
  document.getElementById('btn-addmat')?.addEventListener('click',async()=>{
    const mat=document.getElementById('nm-mat').value.trim();
    const min=Math.max(0,+document.getElementById('nm-min').value||0);
    const uni=document.getElementById('nm-uni').value.trim()||'pzas';
    const cat=document.getElementById('nm-cat').value||'General';
    if(!mat){toast('El nombre del material es obligatorio','error');return;}
    // Escanea catalogo E historial para el siguiente numero — un material
    // eliminado y luego re-agregado en la misma categoria ya no reutiliza
    // el ID del que se borro (mezclaria su historial con el nuevo material).
    const id=autoGenId(cat,S.materials,S.history);
    const nuevo={id,material:mat,stockMin:min,unidad:uni,categoria:cat};
    try{await invSaveCatalogItem(nuevo);toast('"'+mat+'" agregado con ID: '+id);}
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
    try{
      await invSaveAreas(a=>({ list:[...(a.list||CATS_DEFAULT),nombre], colors:a.colors }));
      toast('"'+nombre+'" agregada ✓');
    }catch(e){toast(e.message,'error');}
    window._invRender();
  };
  document.querySelectorAll('.edit-area').forEach(b=>b.onclick=async()=>{
    const cat=b.dataset.cat;
    const nuevoNombre=await inputDialog('Editar nombre del área:',cat);
    if(!nuevoNombre?.trim()||nuevoNombre.trim()===cat)return;
    const nuevo=nuevoNombre.trim();
    const cats=getCats();
    if(cats.find(c=>c.toLowerCase()===nuevo.toLowerCase()&&c!==cat)){toast('Ese nombre ya existe','error');return;}
    try{
      await invSaveAreas(a=>{
        const list=[...(a.list||CATS_DEFAULT)];
        const idx=list.indexOf(cat);
        if(idx!==-1)list[idx]=nuevo;
        return { list, colors:a.colors };
      });
      await invRenameCategoriaEnCatalogo(cat,nuevo);
      await invRenameCategoriaEnHistorial(cat,nuevo);
      toast('Área actualizada a "'+nuevo+'"');
    }catch(e){toast(e.message,'error');}
    window._invRender();
  });
  document.querySelectorAll('.del-area').forEach(b=>b.onclick=async()=>{
    const cat=b.dataset.cat;
    const count=S.materials.filter(m=>m.categoria===cat).length;
    const msg=count>0
      ?'El área "'+cat+'" tiene '+count+' material(es).\nEstos pasarán a "General".\n\n¿Continuar?'
      :'¿Eliminar el área "'+cat+'"?';
    if(!await confirmDialog(msg))return;
    try{
      await invSaveAreas(a=>({ list:(a.list||CATS_DEFAULT).filter(c=>c!==cat), colors:a.colors }));
      await invRenameCategoriaEnCatalogo(cat,'General');
      // Antes editar-area SI reescribia el historial retroactivamente pero
      // eliminar-area NO — el Historial podia mostrar un area que ya no
      // existia en ningun lado de Catalogo/Areas. Mismo tratamiento ahora.
      await invRenameCategoriaEnHistorial(cat,'General');
      toast('Área "'+cat+'" eliminada');
    }catch(e){toast(e.message,'error');}
    window._invRender();
  });
}

export function autoGenId(cat,materials,history){
  const MAP={'Estante A2':'A2','Estante A3':'A3','Estante A4':'A4','Estante A5':'A5',
    'Estante A6':'A6','Estante B':'EB','Estante B3':'B3','Estante B5':'B5',
    'Estante B6':'B6','Estante B7':'B7','Estante C2':'C2','Cableado':'CAB',
    'Eléctrica':'ELE','Estructura':'EST','Tornillería':'TOR','K2 Systems':'K2','General':'GEN'};
  const prefix=MAP[cat]||cat.replace(/[^A-Z0-9]/gi,'').slice(0,4).toUpperCase()||'MAT';
  const nums=id=>id&&id.startsWith(prefix+'-')?parseInt(id.split('-')[1]||0):NaN;
  const fromCatalog=materials.map(m=>nums(m.id)).filter(n=>!isNaN(n));
  // Un material eliminado ya no esta en `materials`, pero su ID puede seguir
  // en Historial — sin esto, autoGenId reutilizaba el mismo ID para un
  // material nuevo, mezclando su historial con el del material borrado.
  const fromHistory=(history||[]).flatMap(h=>(h.records||[]).map(r=>nums(r.id))).filter(n=>!isNaN(n));
  const existing=[...fromCatalog,...fromHistory];
  const next=(existing.length?Math.max(...existing):0)+1;
  return prefix+'-'+String(next).padStart(3,'0');
}
