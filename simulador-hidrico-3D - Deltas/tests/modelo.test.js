// Pruebas del modelo del delta con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Periódica: caudal del año como serie de Fourier', () => {
  // En el día del máximo y sin onda semestral: Q = 7 200 × 1.42 = 10 224 m³/s
  cerca(M.caudalRio(315, 7200, 0.42, 315, 0, 160), 10224, 1e-9);
  // Período de un año
  cerca(M.caudalRio(100, 7200, 0.42, 315, 0.12, 160), M.caudalRio(465, 7200, 0.42, 315, 0.12, 160), 1e-9);
  // El promedio del año es Q̄
  let s = 0;
  for (let d = 0; d < 365; d++) s += M.caudalRio(d, 7200, 0.42, 315, 0.12, 160);
  cerca(s / 365, 7200, 1e-6);
});

test('Potencia: curva de sedimento y carga', () => {
  assert.equal(M.concentracion(7200, 7200, 600, 1.4), 600);
  // Con el doble del caudal: 600 × 2^0.4 = 791.7 mg/L, y la carga crece como 2^1.4
  cerca(M.concentracion(14400, 7200, 600, 1.4), 600 * 2 ** 0.4, 1e-9);
  cerca(M.carga(14400, M.concentracion(14400, 7200, 600, 1.4)) / M.carga(7200, 600), 2 ** 1.4, 1e-12);
  // 7 200 m³/s con 600 mg/L = 4 320 kg/s
  cerca(M.carga(7200, 600), 4320, 1e-9);
});

test('Potencia y decimales: Manning y reparto entre brazos', () => {
  // Cauce de 100 m × 5 m con n = 0.03: A = 500, R = 500/110, K = 500·R^(2/3)/0.03
  cerca(M.conductancia(100, 5, 0.03), (500 * (500 / 110) ** (2 / 3)) / 0.03, 1e-6);
  cerca(M.velocidadManning(100, 5, 0.03, 1e-4), ((500 / 110) ** (2 / 3) * 0.01) / 0.03, 1e-12);
  // Dos brazos iguales se reparten mitad y mitad; con cuatro veces la pendiente, el doble
  assert.deepEqual(M.reparto([{ B: 100, h: 5, n: 0.03, S: 1e-4 }, { B: 100, h: 5, n: 0.03, S: 1e-4 }]), [0.5, 0.5]);
  const f = M.reparto([{ B: 100, h: 5, n: 0.03, S: 1e-4 }, { B: 100, h: 5, n: 0.03, S: 4e-4 }]);
  cerca(f[1], 2 / 3, 1e-12);
  // Con la compuerta cerrada el brazo no toma agua
  assert.equal(M.reparto([{ B: 100, h: 5, n: 0.03, S: 1e-4 }, { B: 100, h: 5, n: 0.03, S: 1e-4, apertura: 0 }])[1], 0);
});

test('Racional, exponencial y logarítmica: el canal de la desembocadura', () => {
  // h = 4 800/(400 × 1.2) = 10 m
  cerca(M.profundidadRegimen(4800, 400, 1.2), 10, 1e-12);
  // Después de un tiempo τ queda 1/e de la diferencia
  cerca(M.relajar(10, 6, 86400, 86400), 6 + 4 / Math.E, 1e-12);
  // u* = 0.41 × 1/(ln(10/0.001) − 1) = 0.0499 m/s
  cerca(M.velocidadFriccion(1, 10, 0.001), 0.41 / (Math.log(10000) - 1), 1e-12);
  // El promedio del perfil logarítmico en la vertical es la velocidad media
  const us = M.velocidadFriccion(1, 10, 0.001);
  let suma = 0;
  const n = 200000;
  for (let k = 0; k < n; k++) suma += M.perfilLog(0.001 + ((k + 0.5) * (10 - 0.001)) / n, us, 0.001);
  cerca(suma / n, 1, 1e-3);
  // τ = 1000 × 0.05² = 2.5 Pa
  cerca(M.esfuerzoFondo(0.05), 2.5, 1e-12);
});

test('Raíz y polinomio en Fr^(2/3): la cuña salina', () => {
  cerca(M.gReducida(36), 9.81 * 0.00078 * 36, 1e-12);
  // U = 1 m/s, g' = 0.25, h = 4 m: Fr = 1/√1 = 1 → la cuña sale de la boca
  cerca(M.froudeDensimetrico(1, 0.25, 4), 1, 1e-12);
  assert.equal(M.cunaSalina(10, 2.5e-4, 1), 0);
  // Fr = 0.5: L = 10/(4 × 2.5·10⁻⁴) × [0.2/0.25 − 2 + 3·0.5^(2/3) − 1.2·0.5^(4/3)] = 2 136.6 m
  cerca(M.cunaSalina(10, 2.5e-4, 0.5), 2136.6126, 1e-3);
  // Con menos caudal (Froude más pequeño) la cuña es más larga
  assert.ok(M.cunaSalina(10, 2.5e-4, 0.3) > M.cunaSalina(10, 2.5e-4, 0.5));
});

test('Exponencial y logarítmica: la pluma', () => {
  // L = 1 × 3/0.0003 = 10 km
  cerca(M.escalaPluma(1, 3, 0.0003), 10000, 1e-9);
  cerca(M.concentracionPluma(10000, 600, 10000), 600 / Math.E, 1e-9);
  // Alcance hasta 20 mg/L: 10 km × ln(30) = 34.01 km, y ahí C = 20
  cerca(M.alcancePluma(600, 10000, 20), 10000 * Math.log(30), 1e-9);
  cerca(M.concentracionPluma(M.alcancePluma(600, 10000, 20), 600, 10000), 20, 1e-9);
  assert.equal(M.alcancePluma(10, 10000, 20), 0);
});

test('Lineal y cuadrática: el delta crece, el mar sube y el cauce se eleva', () => {
  // 2·10⁷ m³ sobre un frente de 10 km y 40 m de alto: 50 m/año
  cerca(M.avanceFrente(2e7, 1e4, 40), 50, 1e-12);
  // Lóbulo de 1 km de radio: π/2 km²
  cerca(M.areaLobulo(1000), (Math.PI * 1e6) / 2, 1e-6);
  // 1.5 m con 7.5 mm/año: 200 años; (9 − 2) m con 14 mm/año: 500 años
  cerca(M.anosHastaMar(1.5, 7.5), 200, 1e-9);
  cerca(M.anosAvulsion(1, 9, 2, 14), 500, 1e-9);
});

test('Potencias y por tramos: oleaje, transporte litoral y tipo de delta', () => {
  // H_b = 0.39 × 9.81^0.2 × (7 × 1.5²)^0.4 = 1.855 m
  cerca(M.alturaRotura(1.5, 7), 1.85486, 1e-5);
  // A 45° sin(2θ) = 1: Q = 0.39·√(9.81/0.78)·2^2.5/(16 × 1.65 × 0.6) = 0.494 m³/s
  cerca(M.transporteLitoral(2, 45), (0.39 * Math.sqrt(9.81 / 0.78) * 2 ** 2.5) / (16 * 1.65 * 0.6), 1e-12);
  cerca(M.transporteLitoral(2, 0), 0, 1e-12);
  // El doble de altura de rotura: 2^2.5 = 5.66 veces el transporte
  cerca(M.transporteLitoral(2, 20) / M.transporteLitoral(1, 20), 2 ** 2.5, 1e-12);
  assert.equal(M.tipoDelta(2, 0.4), 'dominado por el río');
  assert.equal(M.tipoDelta(0.5, 0.4), 'dominado por el oleaje');
  assert.equal(M.tipoDelta(2, 5), 'dominado por la marea');
  assert.equal(M.claseMarea(1), 'micromareal');
  assert.equal(M.claseMarea(3), 'mesomareal');
  assert.equal(M.claseMarea(6), 'macromareal');
});
