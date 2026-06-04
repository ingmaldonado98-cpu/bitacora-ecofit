// map.js — Mapa de instalaciones con Leaflet + OpenStreetMap

import { projects } from './db.js';
import { esc, ESTADOS } from './utils.js';
import { icon } from './icons.js';

export async function renderMapView(session) {
  const all = await projects.getAll();
  const conCoords = all.filter(p => p.coordenadas?.lat && p.coordenadas?.lng);

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#dashboard')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Mapa de instalaciones</h1>
    <span class="hdr-sub">${conCoords.length} de ${all.length} con GPS</span>
  </div>

  ${!navigator.onLine ? `
  <div class="map-offline-banner">
    ${icon('wifi-slash', 16)} Sin conexión — el mapa requiere internet para mostrar las imágenes del terreno,
    pero los marcadores se muestran con los datos guardados.
  </div>` : ''}

  <div id="ecofit-map" class="map-container"></div>

  ${conCoords.length === 0 ? `
  <div class="empty-state" style="margin-top:16px">
    <div class="empty-state-icon">📍</div>
    <p class="empty-state-msg">Ningún proyecto tiene coordenadas GPS aún.<br>
      Agrégalas al editar un proyecto.</p>
    <button class="empty-state-cta" onclick="navigate('#dashboard')">Ver proyectos</button>
  </div>` : ''}

  <div id="map-project-list" class="map-project-list">
    ${conCoords.map(p => {
      const est = ESTADOS[p.estado] || ESTADOS.borrador;
      return `
      <div class="map-list-row" onclick="navigate('#proyecto/${p.id}'); window._mapFlyTo?.('${p.id}')">
        <div class="map-list-dot" style="background:${est.color}"></div>
        <div class="map-list-info">
          <span class="map-list-id">${esc(p.displayId)}</span>
          <span class="map-list-cliente">${esc(p.clientName || '—')}</span>
        </div>
        <span class="map-list-est" style="color:${est.color}">${est.label}</span>
      </div>`;
    }).join('')}
  </div>

  <script>
  (function initMap() {
    if (typeof L === 'undefined') {
      // Cargar Leaflet dinámicamente
      const css  = document.createElement('link');
      css.rel    = 'stylesheet';
      css.href   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);

      const js  = document.createElement('script');
      js.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = () => buildMap();
      document.head.appendChild(js);
    } else {
      buildMap();
    }
  })();

  function buildMap() {
    const el = document.getElementById('ecofit-map');
    if (!el || window._activeMap) return;

    // Centro default: La Paz, BCS
    const map = L.map('ecofit-map', { zoomControl: true }).setView([24.1426, -110.3128], 11);
    window._activeMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const proyectos = ${JSON.stringify(conCoords.map(p => ({
      id: p.id, displayId: p.displayId, clientName: p.clientName,
      estado: p.estado, lat: p.coordenadas.lat, lng: p.coordenadas.lng,
      color: (ESTADOS[p.estado] || ESTADOS.borrador).color
    })))};

    const bounds = [];
    const markerMap = {};

    proyectos.forEach(p => {
      const dotIcon = L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:' + p.color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });

      const marker = L.marker([p.lat, p.lng], { icon: dotIcon })
        .bindPopup('<strong>' + p.displayId + '</strong><br>' + (p.clientName || '—') +
          '<br><button onclick="navigate(\\\'#proyecto/' + p.id + '\\\')" class="btn-map-popup">Ver proyecto</button>')
        .addTo(map);

      markerMap[p.id] = marker;
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

    // Función para volar a un marcador desde la lista
    window._mapFlyTo = function(id) {
      if (markerMap[id]) {
        map.flyTo(markerMap[id].getLatLng(), 16, { duration: 1 });
        markerMap[id].openPopup();
      }
    };
  }
  <\/script>`;
}
