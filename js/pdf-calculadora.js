// pdf-calculadora.js — Exportación del BOM/diagrama/guía de la Calculadora (.docx real — OOXML)
// Lee el estado en pantalla del wizard (cs/SX) — no requiere haber guardado antes,
// igual que el wizard ya renderiza BOM/diagrama/guía en vivo desde cs.

import { fmtFecha, toast } from './utils.js';
import { cs, SX, getRowData } from './calc-state.js';
import { calcBOM, buildDiagramSVG, buildGuiaData, buildTorqueTable } from '../modules/calculadora/index.js';
import { newDoc, heading1, heading2, p, table, hr, ImageRun, Paragraph,
         AlignmentType, saveDocx } from './word-helpers.js';

const VERDE = '16a34a';

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

async function svgToPngBuffer(svgString, width, height, maxWidthPx = 640) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const dataUri = canvas.toDataURL('image/png');
    const res2 = await fetch(dataUri);
    const data = new Uint8Array(await res2.arrayBuffer());
    let w = width, h = height;
    if (w > maxWidthPx) { h = Math.round(h * maxWidthPx / w); w = maxWidthPx; }
    return { data, width: w, height: h };
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

  const nombreProyecto = SX.project?.displayId || SX.project?.clientName || 'Consulta sin proyecto guardado';

  const children = [];
  const addSec = (title) => children.push(heading2(title, VERDE));

  children.push(heading1('Lista de Materiales (BOM)', VERDE));
  children.push(p(nombreProyecto, { bold: true, size: 28, color: '111827' }));
  children.push(p(`Generado: ${fmtFecha(new Date().toISOString())}`, { color: '6b7280', size: 18 }));

  // ── Tabla de BOM agrupada por categoría ───────────────────────────────────
  addSec('Materiales');
  for (const [grp, items] of Object.entries(groups)) {
    children.push(p((grp || 'Otros').toUpperCase(), { bold: true, color: VERDE, size: 18 }));
    const rows = items.map(it => [it.name, it.partNum, `${it.qty} ${it.unit}`]);
    children.push(table(['Material', 'No. parte', 'Cant.'], rows, { headerShading: 'f3f4f6', headerColor: '111827' }));
  }

  // ── Diagrama técnico (rasterizado a PNG) ──────────────────────────────────
  addSec('Diagrama técnico');
  try {
    const rawSvg = buildDiagramSVG(rd, pW, pH, cs.estructura);
    const { svgString, width, height } = withExplicitSize(rawSvg);
    const img = await svgToPngBuffer(svgString, width, height);
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: img.width, height: img.height } })],
    }));
  } catch (e) {
    children.push(p(`[Diagrama no disponible — ${e.message}]`, { size: 16, color: 'dc2626' }));
  }

  // ── Guía de instalación ────────────────────────────────────────────────
  addSec('Guía de instalación');
  children.push(table(['Filas', 'Paneles/fila', 'Corte de riel', 'Patas'],
    guia.map(g => [g.rows.join(', '), String(g.n), `${g.cut.toFixed(3)} m`, String(g.feet.length)]),
    { headerShading: 'f3f4f6', headerColor: '111827' }));

  // ── Torques de apriete ─────────────────────────────────────────────────
  addSec('Torques de apriete');
  children.push(table(['Componente', 'Torque', 'Nota'],
    torques.map(t => [t.comp, t.torque, t.nota]),
    { headerShading: 'f3f4f6', headerColor: '111827' }));

  children.push(hr());
  children.push(p(`Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}`,
    { size: 16, color: '6b7280', alignment: AlignmentType.CENTER }));

  const doc = newDoc(children);
  await saveDocx(doc, `EFS-BOM-${nombreProyecto.replace(/[^\w-]+/g, '_')}`);
  toast('BOM exportado ✓', 'success');
}

window.exportarBOMCalculadora = exportarBOMCalculadora;
