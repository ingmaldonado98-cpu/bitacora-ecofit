// settings-paneles.js — Catálogo de modelos de panel personalizados (Ajustes Admin)
// Extraído de settings.js — registra los handlers window.* de CRUD de paneles.

import { kv } from './db.js';
import { toast, confirmDialog } from './utils.js';

window.showPanelForm = function() {
  document.getElementById('form-nuevo-panel').style.display = 'block';
  document.getElementById('np-label').focus();
};

window.crearPanel = async function() {
  const label = document.getElementById('np-label').value.trim();
  const wp    = parseFloat(document.getElementById('np-wp').value);
  const pW    = parseFloat(document.getElementById('np-pw').value);
  const pH    = parseFloat(document.getElementById('np-ph').value);
  const voc   = parseFloat(document.getElementById('np-voc').value) || null;
  const imp   = parseFloat(document.getElementById('np-imp').value) || null;

  if (!label)             { toast('Ingresa la marca/modelo','error'); return; }
  if (!wp || wp < 1)      { toast('Potencia inválida','error'); return; }
  if (!pW || pW < 0.1)    { toast('Ancho inválido','error'); return; }
  if (!pH || pH < 0.1)    { toast('Alto inválido','error'); return; }

  const existing = (await kv.get('panel_presets_custom')) || [];
  const nuevo = {
    id: 'cp-' + Date.now(),
    label,
    sub: `${wp}W · ${pW}×${pH}m`,
    pW, pH, wp,
    ...(voc ? { voc } : {}),
    ...(imp ? { imp } : {}),
    isCustom: true,
  };
  await kv.set('panel_presets_custom', [...existing, nuevo]);
  toast(`✅ Panel "${label}" agregado`);
  navigate('#settings');
};

window.editarPanel = function(id) {
  document.getElementById('panel-row-' + id).style.display = 'none';
  document.getElementById('panel-edit-' + id).style.display = 'block';
  document.getElementById('ep-label-' + id).focus();
};

window.guardarEditPanel = async function(id) {
  const label = document.getElementById('ep-label-' + id).value.trim();
  const wp    = parseFloat(document.getElementById('ep-wp-' + id).value);
  const pW    = parseFloat(document.getElementById('ep-pw-' + id).value);
  const pH    = parseFloat(document.getElementById('ep-ph-' + id).value);
  const voc   = parseFloat(document.getElementById('ep-voc-' + id).value) || null;
  const imp   = parseFloat(document.getElementById('ep-imp-' + id).value) || null;

  if (!label)          { toast('Ingresa la marca/modelo','error'); return; }
  if (!wp || wp < 1)   { toast('Potencia inválida','error'); return; }
  if (!pW || pW < 0.1) { toast('Ancho inválido','error'); return; }
  if (!pH || pH < 0.1) { toast('Alto inválido','error'); return; }

  const existing = (await kv.get('panel_presets_custom')) || [];
  const updated = existing.map(p => p.id === id
    ? { ...p, label, sub: `${wp}W · ${pW}×${pH}m`, wp, pW, pH,
        ...(voc ? { voc } : { voc: null }), ...(imp ? { imp } : { imp: null }) }
    : p
  );
  await kv.set('panel_presets_custom', updated);
  toast('✅ Panel actualizado');
  navigate('#settings');
};

window.eliminarPanel = async function(id) {
  if (!await confirmDialog('¿Eliminar este modelo de panel?')) return;
  const existing = (await kv.get('panel_presets_custom')) || [];
  await kv.set('panel_presets_custom', existing.filter(p => p.id !== id));
  toast('Panel eliminado');
  navigate('#settings');
};
