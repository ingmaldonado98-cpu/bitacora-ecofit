// pdf-avance.js — Reporte de avance de obra (.docx real — OOXML), generable en cualquier momento.
// No bloquea por incompletitud: siempre genera con el estado real de cada bloque
// (100%, parcial con lista de pendientes, o sin iniciar).

import { projects } from './db.js';
import { fmtFecha, toast, fotoToImageBuffer } from './utils.js';
import { getExecBlocks, BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';
import { computeBloqueStatus, SITIO_BLOQUE_PRIMARIA } from './doc-exec.js';
import { newDoc, heading1, heading2, p, hr, imageBlock, saveDocx,
         Paragraph, TextRun, AlignmentType } from './word-helpers.js';

const VERDE = '16a34a';
const SITIO_LABEL = { techo: 'Techo', centrosCarga: 'Centros de carga', zonaDelSistema: 'Zona del sistema' };

function _fotosDeSitio(project, sitio) {
  const fases = project.documentacion?.fases || {};
  const subs  = ['antes', 'durante', 'cierre'];
  return subs.flatMap(sub => {
    if (fases?.[sitio]?.[sub]?.length) return fases[sitio][sub];
    if (sitio === 'techo') {
      const m = { antes: 'antes', durante: 'durante', cierre: 'despues' };
      return fases?.[m[sub]] || [];
    }
    return [];
  });
}

export async function exportarAvanceObra(projectId) {
  const project = await projects.getById(projectId);
  if (!project) { toast('Proyecto no encontrado', 'error'); return; }

  const cl    = project.checklistData || {};
  const techo = project.projectConfig?.techo || cl.techo || 'cemento';
  const allExecBlocks = getExecBlocks(project, techo);
  const bloqueStatus   = computeBloqueStatus(allExecBlocks, cl);

  const _SITIOS_POR_BLOQUE = Object.entries(SITIO_BLOQUE_PRIMARIA).reduce((acc, [sitio, bloque]) => {
    (acc[bloque] = acc[bloque] || []).push(sitio);
    return acc;
  }, {});

  const children = [];
  const addImg = async (foto, caption) => {
    const img = await fotoToImageBuffer(foto, 280);
    children.push(...imageBlock(img, caption, '[Foto no disponible — revisar conexión]'));
  };

  children.push(heading1('Reporte de Avance de Obra', VERDE));
  children.push(p(project.displayId, { bold: true, size: 28, color: '111827' }));
  children.push(p(`Generado: ${fmtFecha(new Date().toISOString())}`, { color: '6b7280', size: 18 }));

  for (const bloque of [1, 2, 3]) {
    const s     = bloqueStatus[bloque] || { done: 0, total: 0 };
    const pct   = s.total ? Math.round(s.done / s.total * 100) : 0;
    const color = pct === 100 ? '16a34a' : pct === 0 ? '9ca3af' : 'd97706';
    const fechas = cl.bloqueFechas?.[bloque] || {};

    children.push(heading2(`${BLOQUE_LABELS[bloque]} — ${BLOQUE_DESC[bloque]}`, VERDE));
    const fechaTxt = [
      fechas.inicio ? ` · Iniciado ${fmtFecha(fechas.inicio)}` : '',
      fechas.cierre ? ` · Cerrado ${fmtFecha(fechas.cierre)}${(fechas.cerradoPor?.nombre || fechas.cerradoPor) ? ` por ${fechas.cerradoPor?.nombre || fechas.cerradoPor}` : ''}` : '',
    ].join('');
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `${pct}% completado`, bold: true, color }),
        new TextRun({ text: ` (${s.done}/${s.total} ítems)${fechaTxt}` }),
      ],
    }));

    if (pct < 100) {
      const pendientes = allExecBlocks
        .filter(b => b.bloque === bloque)
        .flatMap(b => b.items.filter(it => !cl.exec?.[it.id]).map(it => `${b.label.replace(/^\d+\.\d+\s*/, '')} — ${it.n}`));
      if (pendientes.length) {
        children.push(p('Pendiente:', { size: 18, color: '6b7280' }));
        for (const item of pendientes) children.push(p(`•  ${item}`, { size: 18, color: '6b7280' }));
      }
    }

    // Evidencias de cierre por paso (checklistData.fotosCierre) — foto real,
    // justificación con etiqueta de alerta, o pendiente si era obligatoria.
    for (const block of allExecBlocks.filter(b => b.bloque === bloque)) {
      if (!block.fotosCierre?.length) continue;
      const cierreData = cl.fotosCierre?.[block.id] || {};
      for (const slot of block.fotosCierre) {
        const d = cierreData[slot.id];
        if (d?.url || d?.pending) {
          await addImg(d.url || d, `${block.label} — ${slot.label}`);
        } else if (d?.justificacion) {
          children.push(new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({ text: `${block.label} — ${slot.label}: `, bold: true }),
              new TextRun({ text: `⚠ Justificado: ${d.justificacion}`, color: 'd97706' }),
            ],
          }));
        } else if (slot.obligatoria) {
          children.push(p(`${block.label} — ${slot.label}: evidencia obligatoria pendiente`, { size: 18, color: 'dc2626' }));
        }
      }
    }

    // Fotos de los sitios asociados a este bloque
    const sitios = _SITIOS_POR_BLOQUE[bloque] || [];
    for (const sitio of sitios) {
      const fotos = _fotosDeSitio(project, sitio);
      if (!fotos.length) continue;
      children.push(p(`Fotos — ${SITIO_LABEL[sitio] || sitio}`, { bold: true, color: VERDE }));
      for (const f of fotos) await addImg(f.url || f.data || f);
    }
  }

  children.push(hr());
  children.push(p(`Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}`,
    { size: 16, color: '6b7280', alignment: AlignmentType.CENTER }));

  const doc = newDoc(children);
  await saveDocx(doc, `EFS-Avance-${project.displayId}`);
  toast('Reporte de avance generado ✓', 'success');
}

window.exportarAvanceObra = exportarAvanceObra;
