// trayecto.js — Trayecto inmersivo "Un Solo Camino"
// Vista guiada secuencial: muestra el primer paso incompleto y permite avanzar paso a paso.

import { projects } from './db.js';
import { esc, calcFaseEstado } from './utils.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';
import { getSerialesFlat } from './gar-paneles.js';
import { getExecBlocks, BLOQUE_LABELS, BLOQUE_DESC } from '../modules/checklist/index.js';
import { computeBloqueStatus } from './doc-exec.js';

// Navega a un paso; si lleva tab de bloque, lo deja seleccionado en Progreso de
// obra (documentacion.js lee 'doc-tab-target' tras renderizar).
window.trIr = function(link, tab) {
  if (tab) sessionStorage.setItem('doc-tab-target', tab);
  navigate(link);
};

// ── Definición de pasos ──────────────────────────────────────────────────────
function buildPasos(project, id) {
  const doc = project.documentacion || {};
  const gar = project.garantia || {};
  const aud = project.auditoria || {};
  const ft  = gar.fotosTecnicas || {};
  const lev = doc.levantamiento || {};
  const esPequeno = project.tipoSistema === 'sistema_pequeno';

  // Fotos por área — a.fotos es un arreglo plano (no hay sub-fases antes/durante/cierre)
  const areas = lev.areasTecho || [];
  const fotosAreaTotal = areas.reduce((s, a) => s + (Array.isArray(a.fotos) ? a.fotos.length : 0), 0);

  const totalPaneles = getSerialesFlat(gar).length;
  // Checklist de instalación (checklistData), NO el checklist de auditoría
  const cl        = project.checklistData || {};
  const clExec    = Object.values(cl.exec || {}).filter(Boolean).length;
  const clHerr    = Object.values(cl.herr || {}).filter(Boolean).length;
  const checkDone = clExec + clHerr;

  // Progreso real por bloque de ejecución (mismo cálculo que Progreso de obra)
  const techo          = project.projectConfig?.techo || cl.techo || 'cemento';
  const allExecBlocks  = getExecBlocks(project, techo);
  const bloqueStatus   = computeBloqueStatus(allExecBlocks, cl);

  const pasos = [];

  // ── Paso 1: Levantamiento ──────────────────────────────────────────────────
  pasos.push({
    id:       'levantamiento',
    emoji:    '🏠',
    titulo:   'Levantamiento del sitio',
    desc:     'Registra tipo de techo, temperatura, orientación y áreas del techo.',
    ok:       !!(lev.tipTecho),
    link:     `#proyecto/${id}/levantamiento`,
    hint:     lev.tipTecho ? `Techo: ${esc(lev.tipTecho)}` : 'Sin datos del sitio aún',
  });

  // ── Paso 2: Fotos por área ─────────────────────────────────────────────────
  if (areas.length > 0) {
    pasos.push({
      id:       'fotos-area',
      emoji:    '📐',
      titulo:   `Fotos por área (${areas.length} área${areas.length!==1?'s':''})`,
      desc:     'Toma fotos de cada área del techo registrada.',
      ok:       fotosAreaTotal > 0,
      link:     `#proyecto/${id}/levantamiento`,
      hint:     fotosAreaTotal > 0 ? `${fotosAreaTotal} foto${fotosAreaTotal!==1?'s':''} capturada${fotosAreaTotal!==1?'s':''}` : 'Sin fotos de áreas aún',
    });
  }

  // ── Paso: Calculadora BOM — debe correrse antes de iniciar obra ─────────────
  pasos.push({
    id:       'calculadora',
    emoji:    '🧮',
    titulo:   'Calculadora BOM',
    desc:     'Calcula la estructura de montaje (rieles, clamps, anclajes) antes de iniciar la obra.',
    ok:       !!project.projectConfig,
    link:     `#calculadora/${id}`,
    hint:     project.projectConfig ? `${project.projectConfig.layout?.totalPanels || 0} paneles · ${project.projectConfig.estructura || '—'}` : 'Sin BOM calculado aún',
  });

  // ── Paso: Dimensionamiento eléctrico — memoria técnica preliminar ───────────
  pasos.push({
    id:       'dimensionamiento',
    emoji:    '📐',
    titulo:   'Dimensionamiento eléctrico',
    desc:     'Revisa y exporta la memoria técnica preliminar (diagnóstico energético, cableado, riesgos).',
    ok:       !!project.dimensionamiento?.exportadoAt,
    link:     `#dimensionamiento/${id}`,
    hint:     project.dimensionamiento?.exportadoAt ? 'Memoria técnica exportada' : 'Sin exportar aún',
  });

  // Helper para un paso ligado a un bloque de Progreso de obra
  const _bloquePaso = (n, emoji) => {
    const s = bloqueStatus[n] || { done: 0, total: 0 };
    const ok = s.total > 0 && s.done === s.total;
    return {
      id:    `bloque${n}`,
      emoji,
      titulo: `${BLOQUE_LABELS[n]} — ${BLOQUE_DESC[n]}`,
      desc:   `Ejecuta y documenta el ${BLOQUE_LABELS[n].toLowerCase()} (checklist + evidencias de cierre).`,
      ok,
      link:  `#proyecto/${id}/documentacion`,
      tab:   `d-bloque${n}`,
      hint:  s.total > 0 ? `${s.done}/${s.total} ítems` : 'Sin ítems en este bloque',
    };
  };

  if (!esPequeno) {
    // ── Paso 3: Bloque 1 — Estructura, Anclaje y Canalización FV ──────────────
    pasos.push(_bloquePaso(1, '🏗️'));

    // ── Trayectorias de canalización (parte del Bloque 1) ────────────────────
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

    // ── Paso 4: Bloque 2 — Canalización Central y Montaje de Equipos ──────────
    pasos.push(_bloquePaso(2, '⚡'));

    // ── Paso 5: Bloque 3 — Cableado, Paneles y Cierre ────────────────────────
    pasos.push(_bloquePaso(3, '🔆'));

    // ── Paso 6: Checklist (herramienta / consumibles / guía) ─────────────────
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
  } else {
    // Sistema pequeño: no usa los 3 bloques de ejecución, pero sí trayectorias
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
  }

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
      const headClick = !esCurrent && !paso.ok ? ` onclick="trIr('${paso.link}', '${paso.tab || ''}')"` : '';
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
          <button class="btn-primary tr-ir-btn" onclick="trIr('${paso.link}', '${paso.tab || ''}')">
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
