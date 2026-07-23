// qr.js — QR del cliente (sin nombre del técnico, sin seriales)

import { projects, config, publicCards } from './db.js';
import { esc, fmtFecha, TIPOS_SISTEMA } from './utils.js';
import { icon } from './icons.js';
import { getSerialesFlat } from './gar-paneles.js';

export async function renderQR(projectId, session) {
  const [project, contacto] = await Promise.all([
    projects.getById(projectId),
    config.get('contactoEcofit'),
  ]);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const tipo = TIPOS_SISTEMA[project.tipoSistema];
  const totalPaneles = getSerialesFlat(project.garantia).length;
  const totalKwp = totalPaneles * ((project.garantia?.paneles?.wp || 0) / 1000);

  const equiposPublicos = (project.garantia?.equipos || []).map(eq =>
    `${eq.marca} ${eq.modelo}`
  ).join('\n');

  const baterias = (project.garantia?.equipos || []).filter(eq => eq.tipo === 'bateria');
  const totalBatKwh = baterias.reduce((s, b) => s + (b.capacidadKwh || 0), 0);

  // Datos que verá el cliente (sin seriales, sin fotos internas) — se escriben
  // a publicCards/{id} (lectura pública vía firestore.rules) y el QR codifica
  // la URL a #cliente/{id}, no el JSON directo, para que cualquier cámara lo
  // abra como página en vez de mostrar texto crudo.
  const cardData = {
    empresa: 'Ecofit Solar Solutions',
    proyecto: project.displayId,
    cliente: project.clientName || '',
    tipo: tipo?.label || project.tipoSistema || '',
    capacidad: `${totalKwp.toFixed(2)} kWp`,
    paneles: totalPaneles,
    fecha: fmtFecha(project.fechaInicio) || '',
    equipos: equiposPublicos,
    ...(baterias.length ? {
      baterias: baterias.length,
      ...(totalBatKwh ? { capacidadBaterias: `${totalBatKwh.toFixed(2)} kWh` } : {}),
    } : {}),
    contacto: contacto || '',
  };
  // Si esto falla (offline, permisos), el QR se ve bien aquí pero el cliente
  // que lo escanee en obra verá "Información no disponible" — avisar al
  // técnico en vez de fallar en silencio.
  let cardSyncError = false;
  try {
    await publicCards.set(projectId, cardData);
  } catch (err) {
    cardSyncError = true;
    console.warn('publicCards.set failed:', err);
  }

  const qrUrl = `${location.origin}${location.pathname}#cliente/${projectId}`;

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">QR del cliente</h1>
  </div>

  ${cardSyncError ? `
  <div class="qr-sync-warn">
    ${icon('warning', 16)}
    <span>No se pudo sincronizar la información pública — el cliente podría ver "Información no disponible" al escanear. Revisa tu conexión y vuelve a abrir esta pantalla.</span>
  </div>` : ''}

  <div class="card qr-card">
    <div class="qr-header">
      ${icon('sun', 32, 'qr-sun')}
      <div>
        <h2 class="qr-empresa">Ecofit Solar Solutions</h2>
        <p class="qr-sub">La Paz, Baja California Sur</p>
      </div>
    </div>

    <div id="qr-canvas-wrap" class="qr-canvas-wrap">
      <!-- QRCode.js renderiza aquí -->
    </div>

    <div class="qr-info">
      <div class="qr-row"><span>Cliente</span><strong>${esc(project.clientName || '—')}</strong></div>
      <div class="qr-row"><span>Tipo de sistema</span><strong>${esc(tipo?.label || '—')}</strong></div>
      <div class="qr-row"><span>Capacidad</span><strong>${totalKwp.toFixed(2)} kWp</strong></div>
      <div class="qr-row"><span>Paneles</span><strong>${totalPaneles}</strong></div>
      ${baterias.length ? `<div class="qr-row"><span>Baterías</span><strong>${baterias.length}${totalBatKwh ? ` · ${totalBatKwh.toFixed(2)} kWh` : ''}</strong></div>` : ''}
      <div class="qr-row"><span>Fecha de instalación</span><strong>${fmtFecha(project.fechaInicio)}</strong></div>
      ${equiposPublicos ? `<div class="qr-row"><span>Equipos</span><strong style="white-space:pre-line">${esc(equiposPublicos)}</strong></div>` : ''}
      ${contacto ? `<div class="qr-row"><span>Contacto</span><strong style="white-space:pre-line">${esc(contacto)}</strong></div>` : ''}
    </div>

    <div class="qr-actions">
      <button class="btn-primary" onclick="descargarQR('${projectId}')">
        ${icon('download-simple')} Descargar PNG
      </button>
      ${'share' in navigator ? `
      <button class="btn-outline" onclick="compartirQR('${projectId}')">
        ${icon('share-network')} Compartir
      </button>` : ''}
    </div>
  </div>

  <script>
    (function() {
      const wrap = document.getElementById('qr-canvas-wrap');
      if (!wrap) return;
      if (window.QRCode) {
        new QRCode(wrap, {
          text: ${JSON.stringify(qrUrl)},
          width: 220, height: 220,
          colorDark: '#1B4332',
          colorLight: '#f0faf4',
          correctLevel: QRCode.CorrectLevel.M,
        });
      } else {
        wrap.innerHTML = '<p class="empty-msg-sm">QRCode.js no cargó. Verifica conexión.</p>';
      }
    })();
  </script>
  `;
}

window.compartirQR = async function(projectId) {
  const project = await projects.getById(projectId);
  const wrap  = document.getElementById('qr-canvas-wrap');
  const canvas = wrap?.querySelector('canvas');
  const img    = wrap?.querySelector('img');
  let blob = null;
  if (canvas) {
    blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  } else if (img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 220; c.height = img.naturalHeight || 220;
    c.getContext('2d').drawImage(img, 0, 0);
    blob = await new Promise(res => c.toBlob(res, 'image/png'));
  }
  const file = blob ? new File([blob], `QR-${project.displayId}.png`, { type: 'image/png' }) : null;
  try {
    await navigator.share({
      title: `QR Instalación — ${project.clientName || project.displayId}`,
      text: `Sistema solar ${project.displayId} — Ecofit Solar Solutions`,
      ...(file && navigator.canShare?.({ files: [file] }) ? { files: [file] } : {}),
    });
  } catch (e) { if (e.name !== 'AbortError') console.warn('share:', e); }
};

window.descargarQR = async function(projectId) {
  const wrap = document.getElementById('qr-canvas-wrap');
  const canvas = wrap?.querySelector('canvas');
  const img    = wrap?.querySelector('img');

  let src = null;
  if (canvas) {
    src = canvas.toDataURL('image/png');
  } else if (img) {
    // QRCode.js puede generar un <img>: dibujar en canvas para descargar
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 220; c.height = img.naturalHeight || 220;
    c.getContext('2d').drawImage(img, 0, 0);
    src = c.toDataURL('image/png');
  }

  if (!src) { alert('No se pudo generar el QR'); return; }

  const project = await projects.getById(projectId);
  const a = document.createElement('a');
  a.href = src;
  a.download = `QR-${project.displayId}-${project.clientName?.replace(/\s+/g,'_')}.png`;
  a.click();
};
