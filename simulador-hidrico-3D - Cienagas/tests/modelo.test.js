// Pruebas del modelo de la ciénaga con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Decimales: mezcla como promedio ponderado y lámina diaria a caudal', () => {
  // 10 m³/s de agua dulce y 30 m³/s de mar a 36 PSU: (10·0 + 30·36)/40 = 27 PSU
  cerca(M.mezcla([[10, 0], [30, 36]]), 27, 1e-12);
  // 8.64 mm/día sobre 1 km² = 8 640 m³/día = 0.1 m³/s
  cerca(M.mmDiaAm3s(8.64, 1e6), 0.1, 1e-12);
});

test('Lineal y cuadrática: área, volumen y su despeje', () => {
  const Ac = 400e6, s = 60e6;
  // A(1.5) = 400 + 60 × 1.5 = 490 km²
  cerca(M.areaCienaga(1.5, Ac, s), 490e6, 1e-3);
  // V(1.5) = 400·10⁶ × 1.5 + 60·10⁶ × 1.5²/2 = 600 + 67.5 = 667.5 hm³
  cerca(M.volumenCienaga(1.5, Ac, s), 667.5e6, 1e-3);
  // El despeje de la cuadrática devuelve la profundidad
  cerca(M.profundidadDeVolumen(667.5e6, Ac, s), 1.5, 1e-12);
  // La integral numérica de A(h) es V(h)
  let V = 0;
  const dh = 1e-4;
  for (let h = 0; h < 1.5 - 1e-12; h += dh) V += M.areaCienaga(h + dh / 2, Ac, s) * dh;
  cerca(V / M.volumenCienaga(1.5, Ac, s), 1, 1e-9);
  // Sin expansión (s = 0) el volumen es A·h
  cerca(M.profundidadDeVolumen(800e6, Ac, 0), 2, 1e-12);
  // Tiempo de residencia: 8.64·10⁶ m³ con 100 m³/s = 1 día
  cerca(M.tiempoResidencia(8.64e6, 100), 86400, 1e-9);
  assert.equal(M.tiempoResidencia(1, 0), Infinity);
});

test('Raíz cuadrada: caudal y velocidad por una abertura', () => {
  // Q = 0.6 × 600 × √(2 × 9.81 × 0.1) = 504.26 m³/s
  cerca(M.caudalAbertura(0.6, 600, 0.1), 504.2571, 1e-4);
  // Con el suavizado δ = 0.02 y Δh negativo el agua sale: 360·√(2g)·(−0.1)/√0.12 = −460.32
  cerca(M.caudalAbertura(0.6, 600, -0.1, 0.02), -460.3216, 1e-4);
  assert.equal(M.caudalAbertura(0.6, 0, 0.5, 0.02), 0);
  // v = 0.25 × √(2 × 9.81 × 0.5) = 0.783 m/s
  cerca(M.velocidadAbertura(0.25, 0.5), 0.78302, 1e-5);
  // Cuatro veces el desnivel: el doble del caudal
  cerca(M.caudalAbertura(1, 1, 0.4) / M.caudalAbertura(1, 1, 0.1), 2, 1e-12);
});

test('Signo del caudal: lo que entra del río y lo que vuelve al río', () => {
  // Q = Q⁺ − Q⁻: con 30 m³/s entra todo; con −12 m³/s la ciénaga devuelve 12 al río
  assert.deepEqual(M.partes(30), { entra: 30, sale: 0 });
  assert.deepEqual(M.partes(-12), { entra: 0, sale: 12 });
  // Con el desnivel al revés, el mismo caño lleva el mismo caudal en el otro sentido
  cerca(M.caudalAbertura(0.4, 25, -0.2, 0.02), -M.caudalAbertura(0.4, 25, 0.2, 0.02), 1e-12);
});

test('Cuadrática y racional: el viento inclina la ciénaga', () => {
  // τ = 1.2 × 0.0013 × 6² = 0.05616 Pa
  cerca(M.esfuerzoViento(6), 0.05616, 1e-12);
  // Δη = τ·L/(ρ·g·h) = 0.05616 × 25 000/(1000 × 9.81 × 1.5) = 0.09541 m
  cerca(M.setupViento(6, 25000, 1.5), 0.05616 * 25000 / (1000 * 9.81 * 1.5), 1e-12);
  cerca(M.setupViento(6, 25000, 1.5), 0.095413, 1e-6);
  // El doble de viento inclina cuatro veces más; la mitad de profundidad, el doble
  cerca(M.setupViento(12, 25000, 1.5) / M.setupViento(6, 25000, 1.5), 4, 1e-12);
  cerca(M.setupViento(6, 25000, 0.75) / M.setupViento(6, 25000, 1.5), 2, 1e-12);
  assert.equal(M.setupViento(0, 25000, 1.5), 0);
});

test('Periódicas: marea, número de forma y creciente del Magdalena', () => {
  cerca(M.marea(0, { K1: 1 }), 1, 1e-12);
  cerca(M.marea(23.934 / 2, { K1: 1 }), -1, 1e-12);
  // El Caribe: F = (0.09 + 0.07)/(0.06 + 0.02) = 2 → mixta, principalmente diurna
  cerca(M.numeroForma({ K1: 0.09, O1: 0.07, M2: 0.06, S2: 0.02 }), 2, 1e-12);
  assert.equal(M.tipoMarea(2), 'mixta, principalmente diurna');
  assert.equal(M.tipoMarea(0.1), 'semidiurna');
  assert.equal(M.tipoMarea(1), 'mixta, principalmente semidiurna');
  assert.equal(M.tipoMarea(4), 'diurna');
  // En el día del máximo de la onda anual (sin onda semestral): H = 1 + 0.7
  cerca(M.nivelRio(320, 1, 0.7, 320, 0, 150), 1.7, 1e-12);
  // Período de un año
  cerca(M.nivelRio(100, 1, 0.7, 320, 0.25, 150), M.nivelRio(465, 1, 0.7, 320, 0.25, 150), 1e-12);
  // El promedio del año es el nivel medio H̄
  let suma = 0;
  for (let d = 0; d < 365; d++) suma += M.nivelRio(d, 1, 0.7, 320, 0.25, 150);
  cerca(suma / 365, 1, 1e-9);
});

test('Racional con asíntota y exponencial: salinidad de la ciénaga', () => {
  // Tanta agua dulce como de mar y sin evaporación: la mitad de la salinidad del mar
  cerca(M.salinidadEquilibrio(36, 100, 100, 0), 18, 1e-12);
  // Sin agua dulce y con evaporación: más salada que el mar
  cerca(M.salinidadEquilibrio(36, 100, 0, 50), 72, 1e-12);
  // La evaporación iguala lo que entra: asíntota (hipersalina)
  assert.equal(M.salinidadEquilibrio(36, 100, 0, 100), Infinity);
  // Después de un tiempo τ queda 1/e de la diferencia: 30 + (10 − 30)/e = 22.64
  cerca(M.salinidadTiempo(10, 30, 20, 20), 30 - 20 / Math.E, 1e-12);
});

test('Por tramos: estrés del manglar, salud e índice de pesca', () => {
  assert.equal(M.estres(30, 40, 65), 0);
  cerca(M.estres(52.5, 40, 65), 0.5, 1e-12);
  assert.equal(M.estres(70, 40, 65), 1);
  // Suelo a 65 PSU: rojo muerto (0.4), blanco a la mitad (0.2 × 0.5) y negro (0.4 × 5/35)
  cerca(M.saludManglar(65), 1 - 0.4 - 0.1 - 0.4 * (5 / 35), 1e-12);
  assert.equal(M.saludManglar(20), 1);
  // Suelo: 1.25 × 28 + 5 = 40 PSU
  cerca(M.salinidadSuelo(28), 40, 1e-12);
  // Pesca: 1 en el estuario, 0.5 + 0.1·S en agua dulce, baja en agua hipersalina, por el oxígeno
  assert.equal(M.indicePesca(15, 5), 1);
  cerca(M.indicePesca(2, 5), 0.7, 1e-12);
  cerca(M.indicePesca(42.5, 5), 0.5, 1e-12);
  cerca(M.indicePesca(15, 2.5), 0.5, 1e-12);
  assert.equal(M.indicePesca(70, 5), 0);
});

test('Nutrientes y oxígeno: Vollenweider, Dillon y Rigler, APHA con sal', () => {
  cerca(M.fosforoCienaga(100, 0.25), 100 / 1.5, 1e-12);
  // Chl = 10^(1.449·log₁₀100 − 1.136) = 10^1.762 = 57.81 µg/L
  cerca(M.clorofila(100), 57.8096, 1e-4);
  // APHA a 20 °C: 9.09 mg/L; con 36 PSU, × (1 − 0.0051 × 36)
  cerca(M.odSaturacion(20), 9.0924, 1e-4);
  cerca(M.odSaturacion(20, 36), 9.0924 * (1 - 0.0051 * 36), 1e-3);
  // El oxígeno del día: mínimo a las 05:00 y máximo a las 17:00
  cerca(M.oxigenoHora(6, 1, 5), 5, 1e-12);
  cerca(M.oxigenoHora(6, 1, 17), 7, 1e-12);
});

test('Cuadrática y lineal: Stokes, retención y espesor depositado', () => {
  // Arena fina de 0.1 mm a 20 °C: 9.81 × 1650 × 10⁻⁸/(18 × 1.002·10⁻³) ≈ 8.98 mm/s
  cerca(M.velocidadCaida(1e-4, 20), 0.0089768, 1e-6);
  cerca(M.velocidadCaida(2e-4, 20) / M.velocidadCaida(1e-4, 20), 4, 1e-12);
  assert.equal(M.fraccionRetenida(1e-6, 4.85e8, 132), 1);
  cerca(M.fraccionRetenida(1e-7, 4.85e8, 132), 48.5 / 132, 1e-12);
  // 10⁶ t con lodo de 0.9 t/m³ sobre 500 km²: 2.22 mm
  cerca(M.tasaDeposito(1e6, 1, 0.9, 5e8), 2.2222, 1e-4);
});
