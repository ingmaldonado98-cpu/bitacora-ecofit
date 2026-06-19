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
  const wImg = (src, maxW='260pt') => {
    if (!src || typeof src !== 'string') return '';
    const imgSrc = (src.startsWith('data:') || src.startsWith('http'))
      ? src : `data:image/jpeg;base64,${src}`;
    return `<img src="${imgSrc}" style="max-width:${maxW};height:auto;margin:4pt 0;display:block">`;
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
    const techoMixto = areas.some(a => a.tipTecho);
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt">
      <tr>
        <th ${TH}>Área</th>${techoMixto ? `<th ${TH}>Tipo de techo</th>` : ''}<th ${TH}>Dimensiones</th><th ${TH}>Superficie</th>
        <th ${TH}>Orientación</th><th ${TH}>Inclinación</th><th ${TH}>Pisos</th>
        <th ${TH}>Tablero→Inv.</th><th ${TH}>Inv.→Paneles</th>
      </tr>`;
    for (const a of areas) {
      const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : '—';
      const sup = (a.ancho && a.largo) ? `${(a.ancho * a.largo).toFixed(1)} m²` : (a.area ? `${a.area} m²` : '—');
      html += `<tr>
        <td ${TD}>${esc(a.nombre || '—')}</td>${techoMixto ? `<td ${TD}>${esc(a.tipTecho || '(igual al general)')}</td>` : ''}<td ${TD}>${dim}</td><td ${TD}>${sup}</td>
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
  if (lev.condicionesAmbientales?.length) {
    html += wCampo('Condiciones ambientales del sitio', lev.condicionesAmbientales.join(', '));
  }

  // Eléctrico, consumo y cargas
  const tipoSis   = project.tipoSistema || '';
  const tieneElec = !['sistema_pequeno', 'otro', 'bombeo'].includes(tipoSis);
  const tieneCFE  = tipoSis !== 'aislado';
  const recibos   = lev.recibos  || [];
  const aparatos  = lev.aparatos || [];
  const cCrit     = lev.cargasCriticas || lev.cargasRespaldo || [];
  const cSec      = lev.cargasSecundarias || [];
  const hayBaterias = lev.autonomia || lev.bancoBaterias;
  const AREAS_ORDER = ['General','Sala/Comedor','Cocina','Habitación 1','Habitación 2','Habitación 3',
                       'Baño','Cuarto de lavado','Cochera','Entrada','Patio/Jardín','Sala de máquinas','Otro'];

  if (tieneElec) {
    html += wSec('Eléctrico, consumo y cargas');

    // CFE y contrato
    if (tieneCFE && (lev.nisServicio || lev.rpu || lev.titularServicio || lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga || lev.tarifaCFE)) {
      if (lev.nisServicio)     html += wCampo('NIS (Núm. de Servicio CFE)', lev.nisServicio);
      if (lev.rpu)             html += wCampo('RPU', lev.rpu);
      if (lev.titularServicio) html += wCampo('Titular del servicio', lev.titularServicio);
      html += wCampo('Servicio CFE', lev.tipoServicioCFE);
      html += wCampo('Tierra física', lev.tierraFisica);
      html += wCampo('Centro de carga', lev.centroCarga);
      html += wCampo('Tarifa CFE', lev.tarifaCFE);
      if (lev.demandaKW)      html += wCampo('Demanda contratada', `${lev.demandaKW} kW`);
      if (lev.factorPotencia) html += wCampo('Factor de potencia', `${lev.factorPotencia}`);
      if (lev.horarioUso)     html += wCampo('Horario de uso', lev.horarioUso);
      if (lev.voltajeFaseFase || lev.voltajeFaseNeutro || lev.voltajeFaseTierra) {
        html += wCampo('Voltajes medidos', [
          lev.voltajeFaseFase   ? `Fase-fase: ${lev.voltajeFaseFase} V`     : null,
          lev.voltajeFaseNeutro ? `Fase-neutro: ${lev.voltajeFaseNeutro} V` : null,
          lev.voltajeFaseTierra ? `Fase-tierra: ${lev.voltajeFaseTierra} V` : null,
        ].filter(Boolean).join(' · '));
      }
      if (lev.capacidadInterruptorPrincipal || lev.capacidadBarrasTablero) {
        html += wCampo('Interruptor principal / Barras (busbar)',
          `${lev.capacidadInterruptorPrincipal||'—'} A / ${lev.capacidadBarrasTablero||'—'} A`);
      }
      if (typeof lev.fotoMedidor === 'string') {
        html += `<p style="font-size:9pt;color:#78888c;text-transform:uppercase;margin-bottom:2pt">Base del medidor</p>`;
        html += wImg(lev.fotoMedidor);
      }
    }

    // Recibos CFE
    if (recibos.length) {
      const conKwh = recibos.filter(r => r.kwh > 0);
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Recibos CFE</p>`;
      html += `<table style="width:100%;border-collapse:collapse">
        <tr><th ${TH}>Mes</th><th ${TH}>Año</th><th ${TH}>kWh</th><th ${TH}>Importe</th></tr>`;
      for (const r of recibos) {
        const mesLbl = r.mesLabel || (r.mes ? String(r.mes) : '—');
        html += `<tr>
          <td ${TD}>${esc(mesLbl)}</td>
          <td ${TD}>${r.anio || '—'}</td>
          <td ${TD}>${r.kwh != null ? r.kwh : '—'}</td>
          <td ${TD}>${r.importe ? `$${r.importe.toLocaleString('es-MX')}` : '—'}</td>
        </tr>`;
      }
      if (conKwh.length >= 2) {
        const avg  = Math.round(conKwh.reduce((s,r)=>s+r.kwh,0)/conKwh.length);
        const peak = conKwh.reduce((a,b)=>a.kwh>b.kwh?a:b);
        const low  = conKwh.reduce((a,b)=>a.kwh<b.kwh?a:b);
        html += `<tr style="background:#f0fdf4;font-weight:bold">
          <td ${TD} colspan="2">Promedio mensual</td><td ${TD}>${avg} kWh</td><td ${TD}></td></tr>
        <tr><td ${TD} colspan="2">Mes pico</td>
          <td ${TD}>${peak.kwh} kWh</td>
          <td ${TD}>${esc(peak.mesLabel||String(peak.mes||''))} ${peak.anio||''}</td></tr>
        <tr><td ${TD} colspan="2">Mes bajo</td>
          <td ${TD}>${low.kwh} kWh</td>
          <td ${TD}>${esc(low.mesLabel||String(low.mes||''))} ${low.anio||''}</td></tr>`;
      }
      html += '</table>';
    }

    // Aparatos por zona
    if (aparatos.length) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Consumo por zona</p>`;
      const zoneMap = {};
      aparatos.forEach(ap => { const z = ap.area||'General'; if (!zoneMap[z]) zoneMap[z]=[]; zoneMap[z].push(ap); });
      const zones = [...AREAS_ORDER.filter(z=>zoneMap[z]), ...Object.keys(zoneMap).filter(z=>!AREAS_ORDER.includes(z))];
      let totalKwhMes = 0;
      for (const zone of zones) {
        const items = zoneMap[zone];
        const zKwh  = items.reduce((s,ap)=>s+ap.potencia*ap.horas*(ap.cantidad||1)*30/1000, 0);
        totalKwhMes += zKwh;
        html += `<p style="background:#f0fdf4;padding:3pt 8pt;margin:6pt 0 2pt;font-weight:bold;font-size:10pt;color:#15803d">${esc(zone)} — ${zKwh.toFixed(0)} kWh/mes</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:4pt">
          <tr><th ${TH}>Aparato</th><th ${TH}>Cant.</th><th ${TH}>W</th><th ${TH}>Hrs/día</th><th ${TH}>kWh/mes</th></tr>`;
        for (const ap of items) {
          const kWhMes = (ap.potencia*ap.horas*(ap.cantidad||1)*30/1000).toFixed(1);
          html += `<tr>
            <td ${TD}>${esc(ap.nombre||'—')}</td><td ${TD}>${ap.cantidad||1}</td>
            <td ${TD}>${ap.potencia!=null?ap.potencia:'—'}</td>
            <td ${TD}>${ap.horas!=null?ap.horas:'—'}</td>
            <td ${TD}>${kWhMes}</td>
          </tr>`;
        }
        html += '</table>';
      }
      html += `<p style="font-weight:bold;color:#15803d;text-align:right;margin:2pt 0 8pt">Total estimado: ${totalKwhMes.toFixed(0)} kWh/mes</p>`;
    }

    // Cargas a respaldar (críticas y secundarias)
    if (cCrit.length || cSec.length) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Cargas a respaldar</p>`;
      const _wCargas = (lista, label, color, bgColor) => {
        if (!lista.length) return '';
        let tw = 0, twh = 0;
        let rows = lista.map(c => {
          const kd = (c.potencia*c.horas*(c.cantidad||1)/1000).toFixed(2);
          tw  += c.potencia*(c.cantidad||1);
          twh += c.potencia*c.horas*(c.cantidad||1);
          return `<tr>
            <td ${TD}>${esc(c.area||'General')}</td>
            <td ${TD}>${esc(c.nombre||'—')}</td>
            <td ${TD}>${c.potencia||'—'}</td>
            <td ${TD}>${c.horas||'—'}</td>
            <td ${TD}>${c.cantidad||1}</td>
            <td ${TD}>${kd}</td>
          </tr>`;
        }).join('');
        return `<p style="color:${color};font-size:10pt;margin:4pt 0 2pt;font-weight:bold">${label}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4pt">
          <tr><th ${TH}>Zona</th><th ${TH}>Equipo</th><th ${TH}>W</th><th ${TH}>Hrs/día</th><th ${TH}>Cant.</th><th ${TH}>kWh/día</th></tr>
          ${rows}
          <tr style="font-weight:bold;background:${bgColor}">
            <td ${TD} colspan="2">Total</td>
            <td ${TD}>${tw} W</td><td ${TD}></td><td ${TD}></td>
            <td ${TD}>${(twh/1000).toFixed(2)} kWh/día</td>
          </tr>
        </table>`;
      };
      html += _wCargas(cCrit, 'Cargas críticas (alta prioridad)', '#dc2626', '#fef2f2');
      html += _wCargas(cSec,  'Cargas secundarias (baja prioridad)', '#2563eb', '#eff6ff');
    }

    // Configuración de baterías
    if (hayBaterias) {
      html += `<p style="font-weight:bold;margin:10pt 0 4pt">Configuración de baterías</p>`;
      html += wCampo('Autonomía requerida', lev.autonomia ? `${lev.autonomia} horas` : null);
      html += wCampo('Banco de baterías', lev.bancoBaterias ? `${lev.bancoBaterias} kWh` : null);
    }

    // Off-grid específico
    if (tipoSis === 'aislado') {
      if (lev.generador && lev.generador !== 'no') {
        html += wCampo('Generador de respaldo', `${lev.generador} — ${lev.generadorArranque||'manual'}${lev.generadorKw ? ` · ${lev.generadorKw} kW` : ''}`);
      }
      if (lev.crecimientoFuturo) html += wCampo('Crecimiento futuro esperado', lev.crecimientoFuturo);
    }
  }

  // Sistema eléctrico DC (sistema pequeño)
  if (tipoSis === 'sistema_pequeno') {
    html += wSec('Sistema eléctrico DC');
    if (lev.voltajeSistemaDC)      html += wCampo('Voltaje del sistema', lev.voltajeSistemaDC);
    if (lev.tipoControlador)       html += wCampo('Tipo de regulación de carga', lev.tipoControlador);
    if (lev.distPanelRefrigerador) html += wCampo('Dist. panel→batería/refrigerador', `${lev.distPanelRefrigerador} m`);
    if (lev.calibreCableDC)        html += wCampo('Calibre de cable DC', lev.calibreCableDC);
    if (lev.exposicionTempExtrema) html += wCampo('Exposición a temperatura extrema', lev.exposicionTempExtrema === 'si' ? 'Sí' : 'No');
    if (lev.bateria)               html += wCampo('Batería', lev.bateria);
    if (lev.mppt)                  html += wCampo('Controlador MPPT/PWM', lev.mppt);
    if (lev.inversor)              html += wCampo('Inversor', lev.inversor);
    if (lev.breakerPanel)          html += wCampo('Breaker de paneles', lev.breakerPanel);
    if (lev.breakerPolo)           html += wCampo('Breaker 1 polo', lev.breakerPolo);
  }

  // Logística de instalación
  if (lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor || lev.logisticaNotas) {
    html += wSec('Logística de instalación');
    html += wCampo('Ruta de acceso al techo', lev.accesoTecho);
    html += wCampo('Almacenamiento temporal', lev.almacenamientoTemporal);
    html += wCampo('Conectividad en ubicación del inversor', lev.conectividadInversor);
    if (lev.logisticaNotas) html += wCampo('Notas de logística', lev.logisticaNotas);
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
