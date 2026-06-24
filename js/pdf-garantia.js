// pdf-garantia.js — Certificado de garantía (Word), generable desde el módulo Garantía.
// Mismo patrón que pdf-avance.js: HTML → blob .doc, fotos incrustadas con fotoToDataURI.

import { projects } from './db.js';
import { esc, fmtFecha, toast, fotoToDataURI } from './utils.js';
import { GARANTIAS_STD } from './garantia.js';

const TIPOS_EQUIPO_LABEL = {
  inversor: 'Inversor', microinversor: 'Microinversor', bateria: 'Batería',
  controladora: 'Controladora / MPPT', cargador: 'Cargador',
  optimizador: 'Optimizador de potencia', monitor: 'Monitor / Gateway', otro: 'Otro',
};

export async function exportarCertificadoGarantia(projectId) {
  const project = await projects.getById(projectId);
  if (!project) { toast('Proyecto no encontrado', 'error'); return; }

  const g  = project.garantia || {};
  const fi = g.fechaInstalacion || '';

  const wSec = (title) =>
    `<h2 style="color:#16a34a;font-size:13pt;margin:18pt 0 8pt;border-bottom:1px solid #e5e7eb;padding-bottom:4pt">${esc(title)}</h2>`;
  const wImg = async (src, maxW='220pt') => {
    const dataUri = await fotoToDataURI(src);
    if (!dataUri) return `<p style="font-size:8pt;color:#dc2626;margin:2pt 0">[Foto no disponible — revisar conexión]</p>`;
    return `<img src="${dataUri}" style="max-width:${maxW};height:auto;margin:4pt 0;display:block">`;
  };

  let html = `
<h1 style="color:#111827;font-size:18pt;border-bottom:3px solid #16a34a;padding-bottom:6pt">Certificado de Garantía</h1>
<table style="width:100%;border:none;margin-bottom:16pt">
  <tr>
    <td style="border:none;font-size:14pt;font-weight:bold;color:#111827">${esc(project.displayId)}</td>
    <td style="border:none;text-align:right;color:#6b7280;font-size:9pt">Generado: ${fmtFecha(new Date().toISOString())}</td>
  </tr>
</table>`;

  // ── Vigencias ────────────────────────────────────────────────────────────
  html += wSec('Vigencia de garantías');
  if (fi) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:9pt">
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Garantía</th>
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Vence</th>
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Estado</th>
      </tr>
      ${GARANTIAS_STD.map(gar => {
        const base = new Date(fi);
        const vence = new Date(base);
        vence.setFullYear(vence.getFullYear() + gar.anios);
        const diasLeft = Math.ceil((vence - new Date()) / 86400000);
        const estado = diasLeft < 0 ? 'Vencida' : diasLeft < 180 ? `Próxima a vencer (${diasLeft} días)` : 'Vigente';
        const color  = diasLeft < 0 ? '#dc2626' : diasLeft < 180 ? '#d97706' : '#16a34a';
        const fechaStr = vence.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
        return `<tr>
          <td style="border:1px solid #e5e7eb;padding:5pt">${esc(gar.label)}</td>
          <td style="border:1px solid #e5e7eb;padding:5pt">${fechaStr}</td>
          <td style="border:1px solid #e5e7eb;padding:5pt;color:${color};font-weight:bold">${estado}</td>
        </tr>`;
      }).join('')}
    </table>
    <p style="font-size:8pt;color:#6b7280;margin-top:4pt">Fecha de instalación / comisionamiento: ${fmtFecha(fi)}</p>`;
  } else {
    html += `<p style="font-size:9pt;color:#dc2626">Sin fecha de instalación registrada — no se pudo calcular la vigencia.</p>`;
  }

  // ── Equipos ──────────────────────────────────────────────────────────────
  html += wSec('Equipos instalados');
  const equipos = g.equipos || [];
  if (equipos.length) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:9pt">
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Tipo</th>
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Marca / Modelo</th>
        <th style="border:1px solid #e5e7eb;padding:5pt;text-align:left">Serial</th>
      </tr>
      ${equipos.map(eq => `<tr>
        <td style="border:1px solid #e5e7eb;padding:5pt">${esc(TIPOS_EQUIPO_LABEL[eq.tipo] || eq.tipo || '—')}</td>
        <td style="border:1px solid #e5e7eb;padding:5pt">${esc(eq.marca || '')} ${esc(eq.modelo || '')}</td>
        <td style="border:1px solid #e5e7eb;padding:5pt">${esc(eq.serial || '—')}</td>
      </tr>`).join('')}
    </table>`;
  } else {
    html += `<p style="font-size:9pt;color:#6b7280">Sin equipos registrados.</p>`;
  }

  // ── Resultado de Voc ─────────────────────────────────────────────────────
  html += wSec('Validación de tensión en circuito abierto (Voc)');
  const vd = g.validacionVoc;
  if (vd?.resultado) {
    const color = vd.resultado === 'seguro' ? '#16a34a' : vd.resultado === 'excede' ? '#dc2626' : '#d97706';
    html += `
    <p style="font-size:9pt;margin:0 0 4pt"><strong style="color:${color}">${esc(vd.mensaje || vd.resultado)}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:9pt">
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Voc panel (STC)</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.vocPanel ?? '—'} V</td></tr>
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Paneles en serie</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.panelesSerie ?? '—'}</td></tr>
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Temperatura mínima histórica</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.tMin ?? '—'} °C</td></tr>
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Coeficiente de temperatura</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.coefVoc ?? '—'} %/°C</td></tr>
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Voc corregido por string</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.vocString?.toFixed(2) ?? '—'} V</td></tr>
      <tr><td style="border:1px solid #e5e7eb;padding:5pt">Voc máx. del inversor</td><td style="border:1px solid #e5e7eb;padding:5pt">${vd.vocMaxInversor ?? '—'} V</td></tr>
    </table>`;
  } else {
    html += `<p style="font-size:9pt;color:#dc2626">Validación de Voc no realizada todavía.</p>`;
  }

  // ── Evidencia fotográfica del arreglo ───────────────────────────────────
  html += wSec('Evidencia fotográfica del arreglo de paneles');
  const fFrontal = g.paneles?.fotoArregloFrontal;
  const fPerfil  = g.paneles?.fotoArregloPerfil;
  if (fFrontal || fPerfil) {
    if (fFrontal) { html += `<p style="font-size:9pt;color:#6b7280;margin:4pt 0 2pt">Vista frontal</p>${await wImg(fFrontal, '320pt')}`; }
    if (fPerfil)  { html += `<p style="font-size:9pt;color:#6b7280;margin:8pt 0 2pt">Vista de perfil</p>${await wImg(fPerfil, '320pt')}`; }
  } else {
    html += `<p style="font-size:9pt;color:#6b7280">Sin evidencia fotográfica registrada.</p>`;
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
  table { table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: break-word; }
  img { max-width: 220pt; height: auto; }
  @page { margin: 1.5cm 2cm; }
</style>
</head>
<body>${html}</body></html>`;

  const blob = new Blob(['﻿' + fullDoc], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `EFS-Certificado-Garantia-${project.displayId}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Certificado de garantía generado ✓', 'success');
}

window.exportarCertificadoGarantia = exportarCertificadoGarantia;
