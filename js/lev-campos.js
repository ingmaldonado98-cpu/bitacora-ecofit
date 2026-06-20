// lev-campos.js — renderCamposDinamicos: campos dinámicos según tipo de sistema
// Pura función sin estado — extrae la sección 'Eléctrico y consumo' del levantamiento

import { esc, fotoMini, CAMPOS_SISTEMA_PEQUENO } from './utils.js';
import { renderRecibos, renderAparatos, renderCargas } from './lev-consumo.js';
import { icon } from './icons.js';

export function renderCamposDinamicos(tipo, lev, edit, pid) {
  const dis = edit ? '' : 'disabled';
  if (tipo === 'interconectado' || tipo === 'hibrido' || tipo === 'hibrido_respaldo') {
    return `
    <div class="card">
      <h3 class="card-title">Tarifa CFE y contrato</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Número de Servicio CFE (NIS)</label>
          <input type="text" name="nisServicio" value="${esc(lev.nisServicio||'')}"
                 placeholder="12 dígitos" inputmode="numeric" maxlength="18" ${dis}/>
        </div>
        <div class="form-group">
          <label>RPU <span class="form-hint">Registro Permanente de Usuario</span></label>
          <input type="text" name="rpu" value="${esc(lev.rpu||'')}"
                 placeholder="En el recibo de CFE" ${dis}/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Titular del servicio</label>
          <input type="text" name="titularServicio" value="${esc(lev.titularServicio||'')}"
                 placeholder="Nombre en el recibo" ${dis}/>
        </div>
      </div>
      <div class="foto-tecnica-row">
        <div class="ft-label">${icon('camera',14)} Foto de la base del medidor</div>
        <div class="ft-slot">
          ${lev.fotoMedidor
            ? `${fotoMini(lev.fotoMedidor,'Base del medidor')}${edit?`<button type="button" class="btn-del-foto" onclick="delFotoMedidor('${pid}')">✕</button>`:''}`
            : (edit ? `<button type="button" class="btn-foto-sm" onclick="capFotoMedidor('${pid}')">${icon('camera')} Foto</button>` : '<span style="color:var(--text-muted);font-size:.75rem">Sin foto</span>')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tarifa</label>
          <select name="tarifaCFE" ${dis}>
            ${['DAC','1','1A','1B','1C','1D','1E','1F','OM','OMF','PDBT','GDMT','Otra'].map(t=>
              `<option ${lev.tarifaCFE===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Demanda contratada (kW) <span class="form-hint">opcional</span></label>
          <input type="number" name="demandaKW" value="${lev.demandaKW||''}" min="0" step="0.5" placeholder="Ej. 5" ${dis}/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Factor de potencia <span class="form-hint">opcional</span></label>
          <input type="number" name="factorPotencia" value="${lev.factorPotencia||''}" min="0.5" max="1" step="0.01" placeholder="Ej. 0.90" ${dis}/>
        </div>
        <div class="form-group">
          <label>Horario de uso</label>
          <select name="horarioUso" ${dis}>
            ${['Residencial 24h','Comercial diurno (9–19h)','Comercial nocturno','Agropecuario / rancho','Industrial'].map(t=>
              `<option ${lev.horarioUso===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Consumo del cliente</h3>
      <div class="chip-group" id="chip-consumo">
        <button type="button" class="chip ${(lev.modoConsumo||'recibo')==='recibo'?'chip-active':''}"
          onclick="setModoConsumo('recibo')">Con recibo CFE</button>
        <button type="button" class="chip ${lev.modoConsumo==='aparatos'?'chip-active':''}"
          onclick="setModoConsumo('aparatos')">Por aparatos</button>
      </div>
      <div id="panel-recibos" style="${lev.modoConsumo==='aparatos'?'display:none':''}">
        ${renderRecibos(lev.recibos||[], edit, pid)}
      </div>
      <div id="panel-aparatos" style="${lev.modoConsumo==='aparatos'?'':'display:none'}">
        ${renderAparatos(lev.aparatos||[], edit)}
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Configuración de baterías${tipo==='interconectado'?' <span class="form-hint">opcional — solo si lleva batería de respaldo</span>':''}</h3>
      <div class="form-row">
        <div class="form-group"><label>Autonomía requerida (horas)</label>
          <input type="number" name="autonomia" value="${lev.autonomia||''}" min="0" step="0.5" placeholder="Ej. 4" ${dis}/></div>
        <div class="form-group"><label>Banco de baterías (kWh)</label>
          <input type="number" name="bancoBaterias" value="${lev.bancoBaterias||''}" min="0" step="0.1" placeholder="Ej. 10" ${dis}/></div>
      </div>
      <div class="form-group">
        <label>Cargas críticas a respaldar
          <span class="form-hint">no son aparatos nuevos — son los de "Consumo del cliente" que deben seguir prendidos sin luz</span>
        </label>
        <div id="cargas-criticas">${renderCargas(lev.cargasCriticas||[],edit,'critica')}</div>
      </div>
      <div class="form-group">
        <label>Cargas secundarias
          <span class="form-hint">pueden esperar a que vuelva la luz</span>
        </label>
        <div id="cargas-secundarias">${renderCargas(lev.cargasSecundarias||[],edit,'secundaria')}</div>
      </div>
    </div>`;
  }

  if (tipo === 'aislado') {
    return `
    <div class="card">
      <h3 class="card-title">Configuración Off-grid</h3>
      <div class="form-group"><label>Autonomía requerida (horas) <span class="req-badge">CRÍTICO</span></label>
        <input type="number" name="autonomia" value="${lev.autonomia||''}" min="0" step="0.5" ${dis}/></div>
      <div class="form-group"><label>Cargas críticas (Alta prioridad)</label>
        <div id="cargas-criticas">${renderCargas(lev.cargasCriticas||[],edit,'critica')}</div>
      </div>
      <div class="form-group"><label>Cargas secundarias (Baja prioridad)</label>
        <div id="cargas-secundarias">${renderCargas(lev.cargasSecundarias||[],edit,'secundaria')}</div>
      </div>
      <div class="form-group"><label>Generador de respaldo</label>
        <select name="generador" ${dis} onchange="toggleGenerador(this.value)">
          <option ${!lev.generador?'selected':''} value="no">No</option>
          <option ${lev.generador==='gasolina'?'selected':''} value="gasolina">Sí — Gasolina</option>
          <option ${lev.generador==='diesel'?'selected':''} value="diesel">Sí — Diésel</option>
          <option ${lev.generador==='gas'?'selected':''} value="gas">Sí — Gas LP</option>
        </select>
      </div>
      <div id="gen-extra" style="${!lev.generador?'display:none':''}">
        <div class="form-row">
          <div class="form-group"><label>Arranque</label>
            <select name="generadorArranque" ${dis}>
              <option ${lev.generadorArranque==='automatico'?'selected':''} value="automatico">Automático</option>
              <option ${lev.generadorArranque==='manual'?'selected':''} value="manual">Manual</option>
            </select>
          </div>
          <div class="form-group"><label>Potencia (kW)</label>
            <input type="number" name="generadorKw" value="${lev.generadorKw||''}" min="0" step="0.1" ${dis}/></div>
        </div>
      </div>
      <div class="form-group"><label>Crecimiento futuro esperado <span class="req-badge">CRÍTICO</span></label>
        <textarea name="crecimientoFuturo" rows="2" ${dis} placeholder="Ej: después pondrán minisplit…">${esc(lev.crecimientoFuturo||'')}</textarea>
      </div>
    </div>`;
  }

  if (tipo === 'bombeo') {
    return `
    <div class="card">
      <h3 class="card-title">Bombeo solar</h3>
      <div class="form-row">
        <div class="form-group"><label>Tipo de bomba</label>
          <select name="tipoBomba" ${dis}>
            ${['Sumergible','Superficial','Periférica','Otra'].map(t=>
              `<option ${lev.tipoBomba===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Caudal requerido (L/h)</label>
          <input type="number" name="caudal" value="${lev.caudal||''}" min="0" ${dis}/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Profundidad del pozo (m)</label>
          <input type="number" name="profundidadPozo" value="${lev.profundidadPozo||''}" min="0" ${dis}/></div>
        <div class="form-group"><label>Horas de bombeo/día</label>
          <input type="number" name="horasBombeo" value="${lev.horasBombeo||''}" min="0" step="0.5" ${dis}/></div>
      </div>
    </div>`;
  }

  // 'respaldo' es legacy — los nuevos proyectos usan 'hibrido_respaldo'
  // Se mantiene por compatibilidad con datos anteriores
  if (tipo === 'respaldo') {
    return `
    <div class="card">
      <h3 class="card-title">Tarifa CFE y contrato</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Número de Servicio CFE (NIS)</label>
          <input type="text" name="nisServicio" value="${esc(lev.nisServicio||'')}"
                 placeholder="12 dígitos" inputmode="numeric" maxlength="18" ${dis}/>
        </div>
        <div class="form-group">
          <label>Titular del servicio</label>
          <input type="text" name="titularServicio" value="${esc(lev.titularServicio||'')}"
                 placeholder="Nombre en el recibo" ${dis}/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tarifa</label>
          <select name="tarifaCFE" ${dis}>
            ${['DAC','1','1A','1B','1C','1D','1E','1F','OM','OMF','PDBT','GDMT','Otra'].map(t=>
              `<option ${lev.tarifaCFE===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Demanda contratada (kW) <span class="form-hint">opcional</span></label>
          <input type="number" name="demandaKW" value="${lev.demandaKW||''}" min="0" step="0.5" placeholder="Ej. 5" ${dis}/>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Sistema de respaldo / Cargas</h3>
      <div class="form-row">
        <div class="form-group"><label>Autonomía requerida (horas)</label>
          <input type="number" name="autonomia" value="${lev.autonomia||lev.tiempoRespaldo||''}" min="0" step="0.5" placeholder="Ej. 4" ${dis}/></div>
        <div class="form-group"><label>Banco de baterías (kWh)</label>
          <input type="number" name="bancoBaterias" value="${lev.bancoBaterias||''}" min="0" step="0.1" placeholder="Ej. 10" ${dis}/></div>
      </div>
      <div class="form-group"><label>Cargas críticas a respaldar</label>
        <div id="cargas-criticas">${renderCargas(lev.cargasCriticas||[],edit,'critica')}</div>
      </div>
      <div class="form-group"><label>Cargas secundarias</label>
        <div id="cargas-secundarias">${renderCargas(lev.cargasSecundarias||[],edit,'secundaria')}</div>
      </div>
    </div>`;
  }

  if (tipo === 'sistema_pequeno') {
    return `
    <div class="card">
      <h3 class="card-title">Sistema eléctrico DC</h3>
      <div class="form-row">
        <div class="form-group"><label>Voltaje del sistema (compresor)</label>
          <select name="voltajeSistemaDC" ${dis}>
            <option value="">— Seleccionar —</option>
            ${['12V','24V','48V'].map(v=>`<option ${lev.voltajeSistemaDC===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Tipo de regulación de carga</label>
          <select name="tipoControlador" ${dis}>
            <option value="">— Seleccionar —</option>
            <option ${lev.tipoControlador==='PWM'?'selected':''} value="PWM">PWM</option>
            <option ${lev.tipoControlador==='MPPT'?'selected':''} value="MPPT">MPPT</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Arreglo de paneles</label>
          <select name="arregloPaneles" ${dis}>
            <option value="">— Seleccionar —</option>
            ${['Serie','Paralelo','Serie-Paralelo'].map(t=>`<option ${lev.arregloPaneles===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Arreglo de baterías</label>
          <select name="arregloBaterias" ${dis}>
            <option value="">— Seleccionar —</option>
            ${['Serie','Paralelo','Serie-Paralelo'].map(t=>`<option ${lev.arregloBaterias===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>¿Cómo se alimenta el refrigerador?</label>
        <select name="alimentacionRefrigerador" ${dis} onchange="window._onAlimentacionRefrigeradorChange(this)">
          <option value="">— Seleccionar —</option>
          <option value="directo_mppt" ${lev.alimentacionRefrigerador==='directo_mppt'?'selected':''}>Directo desde salida LOAD del controlador (refrigerador DC)</option>
          <option value="inversor_bateria" ${lev.alimentacionRefrigerador==='inversor_bateria'?'selected':''}>Vía inversor desde batería (refrigerador CA / tipo inverter)</option>
        </select>
      </div>
      <div class="form-row" id="inversor-peq-wrap" style="${lev.alimentacionRefrigerador!=='inversor_bateria'?'display:none':''}">
        <div class="form-group"><label>Potencia del inversor (W)</label>
          <input type="number" name="potenciaInversorW" value="${lev.potenciaInversorW||''}" min="0" step="50" placeholder="Ej: 500" ${dis}/>
        </div>
        <div class="form-group"><label>Modelo del inversor</label>
          <input type="text" name="inversor" value="${esc(lev.inversor||'')}" placeholder="Ej: Victron Phoenix 500VA" ${dis}/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Distancia panel→batería/refrigerador (m)
            <span class="form-hint">ideal &lt;3–5 m por caída de voltaje en DC</span>
          </label>
          <input type="number" name="distPanelRefrigerador" value="${lev.distPanelRefrigerador||''}" min="0" step="0.5" ${dis}/>
        </div>
        <div class="form-group"><label>Calibre de cable DC <span class="form-hint">AWG</span></label>
          <input type="text" name="calibreCableDC" value="${esc(lev.calibreCableDC||'')}" placeholder="Ej: 10 AWG" ${dis}/>
        </div>
      </div>
      <div class="form-group"><label>Exposición a temperatura ambiente extrema</label>
        <select name="exposicionTempExtrema" ${dis}>
          <option value="">— Seleccionar —</option>
          <option ${lev.exposicionTempExtrema==='si'?'selected':''} value="si">Sí — sin sombra/ventilación (duplica ciclos del compresor)</option>
          <option ${lev.exposicionTempExtrema==='no'?'selected':''} value="no">No — bien ventilado/con sombra</option>
        </select>
      </div>
      <div class="form-group"><label>Batería <span class="form-hint">modelo</span></label>
        <input type="text" name="bateria" value="${esc(lev.bateria||'')}" placeholder="Ej: LiFePO4 100Ah 48V" ${dis}/>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Breaker de batería
          <span class="form-hint">protección dedicada, independiente del breaker de paneles</span></label>
          <input type="text" name="breakerBateria" value="${esc(lev.breakerBateria||'')}" placeholder="Ej: DC 30A" ${dis}/>
        </div>
        <div class="form-group"><label>Breaker de paneles</label>
          <input type="text" name="breakerPanel" value="${esc(lev.breakerPanel||'')}" placeholder="Ej: DC 20A" ${dis}/>
        </div>
      </div>
      ${CAMPOS_SISTEMA_PEQUENO.filter(c=>!['inversor','bateria','breakerPanel'].includes(c.name)).map(c=>`
      <div class="form-group"><label>${esc(c.label)}</label>
        <input type="text" name="${c.name}" value="${esc(lev[c.name]||'')}" placeholder="${esc(c.placeholder)}" ${dis}/>
      </div>`).join('')}
    </div>`;
  }

  return ''; // tipo 'otro' — solo campos libres
}
