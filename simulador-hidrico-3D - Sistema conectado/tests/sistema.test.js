// Pruebas del sistema conectado: escenario base, reloj, revisión, escenarios e intervenciones.
// Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/sistema.js';
import * as C from '../js/cadena.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const base = (c = {}) => ({ ...structuredClone(S.PARAMETROS), ...c });
const calcular = (c = {}, t = 0) => S.calcular(base(c), { t });

test('Escenario base: la red y los siete simuladores cumplen todos sus criterios', () => {
  const r = calcular();
  const todos = Object.values(r.revision).flat();
  const fallas = todos.filter((c) => c.nivel !== 'ok');
  assert.equal(fallas.length, 0, fallas.map((c) => c.texto).join('; '));
  const total = C.ORDEN.reduce((a, id) => a + r.cad.nodos[id].revision.total, 0);
  assert.equal(total, 78);
  assert.equal(r.revision.red.length, 3 + 7);
});

test('Reloj: los valores del día se interpolan entre los meses de cada modelo', () => {
  const dia = 100;
  const r = calcular({}, dia * 86400);
  const m = r.cad.nodos.rios.m.map((x) => x.Q);
  cerca(r.hoy.rios.Q, C.valorDia(m, dia), 1e-12);
  assert.equal(r.fecha.mes, 3);   // el día 101 del año es en abril
  // El año se repite
  cerca(calcular({}, (dia + 365) * 86400).hoy.rios.Q, r.hoy.rios.Q, 1e-12);
});

test('Edad del agua: suma de los tiempos de residencia', () => {
  const r = calcular();
  const { ind, edad } = r;
  cerca(edad.total, ind.laguna.tauDias + ind.lago.tauAnos * 365 + ind.rio.tViaje + ind.cienaga.tauDias, 1e-9);
  assert.ok(edad.total / 365 > 20, 'el lago retiene el agua décadas');
});

test('Intervenciones: sin las que cambian el clima, el horizonte o lo que llega por la conexión', () => {
  const ids = (id) => C.intervenciones(S.MODULOS, id).map((o) => o.valor);
  assert.ok(!ids('cienagas').includes('mar'));
  assert.ok(!ids('oceanos').includes('creciente') && !ids('oceanos').includes('ano2050'));
  assert.ok(!ids('lagunas').includes('glaciar2050'));
  assert.ok(ids('deltas').includes('represas'));
  // Las claves que fija la conexión se quitan de los cambios
  const eu = C.intervenciones(S.MODULOS, 'cienagas').find((o) => o.valor === 'eutrofizacion');
  assert.deepEqual(eu.cambios, { Pmag: 450 });
  const rel = C.intervenciones(S.MODULOS, 'costas').find((o) => o.valor === 'relleno');
  assert.deepEqual(rel.cambios, { relleno: 80000 });
});

test('Represas en la cuenca del río grande: menos arena para la playa', () => {
  const r0 = calcular();
  const r1 = calcular(S.ESCENARIOS.represas.cambios);
  assert.ok(r1.ind.delta.Qs < 0.5 * r0.ind.delta.Qs);
  assert.ok(r1.ind.playa.aporte < r0.ind.playa.aporte);
  assert.ok(r1.ind.playa.dW < r0.ind.playa.dW);
});

test('Todos los escenarios se calculan', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const r = calcular(e.cambios);
    assert.ok(Number.isFinite(r.ind.delta.Q), id);
    assert.ok(Object.values(r.revision).flat().length > 0, id);
  }
  assert.equal(calcular(S.ESCENARIOS.aislado.cambios).cad.acoplar, false);
});
