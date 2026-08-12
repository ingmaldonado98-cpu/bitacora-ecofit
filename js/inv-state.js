// inv-state.js — Estado compartido, semáforo y helpers del inventario

import { inventario as invStore } from './db.js';
import { CATS_DEFAULT, CAT_C, CAT_PALETTE } from './inv-data.js';

export const AV_COLORS=["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#84cc16","#f97316"];
export const avColor=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%AV_COLORS.length;return AV_COLORS[h];};
export const avInitials=n=>n.trim().split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();

export const SEM={
  verde:   {label:'BIEN',    c:'#4ade80', bg:'rgba(74,222,128,.15)'},
  amarillo:{label:'ALERTA',  c:'#fbbf24', bg:'rgba(251,191,36,.15)'},
  rojo:    {label:'CRÍTICO', c:'#f87171', bg:'rgba(248,113,113,.15)'},
  none:    {label:'—',       c:'#94b8a4', bg:'transparent'},
};

export function getSem(a,m){
  if(a===''||a==null)return'none';
  const av=+a,mv=+m;
  if(isNaN(av)||isNaN(mv)||mv===0)return'none';
  if(av<=mv*0.2)return'rojo';
  if(av<mv)return'amarillo';
  return'verde';
}

let _session = null;
export function setSession(s){ _session = s; }

export const S={
  tab:'captura', materials:[], month:'', stock:{}, history:[],
  catFilter:'Todos', saving:false, areas:null, areaColors:{}
};

export const getCats  = ()=>S.areas||CATS_DEFAULT;
export const catColor = (cat,i)=>CAT_C[cat]||(S.areaColors?.[cat])||CAT_PALETTE[i%CAT_PALETTE.length];
export const isAdmin  = ()=>_session&&(_session.rol==='admin'||_session.rol==='lider');
export const whoami   = ()=>_session?.nombre||_session?.username||'Usuario';

// ── Guardado por colección, con fusión contra el servidor ──────────────────
// Antes invSave() reescribía catalog+areas+stock+history COMPLETOS en cada
// llamada, desde la copia en memoria de quien guardaba — sin fusión ni
// control de versión. Dos personas con Inventario abierto a la vez (el caso
// normal: técnico capturando + admin editando catálogo) hacían que la
// última escritura borrara en silencio los cambios de la otra, sin aviso.
// Ahora cada acción escribe solo su propia colección, y para catalog/stock
// (los más propensos a edición concurrente) se fusiona contra lo que haya
// en el servidor en ese momento en vez de sobrescribir con la copia local.

// Catálogo: fusiona un solo material (agregar/editar) contra el servidor —
// así un material agregado por otro admin mientras se edita este no se pierde.
export async function invSaveCatalogItem(item){
  const server = (await invStore.get('catalog')) || [];
  const idx = server.findIndex(m=>m.id===item.id);
  if(idx>=0) server[idx]=item; else server.push(item);
  S.materials = server;
  await invStore.set('catalog', server);
}
export async function invDeleteCatalogItem(id){
  const server = ((await invStore.get('catalog')) || []).filter(m=>m.id!==id);
  S.materials = server;
  await invStore.set('catalog', server);
}
// Áreas: mutateFn recibe {list,colors} frescos del servidor y devuelve la
// versión actualizada — el llamador decide qué cambia (agregar/renombrar/
// eliminar una sola área) sin arriesgar el resto de las áreas de otro admin.
export async function invSaveAreas(mutateFn){
  const server = (await invStore.get('areas')) || {list:null,colors:{}};
  const updated = mutateFn({ list: server.list?[...server.list]:null, colors:{...(server.colors||{})} });
  S.areas = updated.list; S.areaColors = updated.colors;
  await invStore.set('areas', updated);
  return updated;
}

// Stock: fusiona los materiales tocados localmente (S.stock) sobre el stock
// vigente del servidor — un material que otra persona no tocó conserva su
// último valor real en vez de ser pisado por la copia local (que pudo
// haberse cargado antes de que esa otra persona guardara).
export async function invSaveStock(){
  const server = (await invStore.get('stock')) || { month: S.month, data: {} };
  const merged = { ...(server.data||{}), ...S.stock };
  S.stock = merged;
  await invStore.set('stock', { month: S.month, data: merged });
}
// Reinicio de mes: a diferencia de invSaveStock(), aquí SÍ se quiere
// reemplazar todo el stock (vacío) — es la acción explícita de "Nuevo mes".
export async function invResetStock(){
  S.stock = {};
  await invStore.set('stock', { month: S.month, data: {} });
}
// Eliminar un solo material del stock (al borrar el material del catálogo)
// sin arriesgar las capturas de otros materiales hechas por alguien más.
export async function invDeleteStockKey(id){
  const server = (await invStore.get('stock')) || { month: S.month, data: {} };
  const data = {...(server.data||{})};
  delete data[id];
  S.stock = data;
  await invStore.set('stock', { month: S.month, data });
}

// Renombrar/reasignar la categoría de TODOS los materiales que la tenían —
// usado por editar/eliminar área. Re-lee el catálogo fresco del servidor
// antes de aplicar el cambio en vez de partir de S.materials (que puede
// estar desactualizado si alguien más agregó/editó un material mientras
// tanto).
export async function invRenameCategoriaEnCatalogo(oldCat, newCat){
  const server = (await invStore.get('catalog')) || [];
  server.forEach(m=>{ if(m.categoria===oldCat) m.categoria=newCat; });
  S.materials = server;
  await invStore.set('catalog', server);
}
// Misma idea para el historial — antes solo editar-área reescribía el
// historial retroactivamente; eliminar-área lo dejaba con un nombre de
// área que ya no existe en Catálogo/Áreas. Ahora ambas acciones son
// consistentes.
export async function invRenameCategoriaEnHistorial(oldCat, newCat){
  const server = (await invStore.get('history')) || [];
  server.forEach(h=>(h.records||[]).forEach(r=>{ if(r.categoria===oldCat) r.categoria=newCat; }));
  S.history = server;
  await invStore.set('history', server);
}

// Historial: fusiona el nuevo registro del mes contra el historial vigente
// del servidor (reemplaza solo la entrada del mismo mes, conserva las demás
// que otra persona haya guardado mientras tanto).
export async function invSaveHistoryEntry(entry){
  const server = (await invStore.get('history')) || [];
  const merged = [entry, ...server.filter(h=>h.fecha!==entry.fecha)];
  S.history = merged;
  await invStore.set('history', merged);
  return merged;
}
export function normCat(c){
  if(!c)return'General';
  return c.replace(/\s*"\s*(\w+)\s*"\s*$/,'$1').replace(/\s+/g,' ').trim();
}

export const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];
export function nowLabel(){const d=new Date();return MONTHS[d.getMonth()]+'-'+String(d.getFullYear()).slice(2);}
