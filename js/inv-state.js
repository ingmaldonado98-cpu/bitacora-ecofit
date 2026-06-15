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

export async function invSave(){
  await Promise.all([
    invStore.set('catalog', S.materials),
    invStore.set('areas',   {list: S.areas||null, colors: S.areaColors||{}}),
    invStore.set('stock',   {month: S.month, data: S.stock}),
    invStore.set('history', S.history),
  ]);
}

export function normCat(c){
  if(!c)return'General';
  return c.replace(/\s*"\s*(\w+)\s*"\s*$/,'$1').replace(/\s+/,' ').trim();
}

export const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];
export function nowLabel(){const d=new Date();return MONTHS[d.getMonth()]+'-'+String(d.getFullYear()).slice(2);}
