// Pruebas del sistema de la ciénaga: escenario base, balances de agua y sal, régimen del año,
// salinidad de equilibrio y escenarios. Ejecutar con:  npm test
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
  assert.equal(Object.values(r.revision).flat().length, 14);
  assert.ok(Math.abs(r.z) < 0.1, 'el nivel sigue al mar');
  assert.ok(r.a.Smax <= 40 && r.a.Smin >= 2, 'salobre todo el año');
  assert.ok(r.a.Qc > 0 && r.q.Qc > 0, 'los caños llevan agua a la ciénaga');
});

test('Balance de agua y de sal en un paso del reloj', () => {
  const p = base();
  const sim = arrancar(p);
  const q = S.caudales(p, sim);
  const V0 = sim.V, M0 = sim.Msal;
  S.avanzar(p, sim, 1800);
  cerca(sim.V - V0, q.Qneto * 1800, 1e-3);
  const sal = (q.Qc > 0 ? q.Qc * p.Smag : q.Qc * q.S) + (q.Qb > 0 ? q.Qb * p.Smar : q.Qb * q.S);
  cerca(sim.Msal - M0, sal * 1800, 1e-2);
  // El balance suma ríos, caños, lluvia, evaporación y boca
  cerca(q.Qneto, q.Qr + q.Qc + q.Qll - q.Qe + q.Qb, 1e-9);
});

test('Régimen del año: después de 365 días la ciénaga vuelve al mismo estado', () => {
  const p = base();
  const sim = { ...S.estadoInicial(p) };
  const V0 = sim.V, S0 = sim.Msal / sim.V;
  for (let k = 0; k < 365 * 48; k++) { S.avanzar(p, sim, 1800); sim.t += 1800; }
  cerca(sim.V / V0, 1, 1e-6);
  cerca(sim.Msal / sim.V, S0, 1e-3);
});

test('Salinidad de equilibrio de cada mes con la fórmula racional', () => {
  const p = base();
  const a = S.anoMensual(p);
  for (const m of a.meses) {
    const Qd = m.Qr + Math.max(0, m.Qc) + m.Qll;
    cerca(m.Seq, (p.Smar * m.Qbin) / (m.Qbin + Qd - m.Qe), 1e-9);
  }
  // Sube en la temporada seca y baja con la creciente del Magdalena
  assert.ok(a.meses[3].S > a.meses[10].S + 8);
  assert.ok(a.meses[3].Qc < a.meses[10].Qc);
});

test('Crisis del manglar y restauración: el agua dulce de los caños decide la sal', () => {
  const rb = calcular();
  const rc = calcular(S.ESCENARIOS.crisis.cambios);
  const rr = calcular(S.ESCENARIOS.restauracion.cambios);
  assert.ok(rc.a.Smax > rb.a.Smax && rb.a.Smax > rr.a.Smax);
  assert.ok(rc.saludPeor < 0.8 && rr.saludPeor === 1);
  assert.ok(falla(rc, 'Salud del manglar'));
  assert.ok(rr.a.Qc > 2 * rb.a.Qc, 'los caños dragados llevan más del doble');
});

test('Boca sedimentada y ascenso del mar', () => {
  const rb = calcular();
  const rs = calcular(S.ESCENARIOS.boca.cambios);
  assert.ok(rs.a.Qm < rb.a.Qm / 5, 'casi no entra agua de mar');
  assert.ok(rs.a.zMax > rb.a.zMax && rs.a.Smax < rb.a.Smax, 'más alta y más dulce');
  assert.ok(falla(rs, 'Boca abierta'));
  const rm = calcular(S.ESCENARIOS.mar.cambios);
  cerca(rm.a.zMax - rb.a.zMax, 0.5, 0.03);
  assert.ok(falla(rm, 'Nivel máximo del año'));
  assert.ok(rm.a.meses.some((m) => m.Qc < 0), 'en la sequía el agua sale por los caños hacia el río');
});

test('Calidad y sedimentos con sus fórmulas', () => {
  const r = calcular();
  cerca(r.ca.P, r.ca.Pin / (1 + Math.sqrt(r.ca.tau)), 1e-9);
  cerca(r.ca.Chl, M.clorofila(r.ca.P), 1e-12);
  cerca(r.ca.ODmin, r.ca.ODsat - r.ca.D - r.ca.A, 1e-12);
  cerca(r.sed.mm, M.tasaDeposito(r.sed.carga, r.sed.TE, S.SITIO.rhoB, r.sed.A), 1e-12);
  const re = calcular(S.ESCENARIOS.eutrofizacion.cambios);
  assert.ok(re.ca.ODmin < 2 && falla(re, 'Oxígeno mínimo'));
  assert.ok(re.pesca < r.pesca);
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const r = calcular(e.cambios);
    for (const v of [r.z, r.S, r.q.Qneto, r.a.Smax, r.a.zMax, r.ca.ODmin, r.sed.mm, r.saludPeor, r.tauDias]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});
