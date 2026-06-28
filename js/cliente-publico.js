// cliente-publico.js — Tarjeta pública del cliente (sin login)
// Ruta #cliente/<projectId> — lee SOLO publicCards/{id} (ver firestore.rules),
// nunca el documento completo del proyecto.

import { publicCards } from './db.js';
import { esc } from './utils.js';
import { icon } from './icons.js';

export async function renderClientePublico(projectId) {
  const data = await publicCards.get(projectId).catch(() => null);

  if (!data) {
    return `
    <div class="card qr-card" style="margin:40px auto;max-width:420px">
      <div class="qr-header">
        ${icon('sun', 32, 'qr-sun')}
        <div>
          <h2 class="qr-empresa">Ecofit Solar Solutions</h2>
          <p class="qr-sub">La Paz, Baja California Sur</p>
        </div>
      </div>
      <p class="empty-msg" style="margin-top:16px">Información no disponible para este sistema.</p>
    </div>`;
  }

  return `
  <div class="card qr-card" style="margin:40px auto;max-width:420px">
    <div class="qr-header">
      ${icon('sun', 32, 'qr-sun')}
      <div>
        <h2 class="qr-empresa">Ecofit Solar Solutions</h2>
        <p class="qr-sub">La Paz, Baja California Sur</p>
      </div>
    </div>

    <div class="qr-info">
      <div class="qr-row"><span>Cliente</span><strong>${esc(data.cliente || '—')}</strong></div>
      <div class="qr-row"><span>Tipo de sistema</span><strong>${esc(data.tipo || '—')}</strong></div>
      <div class="qr-row"><span>Capacidad</span><strong>${esc(data.capacidad || '—')}</strong></div>
      <div class="qr-row"><span>Paneles</span><strong>${esc(String(data.paneles ?? '—'))}</strong></div>
      ${data.baterias ? `<div class="qr-row"><span>Baterías</span><strong>${esc(String(data.baterias))}${data.capacidadBaterias ? ` · ${esc(data.capacidadBaterias)}` : ''}</strong></div>` : ''}
      ${data.fecha ? `<div class="qr-row"><span>Fecha de instalación</span><strong>${esc(data.fecha)}</strong></div>` : ''}
      ${data.equipos ? `<div class="qr-row"><span>Equipos</span><strong style="white-space:pre-line">${esc(data.equipos)}</strong></div>` : ''}
      ${data.contacto ? `<div class="qr-row"><span>Contacto</span><strong style="white-space:pre-line">${esc(data.contacto)}</strong></div>` : ''}
    </div>
  </div>`;
}
