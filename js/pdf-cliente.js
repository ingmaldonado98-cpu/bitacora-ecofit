// pdf-cliente.js — PDF limpio para el cliente final
// Extraído de pdf.js. Registra window.exportarPDFCliente.

import { projects } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA } from './utils.js';
import {
  newDoc, getLogoB64, addHeader, addFooter, campo, addImage,
  savePDF, pdfYield, btnLoading, btnDone, getContacto,
  VERDE, GRIS,
} from './pdf-helpers.js';

window.exportarPDFCliente = async function(projectId) {
  const btn = document.querySelector('.pdf-card .btn-primary');
  btnLoading(btn, 'Generando…');
  const { toast } = await import('./utils.js');
  toast('Generando PDF cliente…', 'info', 0);
  await pdfYield();
  try {
    const [project, contacto] = await Promise.all([
      projects.getById(projectId),
      getContacto(),
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

    await savePDF(doc, `EFS-Cliente-${project.displayId}-${project.clientName?.replace(/\s+/g,'_')}.pdf`);
  } catch (err) {
    console.error('[PDF] Cliente:', err);
    const { toast } = await import('./utils.js');
    toast('Error al generar PDF — intenta de nuevo', 'error');
  } finally {
    btnDone(btn);
  }
};
