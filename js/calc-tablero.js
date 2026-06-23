// calc-tablero.js — Tablero comparativo de BOM aplicados por técnico
// Cuenta cuántos BOM ha aplicado cada técnico (projectConfig.aplicadoPor),
// mismo patrón de agregación que inv-reports.js::_invGenConsumo (projects.getAll()
// + acumulador en memoria, sin índices nuevos de Firestore).

import { projects } from './db.js';
import { esc } from './utils.js';
import { avColor, avInitials } from './inv-state.js';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export function renderTableroPlaceholder() {
  return `
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">🏆 Tablero — BOM aplicados</h3>
      <button class="btn-outline btn-sm" onclick="_cargarTableroTecnicos()">Cargar</button>
    </div>
    <p class="hint-text">Cuántos BOM ha aplicado cada técnico desde la Calculadora, en todos los proyectos.</p>
    <div id="tablero-tecnicos-resultado"></div>
  </div>`;
}

window._cargarTableroTecnicos = async function() {
  const el = document.getElementById('tablero-tecnicos-resultado');
  if (el) el.innerHTML = `<p class="empty-msg-sm" style="padding:10px 0">Cargando…</p>`;

  const todos = await projects.getAll();
  const porTecnico = {};
  todos.forEach(p => {
    const nombre = p.projectConfig?.aplicadoPor?.nombre;
    if (!nombre || nombre === '—') return;
    porTecnico[nombre] = (porTecnico[nombre] || 0) + 1;
  });

  const ranking = Object.entries(porTecnico).sort((a, b) => b[1] - a[1]);

  if (!el) return;
  if (!ranking.length) {
    el.innerHTML = `<p class="empty-msg-sm" style="padding:10px 0">Sin BOM aplicados todavía.</p>`;
    return;
  }

  el.innerHTML = `
  <div class="tablero-tecnicos-list">
    ${ranking.map(([nombre, count], i) => `
      <div class="tablero-tecnico-row">
        <span class="tablero-tecnico-medalla">${MEDALLAS[i] || `${i+1}.`}</span>
        <span class="tablero-tecnico-avatar" style="background:${avColor(nombre)}">${avInitials(nombre)}</span>
        <span class="tablero-tecnico-nombre">${esc(nombre)}</span>
        <span class="tablero-tecnico-count">${count} BOM</span>
      </div>`).join('')}
  </div>`;
};
