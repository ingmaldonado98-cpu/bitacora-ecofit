// word-helpers.js — Helpers de construcción y guardado de documentos .docx reales (OOXML)
// Mirror de pdf-helpers.js pero para la librería `docx` (js/vendor/docx.mjs) en vez de jsPDF.
//
// Los 5 generadores "Word" (pdf-levantamiento.js, pdf-garantia.js, pdf-calculadora.js,
// pdf-avance.js, word-tecnico.js) antes armaban un string HTML disfrazado de .doc — Word
// de escritorio lo abre por compatibilidad histórica, pero Word móvil lo rechaza como
// "archivo dañado". Ahora construyen un array `children` con estos helpers y lo empaquetan
// con `Packer.toBlob`, produciendo un .docx real (formato ZIP/OOXML) que abre en cualquier
// Word (escritorio, móvil, Word Online).

import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, Packer, PageBreak,
} from './vendor/docx.mjs';

export {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, Packer, PageBreak,
};

// ── Tamaños de fuente (half-points: 1pt = 2 half-points) ──────────────────────
export const SZ = { h1: 36, h2: 26, body: 22, small: 16, td: 20, td9: 18 };

// Márgenes de página ~1.5cm/2cm (1cm ≈ 566.93 twips), igual que `@page` en las versiones HTML
const PAGE_MARGIN = { top: 850, right: 1134, bottom: 850, left: 1134 };

// ── Documento completo con fuente Calibri por defecto y márgenes estándar ────
export function newDoc(children) {
  // filter(Boolean): red de seguridad — un hijo null/undefined (p.ej. campo()
  // devuelve null para valores vacíos) hace que docx truene al serializar.
  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: SZ.body } } } },
    sections: [{ properties: { page: { margin: PAGE_MARGIN } }, children: children.filter(Boolean) }],
  });
}

// ── Encabezados con borde inferior coloreado (igual a los <h1>/<h2>) ─────────
export function heading1(text, colorHex) {
  return new Paragraph({
    spacing: { after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: colorHex } },
    children: [new TextRun({ text, bold: true, size: SZ.h1, color: '111827' })],
  });
}
export function heading2(text, colorHex) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'e5e7eb' } },
    children: [new TextRun({ text, bold: true, size: SZ.h2, color: colorHex })],
  });
}

// ── Campo etiqueta + valor (mismo patrón que el helper wCampo de las versiones HTML) ──
export function campo(label, value) {
  if (value == null || value === '') return null;
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: String(label).toUpperCase(), size: SZ.small, color: '6b7280' }),
      new TextRun({ text: String(value), size: SZ.body, color: '111827', break: 1 }),
    ],
  });
}

// ── Párrafo de texto simple con color/tamaño/negrita/alineación opcionales ───
export function p(text, opts = {}) {
  const { color = '111827', size = SZ.body, bold = false, italic = false, alignment } = opts;
  return new Paragraph({
    alignment,
    children: [new TextRun({ text, color, size, bold, italics: italic })],
  });
}

// ── Tabla con encabezado coloreado ────────────────────────────────────────────
// headers: array de strings.
// rows: array de arrays de celdas — cada celda es un string, o
//       { text, colSpan?, bold?, shadingHex?, color? } para casos especiales (colspan, totales).
function _cell(content, { shadingHex, bold = false, color = '111827', size = SZ.td, colSpan } = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(content ?? ''), bold, color, size })] })],
    columnSpan: colSpan,
    shading: shadingHex ? { fill: shadingHex, type: ShadingType.SOLID } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}
export function table(headers, rows, { headerShading = '16a34a', headerColor = 'FFFFFF' } = {}) {
  const headerRow = new TableRow({
    children: headers.map(h => _cell(h, { shadingHex: headerShading, bold: true, color: headerColor })),
  });
  const bodyRows = rows.map(cells => new TableRow({
    children: cells.map(c => (c && typeof c === 'object' && 'text' in c)
      ? _cell(c.text, { colSpan: c.colSpan, bold: c.bold, shadingHex: c.shadingHex, color: c.color })
      : _cell(c)),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

// ── Chip/badge — aproximación de los badges con fondo de color ───────────────
export function chip(text, { color = '15803d', bg = 'f0fdf4' } = {}) {
  return new TextRun({ text: ` ${text} `, color, size: SZ.td9, shading: { fill: bg, type: ShadingType.SOLID } });
}

// ── Línea horizontal ───────────────────────────────────────────────────────────
export function hr() {
  return new Paragraph({
    spacing: { before: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' } },
    children: [],
  });
}

// ── Salto de página ────────────────────────────────────────────────────────────
export function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Bloque de imagen (o aviso de foto pendiente) a partir de un objeto ya
// resuelto por fotoToImageBuffer() en util-foto.js: { data, width, height } | null ──
export function imageBlock(img, caption, fallbackText) {
  const out = [];
  if (caption) out.push(new Paragraph({ children: [new TextRun({ text: caption, color: '9ca3af', size: 16 })] }));
  if (img) {
    out.push(new Paragraph({
      spacing: { after: 160 },
      children: [new ImageRun({ type: 'jpg', data: img.data, transformation: { width: img.width, height: img.height } })],
    }));
  } else {
    const text = fallbackText || `[Foto pendiente de subir${caption ? ' — ' + caption : ''}]`;
    out.push(new Paragraph({ children: [new TextRun({ text, color: 'dc2626', size: 18 })] }));
  }
  return out;
}

// ── Guardar el documento como .docx real ──────────────────────────────────────
export async function saveDocx(doc, filename) {
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const name = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
