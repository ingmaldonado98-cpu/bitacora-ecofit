#!/usr/bin/env node
/**
 * bump-sw-version.js
 * Incrementa automáticamente la versión del Service Worker antes de cada deploy.
 *
 * Uso:
 *   node scripts/bump-sw-version.js        → bump normal
 *   node scripts/bump-sw-version.js --dry  → solo muestra la versión nueva sin escribir
 *
 * Agregar al package.json:
 *   "scripts": {
 *     "predeploy": "node scripts/bump-sw-version.js"
 *   }
 */

const fs   = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'sw.js');
const dry     = process.argv.includes('--dry');

if (!fs.existsSync(SW_PATH)) {
  console.error('❌ sw.js no encontrado en:', SW_PATH);
  process.exit(1);
}

const content    = fs.readFileSync(SW_PATH, 'utf8');
// Buscar el patrón de versión de build: 'ecofit-v6-v31' → incrementa el último número
const match = content.match(/(ecofit-v\d+-v)(\d+)/);

if (!match) {
  console.error('❌ No se encontró el patrón "ecofit-v6-vN" en sw.js');
  process.exit(1);
}

const prefix     = match[1];
const currentVer = parseInt(match[2], 10);
const newVer     = currentVer + 1;
const newContent = content.replace(`${prefix}${currentVer}`, `${prefix}${newVer}`);

if (dry) {
  console.log(`[dry] SW version: v${currentVer} → v${newVer}`);
} else {
  fs.writeFileSync(SW_PATH, newContent, 'utf8');
  console.log(`✅ SW version bumped: v${currentVer} → v${newVer}`);
}
