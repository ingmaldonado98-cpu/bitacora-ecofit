// pdf-levantamiento.js — Word de levantamiento técnico
// Extraído de pdf.js. Registra window.exportarWordLevantamiento.

import { projects } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA } from './utils.js';

window.exportarWordLevantamiento = async function(projectId) {
  const project = await projects.getById(projectId);
  const { toast } = await import('./utils.js');
  if (!project) { toast('Proyecto no encontrado', 'error'); return; }

  const lev  = project.documentacion?.levantamiento || {};
  const tipo = TIPOS_SISTEMA[project.tipoSistema];

  const wCampo = (label, value) =>
    value ? `<p style="margin:0 0 8pt"><small style="color:#6b7280;text-transform:uppercase;font-size:8pt">${esc(label)}</small><br><span style="font-size:11pt">${esc(String(value))}</span></p>` : '';
  const wSec = (title) =>
    `<h2 style="color:#16a34a;font-size:13pt;margin:18pt 0 8pt;border-bottom:1px solid #e5e7eb;padding-bottom:4pt">${esc(title)}</h2>`;
  const wImg = (b64, maxW='260pt') => {
    if (!b64) return '';
    const src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    return `<img src="${src}" style="max-width:${maxW};height:auto;margin:4pt 0;display:block">`;
  };
  const TH = 'style="background:#16a34a;color:white;padding:4pt 8pt;text-align:left;font-size:10pt"';
  const TD = 'style="padding:4pt 8pt;border:1px solid #e5e7eb;font-size:10pt"';

  let html = `
<h1 style="color:#111827;font-size:18pt;border-bottom:3px solid #16a34a;padding-bottom:6pt">Levantamiento Técnico</h1>
<table style="width:100%;border:none;margin-bottom:16pt">
  <tr>
    <td style="border:none;font-size:14pt;font-weight:bold;color:#111827">${esc(project.displayId)}</td>
    <td style="border:none;text-align:right;color:#6b7280;font-size:9pt">Generado: ${fmtFecha(new Date().toISOString())}</td>
  </tr>
</table>
${wCampo('Cliente', project.clientName)}
${wCampo('Alias / proyecto', project.nombreProyecto)}
${wCampo('Dirección', project.direccion)}
${wCampo('Tipo de sistema', tipo?.label || project.tipoSistema)}
`;

  // Techo y sitio
  html += wSec('Techo y sitio');
  html += wCampo('Tipo de techo', lev.tipTecho);
  if (lev.tipTecho === 'Madera') {
    html += wCampo('Estado de la madera', lev.estadoMadera);
    html += wCampo('Distancia entre vigas', lev.distVigas ? `${lev.distVigas} cm` : null);
  }
  html += wCampo('Temperatura mínima del sitio', lev.tMin != null ? `${lev.tMin} °C` : null);
  if (lev.tMinCiudad && lev.tMinCiudad !== 'otro') {
    html += wCampo('Estado de referencia', `${lev.tMinCiudad} (zona: ${lev.tMinZona || 'valle'})`);
  }

  // Áreas del techo
  const areas = lev.areasTecho || [];
  if (areas.length) {
    html += `<p style="font-weight:bold;color:#16a34a;margin:12pt 0 6pt">Áreas del techo</p>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
      <tr>
        <th ${TH}>Área</th><th ${TH}>Dimensiones</th><th ${TH}>Superficie</th>
        <th ${TH}>Orientación</th><th ${TH}>Inclinación</th><th ${TH}>Pisos</th>
        <th ${TH}>Tablero→Inv.</th><th ${TH}>Inv.→Paneles</th>
      </tr>`;
    for (const a of areas) {
      const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : '—';
      const sup = (a.ancho && a.largo) ? `${(a.ancho * a.largo).toFixed(1)} m²` : (a.area ? `${a.area} m²` : '—');
      html += `<tr>
        <td ${TD}>${esc(a.nombre || '—')}</td><td ${TD}>${dim}</td><td ${TD}>${sup}</td>
        <td ${TD}>${esc(a.orientacion || '—')}</td>
        <td ${TD}>${a.inclinacion != null ? `${a.inclinacion}°` : '—'}</td>
        <td ${TD}>${a.pisos != null ? a.pisos : '—'}</td>
        <td ${TD}>${a.distTableroInversor != null ? `${a.distTableroInversor} m` : '—'}</td>
        <td ${TD}>${a.distInversorPaneles != null ? `${a.distInversorPaneles} m` : '—'}</td>
      </tr>`;
    }
    html += '</table>';
    for (const a of areas) {
      const fotos = Array.isArray(a.fotos) ? a.fotos : [];
      if (fotos.length) {
        html += `<p style="font-size:9pt;color:#6b7280;margin-bottom:4pt">${esc(a.nombre || 'Área')} — fotos</p>`;
        for (const f of fotos.slice(0, 4)) html += wImg(f.url || f.data || f);
      }
    }
  }

  // Fotos generales del levantamiento
  const fotosLev = lev.fotosLevantamiento || [];
  if (fotosLev.length) {
    html += `<p style="font-weight:bold;color:#16a34a;margin:12pt 0 4pt">Fotos del levantamiento</p>`;
    for (const f of fotosLev.slice(0, 8)) html += wImg(f.url || f.data || f);
  }

  // Sombras
  const sombras = lev.sombras || {};
  if (sombras.checklist?.length || sombras.foto || sombras.notas) {
    html += wSec('Análisis de sombras');
    if (sombras.checklist?.length) {
      html += `<p style="margin-bottom:6pt">${sombras.checklist.map(s =>
        `<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:2pt 8pt;border-radius:20pt;margin:2pt;font-size:9pt">${esc(s)}</span>`
      ).join('')}</p>`;
    }
    if (sombras.notas) html += wCampo('Notas de sombras', sombras.notas);
    if (sombras.foto) html += wImg(sombras.foto);
  }

  // Eléctrico y consumo
  const tieneElec = !['sistema_pequeno', 'otro'].includes(project.tipoSistema);
  if (tieneElec && (lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga || lev.tarifaCFE)) {
    html += wSec('Eléctrico y consumo');
    html += wCampo('Servicio CFE', lev.tipoServicioCFE);
    html += wCampo('Tierra física', lev.tierraFisica);
    html += wCampo('Centro de carga', lev.centroCarga);
    html += wCampo('Tarifa CFE', lev.tarifaCFE);
    if (lev.demandaKW)      html += wCampo('Demanda contratada', `${lev.demandaKW} kW`);
    if (lev.factorPotencia) html += wCampo('Factor de potencia', `${lev.factorPotencia}`);
    if (lev.horarioUso)     html += wCampo('Horario de uso', lev.horarioUso);

    const recibos = lev.recibos || [];
    if (recibos.length) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Recibos CFE</p>`;
      html += `<table style="width:100%;border-collapse:collapse">
        <tr><th ${TH}>Mes</th><th ${TH}>kWh</th><th ${TH}>Importe</th></tr>`;
      for (const r of recibos) {
        html += `<tr>
          <td ${TD}>${esc(r.mes || '—')}</td>
          <td ${TD}>${r.kwh != null ? r.kwh : '—'}</td>
          <td ${TD}>${r.importe ? `$${r.importe}` : '—'}</td>
        </tr>`;
      }
      html += '</table>';
    }

    const aparatos = lev.aparatos || [];
    if (aparatos.length) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Inventario de aparatos</p>`;
      html += `<table style="width:100%;border-collapse:collapse">
        <tr><th ${TH}>Aparato</th><th ${TH}>Cant.</th><th ${TH}>Watts</th><th ${TH}>Hrs/día</th><th ${TH}>Wh/día</th></tr>`;
      for (const ap of aparatos) {
        const whDia = (ap.watts && ap.horas) ? (ap.watts * ap.horas * (ap.cantidad || 1)).toFixed(0) : '—';
        html += `<tr>
          <td ${TD}>${esc(ap.nombre || '—')}</td><td ${TD}>${ap.cantidad || 1}</td>
          <td ${TD}>${ap.watts != null ? ap.watts : '—'}</td><td ${TD}>${ap.horas != null ? ap.horas : '—'}</td>
          <td ${TD}>${whDia}</td>
        </tr>`;
      }
      html += '</table>';
    }

    const cCrit = lev.cargasCriticas || lev.cargasRespaldo || [];
    const cSec  = lev.cargasSecundarias || [];
    if (cCrit.length || cSec.length) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Cargas</p>`;
      html += `<table style="width:100%;border-collapse:collapse">
        <tr><th ${TH}>Tipo</th><th ${TH}>Carga</th><th ${TH}>Watts</th><th ${TH}>Hrs/día</th></tr>`;
      for (const c of cCrit) html += `<tr><td ${TD} style="color:#dc2626;font-weight:bold">Crítica</td><td ${TD}>${esc(c.nombre||'—')}</td><td ${TD}>${c.watts||'—'}</td><td ${TD}>${c.horas||'—'}</td></tr>`;
      for (const c of cSec)  html += `<tr><td ${TD} style="color:#2563eb">Secundaria</td><td ${TD}>${esc(c.nombre||'—')}</td><td ${TD}>${c.watts||'—'}</td><td ${TD}>${c.horas||'—'}</td></tr>`;
      html += '</table>';
    }

    if (lev.autonomia || lev.bancoBaterias) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Configuración híbrida</p>`;
      html += wCampo('Autonomía requerida', lev.autonomia ? `${lev.autonomia} horas` : null);
      html += wCampo('Banco de baterías', lev.bancoBaterias ? `${lev.bancoBaterias} kWh` : null);
    }
  }

  // Notas
  if (lev.observacionesGenerales || lev.restricciones) {
    html += wSec('Notas del levantamiento');
    html += wCampo('Observaciones generales', lev.observacionesGenerales);
    html += wCampo('Restricciones especiales', lev.restricciones);
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
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th { text-align: left; }
  img { max-width: 260pt; height: auto; }
  @page { margin: 1.5cm 2cm; }
</style>
</head>
<body>${html}</body></html>`;

  const blob = new Blob(['﻿' + fullDoc], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `EFS-Levantamiento-${project.displayId}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Word de levantamiento generado ✓', 'success');
};
