// pdf.js — Exportación PDF dual: Cliente limpio + Técnico completo

import { projects, config } from './db.js';
import { esc, fmtFecha, fmtRelativa, TIPOS_SISTEMA, ESTADOS, toast } from './utils.js';
import { isAdmin } from './auth.js';
import { icon } from './icons.js';
import { isNative, getPlugin } from './platform.js';

const ESTADOS_LABEL = Object.fromEntries(Object.entries(ESTADOS).map(([k,v]) => [k, v.label]));

const VERDE    = [27, 67, 50];   // #1B4332
const VERDE_MED= [64,145,108];   // #40916C
const VERDE_CLR= [82,183,136];   // #52B788
const BLANCO   = [255,255,255];
const GRIS     = [45, 55, 45];
const GRIS_CLR = [120,140,120];

// ── Vista selector de secciones ───────────────────────────────────────────────
export async function renderPDFExport(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  if (!isAdmin(session)) return '<p class="empty-msg">Solo Admin puede exportar PDFs.</p>';

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Exportar PDF</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <div class="pdf-options">

    <!-- PDF Cliente -->
    <div class="card pdf-card">
      <div class="pdf-card-header">
        ${icon('user', 28, 'pdf-icon-client')}
        <div>
          <h3>PDF Cliente</h3>
          <p class="hint">Visual, limpio, sin datos técnicos internos</p>
        </div>
      </div>
      <ul class="pdf-includes">
        <li>✅ Portada con nombre del cliente</li>
        <li>✅ Equipos principales (sin seriales)</li>
        <li>✅ Fotos del resultado final</li>
        <li>✅ QR del sistema</li>
        <li>✅ Datos de contacto Ecofit</li>
      </ul>
      <button class="btn-primary btn-full" onclick="exportarPDFCliente('${projectId}')">
        ${icon('file-pdf')} Generar PDF Cliente
      </button>
    </div>

    <!-- PDF Técnico -->
    <div class="card pdf-card">
      <div class="pdf-card-header">
        ${icon('wrench', 28, 'pdf-icon-tech')}
        <div>
          <h3>PDF Técnico</h3>
          <p class="hint">Completo para garantías y archivo interno</p>
        </div>
      </div>
      <p class="hint" style="margin-bottom:12px">Selecciona las secciones a incluir:</p>
      <div class="pdf-sections">
        ${[
          ['sec-equipos',    '⚡ Equipos con seriales y fotos'],
          ['sec-fotos-tec',  '📸 Fotos técnicas (tableros, inversor)'],
          ['sec-estructura', '🏗️ Estructura de montaje'],
          ['sec-paneles',    '☀️ Paneles por string con seriales'],
          ['sec-levant',     '📋 Levantamiento técnico'],
          ['sec-consumo',    '🔌 Consumo del cliente'],
          ['sec-antes',      '🔍 Fotos: Antes'],
          ['sec-durante',    '🔧 Fotos: Durante'],
          ['sec-despues',    '✅ Fotos: Cierre'],
          ['sec-observ',     '💬 Observaciones del proyecto'],
          ['sec-historial',  '🕓 Historial de cambios'],
          ['sec-auditoria',  '📋 Auditoría técnica'],
          ['sec-voc',        '⚡ Validación Voc'],
          ['sec-torque',     '🔩 Registro de torque'],
          ['sec-qr',         '📱 QR del cliente'],
        ].map(([id, label]) => `
          <label class="check-chip pdf-check ${['sec-equipos','sec-fotos-tec','sec-paneles','sec-despues','sec-voc','sec-torque'].includes(id)?'check-active':''}">
            <input type="checkbox" id="${id}"
              ${['sec-equipos','sec-fotos-tec','sec-paneles','sec-despues','sec-voc','sec-torque'].includes(id)?'checked':''}>
            ${label}
          </label>`).join('')}
      </div>
      <button class="btn-primary btn-full" style="margin-top:14px" onclick="exportarPDFTecnico('${projectId}')">
        ${icon('file-pdf')} Generar PDF Técnico
      </button>
    </div>
  </div>
  `;
}

// ── Helpers de jsPDF ──────────────────────────────────────────────────────────
function newDoc() {
  if (!window.jspdf) { alert('jsPDF no cargó. Verifica conexión a internet.'); return null; }
  return new window.jspdf.jsPDF({ orientation:'p', unit:'mm', format:'a4' });
}

let _logoB64 = null;
async function getLogoB64() {
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

function addHeader(doc, title, proyecto) {
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...VERDE_MED);
  doc.rect(0, 28, 210, 4, 'F');

  // Logo (si ya está en caché)
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

function addFooter(doc, pageNum, total) {
  doc.setFillColor(240, 248, 244);
  doc.rect(0, 284, 210, 13, 'F');
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_CLR);
  doc.text('Ecofit Solar Solutions · La Paz, BCS · México', 14, 291);
  doc.text(`Página ${pageNum} de ${total}`, 196, 291, { align:'right' });
}

function campo(doc, label, value, x, y) {
  doc.setFont('helvetica','bold');   doc.setFontSize(8);  doc.setTextColor(...GRIS_CLR);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
  doc.text(String(value || '—'), x, y + 5);
  return y + 12;
}

async function addImage(doc, b64, x, y, maxW, maxH) {
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

// ── Android: guardar PDF en Documentos/Ecofit ────────────────────────────────
async function _saveNative(doc, filename) {
  const Filesystem = getPlugin('Filesystem');
  if (!Filesystem) { doc.save(filename); return; }
  try {
    const base64 = doc.output('datauristring').split(',')[1];
    await Filesystem.writeFile({
      path: `Ecofit/${filename}`,
      data: base64,
      directory: 'DOCUMENTS',
      recursive: true,
    });
    toast(`PDF guardado en Documentos/Ecofit/${filename}`, 'success', 5000);
  } catch (err) {
    doc.save(filename);
    toast('No se pudo guardar en Documentos — descargado como archivo', 'warning');
  }
}

// ── Guardar PDF: nativo (Android) o descarga (web) ───────────────────────────
async function _savePDF(doc, filename) {
  if (isNative()) {
    await _saveNative(doc, filename);
  } else {
    doc.save(filename);
    await _tryOneDriveSave(doc, filename);
  }
}

// ── OneDrive: guardar PDF si hay carpeta configurada ─────────────────────────
async function _tryOneDriveSave(doc, filename) {
  try {
    const { getFolderHandle, saveFile } = await import('./onedrive.js');
    const handle = await getFolderHandle();
    if (!handle) return;
    const blob = doc.output('blob');
    const path = await saveFile(filename, blob, 'application/pdf');
    toast(`☁️ Guardado en OneDrive: ${path}`, 'success', 5000);
  } catch { /* OneDrive es opcional — no interrumpir si falla */ }
}

// ── PDF Cliente ───────────────────────────────────────────────────────────────
window.exportarPDFCliente = async function(projectId) {
  const [project, contacto] = await Promise.all([
    projects.getById(projectId),
    config.get('contactoEcofit'),
    getLogoB64(),
  ]);
  const doc = newDoc(); if (!doc) return;
  const tipo = TIPOS_SISTEMA[project.tipoSistema];
  const totalPaneles = (project.garantia?.paneles?.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp||0)/1000);

  // Portada
  addHeader(doc, 'Documentación de instalación fotovoltaica', project);
  let y = 44;
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(...VERDE);
  doc.text(project.clientName || 'Cliente', 14, y); y += 8;

  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
  if (project.direccion) { doc.text(project.direccion, 14, y); y += 6; }

  y += 4;
  y = campo(doc,'Tipo de sistema', tipo?.label || project.tipoSistema, 14, y);
  y = campo(doc,'Capacidad instalada', `${totalKwp.toFixed(2)} kWp`, 14, y);
  y = campo(doc,'Paneles solares', `${totalPaneles} paneles · ${project.garantia?.paneles?.marca||''} ${project.garantia?.paneles?.modelo||''}`, 14, y);
  y = campo(doc,'Fecha de instalación', fmtFecha(project.fechaInicio), 14, y);
  if (project.fechaEstimada) y = campo(doc,'Fecha de entrega estimada', fmtFecha(project.fechaEstimada), 14, y);

  // Equipos (sin seriales)
  const equipos = project.garantia?.equipos || [];
  if (equipos.length) {
    y += 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
    doc.text('Equipos instalados', 14, y); y += 6;
    equipos.forEach(eq => {
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
      doc.text(`• ${eq.marca} ${eq.modelo}`, 18, y); y += 6;
    });
  }

  // Foto del sistema
  const fotoSistema = project.garantia?.fotoSistema;
  if (fotoSistema) {
    if (y > 200) { doc.addPage(); addHeader(doc,'',project); y = 44; }
    y += 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
    doc.text('Sistema instalado', 14, y); y += 6;
    y = await addImage(doc, fotoSistema, 14, y, 120, 80);
  }

  // Fotos de Cierre (nueva estructura techo.cierre con fallback legacy despues)
  const _fases = project.documentacion?.fases || {};
  const fotos = _fases.techo?.cierre?.length ? _fases.techo.cierre : (_fases.despues || []);
  if (fotos.length) {
    doc.addPage(); addHeader(doc,'Resultado final', project); y = 44;
    let col = 0;
    for (const f of fotos.slice(0,6)) {
      const fx = 14 + col * 98;
      y = await addImage(doc, f.data, fx, y, 88, 65);
      col = (col+1)%2;
      if (col===0 && fotos.indexOf(f)<fotos.length-1) y += 4;
    }
  }

  // Contacto
  doc.addPage(); addHeader(doc,'Contacto', project); y = 44;
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...VERDE);
  doc.text('Ecofit Solar Solutions', 14, y); y += 8;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
  doc.text(contacto || 'La Paz, Baja California Sur · México', 14, y);

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i=1;i<=totalPages;i++) { doc.setPage(i); addFooter(doc,i,totalPages); }

  const filenameC = `EFS-Cliente-${project.displayId}-${project.clientName?.replace(/\s+/g,'_')}.pdf`;
  await _savePDF(doc, filenameC);
};

// ── PDF Técnico ───────────────────────────────────────────────────────────────
window.exportarPDFTecnico = async function(projectId) {
  const [project] = await Promise.all([projects.getById(projectId), getLogoB64()]);
  const doc = newDoc(); if (!doc) return;

  const sec = (id) => document.getElementById(id)?.checked;
  const tipo = TIPOS_SISTEMA[project.tipoSistema];
  const totalPaneles = (project.garantia?.paneles?.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp||0)/1000);

  addHeader(doc, 'Expediente técnico — Uso interno', project);
  let y = 44;

  // Datos del proyecto
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...VERDE);
  doc.text(project.displayId, 14, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
  doc.text(project.clientName || '—', 14, y); y += 6;
  if (project.direccion) { doc.text(project.direccion, 14, y); y += 6; }
  if (project.coordenadas?.lat) {
    const lat = Number(project.coordenadas.lat).toFixed(6);
    const lng = Number(project.coordenadas.lng).toFixed(6);
    y = campo(doc, 'Coordenadas GPS', `${lat}, ${lng}`, 14, y);
  }
  if (project.clienteTelefono) {
    y = campo(doc, 'Tel. cliente', project.clienteTelefono, 14, y);
  }
  y = campo(doc,'Tipo de sistema',tipo?.label||'—',14,y);
  y = campo(doc,'Estado', ESTADOS_LABEL[project.estado] || project.estado, 14,y);
  y = campo(doc,'Capacidad',`${totalKwp.toFixed(2)} kWp · ${totalPaneles} paneles`,14,y);
  if (project.fechaEstimada) y = campo(doc,'Fecha estimada entrega',fmtFecha(project.fechaEstimada),14,y);
  // Notas internas del proyecto
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
      if (eq.fotoPlaca) { y = await addImage(doc,eq.fotoPlaca,18,y,60,45); }
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

  // Paneles por string
  if (sec('sec-paneles')) {
    doc.addPage(); addHeader(doc,'Paneles por string — Números de serie',project); y=44;
    const pan = project.garantia?.paneles;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text(`${pan?.marca||''} ${pan?.modelo||''} · ${pan?.wp||0}Wp`, 14, y); y+=8;

    for (const str of (pan?.strings||[])) {
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE_MED);
      doc.text(str.nombre, 14, y); y+=5;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      (str.paneles||[]).forEach((p,i) => {
        const col = i%2, fx = 14+col*93;
        if (col===0 && i>0) y+=5;
        doc.text(`Panel ${p.letra}: ${p.serial||'—'}`, fx, y);
        if (col===1) y+=5;
      });
      y += 8;
      if (y>260) { doc.addPage(); addHeader(doc,'Paneles (cont.)',project); y=44; }
    }
  }

  // Levantamiento
  if (sec('sec-levant')) {
    doc.addPage(); addHeader(doc,'Levantamiento técnico',project); y=44;
    const lev = project.documentacion?.levantamiento||{};
    y=campo(doc,'Tipo de techo',lev.tipTecho,14,y);
    if (lev.materialCubierta) y=campo(doc,'Material de cubierta',lev.materialCubierta,14,y);
    y=campo(doc,'Orientación',lev.orientacion,14,y);
    if (lev.numPisos) y=campo(doc,'Número de pisos',`${lev.numPisos}`,14,y);
    if (lev.tipoSujecion) y=campo(doc,'Tipo de sujeción',lev.tipoSujecion,14,y);
    const dimText = lev.anchoTecho && lev.largoTecho
      ? `${lev.anchoTecho} m × ${lev.largoTecho} m = ${(lev.anchoTecho*lev.largoTecho).toFixed(1)} m²`
      : (lev.areaDisponible ? `${lev.areaDisponible} m²` : '—');
    y=campo(doc,'Área disponible',dimText,14,y);
    y=campo(doc,'Inclinación',`${lev.inclinacion||'—'}°`,14,y);
    y=campo(doc,'Dist. tablero→inversor',`${lev.distTableroInversor||'—'} m`,14,y);
    y=campo(doc,'Dist. inversor→paneles',`${lev.distInversorPaneles||'—'} m`,14,y);
    y=campo(doc,'Servicio CFE',lev.tipoServicioCFE,14,y);
    y=campo(doc,'Tierra física',lev.tierraFisica,14,y);
    y=campo(doc,'Centro de carga',lev.centroCarga,14,y);
    if (lev.sombras?.checklist?.length) {
      y=campo(doc,'Obstáculos de sombra',lev.sombras.checklist.join(', '),14,y);
    }
    if (lev.observacionesGenerales) {
      const lineas = doc.splitTextToSize(lev.observacionesGenerales, 180);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
      doc.text('OBSERVACIONES', 14, y); y+=4;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      doc.text(lineas, 14, y); y += lineas.length * 5;
    }
    // Fotos del levantamiento
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

  // Validación Voc
  const vocData = project.garantia?.validacionVoc;
  if (sec('sec-voc') && vocData?.resultado) {
    if (y > 200) { doc.addPage(); addHeader(doc,'Validación Voc',project); y=44; }
    else { y+=4; }
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...VERDE);
    doc.text('Validación Voc de string', 14, y); y+=7;
    const resLabel = vocData.resultado === 'seguro' ? 'SEGURO ✓'
                   : vocData.resultado === 'limite' ? 'EN EL LÍMITE ⚠'
                   : 'EXCEDE EL LÍMITE ✗';
    const resColor = vocData.resultado === 'seguro' ? [30,120,60]
                   : vocData.resultado === 'limite' ? [180,140,0]
                   : [200,40,40];
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
      const spec = t.especif || '—';
      doc.text(`${verificado}  ${esc(t.componente || key)}  ·  Especif: ${spec}  ·  Aplicado: ${aplicado}`, 18, y); y+=5;
      if (y>260) { doc.addPage(); addHeader(doc,'Torque (cont.)',project); y=44; }
    }
  }

  // QR del cliente
  if (sec('sec-qr') && window.QRCode) {
    doc.addPage(); addHeader(doc,'QR del sistema',project); y=44;
    try {
      const canvas = document.createElement('canvas');
      const qrUrl  = `${location.origin}${location.pathname}#proyecto/${projectId}`;
      await new Promise((res,rej) => {
        new window.QRCode(canvas, { text: qrUrl, width:200, height:200,
          colorDark:'#1B4332', colorLight:'#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
        setTimeout(res, 300); // QRCode.js es sync pero la imagen puede tardar un frame
      });
      const qrB64 = canvas.toDataURL('image/png');
      y = campo(doc,'URL del sistema',`${location.origin}${location.pathname}#proyecto/${projectId}`,14,y);
      y = await addImage(doc, qrB64, 14, y, 60, 60);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
      doc.text('Escanear para acceder al expediente digital del sistema', 14, y); y+=10;
    } catch (err) {
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      doc.text(`URL: ${location.origin}${location.pathname}#proyecto/${projectId}`, 14, y); y+=6;
    }
  }

  // Fotos por fase — compatible con nueva estructura (sitio.subfase) y legacy
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
    doc.addPage(); addHeader(doc,titulo,project); y=44;
    let col=0;
    for (const f of fotos) {
      const fx = 14 + col*98;
      if (f.nota) { doc.setFontSize(8); doc.setTextColor(...GRIS_CLR); doc.text(f.nota,fx,y); y+=4; }
      const newY = await addImage(doc,f.data,fx,y,88,65);
      if (col===1) { y=newY; col=0; } else col=1;
      if (y>230) { doc.addPage(); addHeader(doc,titulo+' (cont.)',project); y=44; col=0; }
    }
  }

  // Fotos técnicas (retrocompat: string legacy o array nuevo)
  if (sec('sec-fotos-tec')) {
    const ft = project.garantia?.fotosTecnicas || {};
    const normFT = v => {
      if (!v) return [];
      if (typeof v === 'string') return [{ url: v }];
      return Array.isArray(v) ? v : [];
    };
    const slots = [
      { key:'tableroAC',           label:'Tablero AC terminado'       },
      { key:'tableroDC',           label:'Tablero DC terminado'       },
      { key:'protecciones',        label:'Protecciones instaladas'    },
      { key:'inversorEnergizado',  label:'Inversor energizado'        },
      { key:'puestaATierra',       label:'Puesta a tierra'            },
      { key:'etiquetado',          label:'Etiquetado'                 },
    ].filter(s => normFT(ft[s.key]).length);

    if (slots.length) {
      doc.addPage(); addHeader(doc,'Fotos técnicas de instalación',project); y=44;
      let col=0;
      for (const s of slots) {
        const fotos = normFT(ft[s.key]);
        for (let fi=0; fi<fotos.length; fi++) {
          const fx = 14 + col*98;
          const lbl = fotos.length > 1 ? `${s.label.toUpperCase()} (${fi+1}/${fotos.length})` : s.label.toUpperCase();
          doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GRIS_CLR);
          doc.text(lbl, fx, y); y+=4;
          const newY = await addImage(doc, fotos[fi].url || fotos[fi], fx, y, 88, 62);
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
        const fromL = ESTADOS_LABEL[e.from] || e.from;
        const toL   = ESTADOS_LABEL[e.to]   || e.to;
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

    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...VERDE);
    doc.text('Checklist técnico', 14, y); y+=6;
    (aud.checklist||[]).forEach(item => {
      const label = ['','Polaridad correcta','Torque verificado','Tierra física','Protecciones AC',
        'Protecciones DC','Etiquetado','Canalización','Impermeabilización',
        'Voltajes correctos','Equipo energizado','Monitoreo / Comunicación'][item.itemId] || '';
      const mark = item.resultado==='ok'?'✓' : item.resultado==='no_cumple'?'✗' : 'N/A';
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      doc.text(`${mark}  ${label}`, 18, y); y+=5;
    });
    if (aud.observaciones){ y+=2; y=campo(doc,'Observaciones',aud.observaciones,14,y); }
    if (aud.docFirmado){ y=await addImage(doc,aud.docFirmado,14,y,100,70); }
  }

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i=1;i<=totalPages;i++) { doc.setPage(i); addFooter(doc,i,totalPages); }

  const filenameT = `EFS-Tecnico-${project.displayId}.pdf`;
  await _savePDF(doc, filenameT);
};
