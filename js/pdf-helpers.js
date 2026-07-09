// pdf-helpers.js — Constantes, helpers de layout y guardado para exportación PDF
// Importado por pdf-cliente.js, pdf-tecnico.js, pdf-levantamiento.js

import { config } from './db.js';
import { fmtFecha, toast } from './utils.js';
import { isNative, getPlugin } from './platform.js';

// ── Paleta de colores jsPDF ────────────────────────────────────────────────────
export const VERDE     = [27, 67, 50];
export const VERDE_MED = [64,145,108];
export const VERDE_CLR = [82,183,136];
export const BLANCO    = [255,255,255];
export const GRIS      = [45, 55, 45];
export const GRIS_CLR  = [120,140,120];

// ── Carga lazy de jsPDF (no se incluye en el bundle inicial) ─────────────────
async function _ensureJsPDF() {
  if (window.jspdf) return true;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './js/vendor/jspdf.umd.min.js';
    s.onload  = () => resolve(true);
    s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
    document.head.appendChild(s);
  });
}

// ── Instancia jsPDF ───────────────────────────────────────────────────────────
export async function newDoc() {
  await _ensureJsPDF();
  if (!window.jspdf) { alert('jsPDF no cargó. Verifica conexión a internet.'); return null; }
  return new window.jspdf.jsPDF({ orientation:'p', unit:'mm', format:'a4' });
}

// ── Logo en base64 (cacheado en módulo) ──────────────────────────────────────
let _logoB64 = null;
export async function getLogoB64() {
  if (_logoB64) return _logoB64;
  try {
    const res = await fetch('./icons/logo.png');
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => { _logoB64 = e.target.result; resolve(_logoB64); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Cabecera de página ────────────────────────────────────────────────────────
export function addHeader(doc, title, proyecto) {
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...VERDE_MED);
  doc.rect(0, 28, 210, 4, 'F');

  if (_logoB64) {
    try { doc.addImage(_logoB64, 'PNG', 14, 4, 22, 22); } catch {}
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...BLANCO);
    doc.text('Ecofit Solar Solutions', 40, 13);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(title, 40, 21);
  } else {
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(...BLANCO);
    doc.text('Ecofit Solar Solutions', 14, 14);
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(title, 14, 22);
  }

  doc.setFontSize(9);
  doc.setTextColor(...BLANCO);
  doc.text(proyecto.displayId, 196, 14, { align:'right' });
  doc.text(fmtFecha(new Date().toISOString()), 196, 22, { align:'right' });
}

// ── Pie de página ─────────────────────────────────────────────────────────────
export function addFooter(doc, pageNum, total) {
  doc.setFillColor(240, 248, 244);
  doc.rect(0, 284, 210, 13, 'F');
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_CLR);
  doc.text('Ecofit Solar Solutions · La Paz, BCS · México', 14, 291);
  doc.text(`Página ${pageNum} de ${total}`, 196, 291, { align:'right' });
}

// ── Campo etiqueta + valor ────────────────────────────────────────────────────
export function campo(doc, label, value, x, y) {
  doc.setFont('helvetica','bold');   doc.setFontSize(8);  doc.setTextColor(...GRIS_CLR);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
  doc.text(String(value || '—'), x, y + 5);
  return y + 12;
}

// ── Imagen responsiva ─────────────────────────────────────────────────────────
export async function addImage(doc, b64, x, y, maxW, maxH) {
  if (!b64) return y;
  try {
    const img = new Image();
    await new Promise((res,rej) => { img.onload=res; img.onerror=rej; img.src=b64; });
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(b64, 'JPEG', x, y, w, h);
    return y + h + 4;
  } catch { return y; }
}

// ── Guardar en Android (Capacitor Filesystem) ─────────────────────────────────
async function _saveNative(doc, filename) {
  const Filesystem = getPlugin('Filesystem');
  if (!Filesystem) { doc.save(filename); return; }
  try {
    const base64 = doc.output('datauristring').split(',')[1];
    await Filesystem.writeFile({ path:`Ecofit/${filename}`, data:base64, directory:'DOCUMENTS', recursive:true });
    toast(`PDF guardado en Documentos/Ecofit/${filename}`, 'success', 5000);
  } catch {
    doc.save(filename);
    toast('No se pudo guardar en Documentos — descargado como archivo', 'warning');
  }
}

// ── Guardar en OneDrive (opcional) ───────────────────────────────────────────
async function _tryOneDriveSave(doc, filename) {
  try {
    const { getFolderHandle, saveFile } = await import('./onedrive.js');
    const handle = await getFolderHandle();
    if (!handle) return;
    const blob = doc.output('blob');
    const path = await saveFile(filename, blob, 'application/pdf');
    toast(`☁️ Guardado en OneDrive: ${path}`, 'success', 5000);
  } catch { /* OneDrive es opcional */ }
}

// ── Punto de guardado unificado ──────────────────────────────────────────────
export async function savePDF(doc, filename) {
  if (isNative()) {
    await _saveNative(doc, filename);
  } else {
    doc.save(filename);
    await _tryOneDriveSave(doc, filename);
  }
}

// ── Yield de frames (evita freeze del spinner en móviles lentos) ──────────────
export async function pdfYield() {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ── Estado del botón de generación ───────────────────────────────────────────
export function btnLoading(btn, label) {
  if (!btn) return;
  btn.disabled = true;
  btn._origLabel = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-sm"></span> ${label}`;
}
export function btnDone(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn._origLabel) { btn.innerHTML = btn._origLabel; delete btn._origLabel; }
}

// ── Contacto Ecofit (cargado desde db.config) ─────────────────────────────────
export async function getContacto() {
  return config.get('contactoEcofit');
}
