// auditoria.js — Módulo Auditoría Técnica · punto de entrada
// Dos modos: Rápido (campo, 5 min) y Formal (dictamen NOM-001-SEDE)

export { renderAuditoria } from './aud-render.js';
import './aud-actions.js'; // registra window.switchAudMode, setRapido, guardarRapido, setFormal, etc.
