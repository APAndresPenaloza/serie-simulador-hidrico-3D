// Pruebas de la conexión del río con la serie de simuladores hídricos 3D: la frontera
// de salida (lo que el río entrega a la ciénaga) y la de entrada (el agua del lago).
// Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';
import * as S from '../js/sistema.js';
import * as N from '../js/nodo.js';
import { crearFrontera, validarFrontera, recibeDe, RED } from '../js/conexion.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

const base = (cambios = {}) => ({ ...M.PARAMETROS_INICIALES, ...S.PARAMETROS_DISENO, ...cambios });
const calcular = (p) => S.calcular(p, { nivel: 4.4, bomba: true, t: 6 * 3600, nivelEmbalse: p.nivelEmbalse });

test('Red: el río recibe del lago y entrega a la ciénaga; el sistema recibe del río', () => {
  assert.deepEqual(RED.rios, { recibe: ['lagos'], entrega: ['cienagas'] });
  assert.ok(recibeDe('rios', 'lagos'));
  assert.ok(!recibeDe('rios', 'cienagas'));
  assert.ok(recibeDe('cienagas', 'rios'));
  assert.ok(recibeDe('sistema', 'rios'));
});

test('Frontera de salida: válida y coherente con el río', () => {
  const p = base();
  const r = calcular(p);
  const s = N.salida(p, r);
  const f = crearFrontera(N.NODO.id, { nodo: s.nodo, salida: s.salida, clima: s.clima });
  const v = validarFrontera(f);
  assert.ok(v.ok, v.errores.join(' '));
  assert.equal(f.origen, 'rios');
  // Caudal de la desembocadura = río en la zona baja + vertimiento
  cerca(f.salida.Q, r.rio.calidad.hid.baja.Q + r.rio.calidad.Qv, 1e-12);
  assert.ok(f.salida.Q > 0);
  // Calidad del agua del final del perfil de Streeter-Phelps
  cerca(f.salida.OD, r.rio.calidad.desembocadura.OD, 1e-12);
  cerca(f.salida.coliformes, r.rio.calidad.desembocadura.CF, 1e-12);
  // Sin lago, el sedimento es el de la cuenca
  cerca(f.salida.sedimento, p.sedimento, 1e-9);
});

test('Sin frontera del lago (Qlago = 0) el río no cambia', () => {
  const p = base();
  const sinClave = { ...p };
  delete sinClave.Qlago;
  const r0 = calcular(p);
  const r1 = calcular(sinClave);
  cerca(r0.cotaRioEf, r1.cotaRioEf, 1e-12);
  cerca(r0.rio.boc.Q, r1.rio.boc.Q, 1e-12);
  cerca(r0.rio.calidad.odMin.od, r1.rio.calidad.odMin.od, 1e-12);
});

test('El agua del lago entra por la cabecera: sube el caudal y la cota y diluye el vertimiento', () => {
  const p0 = base({ vertTipo: 'domestica' });
  const r0 = calcular(p0);
  const fr = crearFrontera('lagos', { nodo: 'Lago de prueba', salida: { Q: 1.5, fosforo: 20, sedimento: 3, temperatura: 14 } });
  assert.ok(validarFrontera(fr).ok);
  const entrada = N.entradas.find((e) => e.origen === 'lagos');
  const { cambios, texto } = entrada.aplicar(p0, fr);
  assert.deepEqual(cambios, { Qlago: 1.5, Plago: 20, SSlago: 3 });
  assert.match(texto, /1\.50 m³\/s/);
  const p1 = { ...p0, ...cambios };
  const r1 = calcular(p1);
  // Caudal en la bocatoma: +1.5 m³/s (la curva de la bocatoma es la del río completo)
  cerca(r1.rio.boc.Q, r0.rio.boc.Q + 1.5, 1e-3);
  assert.ok(r1.cotaRioEf > r0.cotaRioEf);
  // Las tres zonas llevan el agua del lago
  for (const z of ['alta', 'media', 'baja']) assert.ok(r1.rio.calidad.hid[z].Q > r0.rio.calidad.hid[z].Q + 1.4);
  // Más dilución: los coliformes en la bocatoma bajan
  assert.ok(r1.rio.calidad.bocatoma.CF < r0.rio.calidad.bocatoma.CF);
  // La frontera de salida lleva el agua del lago
  const s0 = N.salida(p0, r0).salida;
  const s1 = N.salida(p1, r1).salida;
  assert.ok(s1.Q > s0.Q + 1.4);
});

test('La frontera del lago mezcla el fósforo y el sedimento con el agua de la cuenca', () => {
  const p = base({ vertTipo: 'ninguno', Qlago: 2, Plago: 10, SSlago: 2 });
  const r = calcular(p);
  const s = N.salida(p, r).salida;
  const Qrio = r.rio.calidad.hid.baja.Q;
  const Qc = Qrio - 2;
  cerca(s.fosforo, (Qc * N.P_CUENCA + 2 * 10) / Qrio, 1e-9);
  cerca(s.sedimento, (Qc * p.sedimento + 2 * 2) / Qrio, 1e-9);
});

test('Una frontera de otro proyecto no se aplica al río', () => {
  assert.equal(N.entradas.find((e) => e.origen === 'cienagas'), undefined);
});
