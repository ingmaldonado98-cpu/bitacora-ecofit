// util-fases.js — Lógica de desbloqueo/estado de fases (Doc/Gar/Aud) y firmas
// Extraído de utils.js. Sin dependencias de DOM ni de otros util-*.js.
// Importa SOLO de modules/checklist/index.js (módulo hoja, sin imports propios
// → no hay riesgo de dependencia circular vía utils.js).

import { getExecBlocks, BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';

// ── calcObraStatus — avance real de "Progreso de obra" por Bloque 1/2/3 ────────
// Fuente de verdad nueva: checklistData.exec (ítems marcados) + checklistData.
// fotosCierre (evidencias obligatorias). Reemplaza el esquema viejo de fotos por
// sitio (documentacion.fases.techo/centrosCarga/zonaDelSistema), cuya UI de
// captura ya no existe — por eso el viejo docPct quedaba clavado en 0.
// Réplica local de la lógica de _pasoCompleto/computeBloqueStatus de doc-exec.js
// (no se importa de ahí para no crear un ciclo doc-exec → utils → util-fases).
export function calcObraStatus(project) {
  const cl    = project.checklistData || {};
  const techo = project.projectConfig?.techo || cl.techo || 'cemento';
  let blocks = [];
  try { blocks = getExecBlocks(project, techo) || []; } catch { blocks = []; }

  const slotOk = (bid, sid) => {
    const d = cl.fotosCierre?.[bid]?.[sid];
    return !!(d && (d.url || d.pending || d.justificacion));
  };
  const pasoCompleto = b => {
    const done = b.items.filter(it => cl.exec?.[it.id]).length;
    if (done !== b.items.length || b.items.length === 0) return false;
    return (b.fotosCierre || []).filter(s => s.obligatoria).every(s => slotOk(b.id, s.id));
  };

  const bloques = [1, 2, 3].map(n => {
    const bs    = blocks.filter(x => x.bloque === n);
    const total = bs.reduce((s, x) => s + x.items.length, 0);
    const done  = bs.reduce((s, x) => s + x.items.filter(it => cl.exec?.[it.id]).length, 0);
    return {
      bloque: n,
      label: BLOQUE_LABELS?.[n] || `Bloque ${n}`,
      desc:  BLOQUE_DESC?.[n] || '',
      done, total,
      completo: bs.length > 0 && bs.every(pasoCompleto),
    };
  });
  const conItems  = bloques.filter(b => b.total > 0);
  const completos = conItems.filter(b => b.completo).length;
  const pct = conItems.length ? Math.round(completos / conItems.length * 100) : 0;
  return { bloques, completos, total: conItems.length, pct };
}

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
  const esPequeno    = project.tipoSistema === 'sistema_pequeno';
  const esAmpliacion = project.tipoSistema === 'ampliacion';

  // ── Documentación / Progreso de obra ─────────────────────────────────────────
  // Levantamiento (gate de desbloqueo de Garantía) — sistema pequeño solo necesita esto.
  const lev      = doc.levantamiento || {};
  const levHecho = !!(lev.tipTecho || lev.areasTecho?.length);

  // "Progreso de obra" (fase 'doc') ahora se mide por Bloque 1/2/3 — checklist
  // de ejecución + evidencias de cierre — NO por las fotos por sitio viejas (UI
  // eliminada). Para sistema pequeño no hay Progreso de obra (módulo oculto).
  const obra = esPequeno ? null : calcObraStatus(project);
  const docPct = esPequeno
    ? (levHecho ? 100 : 0)
    : (obra.total ? obra.pct : 0);
  const docFaltantes = esPequeno
    ? (levHecho ? [] : ['Levantamiento'])
    : [
        ...(levHecho ? [] : ['Levantamiento']),
        ...obra.bloques.filter(b => b.total > 0 && !b.completo).map(b => `${b.label} incompleto`),
      ];
  const docFirmada  = !!(project.fases?.firmas?.doc);

  // ── Garantía ─────────────────────────────────────────────────────────────────
  // Garantía se desbloquea al terminar el Levantamiento (NO al terminar la obra)
  // — preserva el toast "Completa el Levantamiento primero" del router.
  const garDesbloqueada = levHecho;
  // Lectura en línea (no se importa gar-paneles.js — este archivo es autocontenido):
  // seriales planos, con fallback a strings viejos para proyectos no migrados.
  const totalPaneles = (gar.paneles?.seriales ?? (gar.paneles?.strings||[]).flatMap(s=>s.paneles||[])).length;

  // Sistema pequeño no tiene tablero AC / inversor de red
  const garItemsL = esAmpliacion
    ? [
        ['seriales de paneles del string nuevo', totalPaneles > 0],
      ]
    : esPequeno
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
  const garCompleta = garItemsOk >= (esAmpliacion ? 1 : 2);
  const garPct      = Math.round(garItemsOk / garItems.length * 100);
  const garFirmada  = !!(project.fases?.firmas?.gar);

  // ── Auditoría ─────────────────────────────────────────────────────────────────
  // Sistema pequeño no tiene auditoría formal
  const audDesbloqueada = !esPequeno && !esAmpliacion && garDesbloqueada && garItemsOk >= 2;
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

// ── calcLevItems / calcLevPct — progreso del Levantamiento ────────────────────
// Antes solo revisaba tipTecho/areasTecho (casi redundantes entre sí). Ahora
// suma datos del inmueble y fotos del levantamiento siempre, más un hito
// adicional según tipo de sistema — mismos campos que ya usa calcFaseEstado
// para sus extraItems, para no inventar criterios nuevos de "completo".
export function calcLevItems(doc, tipoSistema) {
  const lev = doc?.levantamiento || {};
  const levAreas = lev.areasTecho?.length || 0;
  if (tipoSistema === 'ampliacion') {
    return [
      { label: `Área(s) de techo nueva (${levAreas})`, ok: levAreas > 0 },
      { label: 'Fotos del levantamiento',              ok: (lev.fotosLevantamiento?.length || 0) > 0 },
    ];
  }
  const items = [
    { label: 'Tipo de techo',           ok: !!lev.tipTecho },
    { label: `Áreas (${levAreas})`,     ok: levAreas > 0 },
    { label: 'Datos del inmueble',      ok: !!lev.estadoInmueble },
    { label: 'Fotos del levantamiento', ok: (lev.fotosLevantamiento?.length || 0) > 0 },
  ];
  if (!['sistema_pequeno', 'aislado', 'bombeo'].includes(tipoSistema)) {
    items.push({ label: 'Datos eléctricos (servicio CFE)', ok: !!lev.tipoServicioCFE });
  } else if (tipoSistema === 'aislado') {
    items.push({ label: 'Autonomía y cargas', ok: !!(lev.autonomia && (lev.cargasCriticas?.length || 0) > 0) });
  } else if (tipoSistema === 'bombeo') {
    items.push({ label: 'Datos de bombeo', ok: !!(lev.tipoBomba && lev.caudal && lev.profundidadPozo) });
  }
  return items;
}

export function calcLevPct(doc, tipoSistema) {
  const items = calcLevItems(doc, tipoSistema);
  return Math.round(items.filter(i => i.ok).length / items.length * 100);
}
