// Pruebas de la pestaña Informe: el estado que viaja en el código QR se codifica y se lee igual,
// las series largas se empacan sin perder cifras, y el QR se arma (o avisa si no cabe).
// Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarEstado, leerEstado, compactar, compactarEstado, mismoTipo, qrSVG, SITIO } from '../js/informe.js';

test('el estado del QR se codifica y se vuelve a leer igual', () => {
  const estado = { v: 1, e: 'base', t: 289621, d: { areaCuenca: 5.865, clima: 'nino', acoplar: true }, s: { h: 6.10096, glof: null }, tab: 'paramo', vi: 'general' };
  const hash = `#s=${codificarEstado(estado)}`;
  assert.match(hash, /^#s=[A-Za-z0-9_-]+$/);           // seguro en una dirección, sin «+», «/» ni «=»
  assert.deepEqual(leerEstado(hash), estado);
  assert.deepEqual(leerEstado(`#depurar&s=${codificarEstado(estado)}`), estado);
  assert.equal(leerEstado('#depurar'), null);
  assert.equal(leerEstado('#s=@@@'), null);
  assert.equal(leerEstado(''), null);
});

test('los textos con tildes y eñes llegan completos', () => {
  const estado = { d: { nombre: 'Ciénaga Grande · año seco (El Niño)' } };
  assert.deepEqual(leerEstado(`#s=${codificarEstado(estado)}`), estado);
});

test('compactar quita el ruido de los decimales y deja los enteros', () => {
  assert.equal(compactar(0.1 + 0.2), 0.3);
  assert.equal(compactar(1234567), 1234567);
  assert.deepEqual(compactar({ a: 2.0000000000004, b: [1 / 3] }, 6), { a: 2, b: [0.333333] });
});

test('una serie larga se empaca en diferencias y se recupera con 4 cifras', () => {
  const hot = Array.from({ length: 84 }, (_, k) => -0.08 + 0.0123 * k + 0.0004 * Math.sin(k));
  const s = compactarEstado({ T: 28.329187, hot });
  assert.ok(s.hot['~'], 'la serie va empacada');
  assert.ok(JSON.stringify(s.hot).length < JSON.stringify(hot).length / 3);
  const leido = leerEstado(`#s=${codificarEstado({ s })}`).s;
  assert.equal(leido.T, 28.3292);
  assert.equal(leido.hot.length, 84);
  const max = Math.max(...hot.map(Math.abs));
  for (let k = 0; k < 84; k++) assert.ok(Math.abs(leido.hot[k] - hot[k]) <= max * 1e-3, `día ${k}`);
});

test('solo se aceptan valores del mismo tipo que los de referencia', () => {
  assert.ok(mismoTipo(1.5, 3));
  assert.ok(!mismoTipo(1.5, '3'));
  assert.ok(!mismoTipo(1.5, Infinity));
  assert.ok(mismoTipo('nino', 'nina'));
  assert.ok(mismoTipo(true, false));
  assert.ok(mismoTipo([1, 2], [3]));
  assert.ok(mismoTipo(null, { t0: 1 }));
  assert.ok(!mismoTipo(null, [1]));
});

test('el código QR se arma para una dirección real y avisa si no cabe', () => {
  const url = `${SITIO}${encodeURI('simulador-hidrico-3D - Lagunas')}/#s=${codificarEstado({ v: 1, e: 'base', t: 289621, d: { areaCuenca: 5.865 } })}`;
  const svg = qrSVG(url);
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  assert.match(svg, /<path /);
  assert.equal(qrSVG(`${SITIO}#s=${'A'.repeat(5000)}`), '');
});
