// db.js — Capa de datos híbrida: local-first (Filesystem/localStorage) + Firestore sync

import { fbProjects, fbUsers, fbConfig, fbKV, fbReminders, fbPublicCards, exportFbBackup } from './firebase.js';
import { localStore } from './local-store.js';
import { syncQueue  } from './sync-queue.js';

// ── Utilidad: asignar valor en ruta anidada ───────────────────────────────
function _setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Escritura a disco debounced por proyecto (evita thrashing en checklist) ─
const _flushTimers = {};
function _scheduleDiskWrite(project) {
  clearTimeout(_flushTimers[project.id]);
  _flushTimers[project.id] = setTimeout(() => localStore.save(project), 800);
}

// ── Sync background: flush cola → pull Firestore → actualiza local ─────────
let _syncing = false;
async function _bgSync() {
  if (_syncing || !navigator.onLine) return;
  _syncing = true;
  try {
    const flushed = await syncQueue.flush(fbProjects);
    const [remote, remoteUsers] = await Promise.all([
      fbProjects.getAll(),
      fbUsers.getAll().catch(() => null),
    ]);
    await localStore.saveMany(remote);
    if (remoteUsers) await localStore.saveUsers(remoteUsers);
    if (flushed > 0) {
      window.dispatchEvent(new CustomEvent('ecofit:synced', { detail: { flushed } }));
    }
  } catch { /* silencioso — reintentará en el próximo evento online */ }
  finally { _syncing = false; }
}

// Dispara sync cada vez que se recupera internet
window.addEventListener('online', () => _bgSync());
// Sync inicial diferido (deja que Firebase inicialice primero)
setTimeout(() => { if (navigator.onLine) _bgSync(); }, 2000);

// ── Proyectos ──────────────────────────────────────────────────────────────
export const projects = {

  getAll: async () => {
    const local = await localStore.getAll();
    if (local?.length) {
      // Datos locales disponibles → devolver de inmediato, sync en background
      if (navigator.onLine) _bgSync();
      return local;
    }
    // Sin caché local → esperar Firestore y guardar
    const remote = await fbProjects.getAll();
    await localStore.saveMany(remote);
    return remote;
  },

  getById: async (id) => {
    let local = await localStore.getById(id);
    if (local) {
      // Aplica cambios pendientes de cola para que la vista refleje ediciones offline
      local = syncQueue.applyToProject(id, local);
      localStore.updateMem(id, local);
      if (navigator.onLine) _bgSync();
      return local;
    }
    // Sin caché → Firestore
    const remote = await fbProjects.getById(id);
    if (remote) await localStore.save(remote);
    return remote;
  },

  add: async (data) => {
    await localStore.save(data);
    if (navigator.onLine) {
      try { await fbProjects.add(data); }
      catch { syncQueue.enqueue('add', { data }); }
    } else {
      syncQueue.enqueue('add', { data });
    }
  },

  update: async (id, changes) => {
    // Combinar con local para no perder campos existentes
    const current = (await localStore.getById(id)) || {};
    const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
    await localStore.save(updated);
    if (navigator.onLine) {
      try { await fbProjects.update(id, changes); }
      catch { syncQueue.enqueue('update', { id, changes }); }
    } else {
      syncQueue.enqueue('update', { id, changes });
    }
    return updated;
  },

  delete: async (id) => {
    await localStore.delete(id);
    if (navigator.onLine) {
      try { await fbProjects.delete(id); }
      catch { syncQueue.enqueue('delete', { id }); }
    } else {
      syncQueue.enqueue('delete', { id });
    }
  },

  setField: async (id, path, value) => {
    // 1. Actualizar en memoria inmediatamente
    const project = await localStore.getById(id);
    if (project) {
      _setPath(project, path, value);
      localStore.updateMem(id, project);
      _scheduleDiskWrite(project); // escribir a disco debounced
    }
    // 2. Firestore: directo si online, encolar si offline
    if (navigator.onLine) {
      try { await fbProjects.setField(id, path, value); }
      catch { syncQueue.enqueue('setField', { id, path, value }); }
    } else {
      syncQueue.enqueue('setField', { id, path, value });
    }
  },

  search: async (q) => {
    const all = await projects.getAll();
    const ql  = q.toLowerCase();
    return all.filter(p =>
      p.displayId?.toLowerCase().includes(ql)  ||
      p.clientName?.toLowerCase().includes(ql) ||
      p.direccion?.toLowerCase().includes(ql)  ||
      p.garantia?.equipos?.some(e => e.serial?.toLowerCase().includes(ql))
    );
  },
};

// ── Usuarios ───────────────────────────────────────────────────────────────
export const users = {
  getAll: async () => {
    const local = await localStore.getUsers();
    if (local) {
      if (navigator.onLine) fbUsers.getAll().then(r => localStore.saveUsers(r)).catch(() => {});
      return local;
    }
    const remote = await fbUsers.getAll();
    await localStore.saveUsers(remote);
    return remote;
  },
  getById:      fbUsers.getById,
  getByUsername:fbUsers.getByUsername,
  add:          fbUsers.add,
  update:       fbUsers.update,
  delete:       fbUsers.delete,
};

// ── Stores de paso directo (no requieren offline) ─────────────────────────
export const config      = fbConfig;
export const kv          = fbKV;
export const inventario  = fbKV;
export const reminders   = fbReminders;
export const publicCards = fbPublicCards;

// ── Estado de sync (para indicadores en UI) ───────────────────────────────
export const syncStatus = {
  pending: () => syncQueue.count(),
};

// ── Backup ─────────────────────────────────────────────────────────────────
export async function exportBackup() { return exportFbBackup(); }

export async function importBackup(data) {
  if (!data?.version) throw new Error('Formato de backup inválido');
  for (const p of (data.projects || []))                      await projects.add(p);
  for (const u of (data.users || []))      if (u.id)          await fbUsers.add(u).catch(() => {});
  for (const [k, v] of Object.entries(data.config || {}))     await fbConfig.set(k, v);
  for (const [k, v] of Object.entries(data.kv || {}))         await fbKV.set(k, v);
}

export { seedAdminIfEmpty as seedIfEmpty } from './firebase.js';

// ── Change log ─────────────────────────────────────────────────────────────
const MAX_LOG = 50;
export async function logChange(projectId, { modulo, accion, detalle, quien }) {
  try {
    const p = await projects.getById(projectId);
    if (!p) return;
    const entry = {
      ts:     new Date().toISOString(),
      modulo: modulo  || '—',
      accion: accion  || 'guardado',
      detalle:detalle || '',
      uid:    quien?.id || quien?.uid || '',
      nombre: quien?.nombre || quien?.email || '—',
    };
    const log = Array.isArray(p.changeLog) ? p.changeLog : [];
    await projects.setField(projectId, 'changeLog', [entry, ...log].slice(0, MAX_LOG));
  } catch {}
}

export function openDB() { return Promise.resolve(null); }
