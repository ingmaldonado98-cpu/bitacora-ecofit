// db.js — Capa de datos · redirige a Firebase/Firestore
// Mantiene la misma API que antes para compatibilidad con todos los módulos

import { fbProjects, fbUsers, fbConfig, fbKV, exportFbBackup } from './firebase.js';

// ── Re-exportar stores con la misma interfaz ───────────────────────────────
export const projects  = fbProjects;
export const users     = fbUsers;
export const config    = fbConfig;
export const kv        = fbKV;
export const inventario = fbKV; // inventario usa el mismo kv store con prefijo

// ── Backup ─────────────────────────────────────────────────────────────────
export async function exportBackup()       { return exportFbBackup(); }

export async function importBackup(data) {
  if (!data?.version) throw new Error('Formato de backup inválido');

  for (const p of (data.projects || [])) {
    await fbProjects.add(p);
  }

  for (const u of (data.users || [])) {
    if (u.id) await fbUsers.add(u).catch(() => {});
  }

  for (const [k, v] of Object.entries(data.config || {})) {
    await fbConfig.set(k, v);
  }

  for (const [k, v] of Object.entries(data.kv || {})) {
    await fbKV.set(k, v);
  }
}

// ── seedIfEmpty — manejado por firebase.js ─────────────────────────────────
export { seedAdminIfEmpty as seedIfEmpty } from './firebase.js';

// ── openDB — ya no se usa, mantenido por compatibilidad ───────────────────
export function openDB() { return Promise.resolve(null); }
