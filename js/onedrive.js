// onedrive.js — Respaldo documental en OneDrive vía File System Access API
// No requiere API keys. El usuario selecciona la carpeta OneDrive una vez;
// el handle se persiste en IndexedDB y OneDrive sincroniza automáticamente.

import { kv } from './db.js';

const KV_KEY = 'onedrive_folder_handle';

// ── Guardar / recuperar handle ─────────────────────────────────────────────────
export async function getFolderHandle() {
  return kv.get(KV_KEY);
}

async function saveFolderHandle(handle) {
  await kv.set(KV_KEY, handle);
}

// ── Estado del handle almacenado ───────────────────────────────────────────────
export async function getStatus() {
  const handle = await getFolderHandle();
  if (!handle) return { ok: false, msg: 'Sin carpeta configurada' };

  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      return { ok: true, msg: `✅ Carpeta: ${handle.name}` };
    }
    return { ok: false, msg: `⚠ Carpeta guardada (${handle.name}) — requiere permisos`, needsGrant: true, handle };
  } catch {
    return { ok: false, msg: 'Carpeta no disponible — selecciona de nuevo' };
  }
}

// ── Seleccionar carpeta ────────────────────────────────────────────────────────
export async function pickFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error('Tu navegador no soporta File System Access API. Usa Chrome o Edge.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'desktop' });
  await saveFolderHandle(handle);
  return handle;
}

// ── Solicitar permisos si caducaron ───────────────────────────────────────────
export async function requestPermission() {
  const handle = await getFolderHandle();
  if (!handle) throw new Error('Sin carpeta configurada. Selecciona una primero.');
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new Error('Permiso denegado.');
  return handle;
}

// ── Guardar archivo en OneDrive ────────────────────────────────────────────────
export async function saveFile(filename, content, mimeType = 'application/octet-stream') {
  let handle = await getFolderHandle();
  if (!handle) throw new Error('Selecciona una carpeta de OneDrive en Ajustes primero.');

  // Verificar / solicitar permisos
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const newPerm = await handle.requestPermission({ mode: 'readwrite' });
    if (newPerm !== 'granted') throw new Error('Permiso denegado para escribir en OneDrive.');
  }

  // Crear subcarpeta del mes automáticamente
  const mes = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit' }).replace('/', '-');
  let folder = handle;
  try {
    folder = await handle.getDirectoryHandle(mes, { create: true });
  } catch { /* usar carpeta raíz si falla */ }

  const fileHandle = await folder.getFileHandle(filename, { create: true });
  const writable   = await fileHandle.createWritable();
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  await writable.write(blob);
  await writable.close();

  return `${handle.name}/${mes}/${filename}`;
}

// ── Probar acceso escribiendo un archivo de prueba ─────────────────────────────
export async function testAccess() {
  const path = await saveFile(
    '_ecofit_test.txt',
    `Prueba de acceso OneDrive — Ecofit Solar Solutions\n${new Date().toISOString()}`,
    'text/plain'
  );
  return path;
}
