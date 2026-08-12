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
      await projects.setField(projectId, 'documentacion.levantamiento.gpsLat', lat);
      await projects.setField(projectId, 'documentacion.levantamiento.gpsLng', lng);
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
  await projects.setField(projectId, 'documentacion.levantamiento.gpsLat', null);
  await projects.setField(projectId, 'documentacion.levantamiento.gpsLng', null);
  navigate(window.location.hash);
};
