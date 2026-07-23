// pdf-tecnico.js — PDF Técnico para archivo interno
// Extraído de pdf.js. Registra window.exportarPDFTecnico.
// La versión Word de este mismo expediente vive en word-tecnico.js (sin jsPDF).

import { projects } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA, ESTADOS } from './utils.js';
import {
  newDoc, getLogoB64, addHeader, addFooter, campo, addImage,
  savePDF, pdfYield, btnLoading, btnDone,
  VERDE, VERDE_MED, GRIS, GRIS_CLR,
} from './pdf-helpers.js';
import { checklistRapidoPara, checklistFormalPara, MEDICIONES } from './aud-data.js';
import { getSerialesFlat } from './gar-paneles.js';
import { getExecBlocks, BLOQUE_LABELS } from '../modules/checklist/index.js';
import { MESES_CORTO } from './lev-consumo.js';
import { calcDimensionamiento, detectarRiesgos } from '../modules/dimensionamiento/index.js';
import { buildDimRows, MOD_LABELS } from './dimensionamiento.js';
import { getRowsData, getPanelWidth, getPanelHeight, buildDiagramSVG } from '../modules/calculadora/index.js';
import { withExplicitSize, svgToPngDataUri } from './pdf-calculadora.js';

const ESTADOS_LABEL = Object.fromEntries(Object.entries(ESTADOS).map(([k,v]) => [k, v.label]));

// ── PDF Técnico ───────────────────────────────────────────────────────────────
window.exportarPDFTecnico = async function(projectId) {
  const btn = document.querySelector('.pdf-card:last-child .btn-primary');
  btnLoading(btn, 'Generando…');
  const { toast } = await import('./utils.js');
  toast('Generando PDF técnico…', 'info', 0);
  await pdfYield();
  try {
    const [project] = await Promise.all([projects.getById(projectId), getLogoB64()]);
    const doc = await newDoc(); if (!doc) return;

    const sec = (id) => document.getElementById(id)?.checked;
    const tipo = TIPOS_SISTEMA[project.tipoSistema];
    const totalPaneles = getSerialesFlat(project.garantia).length;
    const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp||0)/1000);

    addHeader(doc, 'Expediente técnico — Uso interno', project);
    let y = 44;

    // Datos del proyecto
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...VERDE);
    doc.text(project.displayId, 14, y); y += 7;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text(project.clientName || '—', 14, y); y += 6;
    if (project.direccion) { doc.text(project.direccion, 14, y); y += 6; }
    if (project.ciudad || project.estadoDireccion) {
      doc.text([project.ciudad, project.estadoDireccion].filter(Boolean).join(', '), 14, y); y += 6;
    }
    if (project.coordenadas?.lat) {
      const lat = Number(project.coordenadas.lat).toFixed(6);
      const lng = Number(project.coordenadas.lng).toFixed(6);
      y = campo(doc, 'Coordenadas GPS', `${lat}, ${lng}`, 14, y);
    }
    if (project.clienteTelefono) y = campo(doc, 'Tel. cliente', project.clienteTelefono, 14, y);
    y = campo(doc,'Tipo de sistema',tipo?.label||'—',14,y);
    y = campo(doc,'Estado', ESTADOS_LABEL[project.estado] || project.estado, 14,y);
    y = campo(doc,'Capacidad',`${totalKwp.toFixed(2)} kWp · ${totalPaneles} paneles`,14,y);
    if (project.fechaEstimada) y = campo(doc,'Fecha estimada entrega',fmtFecha(project.fechaEstimada),14,y);
    if (project.notas) {
      y += 2;
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      doc.text('Notas internas:', 14, y); y += 5;
      doc.setFont('helvetica','normal');
      const notasLines = doc.splitTextToSize(project.notas, 180);
      doc.text(notasLines, 14, y);
      y += notasLines.length * 5 + 4;
    }

    // Equipos con seriales
    if (sec('sec-equipos')) {
      doc.addPage(); addHeader(doc,'Equipos con números de serie',project); y=44;
      for (const eq of (project.garantia?.equipos||[])) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE_MED);
        doc.text(`${eq.marca} · ${eq.modelo}`, 14, y); y+=5;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(`Serial: ${eq.serial||'—'}`, 18, y); y+=5;
        if (eq.notas) { doc.text(`Notas: ${eq.notas}`, 18, y); y+=5; }
        if (eq.fotoPlaca)  { y = await addImage(doc,eq.fotoPlaca,18,y,60,45); }
        if (eq.fotoFrontal){ y = await addImage(doc,eq.fotoFrontal,82,y-45,60,45); y+=4; }
        if (y > 240) { doc.addPage(); addHeader(doc,'Equipos (cont.)',project); y=44; }
      }
    }

    // Estructura
    if (sec('sec-estructura')) {
      const est = project.garantia?.estructura;
      if (est) {
        doc.addPage(); addHeader(doc,'Estructura de montaje',project); y=44;
        y=campo(doc,'Marca',est.marca,14,y);
        y=campo(doc,'Sistema',est.sistemaEstructural,14,y);
        y=campo(doc,'Modelo',est.modelo,14,y);
        y=campo(doc,'No. Lote',est.numLote,14,y);
        y=campo(doc,'Metros riel',`${est.metrosRiel}m · Fijación: ${est.tipoFijacion}`,14,y);
        y=campo(doc,'Clamps',`Mid: ${est.midClamps} pzas · End: ${est.endClamps} pzas`,14,y);
        if (est.fotoFrontal) { y=await addImage(doc,est.fotoFrontal,14,y,90,65); }
      }
    }

    // Materiales (BOM) — calculado en la Calculadora, no el formulario manual de Garantía
    const cfg = project.projectConfig;
    if (sec('sec-bom') && cfg?.computed?.bom?.length) {
      doc.addPage(); addHeader(doc,'Materiales (BOM)',project); y=44;
      const grupos = {};
      for (const it of cfg.computed.bom) (grupos[it.grp || 'Otros'] = grupos[it.grp || 'Otros'] || []).push(it);
      for (const [grp, items] of Object.entries(grupos)) {
        if (y>250) { doc.addPage(); addHeader(doc,'Materiales (cont.)',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text(grp.toUpperCase(), 14, y); y += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        for (const it of items) {
          if (y>260) { doc.addPage(); addHeader(doc,'Materiales (cont.)',project); y=44; }
          doc.text(`${it.name} (${it.partNum}) — ${it.qty} ${it.unit}`, 14, y); y += 4.5;
        }
        y += 3;
      }
      const consumibles = cfg.computed.consumibles || [];
      if (consumibles.length) {
        if (y>250) { doc.addPage(); addHeader(doc,'Materiales (cont.)',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('CONSUMIBLES', 14, y); y += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        for (const c of consumibles) {
          doc.text(`${c.nombre} — ${c.qty} ${c.unit}`, 14, y); y += 4.5;
        }
      }
    }

    // Diagrama de diseño — rasterizado desde el mismo SVG que ve el técnico en la Calculadora
    if (sec('sec-diagrama') && cfg?.estructura) {
      try {
        const rd = getRowsData(cfg);
        const pW = getPanelWidth(cfg), pH = getPanelHeight(cfg);
        if (rd.length && pW && pH) {
          const rawSvg = buildDiagramSVG(rd, pW, pH, cfg.estructura);
          const { svgString, width, height } = withExplicitSize(rawSvg);
          const { dataUri } = await svgToPngDataUri(svgString, width, height);
          doc.addPage(); addHeader(doc,'Diagrama de diseño',project); y=44;
          const maxW = 180, maxH = maxW * height / width;
          doc.addImage(dataUri, 'PNG', 14, y, maxW, maxH);
        }
      } catch { /* sin diagrama si falla la rasterización */ }
    }

    // Paneles — números de serie
    if (sec('sec-paneles')) {
      doc.addPage(); addHeader(doc,'Paneles — Números de serie',project); y=44;
      const pan = project.garantia?.paneles;
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...GRIS);
      doc.text(`${pan?.marca||''} ${pan?.modelo||''} · ${pan?.wp||0}Wp`, 14, y); y+=8;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      getSerialesFlat(project.garantia).forEach((p,i) => {
        const col = i%2, fx = 14+col*93;
        if (col===0 && i>0) y+=5;
        doc.text(`Panel ${i+1}: ${p.serial||'—'}`, fx, y);
        if (col===1) y+=5;
        if (y>260) { doc.addPage(); addHeader(doc,'Paneles (cont.)',project); y=44; }
      });
    }

    // Levantamiento
    if (sec('sec-levant')) {
      doc.addPage(); addHeader(doc,'Levantamiento técnico',project); y=44;
      const lev = project.documentacion?.levantamiento||{};
      if (lev.estadoInmueble) y=campo(doc,'Estado del inmueble',lev.estadoInmueble,14,y);
      y=campo(doc,'Área disponible',lev.areaDisponible?`${lev.areaDisponible} m²`:'—',14,y);

      // Áreas del techo (orientación/inclinación/pisos/distancias viven por área)
      const areasLev = lev.areasTecho || [];
      if (areasLev.length) {
        if (y>240) { doc.addPage(); addHeader(doc,'Levantamiento técnico (cont.)',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('Áreas del techo', 14, y); y += 6;
        for (const a of areasLev) {
          if (y>250) { doc.addPage(); addHeader(doc,'Levantamiento técnico (cont.)',project); y=44; }
          const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : (a.area ? `${a.area} m²` : '—');
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GRIS);
          doc.text(`${a.nombre || 'Área'}${a.tipTecho ? ` (${a.tipTecho})` : ''}`, 14, y); y += 5;
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS_CLR);
          doc.text(`Dim: ${dim} · Orientación: ${a.orientacion||'—'} · Inclinación: ${a.inclinacion!=null?`${a.inclinacion}°`:'—'} · Pisos: ${a.pisos!=null?a.pisos:'—'}`, 14, y); y += 4;
          doc.text(`Tablero→Inv.: ${a.distTableroInversor!=null?`${a.distTableroInversor} m`:'—'} · Inv.→Paneles: ${a.distInversorPaneles!=null?`${a.distInversorPaneles} m`:'—'}`, 14, y); y += 4;
          const efectivoA = a.tipTecho || lev.tipTecho;
          if (efectivoA === 'Losa de concreto' && a.grosorLosa) {
            doc.text(`Grosor de losa: ${a.grosorLosa} cm`, 14, y); y += 4;
          } else if (efectivoA === 'Madera' && (a.estadoMadera || a.distVigas)) {
            doc.text(`Madera: ${a.estadoMadera||'—'} · Dist. entre vigas: ${a.distVigas?`${a.distVigas} cm`:'—'}`, 14, y); y += 4;
          } else if ((efectivoA === 'Lámina' || efectivoA === 'Carport') && (a.tipoPTR || a.calibrePTR || a.grosorPTRmm || a.distVigas)) {
            doc.text(`PTR: ${a.tipoPTR||'—'} · Calibre: ${a.calibrePTR||'—'}${a.grosorPTRmm?` (${a.grosorPTRmm} mm)`:''} · Dist. entre PTR: ${a.distVigas?`${a.distVigas} cm`:'—'}`, 14, y); y += 4;
          }
          if (a.posicionReferencia || a.puntoReferencia) {
            doc.text(`Punto de partida: ${a.posicionReferencia||'—'}${a.puntoReferencia?` — ${a.puntoReferencia}`:''}`, 14, y); y += 4;
          }
          y += 3;
        }
      }

      y=campo(doc,'Servicio CFE',lev.tipoServicioCFE,14,y);
      y=campo(doc,'Tierra física',lev.tierraFisica,14,y);
      y=campo(doc,'Centro de carga',lev.centroCarga,14,y);
      const voltajesTxt = [
        lev.voltajeFaseFaseL1L2 ? `Fase-fase L1-L2: ${lev.voltajeFaseFaseL1L2} V` : null,
        lev.voltajeFaseFaseL2L3 ? `Fase-fase L2-L3: ${lev.voltajeFaseFaseL2L3} V` : null,
        lev.voltajeFaseFaseL1L3 ? `Fase-fase L1-L3: ${lev.voltajeFaseFaseL1L3} V` : null,
        lev.voltajeFaseNeutroL1 ? `Fase-neutro L1: ${lev.voltajeFaseNeutroL1} V` : null,
        lev.voltajeFaseNeutroL2 ? `Fase-neutro L2: ${lev.voltajeFaseNeutroL2} V` : null,
        lev.voltajeFaseNeutroL3 ? `Fase-neutro L3: ${lev.voltajeFaseNeutroL3} V` : null,
        lev.voltajeNeutroTierra ? `Neutro-tierra: ${lev.voltajeNeutroTierra} V`  : null,
      ].filter(Boolean);
      if (voltajesTxt.length) y=campo(doc,'Voltajes medidos', voltajesTxt.join(' · '),14,y);
      if (lev.capacidadInterruptorPrincipal || lev.capacidadBarrasTablero) {
        y=campo(doc,'Interruptor principal / Barras (busbar)',
          `${lev.capacidadInterruptorPrincipal||'—'} A / ${lev.capacidadBarrasTablero||'—'} A`,14,y);
      }
      if (lev.sombras?.checklist?.length) y=campo(doc,'Obstáculos de sombra',lev.sombras.checklist.join(', '),14,y);
      if (lev.condicionesAmbientales?.length) y=campo(doc,'Condiciones ambientales',lev.condicionesAmbientales.join(', '),14,y);
      if (project.tipoSistema === 'sistema_pequeno') {
        if (y>240) { doc.addPage(); addHeader(doc,'Levantamiento técnico (cont.)',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('Sistema eléctrico DC', 14, y); y += 6;
        if (lev.voltajeSistemaDC)      y=campo(doc,'Voltaje del sistema',lev.voltajeSistemaDC,14,y);
        if (lev.tipoControlador)       y=campo(doc,'Tipo de regulación',lev.tipoControlador,14,y);
        if (lev.arregloPaneles)        y=campo(doc,'Arreglo de paneles',lev.arregloPaneles,14,y);
        if (lev.arregloBaterias)       y=campo(doc,'Arreglo de baterías',lev.arregloBaterias,14,y);
        if (lev.alimentacionRefrigerador) y=campo(doc,'Alimentación del refrigerador',
          lev.alimentacionRefrigerador === 'inversor_bateria'
            ? 'Vía inversor desde batería (CA)' : 'Directo desde salida LOAD del controlador (DC)',14,y);
        if (lev.distPanelRefrigerador) y=campo(doc,'Dist. panel→refrigerador',`${lev.distPanelRefrigerador} m`,14,y);
        if (lev.calibreCableDC)        y=campo(doc,'Calibre de cable DC',lev.calibreCableDC,14,y);
        if (lev.bateria)               y=campo(doc,'Batería',lev.bateria,14,y);
        if (lev.breakerBateria)        y=campo(doc,'Breaker de batería',lev.breakerBateria,14,y);
        if (lev.mppt)                  y=campo(doc,'Controlador MPPT/PWM',lev.mppt,14,y);
        if (lev.potenciaInversorW || lev.inversor) {
          y=campo(doc,'Inversor', [
            lev.potenciaInversorW ? `${lev.potenciaInversorW} W` : null,
            lev.inversor || null,
          ].filter(Boolean).join(' — '),14,y);
        }
        if (lev.breakerPanel)          y=campo(doc,'Breaker de paneles',lev.breakerPanel,14,y);
        if (lev.breakerPolo)           y=campo(doc,'Breaker 1 polo',lev.breakerPolo,14,y);
      }
      if (lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor) {
        if (lev.accesoTecho)            y=campo(doc,'Ruta de acceso al techo',lev.accesoTecho,14,y);
        if (lev.almacenamientoTemporal) y=campo(doc,'Almacenamiento temporal',lev.almacenamientoTemporal,14,y);
        if (lev.conectividadInversor)   y=campo(doc,'Conectividad en inversor',lev.conectividadInversor,14,y);
      }
      if (lev.restricciones) {
        const lineas = doc.splitTextToSize(lev.restricciones, 180);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
        doc.text('RESTRICCIONES', 14, y); y+=4;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(lineas, 14, y); y += lineas.length * 5;
      }
      if (lev.logisticaNotas) {
        const lineas = doc.splitTextToSize(lev.logisticaNotas, 180);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
        doc.text('NOTAS DE LOGÍSTICA', 14, y); y+=4;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(lineas, 14, y); y += lineas.length * 5;
      }
      if (lev.observacionesGenerales) {
        const lineas = doc.splitTextToSize(lev.observacionesGenerales, 180);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
        doc.text('OBSERVACIONES', 14, y); y+=4;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(lineas, 14, y); y += lineas.length * 5;
      }
      const sunSeeker = lev.sunSeeker || [];
      if (sunSeeker.length) {
        if (y > 220) { doc.addPage(); addHeader(doc,'Levantamiento — Sun Seeker',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
        doc.text('Sun Seeker (análisis de sombras)', 14, y); y+=6;
        let colSS=0;
        for (const f of sunSeeker.slice(0,4)) {
          const fx = 14 + colSS*98;
          const newY = await addImage(doc, f.url||f, fx, y, 88, 62);
          if (f.etiqueta) { doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR); doc.text(f.etiqueta, fx, newY+4); }
          if (colSS===1) { y=newY+8; colSS=0; } else colSS=1;
          if (y>240) { doc.addPage(); addHeader(doc,'Levant. Sun Seeker (cont.)',project); y=44; colSS=0; }
        }
      }
      const fotosLev = lev.fotosLevantamiento || [];
      if (fotosLev.length) {
        if (y > 220) { doc.addPage(); addHeader(doc,'Levantamiento — Fotos',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
        doc.text('Fotos del levantamiento', 14, y); y+=6;
        let col=0;
        for (const f of fotosLev.slice(0,6)) {
          const fx = 14 + col*98;
          const newY = await addImage(doc, f.url||f, fx, y, 88, 62);
          if (col===1) { y=newY+2; col=0; } else col=1;
          if (y>240) { doc.addPage(); addHeader(doc,'Levant. Fotos (cont.)',project); y=44; col=0; }
        }
      }
    }

    // Dimensionamiento eléctrico — memoria técnica preliminar (mismo motor que la vista Dimensionamiento)
    if (sec('sec-dimensionamiento')) {
      const res = calcDimensionamiento(project);
      if (!res.error) {
        doc.addPage(); addHeader(doc,'Dimensionamiento eléctrico',project); y=44;
        const lev2 = project.documentacion?.levantamiento || {};
        const riesgos = detectarRiesgos(project);

        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('Diagnóstico energético', 14, y); y += 6;
        const kpiTxt = [
          res.hsp       ? `HSP del sitio: ${res.hsp} h/día (${lev2.tMinCiudad || 'promedio nacional'})` : null,
          res.kwhDia    ? `Demanda diaria: ${res.kwhDia} kWh/día` : null,
          res.consMes   ? `Consumo mensual estimado: ${res.consMes} kWh/mes` : null,
          res.genMes    ? `Generación FV estimada: ${res.genMes} kWh/mes` : null,
          res.cobertura ? `Cobertura solar: ${res.cobertura}%` : null,
          res.batKwh    ? `Almacenamiento: ${res.batKwh} kWh LFP` : null,
          res.vfdKw     ? `VFD: ${res.vfdKw} kW · Volumen diario: ${res.volDia} m³/día` : null,
        ].filter(Boolean);
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        for (const t of kpiTxt) {
          if (y>260) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
          doc.text(`• ${t}`, 14, y); y += 5;
        }

        if (y>250) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
        y += 2;
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('Arquitectura propuesta', 14, y); y += 6;
        for (const [k, v] of Object.entries(res.modelo || {})) {
          if (y>260) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
          y = campo(doc, MOD_LABELS[k] || k, v, 14, y);
        }

        if (y>240) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
        y += 2;
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
        doc.text('Dimensionamiento técnico', 14, y); y += 6;
        for (const [k, v] of buildDimRows(res, lev2, project.trayectorias)) {
          if (y>260) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
          y = campo(doc, k, v, 14, y);
        }

        if (riesgos.length) {
          if (y>240) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
          y += 2;
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
          doc.text('Riesgos detectados', 14, y); y += 6;
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
          for (const r of riesgos) {
            if (y>260) { doc.addPage(); addHeader(doc,'Dimensionamiento (cont.)',project); y=44; }
            doc.setTextColor(...(r.nivel === 'error' ? [220,38,38] : [217,119,6]));
            const lineas = doc.splitTextToSize(`• ${r.msg}`, 180);
            doc.text(lineas, 14, y); y += lineas.length * 4.5;
          }
        }
      }
    }

    // Consumo del cliente
    if (sec('sec-consumo')) {
      const lev = project.documentacion?.levantamiento||{};
      const recibos  = lev.recibos  || [];
      const aparatos = lev.aparatos || [];
      if (recibos.length || aparatos.length) {
        if (y > 220) { doc.addPage(); addHeader(doc,'Consumo del cliente',project); y=44; }
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...VERDE);
        doc.text('Consumo del cliente', 14, y); y += 7;

        if (lev.modoConsumo === 'aparatos' && aparatos.length) {
          const totalKwh = aparatos.reduce((s,a)=>s+((a.potencia||0)*(a.horas||0)*(a.cantidad||1)*30/1000),0);
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GRIS_CLR);
          doc.text(`Estimado por aparatos — ${Math.round(totalKwh)} kWh/mes`, 14, y); y += 6;
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
          for (const a of aparatos) {
            if (y>260) { doc.addPage(); addHeader(doc,'Consumo (cont.)',project); y=44; }
            const kwhMes = ((a.potencia||0)*(a.horas||0)*(a.cantidad||1)*30/1000).toFixed(1);
            doc.text(`${a.nombre||'—'} · ${a.potencia||0} W × ${a.horas||0} h/día × ${a.cantidad||1} (${a.area||'General'}) — ${kwhMes} kWh/mes`, 14, y); y += 4.5;
          }
        } else if (recibos.length) {
          const conKwh = recibos.filter(r=>r.kwh>0);
          if (conKwh.length) {
            const avgKwh = Math.round(conKwh.reduce((s,r)=>s+r.kwh,0)/conKwh.length);
            doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GRIS_CLR);
            doc.text(`Promedio mensual (${conKwh.length} recibos) — ${avgKwh} kWh/mes`, 14, y); y += 6;
          }
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
          for (const r of recibos) {
            if (y>260) { doc.addPage(); addHeader(doc,'Consumo (cont.)',project); y=44; }
            const mesTxt = r.mes ? `${MESES_CORTO[r.mes-1]||r.mes} ${r.anio||''}`.trim() : (r.anio||'—');
            doc.text(`${mesTxt} — ${r.kwh||0} kWh${r.importe?` · $${r.importe}`:''}`, 14, y); y += 4.5;
          }
        }
        y += 4;
      }
    }

    // Validación Voc
    const vocData = project.garantia?.validacionVoc;
    if (sec('sec-voc') && vocData?.resultado) {
      if (y > 200) { doc.addPage(); addHeader(doc,'Validación Voc',project); y=44; }
      else { y+=4; }
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
      doc.text('Validación Voc de string', 14, y); y+=7;
      const resLabel = vocData.resultado==='seguro' ? 'SEGURO ✓' : vocData.resultado==='limite' ? 'EN EL LÍMITE ⚠' : 'EXCEDE EL LÍMITE ✗';
      const resColor = vocData.resultado==='seguro' ? [30,120,60] : vocData.resultado==='limite' ? [180,140,0] : [200,40,40];
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...resColor);
      doc.text(resLabel, 14, y); y+=6;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      y=campo(doc,'Voc del panel',`${vocData.vocPanel} V`,14,y);
      y=campo(doc,'Paneles en serie',`${vocData.panelesSerie}`,110,y-12);
      y=campo(doc,'Temp. mínima sitio',`${vocData.tMin}°C`,14,y);
      y=campo(doc,'Coef. temp. Voc',`${vocData.coefVoc}%/°C`,110,y-12);
      y=campo(doc,'Voc corregido por temp.',`${vocData.vocCorregido?.toFixed(2)} V`,14,y);
      y=campo(doc,'Voc total del string',`${vocData.vocString?.toFixed(2)} V`,110,y-12);
      y=campo(doc,'Voc máx. inversor',`${vocData.vocMaxInversor} V`,14,y);
      y=campo(doc,'Margen de seguridad',`${vocData.margen?.toFixed(1)}%`,110,y-12);
      if (vocData.mensaje) {
        const lineas = doc.splitTextToSize(vocData.mensaje, 170);
        doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(...resColor);
        doc.text(lineas, 14, y); y += lineas.length*5+4;
      }
    }

    // Torque metrológico
    const torqueData = project.checklistData?.torque || {};
    const torqueKeys = Object.keys(torqueData);
    if (sec('sec-torque') && torqueKeys.length) {
      if (y > 200) { doc.addPage(); addHeader(doc,'Registro de torque',project); y=44; }
      else { y+=4; }
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
      doc.text('Registro de torque metrológico', 14, y); y+=7;
      for (const key of torqueKeys) {
        const t = torqueData[key];
        if (!t) continue;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        const verificado = t.verificado ? '✓' : '○';
        const aplicado = t.aplicado != null ? `${t.aplicado} N·m` : '—';
        doc.text(`${verificado}  ${esc(t.componente || key)}  ·  Especif: ${t.especif||'—'}  ·  Aplicado: ${aplicado}`, 18, y); y+=5;
        if (y>260) { doc.addPage(); addHeader(doc,'Torque (cont.)',project); y=44; }
      }
    }

    // QR del cliente
    if (sec('sec-qr') && window.QRCode) {
      doc.addPage(); addHeader(doc,'QR del sistema',project); y=44;
      try {
        const canvas = document.createElement('canvas');
        const qrUrl  = `${location.origin}${location.pathname}#proyecto/${projectId}`;
        await new Promise((res) => {
          new window.QRCode(canvas, { text: qrUrl, width:200, height:200,
            colorDark:'#1B4332', colorLight:'#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
          setTimeout(res, 300);
        });
        const qrB64 = canvas.toDataURL('image/png');
        y = campo(doc,'URL del sistema',`${location.origin}${location.pathname}#proyecto/${projectId}`,14,y);
        y = await addImage(doc, qrB64, 14, y, 60, 60);
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
        doc.text('Escanear para acceder al expediente digital del sistema', 14, y);
      } catch {
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(`URL: ${location.origin}${location.pathname}#proyecto/${projectId}`, 14, y);
      }
    }

    // Evidencias de cierre por Bloque 1/2/3 (esquema nuevo: checklistData.fotosCierre).
    if (sec('sec-cierre')) {
      const cl    = project.checklistData || {};
      const techo = project.projectConfig?.techo || cl.techo || 'cemento';
      let blocks = [];
      try { blocks = getExecBlocks(project, techo) || []; } catch { blocks = []; }
      for (const bloque of [1, 2, 3]) {
        const bs = blocks.filter(b => b.bloque === bloque);
        const items = [];
        for (const b of bs) {
          for (const slot of (b.fotosCierre || [])) {
            const d = cl.fotosCierre?.[b.id]?.[slot.id];
            if (d && (d.url || d.data)) items.push({ slot, src: d.url || d.data });
          }
        }
        if (!items.length) continue;
        const titulo = `Evidencias de cierre — ${BLOQUE_LABELS?.[bloque] || 'Bloque ' + bloque}`;
        doc.addPage(); addHeader(doc, titulo, project); y = 44;
        let col = 0;
        for (const { slot, src } of items) {
          const fx = 14 + col * 98;
          doc.setFontSize(8); doc.setTextColor(...GRIS_CLR); doc.text(slot.label, fx, y); y += 4;
          const newY = await addImage(doc, src, fx, y, 88, 65);
          if (col === 1) { y = newY; col = 0; } else col = 1;
          if (y > 230) { doc.addPage(); addHeader(doc, titulo + ' (cont.)', project); y = 44; col = 0; }
        }
      }
    }

    // Fotos técnicas
    if (sec('sec-fotos-tec')) {
      const ft = project.garantia?.fotosTecnicas || {};
      const normFT = v => {
        if (!v) return [];
        if (typeof v==='string') return [{url:v}];
        return Array.isArray(v)?v:[];
      };
      const slots = [
        { key:'tableroAC',          label:'Tablero AC terminado'    },
        { key:'tableroDC',          label:'Tablero DC terminado'    },
        { key:'protecciones',       label:'Protecciones instaladas' },
        { key:'inversorEnergizado', label:'Inversor energizado'     },
        { key:'puestaATierra',      label:'Puesta a tierra'         },
        { key:'etiquetado',         label:'Etiquetado'              },
      ].filter(s => normFT(ft[s.key]).length);
      if (slots.length) {
        doc.addPage(); addHeader(doc,'Fotos técnicas de instalación',project); y=44;
        let col=0;
        for (const s of slots) {
          const fotos = normFT(ft[s.key]);
          for (let fi=0; fi<fotos.length; fi++) {
            const fx = 14 + col*98;
            const lbl = fotos.length>1 ? `${s.label.toUpperCase()} (${fi+1}/${fotos.length})` : s.label.toUpperCase();
            doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
            doc.text(lbl, fx, y); y+=4;
            const newY = await addImage(doc, fotos[fi].url||fotos[fi], fx, y, 88, 62);
            if (col===1) { y=newY+4; col=0; } else col=1;
            if (y>230) { doc.addPage(); addHeader(doc,'Fotos técnicas (cont.)',project); y=44; col=0; }
          }
        }
      }
    }

    // Observaciones
    if (sec('sec-observ')) {
      const obs = project.observaciones || [];
      if (obs.length) {
        doc.addPage(); addHeader(doc,'Observaciones del proyecto',project); y=44;
        for (const o of obs) {
          const estado = o.resuelta ? '[RESUELTA]' : `[${(o.prioridad||'normal').toUpperCase()}]`;
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
          doc.text(`${estado} ${esc(o.autorNombre||'—')} · ${fmtFecha(o.timestamp)}`, 14, y); y+=5;
          doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
          const lineas = doc.splitTextToSize(o.texto||'', 180);
          doc.text(lineas, 18, y); y += lineas.length * 5 + 3;
          if (o.resuelta && o.resueltaPor) {
            doc.setTextColor(...GRIS_CLR);
            const resLine = `  ✓ Resuelta por ${esc(o.resueltaPor)} · ${fmtFecha(o.resueltaAt)}${o.resueltaNota ? ` — ${esc(o.resueltaNota)}` : ''}`;
            const resLineas = doc.splitTextToSize(resLine, 175);
            doc.text(resLineas, 18, y); y += resLineas.length * 4 + 2;
          }
          doc.setDrawColor(200,220,200); doc.line(14, y, 196, y); y+=4;
          if (y>260) { doc.addPage(); addHeader(doc,'Observaciones (cont.)',project); y=44; }
        }
      }
    }

    // Historial de cambios
    if (sec('sec-historial')) {
      const log = project.statusLog || [];
      if (log.length) {
        doc.addPage(); addHeader(doc,'Historial de cambios de estado',project); y=44;
        [...log].reverse().forEach(e => {
          const fromL = ESTADOS_LABEL[e.from]||e.from;
          const toL   = ESTADOS_LABEL[e.to]  ||e.to;
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...VERDE_MED);
          doc.text(`${fromL}  →  ${toL}`, 14, y); y+=5;
          doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
          doc.text(`${esc(e.by||'—')}  ·  ${fmtFecha(e.at)}`, 18, y); y+=4;
          if (e.nota) {
            doc.setTextColor(...GRIS);
            const lineas = doc.splitTextToSize(`Nota: ${e.nota}`, 170);
            doc.text(lineas, 18, y); y += lineas.length * 4 + 2;
          }
          doc.setDrawColor(200,220,200); doc.line(14, y, 196, y); y+=5;
          if (y>260) { doc.addPage(); addHeader(doc,'Historial (cont.)',project); y=44; }
        });
      }
    }

    // Auditoría
    if (sec('sec-auditoria') && project.auditoria?.resultado) {
      doc.addPage(); addHeader(doc,'Auditoría técnica',project); y=44;
      const aud = project.auditoria;
      y=campo(doc,'Tipo',aud.tipo==='interna'?'Interna Ecofit':'Externa',14,y);
      y=campo(doc,'Auditor',aud.auditor?.nombre,14,y);
      if (aud.auditor?.empresa){ y=campo(doc,'Empresa',aud.auditor.empresa,14,y); }
      y=campo(doc,'Norma',aud.norma,14,y);
      y=campo(doc,'Resultado',aud.resultado?.replace(/_/g,' ').toUpperCase(),14,y);

      const esFormal   = aud.modo === 'formal';
      const itemsAud   = esFormal ? checklistFormalPara(project.tipoSistema) : checklistRapidoPara(project.tipoSistema);
      const resultsAud = esFormal ? (aud.formalChecklist||{}) : (aud.rapidoChecklist||{});
      const obsAud     = aud.formalObs || {};
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
      doc.text(`Checklist técnico (${esFormal?'Formal':'Rápido'})`, 14, y); y+=6;
      for (const item of itemsAud) {
        if (y>270) { doc.addPage(); addHeader(doc,'Auditoría técnica (cont.)',project); y=44; }
        const r = resultsAud[item.id];
        const mark = (r==='ok'||r==='si') ? '✓' : (r==='no_cumple'||r==='no') ? '✗' : r==='na' ? 'N/A' : '—';
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
        doc.text(`${mark}  ${item.label}`, 18, y); y+=5;
        if (esFormal && obsAud[item.id]) {
          doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
          doc.text(`   ${obsAud[item.id]}`, 18, y); y+=4;
        }
      }

      const med     = aud.mediciones || {};
      const medVals = MEDICIONES.filter(m => med[m.id]);
      if (medVals.length) {
        if (y>250) { doc.addPage(); addHeader(doc,'Auditoría técnica (cont.)',project); y=44; }
        y+=2;
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
        doc.text('Mediciones', 14, y); y+=6;
        for (const m of medVals) {
          doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
          doc.text(`${m.label}: ${med[m.id]} ${m.unit}`, 18, y); y+=5;
        }
      }

      if (aud.observaciones){ y+=2; y=campo(doc,'Observaciones',aud.observaciones,14,y); }
      if (aud.docFirmado){ y=await addImage(doc,aud.docFirmado,14,y,100,70); }
    }

    // Footers
    const totalPages = doc.getNumberOfPages();
    for (let i=1;i<=totalPages;i++) { doc.setPage(i); addFooter(doc,i,totalPages); }

    await savePDF(doc, `EFS-Tecnico-${project.displayId}.pdf`);
  } catch (err) {
    console.error('[PDF] Técnico:', err);
    const { toast } = await import('./utils.js');
    toast('Error al generar PDF — intenta de nuevo', 'error');
  } finally {
    btnDone(btn);
  }
};
