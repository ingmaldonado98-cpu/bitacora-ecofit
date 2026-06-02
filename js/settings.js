// settings.js — Configuración Admin

import { users, config, kv, exportBackup, importBackup } from './db.js';
import { esc, isoNow, toast, confirmDialog } from './utils.js';
import { isAdmin, ROLES } from './auth.js';
import { icon } from './icons.js';
import { createFbUser, fbUsers, resetPassword } from './firebase.js';
import { getStatus as getOneDriveStatusObj, pickFolder, requestPermission, testAccess } from './onedrive.js';

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
    <p class="empty-msg">Solo el administrador puede gestionar ajustes.</p>`;
  }

  const [allUsers, contacto, customPanels] = await Promise.all([
    users.getAll(),
    config.get('contactoEcofit'),
    kv.get('panel_presets_custom'),
  ]);

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

  <!-- OneDrive -->
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
  </div>

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
          <input type="text" id="np-label" placeholder="Ej: Jinko 550W" /></div>
        <div class="form-group"><label>Potencia (W)</label>
          <input type="number" id="np-wp" placeholder="550" min="1" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ancho (m)</label>
          <input type="number" id="np-pw" placeholder="1.134" step="0.001" min="0.1" /></div>
        <div class="form-group"><label>Alto (m)</label>
          <input type="number" id="np-ph" placeholder="2.278" step="0.001" min="0.1" /></div>
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
              <span class="panel-dims">${p.pW}m × ${p.pH}m</span>
            </div>
            <div class="panel-row-actions">
              <button class="btn-icon-sm" onclick="editarPanel('${esc(p.id)}','${esc(p.label)}',${p.wp||''},${p.pW},${p.pH})" title="Editar">✎</button>
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
            <div class="form-actions">
              <button class="btn-outline btn-sm" onclick="document.getElementById('panel-edit-${p.id}').style.display='none';document.getElementById('panel-row-${p.id}').style.display=''">Cancelar</button>
              <button class="btn-primary btn-sm" onclick="guardarEditPanel('${esc(p.id)}')">Guardar</button>
            </div>
          </div>`).join('')}
      ` : `<p class="empty-msg-sm" style="padding:12px 0">Sin modelos aún. Usa <strong>+ Agregar</strong> para añadir el primero.</p>`}
    </div>
  </div>

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

  <div class="settings-footer">
    <p>Bitácora Ecofit Solar Solutions · V6</p>
    <p>La Paz, Baja California Sur · México</p>
    <p>Service Worker: <span id="sw-ver">—</span></p>
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
      <div class="form-row">
        <div class="form-group"><label>Nombre</label>
          <input type="text" id="ue-nombre-${u.id}" value="${esc(u.nombre)}" /></div>
        <div class="form-group"><label>Usuario</label>
          <input type="text" id="ue-username-${u.id}" value="${esc(u.username)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Rol</label>
          <select id="ue-rol-${u.id}">
            ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.rol===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Email de recuperación <span style="color:var(--text-muted);font-size:.75rem">(para reset de contraseña)</span></label>
        <input type="email" id="ue-email-${u.id}" value="${esc(u.email||'')}" placeholder="correo@gmail.com" />
      </div>
      <p class="hint-text" style="margin:4px 0">
        🔒 La contraseña solo puede cambiarla el propio usuario desde su sesión.
      </p>
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

// ── Editar perfil propio ───────────────────────────────────────────────────────
window.editarMiPerfil = function() {
  const selfRow  = document.getElementById('urow-self') ||
                   document.querySelector('.user-row:has(#uedit-self)');
  const form = document.getElementById('uedit-self');
  if (!form) return;
  // Ocultar la fila y mostrar el form
  const row = form.previousElementSibling;
  if (row) row.style.display = 'none';
  form.style.display = 'block';
  document.getElementById('ue-self-nombre')?.focus();
};

window.cancelarMiPerfil = function() {
  const form = document.getElementById('uedit-self');
  if (!form) return;
  form.style.display = 'none';
  const row = form.previousElementSibling;
  if (row) row.style.display = '';
};

window.guardarMiPerfil = async function(id) {
  const nombre   = document.getElementById('ue-self-nombre')?.value.trim();
  const username = document.getElementById('ue-self-username')?.value.trim().toLowerCase();
  const pass     = document.getElementById('ue-self-pass')?.value;

  if (!nombre || !username) { toast('Nombre y usuario son obligatorios', 'error'); return; }
  if (pass && pass.length < 6) { toast('Contraseña mínimo 6 caracteres', 'error'); return; }

  const btn = document.querySelector('#uedit-self .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    await users.update(id, { nombre, username });

    // Cambiar contraseña en Firebase Auth (solo disponible para el usuario actual)
    if (pass) {
      const { getAuth, updatePassword } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
      );
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        await updatePassword(currentUser, pass);
      }
    }

    toast('✅ Perfil actualizado');
    navigate('#settings');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    // Firebase requiere re-autenticación reciente para cambiar contraseña
    if (err.code === 'auth/requires-recent-login') {
      toast('Por seguridad, cierra sesión y vuelve a entrar antes de cambiar tu contraseña.', 'error');
    } else {
      toast('Error al guardar: ' + err.message, 'error');
    }
  }
};

window.editarUser = function(id) {
  document.getElementById('urow-' + id).style.display = 'none';
  document.getElementById('uedit-' + id).style.display = 'block';
  document.getElementById('ue-nombre-' + id).focus();
};

window.guardarEditUser = async function(id) {
  const nombre   = document.getElementById('ue-nombre-' + id).value.trim();
  const username = document.getElementById('ue-username-' + id).value.trim().toLowerCase();
  const rol      = document.getElementById('ue-rol-' + id).value;
  const email    = document.getElementById('ue-email-' + id)?.value.trim() || null;

  if (!nombre || !username) { toast('Nombre y usuario son obligatorios', 'error'); return; }

  try {
    await users.update(id, { nombre, username, rol, ...(email ? { email } : {}) });
    toast('✅ Usuario actualizado');
    navigate('#settings');
  } catch(err) {
    toast('Error al guardar: ' + err.message, 'error');
  }
};

window.showNewUser = function() {
  document.getElementById('form-nuevo-usuario').style.display = 'block';
  document.getElementById('nu-nombre').focus();
};

window.crearUsuario = async function() {
  const nombre   = document.getElementById('nu-nombre').value.trim();
  const username = document.getElementById('nu-username').value.trim().toLowerCase();
  const pass     = document.getElementById('nu-pass').value;
  const rol      = document.getElementById('nu-rol').value;
  const email    = document.getElementById('nu-email')?.value.trim() || null;

  if (!nombre || !username || !pass) { toast('Completa todos los campos','error'); return; }
  if (pass.length < 6) { toast('Contraseña mínimo 6 caracteres','error'); return; }

  const btn = document.querySelector('#form-nuevo-usuario .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }

  try {
    // 1. Crear en Firebase Auth (sin cerrar sesión actual)
    // Si se proporcionó email real, se usa como email de Firebase Auth (permite reset real)
    const { uid, authEmail } = await createFbUser(username, pass, email);
    // 2. Crear perfil en Firestore
    await fbUsers.add({ id: uid, nombre, username, rol, activo: true,
      authEmail, ...(email ? { email } : {}), createdAt: isoNow() });
    toast(`✅ Usuario @${username} creado`);
    navigate('#settings');
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear'; }
    toast('Error: ' + (err.message || 'usuario ya existe'), 'error');
  }
};

window.toggleUser = async function(id, activo) {
  await users.update(id, { activo: !activo });
  navigate('#settings');
};

window.eliminarUser = async function(id) {
  if (!await confirmDialog('¿Eliminar este usuario? Esta acción es irreversible.')) return;
  await users.delete(id);
  toast('Usuario eliminado');
  navigate('#settings');
};

window.guardarContacto = async function() {
  const val = document.getElementById('contacto-ecofit').value.trim();
  await config.set('contactoEcofit', val);
  toast('✅ Contacto guardado');
};

// ── OneDrive ───────────────────────────────────────────────────────────────────
window.seleccionarCarpetaOneDrive = async function() {
  try {
    const handle = await pickFolder();
    toast(`✅ Carpeta seleccionada: ${handle.name}`);
    document.getElementById('onedrive-status').innerHTML =
      `<span class="onedrive-ok">✅ Carpeta: ${handle.name}</span>`;
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Error al seleccionar carpeta: ' + err.message, 'error');
    }
  }
};

window.probarOneDrive = async function() {
  try {
    const path = await testAccess();
    toast(`✅ Acceso confirmado — archivo guardado en: ${path}`);
  } catch (err) {
    if (err.message.includes('permiso') || err.message.includes('Permiso')) {
      try {
        await requestPermission();
        const path = await testAccess();
        toast(`✅ Acceso confirmado — archivo guardado en: ${path}`);
      } catch (e) {
        toast('Error: ' + e.message, 'error');
      }
    } else {
      toast('Error: ' + err.message, 'error');
    }
  }
};

window.exportarDatos = async function() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ecofit-bitacora-v6-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.importarDatos = async function(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!await confirmDialog('¿Importar backup? Se reemplazarán todos los proyectos actuales.')) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importBackup(data);
    toast('✅ Datos importados');
    navigate('#dashboard');
  } catch(err) { toast('Error al importar: ' + err.message, 'error'); }
};

window.showPanelForm = function() {
  document.getElementById('form-nuevo-panel').style.display = 'block';
  document.getElementById('np-label').focus();
};

window.crearPanel = async function() {
  const label = document.getElementById('np-label').value.trim();
  const wp    = parseFloat(document.getElementById('np-wp').value);
  const pW    = parseFloat(document.getElementById('np-pw').value);
  const pH    = parseFloat(document.getElementById('np-ph').value);

  if (!label)             { toast('Ingresa la marca/modelo','error'); return; }
  if (!wp || wp < 1)      { toast('Potencia inválida','error'); return; }
  if (!pW || pW < 0.1)    { toast('Ancho inválido','error'); return; }
  if (!pH || pH < 0.1)    { toast('Alto inválido','error'); return; }

  const existing = (await kv.get('panel_presets_custom')) || [];
  const nuevo = {
    id:    'cp-' + Date.now(),
    label,
    sub:   `${wp}W · ${pW}×${pH}m`,
    pW,
    pH,
    wp,
    isCustom: true,
  };
  await kv.set('panel_presets_custom', [...existing, nuevo]);
  toast(`✅ Panel "${label}" agregado`);
  navigate('#settings');
};

window.editarPanel = function(id) {
  document.getElementById('panel-row-' + id).style.display = 'none';
  document.getElementById('panel-edit-' + id).style.display = 'block';
  document.getElementById('ep-label-' + id).focus();
};

window.guardarEditPanel = async function(id) {
  const label = document.getElementById('ep-label-' + id).value.trim();
  const wp    = parseFloat(document.getElementById('ep-wp-' + id).value);
  const pW    = parseFloat(document.getElementById('ep-pw-' + id).value);
  const pH    = parseFloat(document.getElementById('ep-ph-' + id).value);

  if (!label)          { toast('Ingresa la marca/modelo','error'); return; }
  if (!wp || wp < 1)   { toast('Potencia inválida','error'); return; }
  if (!pW || pW < 0.1) { toast('Ancho inválido','error'); return; }
  if (!pH || pH < 0.1) { toast('Alto inválido','error'); return; }

  const existing = (await kv.get('panel_presets_custom')) || [];
  const updated = existing.map(p => p.id === id
    ? { ...p, label, sub: `${wp}W · ${pW}×${pH}m`, wp, pW, pH }
    : p
  );
  await kv.set('panel_presets_custom', updated);
  toast('✅ Panel actualizado');
  navigate('#settings');
};

window.eliminarPanel = async function(id) {
  if (!await confirmDialog('¿Eliminar este modelo de panel?')) return;
  const existing = (await kv.get('panel_presets_custom')) || [];
  await kv.set('panel_presets_custom', existing.filter(p => p.id !== id));
  toast('Panel eliminado');
  navigate('#settings');
};

window.resetPassUser = async function(id, authEmail) {
  const ok = await (await import('./utils.js')).confirmDialog(
    `¿Enviar link de restablecimiento de contraseña a:\n${authEmail}?`
  );
  if (!ok) return;
  try {
    await resetPassword(authEmail);
    toast('📧 Link de restablecimiento enviado');
  } catch(err) {
    toast('Error al enviar reset: ' + err.message, 'error');
  }
};

window.limpiarDatos = async function() {
  if (!await confirmDialog('¿ELIMINAR TODOS los datos locales? Esta acción es IRREVERSIBLE.')) return;
  if (!await confirmDialog('Segunda confirmación: ¿Seguro? Perderás todos los proyectos.')) return;
  indexedDB.deleteDatabase('ecofitV6');
  sessionStorage.clear();
  toast('Datos eliminados. Recargando…');
  setTimeout(() => location.reload(), 1500);
};
