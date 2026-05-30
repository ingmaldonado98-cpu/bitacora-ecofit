// settings.js — Configuración Admin

import { users, config, kv, exportBackup, importBackup } from './db.js';
import { esc, uuid, isoNow, toast, confirmDialog, hashPassword } from './utils.js';
import { isAdmin, ROLES } from './auth.js';
import { PANEL_PRESETS } from '../modules/calculadora/index.js';
import { icon } from './icons.js';

export async function renderSettings(session) {
  if (!isAdmin(session)) {
    return `
    <div class="view-header">
      <button class="btn-back" onclick="navigate('#dashboard')">${icon('caret-left')}</button>
      <h1 class="hdr-title">Ajustes</h1>
    </div>
    <p class="empty-msg">Solo el administrador puede gestionar ajustes.</p>`;
  }

  const [allUsers, contacto, driveConfig, customPanels] = await Promise.all([
    users.getAll(),
    config.get('contactoEcofit'),
    config.get('driveConfig'),
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

  <!-- Google Drive -->
  <div class="card">
    <h3 class="card-title">Google Drive — Respaldo documental</h3>
    <p class="hint-text">Solo para subir fotos y PDFs. No almacena datos de la app.</p>
    <div class="form-group"><label>API Key de Google Drive</label>
      <input type="text" id="drive-api-key" placeholder="AIza…"
             value="${esc(driveConfig?.apiKey||'')}" />
    </div>
    <div class="form-group"><label>ID carpeta raíz en Drive</label>
      <input type="text" id="drive-folder-id" placeholder="ID de la carpeta Ecofit en Drive"
             value="${esc(driveConfig?.folderId||'')}" />
    </div>
    <button class="btn-outline btn-sm" onclick="guardarDrive()">Guardar configuración Drive</button>
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

  <!-- Datos locales -->
  <div class="card">
    <h3 class="card-title">Datos locales</h3>
    <div class="form-actions-row">
      <button class="btn-outline" onclick="exportarDatos()">⬇ Exportar JSON</button>
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
        <button class="btn-del-sm" onclick="eliminarUser('${u.id}')">✕</button>
      </div>` : '<span class="user-yo">(tú)</span>'}
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
        <div class="form-group"><label>Nueva contraseña <span style="color:var(--text-muted);font-size:.75rem">(dejar vacío para no cambiar)</span></label>
          <input type="password" id="ue-pass-${u.id}" placeholder="mín. 6 chars" /></div>
        <div class="form-group"><label>Rol</label>
          <select id="ue-rol-${u.id}">
            ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.rol===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-outline btn-sm" onclick="document.getElementById('uedit-${u.id}').style.display='none';document.getElementById('urow-${u.id}').style.display=''">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="guardarEditUser('${u.id}')">Guardar</button>
      </div>
    </div>` : ''}
  `).join('');
}

window.editarUser = function(id) {
  document.getElementById('urow-' + id).style.display = 'none';
  document.getElementById('uedit-' + id).style.display = 'block';
  document.getElementById('ue-nombre-' + id).focus();
};

window.guardarEditUser = async function(id) {
  const nombre   = document.getElementById('ue-nombre-' + id).value.trim();
  const username = document.getElementById('ue-username-' + id).value.trim().toLowerCase();
  const pass     = document.getElementById('ue-pass-' + id).value;
  const rol      = document.getElementById('ue-rol-' + id).value;

  if (!nombre || !username) { toast('Nombre y usuario son obligatorios', 'error'); return; }
  if (pass && pass.length < 6) { toast('Contraseña mínimo 6 caracteres', 'error'); return; }

  const changes = { nombre, username, rol };
  if (pass) changes.password = await hashPassword(pass);

  try {
    await users.update(id, changes);
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

  if (!nombre || !username || !pass) { toast('Completa todos los campos','error'); return; }
  if (pass.length < 6) { toast('Contraseña mínimo 6 caracteres','error'); return; }

  try {
    const hashedPass = await hashPassword(pass);
    await users.add({ id:uuid(), nombre, username, password:hashedPass, rol, activo:true, createdAt:isoNow() });
    toast(`✅ Usuario @${username} creado`);
    navigate('#settings');
  } catch(err) {
    toast('Error: usuario ya existe','error');
  }
};

window.toggleUser = async function(id, activo) {
  await users.update(id, { activo: !activo });
  navigate('#settings');
};

window.eliminarUser = async function(id) {
  if (!confirmDialog('¿Eliminar este usuario? Esta acción es irreversible.')) return;
  await users.delete(id);
  toast('Usuario eliminado');
  navigate('#settings');
};

window.guardarContacto = async function() {
  const val = document.getElementById('contacto-ecofit').value.trim();
  await config.set('contactoEcofit', val);
  toast('✅ Contacto guardado');
};

window.guardarDrive = async function() {
  const apiKey   = document.getElementById('drive-api-key').value.trim();
  const folderId = document.getElementById('drive-folder-id').value.trim();
  await config.set('driveConfig', { apiKey, folderId });
  toast('✅ Configuración Drive guardada');
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
  if (!confirmDialog('¿Importar backup? Se reemplazarán todos los proyectos actuales.')) return;
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
  if (!confirmDialog('¿Eliminar este modelo de panel?')) return;
  const existing = (await kv.get('panel_presets_custom')) || [];
  await kv.set('panel_presets_custom', existing.filter(p => p.id !== id));
  toast('Panel eliminado');
  navigate('#settings');
};

window.limpiarDatos = async function() {
  if (!confirmDialog('¿ELIMINAR TODOS los datos locales? Esta acción es IRREVERSIBLE.')) return;
  if (!confirmDialog('Segunda confirmación: ¿Seguro? Perderás todos los proyectos.')) return;
  const dbs = await indexedDB.databases?.() || [];
  for (const db of dbs) { if (db.name === 'ecofitV6') indexedDB.deleteDatabase(db.name); }
  sessionStorage.clear();
  toast('Datos eliminados. Recargando…');
  setTimeout(() => location.reload(), 1500);
};
