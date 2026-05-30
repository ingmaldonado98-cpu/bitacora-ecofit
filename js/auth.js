// auth.js — Login, sesión y roles

import { users, kv, seedIfEmpty } from './db.js';
import { toast, hashPassword, isHashed } from './utils.js';
import { icon } from './icons.js';

// ── Roles y permisos ───────────────────────────────────────────────────────────
export const ROLES = {
  admin:  { label: 'Administrador',    level: 3 },
  lider:  { label: 'Técnico Líder',    level: 2 },
  apoyo:  { label: 'Técnico Apoyo',    level: 1 },
};

// Transiciones de estado permitidas por rol
export const TRANSITIONS = {
  borrador:           { admin: ['en_progreso','cancelado'],          lider: ['en_progreso'],      apoyo: [] },
  en_progreso:        { admin: ['pendiente_revision','cancelado'],   lider: ['pendiente_revision'], apoyo: [] },
  pendiente_revision: { admin: ['observado','cerrado','en_progreso'], lider: [],                  apoyo: [] },
  observado:          { admin: ['cerrado','cancelado'],              lider: ['en_progreso'],      apoyo: [] },
  cerrado:            { admin: [],                                   lider: [],                   apoyo: [] },
  cancelado:          { admin: ['borrador'],                         lider: [],                   apoyo: [] },
};

// ── Sesión ─────────────────────────────────────────────────────────────────────
let _session = null;

export async function getSession() {
  if (_session) return _session;
  const stored = sessionStorage.getItem('ecofit_session');
  if (stored) { _session = JSON.parse(stored); return _session; }
  const saved = await kv.get('session');
  if (saved) { _session = saved; return _session; }
  return null;
}

export function setSession(user) {
  const session = { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
  _session = session;
  sessionStorage.setItem('ecofit_session', JSON.stringify(session));
  kv.set('session', session);
}

export async function logout() {
  _session = null;
  sessionStorage.removeItem('ecofit_session');
  await kv.set('session', null);
}

// ── Login ──────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  await seedIfEmpty();
  const user = await users.getByUsername(username.trim().toLowerCase());
  if (!user) throw new Error('Usuario o contraseña incorrectos');

  const hashed = await hashPassword(password);
  let valid = false;

  if (isHashed(user.password)) {
    // Contraseña ya hasheada — comparar hash
    valid = user.password === hashed;
  } else {
    // Contraseña en plaintext (legacy) — comparar y migrar automáticamente
    valid = user.password === password;
    if (valid) {
      await users.update(user.id, { password: hashed });
    }
  }

  if (!valid) throw new Error('Usuario o contraseña incorrectos');
  if (!user.activo) throw new Error('Usuario desactivado. Contacta al administrador.');
  setSession(user);
  return user;
}

// ── Helpers de rol ─────────────────────────────────────────────────────────────
export function isAdmin(session)  { return session?.rol === 'admin'; }
export function isLider(session)  { return session?.rol === 'lider' || session?.rol === 'admin'; }

export function canTransition(session, estadoActual, nuevoEstado) {
  const rol = session?.rol;
  if (!rol) return false;
  const allowed = TRANSITIONS[estadoActual]?.[rol] ?? [];
  return allowed.includes(nuevoEstado);
}

export function canEdit(session, project) {
  if (!session) return false;
  if (session.rol === 'admin') return true;
  if (session.rol === 'lider' && project.tecnicoLiderId === session.id) return true;
  if (session.rol === 'apoyo' && (project.tecnicosApoyo || []).includes(session.id)) return true;
  return false;
}

// ── Guard — verificar sesión al cargar ────────────────────────────────────────
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.hash = '#login';
    return null;
  }
  return session;
}

// ── Render pantalla de login ───────────────────────────────────────────────────
export function renderLogin() {
  return `
  <div class="login-screen">
    <div class="login-card">
      <div class="login-logo">
        ${icon('sun', 48, 'logo-icon')}
      </div>
      <h1 class="login-title">Ecofit Solar</h1>
      <p class="login-sub">Bitácora de Instalaciones</p>

      <form id="login-form" class="login-form" onsubmit="window._submitLogin(event)">
        <div class="form-group">
          <label>Usuario</label>
          <div class="input-icon-wrap">
            ${icon('user', 20, 'input-icon')}
            <input type="text" id="login-user" name="username" autocomplete="username"
                   placeholder="Ingresa tu usuario" required />
          </div>
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <div class="input-icon-wrap">
            ${icon('lock', 20, 'input-icon')}
            <input type="password" id="login-pass" name="password" autocomplete="current-password"
                   placeholder="••••••••" required />
          </div>
        </div>
        <div id="login-error" class="login-error" style="display:none"></div>
        <button type="submit" class="btn-primary btn-full" id="login-btn">
          Iniciar sesión
        </button>
      </form>

      <p class="login-version">Ecofit Solar Solutions · La Paz, BCS</p>
    </div>
  </div>`;
}

window._submitLogin = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pass').value;

  btn.disabled = true;
  btn.textContent = 'Verificando…';
  errEl.style.display = 'none';

  try {
    await login(username, password);
    window.location.hash = '#dashboard';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
  }
};
