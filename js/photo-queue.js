// photo-queue.js — Cola de fotos pendientes para subida offline
// Las fotos tomadas sin internet se guardan aquí y se suben al reconectar.
//
// Estructura de cada item en la cola:
//   id           — UUID del item en la cola
//   projectId    — ID del proyecto
//   storagePath  — Ruta en Firebase Storage donde subir
//   base64       — Imagen comprimida en data URL
//   createdAt    — ISO timestamp
//   op           — Operación Firestore al completar (ver OPERACIONES abajo)
//   opArgs       — Argumentos específicos de la operación
//   retryCount   — Reintentos fallidos acumulados (backoff exponencial, ver processQueue)
//   localPath    — Ruta en DOCUMENTS donde se guardó la copia local (opcional)

const DB_NAME  = 'ecofit-photo-queue';
const DB_VER   = 1;
const STORE    = 'queue';

// ── Mapa op → nombre de subcarpeta en Filesystem ─────────────────────────────
const _OP_CARPETA = {
  fotoSistema:        'Sistema',
  fotoFase:           'Ejecucion',
  fotoArea:           'Levantamiento',
  fotoLev:            'Levantamiento',
  fotoTecnica:        'Tecnica',
  fotoAdicional:      'Adicional',
  fotoMedidor:        'Levantamiento',
  sombraFoto:         'Levantamiento',
  sunSeeker:          'Levantamiento',
  dronFoto:           'Dron',
  clienteFoto:        'Cliente',
  fotoCierrePaso:     'Cierre',
  fotoArregloPaneles: 'Paneles',
  estructuraFoto:     'Estructura',
  reciboFoto:         'Levantamiento',
  eqFoto:             'Equipos',
  auditoriaDocFirmado:'Auditoria',
};

// Elimina el prefijo "data:image/...;base64," de un data URL
function _stripDataUrl(dataUrl) {
  const idx = dataUrl ? dataUrl.indexOf(',') : -1;
  return idx >= 0 ? dataUrl.slice(idx + 1) : (dataUrl || '');
}

// ── Leer un item de la cola (necesario en dequeuePhoto para obtener localPath) ─
function _getQueueItem(id) {
  return new Promise(resolve => {
    _openDB().then(db => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

// ── Guardar copia de la foto (nativo: Filesystem DOCUMENTS / web: OPFS) ───────
// Ruta: Ecofit/Proyectos/{displayId}/Fotos/{Categoria}_{shortId}.jpg
// Al completar, actualiza el item con `localPath`.
// El prefijo "opfs:" indica Origin Private File System (web); sin prefijo = nativo.
async function _savePhotoLocalAsync(item) {
  // Nombre de carpeta: displayId limpio o projectId como fallback
  let folderName = item.projectId;
  try {
    const { localStore } = await import('./local-store.js');
    const p = await localStore.getById(item.projectId);
    if (p?.displayId) folderName = p.displayId.replace(/[/\\?%*:|"<>]/g, '_').trim();
  } catch { /* usar projectId */ }

  const carpeta = _OP_CARPETA[item.op] || 'Fotos';
  const shortId = item.id.slice(0, 8);
  const relPath = `Ecofit/Proyectos/${folderName}/Fotos/${carpeta}_${shortId}.jpg`;

  const FS = window.Capacitor?.Plugins?.Filesystem;
  if (FS) {
    // ── Nativo Android/iOS: Documentos del dispositivo ───────────────────────
    try {
      await FS.writeFile({ path: relPath, data: _stripDataUrl(item.base64), directory: 'DOCUMENTS', recursive: true });
      await updateQueueItem(item.id, { localPath: relPath });
    } catch { /* silencioso */ }
  } else if (navigator.storage?.getDirectory) {
    // ── Web PWA: Origin Private File System (OPFS) ───────────────────────────
    try {
      const parts  = relPath.split('/');
      const fname  = parts.pop();
      const root   = await navigator.storage.getDirectory();
      let   dir    = root;
      for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true });
      const fh = await dir.getFileHandle(fname, { create: true });
      const wr = await fh.createWritable();
      const b64    = _stripDataUrl(item.base64);
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await wr.write(bytes);
      await wr.close();
      await updateQueueItem(item.id, { localPath: 'opfs:' + relPath });
    } catch { /* silencioso */ }
  }
}

// ── Eliminar archivo local tras subida exitosa ────────────────────────────────
// localPath sin prefijo → Capacitor Filesystem DOCUMENTS
// localPath con prefijo "opfs:" → Origin Private File System
function _deletePhotoLocal(localPath) {
  if (!localPath) return;
  if (localPath.startsWith('opfs:')) {
    _deleteFromOPFS(localPath.slice(5));
    return;
  }
  try {
    const FS = window.Capacitor?.Plugins?.Filesystem;
    if (FS) FS.deleteFile({ path: localPath, directory: 'DOCUMENTS' }).catch(() => {});
  } catch { /* silencioso */ }
}

async function _deleteFromOPFS(relPath) {
  try {
    const parts = relPath.split('/');
    const fname = parts.pop();
    const root  = await navigator.storage.getDirectory();
    let   dir   = root;
    for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: false });
    await dir.removeEntry(fname);
  } catch { /* silencioso */ }
}

// Mapa en memoria: pendingId → base64 (para renderizar fotos pendientes sin IndexedDB async)
window._pendingPhotoMap = window._pendingPhotoMap || {};

// ── Abrir la base de datos ─────────────────────────────────────────────────────
function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Agregar a la cola ─────────────────────────────────────────────────────────
export async function enqueuePhoto(item) {
  const db = await _openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
  // Guardar en mapa de memoria para renderizado inmediato
  window._pendingPhotoMap[item.id] = item.base64;
  _updatePendingBadge();
  // Guardar copia física en Filesystem (backup accesible en explorador/OneDrive)
  _savePhotoLocalAsync(item);
  // Registrar Background Sync para subir cuando vuelva la conexión,
  // incluso si la app está en background o el tab está dormido
  navigator.serviceWorker?.ready
    .then(reg => reg.sync?.register('photo-upload'))
    .catch(() => {});
}

// ── Actualizar item en la cola (patch parcial) ───────────────────────────────
export async function updateQueueItem(id, updates) {
  const db = await _openDB();
  await new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.get(id);
    req.onsuccess = e => {
      const item = e.target.result;
      if (item) store.put({ ...item, ...updates });
    };
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

// ── Eliminar de la cola ───────────────────────────────────────────────────────
export async function dequeuePhoto(id) {
  // Leer antes de eliminar para obtener localPath
  const item = await _getQueueItem(id);
  const db = await _openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
  delete window._pendingPhotoMap[id];
  _updatePendingBadge();
  // Eliminar el archivo local ahora que la foto ya está en Firebase Storage
  if (item?.localPath) _deletePhotoLocal(item.localPath);
}

// ── Obtener todos los items en cola ───────────────────────────────────────────
export async function getAllQueued() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Contar items pendientes ───────────────────────────────────────────────────
export async function getQueueCount() {
  const items = await getAllQueued();
  return items.length;
}

// ── Inicializar mapa de memoria al arranque ───────────────────────────────────
export async function initPendingMap() {
  try {
    const items = await getAllQueued();
    for (const item of items) {
      window._pendingPhotoMap[item.id] = item.base64;
    }
    _updatePendingBadge();
  } catch { /* silencioso */ }
}

// ── Actualizar badge de fotos pendientes en la UI ────────────────────────────
// Cuenta la cola REAL de IndexedDB (no solo el mapa en memoria) y distingue las
// "atascadas" (retryCount >= MAX_RETRIES) — el reintento manual sí las recupera.
async function _updatePendingBadge() {
  let badge = document.getElementById('pending-photos-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'pending-photos-badge';
    badge.className = 'pending-photos-badge';
    badge.title = 'Fotos pendientes de subir';
    // El reintento manual resetea las atascadas (a diferencia del auto-retry).
    badge.onclick = () => forceRetryPhotos();
    document.body.appendChild(badge);
  }
  let total = 0, stuck = 0;
  try {
    const items = await getAllQueued();
    total = items.length;
    stuck = items.filter(i => (i.retryCount || 0) >= MAX_RETRIES).length;
  } catch {
    total = Object.keys(window._pendingPhotoMap).length;
  }
  if (total > 0) {
    badge.textContent = `⬆ ${total} foto${total > 1 ? 's' : ''} sin subir${stuck > 0 ? ` (${stuck} atascada${stuck > 1 ? 's' : ''})` : ''} — toca para reintentar`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ── Procesar la cola completa (llamar al reconectar) ─────────────────────────
// Cada item lleva su propio retryCount persistido en IndexedDB — en campo con
// red inestable (4G débil) evita martillar Storage sin pausa y deja de
// reintentar items permanentemente rotos en vez de bloquear el resto de la cola.
const MAX_RETRIES      = 6;
const BASE_BACKOFF_MS  = 3000;
const MAX_BACKOFF_MS   = 30000;

// Evita que dos pasadas se solapen — en campo con señal intermitente el
// evento 'online' puede dispararse varias veces seguidas antes de que la
// primera pasada termine, reprocesando (y reintentando) la misma cola.
let _processing = false;

export async function processQueue(opts = {}) {
  const { silent = false, force = false } = opts;
  if (_processing && !force) {
    return { synced: 0, stuck: 0, remaining: (await getAllQueued()).length, lastError: null };
  }
  _processing = true;
  try {
    return await _processQueueImpl(silent);
  } finally {
    _processing = false;
  }
}

async function _processQueueImpl(silent) {
  if (!navigator.onLine) return { synced: 0, stuck: 0, remaining: (await getAllQueued()).length, lastError: 'offline' };
  const items = await getAllQueued();
  if (!items.length) return { synced: 0, stuck: 0, remaining: 0, lastError: null };

  const { uploadPhoto } = await import('./firebase.js');
  const { projects }    = await import('./db.js');

  let synced = 0;
  let stuck  = 0;
  let lastError = null;
  for (const item of items) {
    const retryCount = item.retryCount || 0;
    if (retryCount >= MAX_RETRIES) { stuck++; continue; }
    if (retryCount > 0) {
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (retryCount - 1), MAX_BACKOFF_MS);
      await new Promise(r => setTimeout(r, backoff));
    }
    try {
      // Subir a Firebase Storage
      const url = await uploadPhoto(item.base64, item.storagePath);

      // Actualizar Firestore según la operación
      const p = await projects.getById(item.projectId);
      if (!p) { await dequeuePhoto(item.id); continue; }

      switch (item.op) {
        case 'fotoSistema':
          p.garantia = p.garantia || {};
          p.garantia.fotoSistema = url;
          await projects.update(item.projectId, { garantia: p.garantia });
          break;

        case 'auditoriaDocFirmado':
          p.auditoria = p.auditoria || {};
          p.auditoria.docFirmado = url;
          await projects.update(item.projectId, { auditoria: p.auditoria });
          break;

        case 'estructuraFoto': {
          const { campo } = item.opArgs || {};
          p.garantia = p.garantia || {};
          p.garantia.estructura = p.garantia.estructura || {};
          p.garantia.estructura[campo] = url;
          await projects.update(item.projectId, { garantia: p.garantia });
          break;
        }

        case 'fotoArregloPaneles': {
          const { tipo } = item.opArgs || {};
          p.garantia = p.garantia || {};
          p.garantia.paneles = p.garantia.paneles || {};
          const campo = tipo === 'frontal' ? 'fotoArregloFrontal' : 'fotoArregloPerfil';
          p.garantia.paneles[campo] = url;
          await projects.update(item.projectId, { garantia: p.garantia });
          break;
        }

        case 'fotoTecnica': {
          const { key, itemId } = item.opArgs;
          p.garantia = p.garantia || {};
          p.garantia.fotosTecnicas = p.garantia.fotosTecnicas || {};
          const arr = Array.isArray(p.garantia.fotosTecnicas[key])
            ? p.garantia.fotosTecnicas[key]
            : (p.garantia.fotosTecnicas[key] ? [{ url: p.garantia.fotosTecnicas[key] }] : []);
          const foto = arr.find(f => f.id === itemId);
          if (foto) { foto.url = url; delete foto.pending; delete foto.pendingId; }
          p.garantia.fotosTecnicas[key] = arr;
          await projects.update(item.projectId, { garantia: p.garantia });
          break;
        }

        case 'fotoAdicional': {
          const { itemId } = item.opArgs;
          p.garantia = p.garantia || {};
          const arr = p.garantia.fotosAdicionales || [];
          const foto = arr.find(f => f.id === itemId);
          if (foto) { foto.data = url; delete foto.pending; delete foto.pendingId; }
          p.garantia.fotosAdicionales = arr;
          await projects.update(item.projectId, { garantia: p.garantia });
          break;
        }

        case 'fotoFase': {
          const { fase, itemId } = item.opArgs;
          p.documentacion = p.documentacion || {};
          p.documentacion.fases = p.documentacion.fases || {};
          const arr = p.documentacion.fases[fase] || [];
          const foto = arr.find(f => f.id === itemId);
          if (foto) { foto.data = url; delete foto.pending; delete foto.pendingId; }
          p.documentacion.fases[fase] = arr;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'clienteFoto':
          await projects.update(item.projectId, { clienteFoto: url });
          break;

        case 'sombraFoto':
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          p.documentacion.levantamiento.sombras = p.documentacion.levantamiento.sombras || {};
          p.documentacion.levantamiento.sombras.foto = url;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;

        case 'fotoMedidor':
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          p.documentacion.levantamiento.fotoMedidor = url;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;

        case 'fotoLev': {
          const { itemId: levItemId } = item.opArgs || {};
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          const fotosLev = p.documentacion.levantamiento.fotosLevantamiento || [];
          const fLev = fotosLev.find(f => f.id === levItemId);
          if (fLev) { fLev.url = url; delete fLev.pending; delete fLev.pendingId; }
          p.documentacion.levantamiento.fotosLevantamiento = fotosLev;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'sunSeeker': {
          const { itemId } = item.opArgs || {};
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          const arr = p.documentacion.levantamiento.sunSeeker || [];
          const f = arr.find(x => x.id === itemId);
          if (f) { f.url = url; delete f.pending; delete f.pendingId; }
          p.documentacion.levantamiento.sunSeeker = arr;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'dronFoto': {
          const { fase, itemId } = item.opArgs || {};
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          const dron = p.documentacion.levantamiento.dron;
          const f = dron?.[fase]?.fotos?.find(x => x.id === itemId);
          if (f) { f.url = url; delete f.pending; delete f.pendingId; }
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'fotoCierrePaso': {
          const { blockId, slotId } = item.opArgs || {};
          p.checklistData = p.checklistData || {};
          p.checklistData.fotosCierre = p.checklistData.fotosCierre || {};
          const slot = p.checklistData.fotosCierre[blockId]?.[slotId];
          if (slot && slot.pendingId === item.id) { slot.url = url; delete slot.pending; delete slot.pendingId; }
          await projects.update(item.projectId, { checklistData: p.checklistData });
          break;
        }

        case 'fotoArea': {
          const { areaIdx, itemId } = item.opArgs || {};
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          const areasQ = p.documentacion.levantamiento.areasTecho || [];
          const fotoArea = areasQ[areaIdx]?.fotos?.find(f => f.id === itemId);
          if (fotoArea) { fotoArea.url = url; delete fotoArea.pending; delete fotoArea.pendingId; }
          p.documentacion.levantamiento.areasTecho = areasQ;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'reciboFoto': {
          p.documentacion = p.documentacion || {};
          p.documentacion.levantamiento = p.documentacion.levantamiento || {};
          const recibos = p.documentacion.levantamiento.recibos || [];
          const recibo = recibos.find(r => r.foto?.pendingId === item.id);
          if (recibo) recibo.foto = url;
          p.documentacion.levantamiento.recibos = recibos;
          await projects.update(item.projectId, { documentacion: p.documentacion });
          break;
        }

        case 'eqFoto': {
          const { eqId, campo } = item.opArgs || {};
          p.garantia = p.garantia || {};
          const eq = (p.garantia.equipos || []).find(e => e.id === eqId);
          if (eq) eq[campo] = url;
          await projects.setField(item.projectId, 'garantia.equipos', p.garantia.equipos);
          break;
        }
      }

      await dequeuePhoto(item.id);
      synced++;
    } catch (err) {
      // Si falla por offline, dejar en cola; si es otro error, contar el reintento
      if (!navigator.onLine) break;
      lastError = err.message || String(err);
      console.warn('[PhotoQueue] Error sync item:', item.id, lastError);
      const nextRetry = retryCount + 1;
      // Guardar el motivo del fallo para diagnóstico (timeout/conexión/permiso/etc.)
      await updateQueueItem(item.id, { retryCount: nextRetry, lastError, lastErrorAt: new Date().toISOString() });
      if (nextRetry >= MAX_RETRIES) stuck++;
    }
  }

  const remaining = (await getAllQueued()).length;
  // Si aún quedan pendientes, volver a registrar el tag para que el SW reintente
  if (remaining > 0) {
    navigator.serviceWorker?.ready
      .then(reg => reg.sync?.register('photo-upload'))
      .catch(() => {});
  }
  if (!silent) {
    if (synced > 0) {
      const { toast } = await import('./utils.js');
      toast(`✅ ${synced} foto${synced > 1 ? 's subidas' : ' subida'} al sincronizar`, 'success', 4000);
    }
    if (stuck > 0) {
      const { toast } = await import('./utils.js');
      toast(`⚠ ${stuck} foto${stuck > 1 ? 's' : ''} no se ${stuck > 1 ? 'pudieron' : 'pudo'} subir tras varios intentos — revisa tu conexión`, 'error', 6000);
    }
  }
  return { synced, stuck, remaining, lastError };
}

// ── Reintento manual: resetea el contador de TODOS los items (incluso los
// "atascados" con retryCount >= MAX_RETRIES, que processQueue normal salta) y
// reintenta. Esto recupera fotos que agotaron sus 6 intentos por fallos
// transitorios de señal en campo. Lo llaman el badge y el botón de Ajustes.
export async function forceRetryPhotos() {
  const { toast } = await import('./utils.js');
  if (!navigator.onLine) {
    toast('Sin conexión — conéctate para subir las fotos pendientes', 'error', 5000);
    return { synced: 0, stuck: 0, remaining: (await getAllQueued()).length };
  }
  const all = await getAllQueued();
  if (!all.length) { toast('No hay fotos pendientes', 'info', 3000); return { synced: 0, stuck: 0, remaining: 0 }; }

  for (const item of all) {
    if ((item.retryCount || 0) !== 0) await updateQueueItem(item.id, { retryCount: 0 });
  }
  toast(`Subiendo ${all.length} foto${all.length > 1 ? 's' : ''} pendiente${all.length > 1 ? 's' : ''}…`, 'info', 3000);
  // force:true — el reintento manual debe correr aunque ya haya una pasada
  // automática en curso (el usuario tocó el badge explícitamente, no debe
  // quedar en silencio por la guardia anti-solape de processQueue).
  const res = await processQueue({ silent: true, force: true });
  _updatePendingBadge();

  if (res.remaining === 0) {
    toast(`✅ ${res.synced} foto${res.synced !== 1 ? 's' : ''} subida${res.synced !== 1 ? 's' : ''}`, 'success', 4000);
  } else {
    const motivo = res.lastError === 'offline' ? 'sin conexión'
      : /timeout|excedió/i.test(res.lastError || '') ? 'la red está muy lenta'
      : (res.lastError || 'error desconocido');
    toast(`✅ ${res.synced} subida${res.synced !== 1 ? 's' : ''} · ⚠ ${res.remaining} siguen fallando (${motivo}). Súbelas desde el celular donde se tomaron.`, 'error', 8000);
  }
  return res;
}
window.forceRetryPhotos = forceRetryPhotos;
