// db.js — Capa de datos híbrida: local-first (Filesystem/localStorage) + Firestore sync

import { fbProjects, fbUsers, fbConfig, fbKV, fbReminders, fbPublicCards, exportFbBackup } from './firebase.js';
import { localStore } from './local-store.js';
import { syncQueue  } from './sync-queue.js';

// ── Caché local para kv / config / inventario ─────────────────────────────
// localStorage síncrono — los valores son pequeños (<200 KB).
// Prefijos: 'kv' = panel presets, 'cfg' = config, 'inv' = inventario
const _LS = 'ecofit_kvcache::';
const _KVQ_KEY = 'ecofit_kv_q'; // cola de escrituras pendientes

function _lsGet(ns, key) {
  try { const r = localStorage.getItem(_LS + ns + '::' + key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function _lsSet(ns, key, value) {
  try { localStorage.setItem(_LS + ns + '::' + key, JSON.stringify(value)); } catch {}
}
function _lsDel(ns, key) {
  try { localStorage.removeItem(_LS + ns + '::' + key); } catch {}
}

// Cola de escrituras kv/config/inventario offline (deduplicada por ns+key)
function _kvQLoad() { try { return JSON.parse(localStorage.getItem(_KVQ_KEY) || '[]'); } catch { return []; } }
function _kvQSave(q) { try { localStorage.setItem(_KVQ_KEY, JSON.stringify(q)); } catch {} }
function _kvQEnqueue(ns, key, value) {
  const q = _kvQLoad();
  const idx = q.findIndex(e => e.ns === ns && e.key === key);
  const entry = { ns, key, value, ts: Date.now() };
  if (idx >= 0) q[idx] = entry; else q.push(entry);
  _kvQSave(q);
  _requestBgSync();
}
async function _kvQFlush() {
  if (!navigator.onLine) return;
  const q = _kvQLoad();
  if (!q.length) return;
  const failed = [];
  for (const item of q) {
    try {
      if (item.ns === 'cfg') await fbConfig.set(item.key, item.value);
      else                   await fbKV.set(item.key, item.value); // kv + inv
    } catch { failed.push(item); }
  }
  _kvQSave(failed);
}

// ── Recordatorios — local-first ───────────────────────────────────────────
const _REM_CACHE = 'ecofit_rem_cache';
const _REM_Q     = 'ecofit_rem_q';
function _remGet()     { try { const r = localStorage.getItem(_REM_CACHE); return r ? JSON.parse(r) : null; } catch { return null; } }
function _remSet(list) { try { localStorage.setItem(_REM_CACHE, JSON.stringify(list)); } catch {} }
function _remQLoad()   { try { return JSON.parse(localStorage.getItem(_REM_Q) || '[]'); } catch { return []; } }
function _remQSave(q)  { try { localStorage.setItem(_REM_Q, JSON.stringify(q)); } catch {} }
function _remQEnqueue(op, payload) {
  const q = _remQLoad();
  if (payload.id) {
    const idx = q.findIndex(e => e.id === payload.id);
    if (idx >= 0) { q[idx] = { op, ...payload, ts: Date.now() }; }
    else q.push({ op, ...payload, ts: Date.now() });
  } else {
    q.push({ op, ...payload, ts: Date.now() });
  }
  _remQSave(q);
  _requestBgSync();
}
async function _remQFlush() {
  if (!navigator.onLine) return;
  const q = _remQLoad();
  if (!q.length) return;
  const failed = [];
  for (const item of q) {
    try {
      if      (item.op === 'add')      await fbReminders.add(item.data);
      else if (item.op === 'update')   await fbReminders.update(item.id, item.changes);
      else if (item.op === 'complete') await fbReminders.complete(item.id, item.byName);
      else if (item.op === 'delete')   await fbReminders.delete(item.id);
    } catch { failed.push(item); }
  }
  _remQSave(failed);
  if (!failed.length) fbReminders.getAll().then(list => _remSet(list)).catch(() => {});
}

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

// ── Background Sync: pide al SO que dispare sync aunque la app esté en BG ──
function _requestBgSync() {
  try {
    navigator.serviceWorker?.ready.then(reg => {
      reg.sync?.register('ecofit-sync').catch(() => {});
    }).catch(() => {});
  } catch {}
}
export function triggerSync() { if (navigator.onLine) _bgSync(); }

// ── Sesión activa (para etiquetar escrituras con el autor) ────────────────
let _session = null;
export function setDbSession(s) { _session = s; }

// ── Dirty markers — detectan ediciones offline para conflictos ─────────────
// Se guarda al primer write offline; se limpia cuando _bgSync flush exitoso.
// baseSyncedAt = project.updatedAt en el momento de ir offline (no local edit).
const _DIRTY_PFX = 'ecofit_dirty::';
function _markDirty(id, baseSyncedAt) {
  try {
    if (!localStorage.getItem(_DIRTY_PFX + id)) {
      localStorage.setItem(_DIRTY_PFX + id, JSON.stringify({
        baseSyncedAt: baseSyncedAt || '',
        by: _session?.nombre || _session?.id || '',
      }));
    }
  } catch {}
}
function _clearDirty(id) { try { localStorage.removeItem(_DIRTY_PFX + id); } catch {} }
function _getDirty(id)   { try { return JSON.parse(localStorage.getItem(_DIRTY_PFX + id) || 'null'); } catch { return null; } }
function _getDirtyIds()  {
  try {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(_DIRTY_PFX))
      .map(k => k.slice(_DIRTY_PFX.length));
  } catch { return []; }
}

// ── Sync background: flush cola → pull Firestore → actualiza local ─────────
let _syncing = false;
async function _bgSync() {
  if (_syncing || !navigator.onLine) return;
  _syncing = true;
  try {
    // ── Detección de conflictos ANTES de flush ────────────────────────────
    // Si otro técnico modificó el proyecto mientras estábamos offline,
    // nuestro flush va a sobrescribir sus cambios. Lo detectamos comparando
    // el updatedAt del servidor con el updatedAt que tenía el proyecto la
    // última vez que lo sincronizamos (guardado en el dirty marker).
    const dirtyIds = _getDirtyIds();
    const conflicts = [];
    if (dirtyIds.length) {
      for (const id of dirtyIds) {
        const marker = _getDirty(id);
        if (!marker?.baseSyncedAt) continue;
        try {
          const remote = await fbProjects.getById(id);
          if (remote?.updatedAt &&
              remote.updatedAt > marker.baseSyncedAt &&
              remote.updatedBy && remote.updatedBy !== marker.by) {
            conflicts.push({
              id,
              displayId: remote.displayId || id,
              by:        remote.updatedBy,
              at:        remote.updatedAt,
            });
          }
        } catch {}
      }
    }

    const flushed = await syncQueue.flush(fbProjects);
    await _kvQFlush();
    await _remQFlush();
    const [remote, remoteUsers] = await Promise.all([
      fbProjects.getAll(),
      fbUsers.getAll().catch(() => null),
    ]);
    await localStore.saveMany(remote);
    if (remoteUsers) await localStore.saveUsers(remoteUsers);
    fbReminders.getAll().then(list => _remSet(list)).catch(() => {});
    try { localStorage.setItem('ecofit_last_sync', String(Date.now())); } catch {}
    localStore.pruneOldProjects().catch(() => {});

    // Limpiar dirty markers ahora que sync fue exitoso
    for (const id of dirtyIds) _clearDirty(id);

    if (flushed > 0) {
      window.dispatchEvent(new CustomEvent('ecofit:synced', { detail: { flushed } }));
    }
    if (conflicts.length) {
      window.dispatchEvent(new CustomEvent('ecofit:conflict', { detail: { conflicts } }));
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
      catch { syncQueue.enqueue('add', { data }); _requestBgSync(); }
    } else {
      syncQueue.enqueue('add', { data }); _requestBgSync();
    }
  },

  update: async (id, changes) => {
    const current = (await localStore.getById(id)) || {};
    const _baseSyncedAt = current.updatedAt || '';
    const updBy = _session?.nombre || _session?.id || '';
    const updated = { ...current, ...changes, updatedAt: new Date().toISOString(), updatedBy: updBy };
    await localStore.save(updated);
    const changesWithAuthor = { ...changes, updatedBy: updBy };
    if (navigator.onLine) {
      try { await fbProjects.update(id, changesWithAuthor); }
      catch {
        syncQueue.enqueue('update', { id, changes: changesWithAuthor });
        _markDirty(id, _baseSyncedAt);
        _requestBgSync();
      }
    } else {
      syncQueue.enqueue('update', { id, changes: changesWithAuthor });
      _markDirty(id, _baseSyncedAt);
      _requestBgSync();
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
    const project = await localStore.getById(id);
    const _baseSyncedAt = project?.updatedAt || '';
    if (project) {
      _setPath(project, path, value);
      localStore.updateMem(id, project);
      _scheduleDiskWrite(project);
    }
    if (navigator.onLine) {
      try { await fbProjects.setField(id, path, value); }
      catch {
        syncQueue.enqueue('setField', { id, path, value });
        _markDirty(id, _baseSyncedAt);
        _requestBgSync();
      }
    } else {
      syncQueue.enqueue('setField', { id, path, value });
      _markDirty(id, _baseSyncedAt);
      _requestBgSync();
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

// ── kv — local-first (panel_presets_custom, contadores) ───────────────────
export const kv = {
  get: async (key) => {
    const cached = _lsGet('kv', key);
    if (cached !== null) {
      if (navigator.onLine) fbKV.get(key).then(v => { if (v !== null) _lsSet('kv', key, v); }).catch(() => {});
      return cached;
    }
    if (!navigator.onLine) return null;
    const val = await fbKV.get(key);
    if (val !== null) _lsSet('kv', key, val);
    return val;
  },
  set: async (key, value) => {
    _lsSet('kv', key, value);
    if (navigator.onLine) {
      try { await fbKV.set(key, value); }
      catch { _kvQEnqueue('kv', key, value); }
    } else {
      _kvQEnqueue('kv', key, value);
    }
  },
  inc: async (key, start = 1) => {
    if (!navigator.onLine) {
      const local = _lsGet('kv', key) ?? (start - 1);
      const next = local + 1;
      _lsSet('kv', key, next);
      _kvQEnqueue('kv', key, next);
      return next;
    }
    const next = await fbKV.inc(key, start);
    _lsSet('kv', key, next);
    return next;
  },
};

// ── config — local-first (contactoEcofit, ajustes globales) ───────────────
export const config = {
  get: async (key) => {
    const cached = _lsGet('cfg', key);
    if (cached !== null) {
      if (navigator.onLine) fbConfig.get(key).then(v => { if (v !== null) _lsSet('cfg', key, v); }).catch(() => {});
      return cached;
    }
    if (!navigator.onLine) return null;
    const val = await fbConfig.get(key);
    if (val !== null) _lsSet('cfg', key, val);
    return val;
  },
  set: async (key, value) => {
    _lsSet('cfg', key, value);
    if (navigator.onLine) {
      try { await fbConfig.set(key, value); }
      catch { _kvQEnqueue('cfg', key, value); }
    } else {
      _kvQEnqueue('cfg', key, value);
    }
  },
  delete: async (key) => {
    _lsDel('cfg', key);
    if (navigator.onLine) await fbConfig.delete(key).catch(() => {});
  },
};

// ── inventario — local-first (catalog, areas, stock, history) ─────────────
export const inventario = {
  get: async (key) => {
    const cached = _lsGet('inv', key);
    if (cached !== null) {
      if (navigator.onLine) fbKV.get(key).then(v => { if (v !== null) _lsSet('inv', key, v); }).catch(() => {});
      return cached;
    }
    if (!navigator.onLine) return null;
    const val = await fbKV.get(key);
    if (val !== null) _lsSet('inv', key, val);
    return val;
  },
  set: async (key, value) => {
    _lsSet('inv', key, value);
    if (navigator.onLine) {
      try { await fbKV.set(key, value); }
      catch { _kvQEnqueue('inv', key, value); }
    } else {
      _kvQEnqueue('inv', key, value);
    }
  },
};

// ── reminders — local-first ───────────────────────────────────────────────
export const reminders = {
  getAll: async () => {
    const cached = _remGet();
    if (cached) {
      if (navigator.onLine) fbReminders.getAll().then(v => _remSet(v)).catch(() => {});
      return cached;
    }
    if (!navigator.onLine) return [];
    const list = await fbReminders.getAll();
    _remSet(list);
    return list;
  },
  add: async (data) => {
    _remSet([data, ...(_remGet() || [])]);
    if (navigator.onLine) {
      try { await fbReminders.add(data); }
      catch { _remQEnqueue('add', { data }); }
    } else { _remQEnqueue('add', { data }); }
  },
  update: async (id, changes) => {
    const list = _remGet() || [];
    const idx  = list.findIndex(r => r.id === id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...changes }; _remSet(list); }
    if (navigator.onLine) {
      try { await fbReminders.update(id, changes); }
      catch { _remQEnqueue('update', { id, changes }); }
    } else { _remQEnqueue('update', { id, changes }); }
  },
  complete: async (id, byName) => {
    _remSet((_remGet() || []).filter(r => r.id !== id));
    if (navigator.onLine) {
      try { await fbReminders.complete(id, byName); }
      catch { _remQEnqueue('complete', { id, byName }); }
    } else { _remQEnqueue('complete', { id, byName }); }
  },
  delete: async (id) => {
    _remSet((_remGet() || []).filter(r => r.id !== id));
    if (navigator.onLine) {
      try { await fbReminders.delete(id); }
      catch { _remQEnqueue('delete', { id }); }
    } else { _remQEnqueue('delete', { id }); }
  },
};

export const publicCards = fbPublicCards;

// ── Detalle de cola pendiente (para UI en Settings) ───────────────────────
export function getPendingQueue() {
  try {
    const proj = JSON.parse(localStorage.getItem('ecofit_sync_q') || '[]');
    const kv   = _kvQLoad();
    const rem  = _remQLoad();
    return { proj, kv, rem, total: proj.length + kv.length + rem.length };
  } catch { return { proj: [], kv: [], rem: [], total: 0 }; }
}

// ── Estado de sync (para indicadores en UI) ───────────────────────────────
export const syncStatus = {
  // Suma todas las colas offline: proyectos + kv/config/inv + recordatorios
  pending: () =>
    syncQueue.count() +
    _kvQLoad().length +
    _remQLoad().length,
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
