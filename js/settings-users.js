// settings-users.js — Gestión de usuarios (Ajustes Admin)
// Extraído de settings.js — registra los handlers window.* de perfil propio,
// CRUD de usuarios, reset de contraseña y contacto Ecofit.

import { users, config } from './db.js';
import { isoNow, toast, confirmDialog } from './utils.js';
import { createFbUser, fbUsers, resetPassword } from './firebase.js';

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
  // Soporta tanto el form admin (ue-self-*) como el form no-admin (ue-np-*)
  const nombre   = (document.getElementById('ue-self-nombre')   || document.getElementById('ue-np-nombre'))?.value.trim();
  const username = (document.getElementById('ue-self-username') || document.getElementById('ue-np-username'))?.value.trim().toLowerCase();
  const pass     = (document.getElementById('ue-self-pass')     || document.getElementById('ue-np-pass'))?.value;

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
  const rol   = document.getElementById('ue-rol-' + id).value;
  const email = document.getElementById('ue-email-' + id)?.value.trim() || null;

  try {
    const update = { rol, email: email || null, authEmail: email || null };
    await users.update(id, update);
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

window.resetPassUser = async function(id, authEmail) {
  const ok = await confirmDialog(
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
