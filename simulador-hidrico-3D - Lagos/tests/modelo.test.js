// Pruebas del modelo del lago con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Potencia: hipsometría, volumen y profundidad media', () => {
  const A0 = 55e6, zmax = 60, m = 0.8;
  // V = 55·10⁶ × 60/1.8 = 1 833.33 hm³; z̄ = 60/1.8 = 33.33 m
  cerca(M.volumenLago(A0, zmax, m), 1833.333333e6, 1);
  cerca(M.profundidadMedia(zmax, m), 33.333333, 1e-5);
  // A(12) = 55 × 0.8^0.8 = 46.02 km²
  cerca(M.areaProfundidad(12, A0, zmax, m) / 1e6, 55 * 0.8 ** 0.8, 1e-9);
  // La integral numérica de A(z) coincide con la fórmula
  let V = 0;
  const dz = 0.001;
  for (let z = 0; z < zmax; z += dz) V += M.areaProfundidad(z + dz / 2, A0, zmax, m) * dz;
  cerca(V / M.volumenLago(A0, zmax, m), 1, 1e-4);
  cerca(M.volumenBajo(0, A0, zmax, m), M.volumenLago(A0, zmax, m), 1e-3);
  // Un cono (m = 1) tiene V_d = 1
  cerca(M.desarrolloVolumen(M.profundidadMedia(60, 1), 60) - 0.5, 1, 1e-12);
  cerca(M.desarrolloOrilla(2 * Math.PI * 1000, Math.PI * 1e6), 1, 1e-12);   // círculo
});

test('Cuadrática: densidad del agua con vértice en 4 °C', () => {
  assert.equal(M.densidad(4), 1000);
  cerca(M.densidad(20), 1000 - 0.0068 * 256, 1e-12);            // 998.26 (tabla: 998.21)
  cerca(M.densidad(11), 999.6668, 1e-4);
  // Simetría de la parábola alrededor del vértice
  cerca(M.densidad(2), M.densidad(6), 1e-12);
  // Más caliente, más liviana: g' > 0 con la superficie a 14 °C y el fondo a 11 °C
  assert.ok(M.gravedadReducida(14, 11) > 0);
  cerca(M.gravedadReducida(14, 11), 9.81 * (M.densidad(11) - M.densidad(14)) / M.densidad(11), 1e-15);
});

test('Cuadrática y racional: esfuerzo del viento y número de Wedderburn', () => {
  // τ = 0.91 × 0.0013 × 8² = 0.075712 N/m²
  cerca(M.esfuerzoViento(8, 0.91), 0.075712, 1e-12);
  cerca(M.esfuerzoViento(16, 0.91) / M.esfuerzoViento(8, 0.91), 4, 1e-12);
  const us = M.velocidadFriccion(0.075712);
  cerca(us, Math.sqrt(0.075712 / 1000), 1e-15);
  // W = g'h²/(u*²L); con el doble de viento W baja a la cuarta parte
  const W1 = M.wedderburn(0.002, 12, M.velocidadFriccion(M.esfuerzoViento(4, 0.91)), 12300);
  const W2 = M.wedderburn(0.002, 12, M.velocidadFriccion(M.esfuerzoViento(8, 0.91)), 12300);
  cerca(W1 / W2, 4, 1e-9);
});

test('Raíz cuadrada: seiches de Merian superficial e interna', () => {
  // T = 2 × 12 300/√(9.81 × 33.33) = 1 361 s ≈ 22.7 min
  cerca(M.seicheSuperficial(12300, 33.333333), (2 * 12300) / Math.sqrt(9.81 * 33.333333), 1e-9);
  cerca(M.seicheSuperficial(12300, 33.333333) / 60, 22.68, 0.01);
  // Cuatro veces más hondo, la mitad del período
  cerca(M.seicheSuperficial(1000, 40) / M.seicheSuperficial(1000, 10), 0.5, 1e-12);
  // La interna es mucho más lenta: g' es mil veces menor que g
  assert.ok(M.seicheInterna(12300, 0.003, 12, 22) > 50 * M.seicheSuperficial(12300, 33.3));
  cerca(M.oscilacion(0.05, 100, 50), -0.05, 1e-12);
});

test('Lineal: oxígeno del hipolimnion y días hasta la anoxia', () => {
  // OD(100) = 7.6 − (0.33/22.5) × 100 = 6.133 mg/L
  cerca(M.oxigenoHipolimnion(7.6, 0.33, 22.5, 100), 7.6 - (0.33 / 22.5) * 100, 1e-12);
  // Raíz de la recta: t = (7.6 − 2) × 22.5/0.33 = 381.8 días
  cerca(M.diasHastaOxigeno(7.6, 2, 0.33, 22.5), (5.6 * 22.5) / 0.33, 1e-9);
  assert.equal(M.oxigenoHipolimnion(1, 0.33, 22.5, 1000), 0);
  cerca(M.odSaturacion(20), 9.09, 0.01);
});

test('Racional con raíz: Vollenweider y carga admisible', () => {
  // P = 92/(1 + √25) = 15.33 µg/L
  cerca(M.fosforoLago(92, 25), 92 / 6, 1e-12);
  // Carga admisible: con la carga admisible el lago queda justo en P_c
  const Vsale = 7.2e7, tau = 25;
  const Lc = M.cargaAdmisible(20, Vsale, tau);
  cerca(M.fosforoLago(M.fosforoEntrada(Lc, Vsale), tau), 20, 1e-9);
  // 6 200 kg en 7.2·10⁷ m³ = 86.1 µg/L
  cerca(M.fosforoEntrada(6200, 7.2e7), 86.111111, 1e-5);
});

test('Logaritmo y exponencial: equivalencias de Carlson y luz', () => {
  // TSI(P = 10) = 14.42 ln 10 + 4.15 = 37.35
  cerca(M.tsiFosforo(10), 14.42 * Math.log(10) + 4.15, 1e-12);
  // Duplicar el fósforo sube el índice 14.42·ln 2 = 10 puntos
  cerca(M.tsiFosforo(40) - M.tsiFosforo(20), 14.42 * Math.LN2, 1e-12);
  // Equivalencias: el Secchi de un TSI de 60 es 1 m y la clorofila de 30.6 es 1 µg/L
  cerca(M.secchiDeTSI(60), 1, 1e-12);
  cerca(M.clorofilaDeTSI(30.6), 1, 1e-12);
  cerca(M.tsiSecchi(M.secchiDeTSI(47)), 47, 1e-9);
  cerca(M.zonaFotica(M.atenuacionDeSecchi(3.4)), Math.log(100) * 2, 1e-12);
  assert.equal(M.claseTrofica(43), 'mesotrófico');
});

test('Periódica: temperatura de la superficie en el año', () => {
  cerca(M.temperaturaSuperficie(13.2, 1.3, 30, 30), 14.5, 1e-12);
  cerca(M.temperaturaSuperficie(13.2, 1.3, 30 + 182.5, 30), 11.9, 1e-12);
  // Perfil logístico: en la termoclina la temperatura es el promedio
  cerca(M.perfilTemperatura(12, 14, 11, 12, 1.5), 12.5, 1e-12);
});

test('Balance: desagüe, residencia y embalse de la cuenca', () => {
  cerca(M.desague(0.141, 1.7, 15), 1.7 * 15 * 0.141 ** 1.5, 1e-12);
  assert.equal(M.desague(-0.1, 1.7, 15), 0);
  cerca(M.tiempoResidencia(1.8e9, 2) / M.SEG_ANO, 1.8e9 / 2 / 31536000, 1e-9);
  cerca(M.pasoCuenca(100, 1, 45, 1e6), 45, 1e-9);   // equilibrio R·k
});
