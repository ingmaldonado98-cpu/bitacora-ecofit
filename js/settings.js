// settings.js — Configuración Admin

import { users, config, kv, getPendingQueue } from './db.js';
import { getDeadQueue, clearDeadQueue } from './sync-queue.js';
import { esc, toast } from './utils.js';
import { isAdmin, ROLES } from './auth.js';
import { icon } from './icons.js';
import { getStatus as getOneDriveStatusObj } from './onedrive.js';
import { isNative } from './platform.js';
import { renderTableroPlaceholder } from './calc-tablero.js';
import './settings-users.js';   // registra window.* de perfil/usuarios
import './settings-backup.js';  // registra window.* de OneDrive/backup/borrado
import './settings-paneles.js'; // registra window.* de catálogo de paneles

async function getOneDriveStatus() {
  const st = await getOneDriveStatusObj();
  const cls = st.ok ? 'onedrive-ok' : 'onedrive-off';
  return `<span class="${cls}">${st.msg}</span>`;
}

// Tarjeta de cola offline — muestra qué cambios están esperando sync.
async function pendingQueueCard() {
  const q = getPendingQueue();
  if (!q.total) return '';

  // Agrupar cambios de proyectos por ID y enriquecer con displayId
  const byId = {};
  for (const item of q.proj) {
    const id = item.args?.id || item.args?.data?.id || '?';
    if (!byId[id]) byId[id] = { count: 0, label: item.args?.data?.displayId || id };
    byId[id].count++;
  }
  // Intentar sustituir IDs internos con el displayId almacenado en caché
  try {
    const { localStore } = await import('./local-store.js');
    for (const id of Object.keys(byId)) {
      if (byId[id].label === id) {
        const p = await localStore.getById(id);
        if (p?.displayId) byId[id].label = p.displayId;
      }
    }
  } catch {}

  const projRows = Object.values(byId)
    .map(({ label, count }) => `
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:.82rem">
        <span style="color:var(--text-muted)">${esc(label)}</span>
        <b>${count} cambio${count > 1 ? 's' : ''}</b>
      </div>`).join('');

  const kvRow = q.kv.length ? `
    <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:.82rem">
      <span style="color:var(--text-muted)">Configuración / inventario</span>
      <b>${q.kv.length} cambio${q.kv.length > 1 ? 's' : ''}</b>
    </div>` : '';

  const remRow = q.rem.length ? `
    <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:.82rem">
      <span style="color:var(--text-muted)">Recordatorios</span>
      <b>${q.rem.length} cambio${q.rem.length > 1 ? 's' : ''}</b>
    </div>` : '';

  return `
  <div class="card" style="border-color:rgba(251,191,36,.5)">
    <h3 class="card-title" style="color:var(--warn,#f59e0b)">⏳ Cambios pendientes de sync (${q.total})</h3>
    <p class="hint-text" style="margin-bottom:8px">Guardados localmente. Se enviarán al servidor cuando recuperes conexión.</p>
    ${projRows}${kvRow}${remRow}
  </div>`;
}

// Tarjeta de fotos pendientes de subir — visible para todos.
async function fotosPendientesCard() {
  let total = 0, conBackup = 0;
  try {
    const { getAllQueued } = await import('./photo-queue.js');
    const items = await getAllQueued();
    total     = items.length;
    conBackup = items.filter(i => i.localPath).length;
  } catch { /* silencioso */ }
  if (!total) return '';
  const sinBackup = total - conBackup;
  return `
  <div class="card">
    <h3 class="card-title">Fotos pendientes de subir</h3>
    <p class="hint-text">
      <b>${total}</b> foto${total > 1 ? 's' : ''} en cola.
      ${conBackup > 0 ? `<span style="color:var(--success,#22c55e)">✓ ${conBackup} con backup en Documentos/Ecofit.</span>` : ''}
      ${sinBackup > 0 ? `<span style="color:var(--warn,#f59e0b)"> ${sinBackup} sin backup local.</span>` : ''}
    </p>
    <div class="form-actions-row" style="margin-top:10px">
      <button class="btn-primary btn-sm" onclick="window.forceRetryPhotos()">⬆ Reintentar subida (${total})</button>
    </div>
  </div>`;
}

// Tarjeta de caché de fotos offline.
async function fotoCacheCard() {
  let count = 0;
  try {
    const cache = await caches.open('ecofit-photos-v1');
    const keys  = await cache.keys();
    count = keys.length;
  } catch {}

  window._clearPhotoCache = async () => {
    try {
      await caches.delete('ecofit-photos-v1');
      toast('Caché de fotos limpiada', 'success', 3000);
      const wrap = document.getElementById('foto-cache-card-wrap');
      if (wrap) wrap.outerHTML = await fotoCacheCard();
    } catch { toast('Error al limpiar caché de fotos', 'error'); }
  };

  window._clearOrphanPhotos = async () => {
    try {
      const cache = await caches.open('ecofit-photos-v1');
      const keys  = await cache.keys();
      if (!keys.length) { toast('Sin fotos en caché', 'info'); return; }

      // Recopilar todas las URLs de fotos en proyectos activos
      const { localStore } = await import('./local-store.js');
      const all = await localStore.getAll();
      const knownUrls = new Set();
      function _collect(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(_collect); return; }
        for (const v of Object.values(obj)) {
          if (typeof v === 'string' && v.includes('firebasestorage.googleapis.com')) {
            // Normalizar: quitar token igual que hace el SW
            try { const u = new URL(v); u.searchParams.delete('token'); knownUrls.add(u.toString()); } catch {}
          } else if (v && typeof v === 'object') { _collect(v); }
        }
      }
      (all || []).forEach(_collect);

      // Eliminar entradas del caché que no coincidan con ningún proyecto
      let deleted = 0;
      for (const req of keys) {
        try {
          const u = new URL(req.url); u.searchParams.delete('token');
          if (!knownUrls.has(u.toString())) { await cache.delete(req); deleted++; }
        } catch {}
      }
      toast(deleted > 0 ? `${deleted} foto${deleted > 1 ? 's huérfanas eliminadas' : ' huérfana eliminada'}` : 'Sin fotos huérfanas', 'success', 3000);
      const wrap = document.getElementById('foto-cache-card-wrap');
      if (wrap) wrap.outerHTML = await fotoCacheCard();
    } catch { toast('Error al limpiar fotos huérfanas', 'error'); }
  };

  return `
  <div class="card" id="foto-cache-card-wrap">
    <h3 class="card-title">Fotos disponibles offline</h3>
    <div style="display:flex;justify-content:space-between;font-size:.85rem;color:var(--text-muted);margin-bottom:4px">
      <span>Fotos en caché del dispositivo</span><b style="color:var(--text)">${count}</b>
    </div>
    <p class="hint-text">Las fotos se almacenan automáticamente al abrirlas online. Se depuran solas al superar 300 entradas.</p>
    ${count > 0 ? `
    <div class="form-actions-row" style="margin-top:10px;gap:8px">
      <button class="btn-outline btn-sm" onclick="window._clearOrphanPhotos()">🧹 Limpiar huérfanas</button>
      <button class="btn-outline btn-sm" onclick="window._clearPhotoCache()">🗑 Limpiar todo</button>
    </div>` : `<p class="hint-text" style="color:var(--text-muted);margin-top:4px">Sin fotos en caché aún.</p>`}
  </div>`;
}

// Tarjeta de ítems descartados tras 5 fallos de sync (dead-letter queue).
async function deadLetterCard() {
  const dead = getDeadQueue();
  if (!dead.length) return '';

  window._clearDeadQueue = () => {
    clearDeadQueue();
    toast('Cola de fallos limpiada', 'success', 3000);
    document.getElementById('dead-letter-card')?.remove();
  };

  const rows = dead.slice(-10).reverse().map(item => {
    const id = item.args?.id || item.args?.data?.displayId || '?';
    const op = item.op || '?';
    const date = item.deadAt ? new Date(item.deadAt).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }) : '';
    return `<div style="font-size:.78rem;color:var(--text-muted);padding:2px 0">${op} · ${esc(id)} · ${date} · ${item.retries} intentos</div>`;
  }).join('');

  return `
  <div class="card card-danger" id="dead-letter-card">
    <h3 class="card-title card-title-danger">⚠ Cambios que no pudieron sincronizarse (${dead.length})</h3>
    <p class="hint-text" style="margin-bottom:8px">Estos cambios fallaron ${5} veces y fueron descartados. Verifica tu conexión y permisos en Firestore.</p>
    ${rows}
    <div class="form-actions-row" style="margin-top:10px">
      <button class="btn-outline btn-danger btn-sm" onclick="window._clearDeadQueue()">Limpiar lista</button>
    </div>
  </div>`;
}

// Tarjeta de estado de caché local — visible para todos.
async function cacheStatusCard() {
  let proyectos = 0;
  const lastSyncTs = localStorage.getItem('ecofit_last_sync');
  const lastSync   = lastSyncTs
    ? new Date(Number(lastSyncTs)).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    : 'nunca';
  try {
    const { localStore } = await import('./local-store.js');
    const all = await localStore.getAll();
    proyectos = all?.length || 0;
  } catch {}

  window._purgeCacheOld = async () => {
    const { toast } = await import('./utils.js');
    try {
      const { pruneOldProjects } = await import('./local-store.js');
      const n = await pruneOldProjects(60);
      toast(n > 0 ? `${n} proyecto${n > 1 ? 's eliminados' : ' eliminado'} de la caché` : 'No hay proyectos viejos para limpiar', 'info', 3000);
    } catch { toast('Error al limpiar caché', 'error', 3000); }
  };

  return `
  <div class="card">
    <h3 class="card-title">Datos locales en este dispositivo</h3>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:.85rem;color:var(--text-muted)">
      <div style="display:flex;justify-content:space-between">
        <span>Proyectos en caché</span><b style="color:var(--text)">${proyectos}</b>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>Último sync con servidor</span><b style="color:var(--text)">${lastSync}</b>
      </div>
    </div>
    <div class="form-actions-row" style="margin-top:10px">
      <button class="btn-outline btn-sm" onclick="window._purgeCacheOld()">🗑 Limpiar proyectos viejos (+60 días)</button>
    </div>
    <p class="hint-text" style="margin-top:6px">Solo elimina proyectos <em>concluidos</em> sin actividad en más de 60 días. Los activos nunca se tocan.</p>
  </div>`;
}

export async function renderSettings(session) {
  if (!isAdmin(session)) {
    return `
    <div class="view-header">
      <button class="btn-back" onclick="navigate('#dashboard')">${icon('caret-left')}</button>
      <h1 class="hdr-title">Ajustes</h1>
    </div>

    <!-- Perfil del usuario -->
    <div class="card">
      <h3 class="card-title">Mi perfil</h3>
      <div class="user-row" id="urow-self-np">
        <div class="user-info">
          <span class="user-nombre">${esc(session.nombre)}</span>
          <span class="user-username">@${esc(session.username)}</span>
          <span class="user-rol rol-${session.rol}">${ROLES[session.rol]?.label || session.rol}</span>
        </div>
        <div class="user-actions">
          <button class="btn-icon-sm" onclick="editarMiPerfilNP()" title="Editar mi perfil">✎</button>
        </div>
      </div>
      <div class="form-inline-card" id="uedit-self-np" style="display:none">
        <p class="hint-text" style="margin-bottom:10px">Puedes editar tu nombre, usuario y contraseña.</p>
        <div class="form-row">
          <div class="form-group"><label>Nombre</label>
            <input type="text" id="ue-np-nombre" value="${esc(session.nombre)}" /></div>
          <div class="form-group"><label>Usuario</label>
            <input type="text" id="ue-np-username" value="${esc(session.username)}" /></div>
        </div>
        <div class="form-group"><label>Nueva contraseña <span style="color:var(--text-muted);font-size:.75rem">(dejar vacío para no cambiar)</span></label>
          <input type="password" id="ue-np-pass" placeholder="mín. 6 chars" /></div>
        <div class="form-actions">
          <button class="btn-outline btn-sm" onclick="document.getElementById('uedit-self-np').style.display='none';document.getElementById('urow-self-np').style.display=''">Cancelar</button>
          <button class="btn-primary btn-sm" onclick="guardarMiPerfil('${session.id}')">Guardar cambios</button>
        </div>
      </div>
    </div>

    ${await deadLetterCard()}
    ${await pendingQueueCard()}
    ${await fotosPendientesCard()}
    ${await fotoCacheCard()}
    ${await cacheStatusCard()}

    <!-- Info de la app -->
    <div class="card">
      <h3 class="card-title">Actualización de la app</h3>
      <p class="hint-text">Si la app muestra información desactualizada al reconectarte, usa este botón.</p>
      <div class="form-actions-row" style="margin-top:10px">
        <button class="btn-primary btn-sm" onclick="window._forceAppUpdate()">🔄 Forzar actualización</button>
      </div>
      <p class="hint-text" style="margin-top:8px">Service Worker: <span id="sw-ver">—</span></p>
    </div>

    <div class="settings-footer">
      <p>Bitácora Ecofit Solar Solutions · V6</p>
      <p>La Paz, Baja California Sur · México</p>
    </div>`;
  }

  // Funciones de perfil para no-admin
  window.editarMiPerfilNP = function() {
    document.getElementById('urow-self-np').style.display = 'none';
    document.getElementById('uedit-self-np').style.display = 'block';
    document.getElementById('ue-np-nombre')?.focus();
  };

  const [allUsers, contacto, customPanels] = await Promise.all([
    users.getAll(),
    config.get('contactoEcofit'),
    kv.get('panel_presets_custom'),
  ]);

  const schedRaw    = localStorage.getItem('ecofit-theme-sched');
  const schedParts  = schedRaw ? schedRaw.split('-') : null;
  const schedFrom   = schedParts?.[0] || '19:00';
  const schedTo     = schedParts?.[1] || '07:00';
  const schedActive = !!schedRaw;

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#dashboard')">${icon('caret-left')}</button>
    <h1 class="hdr-title">Configuración</h1>
  </div>

  <!-- Usuarios -->
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Usuarios (${allUsers.length}/10)</h3>
      ${allUsers.length < 10 ? `<button class="btn-primary btn-sm" onclick="showNewUser()">+ Agregar</button>` : ''}
    </div>

    <div id="form-nuevo-usuario" style="display:none" class="form-inline-card">
      <div class="form-row">
        <div class="form-group"><label>Nombre</label>
          <input type="text" id="nu-nombre" placeholder="Nombre completo" /></div>
        <div class="form-group"><label>Usuario</label>
          <input type="text" id="nu-username" placeholder="sin espacios" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Contraseña</label>
          <input type="password" id="nu-pass" placeholder="mín. 6 chars" /></div>
        <div class="form-group"><label>Rol</label>
          <select id="nu-rol">
            ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Email de recuperación <span style="color:var(--text-muted);font-size:.75rem">(opcional — para reset de contraseña)</span></label>
        <input type="email" id="nu-email" placeholder="correo@gmail.com" />
      </div>
      <div class="form-actions">
        <button class="btn-outline btn-sm" onclick="document.getElementById('form-nuevo-usuario').style.display='none'">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="crearUsuario()">Crear</button>
      </div>
    </div>

    <div id="users-list">
      ${renderUsersList(allUsers, session)}
    </div>
  </div>

  <!-- Contacto para QR y PDF cliente -->
  <div class="card">
    <h3 class="card-title">Contacto Ecofit (QR + PDF cliente)</h3>
    <div class="form-group">
      <label>Datos de contacto (WhatsApp, email, web, teléfono…)</label>
      <textarea id="contacto-ecofit" rows="3"
                placeholder="WhatsApp: +52 612 000 0000&#10;Email: contacto@ecofitsolar.mx&#10;Web: ecofitsolar.mx"
      >${esc(contacto||'')}</textarea>
    </div>
    <button class="btn-primary btn-sm" onclick="guardarContacto(this)">Guardar contacto</button>
  </div>

  <!-- Modo oscuro programado -->
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Modo oscuro programado</h3>
      <label class="toggle-switch">
        <input type="checkbox" id="sched-enabled" ${schedActive ? 'checked' : ''}
               onchange="toggleSchedMode(this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="hint-text">El tema cambia a oscuro automáticamente en el horario configurado (por dispositivo).</p>
    <div id="sched-config" class="sched-config${schedActive ? '' : ' sched-disabled'}">
      <div class="form-row" style="margin-top:10px">
        <div class="form-group">
          <label>Oscuro desde</label>
          <input type="time" id="sched-from" class="input-field" value="${schedFrom}"
                 onchange="saveSched()" />
        </div>
        <div class="form-group">
          <label>Oscuro hasta</label>
          <input type="time" id="sched-to" class="input-field" value="${schedTo}"
                 onchange="saveSched()" />
        </div>
      </div>
      <p class="hint-text" style="margin-top:6px">
        Ejemplo: 19:00 – 07:00 activa el modo oscuro de noche hasta la mañana siguiente.
      </p>
    </div>
  </div>

  <!-- OneDrive — solo web (File System Access API no disponible en Android) -->
  ${!isNative() ? `
  <div class="card">
    <h3 class="card-title">OneDrive Empresarial — Respaldo documental</h3>
    <p class="hint-text">
      Guarda PDFs y documentos directamente en la carpeta de OneDrive de la empresa.
      OneDrive sincroniza automáticamente.
    </p>
    <div id="onedrive-status" class="onedrive-status">
      ${await getOneDriveStatus()}
    </div>
    <div class="form-actions-row" style="margin-top:10px">
      <button class="btn-primary btn-sm" onclick="seleccionarCarpetaOneDrive()">
        ${icon('folder-open', 14)} Seleccionar carpeta OneDrive
      </button>
      <button class="btn-outline btn-sm" onclick="probarOneDrive()">
        Probar acceso
      </button>
    </div>
    <p class="hint-text" style="margin-top:8px">
      Selecciona la carpeta <strong>OneDrive - Ecofit Solar Solutions</strong> o la subcarpeta donde quieras guardar los respaldos.
    </p>
  </div>` : ''}

  <!-- Instalación PWA -->
  <div class="card">
    <h3 class="card-title">Instalar en Android</h3>
    <ol class="pwa-steps">
      <li>Abre esta página en Chrome</li>
      <li>Toca el menú <strong>⋮</strong> (tres puntos)</li>
      <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong></li>
      <li>Confirma la instalación</li>
    </ol>
  </div>

  <!-- Catálogo de paneles -->
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Catálogo de paneles</h3>
      <button class="btn-primary btn-sm" onclick="showPanelForm()">+ Agregar</button>
    </div>
    <p class="hint-text">Agrega los modelos de panel que uses. Aparecerán en la Calculadora BOM.</p>

    <div id="form-nuevo-panel" style="display:none" class="form-inline-card">
      <div class="form-row">
        <div class="form-group"><label>Marca / Modelo</label>
          <input type="text" id="np-label" placeholder="Ej: Longi/Hi-Mo 540W" /></div>
        <div class="form-group"><label>Potencia (W)</label>
          <input type="number" id="np-wp" placeholder="540" min="1" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ancho (m)</label>
          <input type="number" id="np-pw" placeholder="1.134" step="0.001" min="0.1" /></div>
        <div class="form-group"><label>Alto (m)</label>
          <input type="number" id="np-ph" placeholder="2.278" step="0.001" min="0.1" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Voc (V) <span class="hint-opt">opcional</span></label>
          <input type="number" id="np-voc" placeholder="Ej: 49.8" step="0.1" min="0" /></div>
        <div class="form-group"><label>Imp (A) <span class="hint-opt">opcional</span></label>
          <input type="number" id="np-imp" placeholder="Ej: 13.95" step="0.01" min="0" /></div>
      </div>
      <div class="form-actions">
        <button class="btn-outline btn-sm" onclick="document.getElementById('form-nuevo-panel').style.display='none'">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="crearPanel()">Guardar panel</button>
      </div>
    </div>

    <div class="panel-catalog-list">
      ${(customPanels||[]).length > 0 ? `
        ${(customPanels||[]).map(p => `
          <div class="panel-row" id="panel-row-${p.id}">
            <div class="panel-info">
              <span class="panel-label">${esc(p.label)}</span>
              <span class="panel-sub">${esc(p.sub||'')}</span>
              <span class="panel-dims">${p.pW}m × ${p.pH}m${p.voc?` · Voc ${p.voc}V`:''}${p.imp?` · Imp ${p.imp}A`:''}</span>
            </div>
            <div class="panel-row-actions">
              <button class="btn-icon-sm" onclick="editarPanel('${esc(p.id)}','${esc(p.label)}',${p.wp||''},${p.pW},${p.pH},${p.voc||''},${p.imp||''})" title="Editar">✎</button>
              <button class="btn-del-sm" onclick="eliminarPanel('${esc(p.id)}')" title="Eliminar">✕</button>
            </div>
          </div>
          <div class="form-inline-card panel-edit-form" id="panel-edit-${p.id}" style="display:none">
            <div class="form-row">
              <div class="form-group"><label>Marca / Modelo</label>
                <input type="text" id="ep-label-${p.id}" value="${esc(p.label)}" /></div>
              <div class="form-group"><label>Potencia (W)</label>
                <input type="number" id="ep-wp-${p.id}" value="${p.wp||''}" min="1" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Ancho (m)</label>
                <input type="number" id="ep-pw-${p.id}" value="${p.pW}" step="0.001" min="0.1" /></div>
              <div class="form-group"><label>Alto (m)</label>
                <input type="number" id="ep-ph-${p.id}" value="${p.pH}" step="0.001" min="0.1" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Voc (V) <span class="hint-opt">opcional</span></label>
                <input type="number" id="ep-voc-${p.id}" value="${p.voc||''}" step="0.1" min="0" /></div>
              <div class="form-group"><label>Imp (A) <span class="hint-opt">opcional</span></label>
                <input type="number" id="ep-imp-${p.id}" value="${p.imp||''}" step="0.01" min="0" /></div>
            </div>
            <div class="form-actions">
              <button class="btn-outline btn-sm" onclick="document.getElementById('panel-edit-${p.id}').style.display='none';document.getElementById('panel-row-${p.id}').style.display=''">Cancelar</button>
              <button class="btn-primary btn-sm" onclick="guardarEditPanel('${esc(p.id)}')">Guardar</button>
            </div>
          </div>`).join('')}
      ` : `<p class="empty-msg-sm" style="padding:12px 0">Sin modelos aún. Usa <strong>+ Agregar</strong> para añadir el primero.</p>`}
    </div>
  </div>

  <!-- Tablero comparativo de BOM aplicados por técnico -->
  ${renderTableroPlaceholder()}

  <!-- Backup de emergencia -->
  <div class="card">
    <h3 class="card-title">Backup de emergencia</h3>
    <p class="hint-text">
      Los datos están en la nube (Firebase) y se sincronizan automáticamente entre dispositivos.
      Este backup es solo para respaldo externo o migración.
    </p>
    <div class="form-actions-row">
      <button class="btn-outline" onclick="exportarDatos()" style="display:flex;align-items:center;gap:6px">
        ${icon('file-arrow-down', 16)} Exportar JSON
      </button>
      <button class="btn-outline" onclick="document.getElementById('import-json').click()">⬆ Importar JSON</button>
      <input type="file" id="import-json" accept=".json" style="display:none" onchange="importarDatos(event)" />
    </div>
  </div>

  <!-- Herramientas adicionales -->
  <!-- Zona de peligro -->
  <div class="card card-danger">
    <h3 class="card-title card-title-danger">Zona de peligro</h3>
    <button class="btn-outline btn-danger" onclick="limpiarDatos()">
      ${icon('trash')} Limpiar todos los datos locales
    </button>
  </div>

  <!-- Sesión -->
  <div class="card" style="border-color:rgba(248,113,113,.3)">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <p style="font-weight:600;color:var(--text);margin:0">${esc(session.nombre)}</p>
        <p style="font-size:.78rem;color:var(--text-muted);margin:2px 0 0">@${esc(session.username)} · ${ROLES[session.rol]?.label||session.rol}</p>
      </div>
      <button class="btn-outline btn-danger" onclick="window._logout()" style="display:flex;align-items:center;gap:6px">
        ${icon('arrow-square-out', 16)} Cerrar sesión
      </button>
    </div>
  </div>

  ${await fotosPendientesCard()}
  ${await cacheStatusCard()}

  <div class="card">
    <h3 class="card-title">Actualización de la app</h3>
    <p class="hint-text">
      Si trabajaste sin internet y la app muestra información desactualizada,
      usa este botón al reconectarte para cargar la versión más reciente.
    </p>
    <div id="update-status" style="margin-bottom:10px"></div>
    <div class="form-actions-row">
      <button class="btn-primary btn-sm" onclick="window._forceAppUpdate()">
        🔄 Forzar actualización
      </button>
      <button class="btn-outline btn-sm" onclick="window._checkForUpdate()">
        Buscar actualización
      </button>
    </div>
    <p class="hint-text" style="margin-top:8px">
      Service Worker: <span id="sw-ver">—</span>
    </p>
  </div>

  <div class="settings-footer">
    <p>Bitácora Ecofit Solar Solutions · V6</p>
    <p>La Paz, Baja California Sur · México</p>
  </div>
  `;
}

function renderUsersList(allUsers, session) {
  return allUsers.map(u => `
    <div class="user-row" id="urow-${u.id}">
      <div class="user-info">
        <span class="user-nombre">${esc(u.nombre)}</span>
        <span class="user-username">@${esc(u.username)}</span>
        <span class="user-rol rol-${u.rol}">${ROLES[u.rol]?.label||u.rol}</span>
        ${!u.activo ? '<span class="badge-inactivo">Inactivo</span>' : ''}
      </div>
      ${u.id !== session.id ? `
      <div class="user-actions">
        <button class="btn-icon-sm" onclick="editarUser('${u.id}')" title="Editar">✎</button>
        <button class="btn-icon-sm" onclick="toggleUser('${u.id}',${u.activo})"
                title="${u.activo?'Desactivar':'Activar'}">${u.activo?'✓':'○'}</button>
        ${u.authEmail ? `<button class="btn-icon-sm" onclick="resetPassUser('${u.id}','${esc(u.authEmail)}')" title="Enviar reset de contraseña">🔑</button>` : ''}
        <button class="btn-del-sm" onclick="eliminarUser('${u.id}')">✕</button>
      </div>` : `
      <div class="user-actions">
        <span class="user-yo">(tú)</span>
        <button class="btn-icon-sm" onclick="editarMiPerfil()" title="Editar mi perfil">✎</button>
      </div>`}
    </div>

    ${u.id !== session.id ? `
    <div class="form-inline-card" id="uedit-${u.id}" style="display:none">
      <p class="hint-text" style="margin-bottom:10px">
        🔒 El nombre y contraseña solo los puede cambiar el propio usuario desde su sesión.
      </p>
      <div class="form-row">
        <div class="form-group"><label>Rol</label>
          <select id="ue-rol-${u.id}">
            ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.rol===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Email de recuperación <span style="color:var(--text-muted);font-size:.75rem">(para reset de contraseña)</span></label>
          <input type="email" id="ue-email-${u.id}" value="${esc(u.authEmail||u.email||'')}" placeholder="correo@gmail.com" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-outline btn-sm" onclick="document.getElementById('uedit-${u.id}').style.display='none';document.getElementById('urow-${u.id}').style.display=''">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="guardarEditUser('${u.id}')">Guardar</button>
      </div>
    </div>` : `
    <div class="form-inline-card" id="uedit-self" style="display:none">
      <p class="hint-text" style="margin-bottom:10px">Solo puedes editar tu nombre, usuario y contraseña. El rol lo asigna el administrador.</p>
      <div class="form-row">
        <div class="form-group"><label>Nombre</label>
          <input type="text" id="ue-self-nombre" value="${esc(u.nombre)}" /></div>
        <div class="form-group"><label>Usuario</label>
          <input type="text" id="ue-self-username" value="${esc(u.username)}" /></div>
      </div>
      <div class="form-group"><label>Nueva contraseña <span style="color:var(--text-muted);font-size:.75rem">(dejar vacío para no cambiar)</span></label>
        <input type="password" id="ue-self-pass" placeholder="mín. 6 chars" /></div>
      <div class="form-actions">
        <button class="btn-outline btn-sm" onclick="cancelarMiPerfil()">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="guardarMiPerfil('${u.id}')">Guardar cambios</button>
      </div>
    </div>`}
  `).join('');
}

// ── Modo oscuro programado ─────────────────────────────────────────────────────
window.toggleSchedMode = function(enabled) {
  const cfg = document.getElementById('sched-config');
  if (enabled) {
    const from = document.getElementById('sched-from').value || '19:00';
    const to   = document.getElementById('sched-to').value   || '07:00';
    localStorage.setItem('ecofit-theme-sched', `${from}-${to}`);
    cfg?.classList.remove('sched-disabled');
    toast(`🌙 Modo oscuro: ${from} – ${to}`);
  } else {
    localStorage.removeItem('ecofit-theme-sched');
    cfg?.classList.add('sched-disabled');
    toast('Modo oscuro programado desactivado');
  }
  window._applyScheduledTheme?.();
};

window.saveSched = function() {
  if (!document.getElementById('sched-enabled')?.checked) return;
  const from = document.getElementById('sched-from').value;
  const to   = document.getElementById('sched-to').value;
  if (!from || !to) return;
  localStorage.setItem('ecofit-theme-sched', `${from}-${to}`);
  window._applyScheduledTheme?.();
  toast(`🌙 Horario actualizado: ${from} – ${to}`);
};

// ── Forzar actualización del Service Worker ───────────────────────────────────
window._forceAppUpdate = async function() {
  const statusEl = document.getElementById('update-status');
  if (!navigator.onLine) {
    toast('Necesitas internet para actualizar la app', 'error');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--solar)">⚠ Sin conexión — conéctate primero</span>';
    return;
  }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted)">Buscando actualización…</span>';
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) { await reg.update(); }
    // Limpiar caché viejo
    const keys = await caches.keys();
    for (const key of keys) { await caches.delete(key); }
    toast('✅ Caché limpiado — recargando la app…', 'success', 3000);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent)">✅ Actualización aplicada</span>';
    setTimeout(() => location.reload(true), 2000);
  } catch(err) {
    toast('Error al actualizar: ' + err.message, 'error');
  }
};

window._checkForUpdate = async function() {
  const statusEl = document.getElementById('update-status');
  if (!navigator.serviceWorker?.controller) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted)">Service Worker no activo</span>';
    return;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) { await reg.update(); }
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent)">✅ Sin actualizaciones pendientes</span>';
    toast('App al día', 'success');
  } catch(err) {
    toast('Error al verificar: ' + err.message, 'error');
  }
};
