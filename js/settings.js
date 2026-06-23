// settings.js — Configuración Admin

import { users, config, kv } from './db.js';
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
    <button class="btn-primary btn-sm" onclick="guardarContacto()">Guardar contacto</button>
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
