// app.js — Router principal de la Bitácora Ecofit V6

import { renderLogin, getSession, logout, requireAuth } from './auth.js';
import { renderDashboard, initDashboardFilters, populateTecnicoFilter, updateNavBadge } from './dashboard.js';
import { renderProjectDetail, renderProjectForm, calcFaseEstado } from './project.js';
import { renderGarantia, renderEstructuraForm } from './garantia.js';
import { renderDocumentacion } from './documentacion.js';
import { renderAuditoria } from './auditoria.js';
import { renderQR } from './qr.js';
import { renderPDFExport } from './pdf.js';
import { renderSettings } from './settings.js';
import { renderConcluidos } from './concluidos.js';
import { renderInventario } from './inventario.js';
import { renderCalculadora } from './calculadora.js';
import { renderChecklistModule, renderChecklistsList } from './checklist.js';
import { projects, users } from './db.js';
import { toast, esc } from './utils.js';
import { icon } from './icons.js';
import { isNative, getPlugin } from './platform.js';
import { renderMapView } from './map.js';
import { initPendingMap, processQueue } from './photo-queue.js';

const app = document.getElementById('app');

// ── switchTab global — definida aquí para que esté disponible en todos los módulos
// sin depender del orden de carga. Los módulos pueden registrar hooks en _onTabChange.
window.switchTab = function(tabBarId, targetId, btn) {
  const bar = document.getElementById(tabBarId);
  if (!bar) return;
  bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  btn.classList.add('tab-active');
  const container = bar.parentElement;
  container.querySelectorAll(':scope > .tab-panel').forEach(p => p.classList.remove('tab-panel-active'));
  const target = document.getElementById(targetId);
  if (target) target.classList.add('tab-panel-active');
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
        await render(renderDashboard(session), skeletonDashboard());
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
              toast('Completa el Levantamiento en Documentación primero.', 'warn', 4000);
              navigate(`#proyecto/${id}`); return;
            }
            await render(renderGarantia(id, session));
          }
        } else if (sub === 'documentacion') {
          await render(renderDocumentacion(id, session));
        } else if (sub === 'auditoria') {
          const _ap = await projects.getById(id);
          const _ae = calcFaseEstado(_ap || {});
          if (_ae.aud === 'bloqueada') {
            toast('Completa Garantía primero (foto del sistema + equipos o fotos técnicas).', 'warn', 4000);
            navigate(`#proyecto/${id}`); return;
          }
          await render(renderAuditoria(id, session));
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

      case 'concluidos':
        await render(renderConcluidos(session));
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
      setTimeout(()=>location.reload(),300);
    ">Actualizar ahora</button>`;
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
        await updateDoc(doc(fbDB, 'users', session.uid), { fcmToken: token.value, fcmUpdatedAt: new Date().toISOString() });
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
})();

window._toggleTheme = function () {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('ecofit-theme', isLight ? 'light' : 'dark');
};

window._setThemeAuto = function () {
  localStorage.removeItem('ecofit-theme');
  localStorage.removeItem('ecofit-theme-sched');
  document.body.classList.remove('theme-sched');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  document.body.classList.toggle('theme-light', prefersLight);
  toast('Tema automático activado');
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
