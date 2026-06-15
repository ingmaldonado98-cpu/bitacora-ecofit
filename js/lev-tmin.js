// lev-tmin.js — Temperatura minima: constantes y recalculo automatico

import { TMIN_ESTADOS, TMIN_ZONAS, TMIN_ZONA_DESC } from './clima.js';

// Alias locales para compatibilidad con el código existente en este módulo
const _TMIN_CIUDADES  = TMIN_ESTADOS;
const _TMIN_ZONAS     = TMIN_ZONAS;
const _TMIN_ZONA_DESC = TMIN_ZONA_DESC;

export function _tminDescripcion(estado, zona, tMinFinal) {
  if (!estado || estado === 'otro') return '';
  const c = _TMIN_CIUDADES.find(x => x.nombre === estado);
  const z = _TMIN_ZONAS.find(x => x.key === (zona || 'valle'));
  if (!c || !z) return '';
  const base   = c.tMin;
  const offset = z.offset;
  const signo  = offset >= 0 ? `+${offset}` : `${offset}`;
  return `${base}°C (estado) ${signo}°C (zona) = ${tMinFinal ?? (base + offset)}°C`;
}

window._onTMinRecalc = function() {
  const selCiudad = document.querySelector('[name="tMinCiudad"]');
  const selZona   = document.querySelector('[name="tMinZona"]');
  const inp       = document.getElementById('lev-tmin-input');
  const desglose  = document.getElementById('lev-tmin-desglose');
  const desc      = document.getElementById('lev-tmin-desc');
  if (!selCiudad || !inp) return;

  const ciudad = selCiudad.value;
  const zona   = selZona?.value || 'valle';

  if (!ciudad || ciudad === 'otro') {
    // Manual: desbloquear campo
    inp.removeAttribute('readonly');
    inp.style.background = '';
    if (!ciudad) inp.value = '3';
    if (desglose) desglose.style.display = 'none';
  } else {
    // Auto: calcular ciudad + zona
    const optC  = selCiudad.options[selCiudad.selectedIndex];
    const optZ  = selZona?.options[selZona.selectedIndex];
    const base  = parseFloat(optC?.dataset?.tmin || '3');
    const off   = parseFloat(optZ?.dataset?.offset || '0');
    const final = base + off;
    inp.value = final;
    inp.setAttribute('readonly', true);
    inp.style.background = 'var(--surface2)';
    if (desglose) desglose.style.display = 'flex';
    if (desc) desc.textContent = _tminDescripcion(ciudad, zona, final);
  }
};

export { _TMIN_CIUDADES, _TMIN_ZONAS, _TMIN_ZONA_DESC };