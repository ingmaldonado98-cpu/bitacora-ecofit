// settings-backup.js — OneDrive, exportar/importar backup y borrado local
// Extraído de settings.js — registra los handlers window.* de respaldo de datos.

import { exportBackup, importBackup } from './db.js';
import { toast, confirmDialog } from './utils.js';
import { pickFolder, requestPermission, testAccess } from './onedrive.js';

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
  if (!await confirmDialog('¿Importar backup? Se reemplazarán todos los proyectos actuales.')) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importBackup(data);
    toast('✅ Datos importados');
    navigate('#dashboard');
  } catch(err) { toast('Error al importar: ' + err.message, 'error'); }
};

window.limpiarDatos = async function() {
  if (!await confirmDialog('¿ELIMINAR TODOS los datos locales? Esta acción es IRREVERSIBLE.')) return;
  if (!await confirmDialog('Segunda confirmación: ¿Seguro? Perderás todos los proyectos.')) return;
  indexedDB.deleteDatabase('ecofitV6');
  sessionStorage.clear();
  toast('Datos eliminados. Recargando…');
  setTimeout(() => location.reload(), 1500);
};
