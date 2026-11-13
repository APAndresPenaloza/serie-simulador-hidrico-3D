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
  assert.equal(Object.values(r.revision).flat().length, 8);
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

test('Bosque de niebla de Macuira: el año de la niebla y de la lluvia', () => {
  const p = base();
  const r = calcular();
  const a = r.a;
  // Cavelier y Goldstein (1989) midieron 796 mm de niebla y 853 mm de lluvia en 1985
  assert.ok(a.niebla > 700 && a.niebla < 900, `${a.niebla} mm`);
  cerca(a.lluvia, p.lluviaMacuira, 1e-9);
  cerca(a.pctNiebla, a.niebla / (a.niebla + a.lluvia), 1e-12);
  // La base de las nubes queda cerca del límite inferior del bosque (550 m)
  assert.ok(a.zb > 500 && a.zb < 650, `${a.zb} m`);
  // La cima pasa más horas en la nube que el pie del bosque
  assert.ok(a.hCima > a.hBosque && a.hCima <= 8760);
  // La niebla del año es la suma de los meses
  cerca(a.niebla, a.meses.reduce((s, m) => s + m.niebla, 0), 1e-9);
  // En la madrugada la base de las nubes está más baja que en la tarde
  const madrugada = S.aireMacuira(p, 40, 5, 25), tarde = S.aireMacuira(p, 40, 14, 25);
  assert.ok(madrugada.zb < tarde.zb - 200);
  cerca(madrugada.zb, M.baseNubes(madrugada.T, M.puntoRocio(madrugada.T, madrugada.HR)), 1e-9);
  // Un día de niebla es la suma de sus horas
  const d = S.nieblaDia(p, 40, 25, 10);
  let mm = 0;
  for (let h = 0; h < 24; h++) mm += M.litrosPorM2(S.nieblaMacuira(p, S.aireMacuira(p, 40, h + 0.5, 25), 10).Fbosque, 3600);
  cerca(d.mm, mm, 1e-9);
});

test('Calentamiento: la base de las nubes sube y el bosque de niebla se seca', () => {
  const rb = calcular();
  const r2100 = calcular(S.ESCENARIOS.ano2100alto.cambios);
  assert.ok(r2100.a.zb > rb.a.zb + 80, `${rb.a.zb} → ${r2100.a.zb} m`);
  assert.ok(r2100.a.niebla < 0.7 * rb.a.niebla);
  assert.ok(falla(r2100, 'Agua de niebla del año'));
  // La Niña (aire más húmedo) trae más niebla y El Niño menos
  assert.ok(calcular({ clima: 'nina' }).a.niebla > rb.a.niebla && calcular({ clima: 'nino' }).a.niebla < rb.a.niebla);
});

test('Atrapanieblas: el agua para la comunidad wayuu', () => {
  const p = base();
  const r = calcular();
  cerca(r.mac.malla, p.nAtrapa * p.areaMalla, 1e-12);
  cerca(r.mac.aguaPeor, r.a.litrosPeor * r.mac.malla, 1e-9);
  cerca(r.mac.personasAno, (r.a.litros * r.mac.malla) / p.litrosPersona, 1e-9);
  assert.ok(r.mac.aguaPeor >= r.mac.demanda, 'en el escenario base alcanza todo el año');
  // Con la mitad de la malla ya no alcanza en el mes de menos niebla
  const r2 = calcular({ nAtrapa: 2 });
  assert.ok(falla(r2, 'Los atrapanieblas cubren'));
});
