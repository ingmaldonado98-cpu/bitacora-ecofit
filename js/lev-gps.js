// lev-gps.js — GPS capture / clear para el levantamiento
// Extraído de documentacion.js. window._captureGps y window._clearGps.

import { projects } from './db.js';
import { toast } from './utils.js';

window._captureGps = function(projectId) {
  if (!navigator.geolocation) { toast('GPS no disponible en este dispositivo', 'warn'); return; }
  toast('Obteniendo ubicación…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lng = parseFloat(pos.coords.longitude.toFixed(6));
      const p   = await projects.getById(projectId);
      p.documentacion = p.documentacion || {};
      p.documentacion.levantamiento = p.documentacion.levantamiento || {};
      p.documentacion.levantamiento.gpsLat = lat;
      p.documentacion.levantamiento.gpsLng = lng;
      await projects.update(projectId, { documentacion: p.documentacion });
      toast(`📍 GPS guardado: ${lat}, ${lng}`, 'success');
      navigate(window.location.hash);
    },
    () => toast('No se pudo obtener la ubicación — verifica los permisos', 'warn'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window._clearGps = async function(projectId) {
  const p = await projects.getById(projectId);
  if (!p.documentacion?.levantamiento) return;
  p.documentacion.levantamiento.gpsLat = null;
  p.documentacion.levantamiento.gpsLng = null;
  await projects.update(projectId, { documentacion: p.documentacion });
  navigate(window.location.hash);
};
