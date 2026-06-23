// pdf-avance.js — Reporte de avance de obra (Word), generable en cualquier momento.
// No bloquea por incompletitud: siempre genera con el estado real de cada bloque
// (100%, parcial con lista de pendientes, o sin iniciar).

import { projects } from './db.js';
import { esc, fmtFecha, toast, fotoToDataURI } from './utils.js';
import { getExecBlocks, BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';
import { computeBloqueStatus, SITIO_BLOQUE_PRIMARIA } from './doc-exec.js';

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

  const wSec = (title) =>
    `<h2 style="color:#16a34a;font-size:13pt;margin:18pt 0 8pt;border-bottom:1px solid #e5e7eb;padding-bottom:4pt">${esc(title)}</h2>`;
  const wImg = async (src, maxW='220pt') => {
    const dataUri = await fotoToDataURI(src);
    if (!dataUri) return `<p style="font-size:8pt;color:#dc2626;margin:2pt 0">[Foto no disponible — revisar conexión]</p>`;
    return `<img src="${dataUri}" style="max-width:${maxW};height:auto;margin:4pt 0;display:block">`;
  };

  let html = `
<h1 style="color:#111827;font-size:18pt;border-bottom:3px solid #16a34a;padding-bottom:6pt">Reporte de Avance de Obra</h1>
<table style="width:100%;border:none;margin-bottom:16pt">
  <tr>
    <td style="border:none;font-size:14pt;font-weight:bold;color:#111827">${esc(project.displayId)}</td>
    <td style="border:none;text-align:right;color:#6b7280;font-size:9pt">Generado: ${fmtFecha(new Date().toISOString())}</td>
  </tr>
</table>`;

  for (const bloque of [1, 2, 3]) {
    const s     = bloqueStatus[bloque] || { done: 0, total: 0 };
    const pct   = s.total ? Math.round(s.done / s.total * 100) : 0;
    const color = pct === 100 ? '#16a34a' : pct === 0 ? '#9ca3af' : '#f0c000';
    const fechas = cl.bloqueFechas?.[bloque] || {};

    html += wSec(`${BLOQUE_LABELS[bloque]} — ${BLOQUE_DESC[bloque]}`);
    html += `<p style="margin:0 0 6pt"><strong style="color:${color}">${pct}% completado</strong> (${s.done}/${s.total} ítems)
      ${fechas.inicio ? ` · Iniciado ${fmtFecha(fechas.inicio)}` : ''}
      ${fechas.cierre ? ` · Cerrado ${fmtFecha(fechas.cierre)}${fechas.cerradoPor ? ` por ${esc(fechas.cerradoPor)}` : ''}` : ''}</p>`;

    if (pct < 100) {
      const pendientes = allExecBlocks
        .filter(b => b.bloque === bloque)
        .flatMap(b => b.items.filter(it => !cl.exec?.[it.id]).map(it => `${b.label.replace(/^\d+\.\d+\s*/, '')} — ${it.n}`));
      if (pendientes.length) {
        html += `<p style="font-size:9pt;color:#6b7280;margin:4pt 0">Pendiente:</p>
          <ul style="margin:0 0 8pt;padding-left:18pt;font-size:9pt;color:#6b7280">
            ${pendientes.map(p => `<li>${esc(p)}</li>`).join('')}
          </ul>`;
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
          html += `<p style="font-size:9pt;color:#6b7280;margin:6pt 0 2pt">${esc(block.label)} — ${esc(slot.label)}</p>`;
          html += await wImg(d.url || d);
        } else if (d?.justificacion) {
          html += `<p style="font-size:9pt;margin:6pt 0 2pt"><strong>${esc(block.label)} — ${esc(slot.label)}:</strong>
            <span style="color:#d97706">⚠ Justificado: ${esc(d.justificacion)}</span></p>`;
        } else if (slot.obligatoria) {
          html += `<p style="font-size:9pt;color:#dc2626;margin:6pt 0 2pt">${esc(block.label)} — ${esc(slot.label)}: evidencia obligatoria pendiente</p>`;
        }
      }
    }

    // Fotos de los sitios asociados a este bloque
    const sitios = _SITIOS_POR_BLOQUE[bloque] || [];
    for (const sitio of sitios) {
      const fotos = _fotosDeSitio(project, sitio);
      if (!fotos.length) continue;
      html += `<p style="font-weight:bold;color:#16a34a;margin:8pt 0 4pt">Fotos — ${esc(SITIO_LABEL[sitio] || sitio)}</p>`;
      for (const f of fotos) html += await wImg(f.url || f.data || f);
    }
  }

  html += `<hr style="margin-top:24pt;border-color:#e5e7eb">
<p style="font-size:8pt;color:#6b7280;text-align:center">Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}</p>`;

  const fullDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><meta name="ProgId" content="Word.Document">
<style>
  body { font-family: Calibri, 'Segoe UI', sans-serif; font-size: 11pt; color: #111827; margin: 24pt 32pt; line-height: 1.4; }
  h1, h2, h3 { font-family: Calibri, 'Segoe UI', sans-serif; }
  img { max-width: 220pt; height: auto; }
  @page { margin: 1.5cm 2cm; }
</style>
</head>
<body>${html}</body></html>`;

  const blob = new Blob(['﻿' + fullDoc], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `EFS-Avance-${project.displayId}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Reporte de avance generado ✓', 'success');
}

window.exportarAvanceObra = exportarAvanceObra;
