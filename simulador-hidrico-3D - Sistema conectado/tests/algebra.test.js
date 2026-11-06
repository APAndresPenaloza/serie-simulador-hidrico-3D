// Pruebas del álgebra lineal del sistema conectado (valores calculados a mano).
// Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/algebra.js';
import { RED } from '../js/nucleo/conexion.js';
import { ORDEN } from '../js/cadena.js';

const cerca = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a}`);

test('Producto y potencias de matrices', () => {
  const A = [[1, 2], [3, 4]];
  assert.deepEqual(L.multiplicar(A, [[5], [6]]), [[17], [39]]);
  assert.deepEqual(L.potencia(A, 2), [[7, 10], [15, 22]]);
  assert.deepEqual(L.potencia(A, 3), [[37, 54], [81, 118]]);
  assert.throws(() => L.multiplicar([[1, 2]], [[1, 2]]));
});

test('Matriz de adyacencia de la serie: diez enlaces y caminos de dos pasos', () => {
  const A = L.adyacencia(ORDEN, RED);
  assert.equal(A.flat().reduce((a, b) => a + b, 0), 10);
  const i = (id) => ORDEN.indexOf(id);
  assert.equal(A[i('lagunas')][i('lagos')], 1);
  assert.equal(A[i('lagos')][i('lagunas')], 0);       // el agua no sube
  const A2 = L.potencia(A, 2);
  assert.equal(A2[i('lagunas')][i('rios')], 1);        // laguna → lago → río
  assert.equal(A2[i('cienagas')][i('cienagas')], 1);   // ciénaga → delta → ciénaga
  assert.equal(A2[i('deltas')][i('deltas')], 2);       // por la ciénaga y por el océano
  // La playa no entrega a nadie y la laguna alcanza a todos los demás
  const R = L.alcanzabilidad(A);
  assert.deepEqual(R[i('costas')], [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(R[i('lagunas')].reduce((a, b) => a + b, 0), 6);
  assert.equal(R[i('lagunas')][i('lagunas')], 0);
});

test('Gauss-Jordan con pivoteo: solución, determinante y matriz singular', () => {
  // 2x + y − z = 8; −3x − y + 2z = −11; −2x + y + 2z = −3  →  (2, 3, −1), det = −1
  const { X, det } = L.gaussJordan([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [[8], [-11], [-3]]);
  cerca(X[0][0], 2); cerca(X[1][0], 3); cerca(X[2][0], -1);
  cerca(det, -1, 1e-12);
  // Varios lados derechos a la vez: la inversa
  const inv = L.gaussJordan([[4, 7], [2, 6]], [[1, 0], [0, 1]]).X;
  cerca(inv[0][0], 0.6); cerca(inv[0][1], -0.7); cerca(inv[1][0], -0.2); cerca(inv[1][1], 0.4);
  assert.throws(() => L.gaussJordan([[1, 2], [2, 4]], [[1], [2]]), /singular/);
});

test('Error relativo de la iteración de punto fijo', () => {
  cerca(L.errorRelativo([100, 2], [101, 2]), 1 / 101);
  assert.equal(L.errorRelativo([1, 2, 3], [1, 2, 3]), 0);
});
