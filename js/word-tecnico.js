// word-tecnico.js — Word Técnico (.docx real — OOXML) para archivo interno
// Extraído de pdf-tecnico.js — misma data que el PDF Técnico pero como Word,
// sin ninguna dependencia de jsPDF (pdf-helpers.js).

import { projects } from './db.js';
import { fmtFecha, TIPOS_SISTEMA, ESTADOS, fotoToImageBuffer } from './utils.js';
import { CHECKLIST_RAPIDO, CHECKLIST_FORMAL, MEDICIONES } from './aud-data.js';
import { getSerialesFlat } from './gar-paneles.js';
import { newDoc, heading1, heading2, campo, p, table, hr, imageBlock, pageBreak,
         Paragraph, TextRun, AlignmentType, BorderStyle, saveDocx } from './word-helpers.js';
import { getExecBlocks, BLOQUE_LABELS } from '../modules/checklist/index.js';

const VERDE_OSC = '1B4332';
const VERDE_MED = '40916C';
const VERDE_CLR = '52B788';
const BORDE     = 'd0e4d8';
const GRIS      = '78888c';

const ESTADOS_LABEL = Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) => [k, v.label]));

window.exportarWordTecnico = async function(projectId) {
  const project = await projects.getById(projectId);
  if (!project) { const { toast } = await import('./utils.js'); toast('Proyecto no encontrado', 'error'); return; }

  const sec   = (id) => document.getElementById(id)?.checked;
  const tipo  = TIPOS_SISTEMA[project.tipoSistema];
  const totalPaneles = getSerialesFlat(project.garantia).length;
  const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp || 0) / 1000);

  const children = [];
  const addCampo = (label, value) => children.push(campo(label, (value == null || value === '') ? '—' : String(value)));
  const addSec   = (title) => { children.push(pageBreak()); children.push(heading2(title, VERDE_MED)); };
  const addImg   = async (foto, maxDimPx = 373) => {
    const img = await fotoToImageBuffer(foto, maxDimPx);
    if (img) children.push(...imageBlock(img));
  };

  children.push(heading1('Expediente Técnico — Uso Interno', VERDE_MED));
  children.push(p(project.displayId, { bold: true, size: 28, color: VERDE_OSC }));
  children.push(p(`Generado: ${fmtFecha(new Date().toISOString())}`, { color: GRIS, size: 18 }));
  addCampo('Cliente', project.clientName);
  if (project.direccion) addCampo('Dirección', project.direccion);
  if (project.ciudad || project.estadoDireccion) addCampo('Ciudad / Estado', [project.ciudad, project.estadoDireccion].filter(Boolean).join(', '));
  if (project.coordenadas?.lat) addCampo('Coordenadas GPS', `${Number(project.coordenadas.lat).toFixed(6)}, ${Number(project.coordenadas.lng).toFixed(6)}`);
  if (project.clienteTelefono) addCampo('Tel. cliente', project.clienteTelefono);
  addCampo('Tipo de sistema', tipo?.label || project.tipoSistema);
  addCampo('Estado', ESTADOS_LABEL[project.estado] || project.estado);
  addCampo('Capacidad', `${totalKwp.toFixed(2)} kWp · ${totalPaneles} paneles`);
  if (project.fechaEstimada) addCampo('Fecha estimada entrega', fmtFecha(project.fechaEstimada));
  if (project.notas) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'NOTAS INTERNAS', size: 16, color: GRIS, break: 0 }),
        new TextRun({ text: project.notas, italics: true, size: 20, break: 1 }),
      ],
    }));
  }

  // Equipos
  if (sec('sec-equipos')) {
    const equipos = project.garantia?.equipos || [];
    if (equipos.length) {
      addSec('Equipos con números de serie');
      const rows = equipos.map(eq => [`${eq.marca || ''} ${eq.modelo || ''}`.trim() || '—', eq.serial || '—', eq.notas || '']);
      children.push(table(['Equipo', 'Serial', 'Notas'], rows, { headerShading: VERDE_OSC }));
      for (const eq of equipos) {
        if (eq.fotoPlaca || eq.fotoFrontal) {
          children.push(p(`${eq.marca || ''} ${eq.modelo || ''}`.trim(), { bold: true, color: VERDE_MED }));
          if (eq.fotoPlaca)   await addImg(eq.fotoPlaca);
          if (eq.fotoFrontal) await addImg(eq.fotoFrontal);
        }
      }
    }
  }

  // Estructura
  if (sec('sec-estructura')) {
    const est = project.garantia?.estructura;
    if (est) {
      addSec('Estructura de montaje');
      addCampo('Marca', est.marca);
      addCampo('Sistema estructural', est.sistemaEstructural);
      addCampo('Modelo', est.modelo);
      addCampo('No. Lote', est.numLote);
      addCampo('Metros de riel', `${est.metrosRiel}m · Fijación: ${est.tipoFijacion}`);
      addCampo('Clamps', `Mid: ${est.midClamps} pzas · End: ${est.endClamps} pzas`);
      if (est.fotoFrontal) await addImg(est.fotoFrontal);
    }
  }

  // Paneles — números de serie
  if (sec('sec-paneles')) {
    const pan = project.garantia?.paneles;
    addSec('Paneles — Números de serie');
    children.push(p(`${pan?.marca || ''} ${pan?.modelo || ''} · ${pan?.wp || 0}Wp`, { bold: true }));
    const seriales = getSerialesFlat(project.garantia);
    if (seriales.length) {
      const rows = seriales.map((s, i) => [`Panel ${i + 1}`, s.serial || '—']);
      children.push(table(['Panel', 'Serial'], rows, { headerShading: VERDE_CLR }));
    }
  }

  // Levantamiento
  if (sec('sec-levant')) {
    const lev = project.documentacion?.levantamiento || {};
    addSec('Levantamiento técnico');
    if (lev.estadoInmueble) addCampo('Estado del inmueble', lev.estadoInmueble);
    addCampo('Área disponible', lev.areaDisponible ? `${lev.areaDisponible} m²` : '—');

    // Áreas del techo (orientación/inclinación/pisos/distancias viven por área)
    const areasLev = lev.areasTecho || [];
    if (areasLev.length) {
      const techoMixtoW = areasLev.some(a => a.tipTecho);
      children.push(p('Áreas del techo', { bold: true, color: VERDE_MED }));
      const headers = ['Área', ...(techoMixtoW ? ['Tipo de techo'] : []), 'Dimensiones', 'Orientación',
        'Inclinación', 'Pisos', 'Tablero→Inv.', 'Inv.→Paneles'];
      const rows = areasLev.map(a => {
        const dim = (a.ancho && a.largo) ? `${a.ancho} × ${a.largo} m` : (a.area ? `${a.area} m²` : '—');
        return [
          a.nombre || '—',
          ...(techoMixtoW ? [a.tipTecho || '(igual al general)'] : []),
          dim, a.orientacion || '—',
          a.inclinacion != null ? `${a.inclinacion}°` : '—',
          a.pisos != null ? String(a.pisos) : '—',
          a.distTableroInversor != null ? `${a.distTableroInversor} m` : '—',
          a.distInversorPaneles != null ? `${a.distInversorPaneles} m` : '—',
        ];
      });
      children.push(table(headers, rows, { headerShading: VERDE_OSC }));
      for (const a of areasLev) {
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

    addCampo('Servicio CFE', lev.tipoServicioCFE);
    addCampo('Tierra física', lev.tierraFisica);
    addCampo('Centro de carga', lev.centroCarga);
    const voltajesTxtW = [
      lev.voltajeFaseFaseL1L2 ? `Fase-fase L1-L2: ${lev.voltajeFaseFaseL1L2} V` : null,
      lev.voltajeFaseFaseL2L3 ? `Fase-fase L2-L3: ${lev.voltajeFaseFaseL2L3} V` : null,
      lev.voltajeFaseFaseL1L3 ? `Fase-fase L1-L3: ${lev.voltajeFaseFaseL1L3} V` : null,
      lev.voltajeFaseNeutroL1 ? `Fase-neutro L1: ${lev.voltajeFaseNeutroL1} V` : null,
      lev.voltajeFaseNeutroL2 ? `Fase-neutro L2: ${lev.voltajeFaseNeutroL2} V` : null,
      lev.voltajeFaseNeutroL3 ? `Fase-neutro L3: ${lev.voltajeFaseNeutroL3} V` : null,
      lev.voltajeNeutroTierra ? `Neutro-tierra: ${lev.voltajeNeutroTierra} V`  : null,
    ].filter(Boolean);
    if (voltajesTxtW.length) addCampo('Voltajes medidos', voltajesTxtW.join(' · '));
    if (lev.capacidadInterruptorPrincipal || lev.capacidadBarrasTablero) {
      addCampo('Interruptor principal / Barras (busbar)',
        `${lev.capacidadInterruptorPrincipal || '—'} A / ${lev.capacidadBarrasTablero || '—'} A`);
    }
    if (lev.sombras?.checklist?.length) addCampo('Obstáculos de sombra', lev.sombras.checklist.join(', '));
    if (lev.condicionesAmbientales?.length) addCampo('Condiciones ambientales', lev.condicionesAmbientales.join(', '));
    if (project.tipoSistema === 'sistema_pequeno') {
      children.push(p('Sistema eléctrico DC', { bold: true, color: VERDE_MED }));
      if (lev.voltajeSistemaDC)      addCampo('Voltaje del sistema', lev.voltajeSistemaDC);
      if (lev.tipoControlador)       addCampo('Tipo de regulación', lev.tipoControlador);
      if (lev.arregloPaneles)        addCampo('Arreglo de paneles', lev.arregloPaneles);
      if (lev.arregloBaterias)       addCampo('Arreglo de baterías', lev.arregloBaterias);
      if (lev.alimentacionRefrigerador) addCampo('Alimentación del refrigerador',
        lev.alimentacionRefrigerador === 'inversor_bateria'
          ? 'Vía inversor desde batería (CA)' : 'Directo desde salida LOAD del controlador (DC)');
      if (lev.distPanelRefrigerador) addCampo('Dist. panel→refrigerador', `${lev.distPanelRefrigerador} m`);
      if (lev.calibreCableDC)        addCampo('Calibre de cable DC', lev.calibreCableDC);
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
    if (lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor) {
      if (lev.accesoTecho)            addCampo('Ruta de acceso al techo', lev.accesoTecho);
      if (lev.almacenamientoTemporal) addCampo('Almacenamiento temporal', lev.almacenamientoTemporal);
      if (lev.conectividadInversor)   addCampo('Conectividad en inversor', lev.conectividadInversor);
    }
    if (lev.observacionesGenerales) {
      children.push(new Paragraph({ children: [
        new TextRun({ text: 'OBSERVACIONES', size: 16, color: GRIS, break: 0 }),
        new TextRun({ text: lev.observacionesGenerales, size: 20, break: 1 }),
      ] }));
    }
    const fotosLev = lev.fotosLevantamiento || [];
    if (fotosLev.length) {
      children.push(p('Fotos del levantamiento', { bold: true, color: VERDE_MED }));
      for (const f of fotosLev.slice(0, 6)) await addImg(f.url || f);
    }
  }

  // Validación Voc
  if (sec('sec-voc')) {
    const vocData = project.garantia?.validacionVoc;
    if (vocData?.resultado) {
      addSec('Validación Voc de string');
      const resLabel = vocData.resultado === 'seguro' ? 'SEGURO ✓' : vocData.resultado === 'limite' ? 'EN EL LÍMITE ⚠' : 'EXCEDE EL LÍMITE ✗';
      const resColor = vocData.resultado === 'seguro' ? '1e7840' : vocData.resultado === 'limite' ? 'b48c00' : 'c82828';
      children.push(p(resLabel, { bold: true, size: 26, color: resColor }));
      addCampo('Voc del panel', `${vocData.vocPanel} V`);
      addCampo('Paneles en serie', `${vocData.panelesSerie}`);
      addCampo('Temp. mínima sitio', `${vocData.tMin}°C`);
      addCampo('Coef. temp. Voc', `${vocData.coefVoc}%/°C`);
      addCampo('Voc corregido por temp.', `${vocData.vocCorregido?.toFixed(2)} V`);
      addCampo('Voc total del string', `${vocData.vocString?.toFixed(2)} V`);
      addCampo('Voc máx. inversor', `${vocData.vocMaxInversor} V`);
      addCampo('Margen de seguridad', `${vocData.margen?.toFixed(1)}%`);
      if (vocData.mensaje) children.push(p(vocData.mensaje, { italic: true, color: resColor }));
    }
  }

  // Torque
  if (sec('sec-torque')) {
    const torqueData = project.checklistData?.torque || {};
    const torqueKeys = Object.keys(torqueData);
    if (torqueKeys.length) {
      addSec('Registro de torque metrológico');
      const rows = torqueKeys.map(key => {
        const t = torqueData[key];
        return t ? [t.componente || key, t.verificado ? '✓' : '○', t.especif || '—', t.aplicado != null ? `${t.aplicado} N·m` : '—'] : null;
      }).filter(Boolean);
      children.push(table(['Componente', 'Ver.', 'Especif.', 'Aplicado'], rows, { headerShading: VERDE_OSC }));
    }
  }

  // Evidencias de cierre por Bloque 1/2/3 (esquema nuevo: checklistData.fotosCierre).
  // Reemplaza las viejas "Fotos: Antes/Durante/Cierre" (documentacion.fases), cuya
  // UI de captura ya no existe y salían vacías.
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
          if (d && (d.url || d.data || d.justificacion)) items.push({ slot, d });
        }
      }
      if (!items.length) continue;
      addSec(`Evidencias de cierre — ${BLOQUE_LABELS?.[bloque] || 'Bloque ' + bloque}`);
      for (const { slot, d } of items) {
        children.push(p(slot.label, { size: 16, color: GRIS }));
        if (d.url || d.data) await addImg(d);
        else if (d.justificacion) children.push(p(`⚠ Justificado: ${d.justificacion}`, { size: 18, color: 'd97706' }));
      }
    }
  }

  // Fotos técnicas
  if (sec('sec-fotos-tec')) {
    const ft = project.garantia?.fotosTecnicas || {};
    const normFT = v => { if (!v) return []; if (typeof v === 'string') return [{ url: v }]; return Array.isArray(v) ? v : []; };
    const slots = [
      { key: 'tableroAC',          label: 'Tablero AC terminado'    },
      { key: 'tableroDC',          label: 'Tablero DC terminado'    },
      { key: 'protecciones',       label: 'Protecciones instaladas' },
      { key: 'inversorEnergizado', label: 'Inversor energizado'     },
      { key: 'puestaATierra',      label: 'Puesta a tierra'         },
      { key: 'etiquetado',         label: 'Etiquetado'              },
    ].filter(s => normFT(ft[s.key]).length);
    if (slots.length) {
      addSec('Fotos técnicas de instalación');
      for (const s of slots) {
        const fotos = normFT(ft[s.key]);
        for (let fi = 0; fi < fotos.length; fi++) {
          const lbl = fotos.length > 1 ? `${s.label} (${fi + 1}/${fotos.length})` : s.label;
          children.push(p(lbl, { size: 16, color: GRIS }));
          await addImg(fotos[fi].url || fotos[fi]);
        }
      }
    }
  }

  // Observaciones
  if (sec('sec-observ')) {
    const obs = project.observaciones || [];
    if (obs.length) {
      addSec('Observaciones del proyecto');
      for (const o of obs) {
        const priorColor = o.resuelta ? VERDE_MED : (o.prioridad === 'alta' ? 'c82828' : (o.prioridad === 'media' ? 'b48c00' : '2d372d'));
        const estado = o.resuelta ? 'RESUELTA' : (o.prioridad || 'normal').toUpperCase();
        children.push(new Paragraph({
          shading: { fill: 'f8faf8' },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: priorColor } },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `[${estado}] ${o.autorNombre || '—'} · ${fmtFecha(o.timestamp)}`, bold: true, color: priorColor, size: 18, break: 0 }),
            new TextRun({ text: o.texto || '', size: 20, break: 1 }),
            ...(o.resuelta && o.resueltaPor ? [new TextRun({
              text: `✓ Resuelta por ${o.resueltaPor} · ${fmtFecha(o.resueltaAt)}${o.resueltaNota ? ` — ${o.resueltaNota}` : ''}`,
              color: VERDE_MED, size: 16, break: 1,
            })] : []),
          ],
        }));
      }
    }
  }

  // Historial
  if (sec('sec-historial')) {
    const log = project.statusLog || [];
    if (log.length) {
      addSec('Historial de cambios de estado');
      const rows = [...log].reverse().map(e => [
        ESTADOS_LABEL[e.from] || e.from || '—',
        { text: ESTADOS_LABEL[e.to] || e.to, bold: true },
        e.by || '—', fmtFecha(e.at), e.nota || '',
      ]);
      children.push(table(['De', 'A', 'Por', 'Fecha', 'Nota'], rows, { headerShading: VERDE_OSC }));
    }
  }

  // Auditoría
  if (sec('sec-auditoria') && project.auditoria?.resultado) {
    const aud = project.auditoria;
    addSec('Auditoría técnica');
    addCampo('Tipo', aud.tipo === 'interna' ? 'Interna Ecofit' : 'Externa');
    addCampo('Auditor', aud.auditor?.nombre);
    if (aud.auditor?.empresa) addCampo('Empresa', aud.auditor.empresa);
    addCampo('Norma', aud.norma);
    addCampo('Resultado', aud.resultado?.replace(/_/g, ' ').toUpperCase());

    const esFormalW   = aud.modo === 'formal';
    const itemsAudW   = esFormalW ? CHECKLIST_FORMAL : CHECKLIST_RAPIDO;
    const resultsAudW = esFormalW ? (aud.formalChecklist || {}) : (aud.rapidoChecklist || {});
    const obsAudW     = aud.formalObs || {};
    children.push(p(`Checklist técnico (${esFormalW ? 'Formal' : 'Rápido'})`, { bold: true }));
    const rowsAud = itemsAudW.map(item => {
      const r   = resultsAudW[item.id];
      const ok  = r === 'ok' || r === 'si';
      const nc  = r === 'no_cumple' || r === 'no';
      const mark  = ok ? '✓ OK' : nc ? '✗ No cumple' : r === 'na' ? 'N/A' : '—';
      const color = ok ? '1e7840' : nc ? 'c82828' : GRIS;
      const label = obsAudW[item.id] ? `${item.label} (${obsAudW[item.id]})` : item.label;
      return [label, { text: mark, color, bold: true }];
    });
    children.push(table(['Ítem', 'Resultado'], rowsAud, { headerShading: VERDE_OSC }));

    const medW     = aud.mediciones || {};
    const medValsW = MEDICIONES.filter(m => medW[m.id]);
    if (medValsW.length) {
      children.push(p('Mediciones', { bold: true }));
      children.push(table(['Medición', 'Valor', 'Referencia'],
        medValsW.map(m => [m.label, `${medW[m.id]} ${m.unit}`, m.ref]), { headerShading: VERDE_OSC }));
    }

    if (aud.observaciones) {
      children.push(new Paragraph({ children: [
        new TextRun({ text: 'OBSERVACIONES', size: 16, color: GRIS, break: 0 }),
        new TextRun({ text: aud.observaciones, size: 20, break: 1 }),
      ] }));
    }
    if (aud.docFirmado) await addImg(aud.docFirmado, 530);
  }

  children.push(hr());
  children.push(p(`Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}`,
    { size: 16, color: GRIS, alignment: AlignmentType.CENTER }));

  const doc = newDoc(children);
  await saveDocx(doc, `EFS-Tecnico-${project.displayId}`);
  const { toast } = await import('./utils.js');
  toast('Word generado ✓', 'success');
};
