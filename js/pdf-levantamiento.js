// pdf-levantamiento.js — Word de levantamiento técnico (.docx real — OOXML)
// Extraído de pdf.js. Registra window.exportarWordLevantamiento.

import { projects } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA, fotoToImageBuffer } from './utils.js';
import { newDoc, heading1, heading2, campo, p, table, chip, hr, imageBlock,
         Paragraph, TextRun, AlignmentType, saveDocx } from './word-helpers.js';

const VERDE = '16a34a';

window.exportarWordLevantamiento = async function(projectId) {
  const project = await projects.getById(projectId);
  const { toast } = await import('./utils.js');
  if (!project) { toast('Proyecto no encontrado', 'error'); return; }

  const lev  = project.documentacion?.levantamiento || {};
  const tipo = TIPOS_SISTEMA[project.tipoSistema];

  const children = [];
  const addCampo = (label, value) => { const c = campo(label, value); if (c) children.push(c); };
  const addSec   = (title) => children.push(heading2(title, VERDE));
  const addImgSilent = async (foto) => {
    const img = await fotoToImageBuffer(foto, 350);
    if (img) children.push(...imageBlock(img));
  };

  children.push(heading1('Levantamiento Técnico', VERDE));
  children.push(p(project.displayId, { bold: true, size: 28, color: '111827' }));
  children.push(p(`Generado: ${fmtFecha(new Date().toISOString())}`, { color: '6b7280', size: 18 }));

  addCampo('Cliente', project.clientName);
  addCampo('Alias / proyecto', project.nombreProyecto);
  addCampo('Dirección', project.direccion);
  if (project.ciudad || project.estadoDireccion) {
    addCampo('Ciudad / Estado', [project.ciudad, project.estadoDireccion].filter(Boolean).join(', '));
  }
  addCampo('Tipo de sistema', tipo?.label || project.tipoSistema);

  // Techo y sitio
  addSec('Techo y sitio');
  if (lev.estadoInmueble) addCampo('Estado del inmueble', lev.estadoInmueble);
  addCampo('Temperatura mínima del sitio', lev.tMin != null ? `${lev.tMin} °C` : null);
  if (lev.tMinCiudad && lev.tMinCiudad !== 'otro') {
    addCampo('Estado de referencia', `${lev.tMinCiudad} (zona: ${lev.tMinZona || 'valle'})`);
  }

  // Áreas del techo
  const areas = lev.areasTecho || [];
  if (areas.length) {
    children.push(p('Áreas del techo', { bold: true, color: VERDE }));
    const techoMixto = areas.some(a => a.tipTecho);
    const headers = ['Área', ...(techoMixto ? ['Tipo de techo'] : []), 'Dimensiones', 'Superficie',
      'Orientación', 'Inclinación', 'Pisos', 'Tablero→Inv.', 'Inv.→Paneles'];
    const rows = areas.map(a => {
      const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : '—';
      const sup = (a.ancho && a.largo) ? `${(a.ancho * a.largo).toFixed(1)} m²` : (a.area ? `${a.area} m²` : '—');
      return [
        a.nombre || '—',
        ...(techoMixto ? [a.tipTecho || '(igual al general)'] : []),
        dim, sup,
        a.orientacion || '—',
        a.inclinacion != null ? `${a.inclinacion}°` : '—',
        a.pisos != null ? String(a.pisos) : '—',
        a.distTableroInversor != null ? `${a.distTableroInversor} m` : '—',
        a.distInversorPaneles != null ? `${a.distInversorPaneles} m` : '—',
      ];
    });
    children.push(table(headers, rows));
    for (const a of areas) {
      const efectivo = a.tipTecho || lev.tipTecho;
      if (efectivo === 'Losa de concreto' && a.grosorLosa) {
        children.push(p(`${a.nombre || 'Área'} — Grosor de losa: ${a.grosorLosa} cm`, { size: 18, color: '6b7280' }));
      } else if (efectivo === 'Madera' && (a.estadoMadera || a.distVigas)) {
        children.push(p(`${a.nombre || 'Área'} — Estado de la madera: ${a.estadoMadera || '—'}; Distancia entre vigas: ${a.distVigas ? `${a.distVigas} cm` : '—'}`, { size: 18, color: '6b7280' }));
      } else if ((efectivo === 'Lámina' || efectivo === 'Carport') && (a.tipoPTR || a.calibrePTR || a.grosorPTRmm || a.distVigas)) {
        children.push(p(`${a.nombre || 'Área'} — Tipo de PTR: ${a.tipoPTR || '—'}; Calibre: ${a.calibrePTR || '—'}${a.grosorPTRmm ? ` (${a.grosorPTRmm} mm)` : ''}; Distancia entre PTR: ${a.distVigas ? `${a.distVigas} cm` : '—'}`, { size: 18, color: '6b7280' }));
      }
      if (a.posicionReferencia || a.puntoReferencia) {
        children.push(p(`${a.nombre || 'Área'} — Punto de partida: ${a.posicionReferencia || '—'}${a.puntoReferencia ? ` — ${a.puntoReferencia}` : ''}`, { size: 18, color: '6b7280' }));
      }
    }
  }

  // Evidencia fotográfica — todas las fotos de áreas + generales del levantamiento,
  // agrupadas por tipo de evidencia (no por área) para que el documento se lea
  // como un reporte técnico por sistema, no como un álbum por techo.
  const fotosLev = lev.fotosLevantamiento || [];
  const evidenciaItems = [
    ...areas.flatMap(a => (Array.isArray(a.fotos) ? a.fotos : []).map(f =>
      ({ foto: f, categoria: f.categoria || 'Vista general', etiqueta: a.nombre || 'Área' }))),
    ...fotosLev.map(f => ({ foto: f, categoria: f.categoria || 'Vista general', etiqueta: 'General' })),
  ];
  if (evidenciaItems.length) {
    addSec('Evidencia fotográfica');
    const CATEGORIAS_ORDEN = ['Estructura/anclaje', 'Cableado', 'Paneles', 'Tablero/conexión', 'Vista general'];
    for (const cat of CATEGORIAS_ORDEN) {
      const items = evidenciaItems.filter(it => it.categoria === cat);
      if (!items.length) continue;
      children.push(p(cat, { bold: true, color: VERDE }));
      for (const it of items) {
        const img = await fotoToImageBuffer(it.foto, 350);
        children.push(...imageBlock(img, it.etiqueta));
      }
    }
  }

  // Sombras
  const sombras = lev.sombras || {};
  if (sombras.checklist?.length || sombras.foto || sombras.notas) {
    addSec('Análisis de sombras');
    if (sombras.checklist?.length) {
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: sombras.checklist.flatMap(s => [chip(s), new TextRun(' ')]),
      }));
    }
    if (sombras.notas) addCampo('Notas de sombras', sombras.notas);
    if (sombras.foto) await addImgSilent(sombras.foto);
  }
  if (lev.condicionesAmbientales?.length) {
    addCampo('Condiciones ambientales del sitio', lev.condicionesAmbientales.join(', '));
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
  const AREAS_ORDER = ['General', 'Sala/Comedor', 'Cocina', 'Habitación 1', 'Habitación 2', 'Habitación 3',
                       'Baño', 'Cuarto de lavado', 'Cochera', 'Entrada', 'Patio/Jardín', 'Sala de máquinas', 'Otro'];

  if (tieneElec) {
    addSec('Eléctrico, consumo y cargas');

    // CFE y contrato
    if (tieneCFE && (lev.nisServicio || lev.rpu || lev.titularServicio || lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga || lev.tarifaCFE)) {
      if (lev.nisServicio)     addCampo('NIS (Núm. de Servicio CFE)', lev.nisServicio);
      if (lev.rpu)             addCampo('RPU', lev.rpu);
      if (lev.titularServicio) addCampo('Titular del servicio', lev.titularServicio);
      addCampo('Servicio CFE', lev.tipoServicioCFE);
      addCampo('Tierra física', lev.tierraFisica);
      addCampo('Centro de carga', lev.centroCarga);
      addCampo('Tarifa CFE', lev.tarifaCFE);
      if (lev.demandaKW)      addCampo('Demanda contratada', `${lev.demandaKW} kW`);
      if (lev.factorPotencia) addCampo('Factor de potencia', `${lev.factorPotencia}`);
      if (lev.horarioUso)     addCampo('Horario de uso', lev.horarioUso);
      const voltajesTxt = [
        lev.voltajeFaseFaseL1L2 ? `Fase-fase L1-L2: ${lev.voltajeFaseFaseL1L2} V` : null,
        lev.voltajeFaseFaseL2L3 ? `Fase-fase L2-L3: ${lev.voltajeFaseFaseL2L3} V` : null,
        lev.voltajeFaseFaseL1L3 ? `Fase-fase L1-L3: ${lev.voltajeFaseFaseL1L3} V` : null,
        lev.voltajeFaseNeutroL1 ? `Fase-neutro L1: ${lev.voltajeFaseNeutroL1} V` : null,
        lev.voltajeFaseNeutroL2 ? `Fase-neutro L2: ${lev.voltajeFaseNeutroL2} V` : null,
        lev.voltajeFaseNeutroL3 ? `Fase-neutro L3: ${lev.voltajeFaseNeutroL3} V` : null,
        lev.voltajeNeutroTierra ? `Neutro-tierra: ${lev.voltajeNeutroTierra} V`  : null,
      ].filter(Boolean);
      if (voltajesTxt.length) addCampo('Voltajes medidos', voltajesTxt.join(' · '));
      if (lev.capacidadInterruptorPrincipal || lev.capacidadBarrasTablero) {
        addCampo('Interruptor principal / Barras (busbar)',
          `${lev.capacidadInterruptorPrincipal || '—'} A / ${lev.capacidadBarrasTablero || '—'} A`);
      }
      if (lev.fotoMedidor) {
        children.push(p('Base del medidor', { size: 16, color: '78888c' }));
        await addImgSilent(lev.fotoMedidor);
      }
    }

    // Recibos CFE
    if (recibos.length) {
      const conKwh = recibos.filter(r => r.kwh > 0);
      children.push(p('Recibos CFE', { bold: true }));
      const rows = recibos.map(r => [
        r.mesLabel || (r.mes ? String(r.mes) : '—'),
        r.anio ? String(r.anio) : '—',
        r.kwh != null ? String(r.kwh) : '—',
        r.importe ? `$${r.importe.toLocaleString('es-MX')}` : '—',
      ]);
      if (conKwh.length >= 2) {
        const avg  = Math.round(conKwh.reduce((s, r) => s + r.kwh, 0) / conKwh.length);
        const peak = conKwh.reduce((a, b) => a.kwh > b.kwh ? a : b);
        const low  = conKwh.reduce((a, b) => a.kwh < b.kwh ? a : b);
        rows.push(
          [{ text: 'Promedio mensual', colSpan: 2, bold: true, shadingHex: 'f0fdf4' }, { text: `${avg} kWh`, bold: true, shadingHex: 'f0fdf4' }, { text: '', shadingHex: 'f0fdf4' }],
          [{ text: 'Mes pico', colSpan: 2 }, { text: `${peak.kwh} kWh` }, { text: `${peak.mesLabel || String(peak.mes || '')} ${peak.anio || ''}` }],
          [{ text: 'Mes bajo', colSpan: 2 }, { text: `${low.kwh} kWh` }, { text: `${low.mesLabel || String(low.mes || '')} ${low.anio || ''}` }],
        );
      }
      children.push(table(['Mes', 'Año', 'kWh', 'Importe'], rows));
    }

    // Aparatos por zona
    if (aparatos.length) {
      children.push(p('Consumo por zona', { bold: true }));
      const zoneMap = {};
      aparatos.forEach(ap => { const z = ap.area || 'General'; if (!zoneMap[z]) zoneMap[z] = []; zoneMap[z].push(ap); });
      const zones = [...AREAS_ORDER.filter(z => zoneMap[z]), ...Object.keys(zoneMap).filter(z => !AREAS_ORDER.includes(z))];
      let totalKwhMes = 0;
      for (const zone of zones) {
        const items = zoneMap[zone];
        const zKwh  = items.reduce((s, ap) => s + ap.potencia * ap.horas * (ap.cantidad || 1) * 30 / 1000, 0);
        totalKwhMes += zKwh;
        children.push(new Paragraph({
          shading: { fill: 'f0fdf4' },
          spacing: { before: 120, after: 40 },
          children: [new TextRun({ text: `${zone} — ${zKwh.toFixed(0)} kWh/mes`, bold: true, size: 20, color: '15803d' })],
        }));
        const rows = items.map(ap => {
          const kWhMes = (ap.potencia * ap.horas * (ap.cantidad || 1) * 30 / 1000).toFixed(1);
          return [ap.nombre || '—', String(ap.cantidad || 1), ap.potencia != null ? String(ap.potencia) : '—', ap.horas != null ? String(ap.horas) : '—', kWhMes];
        });
        children.push(table(['Aparato', 'Cant.', 'W', 'Hrs/día', 'kWh/mes'], rows));
      }
      children.push(p(`Total estimado: ${totalKwhMes.toFixed(0)} kWh/mes`, { bold: true, color: '15803d', alignment: AlignmentType.RIGHT }));
    }

    // Cargas a respaldar (críticas y secundarias)
    if (cCrit.length || cSec.length) {
      children.push(p('Cargas a respaldar', { bold: true }));
      const addCargas = (lista, label, colorHex, bgHex) => {
        if (!lista.length) return;
        let tw = 0, twh = 0;
        const rows = lista.map(c => {
          const kd = (c.potencia * c.horas * (c.cantidad || 1) / 1000).toFixed(2);
          tw  += c.potencia * (c.cantidad || 1);
          twh += c.potencia * c.horas * (c.cantidad || 1);
          return [c.area || 'General', c.nombre || '—', c.potencia != null ? String(c.potencia) : '—', c.horas != null ? String(c.horas) : '—', String(c.cantidad || 1), kd];
        });
        rows.push([
          { text: 'Total', colSpan: 2, bold: true, shadingHex: bgHex },
          { text: `${tw} W`, bold: true, shadingHex: bgHex },
          { text: '', shadingHex: bgHex }, { text: '', shadingHex: bgHex },
          { text: `${(twh / 1000).toFixed(2)} kWh/día`, bold: true, shadingHex: bgHex },
        ]);
        children.push(p(label, { bold: true, color: colorHex }));
        children.push(table(['Zona', 'Equipo', 'W', 'Hrs/día', 'Cant.', 'kWh/día'], rows));
      };
      addCargas(cCrit, 'Cargas críticas (alta prioridad)', 'dc2626', 'fef2f2');
      addCargas(cSec,  'Cargas no críticas (baja prioridad)', '2563eb', 'eff6ff');
    }

    // Configuración de baterías
    if (hayBaterias) {
      children.push(p('Configuración de baterías', { bold: true }));
      addCampo('Autonomía requerida', lev.autonomia ? `${lev.autonomia} horas` : null);
      addCampo('Banco de baterías', lev.bancoBaterias ? `${lev.bancoBaterias} kWh` : null);
    }

    // Off-grid específico
    if (tipoSis === 'aislado') {
      if (lev.generador && lev.generador !== 'no') {
        addCampo('Generador de respaldo', `${lev.generador} — ${lev.generadorArranque || 'manual'}${lev.generadorKw ? ` · ${lev.generadorKw} kW` : ''}`);
      }
      if (lev.crecimientoFuturo) addCampo('Crecimiento futuro esperado', lev.crecimientoFuturo);
    }
  }

  // Sistema eléctrico DC (sistema pequeño)
  if (tipoSis === 'sistema_pequeno') {
    addSec('Sistema eléctrico DC');
    if (lev.voltajeSistemaDC)      addCampo('Voltaje del sistema', lev.voltajeSistemaDC);
    if (lev.tipoControlador)       addCampo('Tipo de regulación de carga', lev.tipoControlador);
    if (lev.arregloPaneles)        addCampo('Arreglo de paneles', lev.arregloPaneles);
    if (lev.arregloBaterias)       addCampo('Arreglo de baterías', lev.arregloBaterias);
    if (lev.alimentacionRefrigerador) addCampo('Alimentación del refrigerador',
      lev.alimentacionRefrigerador === 'inversor_bateria'
        ? 'Vía inversor desde batería (CA)' : 'Directo desde salida LOAD del controlador (DC)');
    if (lev.distPanelRefrigerador) addCampo('Dist. panel→batería/refrigerador', `${lev.distPanelRefrigerador} m`);
    if (lev.calibreCableDC)        addCampo('Calibre de cable DC', lev.calibreCableDC);
    if (lev.exposicionTempExtrema) addCampo('Exposición a temperatura extrema', lev.exposicionTempExtrema === 'si' ? 'Sí' : 'No');
    if (lev.bateria)               addCampo('Batería', lev.bateria);
    if (lev.breakerBateria)        addCampo('Breaker de batería', lev.breakerBateria);
    if (lev.mppt)                  addCampo('Controlador MPPT/PWM', lev.mppt);
    if (lev.potenciaInversorW || lev.inversor) {
      addCampo('Inversor', [
        lev.potenciaInversorW ? `${lev.potenciaInversorW} W` : null,
        lev.inversor || null,
      ].filter(Boolean).join(' — '));
    }
    if (lev.breakerPanel) addCampo('Breaker de paneles', lev.breakerPanel);
    if (lev.breakerPolo)  addCampo('Breaker 1 polo', lev.breakerPolo);
  }

  // Logística de instalación
  if (lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor || lev.logisticaNotas) {
    addSec('Logística de instalación');
    addCampo('Ruta de acceso al techo', lev.accesoTecho);
    addCampo('Almacenamiento temporal', lev.almacenamientoTemporal);
    addCampo('Conectividad en ubicación del inversor', lev.conectividadInversor);
    if (lev.logisticaNotas) addCampo('Notas de logística', lev.logisticaNotas);
  }

  // Notas
  if (lev.observacionesGenerales || lev.restricciones) {
    addSec('Notas del levantamiento');
    addCampo('Observaciones generales', lev.observacionesGenerales);
    addCampo('Restricciones especiales', lev.restricciones);
  }

  children.push(hr());
  children.push(p(`Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}`,
    { size: 16, color: '6b7280', alignment: AlignmentType.CENTER }));

  const doc = newDoc(children);
  await saveDocx(doc, `EFS-Levantamiento-${project.displayId}`);
  toast('Word de levantamiento generado ✓', 'success');
};
