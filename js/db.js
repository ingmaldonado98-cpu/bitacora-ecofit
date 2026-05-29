// db.js — IndexedDB wrapper Ecofit v6
import { hashPassword } from './utils.js';

const DB_NAME = 'ecofitV6';
const DB_VERSION = 2;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // projects — datos completos del proyecto
      if (!db.objectStoreNames.contains('projects')) {
        const s = db.createObjectStore('projects', { keyPath: 'id' });
        s.createIndex('estado',       'estado',       { unique: false });
        s.createIndex('displayId',    'displayId',    { unique: true });
        s.createIndex('updatedAt',    'updatedAt',    { unique: false });
      }

      // users — cuentas de usuario
      if (!db.objectStoreNames.contains('users')) {
        const s = db.createObjectStore('users', { keyPath: 'id' });
        s.createIndex('username', 'username', { unique: true });
      }

      // config — clave-valor (Drive, contacto, etc.)
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }

      // kv — contadores y sesión
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }

      // inventario — almacén (v2)
      if (!db.objectStoreNames.contains('inventario')) {
        db.createObjectStore('inventario', { keyPath: 'key' });
      }
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = () => reject(req.error);
  });
}

// ── Generic helpers ────────────────────────────────────────────────────────────
function tx(stores, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const storeArray = Array.isArray(stores) ? stores : [stores];
    const s = storeArray.length === 1 ? t.objectStore(storeArray[0]) : null;
    const req = fn(s ?? t);
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      t.oncomplete = () => resolve();
      t.onerror    = () => reject(t.error);
    }
  }));
}

function getAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

// ── PROJECTS ───────────────────────────────────────────────────────────────────
export const projects = {
  getAll: () => getAll('projects'),

  getById: (id) => tx('projects', 'readonly', s => s.get(id)),

  add: (data) => tx('projects', 'readwrite', s => s.add(data)),

  update: (id, changes) => openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('projects', 'readwrite');
    const s = t.objectStore('projects');
    const req = s.get(id);
    req.onsuccess = () => {
      if (!req.result) return reject(new Error('Proyecto no encontrado'));
      const updated = { ...req.result, ...changes, updatedAt: new Date().toISOString() };
      const put = s.put(updated);
      put.onsuccess = () => resolve(updated);
      put.onerror   = () => reject(put.error);
    };
    req.onerror = () => reject(req.error);
  })),

  delete: (id) => tx('projects', 'readwrite', s => s.delete(id)),

  search: async (query) => {
    const all = await getAll('projects');
    const q = query.toLowerCase();
    return all.filter(p =>
      p.displayId?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.direccion?.toLowerCase().includes(q) ||
      p.garantia?.paneles?.strings?.some(str =>
        str.paneles?.some(pan => pan.serial?.toLowerCase().includes(q))
      ) ||
      p.garantia?.equipos?.some(eq => eq.serial?.toLowerCase().includes(q))
    );
  },
};

// ── USERS ──────────────────────────────────────────────────────────────────────
export const users = {
  getAll: () => getAll('users'),

  getById: (id) => tx('users', 'readonly', s => s.get(id)),

  getByUsername: (username) => openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction('users', 'readonly')
      .objectStore('users').index('username').get(username);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  })),

  add: (data) => tx('users', 'readwrite', s => s.add(data)),

  update: (id, changes) => openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('users', 'readwrite');
    const s = t.objectStore('users');
    const req = s.get(id);
    req.onsuccess = () => {
      if (!req.result) return reject(new Error('Usuario no encontrado'));
      const put = s.put({ ...req.result, ...changes });
      put.onsuccess = () => resolve();
      put.onerror   = () => reject(put.error);
    };
    req.onerror = () => reject(req.error);
  })),

  delete: (id) => tx('users', 'readwrite', s => s.delete(id)),
};

// ── CONFIG ─────────────────────────────────────────────────────────────────────
export const config = {
  get:    (key)        => tx('config', 'readonly',  s => s.get(key)).then(r => r?.value ?? null),
  set:    (key, value) => tx('config', 'readwrite', s => s.put({ key, value })),
  delete: (key)        => tx('config', 'readwrite', s => s.delete(key)),
};

// ── INVENTARIO store (key-value igual que config) ──────────────────────────────
export const inventario = {
  get:    (key)        => tx('inventario', 'readonly',  s => s.get(key)).then(r => r?.value ?? null),
  set:    (key, value) => tx('inventario', 'readwrite', s => s.put({ key, value })),
  delete: (key)        => tx('inventario', 'readwrite', s => s.delete(key)),
};

// ── KV store (counters, session) ───────────────────────────────────────────────
export const kv = {
  get:    (key)        => tx('kv', 'readonly',  s => s.get(key)).then(r => r?.value ?? null),
  set:    (key, value) => tx('kv', 'readwrite', s => s.put({ key, value })),
  inc:    async (key, start = 1) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('kv', 'readwrite');
      const s = t.objectStore('kv');
      const req = s.get(key);
      req.onsuccess = () => {
        const next = (req.result?.value ?? (start - 1)) + 1;
        const put = s.put({ key, value: next });
        put.onsuccess = () => resolve(next);
        put.onerror   = () => reject(put.error);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

// ── Inicialización — seed admin ────────────────────────────────────────────────
export async function seedIfEmpty() {
  const all = await users.getAll();
  if (all.length > 0) return;
  const hashed = await hashPassword('ecofit2024');
  await users.add({
    id: 'admin-default',
    username: 'admin',
    password: hashed,
    nombre: 'Administrador',
    rol: 'admin',
    activo: true,
    createdAt: new Date().toISOString(),
  });
}

// ── Backup ─────────────────────────────────────────────────────────────────────
export async function exportBackup() {
  const [projs, usrs, kvAll, configAll, invAll] = await Promise.all([
    projects.getAll(),
    users.getAll(),
    getAll('kv'),
    getAll('config'),
    getAll('inventario'),
  ]);
  return {
    version: 6,
    exportedAt: new Date().toISOString(),
    projects: projs,
    users: usrs.map(u => ({ ...u, password: undefined })), // no exportar contraseñas
    kv:         kvAll.filter(r => r.key !== 'session'),    // no exportar sesión activa
    config:     configAll,
    inventario: invAll,
  };
}

export async function importBackup(data) {
  if (!data?.version) throw new Error('Formato de backup inválido');
  const db = await openDB();

  // Restaurar proyectos
  await new Promise((resolve, reject) => {
    const t = db.transaction(['projects'], 'readwrite');
    const s = t.objectStore('projects');
    s.clear();
    (data.projects || []).forEach(p => s.put(p));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });

  // Restaurar kv (presets, contadores) — sin sobreescribir sesión activa
  if (data.kv?.length) {
    await new Promise((resolve, reject) => {
      const t = db.transaction(['kv'], 'readwrite');
      const s = t.objectStore('kv');
      (data.kv || []).filter(r => r.key !== 'session').forEach(r => s.put(r));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  // Restaurar config (Drive, contacto)
  if (data.config?.length) {
    await new Promise((resolve, reject) => {
      const t = db.transaction(['config'], 'readwrite');
      const s = t.objectStore('config');
      (data.config || []).forEach(r => s.put(r));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  // Restaurar inventario
  if (data.inventario?.length) {
    await new Promise((resolve, reject) => {
      const t = db.transaction(['inventario'], 'readwrite');
      const s = t.objectStore('inventario');
      (data.inventario || []).forEach(r => s.put(r));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }
}
