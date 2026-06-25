// pdf-garantia.js — Certificado de garantía (.docx real — OOXML), generable desde el módulo Garantía.
// Mismo patrón que pdf-avance.js: fotos incrustadas con fotoToImageBuffer.

import { projects } from './db.js';
import { fmtFecha, toast, fotoToImageBuffer } from './utils.js';
import { GARANTIAS_STD } from './garantia.js';
import { newDoc, heading1, heading2, p, table, hr, imageBlock,
         AlignmentType, saveDocx } from './word-helpers.js';

const VERDE = '16a34a';

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

  const children = [];
  const addSec = (title) => children.push(heading2(title, VERDE));
  const addImg = async (foto, caption, maxDimPx = 320) => {
    const img = await fotoToImageBuffer(foto, maxDimPx);
    children.push(...imageBlock(img, caption, '[Foto no disponible — revisar conexión]'));
  };

  children.push(heading1('Certificado de Garantía', VERDE));
  children.push(p(project.displayId, { bold: true, size: 28, color: '111827' }));
  children.push(p(`Generado: ${fmtFecha(new Date().toISOString())}`, { color: '6b7280', size: 18 }));

  // ── Vigencias ────────────────────────────────────────────────────────────
  addSec('Vigencia de garantías');
  if (fi) {
    const rows = GARANTIAS_STD.map(gar => {
      const base  = new Date(fi);
      const vence = new Date(base);
      vence.setFullYear(vence.getFullYear() + gar.anios);
      const diasLeft = Math.ceil((vence - new Date()) / 86400000);
      const estado = diasLeft < 0 ? 'Vencida' : diasLeft < 180 ? `Próxima a vencer (${diasLeft} días)` : 'Vigente';
      const color  = diasLeft < 0 ? 'dc2626' : diasLeft < 180 ? 'd97706' : '16a34a';
      const fechaStr = vence.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      return [gar.label, fechaStr, { text: estado, bold: true, color }];
    });
    children.push(table(['Garantía', 'Vence', 'Estado'], rows, { headerShading: 'f3f4f6', headerColor: '111827' }));
    children.push(p(`Fecha de instalación / comisionamiento: ${fmtFecha(fi)}`, { size: 16, color: '6b7280' }));
  } else {
    children.push(p('Sin fecha de instalación registrada — no se pudo calcular la vigencia.', { size: 18, color: 'dc2626' }));
  }

  // ── Equipos ──────────────────────────────────────────────────────────────
  addSec('Equipos instalados');
  const equipos = g.equipos || [];
  if (equipos.length) {
    const rows = equipos.map(eq => [
      TIPOS_EQUIPO_LABEL[eq.tipo] || eq.tipo || '—',
      `${eq.marca || ''} ${eq.modelo || ''}`.trim() || '—',
      eq.serial || '—',
    ]);
    children.push(table(['Tipo', 'Marca / Modelo', 'Serial'], rows, { headerShading: 'f3f4f6', headerColor: '111827' }));
  } else {
    children.push(p('Sin equipos registrados.', { size: 18, color: '6b7280' }));
  }

  // ── Resultado de Voc ─────────────────────────────────────────────────────
  addSec('Validación de tensión en circuito abierto (Voc)');
  const vd = g.validacionVoc;
  if (vd?.resultado) {
    const color = vd.resultado === 'seguro' ? '16a34a' : vd.resultado === 'excede' ? 'dc2626' : 'd97706';
    children.push(p(vd.mensaje || vd.resultado, { bold: true, color, size: 18 }));
    children.push(table(['Medición', 'Valor'], [
      ['Voc panel (STC)', `${vd.vocPanel ?? '—'} V`],
      ['Paneles en serie', `${vd.panelesSerie ?? '—'}`],
      ['Temperatura mínima histórica', `${vd.tMin ?? '—'} °C`],
      ['Coeficiente de temperatura', `${vd.coefVoc ?? '—'} %/°C`],
      ['Voc corregido por string', `${vd.vocString?.toFixed(2) ?? '—'} V`],
      ['Voc máx. del inversor', `${vd.vocMaxInversor ?? '—'} V`],
    ], { headerShading: 'f3f4f6', headerColor: '111827' }));
  } else {
    children.push(p('Validación de Voc no realizada todavía.', { size: 18, color: 'dc2626' }));
  }

  // ── Evidencia fotográfica del arreglo ───────────────────────────────────
  addSec('Evidencia fotográfica del arreglo de paneles');
  const fFrontal = g.paneles?.fotoArregloFrontal;
  const fPerfil  = g.paneles?.fotoArregloPerfil;
  if (fFrontal || fPerfil) {
    if (fFrontal) await addImg(fFrontal, 'Vista frontal');
    if (fPerfil)  await addImg(fPerfil, 'Vista de perfil');
  } else {
    children.push(p('Sin evidencia fotográfica registrada.', { size: 18, color: '6b7280' }));
  }

  children.push(hr());
  children.push(p(`Ecofit Solar Solutions · La Paz, BCS · México · ${fmtFecha(new Date().toISOString())}`,
    { size: 16, color: '6b7280', alignment: AlignmentType.CENTER }));

  const doc = newDoc(children);
  await saveDocx(doc, `EFS-Certificado-Garantia-${project.displayId}`);
  toast('Certificado de garantía generado ✓', 'success');
}

window.exportarCertificadoGarantia = exportarCertificadoGarantia;
