// utils.js — Helpers comunes · punto de entrada (barrel)
// Re-exporta todo desde los módulos especializados para que ningún otro
// archivo del repo necesite cambiar sus imports tras el split.

export * from './util-fmt.js';
export * from './util-dialogs.js';
export * from './util-foto.js';
export * from './util-scanner.js';
export * from './util-domain.js';
export * from './util-fases.js';
