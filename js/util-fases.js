// util-fases.js — Lógica de desbloqueo/estado de fases (Doc/Gar/Aud) y firmas
// Extraído de utils.js. Autocontenido — sin dependencias de DOM ni de otros util-*.js.

// ── firmaModificada — ¿hubo cambios en el módulo después de firmarlo? ─────────
// Revisa el changeLog: cualquier entrada del módulo posterior a la firma
// (que no sea la firma misma) invalida la certeza de lo firmado.
export function firmaModificada(project, fase) {
  const firma = project.fases?.firmas?.[fase];
  if (!firma?.firmado_en) return false;
  const prefijos = {
    doc: ['documentación', 'levantamiento'],
    gar: ['garantía'],
    aud: ['auditoría'],
  }[fase] || [];
  return (project.changeLog || []).some(e =>
    e.ts > firma.firmado_en &&
    e.accion !== 'firmada' && e.accion !== 'firma retirada' &&
    prefijos.some(pre => (e.modulo || '').toLowerCase().startsWith(pre))
  );
}

// Normaliza fotosTecnicas[key]: soporta string legacy, array nuevo, o vacío
export function getFotosTecnicas(ft, key) {
  const v = (ft || {})[key];
  if (!v) return [];
  if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
  return Array.isArray(v) ? v : [];
}

// ── Conteo de fotos por sitio/subfase (soporta esquema nuevo y legacy) ─────────
// fases: project.documentacion?.fases · sitio: 'techo' | 'centrosCarga' | 'zonaDelSistema'
// sub:   'antes' | 'durante' | 'cierre'
export function countFotos(fases, sitio, sub) {
  const n = fases?.[sitio]?.[sub]?.length || 0;
  if (n > 0) return n;
  if (sitio === 'techo') {
    const m = { antes: 'antes', durante: 'durante', cierre: 'despues' };
    return fases?.[m[sub]]?.length || 0;
  }
  return 0;
}

// ── calcFaseEstado — lógica de desbloqueo por fase ────────────────────────────
// Retorna { doc, gar, aud } con 'disponible' | 'bloqueada' | 'completa'
// + porcentajes docPct, garPct, audPct para dashboard y detalle de proyecto.
export function calcFaseEstado(project) {
  const doc = project.documentacion || {};
  const gar = project.garantia      || {};
  const aud = project.auditoria     || {};
  const esPequeno = project.tipoSistema === 'sistema_pequeno';

  // ── Documentación ────────────────────────────────────────────────────────────
  const fTecho   = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(doc.fases,'techo',f), 0);
  const fCentros = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(doc.fases,'centrosCarga',f), 0);
  const fZona    = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(doc.fases,'zonaDelSistema',f), 0);

  // Sistema pequeño solo necesita levantamiento; no requiere juego completo de fotos
  const docItemsL = esPequeno
    ? [ ['Levantamiento', !!(doc.levantamiento?.tipTecho)] ]
    : [ ['Levantamiento',              !!(doc.levantamiento?.tipTecho)],
        ['fotos de Techo',             fTecho > 0],
        ['fotos de Centros de carga',  fCentros > 0],
        ['fotos de Zona del inversor', fZona > 0] ];
  const docItems = docItemsL.map(([,ok]) => ok);
  const docFaltantes = docItemsL.filter(([,ok]) => !ok).map(([l]) => l);
  const docItemsOk = docItems.filter(Boolean).length;
  const docCompleta = docItemsOk >= 1;
  const docPct      = Math.round(docItemsOk / docItems.length * 100);
  const docFirmada  = !!(project.fases?.firmas?.doc);

  // ── Garantía ─────────────────────────────────────────────────────────────────
  const garDesbloqueada = docCompleta;
  const totalPaneles = (gar.paneles?.strings||[]).reduce((s,st) => s + (st.paneles?.length||0), 0);

  // Sistema pequeño no tiene tablero AC / inversor de red
  const garItemsL = esPequeno
    ? [
        ['foto general del sistema', !!gar.fotoSistema],
        ['equipos registrados',      (gar.equipos?.length||0) > 0],
        ['seriales de paneles',      totalPaneles > 0],
      ]
    : [
        ['foto general del sistema', !!gar.fotoSistema],
        ['foto técnica (tablero AC o inversor)', !!(gar.fotosTecnicas?.tableroAC || gar.fotosTecnicas?.inversorEnergizado)],
        ['equipos registrados',      (gar.equipos?.length||0) > 0],
        ['seriales de paneles',      totalPaneles > 0],
      ];
  const garItems = garItemsL.map(([,ok]) => ok);
  const garFaltantes = garItemsL.filter(([,ok]) => !ok).map(([l]) => l);
  const garItemsOk  = garItems.filter(Boolean).length;
  const garCompleta = garItemsOk >= (esPequeno ? 2 : 2);
  const garPct      = Math.round(garItemsOk / garItems.length * 100);
  const garFirmada  = !!(project.fases?.firmas?.gar);

  // ── Auditoría ─────────────────────────────────────────────────────────────────
  // Sistema pequeño no tiene auditoría formal
  const audDesbloqueada = !esPequeno && garDesbloqueada && garItemsOk >= 2;
  const audItems = [
    (aud.checklist?.length||0) >= 11,
    !!aud.resultado,
  ];
  const audItemsOk  = audItems.filter(Boolean).length;
  const audCompleta = audItemsOk >= 2;
  const audPct      = esPequeno ? null : Math.round(audItemsOk / audItems.length * 100);

  return {
    doc: 'disponible',
    gar: garDesbloqueada ? (garCompleta ? 'completa' : 'disponible') : 'bloqueada',
    aud: audDesbloqueada ? (audCompleta ? 'completa' : 'disponible') : 'bloqueada',
    docFirmada, garFirmada,
    docPct, garPct, audPct,
    docFaltantes, garFaltantes,
    garRequisito: 'Completa el Levantamiento primero.',
    audRequisito: 'Completa Garantía primero (foto del sistema + al menos un equipo o foto técnica).',
  };
}
