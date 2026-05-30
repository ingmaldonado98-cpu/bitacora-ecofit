// pdf.js — Exportación PDF dual: Cliente limpio + Técnico completo

import { projects, config } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA } from './utils.js';
import { isAdmin } from './auth.js';
import { icon } from './icons.js';

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
          ['sec-equipos',    '⚡ Equipos con seriales y fotos de placa'],
          ['sec-estructura', '🏗️ Estructura de montaje'],
          ['sec-paneles',    '☀️ Paneles por string con todos los seriales'],
          ['sec-levant',     '📋 Levantamiento técnico completo'],
          ['sec-consumo',    '🔌 Consumo del cliente'],
          ['sec-antes',      '🔍 Fotos: Antes'],
          ['sec-durante',    '🔧 Fotos: Durante'],
          ['sec-despues',    '✅ Fotos: Después'],
          ['sec-auditoria',  '📋 Auditoría técnica'],
          ['sec-qr',         '📱 QR del cliente'],
        ].map(([id, label]) => `
          <label class="check-chip pdf-check ${['sec-equipos','sec-paneles','sec-despues'].includes(id)?'check-active':''}">
            <input type="checkbox" id="${id}"
              ${['sec-equipos','sec-paneles','sec-despues'].includes(id)?'checked':''}>
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

function addHeader(doc, title, proyecto) {
  // Degradado simulado con rect verde
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...VERDE_MED);
  doc.rect(0, 28, 210, 4, 'F');

  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.setTextColor(...BLANCO);
  doc.text('Ecofit Solar Solutions', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(title, 14, 22);

  doc.setFontSize(9);
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

// ── PDF Cliente ───────────────────────────────────────────────────────────────
window.exportarPDFCliente = async function(projectId) {
  const [project, contacto] = await Promise.all([
    projects.getById(projectId),
    config.get('contactoEcofit'),
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

  // Fotos "Después"
  const fotos = project.documentacion?.fases?.despues || [];
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

  doc.save(`EFS-Cliente-${project.displayId}-${project.clientName?.replace(/\s+/g,'_')}.pdf`);
};

// ── PDF Técnico ───────────────────────────────────────────────────────────────
window.exportarPDFTecnico = async function(projectId) {
  const project = await projects.getById(projectId);
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
  y = campo(doc,'Tipo de sistema',tipo?.label||'—',14,y);
  y = campo(doc,'Estado',project.estado,14,y);
  y = campo(doc,'Capacidad',`${totalKwp.toFixed(2)} kWp · ${totalPaneles} paneles`,14,y);

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
    y=campo(doc,'Orientación',lev.orientacion,14,y);
    y=campo(doc,'Azimut / Inclinación',`${lev.azimut||'—'}° / ${lev.inclinacion||'—'}°`,14,y);
    y=campo(doc,'Dist. tablero→inversor',`${lev.distTableroInversor||'—'} m`,14,y);
    y=campo(doc,'Área disponible',`${lev.areaDisponible||'—'} m²`,14,y);
    y=campo(doc,'Servicio CFE',lev.tipoServicioCFE,14,y);
    y=campo(doc,'Tierra física',lev.tierraFisica,14,y);
    if (lev.sombras?.checklist?.length) {
      y=campo(doc,'Sombras',lev.sombras.checklist.join(', '),14,y);
    }
    if (lev.observacionesGenerales) {
      y=campo(doc,'Observaciones',lev.observacionesGenerales,14,y);
    }
  }

  // Fotos por fase
  for (const [id, fase, titulo] of [
    ['sec-antes','antes','Fotos: Antes'],
    ['sec-durante','durante','Fotos: Durante'],
    ['sec-despues','despues','Fotos: Después'],
  ]) {
    if (!sec(id)) continue;
    const fotos = project.documentacion?.fases?.[fase] || [];
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

  doc.save(`EFS-Tecnico-${project.displayId}.pdf`);
};
