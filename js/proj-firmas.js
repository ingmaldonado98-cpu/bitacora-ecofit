// proj-firmas.js — Firma de fases (Doc/Gar/Aud): firmar, retirar, bloque HTML
// Extraído de project.js. Exporta firmarFase, quitarFirma, renderFirmaBlock.

import { projects, logChange } from './db.js';
import { confirmDialog, isoNow, toast, fmtFechaHora, firmaModificada } from './utils.js';
import { isAdmin, isLider, getSession } from './auth.js';
import { icon } from './icons.js';

const FASE_NOMBRES = { doc: 'Documentación', gar: 'Garantía', aud: 'Auditoría' };

// ── Firmar fase ───────────────────────────────────────────────────────────────
export async function firmarFase(projectId, fase) {
  const session = await getSession();
  if (!session) { toast('Sesión no encontrada', 'error'); return; }
  if (!(isAdmin(session) || isLider(session))) {
    toast('Solo líderes o administradores pueden firmar', 'error');
    return;
  }
  const faseNombre = FASE_NOMBRES[fase] || fase;
  const quien = session.nombre || session.email;
  if (!await confirmDialog(
    `¿Firmar ${faseNombre} como ${quien}?\n\nLa firma certifica que la información de esta fase está completa y correcta. Quedará registrada con fecha y hora.`
  )) return;

  const firma = {
    firmado_por: session.id,
    nombre:      quien,
    firmado_en:  isoNow(),
  };
  await projects.setField(projectId, `fases.firmas.${fase}`, firma);
  logChange(projectId, { modulo: faseNombre, accion: 'firmada', detalle: '', quien: session });
  toast(`✅ Fase firmada por ${quien}`);
  navigate(`#proyecto/${projectId}`);
}
window._firmarFase = firmarFase;

// ── Quitar firma (solo admin) ─────────────────────────────────────────────────
export async function quitarFirma(projectId, fase) {
  const session = await getSession();
  if (!isAdmin(session)) { toast('Solo un administrador puede retirar firmas', 'error'); return; }
  const faseNombre = FASE_NOMBRES[fase] || fase;
  const p = await projects.getById(projectId);
  const firma = p?.fases?.firmas?.[fase];
  if (!firma) { toast('Esta fase no está firmada', 'error'); return; }
  if (!await confirmDialog(
    `¿Retirar la firma de ${faseNombre}?\n\nFirmada por ${firma.nombre || firma.firmado_por}. La acción quedará registrada en el historial.`
  )) return;

  await projects.setField(projectId, `fases.firmas.${fase}`, null);
  logChange(projectId, {
    modulo: faseNombre, accion: 'firma retirada',
    detalle: `firma previa de ${firma.nombre || firma.firmado_por}`, quien: session,
  });
  toast('Firma retirada');
  navigate(window.location.hash || `#proyecto/${projectId}`);
}
window._quitarFirma = quitarFirma;

// ── Bloque HTML de firma (compartido entre Doc / Gar / Aud) ──────────────────
export function renderFirmaBlock(project, projectId, fase, session, { ready = true, hint = '' } = {}) {
  if (!(isAdmin(session) || isLider(session))) return '';
  const admin = isAdmin(session);
  const nombreFase = FASE_NOMBRES[fase] || fase;
  const firma = project.fases?.firmas?.[fase];

  if (firma) {
    const mod = firmaModificada(project, fase);
    return `
  <div class="fase-firma-wrap">
    <div class="fase-firma-ok">
      ${icon('seal-check', 16)} ${nombreFase} firmada por <b>${firma.nombre || firma.firmado_por}</b>
      <span class="fase-firma-fecha">${fmtFechaHora(firma.firmado_en)}</span>
    </div>
    ${mod ? `<p class="fase-firma-warn">${icon('warning', 13)} Hubo cambios después de la firma — revisa y vuelve a firmar.</p>` : ''}
    ${admin ? `<button class="btn-outline btn-sm fase-firma-quitar"
        onclick="window._quitarFirma('${projectId}','${fase}')">
      Retirar firma</button>` : ''}
  </div>`;
  }

  if (ready) {
    return `
  <div class="fase-firma-wrap">
    <button class="btn-firma-fase" onclick="window._firmarFase('${projectId}','${fase}')">
      ${icon('signature', 16)} Firmar ${nombreFase}
    </button>
  </div>`;
  }

  return `
  <div class="fase-firma-wrap">
    <button class="btn-firma-fase" disabled style="opacity:.45;cursor:not-allowed">
      ${icon('lock', 16)} Firmar ${nombreFase}
    </button>
    <p class="fase-firma-hint">${icon('info', 13)} ${hint}</p>
    ${admin ? `<button class="btn-outline btn-sm aud-override-btn"
        onclick="window._firmarFase('${projectId}','${fase}')">
      ${icon('warning', 13)} Admin: firmar de todas formas
    </button>` : ''}
  </div>`;
}
