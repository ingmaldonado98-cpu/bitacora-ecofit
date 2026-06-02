// inventario.js — Control de Almacén · Bitácora Ecofit V6

import { toast, confirmDialog, inputDialog } from './utils.js';
import { inventario as invStore } from './db.js';

// ── Materiales base (136 items) ────────────────────────────────────────────
const RAW=[
 ["A2-001",'Abrazadera 3/4"',"pzas","Estante A2"],["A2-002",'Abrazadera de uña 1"',"pzas","Estante A2"],
 ["A2-003",'Abrazadera de uña 1/2"',"pzas","Estante A2"],["A2-004",'Abrazadera omega 1 1/4"',"pzas","Estante A2"],
 ["A2-005",'Abrazadera omega 1"',"pzas","Estante A2"],["A2-006",'Abrazadera omega 1/2"',"pzas","Estante A2"],
 ["A2-007",'Abrazadera omega 3/4"',"pzas","Estante A2"],["A2-008",'Abrazadera omega 3/8"',"pzas","Estante A2"],
 ["A2-009",'Abrazadera tipo O 1 1/4"',"pzas","Estante A2"],["A2-010",'Abrazadera tipo O 1/2"',"pzas","Estante A2"],
 ["A2-011",'Abrazadera unicanal 1 1/4"',"pzas","Estante A2"],["A2-012",'Abrazadera unicanal 1"',"pzas","Estante A2"],
 ["A2-013",'Abrazadera unicanal 1/2"',"pzas","Estante A2"],["A2-014",'Abrazadera unicanal 3/4"',"pzas","Estante A2"],
 ["A2-015",'Abrazadera uña 1 1/2"',"pzas","Estante A2"],["A2-016",'Abrazadera uña 1 1/4"',"pzas","Estante A2"],
 ["A2-017",'Cincho 11 3/4"',"pzas","Estante A2"],["A2-018",'Cincho 4"',"pzas","Estante A2"],
 ["A2-019",'Cincho 7 7/8"',"pzas","Estante A2"],
 ["TOR-001","Arandela 13/64","pzas","Tornillería"],["TOR-002",'Taquete 1/4"',"pzas","Tornillería"],
 ["TOR-003",'Taquete 3/8"',"pzas","Tornillería"],["TOR-004",'Taquete 5/16"',"pzas","Tornillería"],
 ["TOR-005",'Tuerca inox 3/8"',"pzas","Tornillería"],
 ["A3-001",'Glándula 1"',"pzas","Estante A3"],["A3-002",'Glándula 1/2"',"pzas","Estante A3"],
 ["A3-003",'Glándula 3/4"',"pzas","Estante A3"],
 ["A4-001",'Conector PVC 1"',"pzas","Estante A4"],["A4-002",'Conector PVC 1 1/4"',"pzas","Estante A4"],
 ["A4-003",'Conector PVC 1/2"',"pzas","Estante A4"],["A4-004",'Conector PVC 3/4"',"pzas","Estante A4"],
 ["A4-005",'Contra 1"',"pzas","Estante A4"],["A4-006",'Contra 1 1/2"',"pzas","Estante A4"],
 ["A4-007",'Contra 1 1/4"',"pzas","Estante A4"],["A4-008",'Contra 1/2"',"pzas","Estante A4"],
 ["A4-009",'Contra 2"',"pzas","Estante A4"],["A4-010",'Contra 3/4"',"pzas","Estante A4"],
 ["A4-011",'Cople PVC 1"',"pzas","Estante A4"],["A4-012",'Cople PVC 1 1/4"',"pzas","Estante A4"],
 ["A4-013",'Cople PVC 1/2"',"pzas","Estante A4"],["A4-014",'Cople PVC 3/4"',"pzas","Estante A4"],
 ["A5-001","Breaker DC 16A","pzas","Estante A5"],["A5-002","Breaker DC 20A","pzas","Estante A5"],
 ["A5-003","Breaker DC 32A","pzas","Estante A5"],["A5-004","Fusibles 20A","pzas","Estante A5"],
 ["A5-005","Fusibles 30A","pzas","Estante A5"],["A5-006","MC4 14-10 AWG","pzas","Estante A5"],
 ["A5-007","MC4 14-10 AWG Patos","pzas","Estante A5"],["A5-008","Portafusibles 20A","pzas","Estante A5"],
 ["A5-009","Portafusibles 30A","pzas","Estante A5"],
 ["A6-001","Breaker AC 63A","pzas","Estante A6"],["A6-002","Breaker DC doble 50A","pzas","Estante A6"],
 ["EB-001",'Condulet C 2"',"pzas","Estante B"],["EB-002",'Condulet LB 1"',"pzas","Estante B"],
 ["EB-003",'Condulet LB 1 1/2"',"pzas","Estante B"],["EB-004",'Condulet LB 1 1/4"',"pzas","Estante B"],
 ["EB-005",'Condulet LB 2"',"pzas","Estante B"],["EB-006",'Condulet LL 2"',"pzas","Estante B"],
 ["EB-007",'Condulet LR 1"',"pzas","Estante B"],["EB-008",'Condulet LR 1 1/2"',"pzas","Estante B"],
 ["EB-009",'Condulet LR 1 1/4"',"pzas","Estante B"],["EB-010",'Condulet LR 2"',"pzas","Estante B"],
 ["EB-011",'Condulet T 1 1/2"',"pzas","Estante B"],["EB-012",'Condulet T 1 1/4"',"pzas","Estante B"],
 ["EB-013",'Condulet T 2"',"pzas","Estante B"],
 ["B3-001",'Curva PVC 1"',"pzas","Estante B3"],["B3-002",'Curva PVC 1 1/2"',"pzas","Estante B3"],
 ["B3-003",'Curva PVC 1 1/4"',"pzas","Estante B3"],["B3-004",'Curva PVC 1/2"',"pzas","Estante B3"],
 ["B3-005",'Curva PVC 3/4"',"pzas","Estante B3"],
 ["B5-001",'Condulet C 1/2"',"pzas","Estante B5"],["B5-002",'Condulet C 3/4"',"pzas","Estante B5"],
 ["B5-003",'Condulet LB 1/2"',"pzas","Estante B5"],["B5-004",'Condulet LB 3/4"',"pzas","Estante B5"],
 ["B5-005",'Condulet LL 1/2"',"pzas","Estante B5"],["B5-006",'Condulet LL 3/4"',"pzas","Estante B5"],
 ["B5-007",'Condulet LR 1/2"',"pzas","Estante B5"],["B5-008",'Condulet LR 3/4"',"pzas","Estante B5"],
 ["B5-009",'Condulet T 1/2"',"pzas","Estante B5"],["B5-010",'Condulet T 3/4"',"pzas","Estante B5"],
 ["B6-001",'Condulet C 1 1/4"',"pzas","Estante B6"],["B6-002",'Condulet LL 1 1/2"',"pzas","Estante B6"],
 ["B6-003",'Condulet LL 1 1/4"',"pzas","Estante B6"],
 ["B7-001",'Condulet C 1 1/2"',"pzas","Estante B7"],["B7-002",'Cople PVC 2"',"pzas","Estante B7"],
 ["B7-003",'Curva PVC 2"',"pzas","Estante B7"],
 ["C2-001","Clips drenaje panel","pzas","Estante C2"],["C2-002","Estructura Frontal Aluminex","pzas","Estante C2"],
 ["C2-003","Estructura Trasera Aluminex","pzas","Estante C2"],["C2-004","L Foot","pzas","Estante C2"],
 ["C2-005","NXT-AR","pzas","Estante C2"],["C2-006","NXT-AUA 30/46","pzas","Estante C2"],
 ["C2-007","NXT-CLIP","pzas","Estante C2"],["C2-008","NXT-CRC","pzas","Estante C2"],
 ["C2-009","NXT-RS","pzas","Estante C2"],["C2-010","Tapas NXT-AUA 30/46","pzas","Estante C2"],
 ["C2-011","Tapas Riel Aluminex","pzas","Estante C2"],
 ["CAB-001","Cable verde","m","Cableado"],["CAB-002","CAL 2 blanco","m","Cableado"],
 ["CAB-003","CAL 2 negro","m","Cableado"],["CAB-004","CAL 2 rojo","m","Cableado"],
 ["CAB-005","CAL 4 blanco","m","Cableado"],["CAB-006","CAL 4 negro","m","Cableado"],
 ["CAB-007","CAL 4 rojo","m","Cableado"],["CAB-008","CAL 6 blanco","m","Cableado"],
 ["CAB-009","CAL 6 negro","m","Cableado"],["CAB-010","CAL 6 rojo","m","Cableado"],
 ["CAB-011","CAL 8 blanco","m","Cableado"],["CAB-012","CAL 8 negro","m","Cableado"],
 ["CAB-013","CAL 8 rojo","m","Cableado"],["CAB-014","CAL 10 blanco","m","Cableado"],
 ["CAB-015","CAL 10 negro","m","Cableado"],["CAB-016","CAL 10 rojo","m","Cableado"],
 ["CAB-017","CAL 12 blanco","m","Cableado"],["CAB-018","CAL 12 negro","m","Cableado"],
 ["CAB-019","CAL 12 rojo","m","Cableado"],["CAB-020","CAL 14 blanco","m","Cableado"],
 ["CAB-021","CAL 14 negro","m","Cableado"],["CAB-022","CAL 14 rojo","m","Cableado"],
 ["CAB-023","FV 10 negro","m","Cableado"],["CAB-024","FV 10 rojo","m","Cableado"],
 ["CAB-025","FV 12 negro","m","Cableado"],["CAB-026","FV 12 rojo","m","Cableado"],
 ["ELE-001","Ferrules 10","pzas","Eléctrica"],["ELE-002","Ferrules 12","pzas","Eléctrica"],
 ["ELE-003","Ferrules 8","pzas","Eléctrica"],["ELE-004","Ferrules Dobles","pzas","Eléctrica"],
 ["ELE-005","Fusible 60A","pzas","Eléctrica"],["ELE-006","Fusible 80A","pzas","Eléctrica"],
 ["EST-001","Clamps","pzas","Estructura"],["EST-002","Empalme","pzas","Estructura"],
 ["EST-003","End Clamps","pzas","Estructura"],["EST-004","Soporte Frontal","pzas","Estructura"],
 ["EST-005","Soporte Trasero","pzas","Estructura"],["EST-006","Tapadera Final","pzas","Estructura"],
 ["GEN-001","Clips para riel","pzas","General"]
];

const MATS_DEFAULT=RAW.map(([id,material,unidad,categoria])=>({id,material,unidad,categoria,stockMin:0}));

const STOCK_MARZO={
 "A2-001":5,"A2-002":4,"A2-003":26,"A2-004":1,"A2-005":1,"A2-006":2,"A2-007":9,
 "A2-008":8,"A2-009":2,"A2-010":24,"A2-011":5,"A2-012":2,"A2-013":4,"A2-014":1,
 "A2-015":2,"A2-016":1,"A2-017":4,"A2-018":300,"A2-019":600,
 "TOR-001":0,"TOR-002":0,"TOR-003":0,"TOR-004":0,"TOR-005":100,
 "A3-001":22,"A3-002":23,"A3-003":20,
 "A4-001":9,"A4-002":3,"A4-003":4,"A4-004":2,"A4-005":12,"A4-006":19,
 "A4-007":18,"A4-008":17,"A4-009":6,"A4-010":14,"A4-011":4,"A4-012":3,"A4-013":16,"A4-014":22,
 "A5-001":0,"A5-002":0,"A5-003":0,"A5-004":14,"A5-005":10,"A5-006":60,"A5-007":11,"A5-008":4,"A5-009":8,
 "A6-001":2,"A6-002":2,
 "EB-001":0,"EB-002":0,"EB-003":0,"EB-004":0,"EB-005":0,"EB-006":0,"EB-007":25,
 "EB-008":0,"EB-009":0,"EB-010":0,"EB-011":0,"EB-012":0,"EB-013":0,
 "B3-001":5,"B3-002":0,"B3-003":0,"B3-004":6,"B3-005":6,
 "B5-001":0,"B5-002":2,"B5-003":2,"B5-004":5,"B5-005":0,"B5-006":0,"B5-007":4,"B5-008":1,"B5-009":0,"B5-010":0,
 "B6-001":2,"B6-002":1,"B6-003":1,"B7-001":1,"B7-002":0,"B7-003":1,
 "C2-001":14,"C2-002":3,"C2-003":3,"C2-004":14,"C2-005":2,"C2-006":11,
 "C2-007":48,"C2-008":13,"C2-009":8,"C2-010":34,"C2-011":35,
 "ELE-001":0,"ELE-002":0,"ELE-003":0,"ELE-004":0,"ELE-005":5,"ELE-006":14,
 "EST-001":9,"EST-002":9,"EST-003":9,"EST-004":7,"EST-005":9,"EST-006":0,"GEN-001":0
};

const CATS_DEFAULT=["Estante A2","Tornillería","Estante A3","Estante A4","Estante A5","Estante A6",
 "Estante B","Estante B3","Estante B5","Estante B6","Estante B7","Estante C2",
 "Cableado","Eléctrica","Estructura","General"];

const CAT_C={"Estante A2":"#60a5fa","Tornillería":"#a78bfa","Estante A3":"#34d399",
 "Estante A4":"#f472b6","Estante A5":"#fbbf24","Estante A6":"#fb923c",
 "Estante B":"#e879f9","Estante B3":"#4ade80","Estante B5":"#2dd4bf",
 "Estante B6":"#818cf8","Estante B7":"#fb7185","Estante C2":"#38bdf8",
 "Cableado":"#facc15","Eléctrica":"#f87171","Estructura":"#94a3b8","General":"#64748b"};

const CAT_PALETTE=["#60a5fa","#a78bfa","#34d399","#f472b6","#fbbf24","#fb923c",
 "#e879f9","#4ade80","#2dd4bf","#818cf8","#fb7185","#38bdf8",
 "#facc15","#f87171","#94a3b8","#64748b","#c084fc","#f97316","#06b6d4","#84cc16"];

const AV_COLORS=["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#84cc16","#f97316"];
const avColor=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%AV_COLORS.length;return AV_COLORS[h];};
const avInitials=n=>n.trim().split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();

// Semáforo — adaptado al tema oscuro
const SEM={
  verde:   {label:'BIEN',    c:'#4ade80', bg:'rgba(74,222,128,.15)'},
  amarillo:{label:'ALERTA',  c:'#fbbf24', bg:'rgba(251,191,36,.15)'},
  rojo:    {label:'CRÍTICO', c:'#f87171', bg:'rgba(248,113,113,.15)'},
  none:    {label:'—',       c:'#94b8a4', bg:'transparent'},
};

function getSem(a,m){
  if(a===''||a==null)return'none';
  const av=+a,mv=+m;
  if(isNaN(av)||isNaN(mv)||mv===0)return'none';
  if(av<=mv*0.2)return'rojo';
  if(av<mv)return'amarillo';
  return'verde';
}

// ── Sesión activa (se actualiza en cada llamada al router) ─────────────────
let _session = null;

// ── Estado del módulo (persiste entre navegaciones a #inventario) ───────────
const S={
  tab:'captura', materials:[], month:'', stock:{}, history:[],
  catFilter:'Todos', saving:false, areas:null, areaColors:{}
};

const getCats  = ()=>S.areas||CATS_DEFAULT;
const catColor = (cat,i)=>CAT_C[cat]||(S.areaColors?.[cat])||CAT_PALETTE[i%CAT_PALETTE.length];
const isAdmin  = ()=>_session&&(_session.rol==='admin'||_session.rol==='lider');
const whoami   = ()=>_session?.nombre||_session?.username||'Usuario';

// ── Persistencia en IndexedDB ──────────────────────────────────────────────
async function invSave(){
  await Promise.all([
    invStore.set('catalog', S.materials),
    invStore.set('areas',   {list: S.areas||null, colors: S.areaColors||{}}),
    invStore.set('stock',   {month: S.month, data: S.stock}),
    invStore.set('history', S.history),
  ]);
}

function normCat(c){
  if(!c)return'General';
  return c.replace(/\s*"\s*(\w+)\s*"\s*$/,'$1').replace(/\s+/,' ').trim();
}
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];
function nowLabel(){const d=new Date();return MONTHS[d.getMonth()]+'-'+String(d.getFullYear()).slice(2);}

// ── Render interno (re-dibuja #app sin pasar por el router) ───────────────
function invRender(){
  const app=document.getElementById('app');
  if(!app)return;
  app.innerHTML=renderApp();
  invBind();
}

// Globales usados en handlers inline
window._invRender=invRender;
window._invTab=tab=>{S.tab=tab;invRender();};
window._invFilter=cat=>{S.catFilter=cat;invRender();};

// ── App principal ──────────────────────────────────────────────────────────
function renderApp(){
  const tabs=[
    {k:'captura',  i:'package',          l:'Captura'},
    {k:'estado',   i:'traffic-signal',   l:'Estado'},
    {k:'historial',i:'calendar',         l:'Historial'},
    ...(isAdmin()?[
      {k:'catalogo',i:'wrench',          l:'Catálogo'},
      {k:'areas',  i:'map-pin',          l:'Áreas'},
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

// ── Tab Captura ────────────────────────────────────────────────────────────
function renderCaptura(){
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
      ${cat!=='Todos'?`<span style="width:5px;height:5px;border-radius:50%;background:${catColor(cat,i-1)};display:inline-block;flex-shrink:0"></span>`:''}
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

// ── Tab Estado ─────────────────────────────────────────────────────────────
function renderEstado(){
  const conMin=S.materials.filter(m=>+m.stockMin>0);
  if(!conMin.length)return`
    <div class="empty-msg" style="padding:40px 0">
      <ph-icon name="wrench" size="40"></ph-icon>
      <p style="margin-top:12px">Sin stocks mínimos configurados.</p>
      <p style="font-size:.8rem">Ve a ⚙️ Catálogo y define los valores mínimos.</p>
    </div>`;

  const grupos={rojo:[],amarillo:[],verde:[],none:[]};
  conMin.forEach(m=>{grupos[getSem(S.stock[m.id],m.stockMin)].push(m);});
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

// ── Tab Historial ──────────────────────────────────────────────────────────
function renderHistorial(){
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

// ── Tab Catálogo ───────────────────────────────────────────────────────────
function renderCatalogo(){
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

// ── Tab Áreas ──────────────────────────────────────────────────────────────
function renderAreas(){
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

// ── Bind principal ─────────────────────────────────────────────────────────
function invBind(){
  // Mes editable
  const mi=document.getElementById('inv-month');
  if(mi) mi.onchange=e=>{ S.month=e.target.value; };

  if(S.tab==='captura')   bindCaptura();
  if(S.tab==='catalogo')  bindCatalogo();
  if(S.tab==='historial') bindHistorial();
  if(S.tab==='areas')     bindAreas();
}

// ── Bind Captura ───────────────────────────────────────────────────────────
function bindCaptura(){
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

  // Guardar mes
  const bg=document.getElementById('inv-btn-guardar');
  if(bg) bg.onclick=async()=>{
    if(!S.month.trim()){toast('Ingresa el mes antes de guardar','error');return;}
    const nota=await inputDialog('¿Alguna observación del inventario? (opcional)','','Ej: "Falta revisar Estante B"');
    if(nota===null)return;
    S.saving=true;invRender();
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
    S.saving=false;invRender();
  };

  // Nuevo mes
  const bn=document.getElementById('inv-btn-nuevo');
  if(bn) bn.onclick=async()=>{
    if(!await confirmDialog('¿Iniciar nuevo mes?\nSe borrará el Stock Actual.\nAsegúrate de haber guardado "'+S.month+'" primero.'))return;
    S.stock={};S.month=nowLabel();
    try{await invSave();toast('Inventario limpiado. Listo para '+S.month);}
    catch(e){toast(e.message,'error');}
    invRender();
  };

  // Exportar captura actual
  const be=document.getElementById('inv-btn-export');
  if(be) be.onclick=()=>exportarCaptura();
}

// ── Bind Catálogo ──────────────────────────────────────────────────────────
function bindCatalogo(){
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
    invRender();
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
    invRender();
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
    invRender();
  });
}

// ── Bind Historial ─────────────────────────────────────────────────────────
function bindHistorial(){
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

// ── Bind Áreas ─────────────────────────────────────────────────────────────
function bindAreas(){
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
    invRender();
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
    invRender();
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
    invRender();
  });
}

// ── Auto-generate ID ───────────────────────────────────────────────────────
function autoGenId(cat,materials){
  const MAP={'Estante A2':'A2','Estante A3':'A3','Estante A4':'A4','Estante A5':'A5',
    'Estante A6':'A6','Estante B':'EB','Estante B3':'B3','Estante B5':'B5',
    'Estante B6':'B6','Estante B7':'B7','Estante C2':'C2','Cableado':'CAB',
    'Eléctrica':'ELE','Estructura':'EST','Tornillería':'TOR','General':'GEN'};
  const prefix=MAP[cat]||cat.replace(/[^A-Z0-9]/gi,'').slice(0,4).toUpperCase()||'MAT';
  const existing=materials.filter(m=>m.id.startsWith(prefix+'-'))
    .map(m=>parseInt(m.id.split('-')[1]||0)).filter(n=>!isNaN(n));
  const next=(existing.length?Math.max(...existing):0)+1;
  return prefix+'-'+String(next).padStart(3,'0');
}

// ── Exportación Excel (SheetJS lazy) ──────────────────────────────────────
function loadXLSX(cb){
  if(window.XLSX){cb();return;}
  toast('Preparando Excel…','info');
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=()=>{cb();};
  s.onerror=()=>toast('Error al cargar librería Excel','error');
  document.head.appendChild(s);
}

function exportarCaptura(){
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

function exportarHistorial(idx){
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

// ── Entry point (llamado por el router de la bitácora) ─────────────────────
export async function renderInventario(session) {
  _session = session;

  // Cargar datos desde IndexedDB
  const [catalog, areasData, stockData, historyData] = await Promise.all([
    invStore.get('catalog'),
    invStore.get('areas'),
    invStore.get('stock'),
    invStore.get('history'),
  ]);

  S.materials  = (catalog || MATS_DEFAULT.map(m=>({...m}))).map(m=>({...m,categoria:normCat(m.categoria)}));
  S.areas      = areasData?.list ?? null;
  S.areaColors = areasData?.colors ?? {};
  S.month      = stockData?.month ?? nowLabel();
  S.stock      = stockData?.data  ?? {...STOCK_MARZO};
  S.history    = (historyData ?? []).map(h=>({...h,records:(h.records||[]).map(r=>({...r,categoria:normCat(r.categoria)}))}));

  // Preservar tab activa si ya estaba en la vista; reset saving
  S.tab      = S.tab || 'captura';
  S.catFilter= S.catFilter || 'Todos';
  S.saving   = false;

  return renderApp() + `<script>window._invBind&&window._invBind();<\/script>`;
}

// Exponer globales para re-render interno
window._invBind = invBind;
