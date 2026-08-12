// onedrive.js — Respaldo documental en OneDrive vía File System Access API
// No requiere API keys. El usuario selecciona la carpeta OneDrive una vez;
// el handle se persiste en IndexedDB (structured clone) y OneDrive sincroniza.
//
// ⚠ FileSystemDirectoryHandle NO es serializable a JSON/Firestore.
//   Solo IndexedDB lo puede almacenar correctamente via structured clone.

const IDB_NAME  = 'ecofit-od';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'folder';

// ── IndexedDB local para handles ───────────────────────────────────────────────
function _openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

// ── Guardar / recuperar handle ────────────────────────────────────────────────
export async function getFolderHandle() {
  const db = await _openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readonly')
                  .objectStore(IDB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = e => rej(e.target.error);
  });
}

async function saveFolderHandle(handle) {
  const db = await _openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readwrite')
                  .objectStore(IDB_STORE).put(handle, HANDLE_KEY);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ── Estado del handle almacenado ──────────────────────────────────────────────
export async function getStatus() {
  const handle = await getFolderHandle();
  if (!handle) return { ok: false, msg: 'Sin carpeta configurada' };

  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      return { ok: false, msg: `⚠ Carpeta guardada (${handle.name}) — requiere permisos`, needsGrant: true, handle };
    }
    // El permiso concedido no garantiza que la carpeta siga existiendo en
    // disco (OneDrive con sincronización selectiva, carpeta movida/borrada)
    // — antes esto mostraba "✅ Carpeta: X" con solo confirmar el permiso,
    // dejando un estado verde falso junto a un guardado que en realidad
    // fallaría. Confirmamos con una operación real sobre la carpeta.
    for await (const _ of handle.values()) break;
    return { ok: true, msg: `✅ Carpeta: ${handle.name}` };
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return { ok: false, msg: `⚠ La carpeta "${handle.name}" ya no existe en el disco (¿se movió o eliminó?) — selecciona de nuevo` };
    }
    return { ok: false, msg: 'Carpeta no disponible — selecciona de nuevo' };
  }
}

// ── Seleccionar carpeta ───────────────────────────────────────────────────────
export async function pickFolder() {
  if (!window.showDirectoryPicker) {
    // File System Access API solo existe en navegadores de escritorio
    // (Chrome/Edge en PC/Mac) — en Android/iPhone el mensaje "usa Chrome o
    // Edge" era engañoso porque el técnico ya está usando Chrome, solo que
    // desde el celular, donde la función simplemente no existe.
    const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const msg = esMovil
      ? 'Esta función solo está disponible en computadora (Chrome o Edge de escritorio) — en celular no existe. Usa "Exportar backup" para guardar manualmente.'
      : 'Tu navegador no soporta File System Access API. Usa Chrome o Edge.';
    throw new Error(msg);
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'desktop' });
  await saveFolderHandle(handle);
  return handle;
}

// ── Solicitar permisos si caducaron ──────────────────────────────────────────
export async function requestPermission() {
  const handle = await getFolderHandle();
  if (!handle) throw new Error('Sin carpeta configurada. Selecciona una primero.');
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new Error('Permiso denegado.');
  return handle;
}

// ── Guardar archivo en OneDrive ───────────────────────────────────────────────
export async function saveFile(filename, content, mimeType = 'application/octet-stream') {
  let handle = await getFolderHandle();
  if (!handle) throw new Error('Selecciona una carpeta de OneDrive en Ajustes primero.');

  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const newPerm = await handle.requestPermission({ mode: 'readwrite' });
    if (newPerm !== 'granted') throw new Error('Permiso denegado para escribir en OneDrive.');
  }

  // Subcarpeta del mes automáticamente (YYYY-MM)
  const mes = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit' }).replace('/', '-');
  let folder = handle;
  try { folder = await handle.getDirectoryHandle(mes, { create: true }); } catch { /* usar raíz */ }

  // Sin este catch, una carpeta movida/borrada/reorganizada por la
  // sincronización de OneDrive (fuera del control de la app) producía un
  // NotFoundError crudo del navegador — sin decir qué pasó ni cómo
  // arreglarlo (volver a seleccionar la carpeta en Ajustes).
  let fileHandle;
  try {
    fileHandle = await folder.getFileHandle(filename, { create: true });
  } catch (err) {
    if (err.name === 'NotFoundError') {
      throw new Error(`La carpeta de OneDrive ya no existe en el disco (¿se movió o eliminó?) — vuelve a seleccionarla en Ajustes.`);
    }
    throw err;
  }
  const writable   = await fileHandle.createWritable();
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  await writable.write(blob);
  await writable.close();

  return `${handle.name}/${mes}/${filename}`;
}

// ── Probar acceso ─────────────────────────────────────────────────────────────
export async function testAccess() {
  return saveFile(
    '_ecofit_test.txt',
    `Prueba de acceso OneDrive — Ecofit Solar Solutions\n${new Date().toISOString()}`,
    'text/plain'
  );
}
