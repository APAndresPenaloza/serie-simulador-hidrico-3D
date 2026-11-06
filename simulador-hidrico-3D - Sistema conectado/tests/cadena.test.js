// Pruebas de la cadena del páramo al océano: composición, lazo, trazadores, clima, horizonte
// y fronteras. Necesitan las carpetas de los demás proyectos junto a esta (como en el .zip).
// Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS, faltan } from '../js/proyectos.js';
import * as C from '../js/cadena.js';
import * as S from '../js/sistema.js';
import { crearFrontera } from '../js/nucleo/conexion.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const p0 = () => structuredClone(S.PARAMETROS);
const base = C.calcularCadena(MODULOS, p0());

test('Los siete proyectos se cargan y el lazo de la costa converge', () => {
  assert.deepEqual(faltan(), []);
  for (const id of C.ORDEN) assert.equal(base.nodos[id].fuente, 'modelo', id);
  assert.ok(base.convergio);
  assert.ok(base.iteraciones.length - 1 <= 4, `${base.iteraciones.length - 1} iteraciones`);
  assert.ok(base.iteraciones.at(-1).error < 1e-6);
  assert.equal(base.enlaces.length, 10);
  assert.ok(base.enlaces.every((e) => e.valida));
});

test('Composición: la salida de un eslabón es la entrada del siguiente', () => {
  const { lagunas, lagos, rios, cienagas } = base.nodos;
  // El lago recibe el rebose medio de la laguna como un tributario
  cerca(lagos.pn.aporteExterno, lagunas.f.salida.Q, 1e-12);
  // El río recibe el lago mes a mes por la cabecera: Q = cuenca + lago + vertimiento
  rios.m.forEach((m, k) => {
    cerca(m.Qlago, lagos.m[k].Q, 1e-12);
    cerca(m.Q, m.Qcuenca + m.Qlago + m.Qv, 1e-12);
  });
  // La ciénaga: el río de la cadena reemplaza a uno de los ríos de referencia (6.35 m³/s)
  cerca(cienagas.pn.Qrios, 40 - 6.35 + rios.f.salida.Q, 1e-9);
  const otros = 40 - 6.35;
  cerca(cienagas.pn.Prios, (otros * 40 + rios.f.salida.Q * rios.f.salida.fosforo) / (otros + rios.f.salida.Q), 1e-9);
});

test('El océano fija el mar de la ciénaga, del delta y de la playa', () => {
  const m = base.nodos.oceanos.f.mar;
  const { cienagas, deltas, costas } = base.nodos;
  cerca(cienagas.pn.nivelMar, m.nivelMedio, 1e-12);
  cerca(deltas.pn.Hs, m.Hs, 1e-12);
  cerca(deltas.pn.ascensoMar, m.ascenso, 1e-12);
  cerca(costas.pn.Hs0, 0.75 * m.Hs, 1e-12);       // la bahía abriga el 75 % de la altura
  cerca(costas.pn.theta0, 0.15 * 20, 1e-12);       // y refracta el oleaje: 20° → 3°
  cerca(costas.pn.aporte, Math.round((447000 * deltas.f.salida.Qs) / 4200), 0.5);
});

test('Trazadores: cada fila suma 1 y la fracción de la laguna es un producto de mezclas', () => {
  const T = base.trazador;
  for (const fila of T.F) cerca(fila.reduce((a, b) => a + b, 0), 1, 1e-12);
  cerca(T.F[0][0], 1, 1e-15);
  const f = T.flujos;
  cerca(T.F[1][0], f.Qext / f.QinK, 1e-12);
  cerca(T.F[2][0], T.F[1][0] * (f.Qlago / f.QinR), 1e-12);
  cerca(T.det, 1 - T.M[3][5] * T.M[5][3], 1e-12);
  // El agua del delta es toda del río grande; la salinidad frente a las bocas coincide con el océano
  assert.deepEqual(T.F[4], [0, 1, 0, 0]);
  const Smar = base.nodos.oceanos.f.mar.salinidad;
  assert.ok(Math.abs(T.F[5][2] * Smar - base.nodos.oceanos.r.pl.S) < 1);
  // La fracción de la laguna cae varios órdenes de magnitud hasta el mar
  assert.ok(T.F[5][0] < 1e-5 && T.F[5][0] > 0);
});

test('Sin conectar, cada eslabón usa sus valores de referencia', () => {
  const solo = C.calcularCadena(MODULOS, { ...p0(), acoplar: false });
  assert.equal(solo.iteraciones.length, 1);
  assert.equal(solo.nodos.lagos.pn.aporteExterno, 0);
  cerca(solo.nodos.rios.r.a.Qlago, 0, 1e-12);
  // Al conectar, el desagüe del lago crece casi lo mismo que le entrega la laguna
  const dQ = base.nodos.lagos.f.salida.Q - solo.nodos.lagos.f.salida.Q;
  assert.ok(Math.abs(dQ - base.nodos.lagunas.f.salida.Q) / base.nodos.lagunas.f.salida.Q < 0.05, `ΔQ = ${dQ}`);
});

test('El Niño baja el caudal de toda la cadena y La Niña lo sube', () => {
  const nino = C.calcularCadena(MODULOS, { ...p0(), clima: 'nino' });
  const nina = C.calcularCadena(MODULOS, { ...p0(), clima: 'nina' });
  for (const id of ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas']) {
    assert.ok(nino.nodos[id].f.salida.Q < base.nodos[id].f.salida.Q, `El Niño en ${id}`);
    assert.ok(nina.nodos[id].f.salida.Q > base.nodos[id].f.salida.Q, `La Niña en ${id}`);
  }
  // El clima de la ciénaga no se cuenta dos veces: el río de la cadena entra con su propio caudal
  const fR = MODULOS.cienagas.S.CLIMAS.nino.fRios;
  cerca(nino.nodos.cienagas.pn.Qrios, (40 - 6.35) + nino.nodos.rios.f.salida.Q / fR, 1e-9);
});

test('Horizonte 2100 con muchas emisiones: el mar sube y llega a la costa', () => {
  const c = C.calcularCadena(MODULOS, { ...p0(), horizonte: 'a2100alto' });
  const m = c.nodos.oceanos.f.mar;
  // h = a·t + b·t² con a = 3.3 mm/año, b = 0.08 mm/año², t = 74 años
  cerca(m.nivelMedio, (3.3 * 74 + 0.08 * 74 * 74) / 1000, 1e-9);
  cerca(m.ascenso, 3.3 + 2 * 0.08 * 74, 1e-9);
  cerca(c.nodos.cienagas.pn.nivelMar, m.nivelMedio, 1e-12);
  cerca(c.nodos.costas.pn.ascensoMar, m.ascenso, 1e-12);
  assert.equal(c.nodos.lagunas.pn.anosFuturo, 74);
});

test('Una frontera importada reemplaza al modelo de ese eslabón', () => {
  const fr = crearFrontera('lagos', { nodo: 'Lago de prueba', salida: { Q: 5, fosforo: 20, sedimento: 3 } });
  const c = C.calcularCadena(MODULOS, { ...p0(), fr_lagos: fr });
  assert.equal(c.nodos.lagos.fuente, 'frontera');
  for (const m of c.nodos.rios.m) cerca(m.Qlago, 5, 1e-12);
  assert.ok(c.nodos.rios.f.salida.Q > base.nodos.rios.f.salida.Q + 3);
});

test('Si falta un proyecto, la cadena sigue con su frontera de referencia', () => {
  const mods = { ...MODULOS, deltas: { id: 'deltas', ok: false, error: 'carpeta ausente' } };
  const c = C.calcularCadena(mods, p0());
  assert.equal(c.nodos.deltas.fuente, 'referencia');
  cerca(c.nodos.deltas.f.salida.Q, base.nodos.deltas.f.salida.Q, 1);
  assert.ok(c.convergio);
});

test('Interpolación del día: la mitad de cada mes da el valor del mes', () => {
  const serie = Array.from({ length: 12 }, (_, k) => 10 * (k + 1));
  cerca(C.valorDia(serie, 15.5), 10, 1e-12);            // mitad de enero
  cerca(C.valorDia(serie, 31 + 14), 20, 1e-12);          // mitad de febrero
  cerca(C.valorDia(serie, 0), 65, 1e-9);                 // 1 de enero: a medio camino entre diciembre (120) y enero (10)
  cerca(C.valorDia(serie, 365), C.valorDia(serie, 0), 1e-12);
});
