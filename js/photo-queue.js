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

const DB_NAME  = 'ecofit-photo-queue';
const DB_VER   = 1;
const STORE    = 'queue';

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
  const db = await _openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
  delete window._pendingPhotoMap[id];
  _updatePendingBadge();
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
function _updatePendingBadge() {
  const count = Object.keys(window._pendingPhotoMap).length;
  let badge = document.getElementById('pending-photos-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'pending-photos-badge';
    badge.className = 'pending-photos-badge';
    badge.title = 'Fotos pendientes de subir';
    badge.onclick = async () => {
      const { toast } = await import('./utils.js');
      if (!navigator.onLine) {
        toast('Sin conexión — se reintentará automáticamente al reconectar', 'error', 4000);
        return;
      }
      const before = Object.keys(window._pendingPhotoMap).length;
      await processQueue();
      if (Object.keys(window._pendingPhotoMap).length === before) {
        toast('No se pudo sincronizar todavía — revisa tu conexión e intenta de nuevo', 'error', 4000);
      }
    };
    document.body.appendChild(badge);
  }
  if (count > 0) {
    badge.textContent = `⬆ ${count} pendiente${count > 1 ? 's' : ''} — toca para reintentar`;
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

export async function processQueue() {
  if (!navigator.onLine) return;
  const items = await getAllQueued();
  if (!items.length) return;

  const { uploadPhoto } = await import('./firebase.js');
  const { projects }    = await import('./db.js');

  let synced = 0;
  let stuck  = 0;
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
      console.warn('[PhotoQueue] Error sync item:', item.id, err.message);
      const nextRetry = retryCount + 1;
      await updateQueueItem(item.id, { retryCount: nextRetry });
      if (nextRetry >= MAX_RETRIES) stuck++;
    }
  }

  if (synced > 0) {
    const { toast } = await import('./utils.js');
    toast(`✅ ${synced} foto${synced > 1 ? 's subidas' : ' subida'} al sincronizar`, 'success', 4000);
  }
  if (stuck > 0) {
    const { toast } = await import('./utils.js');
    toast(`⚠ ${stuck} foto${stuck > 1 ? 's' : ''} no se ${stuck > 1 ? 'pudieron' : 'pudo'} subir tras varios intentos — revisa tu conexión`, 'error', 6000);
  }
}
