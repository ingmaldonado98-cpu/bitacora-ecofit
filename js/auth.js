// auth.js — Autenticación Firebase · Bitácora Ecofit V6

import { fbAuth, fbUsers, seedAdminIfEmpty, toEmail } from './firebase.js';
import { signInWithEmailAndPassword, signOut }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { icon }                                        from './icons.js';

// ── Roles ──────────────────────────────────────────────────────────────────
export const ROLES = {
  admin:  { label: 'Administrador', level: 3 },
  lider:  { label: 'Técnico Líder', level: 2 },
  apoyo:  { label: 'Técnico Apoyo', level: 1 },
};

// ── Transiciones de estado ─────────────────────────────────────────────────
export const TRANSITIONS = {
  borrador:           { admin: ['en_progreso','cancelado'],           lider: ['en_progreso'],       apoyo: [] },
  en_progreso:        { admin: ['pendiente_revision','cancelado'],    lider: ['pendiente_revision'], apoyo: ['pendiente_revision'] },
  pendiente_revision: { admin: ['observado','cerrado','en_progreso'], lider: [],                    apoyo: [] },
  observado:          { admin: ['cerrado','cancelado'],               lider: ['en_progreso'],        apoyo: [] },
  cerrado:            { admin: [],                                    lider: [],                     apoyo: [] },
  cancelado:          { admin: ['borrador'],                          lider: [],                     apoyo: [] },
};

// ── Sesión en memoria + localStorage (offline-safe) ───────────────────────
const _LS_KEY = 'ecofit_session_v2';
const _LS_TTL = 7 * 24 * 3600 * 1000; // 7 días

let _session = null;

export async function getSession() {
  if (_session) return _session;

  // 1. sessionStorage (misma pestaña / misma sesión del navegador)
  const ss = sessionStorage.getItem('ecofit_session');
  if (ss) { _session = JSON.parse(ss); return _session; }

  // 2. localStorage (persiste entre reinicios — funciona OFFLINE)
  try {
    const ls = localStorage.getItem(_LS_KEY);
    if (ls) {
      const stored = JSON.parse(ls);
      if (Date.now() - stored._savedAt < _LS_TTL) {
        const { _savedAt, ...s } = stored;
        _session = s;
        // Restaurar sessionStorage para que el resto de la app funcione igual
        sessionStorage.setItem('ecofit_session', JSON.stringify(s));
        return _session;
      }
    }
  } catch { /* silencioso */ }

  return null;
}

function setSession(profile) {
  const s = { id: profile.id, username: profile.username, nombre: profile.nombre, rol: profile.rol };
  _session = s;
  sessionStorage.setItem('ecofit_session', JSON.stringify(s));
  // Persistir en localStorage para acceso offline (7 días)
  localStorage.setItem(_LS_KEY, JSON.stringify({ ...s, _savedAt: Date.now() }));
}

export async function logout() {
  _session = null;
  sessionStorage.removeItem('ecofit_session');
  localStorage.removeItem(_LS_KEY);
  try { await signOut(fbAuth); } catch (_) {}
}

// ── Login con Firebase Auth ────────────────────────────────────────────────
export async function login(username, password) {
  // Crear admin si es la primera vez (base de datos vacía)
  await seedAdminIfEmpty();

  try {
    // Buscar perfil primero para obtener el authEmail correcto (real o sintético)
    const profilePre = await fbUsers.getByUsername(username);
    const authEmail  = profilePre?.authEmail || toEmail(username);

    const cred = await signInWithEmailAndPassword(fbAuth, authEmail, password);
    const uid  = cred.user.uid;

    // Cargar perfil desde Firestore
    let profile = await fbUsers.getById(uid);
    if (!profile) profile = profilePre;
    if (!profile) throw new Error('Perfil de usuario no encontrado en Firestore.');
    if (!profile.activo) throw new Error('Usuario desactivado. Contacta al administrador.');

    setSession({ ...profile, id: uid });
    return profile;
  } catch (err) {
    const code = err.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') ||
        code.includes('user-not-found')     || code.includes('invalid-email')) {
      throw new Error('Usuario o contraseña incorrectos');
    }
    throw err;
  }
}

// ── Helpers de rol ─────────────────────────────────────────────────────────
export function isAdmin(session)  { return session?.rol === 'admin'; }
export function isLider(session)  { return session?.rol === 'lider' || session?.rol === 'admin'; }

export function canTransition(session, estadoActual, nuevoEstado) {
  const rol     = session?.rol;
  if (!rol) return false;
  const allowed = TRANSITIONS[estadoActual]?.[rol] ?? [];
  return allowed.includes(nuevoEstado);
}

export function canEdit(session, project) {
  if (!session) return false;
  if (session.rol === 'admin') return true;

  // Proyectos cerrados o cancelados no se editan
  if (['cerrado', 'cancelado'].includes(project?.estado)) return false;

  // Técnico Líder puede editar cualquier proyecto activo
  if (session.rol === 'lider') return true;

  // Técnico Apoyo solo puede editar los proyectos donde está asignado
  if (session.rol === 'apoyo') {
    return project.tecnicoLiderId === session.id ||
           (project.tecnicosApoyo || []).includes(session.id);
  }

  return false;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.hash = '#login'; return null; }
  return session;
}

// ── Render pantalla de login ───────────────────────────────────────────────
export function renderLogin() {
  return `
  <div class="login-screen">
    <div class="login-card">
      <div class="login-logo">
        <svg width="56" height="56" viewBox="0 0 256 256" fill="var(--solar)">
          <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/>
        </svg>
      </div>
      <h1 class="login-title">Ecofit Solar</h1>
      <p class="login-sub">Bitácora de Instalaciones</p>

      <form id="login-form" class="login-form" onsubmit="window._submitLogin(event)">
        <div class="form-group">
          <label>Usuario</label>
          <div class="input-icon-wrap">
            ${icon('user', 18, 'input-icon')}
            <input type="text" id="login-user" name="username" autocomplete="username"
                   placeholder="Ingresa tu usuario" required />
          </div>
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <div class="input-icon-wrap">
            ${icon('lock', 18, 'input-icon')}
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
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  btn.disabled    = true;
  btn.textContent = 'Verificando…';
  errEl.style.display = 'none';

  try {
    await login(username, password);
    window.location.hash = '#dashboard';
  } catch (err) {
    errEl.textContent    = err.message;
    errEl.style.display  = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Iniciar sesión';
  }
};
