// pdf-calculadora.js — Exportación del BOM/diagrama/guía de la Calculadora (Word vía blob)
// Lee el estado en pantalla del wizard (cs/SX) — no requiere haber guardado antes,
// igual que el wizard ya renderiza BOM/diagrama/guía en vivo desde cs.

import { esc, fmtFecha, toast } from './utils.js';
import { cs, SX, getRowData } from './calc-state.js';
import { calcBOM, buildDiagramSVG, buildGuiaData, buildTorqueTable } from '../modules/calculadora/index.js';

// El diagrama ya pinta su propio fondo oscuro y usa colores hex fijos (no
// variables CSS), así que no necesita recoloreo — solo forzar width/height
// explícitos en el SVG clonado, porque sin esos atributos un <img>/Image()
// renderiza el SVG a 300×150 por defecto en vez de usar el viewBox.
function withExplicitSize(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  const viewBox = svgEl.getAttribute('viewBox') || '0 0 800 600';
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const width = parts[2] || 800, height = parts[3] || 600;
  svgEl.setAttribute('width', width);
  svgEl.setAttribute('height', height);
  return { svgString: new XMLSerializer().serializeToString(svgEl), width, height };
}

async function svgToPngDataURI(svgString, width, height) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportarBOMCalculadora() {
  if (!cs.estructura) { toast('No hay datos de la Calculadora para exportar', 'error'); return; }

  const rd      = getRowData();
  const pW      = cs.pW || 1.134;
  const pH      = cs.pH || 1.990;
  const bom     = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, pW);
  const guia    = buildGuiaData(rd, pW, pH, cs.estructura);
  const torques = buildTorqueTable(cs.estructura, cs.techo);

  const groups = {};
  bom.forEach(item => { (groups[item.grp] = groups[item.grp] || []).push(item); });

  const wSec = (title) =>
    `<h2 style="color:#16a34a;font-size:13pt;margin:18pt 0 8pt;border-bottom:1px solid #e5e7eb;padding-bottom:4pt">${esc(title)}</h2>`;
  const TH = 'style="background:#f3f4f6;border:1px solid #e5e7eb;padding:5pt;text-align:left"';
  const TD = 'style="border:1px solid #e5e7eb;padding:5pt"';

  const nombreProyecto = SX.project?.displayId || SX.project?.clientName || 'Consulta sin proyecto guardado';

  let html = `
<h1 style="color:#111827;font-size:18pt;border-bottom:3px solid #16a34a;padding-bottom:6pt">Lista de Materiales (BOM)</h1>
<table style="width:100%;border:none;margin-bottom:16pt">
  <tr>
    <td style="border:none;font-size:14pt;font-weight:bold;color:#111827">${esc(nombreProyecto)}</td>
    <td style="border:none;text-align:right;color:#6b7280;font-size:9pt">Generado: ${fmtFecha(new Date().toISOString())}</td>
  </tr>
</table>`;

  // ── Tabla de BOM agrupada por categoría ───────────────────────────────────
  html += wSec('Materiales');
  for (const [grp, items] of Object.entries(groups)) {
    html += `<p style="font-size:9pt;font-weight:bold;color:#16a34a;margin:8pt 0 2pt">${esc((grp || 'Otros').toUpperCase())}</p>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8pt">
      <tr><th ${TH}>Material</th><th ${TH}>No. parte</th><th ${TH} style="text-align:right">Cant.</th></tr>
      ${items.map(it => `<tr><td ${TD}>${esc(it.name)}</td><td ${TD}>${esc(it.partNum)}</td><td ${TD} style="text-align:right">${it.qty} ${esc(it.unit)}</td></tr>`).join('')}
    </table>`;
  }

  // ── Diagrama técnico (rasterizado a PNG) ──────────────────────────────────
  html += wSec('Diagrama técnico');
  try {
    const rawSvg = buildDiagramSVG(rd, pW, pH, cs.estructura);
    const { svgString, width, height } = withExplicitSize(rawSvg);
    const png = await svgToPngDataURI(svgString, width, height);
    html += `<img src="${png}" style="max-width:480pt;height:auto;margin:4pt 0;display:block">`;
  } catch (e) {
    html += `<p style="font-size:8pt;color:#dc2626;margin:2pt 0">[Diagrama no disponible — ${esc(e.message)}]</p>`;
  }

  // ── Guía de instalación ────────────────────────────────────────────────
  html += wSec('Guía de instalación');
  html += `<table style="width:100%;border-collapse:collapse;font-size:9pt">
    <tr><th ${TH}>Filas</th><th ${TH}>Paneles/fila</th><th ${TH}>Corte de riel</th><th ${TH}>Patas</th></tr>
    ${guia.map(g => `<tr>
      <td ${TD}>${g.rows.join(', ')}</td>
      <td ${TD}>${g.n}</td>
      <td ${TD}>${g.cut.toFixed(3)} m</td>
      <td ${TD}>${g.feet.length}</td>
    </tr>`).join('')}
  </table>`;

  // ── Torques de apriete ─────────────────────────────────────────────────
  html += wSec('Torques de apriete');
  html += `<table style="width:100%;border-collapse:collapse;font-size:9pt">
    <tr><th ${TH}>Componente</th><th ${TH}>Torque</th><th ${TH}>Nota</th></tr>
    ${torques.map(t => `<tr><td ${TD}>${esc(t.comp)}</td><td ${TD}>${esc(t.torque)}</td><td ${TD}>${esc(t.nota)}</td></tr>`).join('')}
  </table>`;

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
  table { table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: break-word; }
  img { max-width: 480pt; height: auto; }
  @page { margin: 1.5cm 2cm; }
</style>
</head>
<body>${html}</body></html>`;

  const blob = new Blob(['﻿' + fullDoc], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `EFS-BOM-${nombreProyecto.replace(/[^\w-]+/g, '_')}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('BOM exportado ✓', 'success');
}

window.exportarBOMCalculadora = exportarBOMCalculadora;
