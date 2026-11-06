// Pruebas del modelo de la laguna con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Decimales: láminas de agua, áreas y punto de ebullición', () => {
  // 1 mm/día sobre 86 400 m² = 86.4 m³/día = 0.001 m³/s
  cerca(M.mmDiaAm3s(1, 86400), 0.001, 1e-15);
  cerca(M.m3sAmmDia(0.001, 86400), 1, 1e-12);
  cerca(M.haAm2(12), 120000, 1e-9);
  // A 4 300 m el agua hierve a unos 100 − 4 300/300 = 85.67 °C
  cerca(M.puntoEbullicion(4300), 85.666667, 1e-5);
  // Presión estándar: a nivel del mar 101.325 kPa; a 4 300 m, 59.3 kPa
  cerca(M.presionAtm(0), 101.325, 1e-9);
  cerca(M.presionAtm(4300), 59.27, 0.01);
});

test('Lineal: temperatura con la altitud e isoterma de 0 °C', () => {
  // T(4 300) = 27.6 − 0.0055 × 4 300 = 3.95 °C
  cerca(M.temperaturaAltitud(4300, 27.6, 0.0055), 3.95, 1e-12);
  // Raíz de la recta: z = 27.6/0.0055 = 5 018.18 m
  cerca(M.altitudCeroGrados(27.6, 0.0055), 5018.181818, 1e-5);
  // La pendiente es −Γ: cada 1 000 m la temperatura baja 5.5 °C
  cerca(M.temperaturaAltitud(1000, 27.6, 0.0055) - M.temperaturaAltitud(2000, 27.6, 0.0055), 5.5, 1e-12);
});

test('Lineal: derretimiento por grado-día', () => {
  // M = 7 × (0.65 − 0) = 4.55 mm/día; bajo 0 °C no hay derretimiento
  cerca(M.derretimiento(0.65, 7), 4.55, 1e-12);
  assert.equal(M.derretimiento(-2, 7), 0);
  // 4.55 mm/día sobre 0.25 km² = 0.00455 × 250 000 / 86 400 = 0.013166 m³/s
  cerca(M.mmDiaAm3s(4.55, M.km2Am2(0.25)), 0.0131655, 1e-6);
});

test('Exponencial: retroceso del glaciar y años hasta el 1 %', () => {
  // A(25) = 0.25·e^(−0.04 × 25) = 0.25/e = 0.091970 km²
  cerca(M.areaGlaciar(0.25, 0.04, 25), 0.25 / Math.E, 1e-12);
  // t = ln(100)/0.04 = 115.13 años
  cerca(M.anosHastaFraccion(0.04, 0.01), Math.log(100) / 0.04, 1e-12);
});

test('Vértice: el pico del agua del glaciar t* = 1/λ − T₀/w', () => {
  const g = { T0: 0.15, w: 0.02, lambda: 0.04, A0: 250000, DDF: 7 };
  // t* = 1/0.04 − 0.15/0.02 = 25 − 7.5 = 17.5 años
  cerca(M.picoDeshielo(g), 17.5, 1e-12);
  const Q = (t) => M.deshieloFuturo(g, t);
  assert.ok(Q(17.5) > Q(17) && Q(17.5) > Q(18));
  // Con el frente del glaciar más caliente el pico ya pasó (t* < 0)
  assert.ok(M.picoDeshielo({ ...g, T0: 0.65 }) < 0);
});

test('Embalse lineal del páramo: solución exacta y recesión', () => {
  // Con lluvia constante R, S(t) = R·k + (S₀ − R·k)·e^(−t/k)
  const S0 = 144, R = 0.6, k = 60;
  let S = S0;
  const dt = 0.001;
  for (let t = 0; t < 90 - 1e-9; t += dt) S += (R - S / k) * dt;   // Euler fino
  cerca(M.pasoParamo(S0, R, k, 90), S, 0.01);
  // Sin lluvia el caudal baja a la mitad en k·ln 2 = 41.6 días
  cerca(M.diasRecesion(60, 0.5), 60 * Math.LN2, 1e-12);
  cerca(M.recesion(100, 60, 60 * Math.LN2), 50, 1e-9);
});

test('Cuadrática: la cubeta en paraboloide', () => {
  const Au = 120000, hu = 6;
  // V(6) = 120 000 × 36/12 = 360 000 m³; A(3) = 60 000 m²
  cerca(M.volumenLaguna(6, Au, hu), 360000, 1e-6);
  cerca(M.areaEspejo(3, Au, hu), 60000, 1e-9);
  // La derivada del volumen es el área: dV/dh = A_u·h/h_u
  const h = 4.2, e = 1e-5;
  cerca((M.volumenLaguna(h + e, Au, hu) - M.volumenLaguna(h - e, Au, hu)) / (2 * e), M.areaEspejo(h, Au, hu), 1e-3);
  // Despeje de la cuadrática y profundidad media h/2
  cerca(M.nivelDeVolumen(M.volumenLaguna(5.3, Au, hu), Au, hu), 5.3, 1e-12);
  cerca(M.volumenLaguna(5, Au, hu) / M.areaEspejo(5, Au, hu), M.profundidadMedia(5), 1e-12);
});

test('Potencia: vertedero de rebose y su despeje', () => {
  // Q = 1.7 × 3 × 0.1^1.5 = 0.161276 m³/s
  cerca(M.vertedero(6.1, 6, 1.7, 3), 1.7 * 3 * 0.1 ** 1.5, 1e-12);
  assert.equal(M.vertedero(5.9, 6, 1.7, 3), 0);
  cerca(M.laminaVertedero(M.vertedero(6.08, 6, 1.7, 3), 1.7, 3), 0.08, 1e-12);
  // Días entre dos niveles con caudal constante: (V₂ − V₁)/Q
  const t = M.diasEntreNiveles(6, 4, -0.01, 120000, 6);
  cerca(t, (360000 - 160000) / 0.01 / 86400, 1e-9);
});

test('Cuadrática: longitud de onda y olas limitadas por el fetch', () => {
  // L = 9.81 × 1²/(2π) = 1.5613 m
  cerca(M.longitudOla(1), 9.81 / (2 * Math.PI), 1e-12);
  // El doble de período da cuatro veces la longitud
  cerca(M.longitudOla(2) / M.longitudOla(1), 4, 1e-12);
  // H = 0.0016 × 6 × √(393/9.81) = 0.06072 m
  cerca(M.alturaOla(6, 393), 0.0016 * 6 * Math.sqrt(393 / 9.81), 1e-12);
  // En el paraboloide la parte del fondo más llana que d es d/h
  cerca(M.fraccionFondoRemovido(0.6, 6), 0.1, 1e-12);
});

test('Racional y potencia: Vollenweider y Dillon-Rigler', () => {
  // P = 10/(1 + √0.25) = 6.667 µg/L
  cerca(M.fosforoLaguna(10, 0.25), 10 / 1.5, 1e-12);
  // 24.5 kg/año en 3.66 millones de m³ = 6.69 µg/L
  cerca(M.fosforoEntrada(24.5, 3.66e6), 6.6940, 1e-4);
  // Chl(10) = 10^(1.449 − 1.136) = 10^0.313 = 2.0559 µg/L
  cerca(M.clorofila(10), 10 ** 0.313, 1e-12);
});

test('Logarítmica: índice de Carlson y luz', () => {
  cerca(M.tsiSecchi(1), 60, 1e-12);
  cerca(M.tsiSecchi(2), 60 - 14.41 * Math.log(2), 1e-12);
  cerca(M.tsiClorofila(1), 30.6, 1e-12);
  assert.equal(M.claseTrofica(35), 'oligotrófica');
  assert.equal(M.claseTrofica(45), 'mesotrófica');
  assert.equal(M.claseTrofica(55), 'eutrófica');
  // Con k_d = 0.5 1/m: DS = 3.4 m, 1 % de la luz a 9.21 m, 10 % a 4.61 m
  cerca(M.secchi(0.5), 3.4, 1e-12);
  cerca(M.zonaFotica(0.5), Math.log(100) / 0.5, 1e-12);
  cerca(M.fraccionLuz(0.5, Math.log(10) / 0.5), 0.1, 1e-12);
});

test('Estados alternativos de Scheffer: uno, dos o uno estables', () => {
  const kw = 0.3, hv = 0.2, he = Math.log(5) / 3, p = 8;
  const estables = (E0) => M.equilibriosScheffer(E0, kw, hv, he, p).filter((e) => e.estable);
  // Pocos nutrientes: solo el estado claro
  assert.equal(estables(0.47).length, 1);
  assert.ok(estables(0.47)[0].V > 0.9);
  // Nutrientes intermedios: clara y turbia son estables (histéresis)
  const dos = estables(1.0);
  assert.equal(dos.length, 2);
  assert.ok(dos[0].V > 0.5 && dos[1].V < 0.1);
  // Muchos nutrientes: solo el estado turbio
  assert.equal(estables(1.5).length, 1);
  assert.ok(estables(1.5)[0].V < 0.1);
  // Cada equilibrio cumple V*(k_d(V)) = V
  for (const e of M.equilibriosScheffer(1.0, kw, hv, he, p)) cerca(M.plantasEquilibrio(M.turbidezConPlantas(e.V, 1.0, kw, hv), he, p), e.V, 1e-8);
});

test('Oxígeno: saturación con la temperatura y la altitud, ciclo del día', () => {
  cerca(M.odSaturacion(20), 9.09, 0.01);                      // tabla APHA
  cerca(M.odSaturacion(4, 4300) / M.odSaturacion(4, 0), M.presionRelativa(4300), 1e-12);
  // Mínimo a las 05:00 y máximo a las 17:00
  cerca(M.oxigenoHora(7, 0.5, 5), 6.5, 1e-12);
  cerca(M.oxigenoHora(7, 0.5, 17), 7.5, 1e-12);
});

test('Cuadrática: ley de Stokes y retención en la laguna', () => {
  const K = M.constanteStokes(20);
  cerca(K, (9.81 * 1650) / (18 * M.viscosidad(20)), 1e-6);
  cerca(M.velocidadCaida(1e-4, 20) / M.velocidadCaida(5e-5, 20), 4, 1e-12);   // doble diámetro, cuatro veces la velocidad
  // Carga superficial: se queda todo si v_s·A/Q ≥ 1
  assert.equal(M.fraccionRetenida(1e-3, 120000, 0.1), 1);
  cerca(M.fraccionRetenida(5e-7, 120000, 0.1), 0.6, 1e-12);
});

test('Vaciado súbito: Clague y Mathews, atenuación e hidrograma', () => {
  // Con 1 millón de m³: Q = 75 × 1^0.67 = 75 m³/s
  cerca(M.caudalVaciado(1e6), 75, 1e-12);
  cerca(M.atenuacion(30, 25, 25), 30 / Math.E, 1e-12);
  // El hidrograma tiene su pico Q_p en t_p y su volumen es Q_p·t_p·e
  const Qp = 30, tp = 1000;
  cerca(M.hidrogramaVaciado(Qp, tp, tp), Qp, 1e-12);
  let V = 0;
  for (let t = 0; t < 40 * tp; t += 1) V += M.hidrogramaVaciado(Qp, tp, t + 0.5);
  cerca(V, Qp * tp * Math.E, Qp * tp * Math.E * 1e-4);
  cerca(M.tiempoPicoVaciado(Qp * tp * Math.E, Qp), tp, 1e-9);
  // Capacidad del cauce del pueblo (Manning): b = 5, y = 1, z = 1.5, n = 0.045, S = 0.02
  cerca(M.capacidadCauce(5, 1, 1.5, 0.045, 0.02), 16.94, 0.01);
});
