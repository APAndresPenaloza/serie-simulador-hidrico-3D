// Pruebas del sistema del océano: escenario base, Ekman y afloramiento, calor acumulado en el
// arrecife, pluma, proyecciones y escenarios. Ejecutar con:  npm test
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
  assert.equal(Object.values(r.revision).flat().length, 6);
  cerca(r.a.U, 8, 1e-6);
  assert.ok(r.a.Tgmin < r.a.Tmin - 2, 'el afloramiento enfría La Guajira');
  assert.equal(r.fu.nivel, 0);
});

test('Ekman: la cadena viento → esfuerzo → transporte → afloramiento → enfriamiento', () => {
  const p = base();
  const q = S.forzantes(p, 40 * 86400);
  cerca(q.tau, M.esfuerzoViento(q.U, p.Cd), 1e-12);
  cerca(q.Mek, q.tau / (M.RHO * M.coriolis(p.lat)), 1e-12);
  cerca(q.wDia, (q.Mek / (p.anchoAfloramiento * 1000)) * 86400, 1e-9);
  cerca(q.SSTgEq, q.SSTeq - p.enfriamiento * q.wDia, 1e-12);
  // Con los alisios de febrero el afloramiento es el más fuerte del año
  const a = S.anoMensual(p);
  assert.ok(a.meses[1].wDia > a.meses[8].wDia * 2);
});

test('La temperatura se acerca a su equilibrio y los DHW suman 12 semanas', () => {
  const p = base({ clima: 'nino' });
  const sim = { t: 0, T: 26, Tg: 26, hot: [] };
  const q = S.forzantes(p, 0);
  S.avanzar(p, sim, 21600);
  cerca(sim.T, M.relajar(26, q.SSTeq, 21600, p.tauSST * 86400), 1e-12);
  const sim2 = { t: 0, T: 31, Tg: 31, hot: [] };
  const p2 = base({ Tmedia: 31, Tamp: 0, MMM: 29 });
  S.avanzar(p2, sim2, 100 * 86400);
  assert.equal(sim2.hot.length, 84);
  // Dos grados sobre la MMM durante 12 semanas: 2 × 84/7 = 24 °C·semana
  cerca(S.calcular(p2, sim2).DHW, 24, 1e-6);
});

test('El Niño blanquea el coral; 2100 con muchas emisiones lo lleva a la alerta 2', () => {
  const rn = calcular(S.ESCENARIOS.nino.cambios);
  assert.ok(rn.a.dhwMax >= 4 && falla(rn, 'Sin alerta de blanqueamiento'));
  const ra = calcular(S.ESCENARIOS.ano2100alto.cambios);
  assert.equal(ra.alertaPeor.nivel, 4);
  assert.ok(falla(ra, 'Saturación de aragonito') && ra.fu.Om < 3);
});

test('Proyecciones: nivel del mar, CO₂, pH y aragonito con sus fórmulas', () => {
  const p = base({ anoHorizonte: 2050 });
  const r = S.calcular(p, arrancar(p));
  cerca(r.fu.nivel, 3.3 * 24 + 0.04 * 24 * 24, 1e-9);
  cerca(r.fu.C, 425 * Math.exp(0.0055 * 24), 1e-9);
  cerca(r.fu.pH, 8.05 - 0.9 * Math.log10(r.fu.C / 425), 1e-12);
  cerca(r.fu.Om, 3.9 * 10 ** (0.7 * (r.fu.pH - 8.05)), 1e-12);
});

test('Pluma: una gran creciente del río llega al arrecife', () => {
  const rb = calcular();
  const rc = calcular(S.ESCENARIOS.creciente.cambios);
  assert.ok(rb.pl.Sarrecife >= 34 && rc.pl.Sarrecife < 34);
  assert.ok(falla(rc, 'Salinidad en el arrecife'));
  cerca(rb.pl.S, M.salinidadPluma(36.2, 2000e6 * 10, 6800, 10 * 86400), 1e-9);
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const r = calcular(e.cambios);
    for (const v of [r.q.U, r.q.Hs, r.q.P, r.q.Mek, r.T, r.Tg, r.DHW, r.a.dhwMax, r.fu.nivel, r.fu.pH, r.fu.Om, r.pl.Sarrecife, r.rhoSup]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});
