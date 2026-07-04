// sync-queue.js — Cola de escrituras Firestore pendientes (offline → flush al reconectar)

const Q_KEY = 'ecofit_sync_q';

function _load() {
  try { return JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch { return []; }
}
function _save(q) {
  try { localStorage.setItem(Q_KEY, JSON.stringify(q)); } catch {}
}

export const syncQueue = {
  enqueue(op, args) {
    const q = _load();
    if (op === 'setField') {
      // Deduplica por id+path: dos setField sobre el mismo campo = solo el último importa
      const key = args.id + '::' + args.path;
      const idx = q.findIndex(e => e.op === 'setField' && e.key === key);
      if (idx >= 0) { q[idx] = { op, key, args, ts: Date.now() }; }
      else          { q.push({ op, key, args, ts: Date.now() }); }
    } else {
      q.push({ op, args, ts: Date.now() });
    }
    _save(q);
  },

  count: () => _load().length,

  // Aplica los cambios pendientes sobre el objeto en memoria (uso al inicio sin internet)
  applyToProject(id, project) {
    const q = _load();
    for (const item of q) {
      if (item.op === 'setField' && item.args.id === id) {
        _setPath(project, item.args.path, item.args.value);
      }
    }
    return project;
  },

  async flush(fbProjects) {
    if (!navigator.onLine) return 0;
    const q = _load();
    if (!q.length) return 0;
    const failed = [];
    let flushed = 0;
    for (const item of q) {
      try {
        if      (item.op === 'setField') await fbProjects.setField(item.args.id, item.args.path, item.args.value);
        else if (item.op === 'update')   await fbProjects.update(item.args.id, item.args.changes);
        else if (item.op === 'add')      await fbProjects.add(item.args.data);
        else if (item.op === 'delete')   await fbProjects.delete(item.args.id);
        flushed++;
      } catch { failed.push(item); }
    }
    _save(failed);
    return flushed;
  },
};

function _setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
