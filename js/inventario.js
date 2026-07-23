// inventario.js — Control de Almacén · punto de entrada y renderApp

import { inventario as invStore } from './db.js';
import { S, setSession, isAdmin, avColor, avInitials, whoami, nowLabel, normCat } from './inv-state.js';
import { MATS_DEFAULT, STOCK_MARZO } from './inv-data.js';
import { renderCaptura, bindCaptura } from './inv-captura.js';
import { renderCatalogo, renderAreas, bindCatalogo, bindAreas } from './inv-admin.js';
import { renderEstado, renderHistorial, renderConsumo, bindHistorial } from './inv-reports.js';

function renderApp(){
  const tabs=[
    {k:'captura',  i:'package',          l:'Captura'},
    {k:'estado',   i:'traffic-signal',   l:'Estado'},
    {k:'historial',i:'calendar',         l:'Historial'},
    ...(isAdmin()?[
      {k:'catalogo',i:'wrench',          l:'Catálogo'},
      {k:'areas',  i:'map-pin',          l:'Áreas'},
      {k:'consumo',i:'chart-bar',        l:'Consumo'},
    ]:[])
  ];

  const tabsHtml=tabs.map(t=>`
    <button class="inv-tab ${S.tab===t.k?'inv-tab-on':''}" onclick="window._invTab('${t.k}')">
      <ph-icon name="${t.i}" size="13"></ph-icon>${t.l}
    </button>`).join('');

  let content='';
  if(S.tab==='captura')  content=renderCaptura();
  else if(S.tab==='estado')   content=renderEstado();
  else if(S.tab==='historial')content=renderHistorial();
  else if(S.tab==='catalogo') content=renderCatalogo();
  else if(S.tab==='areas')    content=renderAreas();
  else if(S.tab==='consumo')  content=renderConsumo();

  return`
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#dashboard')">
      <ph-icon name="caret-left"></ph-icon>
    </button>
    <div class="hdr-info" style="flex:1">
      <span class="hdr-id">Almacén</span>
      <span class="hdr-sub">${S.materials.length} materiales</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${S.month !== nowLabel()
        ? `<span class="inv-month-warn" title="El período mostrado no es el mes actual (${nowLabel()})">⚠ período pasado</span>`
        : ''}
      ${isAdmin()
        ?`<input id="inv-month" value="${S.month}" placeholder="${nowLabel()}"
            class="inv-month-inp">`
        :`<span class="inv-month-ro">${S.month}</span>`}
      <div class="inv-uv"
        style="background:${avColor(whoami())}" title="${whoami()}">
        ${avInitials(whoami())}
      </div>
    </div>
  </div>
  <div class="inv-tabs-bar">${tabsHtml}</div>
  ${content}`;
}

function invBind(){
  const mi=document.getElementById('inv-month');
  if(mi) mi.onchange=e=>{ S.month=e.target.value; invRender(); };

  if(S.tab==='captura')   bindCaptura();
  if(S.tab==='catalogo')  bindCatalogo();
  if(S.tab==='historial') bindHistorial();
  if(S.tab==='areas')     bindAreas();
}

function invRender(){
  const app=document.getElementById('app');
  if(!app)return;
  app.innerHTML=renderApp();
  invBind();
}

window._invRender=invRender;
window._invTab=tab=>{S.tab=tab;invRender();};
window._invFilter=cat=>{S.catFilter=cat;invRender();};
window._invBind=invBind;

export async function renderInventario(session) {
  setSession(session);

  const [catalog, areasData, stockData, historyData] = await Promise.all([
    invStore.get('catalog'),
    invStore.get('areas'),
    invStore.get('stock'),
    invStore.get('history'),
  ]);

  S.materials  = (catalog || MATS_DEFAULT.map(m=>({...m}))).map(m=>({...m,categoria:normCat(m.categoria)}));

  // Migración: agregar K2 items que no existan aún en el catálogo
  const K2_SEED = MATS_DEFAULT.filter(m => m.id.startsWith('K2-'));
  const existingIds = new Set(S.materials.map(m => m.id));
  const missing = K2_SEED.filter(m => !existingIds.has(m.id));
  if (missing.length) {
    S.materials = [...S.materials, ...missing];
    invStore.set('catalog', S.materials).catch(() => {});
  }

  S.areas      = areasData?.list ?? null;
  S.areaColors = areasData?.colors ?? {};
  S.month      = stockData?.month ?? nowLabel();
  S.stock      = stockData?.data  ?? {...STOCK_MARZO};
  S.history    = (historyData ?? []).map(h=>({...h,records:(h.records||[]).map(r=>({...r,categoria:normCat(r.categoria)}))}));

  S.tab      = S.tab || 'captura';
  S.catFilter= S.catFilter || 'Todos';
  S.saving   = false;

  return renderApp() + `<script>window._invBind&&window._invBind();<\/script>`;
}
