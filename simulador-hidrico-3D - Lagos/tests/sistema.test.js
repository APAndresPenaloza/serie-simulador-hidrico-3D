// Pruebas del sistema del lago: escenario base, balance, estratificación, oxígeno, nutrientes
// y escenarios. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';
import * as S from '../js/sistema.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const base = (c = {}) => ({ ...structuredClone(S.PARAMETROS), ...c });
const arrancar = (p) => ({ ...S.estadoInicial(p), t: 6 * 3600 });
const fallas = (r) => Object.values(r.revision).flat().filter((c) => c.nivel !== 'ok');

test('Escenario base: todos los criterios cumplen', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  assert.equal(fallas(r).length, 0, fallas(r).map((c) => c.texto).join('; '));
  assert.equal(Object.values(r.revision).flat().length, 15);
  cerca(r.mo.V / 1e6, 1833.33, 0.01);
  assert.ok(r.q.Qdesague > 1 && r.nu.tsi > 40 && r.nu.tsi < 50);
});

test('Balance: el nivel de equilibrio deja salir el excedente medio', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  cerca(r.bal.Qdesague, r.bal.Qin - r.bal.Qevap - p.extraccion, 1e-12);
  cerca(M.desague(r.nivel.eta, S.SITIO.Cdesague, p.anchoDesague), r.bal.Qdesague, 1e-9);
});

test('El Niño: el lago deja de desaguar y el fósforo sube con la residencia', () => {
  const pn = base({ clima: 'nino' });
  const rn = S.calcular(pn, arrancar(pn));
  const rb = S.calcular(base(), arrancar(base()));
  assert.ok(rn.ano.mesesSinDesague.length === 12);
  assert.ok(rn.nu.tau > rb.nu.tau && rn.nu.P > rb.nu.P);
  assert.ok(fallas(rn).some((c) => c.texto.startsWith('El lago desagua')));
});

test('Estratificación: se mezcla en julio y agosto; con calentamiento ya no', () => {
  const rb = S.anoMensual(base());
  assert.ok(rb.meses[6].diasMezcla > 20 && rb.meses[7].diasMezcla > 20);
  assert.ok(rb.meses[0].diasMezcla === 0);
  const rc = S.anoMensual(base(S.ESCENARIOS.calentamiento.cambios));
  assert.equal(rc.diasMezcla, 0);
  assert.ok(rc.diasAnoxia > 60, 'sin mezcla el fondo se queda sin oxígeno');
});

test('Oxígeno: baja en línea recta mientras está estratificado', () => {
  const p = base();
  const sim = arrancar(p);
  const r0 = S.calcular(p, sim);
  const OD0 = sim.ODh;
  for (let d = 0; d < 30; d++) { S.avanzar(p, sim, 86400); sim.t += 86400; }
  cerca(OD0 - sim.ODh, (r0.nu.AHOD / r0.mo.hh) * 30, 1e-6);
});

test('Ventarrón: mezcla el lago y repone el oxígeno del fondo', () => {
  const p = base();
  const sim = arrancar(p);
  const OD0 = sim.ODh;
  S.ventarron(p, sim);
  S.avanzar(p, sim, 86400);
  sim.t += 86400;
  assert.ok(sim.ODh > OD0 + 1);
});

test('Nutrientes: la carga es la suma de las fuentes y la admisible deja P = 20 µg/L', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  // Trucha: 1000 × (1.4 × 0.0083 − 0.0043) = 7.32 kg de fósforo por tonelada
  cerca(r.nu.carga, 200 * 8 + 1200 * 1 + 100 * 7.32 + 8000 * 0.6 * 0.5, 1e-9);
  cerca(M.fosforoLago(M.fosforoEntrada(r.nu.Lc, r.nu.Vsale), r.nu.tau), 20, 1e-9);
  const ra = S.calcular(base(S.ESCENARIOS.aguas.cambios), arrancar(base(S.ESCENARIOS.aguas.cambios)));
  assert.ok(ra.nu.P > 20 && ra.nu.tsi > 50);
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const p = base(e.cambios);
    const r = S.calcular(p, arrancar(p));
    for (const v of [r.nivel.eta, r.q.Qneto, r.tr.W, r.nu.P, r.oxigeno.ODh, r.viento.Ts]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});

test('Peces: tres especies para las jaulas (la trucha y dos nativas)', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  const t = r.cultivo.todas;
  assert.deepEqual(Object.keys(t), ['trucha', 'capitan', 'guapucha']);
  // Fósforo por tonelada con el balance lineal del alimento
  cerca(t.trucha.LP, 1000 * (1.4 * 0.0083 - 0.0043), 1e-9);
  cerca(t.capitan.LP, 1000 * (2.4 * 0.0083 - 0.0045), 1e-9);
  assert.ok(t.capitan.LP > 2 * t.trucha.LP, 'el capitán convierte peor el alimento: deja más del doble de fósforo');
  // Días a la cosecha con el crecimiento exponencial y la temperatura del lago
  for (const e of Object.values(t)) cerca(e.dias, Math.log(e.Wf / e.W0) / e.G, 1e-9);
  assert.ok(t.capitan.dias > 400 && t.trucha.dias < 250, 'el capitán crece mucho más despacio');
  // La producción que aguanta el lago llega justo a la carga admisible
  const otras = r.nu.carga - r.nu.fuentes.jaulas;
  for (const e of Object.values(t)) cerca(otras + e.prodMax * e.LP, r.nu.Lc, 1e-6);
  assert.ok(t.trucha.prodMax > t.guapucha.prodMax && t.guapucha.prodMax > t.capitan.prodMax);
  // Con el capitán la carga de las jaulas sube y su hábitat se mide con 6 mg/L de oxígeno
  const pc = base(S.ESCENARIOS.capitan.cambios);
  const rc = S.calcular(pc, arrancar(pc));
  cerca(rc.nu.fuentes.jaulas, 100 * t.capitan.LP, 1e-9);
  assert.ok(rc.nu.P > r.nu.P);
  assert.equal(rc.cultivo.ODmin, 6);
  // Todas las especies crecen al menos a la mitad de su óptimo en el agua del lago
  for (const e of Object.values(t)) assert.ok(e.fMin >= 0.5, `${e.clave}: ${e.fMin}`);
});

test('Peces: el factor térmico es una parábola por tramos', () => {
  cerca(M.factorTermico(15, 15, 4, 22), 1, 1e-12);
  cerca(M.factorTermico(9.5, 15, 4, 22), 1 - (5.5 / 11) ** 2, 1e-12);
  cerca(M.factorTermico(18.5, 15, 4, 22), 1 - (3.5 / 7) ** 2, 1e-12);
  assert.equal(M.factorTermico(3, 15, 4, 22), 0);
  assert.equal(M.factorTermico(23, 15, 4, 22), 0);
  // W(t) = W₀·e^(G·t) y su inversa t = ln(W_f/W₀)/G
  cerca(M.pesoPez(5, 0.02, 100), 5 * Math.exp(2), 1e-9);
  cerca(M.diasCosecha(5, 5 * Math.exp(2), 0.02), 100, 1e-9);
  assert.equal(M.diasCosecha(5, 300, 0), Infinity);
  cerca(M.produccionMaxima(1000, 8), 125, 1e-12);
  assert.equal(M.produccionMaxima(-50, 8), 0);
});
