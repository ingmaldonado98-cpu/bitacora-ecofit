// settings-backup.js — OneDrive, exportar/importar backup y borrado local
// Extraído de settings.js — registra los handlers window.* de respaldo de datos.

import { exportBackup, importBackup, summarizeBackup } from './db.js';
import { toast, confirmDialog } from './utils.js';
import { pickFolder, requestPermission, testAccess } from './onedrive.js';
import { getPlugin } from './platform.js';
import { BACKUP_VERSION } from './firebase.js';

// ── OneDrive ───────────────────────────────────────────────────────────────────
window.seleccionarCarpetaOneDrive = async function() {
  try {
    const handle = await pickFolder();
    toast(`✅ Carpeta seleccionada: ${handle.name}`);
    document.getElementById('onedrive-status').innerHTML =
      `<span class="onedrive-ok">✅ Carpeta: ${handle.name}</span>`;
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Error al seleccionar carpeta: ' + err.message, 'error');
    }
  }
};

window.probarOneDrive = async function() {
  try {
    const path = await testAccess();
    toast(`✅ Acceso confirmado — archivo guardado en: ${path}`);
  } catch (err) {
    if (err.message.includes('permiso') || err.message.includes('Permiso')) {
      try {
        await requestPermission();
        const path = await testAccess();
        toast(`✅ Acceso confirmado — archivo guardado en: ${path}`);
      } catch (e) {
        toast('Error: ' + e.message, 'error');
      }
    } else {
      toast('Error: ' + err.message, 'error');
    }
  }
};

window.exportarDatos = async function() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ecofit-bitacora-v6-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.importarDatos = async function(e) {
  const file = e.target.files[0]; if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    toast('El archivo no es un backup JSON válido: ' + err.message, 'error');
    e.target.value = '';
    return;
  }

  // El dialogo antes solo decia "se reemplazaran los proyectos actuales" —
  // el import toca usuarios, configuracion e inventario/catalogo por igual,
  // sobrescribiendo cualquier cambio hecho DESPUES de la fecha del backup
  // (ej. un cambio de rol o desactivacion de usuario se revertiria en
  // silencio). Mostramos el conteo real y avisamos si la version no
  // coincide con la actual, en vez de asumir que siempre es compatible.
  const r = summarizeBackup(data);
  const fecha = r.exportedAt ? new Date(r.exportedAt).toLocaleString('es-MX') : 'desconocida';
  const avisoVersion = r.version !== BACKUP_VERSION
    ? `\n\n⚠️ Este backup es de la versión ${r.version ?? '?'} — la app espera la versión ${BACKUP_VERSION}. Podría no ser totalmente compatible.`
    : '';
  const ok = await confirmDialog(
    `Este backup (del ${fecha}) contiene:\n` +
    `• ${r.proyectos} proyecto(s)\n` +
    `• ${r.usuarios} usuario(s)\n` +
    `• ${r.config} valor(es) de configuración\n` +
    `• ${r.kv} entrada(s) de inventario/catálogo\n\n` +
    `Todo esto SOBREESCRIBIRÁ los datos actuales con el mismo ID — incluyendo cambios hechos ` +
    `después de esta fecha (roles de usuario, stock, etc.).${avisoVersion}\n\n¿Importar de todas formas?`
  );
  if (!ok) { e.target.value = ''; return; }

  try {
    await importBackup(data);
    toast('✅ Datos importados');
    navigate('#dashboard');
  } catch(err) { toast('Error al importar: ' + err.message, 'error'); }
};

window.limpiarDatos = async function() {
  if (!await confirmDialog('¿ELIMINAR TODOS los datos locales? Esta acción es IRREVERSIBLE.')) return;
  if (!await confirmDialog('Segunda confirmación: ¿Seguro? Perderás todos los proyectos.')) return;

  // Borrado completo: antes solo tocaba la IndexedDB principal y dejaba vivos
  // el caché de proyectos (localStorage en web / Filesystem en nativo), la
  // cola de fotos pendientes (IndexedDB separada) y la cola de sincronización
  // (localStorage) — el usuario veía "eliminado" pero datos viejos reaparecían.
  await new Promise(res => {
    const req = indexedDB.deleteDatabase('ecofitV6');
    req.onsuccess = req.onerror = req.onblocked = res;
  });
  await new Promise(res => {
    const req = indexedDB.deleteDatabase('ecofit-photo-queue');
    req.onsuccess = req.onerror = req.onblocked = res;
  });

  const FS = getPlugin('Filesystem');
  if (FS) {
    try { await FS.rmdir({ path: 'ecofit', directory: 'DATA', recursive: true }); } catch (_) { /* directorio pudo no existir */ }
  }

  localStorage.clear();
  sessionStorage.clear();
  toast('Datos eliminados. Recargando…');
  setTimeout(() => location.reload(), 1500);
};
