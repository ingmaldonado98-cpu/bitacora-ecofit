// local-store.js — Almacenamiento local con Capacitor Filesystem (nativo) o localStorage (web)

import { getPlugin } from './platform.js';

const DIR   = 'DATA';
const IDX   = 'ecofit/projects/_index.json';
const BASE  = 'ecofit/projects/';
const USERS = 'ecofit/users.json';

// ── Caché en memoria (ambas plataformas) ──────────────────────────────────
const _mem   = new Map(); // id → project
let   _users = null;

// ── FS helpers ────────────────────────────────────────────────────────────
async function _read(path) {
  const FS = getPlugin('Filesystem');
  if (!FS) {
    const raw = localStorage.getItem('ecofit_fs::' + path);
    return raw ? JSON.parse(raw) : null;
  }
  try {
    const r = await FS.readFile({ path, directory: DIR, encoding: 'utf8' });
    return JSON.parse(typeof r.data === 'string' ? r.data : r.data);
  } catch { return null; }
}

async function _write(path, data) {
  const FS = getPlugin('Filesystem');
  if (!FS) {
    try { localStorage.setItem('ecofit_fs::' + path, JSON.stringify(data)); } catch {}
    return;
  }
  await FS.writeFile({ path, data: JSON.stringify(data), directory: DIR, recursive: true, encoding: 'utf8' });
}

async function _del(path) {
  const FS = getPlugin('Filesystem');
  if (!FS) { localStorage.removeItem('ecofit_fs::' + path); return; }
  try { await FS.deleteFile({ path, directory: DIR }); } catch {}
}

// ── Index helpers ─────────────────────────────────────────────────────────
async function _addToIndex(id) {
  const idx = (await _read(IDX)) || [];
  if (!idx.includes(id)) { idx.push(id); await _write(IDX, idx); }
}
async function _removeFromIndex(id) {
  const idx = ((await _read(IDX)) || []).filter(x => x !== id);
  await _write(IDX, idx);
}

// ── API pública ───────────────────────────────────────────────────────────
export const localStore = {

  // ── Proyectos ──────────────────────────────────────────────────────────
  async getAll() {
    const idx = await _read(IDX);
    if (!idx?.length) return null;
    const list = await Promise.all(
      idx.map(id => _mem.has(id) ? _mem.get(id) : _read(BASE + id + '.json'))
    );
    return list.filter(Boolean);
  },

  async getById(id) {
    if (_mem.has(id)) return _mem.get(id);
    const p = await _read(BASE + id + '.json');
    if (p) _mem.set(id, p);
    return p;
  },

  async save(project) {
    _mem.set(project.id, project);
    await _write(BASE + project.id + '.json', project);
    await _addToIndex(project.id);
  },

  // Guarda múltiples proyectos de una sola vez (bulk sync desde Firestore)
  async saveMany(projects) {
    if (!projects?.length) return;
    const ids = projects.map(p => p.id);
    await _write(IDX, ids);
    await Promise.all(projects.map(p => {
      _mem.set(p.id, p);
      return _write(BASE + p.id + '.json', p);
    }));
  },

  async delete(id) {
    _mem.delete(id);
    await _del(BASE + id + '.json');
    await _removeFromIndex(id);
  },

  // Actualiza solo en memoria, sin tocar disco (para setField rápidos)
  updateMem(id, project) {
    _mem.set(id, project);
  },

  // ── Usuarios ───────────────────────────────────────────────────────────
  async getUsers() {
    if (_users) return _users;
    _users = await _read(USERS);
    return _users;
  },

  async saveUsers(users) {
    _users = users;
    await _write(USERS, users);
  },

  isNative: () => !!getPlugin('Filesystem'),
};

// ── Purgar proyectos concluidos sin actividad reciente ────────────────────
// Máximo una vez por día; solo actúa si hay >15 proyectos en caché.
// Solo elimina estado 'concluido' con updatedAt > maxAgeDays días.
const _PRUNE_TS = 'ecofit_last_prune';
export async function pruneOldProjects(maxAgeDays = 60) {
  try {
    const last = localStorage.getItem(_PRUNE_TS);
    if (last && Date.now() - Number(last) < 86_400_000) return 0;
    const idx = await _read(IDX);
    if (!idx?.length || idx.length < 15) return 0;
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
    const toKeep = [];
    let pruned = 0;
    for (const id of idx) {
      const p = await _read(BASE + id + '.json');
      if (!p) continue;
      if (p.estado === 'concluido' && (p.updatedAt || '') < cutoff) {
        await _del(BASE + id + '.json');
        _mem.delete(id);
        pruned++;
      } else {
        toKeep.push(id);
      }
    }
    if (pruned > 0) await _write(IDX, toKeep);
    localStorage.setItem(_PRUNE_TS, String(Date.now()));
    return pruned;
  } catch { return 0; }
}
