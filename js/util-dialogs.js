// util-dialogs.js — Toast y modales de confirmación/entrada
// Extraído de utils.js.

import { esc } from './util-fmt.js';

// ── Toast ──────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'info', duration = 3000) {
  let el = document.getElementById('toast-container');
  if (!el) { el = document.createElement('div'); el.id = 'toast-container'; document.body.appendChild(el); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  el.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, duration);
}

// ── Modal de confirmación ─────────────────────────────────────────────────────
export function confirmDialog(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="alertdialog" aria-modal="true">
        <p class="modal-confirm-msg">${esc(msg)}</p>
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick  = () => close(true);
    can.onclick = () => close(false);
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
    ok.focus();
  });
}

// ── Modal de entrada de texto ─────────────────────────────────────────────────
export function inputDialog(label, defaultValue = '', hint = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <label class="modal-confirm-msg" style="display:block;margin-bottom:.5rem">${esc(label)}</label>
        <input class="modal-input" type="text" value="${esc(defaultValue)}" autocomplete="off" />
        ${hint ? `<p class="modal-input-hint">${esc(hint)}</p>` : ''}
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Aceptar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const inp = overlay.querySelector('.modal-input');
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick  = () => close(inp.value);
    can.onclick = () => close(null);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); close(inp.value); }
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
    });
    inp.focus();
    inp.select();
  });
}

// ── Modal de cambio de estado con nota ───────────────────────────────────────
export function cambioEstadoDialog(estadoLabel, notaRequerida) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <p class="modal-confirm-msg">Cambiar estado a <strong>${esc(estadoLabel)}</strong></p>
        <label class="modal-nota-label">
          Nota${notaRequerida
            ? ' <span class="modal-nota-req">* requerida</span>'
            : ' <span class="modal-nota-opt">(opcional)</span>'}
        </label>
        <textarea class="modal-textarea" rows="3"
          placeholder="${notaRequerida ? 'Explica el motivo del cambio…' : 'Motivo o comentario del cambio…'}"></textarea>
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ta  = overlay.querySelector('.modal-textarea');
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick = () => {
      const nota = ta.value.trim();
      if (notaRequerida && !nota) {
        ta.classList.add('modal-input-error');
        ta.focus();
        return;
      }
      close({ ok: true, nota: nota || null });
    };
    can.onclick = () => close(null);
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    ta.focus();
  });
}
