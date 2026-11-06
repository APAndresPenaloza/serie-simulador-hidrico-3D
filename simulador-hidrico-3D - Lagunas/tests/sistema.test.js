// Pruebas del sistema de la laguna: escenario base, clima, páramo, histéresis, balance,
// vaciado súbito y año mes a mes. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';
import * as S from '../js/sistema.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const base = (cambios = {}) => ({ ...structuredClone(S.PARAMETROS), ...cambios });
function arrancar(p, sim0 = {}) {
  const sim = { ...S.estadoInicial(p), ...sim0 };
  sim.t = 6 * 3600;
  return sim;
}
const fallas = (r) => Object.values(r.revision).flat().filter((c) => c.nivel !== 'ok');

test('Escenario base: todos los criterios cumplen y la alerta es verde', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  assert.equal(fallas(r).length, 0, fallas(r).map((c) => c.texto).join('; '));
  assert.equal(Object.values(r.revision).flat().length, 21);
  assert.equal(r.alerta.nivel, 'verde');
  // La laguna empieza rebosando lo que entra, clara y oligotrófica
  assert.ok(r.q.Qvert > 0.09 && r.q.Qvert < 0.11);
  cerca(r.q.Qneto, 0, 1e-3);
  assert.ok(r.ca.V > 0.9 && r.ca.tsi.medio < 40);
  assert.ok(r.oxigeno.ODmin > 5 && r.laguna.autonomia > 120);
});

test('Clima: la temperatura sale de la recta y el glaciar del grado-día', () => {
  const p = base();
  const r = S.calcular(p, arrancar(p));
  cerca(r.temp.Tl, 27.6 - 0.0055 * 4300, 1e-9);
  cerca(r.gl.M, 7 * (27.6 - 0.0055 * 4900), 1e-9);
  // Con El Niño llueve 40 % menos, hace 0.8 °C más y la laguna depende más del glaciar
  const pn = base({ clima: 'nino' });
  const rn = S.calcular(pn, arrancar(pn));
  assert.ok(rn.bal.Qp < 0.61 * r.bal.Qp);
  assert.ok(rn.gl.Q > r.gl.Q);
  assert.ok(fallas(rn).some((c) => c.texto.startsWith('Lluvia del año')));
});

test('Páramo: el degradado regula menos y suelta más sedimento', () => {
  const pc = base();
  const pd = base({ estadoParamo: 'degradado', areaPotrero: 120 });
  const rc = S.calcular(pc, arrancar(pc));
  const rd = S.calcular(pd, arrancar(pd));
  assert.equal(rd.paramo.k, 12);
  assert.ok(rd.paramo.QfinVerano < rc.paramo.QfinVerano);
  assert.ok(rd.sed.carga > 20 * rc.sed.carga);
  assert.ok(fallas(rd).some((c) => c.texto.startsWith('Regulación del páramo')));
});

test('Balance: sin entradas el nivel baja como dice dh/dt = −Q/A', () => {
  const p = base({ lluviaAnual: 0, areaGlaciar: 0 });
  const sim = arrancar(p, { S: 0, h: 5 });
  const q0 = S.caudales(p, sim);
  assert.equal(q0.Qvert, 0);
  const salidas = q0.Qevap + q0.Qinf + q0.Qext;
  S.avanzar(p, sim, 3600);
  const { Au, hu } = S.geometria(p);
  // En una hora el volumen baja Q·3 600 (el área casi no cambia)
  cerca(M.volumenLaguna(5, Au, hu) - M.volumenLaguna(sim.h, Au, hu), salidas * 3600, 0.5);
});

test('Histéresis de Scheffer: con los mismos nutrientes, clara o turbia según la historia', () => {
  const p = base({ truchas: 25 });
  const clara = arrancar(p);
  const turbia = arrancar(p, { V: 0.02 });
  for (let d = 0; d < 150; d++) { S.avanzar(p, clara, 86400); clara.t += 86400; S.avanzar(p, turbia, 86400); turbia.t += 86400; }
  assert.ok(S.calcular(p, clara).ca.V > 0.7, 'la laguna clara sigue clara');
  assert.ok(S.calcular(p, turbia).ca.V < 0.1, 'la laguna turbia sigue turbia');
  // Sin las jaulas, la turbia se recupera
  const q = base();
  for (let d = 0; d < 150; d++) { S.avanzar(q, turbia, 86400); turbia.t += 86400; }
  assert.ok(S.calcular(q, turbia).ca.V > 0.7, 'sin truchas vuelve a aclararse');
});

test('Truchas: el fósforo, la clorofila y el oxígeno de la madrugada', () => {
  const p = base({ truchas: 25 });
  const r = S.calcular(p, arrancar(p));
  cerca(r.ca.c.Ptotal, 24.5 + 250, 1e-9);
  assert.ok(r.ca.P > 10 && r.ca.Chl > 10);
  assert.ok(r.oxigeno.ODmin < 5);
});

test('Vaciado súbito: solo con morrena; la laguna baja y el pico pasa por el pueblo', () => {
  const pr = base();
  const sr = arrancar(pr);
  assert.equal(S.iniciarVaciado(pr, sr), false);
  const p = base({ cierre: 'morrena' });
  const sim = arrancar(p);
  const r0 = S.calcular(p, sim);
  assert.ok(r0.am.desborda, 'la crecida no cabe en el cauce del pueblo');
  cerca(r0.am.Qp, 75 * (r0.am.Vbrecha / 1e6) ** 0.67, 1e-9);
  assert.equal(S.iniciarVaciado(p, sim), true);
  const V0 = r0.V;
  for (let k = 0; k < 24; k++) { S.avanzar(p, sim, 600); sim.t += 600; }
  const r1 = S.calcular(p, sim);
  assert.ok(r1.h < r0.h - 1, 'la laguna baja más de un metro');
  assert.ok(V0 - r1.V > 0.5 * r0.am.Vbrecha);
});

test('Año mes a mes: rebosa los 12 meses; con El Niño, sin glaciar y más toma se seca la quebrada', () => {
  const r = S.anoMensual(base());
  assert.equal(r.meses.length, 12);
  assert.equal(r.mesesSinRebose.length, 0);
  const seca = S.anoMensual(base(S.ESCENARIOS.sequia2066.cambios));
  assert.ok(seca.mesesSinRebose.length >= 1, 'algún mes sin rebose');
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const p = base(e.cambios);
    const r = S.calcular(p, arrancar(p, e.sim ? e.sim(p) : {}));
    for (const v of [r.h, r.V, r.q.Qneto, r.ca.P, r.ca.kd, r.oxigeno.OD, r.sed.dV, r.am.Qp]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});
