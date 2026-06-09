// tests/voc.test.js — Tests unitarios de calcVocPuro
// Ejecutar con: npx vitest run   (o: node --test tests/voc.test.js con Node 18+)
//
// Para correr sin instalar Vitest, este archivo también es compatible con
// el runner nativo de Node.js 18+:
//   node --experimental-vm-modules --test tests/voc.test.js

// ── Implementación inline (sin importar desde DOM) ────────────────────────
// Copiamos la función pura para que los tests corran sin browser.
// Cuando garantia.js sea un ES module puro, reemplazar por:
//   import { calcVocPuro } from '../js/garantia.js';
const VOC_COEF = -0.29; // %/°C

function calcVocPuro({ vocPanel, panelesSerie, vocMaxInversor, tMin, coefVoc }) {
  if (!vocPanel || !panelesSerie || !vocMaxInversor) return null;
  const coef    = coefVoc ?? VOC_COEF;
  const tMinVal = tMin ?? 3;

  const vocCorregido = vocPanel * (1 + (coef / 100) * (tMinVal - 25));
  const vocString    = vocCorregido * panelesSerie;
  const margen       = ((vocMaxInversor - vocString) / vocMaxInversor) * 100;
  const maxSerie     = Math.floor(vocMaxInversor * 0.90 / vocCorregido);

  let resultado, mensaje;
  if (vocString <= vocMaxInversor * 0.90) {
    resultado = 'seguro';
    mensaje   = `✅ Seguro. Margen: ${margen.toFixed(1)}%. Máximo recomendado: ${maxSerie} paneles en serie.`;
  } else if (vocString <= vocMaxInversor) {
    resultado = 'limite';
    mensaje   = `⚠️ En el límite (${margen.toFixed(1)}% de margen). Considera reducir a ${maxSerie} paneles en serie.`;
  } else {
    resultado = 'excede';
    mensaje   = `🚨 Excede el límite por ${(vocString - vocMaxInversor).toFixed(1)} V. Máximo seguro: ${maxSerie} paneles en serie.`;
  }

  return { vocPanel, panelesSerie, vocMaxInversor, tMin: tMinVal, coefVoc: coef,
           vocCorregido, vocString, margen, resultado, mensaje };
}

// ── Runner mínimo sin dependencias ────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function approx(a, b, tol = 0.001) {
  return Math.abs(a - b) < tol;
}

function test(name, fn) {
  console.log(`\n📋 ${name}`);
  try { fn(); } catch (e) { console.error(`  💥 Error no esperado: ${e.message}`); failed++; }
}

// ── Tests ─────────────────────────────────────────────────────────────────
test('Inputs vacíos / inválidos retornan null', () => {
  assert(calcVocPuro({}) === null,                                           'sin parámetros → null');
  assert(calcVocPuro({ vocPanel:0, panelesSerie:4, vocMaxInversor:600 }) === null, 'vocPanel=0 → null');
  assert(calcVocPuro({ vocPanel:50, panelesSerie:0, vocMaxInversor:600 }) === null, 'panelesSerie=0 → null');
  assert(calcVocPuro({ vocPanel:50, panelesSerie:4, vocMaxInversor:0  }) === null,  'vocMaxInversor=0 → null');
  assert(calcVocPuro({ vocPanel:NaN, panelesSerie:4, vocMaxInversor:600 }) === null, 'vocPanel=NaN → null');
});

test('Resultado "seguro" — string bien dimensionado', () => {
  // Panel 50Voc, 4 en serie, inversor 600V, T_min 3°C
  // Voc_corr = 50 * (1 + (-0.29/100) * (3-25)) = 50 * (1 + 0.0638) = 53.19 V
  // Voc_str  = 53.19 * 4 = 212.76 V < 600 * 0.90 = 540 V → seguro
  const r = calcVocPuro({ vocPanel:50, panelesSerie:4, vocMaxInversor:600, tMin:3, coefVoc:-0.29 });
  assert(r !== null,                    'retorna objeto');
  assert(r.resultado === 'seguro',      'resultado = seguro');
  assert(approx(r.vocCorregido, 53.19, 0.02), `vocCorregido ≈ 53.19 (actual: ${r.vocCorregido.toFixed(3)})`);
  assert(approx(r.vocString, 212.76, 0.1),    `vocString ≈ 212.76 (actual: ${r.vocString.toFixed(3)})`);
  assert(r.margen > 10,                 `margen positivo (${r.margen.toFixed(1)}%)`);
});

test('Resultado "excede" — demasiados paneles en serie', () => {
  // Panel 50Voc, 14 en serie, inversor 600V, T_min 3°C
  // Voc_str = 53.19 * 14 = 744.7 V > 600 V → excede
  const r = calcVocPuro({ vocPanel:50, panelesSerie:14, vocMaxInversor:600, tMin:3, coefVoc:-0.29 });
  assert(r !== null,               'retorna objeto');
  assert(r.resultado === 'excede', 'resultado = excede');
  assert(r.margen < 0,             `margen negativo (${r.margen.toFixed(1)}%)`);
  assert(r.mensaje.includes('Excede'), 'mensaje contiene "Excede"');
});

test('Resultado "limite" — dentro del límite pero sin margen del 10%', () => {
  // Panel 50Voc, 11 en serie, inversor 600V, T_min 3°C
  // Voc_str ≈ 53.19 * 11 = 585 V — entre 540 (90%) y 600 → limite
  const r = calcVocPuro({ vocPanel:50, panelesSerie:11, vocMaxInversor:600, tMin:3, coefVoc:-0.29 });
  assert(r !== null,               'retorna objeto');
  assert(r.resultado === 'limite', `resultado = limite (Voc_str=${r.vocString.toFixed(1)}V)`);
  assert(r.margen >= 0 && r.margen < 10, `margen entre 0-10% (${r.margen.toFixed(1)}%)`);
});

test('T_min afecta el resultado — sierra vs playa', () => {
  const base = { vocPanel:50, panelesSerie:11, vocMaxInversor:600, coefVoc:-0.29 };
  const playa  = calcVocPuro({ ...base, tMin: 5  }); // costa
  const sierra = calcVocPuro({ ...base, tMin: -5 }); // sierra alta
  assert(sierra.vocCorregido > playa.vocCorregido,
    `sierra (${sierra.vocCorregido.toFixed(2)}V) > playa (${playa.vocCorregido.toFixed(2)}V) — mayor riesgo en frío`);
  assert(sierra.margen < playa.margen,
    `menor margen en sierra (${sierra.margen.toFixed(1)}%) vs playa (${playa.margen.toFixed(1)}%)`);
});

test('tMin negativo (Chihuahua, -8°C) — cálculo correcto', () => {
  // Panel 48Voc, 10 en serie, inversor 550V, T_min -8°C
  // Voc_corr = 48 * (1 + (-0.29/100) * (-8-25)) = 48 * (1 + 0.09570) = 52.59 V
  // Voc_str  = 52.59 * 10 = 525.9 V < 550*0.90=495 → límite
  const r = calcVocPuro({ vocPanel:48, panelesSerie:10, vocMaxInversor:550, tMin:-8, coefVoc:-0.29 });
  assert(r !== null, 'tMin negativo retorna resultado');
  assert(approx(r.vocCorregido, 52.59, 0.05), `vocCorr ≈ 52.59 (actual: ${r.vocCorregido.toFixed(3)})`);
  assert(r.resultado !== undefined, 'tiene resultado clasificado');
});

test('Fallback a coef por defecto si no se proporciona', () => {
  const conCoef  = calcVocPuro({ vocPanel:50, panelesSerie:4, vocMaxInversor:600, tMin:3, coefVoc:-0.29 });
  const sinCoef  = calcVocPuro({ vocPanel:50, panelesSerie:4, vocMaxInversor:600, tMin:3 });
  assert(approx(conCoef.vocCorregido, sinCoef.vocCorregido),
    'resultado igual con coef explícito o por defecto');
});

test('maxSerie calculado correctamente', () => {
  // Con Voc_corr ≈ 53.19V e inversor 600V:
  // maxSerie = floor(600*0.90 / 53.19) = floor(540/53.19) = floor(10.15) = 10
  const r = calcVocPuro({ vocPanel:50, panelesSerie:4, vocMaxInversor:600, tMin:3, coefVoc:-0.29 });
  const esperado = Math.floor(600 * 0.90 / r.vocCorregido);
  assert(r.mensaje.includes(String(esperado)),
    `mensaje menciona maxSerie=${esperado}`);
});

// ── Resultado final ────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
