// word-tecnico.js — Word Técnico (.doc) para archivo interno
// Extraído de pdf-tecnico.js — misma data que el PDF Técnico pero como HTML/Word,
// sin ninguna dependencia de jsPDF (pdf-helpers.js).

import { projects } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA, ESTADOS } from './utils.js';
import { CHECKLIST_RAPIDO, CHECKLIST_FORMAL, MEDICIONES } from './aud-data.js';
import { getSerialesFlat } from './gar-paneles.js';

const ESTADOS_LABEL = Object.fromEntries(Object.entries(ESTADOS).map(([k,v]) => [k, v.label]));

window.exportarWordTecnico = async function(projectId) {
  const project = await projects.getById(projectId);
  if (!project) { const { toast } = await import('./utils.js'); toast('Proyecto no encontrado', 'error'); return; }

  const sec   = (id) => document.getElementById(id)?.checked;
  const tipo  = TIPOS_SISTEMA[project.tipoSistema];
  const totalPaneles = getSerialesFlat(project.garantia).length;
  const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp||0)/1000);

  const wImg = (src, maxW='280pt') => {
    if (!src || typeof src !== 'string') return '';
    const imgSrc = (src.startsWith('data:') || src.startsWith('http'))
      ? src : `data:image/jpeg;base64,${src}`;
    return `<img src="${imgSrc}" style="max-width:${maxW};height:auto;margin:4pt 0;display:block">`;
  };
  const wCampo = (label, value) =>
    `<p style="margin:0 0 8pt"><small style="color:#78888c;text-transform:uppercase;font-size:8pt">${esc(label)}</small><br><span style="font-size:11pt">${esc(String(value||'—'))}</span></p>`;
  const wSec = (title) =>
    `<h2 style="color:#40916C;font-size:13pt;margin:18pt 0 8pt;border-bottom:1px solid #d0e4d8;padding-bottom:4pt">${esc(title)}</h2>`;
  const wPage = () => '<div style="page-break-after:always"></div>';

  const TH = 'style="background:#1B4332;color:white;padding:5pt 8pt;text-align:left"';
  const TD = 'style="padding:5pt 8pt;border:1px solid #d0e4d8"';

  let html = `
<h1 style="color:#1B4332;font-size:18pt;border-bottom:3px solid #40916C;padding-bottom:6pt">Expediente Técnico — Uso Interno</h1>
<table style="width:100%;border:none;margin-bottom:16pt">
  <tr>
    <td style="border:none;font-size:14pt;font-weight:bold;color:#1B4332">${esc(project.displayId)}</td>
    <td style="border:none;text-align:right;color:#78888c;font-size:9pt">Generado: ${fmtFecha(new Date().toISOString())}</td>
  </tr>
</table>
${wCampo('Cliente', project.clientName)}
${project.direccion ? wCampo('Dirección', project.direccion) : ''}
${(project.ciudad || project.estadoDireccion) ? wCampo('Ciudad / Estado', [project.ciudad, project.estadoDireccion].filter(Boolean).join(', ')) : ''}
${project.coordenadas?.lat ? wCampo('Coordenadas GPS', `${Number(project.coordenadas.lat).toFixed(6)}, ${Number(project.coordenadas.lng).toFixed(6)}`) : ''}
${project.clienteTelefono ? wCampo('Tel. cliente', project.clienteTelefono) : ''}
${wCampo('Tipo de sistema', tipo?.label || project.tipoSistema)}
${wCampo('Estado', ESTADOS_LABEL[project.estado] || project.estado)}
${wCampo('Capacidad', `${totalKwp.toFixed(2)} kWp · ${totalPaneles} paneles`)}
${project.fechaEstimada ? wCampo('Fecha estimada entrega', fmtFecha(project.fechaEstimada)) : ''}
${project.notas ? `<p style="margin:0 0 8pt"><small style="color:#78888c;text-transform:uppercase;font-size:8pt">NOTAS INTERNAS</small><br><em style="font-size:10pt">${esc(project.notas)}</em></p>` : ''}
`;

  // Equipos
  if (sec('sec-equipos')) {
    const equipos = project.garantia?.equipos || [];
    if (equipos.length) {
      html += wPage() + wSec('Equipos con números de serie');
      html += `<table style="width:100%;border-collapse:collapse"><tr><th ${TH}>Equipo</th><th ${TH}>Serial</th><th ${TH}>Notas</th></tr>`;
      for (const eq of equipos) {
        html += `<tr><td ${TD}>${esc(eq.marca)} ${esc(eq.modelo)}</td><td ${TD} style="font-family:monospace">${esc(eq.serial||'—')}</td><td ${TD}>${esc(eq.notas||'')}</td></tr>`;
      }
      html += '</table>';
      for (const eq of equipos) {
        if (eq.fotoPlaca || eq.fotoFrontal) {
          html += `<p style="margin-top:8pt;font-weight:bold;color:#40916C">${esc(eq.marca)} ${esc(eq.modelo)}</p>`;
          if (eq.fotoPlaca)   html += wImg(eq.fotoPlaca);
          if (eq.fotoFrontal) html += wImg(eq.fotoFrontal);
        }
      }
    }
  }

  // Estructura
  if (sec('sec-estructura')) {
    const est = project.garantia?.estructura;
    if (est) {
      html += wPage() + wSec('Estructura de montaje');
      html += wCampo('Marca', est.marca);
      html += wCampo('Sistema estructural', est.sistemaEstructural);
      html += wCampo('Modelo', est.modelo);
      html += wCampo('No. Lote', est.numLote);
      html += wCampo('Metros de riel', `${est.metrosRiel}m · Fijación: ${est.tipoFijacion}`);
      html += wCampo('Clamps', `Mid: ${est.midClamps} pzas · End: ${est.endClamps} pzas`);
      if (est.fotoFrontal) html += wImg(est.fotoFrontal);
    }
  }

  // Paneles — números de serie
  if (sec('sec-paneles')) {
    const pan = project.garantia?.paneles;
    html += wPage() + wSec('Paneles — Números de serie');
    html += `<p style="font-weight:bold">${esc(pan?.marca||'')} ${esc(pan?.modelo||'')} · ${pan?.wp||0}Wp</p>`;
    const seriales = getSerialesFlat(project.garantia);
    if (seriales.length) {
      const TH2 = 'style="background:#52B788;color:white;padding:4pt 8pt;text-align:left"';
      html += `<table style="width:60%;border-collapse:collapse"><tr><th ${TH2}>Panel</th><th ${TH2}>Serial</th></tr>`;
      seriales.forEach((p,i) => {
        html += `<tr><td ${TD}>Panel ${i+1}</td><td ${TD} style="font-family:monospace">${esc(p.serial||'—')}</td></tr>`;
      });
      html += '</table>';
    }
  }

  // Levantamiento
  if (sec('sec-levant')) {
    const lev = project.documentacion?.levantamiento || {};
    html += wPage() + wSec('Levantamiento técnico');
    if (lev.estadoInmueble) html += wCampo('Estado del inmueble', lev.estadoInmueble);
    html += wCampo('Área disponible', lev.areaDisponible ? `${lev.areaDisponible} m²` : '—');

    // Áreas del techo (orientación/inclinación/pisos/distancias viven por área)
    const areasLev = lev.areasTecho || [];
    if (areasLev.length) {
      const techoMixtoW = areasLev.some(a => a.tipTecho);
      html += `<p style="font-weight:bold;color:#40916C;margin-top:8pt">Áreas del techo</p>`;
      html += `<table style="width:100%;border-collapse:collapse"><tr>
        <th ${TH}>Área</th>${techoMixtoW ? `<th ${TH}>Tipo de techo</th>` : ''}<th ${TH}>Dimensiones</th><th ${TH}>Orientación</th>
        <th ${TH}>Inclinación</th><th ${TH}>Pisos</th>
        <th ${TH}>Tablero→Inv.</th><th ${TH}>Inv.→Paneles</th>
      </tr>`;
      for (const a of areasLev) {
        const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : (a.area ? `${a.area} m²` : '—');
        html += `<tr>
          <td ${TD}>${esc(a.nombre || '—')}</td>${techoMixtoW ? `<td ${TD}>${esc(a.tipTecho || '(igual al general)')}</td>` : ''}<td ${TD}>${dim}</td>
          <td ${TD}>${esc(a.orientacion || '—')}</td>
          <td ${TD}>${a.inclinacion != null ? `${a.inclinacion}°` : '—'}</td>
          <td ${TD}>${a.pisos != null ? a.pisos : '—'}</td>
          <td ${TD}>${a.distTableroInversor != null ? `${a.distTableroInversor} m` : '—'}</td>
          <td ${TD}>${a.distInversorPaneles != null ? `${a.distInversorPaneles} m` : '—'}</td>
        </tr>`;
      }
      html += '</table>';
      for (const a of areasLev) {
        const efectivo = a.tipTecho || lev.tipTecho;
        if (efectivo === 'Losa de concreto' && a.grosorLosa) {
          html += `<p style="font-size:9pt;color:#6b7280;margin:2pt 0">${esc(a.nombre || 'Área')} — Grosor de losa: ${a.grosorLosa} cm</p>`;
        } else if (efectivo === 'Madera' && (a.estadoMadera || a.distVigas)) {
          html += `<p style="font-size:9pt;color:#6b7280;margin:2pt 0">${esc(a.nombre || 'Área')} — Estado de la madera: ${esc(a.estadoMadera || '—')}; Distancia entre vigas: ${a.distVigas ? `${a.distVigas} cm` : '—'}</p>`;
        } else if ((efectivo === 'Lámina' || efectivo === 'Carport') && (a.tipoPTR || a.calibrePTR || a.grosorPTRmm || a.distVigas)) {
          html += `<p style="font-size:9pt;color:#6b7280;margin:2pt 0">${esc(a.nombre || 'Área')} — Tipo de PTR: ${esc(a.tipoPTR || '—')}; Calibre: ${esc(a.calibrePTR || '—')}${a.grosorPTRmm ? ` (${a.grosorPTRmm} mm)` : ''}; Distancia entre PTR: ${a.distVigas ? `${a.distVigas} cm` : '—'}</p>`;
        }
        if (a.posicionReferencia || a.puntoReferencia) {
          html += `<p style="font-size:9pt;color:#6b7280;margin:2pt 0">${esc(a.nombre || 'Área')} — Punto de partida: ${esc(a.posicionReferencia || '—')}${a.puntoReferencia ? ` — ${esc(a.puntoReferencia)}` : ''}</p>`;
        }
      }
    }

    html += wCampo('Servicio CFE', lev.tipoServicioCFE);
    html += wCampo('Tierra física', lev.tierraFisica);
    html += wCampo('Centro de carga', lev.centroCarga);
    const voltajesTxtW = [
      lev.voltajeFaseFaseL1L2 ? `Fase-fase L1-L2: ${lev.voltajeFaseFaseL1L2} V` : null,
      lev.voltajeFaseFaseL2L3 ? `Fase-fase L2-L3: ${lev.voltajeFaseFaseL2L3} V` : null,
      lev.voltajeFaseFaseL1L3 ? `Fase-fase L1-L3: ${lev.voltajeFaseFaseL1L3} V` : null,
      lev.voltajeFaseNeutroL1 ? `Fase-neutro L1: ${lev.voltajeFaseNeutroL1} V` : null,
      lev.voltajeFaseNeutroL2 ? `Fase-neutro L2: ${lev.voltajeFaseNeutroL2} V` : null,
      lev.voltajeFaseNeutroL3 ? `Fase-neutro L3: ${lev.voltajeFaseNeutroL3} V` : null,
      lev.voltajeNeutroTierra ? `Neutro-tierra: ${lev.voltajeNeutroTierra} V`  : null,
    ].filter(Boolean);
    if (voltajesTxtW.length) html += wCampo('Voltajes medidos', voltajesTxtW.join(' · '));
    if (lev.capacidadInterruptorPrincipal || lev.capacidadBarrasTablero) {
      html += wCampo('Interruptor principal / Barras (busbar)',
        `${lev.capacidadInterruptorPrincipal||'—'} A / ${lev.capacidadBarrasTablero||'—'} A`);
    }
    if (lev.sombras?.checklist?.length) html += wCampo('Obstáculos de sombra', lev.sombras.checklist.join(', '));
    if (lev.condicionesAmbientales?.length) html += wCampo('Condiciones ambientales', lev.condicionesAmbientales.join(', '));
    if (project.tipoSistema === 'sistema_pequeno') {
      html += `<p style="font-weight:bold;color:#40916C;margin-top:8pt">Sistema eléctrico DC</p>`;
      if (lev.voltajeSistemaDC)      html += wCampo('Voltaje del sistema', lev.voltajeSistemaDC);
      if (lev.tipoControlador)       html += wCampo('Tipo de regulación', lev.tipoControlador);
      if (lev.arregloPaneles)        html += wCampo('Arreglo de paneles', lev.arregloPaneles);
      if (lev.arregloBaterias)       html += wCampo('Arreglo de baterías', lev.arregloBaterias);
      if (lev.alimentacionRefrigerador) html += wCampo('Alimentación del refrigerador',
        lev.alimentacionRefrigerador === 'inversor_bateria'
          ? 'Vía inversor desde batería (CA)' : 'Directo desde salida LOAD del controlador (DC)');
      if (lev.distPanelRefrigerador) html += wCampo('Dist. panel→refrigerador', `${lev.distPanelRefrigerador} m`);
      if (lev.calibreCableDC)        html += wCampo('Calibre de cable DC', lev.calibreCableDC);
      if (lev.bateria)               html += wCampo('Batería', lev.bateria);
      if (lev.breakerBateria)        html += wCampo('Breaker de batería', lev.breakerBateria);
      if (lev.mppt)                  html += wCampo('Controlador MPPT/PWM', lev.mppt);
      if (lev.potenciaInversorW || lev.inversor) {
        html += wCampo('Inversor', [
          lev.potenciaInversorW ? `${lev.potenciaInversorW} W` : null,
          lev.inversor || null,
        ].filter(Boolean).join(' — '));
      }
      if (lev.breakerPanel)          html += wCampo('Breaker de paneles', lev.breakerPanel);
      if (lev.breakerPolo)           html += wCampo('Breaker 1 polo', lev.breakerPolo);
    }
    if (lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor) {
      if (lev.accesoTecho)            html += wCampo('Ruta de acceso al techo', lev.accesoTecho);
      if (lev.almacenamientoTemporal) html += wCampo('Almacenamiento temporal', lev.almacenamientoTemporal);
      if (lev.conectividadInversor)   html += wCampo('Conectividad en inversor', lev.conectividadInversor);
    }
    if (lev.observacionesGenerales) {
      html += `<p><small style="color:#78888c;text-transform:uppercase;font-size:8pt">OBSERVACIONES</small><br>${esc(lev.observacionesGenerales)}</p>`;
    }
    const fotosLev = lev.fotosLevantamiento || [];
    if (fotosLev.length) {
      html += `<p style="font-weight:bold;color:#40916C;margin-top:12pt">Fotos del levantamiento</p>`;
      for (const f of fotosLev.slice(0,6)) html += wImg(f.url||f);
    }
  }

  // Validación Voc
  if (sec('sec-voc')) {
    const vocData = project.garantia?.validacionVoc;
    if (vocData?.resultado) {
      html += wPage() + wSec('Validación Voc de string');
      const resLabel = vocData.resultado==='seguro' ? 'SEGURO ✓' : vocData.resultado==='limite' ? 'EN EL LÍMITE ⚠' : 'EXCEDE EL LÍMITE ✗';
      const resColor = vocData.resultado==='seguro' ? '#1e7840' : vocData.resultado==='limite' ? '#b48c00' : '#c82828';
      html += `<p style="font-weight:bold;font-size:13pt;color:${resColor}">${resLabel}</p>`;
      html += wCampo('Voc del panel', `${vocData.vocPanel} V`);
      html += wCampo('Paneles en serie', `${vocData.panelesSerie}`);
      html += wCampo('Temp. mínima sitio', `${vocData.tMin}°C`);
      html += wCampo('Coef. temp. Voc', `${vocData.coefVoc}%/°C`);
      html += wCampo('Voc corregido por temp.', `${vocData.vocCorregido?.toFixed(2)} V`);
      html += wCampo('Voc total del string', `${vocData.vocString?.toFixed(2)} V`);
      html += wCampo('Voc máx. inversor', `${vocData.vocMaxInversor} V`);
      html += wCampo('Margen de seguridad', `${vocData.margen?.toFixed(1)}%`);
      if (vocData.mensaje) html += `<p style="font-style:italic;color:${resColor}">${esc(vocData.mensaje)}</p>`;
    }
  }

  // Torque
  if (sec('sec-torque')) {
    const torqueData = project.checklistData?.torque || {};
    const torqueKeys = Object.keys(torqueData);
    if (torqueKeys.length) {
      html += wPage() + wSec('Registro de torque metrológico');
      html += `<table style="width:100%;border-collapse:collapse"><tr><th ${TH}>Componente</th><th ${TH} style="text-align:center">Ver.</th><th ${TH}>Especif.</th><th ${TH}>Aplicado</th></tr>`;
      for (const key of torqueKeys) {
        const t = torqueData[key];
        if (!t) continue;
        html += `<tr><td ${TD}>${esc(t.componente||key)}</td><td ${TD} style="text-align:center">${t.verificado?'✓':'○'}</td><td ${TD}>${esc(t.especif||'—')}</td><td ${TD}>${t.aplicado!=null?`${t.aplicado} N·m`:'—'}</td></tr>`;
      }
      html += '</table>';
    }
  }

  // Fotos por fase
  const _fasesDoc = project.documentacion?.fases || {};
  const _getFasesFotos = (legacy, sitio, sub) => {
    if (_fasesDoc[sitio]?.[sub]?.length) return _fasesDoc[sitio][sub];
    return _fasesDoc[legacy] || [];
  };
  for (const [id, legacy, sitio, sub, titulo] of [
    ['sec-antes',   'antes',   'techo', 'antes',   'Fotos: Antes'],
    ['sec-durante', 'durante', 'techo', 'durante', 'Fotos: Durante'],
    ['sec-despues', 'despues', 'techo', 'cierre',  'Fotos: Cierre'],
  ]) {
    if (!sec(id)) continue;
    const fotos = _getFasesFotos(legacy, sitio, sub);
    if (!fotos.length) continue;
    html += wPage() + wSec(titulo);
    for (const f of fotos) {
      if (f.nota) html += `<p style="font-size:9pt;color:#78888c;margin-bottom:2pt">${esc(f.nota)}</p>`;
      html += wImg(f.data);
    }
  }

  // Fotos técnicas
  if (sec('sec-fotos-tec')) {
    const ft = project.garantia?.fotosTecnicas || {};
    const normFT = v => { if (!v) return []; if (typeof v==='string') return [{url:v}]; return Array.isArray(v)?v:[]; };
    const slots = [
      { key:'tableroAC',          label:'Tablero AC terminado'    },
      { key:'tableroDC',          label:'Tablero DC terminado'    },
      { key:'protecciones',       label:'Protecciones instaladas' },
      { key:'inversorEnergizado', label:'Inversor energizado'     },
      { key:'puestaATierra',      label:'Puesta a tierra'         },
      { key:'etiquetado',         label:'Etiquetado'              },
    ].filter(s => normFT(ft[s.key]).length);
    if (slots.length) {
      html += wPage() + wSec('Fotos técnicas de instalación');
      for (const s of slots) {
        const fotos = normFT(ft[s.key]);
        for (let fi=0; fi<fotos.length; fi++) {
          const lbl = fotos.length>1 ? `${s.label} (${fi+1}/${fotos.length})` : s.label;
          html += `<p style="font-size:9pt;color:#78888c;text-transform:uppercase;margin-bottom:2pt">${esc(lbl)}</p>`;
          html += wImg(fotos[fi].url||fotos[fi]);
        }
      }
    }
  }

  // Observaciones
  if (sec('sec-observ')) {
    const obs = project.observaciones || [];
    if (obs.length) {
      html += wPage() + wSec('Observaciones del proyecto');
      for (const o of obs) {
        const priorColor = o.resuelta ? '#40916C' : (o.prioridad==='alta'?'#c82828':(o.prioridad==='media'?'#b48c00':'#2d372d'));
        const estado = o.resuelta ? 'RESUELTA' : (o.prioridad||'normal').toUpperCase();
        html += `<div style="border-left:3px solid ${priorColor};padding:6pt 10pt;margin-bottom:8pt;background:#f8faf8">`;
        html += `<p style="margin:0 0 2pt;font-size:9pt;color:${priorColor};font-weight:bold">[${estado}] ${esc(o.autorNombre||'—')} · ${fmtFecha(o.timestamp)}</p>`;
        html += `<p style="margin:0;font-size:10pt">${esc(o.texto||'')}</p>`;
        if (o.resuelta && o.resueltaPor) {
          html += `<p style="margin:4pt 0 0;font-size:8pt;color:#40916C">✓ Resuelta por ${esc(o.resueltaPor)} · ${fmtFecha(o.resueltaAt)}${o.resueltaNota?` — ${esc(o.resueltaNota)}`:''}</p>`;
        }
        html += '</div>';
      }
    }
  }

  // Historial
  if (sec('sec-historial')) {
    const log = project.statusLog || [];
    if (log.length) {
      html += wPage() + wSec('Historial de cambios de estado');
      html += `<table style="width:100%;border-collapse:collapse"><tr><th ${TH}>De</th><th ${TH}>A</th><th ${TH}>Por</th><th ${TH}>Fecha</th><th ${TH}>Nota</th></tr>`;
      [...log].reverse().forEach(e => {
        const fromL = ESTADOS_LABEL[e.from]||e.from;
        const toL   = ESTADOS_LABEL[e.to]  ||e.to;
        html += `<tr><td ${TD}>${esc(fromL)}</td><td ${TD} style="font-weight:bold">${esc(toL)}</td><td ${TD}>${esc(e.by||'—')}</td><td ${TD}>${fmtFecha(e.at)}</td><td ${TD}>${esc(e.nota||'')}</td></tr>`;
      });
      html += '</table>';
    }
  }

  // Auditoría
  if (sec('sec-auditoria') && project.auditoria?.resultado) {
    const aud = project.auditoria;
    html += wPage() + wSec('Auditoría técnica');
    html += wCampo('Tipo', aud.tipo==='interna'?'Interna Ecofit':'Externa');
    html += wCampo('Auditor', aud.auditor?.nombre);
    if (aud.auditor?.empresa) html += wCampo('Empresa', aud.auditor.empresa);
    html += wCampo('Norma', aud.norma);
    html += wCampo('Resultado', aud.resultado?.replace(/_/g,' ').toUpperCase());

    const esFormalW   = aud.modo === 'formal';
    const itemsAudW   = esFormalW ? CHECKLIST_FORMAL : CHECKLIST_RAPIDO;
    const resultsAudW = esFormalW ? (aud.formalChecklist||{}) : (aud.rapidoChecklist||{});
    const obsAudW     = aud.formalObs || {};
    html += `<p style="font-weight:bold;margin-top:12pt">Checklist técnico (${esFormalW?'Formal':'Rápido'})</p>`;
    html += `<table style="width:100%;border-collapse:collapse"><tr><th ${TH}>Ítem</th><th ${TH} style="text-align:center">Resultado</th></tr>`;
    for (const item of itemsAudW) {
      const r    = resultsAudW[item.id];
      const ok   = r==='ok' || r==='si';
      const nc   = r==='no_cumple' || r==='no';
      const mark  = ok ? '✓ OK' : nc ? '✗ No cumple' : r==='na' ? 'N/A' : '—';
      const color = ok ? '#1e7840' : nc ? '#c82828' : '#78888c';
      html += `<tr><td ${TD}>${esc(item.label)}${obsAudW[item.id] ? `<br><small style="color:#78888c">${esc(obsAudW[item.id])}</small>` : ''}</td><td ${TD} style="text-align:center;color:${color};font-weight:bold">${mark}</td></tr>`;
    }
    html += '</table>';

    const medW     = aud.mediciones || {};
    const medValsW = MEDICIONES.filter(m => medW[m.id]);
    if (medValsW.length) {
      html += `<p style="font-weight:bold;margin-top:12pt">Mediciones</p>`;
      html += `<table style="width:100%;border-collapse:collapse"><tr><th ${TH}>Medición</th><th ${TH}>Valor</th><th ${TH}>Referencia</th></tr>`;
      for (const m of medValsW) {
        html += `<tr><td ${TD}>${esc(m.label)}</td><td ${TD}>${esc(medW[m.id])} ${esc(m.unit)}</td><td ${TD}>${esc(m.ref)}</td></tr>`;
      }
      html += '</table>';
    }

    if (aud.observaciones) html += `<p><small style="color:#78888c;text-transform:uppercase;font-size:8pt">OBSERVACIONES</small><br>${esc(aud.observaciones)}</p>`;
    if (aud.docFirmado) html += wImg(aud.docFirmado, '400pt');
  }

  html += `<hr style="margin-top:24pt;border-color:#d0e4d8">
<p style="font-size:8pt;color:#78888c;text-align:center">Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}</p>`;

  const fullDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><meta name="ProgId" content="Word.Document">
<style>
  body { font-family: Calibri, 'Segoe UI', sans-serif; font-size: 11pt; color: #2d372d; margin: 24pt 32pt; line-height: 1.4; }
  h1, h2, h3 { font-family: Calibri, 'Segoe UI', sans-serif; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  img { max-width: 300pt; height: auto; }
  @page { margin: 1.5cm 2cm; }
</style>
</head>
<body>${html}</body></html>`;

  const blob = new Blob(['﻿' + fullDoc], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `EFS-Tecnico-${project.displayId}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  const { toast } = await import('./utils.js');
  toast('Word generado ✓', 'success');
};
