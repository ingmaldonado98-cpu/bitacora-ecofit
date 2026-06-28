// db.js — Capa de datos · redirige a Firebase/Firestore
// Mantiene la misma API que antes para compatibilidad con todos los módulos

import { fbProjects, fbUsers, fbConfig, fbKV, fbReminders, fbPublicCards, exportFbBackup } from './firebase.js';

// ── Re-exportar stores con la misma interfaz ───────────────────────────────
export const projects  = fbProjects;
export const users     = fbUsers;
export const config    = fbConfig;
export const kv        = fbKV;
export const inventario  = fbKV; // inventario usa el mismo kv store con prefijo
export const reminders   = fbReminders;
export const publicCards = fbPublicCards;

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

// ── Change log — registro ligero de quién guardó qué ──────────────────────
// Mantiene las últimas MAX_LOG entradas en project.changeLog
const MAX_LOG = 50;

/**
 * logChange(projectId, { modulo, accion, detalle, quien })
 * modulo: 'Levantamiento' | 'Garantía-Equipos' | 'Auditoría' | etc.
 * accion: 'guardado' | 'firmado' | 'eliminado' | etc.
 * detalle: string descriptivo (ej: 'Inversor SMA SB3.0 editado')
 * quien: { uid, nombre } — del resultado de getSession()
 */
export async function logChange(projectId, { modulo, accion, detalle, quien }) {
  try {
    const p = await fbProjects.getById(projectId);
    if (!p) return;
    const entry = {
      ts:      new Date().toISOString(),
      modulo:  modulo || '—',
      accion:  accion || 'guardado',
      detalle: detalle || '',
      uid:     quien?.uid || '',
      nombre:  quien?.nombre || quien?.email || '—',
    };
    const log = Array.isArray(p.changeLog) ? p.changeLog : [];
    const newLog = [entry, ...log].slice(0, MAX_LOG); // más recientes primero
    await fbProjects.setField(projectId, 'changeLog', newLog);
  } catch {
    // logChange nunca debe bloquear la operación principal
  }
}

// ── openDB — ya no se usa, mantenido por compatibilidad ───────────────────
export function openDB() { return Promise.resolve(null); }
