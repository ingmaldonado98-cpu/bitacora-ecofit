// app.js — Router principal de la Bitácora Ecofit V6

import { renderLogin, getSession, logout, requireAuth } from './auth.js';
import { renderDashboard, initDashboardFilters } from './dashboard.js';
import { renderProjectDetail, renderProjectForm } from './project.js';
import { renderGarantia, renderEstructuraForm } from './garantia.js';
import { renderDocumentacion } from './documentacion.js';
import { renderAuditoria } from './auditoria.js';
import { renderQR } from './qr.js';
import { renderPDFExport } from './pdf.js';
import { renderSettings } from './settings.js';
import { renderInventario } from './inventario.js';
import { renderCalculadora } from './calculadora.js';
import { renderChecklistModule } from './checklist.js';
import { projects } from './db.js';
import { toast, esc } from './utils.js';

const app = document.getElementById('app');

// ── Render helper ─────────────────────────────────────────────────────────────
async function render(html) {
  if (typeof html === 'string') {
    app.innerHTML = html;
  } else {
    app.innerHTML = await html;
  }
  // Re-ejecutar cualquier <script> inline generado dinámicamente
  app.querySelectorAll('script').forEach(oldScript => {
    const newScript = document.createElement('script');
    newScript.textContent = oldScript.textContent;
    oldScript.replaceWith(newScript);
  });
}

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

  try {
    switch (view) {
      case 'dashboard':
      case '': {
        const all = await projects.getAll();
        initDashboardFilters(all);
        await render(renderDashboard(session));
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
          await render(renderProjectDetail(id, session));
        } else if (sub === 'garantia') {
          const subsub = parts[3];
          if (subsub === 'estructura') {
            await render(renderEstructuraForm(id, session));
          } else {
            await render(renderGarantia(id, session));
          }
        } else if (sub === 'documentacion') {
          await render(renderDocumentacion(id, session));
        } else if (sub === 'auditoria') {
          await render(renderAuditoria(id, session));
        } else if (sub === 'qr') {
          await render(renderQR(id, session));
        } else if (sub === 'pdf') {
          await render(renderPDFExport(id, session));
        }
        break;

      case 'inventario':
        await render(renderInventario(session));
        break;

      case 'calculadora':
        await render(renderCalculadora(session, id || null));
        break;

      case 'checklist':
        await render(renderChecklistModule(id, session));
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
      <ph-icon name="warning-circle" size="48"></ph-icon>
      <h2>Error al cargar</h2>
      <p>${esc(err.message)}</p>
      <button class="btn-primary" onclick="navigate('#dashboard')">Volver al inicio</button>
    </div>`;
  }

  window.scrollTo(0, 0);
}

// ── Header dinámico ───────────────────────────────────────────────────────────
function updateHeader(session) {
  const hdr = document.getElementById('top-header');
  if (!hdr || !session) return;
  document.getElementById('hdr-user-name').textContent = session.nombre || session.username;
  document.getElementById('hdr-user-rol').textContent  =
    session.rol === 'admin' ? 'Admin' : session.rol === 'lider' ? 'Líder' : 'Apoyo';
  hdr.style.display = '';
  // Si el logo img no carga, mostrar fallback tipográfico
  const logoImg = hdr.querySelector('.hdr-logo');
  const logoText = document.getElementById('hdr-logo-text');
  if (logoImg && logoText) {
    if (logoImg.complete && logoImg.naturalWidth === 0) {
      logoImg.style.display = 'none';
      logoText.style.display = 'flex';
    }
  }
}

// ── Navegación global ─────────────────────────────────────────────────────────
window.navigate = function(hash) {
  if (window.location.hash === hash) {
    route();
  } else {
    window.location.hash = hash;
  }
};

window.addEventListener('hashchange', route);

// ── Logout ────────────────────────────────────────────────────────────────────
window._logout = async function() {
  if (!confirm('¿Cerrar sesión?')) return;
  await logout();
  window.location.hash = '#login';
};

// ── Offline indicator ─────────────────────────────────────────────────────────
function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online',  updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nueva versión disponible. Recarga para actualizar.');
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

// ── Theme (dark / light) ──────────────────────────────────────────────────────
(function initTheme() {
  if (localStorage.getItem('ecofit-theme') === 'light')
    document.body.classList.add('theme-light');
})();

window._toggleTheme = function () {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('ecofit-theme', isLight ? 'light' : 'dark');
};

// ── Init ──────────────────────────────────────────────────────────────────────
route();
