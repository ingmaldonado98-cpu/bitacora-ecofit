// app.js — Router principal de la Bitácora Ecofit V6

import { renderLogin, getSession, logout, requireAuth } from './auth.js';
import { renderDashboard, initDashboardFilters, populateTecnicoFilter, updateNavBadge } from './dashboard.js';
import { renderProjectDetail, renderProjectForm, calcFaseEstado } from './project.js';
import { renderGarantia } from './garantia.js';
import { renderEstructuraForm } from './gar-estructura.js';
import { renderDocumentacion, renderLevantamientoView } from './documentacion.js';
import { renderAuditoria } from './auditoria.js';
import { renderQR } from './qr.js';
import { renderClientePublico } from './cliente-publico.js';
import { renderPDFExport } from './pdf.js';
import { renderSettings } from './settings.js';
import { renderRecordatorios, updateRecordatoriosBadge, calcRecordatoriosCount } from './recordatorios.js';
import { renderConcluidos } from './concluidos.js';
import { renderInventario } from './inventario.js';
import { renderCalculadora } from './calculadora.js';
import { renderChecklistModule, renderChecklistsList } from './checklist.js';
import { renderDimensionamiento } from './dimensionamiento.js';
import { renderTrayecto } from './trayecto.js';
import { renderTrayectorias } from './trayectorias.js';
import { projects, users, reminders } from './db.js';
import { fbErrors } from './firebase.js';
import { toast, esc, uuid } from './utils.js';
import { icon } from './icons.js';
import { isNative, getPlugin } from './platform.js';
import { renderMapView } from './map.js';
import { initPendingMap, processQueue } from './photo-queue.js';
import { skeletonBlock } from './ui-states.js';

const app = document.getElementById('app');

// ── switchTab global — definida aquí para que esté disponible en todos los módulos
// sin depender del orden de carga. Los módulos pueden registrar hooks en _onTabChange.
window.switchTab = function(tabBarId, targetId, btn) {
  const bar = document.getElementById(tabBarId);
  if (!bar) return;
  bar.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('tab-active');
    b.setAttribute('aria-selected', 'false');
    b.setAttribute('tabindex', '-1');
  });
  btn.classList.add('tab-active');
  btn.setAttribute('aria-selected', 'true');
  btn.setAttribute('tabindex', '0');
  const container = bar.parentElement;
  container.querySelectorAll(':scope > .tab-panel').forEach(p => {
    p.classList.remove('tab-panel-active');
    p.setAttribute('aria-hidden', 'true');
  });
  const target = document.getElementById(targetId);
  if (target) {
    target.classList.add('tab-panel-active');
    target.setAttribute('aria-hidden', 'false');
  }
  // Permite que los módulos reaccionen al cambio de tab (ej: detener scanner en garantia)
  window._onTabChange?.(tabBarId, targetId);
};

// ── Error handler global: captura fallos de escritura en Firestore ────────────
// firebase.js despacha 'ecofit:write-error' sin importar toast (evita circular dep)
window.addEventListener('ecofit:write-error', (e) => {
  toast(e.detail?.msg || 'Error al guardar. Intenta de nuevo.', 'error', 6000);
});

// ── Render helper ─────────────────────────────────────────────────────────────
async function render(html, skeleton = '') {
  try {
    if (typeof html === 'string') {
      app.innerHTML = html;
    } else {
      if (skeleton) app.innerHTML = skeleton;
      app.innerHTML = await html;
    }
    app.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });
    // Fade-in suave entre vistas
    app.style.animation = 'none';
    app.offsetHeight; // fuerza reflow para reiniciar la animación
    app.style.animation = 'viewFadeIn .2s ease';
  } catch (err) {
    console.error('[Ecofit] Error al renderizar vista:', err);
    app.innerHTML = `
      <div style="padding:32px 20px;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <h2 style="font-family:'DM Serif Display',serif;color:var(--text);margin-bottom:8px">
          Error al cargar esta vista
        </h2>
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:20px">
          ${esc(err.message || 'Error desconocido')}
        </p>
        <button class="btn-primary" onclick="navigate('#dashboard')">
          Volver al inicio
        </button>
        <p style="color:var(--text-muted);font-size:.75rem;margin-top:12px">
          Si el problema persiste, usa <strong>Ajustes → Forzar actualización</strong>.
        </p>
      </div>`;
    app.style.animation = 'viewFadeIn .2s ease';
  }
}

// ── Pull-to-refresh (solo dashboard) ─────────────────────────────────────────
(function initPullToRefresh() {
  let startY = 0;
  let indicator = null;

  app.addEventListener('touchstart', e => {
    if (app.scrollTop === 0) startY = e.touches[0].clientY;
  }, { passive: true });

  app.addEventListener('touchmove', e => {
    if (!startY) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && app.scrollTop === 0 && window.location.hash.startsWith('#dashboard')) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.textContent = '↓ Soltar para actualizar';
        app.prepend(indicator);
      }
      indicator.style.opacity = Math.min(dy / 70, 1);
      indicator.classList.toggle('ptr-ready', dy > 70);
      indicator.textContent = dy > 70 ? '↑ Actualizando…' : '↓ Soltar para actualizar';
    }
  }, { passive: true });

  app.addEventListener('touchend', e => {
    if (indicator) { indicator.remove(); indicator = null; }
    if (!startY) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = 0;
    if (dy > 70 && window.location.hash.startsWith('#dashboard')) {
      navigate('#dashboard');
    }
  }, { passive: true });
})();

// ── Router ────────────────────────────────────────────────────────────────────
async function route() {
  const hash = window.location.hash || '#dashboard';
  const parts = hash.replace('#', '').split('/');
  const view  = parts[0];
  const id    = parts[1];
  const sub   = parts[2];

  // Actualizar nav activo
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('nav-active', l.dataset.view === view);
  });

  // Login no requiere sesión
  if (view === 'login') {
    window.__hideNav?.();
    document.getElementById('top-header').style.display = 'none';
    await render(renderLogin());
    return;
  }

  // Tarjeta pública del cliente (QR) — sin sesión, solo lee publicCards/{id}
  if (view === 'cliente') {
    window.__hideNav?.();
    document.getElementById('top-header').style.display = 'none';
    await render(renderClientePublico(id));
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.hash = '#login';
    return;
  }

  // Mostrar chrome de la app
  window.__showNav?.();
  // Actualizar header con usuario
  updateHeader(session);
  // Push notifications Android (solo una vez por sesión)
  if (isNative() && !window._pushInited) { window._pushInited = true; _initPushAndroid(session); }

  try {
    switch (view) {
      case 'dashboard':
      case '': {
        const [all, allUsers] = await Promise.all([projects.getAll(), users.getAll()]);
        initDashboardFilters(all, allUsers);
        calcRecordatoriosCount(all).then(n => updateRecordatoriosBadge(n));
        // FIX-8: Pasar datos pre-cargados para evitar doble lectura Firestore
        await render(renderDashboard(session, all, allUsers), skeletonDashboard());
        // Poblar select de técnicos ahora que el DOM existe
        populateTecnicoFilter(allUsers);
        break;
      }
      case 'nuevo-proyecto':
        await render(renderProjectForm(null, session));
        break;

      case 'editar-proyecto':
        await render(renderProjectForm(id, session));
        break;

      case 'proyecto':
        if (!id) { navigate('#dashboard'); return; }
        if (!sub) {
          await render(renderProjectDetail(id, session), skeletonProject());
        } else if (sub === 'garantia') {
          const subsub = parts[3];
          if (subsub === 'estructura') {
            await render(renderEstructuraForm(id, session));
          } else {
            const _gp = await projects.getById(id);
            const _ge = calcFaseEstado(_gp || {});
            if (_ge.gar === 'bloqueada') {
              toast('Completa el Levantamiento primero.', 'warn', 4000);
              navigate(`#proyecto/${id}`); return;
            }
            await render(renderGarantia(id, session), skeletonBlock(3));
          }
        } else if (sub === 'levantamiento') {
          await render(renderLevantamientoView(id, session));
        } else if (sub === 'documentacion') {
          await render(renderDocumentacion(id, session), skeletonBlock(4));
        } else if (sub === 'auditoria') {
          const _ap = await projects.getById(id);
          const _ae = calcFaseEstado(_ap || {});
          if (_ae.aud === 'bloqueada') {
            toast('Completa Garantía primero (foto del sistema + equipos o fotos técnicas).', 'warn', 4000);
            navigate(`#proyecto/${id}`); return;
          }
          await render(renderAuditoria(id, session));
        } else if (sub === 'trayecto') {
          await render(renderTrayecto(id, session));
        } else if (sub === 'trayectorias') {
          await render(renderTrayectorias(id, session));
        } else if (sub === 'qr') {
          await render(renderQR(id, session));
        } else if (sub === 'pdf') {
          await render(renderPDFExport(id, session));
        }
        break;

      case 'mapa':
        // Destruir mapa anterior si existe (Leaflet necesita cleanup)
        if (window._activeMap) { window._activeMap.remove(); window._activeMap = null; }
        await render(renderMapView(session));
        break;

      case 'inventario':
        await render(renderInventario(session));
        break;

      case 'calculadora':
        await render(renderCalculadora(session, id || null));
        break;

      case 'checklists':
        await render(renderChecklistsList(session));
        break;

      case 'checklist':
        await render(renderChecklistModule(id, session));
        break;

      case 'dimensionamiento':
        await render(renderDimensionamiento(id, session));
        break;

      case 'concluidos':
        await render(renderConcluidos(session));
        break;

      case 'recordatorios':
        await render(renderRecordatorios(session));
        break;

      case 'settings':
        await render(renderSettings(session));
        // Mostrar versión del SW
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type:'SW_VERSION' });
        }
        break;

      default:
        navigate('#dashboard');
    }
  } catch (err) {
    console.error('Router error:', err);
    app.innerHTML = `<div class="error-screen">
      ${icon('warning-circle', 48)}
      <h2>Error al cargar</h2>
      <p>${esc(err.message)}</p>
      <button class="btn-primary" onclick="navigate('#dashboard')">Volver al inicio</button>
    </div>`;
  }

  window.scrollTo(0, 0);

  // Actualizar badge en segundo plano para rutas que no son dashboard
  if (view !== 'dashboard' && view !== '' && session?.rol === 'admin') {
    projects.getAll().then(all => {
      updateNavBadge(all.filter(p => p.estado === 'pendiente_revision').length);
    }).catch(() => {});
  }
}

// ── Header dinámico ───────────────────────────────────────────────────────────
function updateHeader(session) {
  const hdr = document.getElementById('top-header');
  if (!hdr || !session) return;
  document.getElementById('hdr-user-name').textContent = session.nombre || session.username;
  document.getElementById('hdr-user-rol').textContent  =
    session.rol === 'admin' ? 'Admin' : session.rol === 'lider' ? 'Líder' : 'Apoyo';
  hdr.style.display = '';
  // Header simplificado — solo texto "Bitácora de Instalaciones" (sin logo img)
}

// ── Recordatorio rápido ───────────────────────────────────────────────────────
window._openReminderModal = async function() {
  const session = await getSession();
  if (!session) return;

  const _prev = document.getElementById('reminder-overlay');
  if (_prev) { _prev.classList.remove('rs-open'); setTimeout(() => _prev.remove(), 250); await new Promise(r => setTimeout(r, 260)); }

  const overlay = document.createElement('div');
  overlay.className = 'reminder-sheet-overlay';
  overlay.id = 'reminder-overlay';
  overlay.innerHTML = `
    <div class="reminder-sheet">
      <div class="reminder-sheet-hdr">
        <span>Recordatorio rápido</span>
        <button class="reminder-sheet-close" id="rem-close-btn">✕</button>
      </div>
      <textarea class="reminder-textarea" id="rem-text-input"
        placeholder="¿Qué debes recordar?" maxlength="280"></textarea>
      <div style="margin-top:10px">
        <label style="font-size:.78rem;color:var(--text-muted);display:block;margin-bottom:5px">
          Fecha límite <span style="opacity:.6">— opcional</span>
        </label>
        <input type="date" class="form-control" id="rem-date-input" style="max-width:180px" />
      </div>
      <div class="reminder-sheet-footer">
        <button class="btn-outline" id="rem-cancel-btn">Cancelar</button>
        <button class="btn-primary" id="rem-save-btn">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('rs-open'));
  setTimeout(() => document.getElementById('rem-text-input')?.focus(), 280);

  function closeModal() {
    overlay.classList.remove('rs-open');
    setTimeout(() => overlay.remove(), 250);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('rem-close-btn').onclick  = closeModal;
  document.getElementById('rem-cancel-btn').onclick = closeModal;

  document.getElementById('rem-save-btn').onclick = async () => {
    const txt = document.getElementById('rem-text-input').value.trim();
    if (!txt) { document.getElementById('rem-text-input').focus(); return; }
    const fecha = document.getElementById('rem-date-input').value || null;
    const id = 'rem_' + uuid();
    try {
      await reminders.add({
        id, texto: txt, fecha,
        createdAt: new Date().toISOString(),
        createdBy: session.id,
        createdByName: session.nombre || session.username,
      });
      closeModal();
      toast('Recordatorio guardado', 'ok', 2000);
    } catch { toast('Error al guardar', 'error', 3000); }
  };
};

window._reminderComplete = async function(id) {
  const session = await getSession();
  try { await reminders.complete(id, session?.nombre || session?.username); } catch { /* ya completado */ }
  const row = document.getElementById('qrem-' + id);
  if (row) {
    row.style.transition = 'opacity .2s';
    row.style.opacity = '0';
    setTimeout(() => {
      row.remove();
      const section = document.getElementById('qrem-section');
      if (section && !section.querySelector('.qrem-row')) section.remove();
      const badge = document.getElementById('nav-badge-recor');
      if (badge) {
        const next = Math.max(0, (parseInt(badge.textContent) || 0) - 1);
        badge.textContent = next > 9 ? '9+' : String(next);
        badge.style.display = next > 0 ? '' : 'none';
      }
      // Refrescar sección historial si existe
      const hist = document.getElementById('qrem-hist-section');
      if (hist) navigate(window.location.hash);
    }, 200);
  }
  toast('Marcado como hecho — guardado en historial', 'ok', 2000);
};

window._reminderDelete = async function(id) {
  try { await reminders.delete(id); } catch { /* ya eliminado */ }
  const row = document.getElementById('qrem-hist-' + id);
  if (row) { row.style.transition = 'opacity .15s'; row.style.opacity = '0'; setTimeout(() => row.remove(), 160); }
  toast('Eliminado del historial', 'ok', 1500);
};

window._reminderEdit = async function(id, textoActual, fechaActual) {
  const _prev = document.getElementById('reminder-overlay');
  if (_prev) { _prev.classList.remove('rs-open'); setTimeout(() => _prev.remove(), 250); await new Promise(r => setTimeout(r, 260)); }

  const overlay = document.createElement('div');
  overlay.className = 'reminder-sheet-overlay';
  overlay.id = 'reminder-overlay';
  overlay.innerHTML = `
    <div class="reminder-sheet">
      <div class="reminder-sheet-hdr">
        <span>Editar recordatorio</span>
        <button class="reminder-sheet-close" id="rem-close-btn">✕</button>
      </div>
      <textarea class="reminder-textarea" id="rem-text-input"
        placeholder="¿Qué debes recordar?" maxlength="280">${esc(textoActual || '')}</textarea>
      <div style="margin-top:10px">
        <label style="font-size:.78rem;color:var(--text-muted);display:block;margin-bottom:5px">
          Fecha límite <span style="opacity:.6">— opcional</span>
        </label>
        <input type="date" class="form-control" id="rem-date-input" value="${fechaActual || ''}" style="max-width:180px" />
      </div>
      <div class="reminder-sheet-footer">
        <button class="btn-outline" id="rem-cancel-btn">Cancelar</button>
        <button class="btn-primary" id="rem-save-btn">Guardar cambios</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('rs-open'));
  setTimeout(() => { const t = document.getElementById('rem-text-input'); if (t) { t.focus(); t.selectionStart = t.value.length; } }, 280);

  function closeModal() { overlay.classList.remove('rs-open'); setTimeout(() => overlay.remove(), 250); }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('rem-close-btn').onclick  = closeModal;
  document.getElementById('rem-cancel-btn').onclick = closeModal;

  document.getElementById('rem-save-btn').onclick = async () => {
    const txt   = document.getElementById('rem-text-input').value.trim();
    if (!txt) { document.getElementById('rem-text-input').focus(); return; }
    const fecha = document.getElementById('rem-date-input').value || null;
    try {
      await reminders.update(id, { texto: txt, fecha });
      closeModal();
      toast('Recordatorio actualizado', 'ok', 2000);
      // Actualizar DOM sin recargar la vista
      const row = document.getElementById('qrem-' + id);
      if (row) {
        const textoEl = row.querySelector('.qrem-texto');
        const metaEl  = row.querySelector('.qrem-meta');
        if (textoEl) textoEl.textContent = txt;
        if (metaEl && fecha) metaEl.querySelector('.qrem-fecha')?.remove?.();
      }
    } catch { toast('Error al guardar', 'error', 3000); }
  };
};

// ── Navegación global ─────────────────────────────────────────────────────────
window.navigate = function(hash) {
  window._stopScannerGlobal?.();
  if (window.location.hash === hash) {
    route();
  } else {
    window.location.hash = hash;
  }
};

window.addEventListener('hashchange', route);

// ── Logout ────────────────────────────────────────────────────────────────────
window._logout = async function() {
  const ok = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `<div class="modal-confirm"><p class="modal-confirm-msg">¿Cerrar sesión?</p>
      <div class="modal-confirm-actions">
        <button class="btn-outline modal-btn-cancel">Cancelar</button>
        <button class="btn-primary modal-btn-ok">Cerrar sesión</button>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-btn-ok').onclick    = () => { overlay.remove(); resolve(true);  };
    overlay.querySelector('.modal-btn-cancel').onclick = () => { overlay.remove(); resolve(false); };
  });
  if (!ok) return;
  await logout();
  window.location.hash = '#login';
};

// ── Offline indicator ─────────────────────────────────────────────────────────
function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', () => {
  updateOnline();
  // Procesar cola de fotos offline al reconectar
  processQueue().catch(() => {});
});
window.addEventListener('offline', updateOnline);
updateOnline();

// Inicializar mapa de fotos pendientes (para renderizar mientras se sube)
initPendingMap().catch(() => {})

// Si ya hay señal al abrir la app (aunque no haya ocurrido la transición
// offline→online en esta sesión — ej. se tomó la foto sin señal, se cerró
// la app, y se reabre días después ya conectado), sincroniza cualquier foto
// que quedó pendiente de una sesión anterior. processQueue() ya se
// autoprotege si no hay conexión, así que es seguro llamarla siempre.
processQueue().catch(() => {})

// ── SW update banner ──────────────────────────────────────────────────────────
function showUpdateBanner(newSW) {
  const existing = document.getElementById('sw-update-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.innerHTML = `
    <span>🔄 Nueva versión disponible</span>
    <button onclick="
      document.getElementById('sw-update-banner')?.remove();
      navigator.serviceWorker.controller?.postMessage({type:'SKIP_WAITING'});
    ">Actualizar ahora</button>
    <button class="sw-update-dismiss" title="Descartar por ahora" onclick="document.getElementById('sw-update-banner')?.remove();">✕</button>`;
  document.body.appendChild(banner);
}

// ── Android: botón Back ───────────────────────────────────────────────────────
if (isNative()) {
  getPlugin('App')?.addListener('backButton', () => {
    const hash = window.location.hash;
    if (!hash || hash === '#dashboard' || hash === '#login') {
      getPlugin('App')?.exitApp();
    } else {
      history.back();
    }
  });
}

// ── Android: Push Notifications ──────────────────────────────────────────────
async function _initPushAndroid(session) {
  const Push = getPlugin('PushNotifications');
  if (!Push) return;
  try {
    const perm = await Push.requestPermissions();
    if (perm.receive !== 'granted') return;
    await Push.register();
    Push.addListener('registration', async token => {
      try {
        const { fbDB } = await import('./firebase.js');
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await updateDoc(doc(fbDB, 'users', session.id), { fcmToken: token.value, fcmUpdatedAt: new Date().toISOString() });
      } catch { /* silencioso */ }
    });
    Push.addListener('pushNotificationReceived', notification => {
      toast(`${notification.title}: ${notification.body}`, 'info', 6000);
    });
    Push.addListener('pushNotificationActionPerformed', action => {
      const data = action.notification.data;
      if (data?.projectId) window.location.hash = `#proyecto/${data.projectId}`;
    });
  } catch { /* silencioso si el dispositivo no soporta push */ }
}

// ── Service Worker (solo web, Capacitor usa WebView propio) ──────────────────
if ('serviceWorker' in navigator && !isNative()) {
  // Recargar solo cuando el SW nuevo realmente toma control — un setTimeout fijo
  // puede ganarle la carrera al activate() en dispositivos lentos y recargar con
  // JS viejo + SW nuevo a medias. `refreshing` evita un doble reload si el evento
  // dispara más de una vez.
  let _swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swRefreshing) return;
    _swRefreshing = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newSW);
        }
      });
    });
  }).catch(console.error);

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_VERSION') {
      const el = document.getElementById('sw-ver');
      if (el) el.textContent = e.data.version;
    }
  });
}

// ── Error monitoring — reporta JS runtime errors a Firestore ─────────────────
const APP_VERSION = '6.61.0';
let _errCount = 0;

function _reportError(msg, src, line, col, stack) {
  if (_errCount++ >= 5 || !navigator.onLine) return;
  try {
    const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
    fbErrors.add({
      msg:   String(msg).slice(0, 300),
      src:   src ? String(src).replace(location.origin, '') : null,
      line, col,
      stack: stack ? String(stack).slice(0, 500) : null,
      user:  session?.nombre || null,
      rol:   session?.rol || null,
      hash:  location.hash,
      v:     APP_VERSION,
      ts:    new Date().toISOString(),
    });
  } catch { /* nunca interrumpir el flujo por el error reporter */ }
}

window.onerror = (msg, src, line, col, err) =>
  _reportError(msg, src, line, col, err?.stack);

window.onunhandledrejection = e =>
  _reportError(
    e.reason?.message || String(e.reason) || 'unhandledrejection',
    null, null, null, e.reason?.stack
  );

// ── Theme: auto por OS + override manual + horario programado ────────────────
function _parseSched() {
  try {
    const v = localStorage.getItem('ecofit-theme-sched');
    if (!v) return null;
    const [from, to] = v.split('-');
    if (!from || !to) return null;
    return { from, to };
  } catch { return null; }
}

function _isInDarkWindow(from, to) {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const start = fh * 60 + fm;
  const end   = th * 60 + tm;
  // Si from > to cruza la medianoche (ej. 19:00–07:00)
  return start > end ? (cur >= start || cur < end) : (cur >= start && cur < end);
}

window._applyScheduledTheme = function() {
  const sched = _parseSched();
  if (!sched) {
    document.body.classList.remove('theme-sched');
    return;
  }
  document.body.classList.add('theme-sched');
  const isDark = _isInDarkWindow(sched.from, sched.to);
  document.body.classList.toggle('theme-light', !isDark);
};

(function initTheme() {
  const saved        = localStorage.getItem('ecofit-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  if (saved === 'light')       document.body.classList.add('theme-light');
  else if (saved === 'dark')   document.body.classList.remove('theme-light');
  else if (prefersLight)       document.body.classList.add('theme-light'); // auto

  // Seguir cambios del sistema si no hay preferencia guardada
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem('ecofit-theme') && !_parseSched())
      document.body.classList.toggle('theme-light', e.matches);
  });

  // Aplicar horario programado (tiene prioridad) y revisar cada minuto
  window._applyScheduledTheme();
  setInterval(window._applyScheduledTheme, 60_000);

  // Sync theme button icon with current state (runs after DOM is ready)
  requestAnimationFrame(_updateThemeBtn);
})();

function _updateThemeBtn() {
  const btn = document.getElementById('hdr-theme-cycle-btn');
  if (!btn) return;
  const saved = localStorage.getItem('ecofit-theme');
  let icon, label;
  if (saved === 'dark') {
    // Dark active → show moon
    icon = `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M235.54,150.21a104.84,104.84,0,0,1-37,52.91A104,104,0,0,1,32,120,103.09,103.09,0,0,1,52.85,57.11,104.84,104.84,0,0,1,105.75,20.26,8,8,0,0,1,115.5,33.47a88.07,88.07,0,0,0,104,109.22,8,8,0,0,1,16.07,7.52Z"/></svg>`;
    label = 'Oscuro';
  } else if (saved === 'light') {
    // Light active → show sun
    icon = `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>`;
    label = 'Claro';
  } else {
    // Auto → show device icon
    icon = `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16Zm8,200a8,8,0,0,1-8,8H80a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h96a8,8,0,0,1,8,8ZM120,184a8,8,0,1,0,16,0A8,8,0,0,0,120,184Z"/></svg>`;
    label = 'Auto';
  }
  btn.innerHTML = icon;
  btn.title = `Tema: ${label}`;
}

window._cycleTheme = function () {
  const saved = localStorage.getItem('ecofit-theme');
  if (!saved) {
    // auto → dark
    localStorage.setItem('ecofit-theme', 'dark');
    document.body.classList.remove('theme-light');
  } else if (saved === 'dark') {
    // dark → light
    localStorage.setItem('ecofit-theme', 'light');
    document.body.classList.add('theme-light');
  } else {
    // light → auto
    localStorage.removeItem('ecofit-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.body.classList.toggle('theme-light', prefersLight);
  }
  _updateThemeBtn();
};

// ── Skeleton screens ──────────────────────────────────────────────────────────
function skeletonDashboard() {
  const card = `
  <div class="sk-card">
    <div class="sk-row">
      <div class="sk-block" style="width:60%;height:14px"></div>
      <div class="sk-block" style="width:20%;height:20px;border-radius:20px"></div>
    </div>
    <div class="sk-block" style="width:80%;height:12px;margin-top:8px"></div>
    <div class="sk-row" style="margin-top:10px">
      <div class="sk-block" style="width:30%;height:10px"></div>
      <div class="sk-block" style="width:25%;height:10px"></div>
    </div>
  </div>`;
  return `
  <div class="sk-header">
    <div class="sk-block" style="width:140px;height:24px"></div>
    <div class="sk-block" style="width:32px;height:32px;border-radius:50%"></div>
  </div>
  <div class="sk-stats-row">
    ${[1,2,3,4].map(() => `<div class="sk-block sk-stat-pill"></div>`).join('')}
  </div>
  ${card}${card}${card}`;
}

function skeletonProject() {
  return `
  <div class="sk-header">
    <div class="sk-block" style="width:32px;height:32px;border-radius:50%"></div>
    <div class="sk-block" style="width:120px;height:20px"></div>
    <div class="sk-block" style="width:60px;height:20px;border-radius:20px"></div>
  </div>
  <div class="sk-card">
    ${[1,2,3].map(() => `
    <div class="sk-row" style="margin-bottom:12px">
      <div style="flex:1"><div class="sk-block" style="width:40%;height:10px;margin-bottom:5px"></div>
      <div class="sk-block" style="width:70%;height:14px"></div></div>
      <div style="flex:1"><div class="sk-block" style="width:40%;height:10px;margin-bottom:5px"></div>
      <div class="sk-block" style="width:55%;height:14px"></div></div>
    </div>`).join('')}
  </div>
  <div class="sk-chips-row">
    ${[1,2,3,4,5].map(() => `<div class="sk-block sk-chip"></div>`).join('')}
  </div>
  <div class="sk-modules-grid">
    ${[1,2,3,4,5,6].map(() => `<div class="sk-block sk-module"></div>`).join('')}
  </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
route();
