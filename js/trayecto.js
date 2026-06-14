// trayecto.js — Trayecto inmersivo "Un Solo Camino"
// Vista guiada secuencial: muestra el primer paso incompleto y permite avanzar paso a paso.

import { projects } from './db.js';
import { esc, calcFaseEstado } from './utils.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';

// ── Definición de pasos ──────────────────────────────────────────────────────
function buildPasos(project, id) {
  const doc = project.documentacion || {};
  const gar = project.garantia || {};
  const aud = project.auditoria || {};
  const ft  = gar.fotosTecnicas || {};
  const lev = doc.levantamiento || {};
  const esPequeno = project.tipoSistema === 'sistema_pequeno';

  // Conteo de fotos por sitio
  const _fc = (sitio, sub) => {
    const n = doc.fases?.[sitio]?.[sub]?.length || 0;
    if (n > 0) return n;
    if (sitio === 'techo') { const m={antes:'antes',durante:'durante',cierre:'despues'}; return doc.fases?.[m[sub]]?.length||0; }
    return 0;
  };
  const fTecho   = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('techo',f),0);
  const fCentros = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('centrosCarga',f),0);
  const fZona    = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('zonaDelSistema',f),0);

  // Fotos por área
  const areas = lev.areasTecho || [];
  const fotosAreaTotal = areas.reduce((s, a) => {
    const f = a.fotos || {};
    return s + (f.antes?.length||0) + (f.durante?.length||0) + (f.cierre?.length||0);
  }, 0);

  const totalPaneles = (gar.paneles?.strings||[]).reduce((s,st)=>s+(st.paneles?.length||0),0);
  // Checklist de instalación (checklistData), NO el checklist de auditoría
  const cl        = project.checklistData || {};
  const clExec    = Object.values(cl.exec || {}).filter(Boolean).length;
  const clHerr    = Object.values(cl.herr || {}).filter(Boolean).length;
  const checkDone = clExec + clHerr;

  const pasos = [];

  // ── Paso 1: Levantamiento ──────────────────────────────────────────────────
  pasos.push({
    id:       'levantamiento',
    emoji:    '🏠',
    titulo:   'Levantamiento del sitio',
    desc:     'Registra tipo de techo, temperatura, orientación y áreas del techo.',
    ok:       !!(lev.tipTecho),
    link:     `#proyecto/${id}/documentacion`,
    hint:     lev.tipTecho ? `Techo: ${esc(lev.tipTecho)}` : 'Sin datos del sitio aún',
  });

  // ── Paso 2: Fotos por área ─────────────────────────────────────────────────
  if (areas.length > 0) {
    pasos.push({
      id:       'fotos-area',
      emoji:    '📐',
      titulo:   `Fotos por área (${areas.length} área${areas.length!==1?'s':''})`,
      desc:     'Toma fotos Antes / Durante / Cierre de cada área del techo registrada.',
      ok:       fotosAreaTotal > 0,
      link:     `#proyecto/${id}/documentacion`,
      hint:     fotosAreaTotal > 0 ? `${fotosAreaTotal} foto${fotosAreaTotal!==1?'s':''} capturada${fotosAreaTotal!==1?'s':''}` : 'Sin fotos de áreas aún',
    });
  }

  if (!esPequeno) {
    // ── Paso 3: Fotos techo ──────────────────────────────────────────────────
    pasos.push({
      id:       'fotos-techo',
      emoji:    '🏗️',
      titulo:   'Fotos del techo',
      desc:     'Antes, Durante y Cierre del techo principal.',
      ok:       fTecho > 0,
      link:     `#proyecto/${id}/documentacion`,
      hint:     fTecho > 0 ? `${fTecho} foto${fTecho!==1?'s':''}` : 'Sin fotos del techo',
    });

    // ── Paso 4: Centros de carga ─────────────────────────────────────────────
    pasos.push({
      id:       'fotos-centros',
      emoji:    '⚡',
      titulo:   'Fotos centros de carga',
      desc:     'Antes, Durante y Cierre del tablero y centros de carga.',
      ok:       fCentros > 0,
      link:     `#proyecto/${id}/documentacion`,
      hint:     fCentros > 0 ? `${fCentros} foto${fCentros!==1?'s':''}` : 'Sin fotos de centros de carga',
    });

    // ── Paso 5: Zona del sistema ─────────────────────────────────────────────
    pasos.push({
      id:       'fotos-zona',
      emoji:    '🔆',
      titulo:   'Fotos zona del sistema',
      desc:     'Antes, Durante y Cierre del área donde se instala el inversor y sistema.',
      ok:       fZona > 0,
      link:     `#proyecto/${id}/documentacion`,
      hint:     fZona > 0 ? `${fZona} foto${fZona!==1?'s':''}` : 'Sin fotos de la zona',
    });

    // ── Paso 6: Checklist ────────────────────────────────────────────────────
    pasos.push({
      id:       'checklist',
      emoji:    '✅',
      titulo:   'Checklist de instalación',
      desc:     'Verifica herramienta, materiales y ejecución paso a paso.',
      ok:       !!cl.publishedAt || checkDone > 5,
      link:     `#checklist/${id}`,
      hint:     cl.publishedAt ? 'Aprobado y publicado'
              : checkDone > 0 ? `${checkDone} ítems verificados` : 'Sin verificar aún',
    });
  }

  // ── Paso 7: Trayectorias de canalización ──────────────────────────────────
  const nTray = (project.trayectorias || []).length;
  pasos.push({
    id:       'trayectorias',
    emoji:    '🔌',
    titulo:   'Trayectorias de cable',
    desc:     'Documenta los recorridos físicos de cable: tipo de conduit, calibre y longitud por tramo.',
    ok:       nTray > 0,
    link:     `#proyecto/${id}/trayectorias`,
    hint:     nTray > 0 ? `${nTray} tramo${nTray !== 1 ? 's' : ''} registrado${nTray !== 1 ? 's' : ''}` : 'Sin trayectorias registradas',
  });

  // ── Paso 8: Foto del sistema ───────────────────────────────────────────────
  pasos.push({
    id:       'foto-sistema',
    emoji:    '📸',
    titulo:   'Foto del sistema instalado',
    desc:     'Foto general del sistema terminado para la garantía.',
    ok:       !!gar.fotoSistema,
    link:     `#proyecto/${id}/garantia`,
    hint:     gar.fotoSistema ? 'Foto capturada' : 'Sin foto del sistema',
  });

  if (!esPequeno) {
    // ── Paso 8: Fotos técnicas ───────────────────────────────────────────────
    pasos.push({
      id:       'fotos-tecnicas',
      emoji:    '🔌',
      titulo:   'Fotos técnicas de cierre',
      desc:     'Tablero AC, tablero DC, inversor energizado y otras fotos técnicas.',
      ok:       !!(ft.tableroAC || ft.inversorEnergizado),
      link:     `#proyecto/${id}/documentacion`,
      hint:     (ft.tableroAC || ft.inversorEnergizado) ? 'Fotos técnicas capturadas' : 'Sin fotos técnicas',
    });
  }

  // ── Paso 9: Equipos ────────────────────────────────────────────────────────
  const nEquipos = gar.equipos?.length || 0;
  pasos.push({
    id:       'equipos',
    emoji:    '🔧',
    titulo:   'Registrar equipos',
    desc:     'Escanea o ingresa los números de serie de inversor, protecciones y otros equipos.',
    ok:       nEquipos > 0,
    link:     `#proyecto/${id}/garantia`,
    hint:     nEquipos > 0 ? `${nEquipos} equipo${nEquipos!==1?'s':''} registrado${nEquipos!==1?'s':''}` : 'Sin equipos registrados',
  });

  // ── Paso 10: Paneles ───────────────────────────────────────────────────────
  pasos.push({
    id:       'paneles',
    emoji:    '☀️',
    titulo:   'Registrar paneles',
    desc:     'Crea los strings e ingresa los números de serie de cada panel.',
    ok:       totalPaneles > 0,
    link:     `#proyecto/${id}/garantia`,
    hint:     totalPaneles > 0 ? `${totalPaneles} panel${totalPaneles!==1?'es':''}` : 'Sin paneles registrados',
  });

  return pasos;
}

// ── Vista principal ───────────────────────────────────────────────────────────
export async function renderTrayecto(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const edit  = canEdit(session, project);
  const pasos = buildPasos(project, projectId);

  const totalPasos    = pasos.length;
  const pasosOk       = pasos.filter(p => p.ok).length;
  const pct           = Math.round(pasosOk / totalPasos * 100);
  const todoListo     = pasosOk === totalPasos;
  // Índice del primer paso incompleto
  const primerPend    = pasos.findIndex(p => !p.ok);

  return `
  <div class="breadcrumb">
    <span class="bc-link" onclick="navigate('#dashboard')">Inicio</span>
    <span class="bc-sep">›</span>
    <span class="bc-link" onclick="navigate('#proyecto/${projectId}')">${esc(project.displayId)}</span>
    <span class="bc-sep">›</span>
    <span class="bc-current">Trayecto</span>
  </div>

  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <div class="header-info">
      <h1 class="hdr-title">Trayecto</h1>
      <span class="hdr-sub">${esc(project.clientName || project.displayId)}</span>
    </div>
  </div>

  <!-- Barra de progreso general -->
  <div class="card tr-progress-card">
    <div class="tr-prog-header">
      <span class="tr-prog-label">${todoListo ? '✓ Todo completo' : `Paso ${Math.min(primerPend+1, totalPasos)} de ${totalPasos}`}</span>
      <span class="tr-prog-pct ${todoListo ? 'tr-pct-done' : ''}">${pct}%</span>
    </div>
    <div class="tr-prog-bar-track">
      <div class="tr-prog-bar-fill ${todoListo ? 'tr-bar-done' : ''}" style="width:${pct}%"></div>
    </div>
    ${todoListo ? `
    <p class="tr-listo-msg">${icon('check-circle', 16)} Todos los pasos completados. Puedes firmar las fases.</p>
    <button class="btn-primary tr-firmar-btn" onclick="navigate('#proyecto/${projectId}')">
      Ir al proyecto →
    </button>` : ''}
  </div>

  <!-- Lista de pasos -->
  <div class="tr-pasos">
    ${pasos.map((paso, i) => {
      const esCurrent = !todoListo && i === primerPend;
      // Pendientes no actuales: tarjeta compacta tappable (saltable sin fricción)
      const headClick = !esCurrent && !paso.ok ? ` onclick="navigate('${paso.link}')"` : '';
      return `
    <div class="tr-paso ${paso.ok ? 'tr-paso-ok' : ''} ${esCurrent ? 'tr-paso-current' : ''} ${headClick ? 'tr-paso-tap' : ''}"
         id="tr-paso-${paso.id}"${headClick}>
      <div class="tr-paso-head">
        <div class="tr-paso-num ${paso.ok ? 'tr-num-ok' : esCurrent ? 'tr-num-cur' : ''}">
          ${paso.ok ? icon('check', 13) : `<span>${i+1}</span>`}
        </div>
        <div class="tr-paso-info">
          <span class="tr-paso-titulo">${paso.emoji} ${esc(paso.titulo)}</span>
          <span class="tr-paso-hint">${esc(paso.hint)}</span>
        </div>
        ${paso.ok ? `<span class="tr-chip-ok">Completo</span>`
          : !esCurrent ? icon('caret-right', 14, 'tr-paso-go') : ''}
      </div>

      ${esCurrent ? `
      <div class="tr-paso-body">
        <p class="tr-paso-desc">${esc(paso.desc)}</p>
        <div class="tr-paso-actions">
          <button class="btn-primary tr-ir-btn" onclick="navigate('${paso.link}')">
            Ir a este paso ${icon('arrow-right', 14)}
          </button>
        </div>
      </div>` : ''}
    </div>`;
    }).join('')}
  </div>

  ${!todoListo ? `
  <div class="tr-footer-hint">
    <span>${icon('info', 13)} Los pasos se marcan automáticamente al completar cada sección.</span>
  </div>` : ''}
  `;
}
