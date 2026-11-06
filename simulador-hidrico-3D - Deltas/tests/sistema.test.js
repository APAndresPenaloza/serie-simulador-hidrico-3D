// Pruebas del sistema del delta: escenario base, régimen del año, cuña salina, dragado,
// crecimiento del delta y escenarios. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';
import * as S from '../js/sistema.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const base = (c = {}) => ({ ...structuredClone(S.PARAMETROS), ...c });
const arrancar = (p) => ({ ...S.estadoInicial(p), t: 6 * 3600 });
const calcular = (c = {}) => { const p = base(c); return S.calcular(p, arrancar(p)); };
const fallas = (r) => Object.values(r.revision).flat().filter((c) => c.nivel !== 'ok');
const falla = (r, inicio) => fallas(r).some((c) => c.texto.startsWith(inicio));

test('Escenario base: todos los criterios cumplen', () => {
  const r = calcular();
  assert.equal(fallas(r).length, 0, fallas(r).map((c) => c.texto).join('; '));
  assert.equal(Object.values(r.revision).flat().length, 11);
  // El río del año: unos 7 200 m³/s y cerca de 140 millones de toneladas de sedimento
  cerca(r.a.Q, 7200, 15);
  assert.ok(r.a.Mt > 120e6 && r.a.Mt < 160e6, `${r.a.Mt}`);
  assert.ok(r.a.Qmin > 3500 && r.a.Qmax > 10000);
});

test('Reparto: lo que toma el Dique más lo que sale por la boca es el caudal del río', () => {
  const p = base();
  const q = S.forzantes(p, 100 * 86400, 12);
  cerca(q.Qd + q.Qp, q.Q, 1e-9);
  assert.ok(q.fD > 0.04 && q.fD < 0.07);
  cerca(S.fraccionDique({ ...p, aperturaDique: 0 }), 0, 1e-12);
});

test('Cuña salina: se acerca al equilibrio en unos dos días y entra en la sequía', () => {
  const p = base();
  const sim = { t: 60 * 86400, L: 0, h: 11, dragado: 0 };
  const q = S.forzantes(p, sim.t, sim.h);
  S.avanzar(p, sim, 2 * 86400);
  // Con el caudal casi fijo en dos días, queda 1/e de la diferencia
  assert.ok(Math.abs(sim.L - q.Leq * (1 - 1 / Math.E)) < 0.05 * q.Leq, `${sim.L} frente a ${q.Leq * (1 - 1 / Math.E)}`);
  const a = S.anoMensual(p);
  const marzo = a.meses[2].L, octubre = a.meses[9].L;
  assert.ok(marzo > 10 * octubre, 'la cuña es mucho más larga en la sequía');
});

test('El Niño: la cuña llega a la bocatoma y hay que dragar más', () => {
  const rb = calcular();
  const rn = calcular(S.ESCENARIOS.nino.cambios);
  assert.ok(rn.a.Lmax > rb.a.Lmax);
  assert.ok(falla(rn, 'La cuña salina no llega a la bocatoma'));
  assert.ok(rn.a.dragado > rb.a.dragado);
});

test('Dragado: sin draga el canal no alcanza el calado en la sequía', () => {
  const rs = calcular(S.ESCENARIOS.sinDragado.cambios);
  assert.ok(rs.a.diasBajo > 0 && rs.a.hmin < S.PARAMETROS.calado);
  assert.ok(falla(rs, 'Profundidad del canal'));
  // La draga devuelve el canal al calado más 0.5 m
  const p = base();
  const sim = { t: 80 * 86400, L: 1000, h: 9.5, dragado: 0 };
  S.avanzar(p, sim, 3600);
  cerca(sim.h, p.calado + S.SITIO.margenDragado, 1e-9);
  assert.ok(sim.dragado > 0);
});

test('Delta: el balance del frente y el tipo de delta con sus fórmulas', () => {
  const r = calcular();
  const de = r.de;
  cerca(de.Vs, (S.PARAMETROS.fRetencion * r.a.Mt) / S.PARAMETROS.rhoB, 1e-6);
  cerca(de.avance, (de.Vs - de.Vls) / (S.PARAMETROS.anchoFrente * 1000 * de.H), 1e-9);
  cerca(de.R, de.Vs / de.Vls, 1e-12);
  assert.equal(de.tipo, 'dominado por el río');
  // Con represas el oleaje gana y el delta retrocede
  const rr = calcular(S.ESCENARIOS.represas.cambios);
  assert.ok(rr.de.Vneto < 0 && rr.de.tipo === 'dominado por el oleaje');
  assert.ok(falla(rr, 'El frente del delta no retrocede'));
  // Con el mar subiendo rápido la llanura queda bajo el mar en menos de 100 años
  const rm = calcular(S.ESCENARIOS.mar.cambios);
  cerca(rm.de.anosMar, 1500 / 20, 1e-9);
  assert.ok(falla(rm, 'La llanura del delta'));
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const r = calcular(e.cambios);
    for (const v of [r.q.Q, r.q.C, r.L, r.h, r.q.Fr, r.q.alcance, r.de.avance, r.de.R, r.a.Mt, r.a.dragado, r.Cplaya]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});
