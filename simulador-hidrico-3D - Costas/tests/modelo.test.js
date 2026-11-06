// Pruebas del modelo de la playa con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Cuadrática, raíz y decimales: oleaje en aguas profundas y mar combinado', () => {
  // L₀ = 9.81 × 8²/(2π) = 99.92 m
  cerca(M.longitudProfunda(8), (9.81 * 64) / (2 * Math.PI), 1e-12);
  // 1.2 m y 0.5 m se suman como catetos: √(1.44 + 0.25) = 1.3 m; T = (1.44·8 + 0.25·3)/1.69
  const c = M.combinar(1.2, 8, 0.5, 3);
  cerca(c.H, 1.3, 1e-12);
  cerca(c.T, (1.44 * 8 + 0.25 * 3) / 1.69, 1e-12);
});

test('Hiperbólica y potencia: oleaje que levanta el viento (SMB)', () => {
  // U = 10 m/s y F = 30 km: g·H/U² = 0.283·tanh[0.0125·(9.81 × 30 000/100)^0.42]
  const o = M.oleajeViento(10, 30000);
  cerca(o.H, (0.283 * 100 * Math.tanh(0.0125 * (9.81 * 300) ** 0.42)) / 9.81, 1e-12);
  cerca(o.H, 0.9906, 1e-4);
  assert.deepEqual(M.oleajeViento(0, 30000), { H: 0, T: 0 });
  // Con más fetch, más ola
  assert.ok(M.oleajeViento(10, 300000).H > o.H);
});

test('Hiperbólica: dispersión, asomeramiento y aguas someras', () => {
  // En aguas profundas L = L₀, C_g = C/2 y la ola no cambia
  cerca(M.longitudOnda(8, 1000), M.longitudProfunda(8), 1e-9);
  const p = M.celeridades(8, 1000);
  cerca(p.n, 0.5, 1e-12);
  cerca(M.transformar(1, 8, 0, 500).H, 1, 1e-9);
  // En aguas someras C → √(g·h): a 0.5 m de fondo, 2.21 m/s (con la aproximación, menos de 1 % de error)
  const s = M.celeridades(8, 0.5);
  assert.ok(Math.abs(s.C - Math.sqrt(9.81 * 0.5)) / Math.sqrt(9.81 * 0.5) < 0.01);
});

test('Lineal y trigonométrica: rotura, refracción y corriente litoral', () => {
  const rb = M.rotura(1.5, 8, 10);
  // En la profundidad de rotura la altura es 0.78 veces la profundidad
  cerca(rb.Hb / rb.hb, 0.78, 1e-9);
  // La refracción reduce el ángulo
  assert.ok(rb.thetab < 10 && rb.thetab > 0);
  // V = 1.17·√(9.81 × 2)·sin 45°·cos 45° = 2.59 m/s
  cerca(M.corrienteLitoral(2, 45), 1.17 * Math.sqrt(9.81 * 2) * 0.5, 1e-12);
  // CERC a 45°: 0.39·√(9.81/0.78)·2^2.5/(16 × 1.65 × 0.6) = 0.494 m³/s; de frente, cero
  cerca(M.transporteLitoral(2, 45), 0.49394, 1e-5);
  cerca(M.transporteLitoral(2, 0), 0, 1e-12);
});

test('Periódica, lineal y raíz: marea, sobreelevación y remonte', () => {
  cerca(M.marea(0, { K1: 1 }), 1, 1e-12);
  // 983 hPa: 30 cm por la presión
  cerca(M.sobreelevacionPresion(983), 0.3, 1e-12);
  // Viento de 20 m/s sobre 20 km de plataforma de 30 m: 1.2 × 0.0012 × 400 × 20 000/(1 025 × 9.81 × 30)
  cerca(M.sobreelevacionViento(20, 20000, 30), (1.2 * 0.0012 * 400 * 20000) / (1025 * 9.81 * 30), 1e-12);
  // Stockdon con H₀ = 1.5 m, T = 8 s y β = 0.08
  const HL = 1.5 * M.longitudProfunda(8);
  cerca(M.remonte(1.5, 8, 0.08), 1.1 * (0.35 * 0.08 * Math.sqrt(HL) + Math.sqrt(HL * (0.563 * 0.0064 + 0.004)) / 2), 1e-12);
});

test('Racional con raíz, potencia y cuadrática: perfil de playa y profundidad de cierre', () => {
  // Arena de 0.25 mm: w = 1.65·9.81·D²/(18·10⁻⁶ + √(0.75·1.65·9.81·D³)) = 3.18 cm/s
  cerca(M.velocidadCaida(0.00025), 0.031840, 1e-6);
  cerca(M.parametroDean(3.184), 0.067 * 3.184 ** 0.44, 1e-12);
  // h = A·x^(2/3): con A = 0.1 a 1 000 m, 10 m; y su inversa
  cerca(M.perfilDean(1000, 0.1), 10, 1e-9);
  cerca(M.distanciaDean(10, 0.1), 1000, 1e-6);
  // Hallermeier: 2.28 × 3 − 68.5 × 9/(9.81 × 81) = 6.064 m
  cerca(M.profundidadCierre(3, 9), 2.28 * 3 - (68.5 * 9) / (9.81 * 81), 1e-12);
});

test('Lineal y racional: línea de costa y regla de Bruun', () => {
  // (1 − 0.5) m³/s sobre 1 000 m × (2 + 8) m: 5·10⁻⁵ m/s
  cerca(M.cambioAncho(1, 0.5, 1000, 2, 8), 5e-5, 1e-15);
  // Bruun: 0.5 × 400/(2 + 6) = 25 m
  cerca(M.bruun(0.5, 400, 2, 6), 25, 1e-12);
  cerca(M.anosHastaMinimo(40, 20, -2), 10, 1e-12);
  assert.equal(M.anosHastaMinimo(40, 20, 1), Infinity);
});

test('Potencia, exponencial y periódica: el agua de baño', () => {
  // S₁ = 0.089 × 0.245^(1/3) × 40^(5/3)/0.6^(2/3) = 36.6
  cerca(M.dilucionInicial(0.245, 40, 0.6), (0.089 * 0.245 ** (1 / 3) * 40 ** (5 / 3)) / 0.6 ** (2 / 3), 1e-12);
  // En un T90 muere el 90 %
  cerca(M.decaimiento(1000, 3, 3), 100, 1e-9);
  // T90: corto al mediodía, largo de noche
  cerca(M.t90Hora(12, 3, 30), 3, 1e-12);
  cerca(M.t90Hora(0, 3, 30), 30, 1e-12);
});
