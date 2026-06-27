// pdf.js — Vista de exportación PDF/Word y punto de entrada del módulo
// Secciones extraídas: pdf-helpers.js, pdf-cliente.js, pdf-tecnico.js, pdf-levantamiento.js

import { projects } from './db.js';
import { esc } from './utils.js';
import { isAdmin } from './auth.js';
import { icon } from './icons.js';
import './pdf-helpers.js';       // sin exports propios que pdf.js necesite directamente
import './pdf-cliente.js';       // registra window.exportarPDFCliente
import './pdf-tecnico.js';       // registra window.exportarPDFTecnico
import './word-tecnico.js';      // registra window.exportarWordTecnico
import './pdf-levantamiento.js'; // registra window.exportarWordLevantamiento

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
    <h1 class="hdr-title">Exportar</h1>
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
          ['sec-cierre',     '📸 Evidencias de cierre (Bloques 1-3)'],
          ['sec-observ',     '💬 Observaciones del proyecto'],
          ['sec-historial',  '🕓 Historial de cambios'],
          ['sec-auditoria',  '📋 Auditoría técnica'],
          ['sec-voc',        '⚡ Validación Voc'],
          ['sec-torque',     '🔩 Registro de torque'],
          ['sec-qr',         '📱 QR del cliente'],
        ].map(([id, label]) => `
          <label class="check-chip pdf-check ${['sec-equipos','sec-fotos-tec','sec-paneles','sec-cierre','sec-voc','sec-torque'].includes(id)?'check-active':''}">
            <input type="checkbox" id="${id}"
              ${['sec-equipos','sec-fotos-tec','sec-paneles','sec-cierre','sec-voc','sec-torque'].includes(id)?'checked':''}>
            ${label}
          </label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn-primary btn-full" onclick="exportarPDFTecnico('${projectId}')">
          ${icon('file-pdf')} PDF Técnico
        </button>
        <button class="btn-secondary btn-full" onclick="exportarWordTecnico('${projectId}')">
          ${icon('file-text')} Word (.docx)
        </button>
      </div>
    </div>
  </div>
  `;
}
