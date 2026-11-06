/**
 * modelo.js — Núcleo matemático del simulador de ciénagas costeras
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM). Unidades del SI internamente: caudal [m³/s], longitudes
 * [m], áreas [m²], volúmenes [m³], tiempo [s]; salinidad en PSU (g de sal por kg de agua).
 *
 * La ciénaga de referencia es la Ciénaga Grande de Santa Marta: una laguna costera somera
 * separada del mar Caribe por una barra de arena, que recibe los ríos de la Sierra Nevada y
 * el agua del río Magdalena por caños, y se comunica con el mar por una boca. Objetos:
 *   1. Decimales   → mezcla de aguas como promedio ponderado S = Σ(Qᵢ·Sᵢ)/ΣQᵢ.
 *   2. Lineales    → área del espejo A(h) = A_c + s·h, estrés del manglar por tramos,
 *                    depósito de sedimento, nivel con caudales fijos.
 *   3. Cuadráticas → volumen V(h) = A_c·h + s·h²/2 y su despeje; ley de Stokes.
 *   4. Raíces      → caudal por un caño o por la boca Q = C·A·√(2g·Δh).
 *   5. Racionales  → salinidad de equilibrio S = S_mar·Q_m/(Q_m + Q_d − E·A) (con asíntota),
 *                    tiempo de residencia τ = V/Q, fósforo de Vollenweider.
 *   6. Exponenciales → la salinidad se acerca al equilibrio S(t) = S_eq + (S₀ − S_eq)·e^(−t/τ).
 *   7. Periódicas  → marea como suma de cosenos (K1, O1, M2, S2), creciente del Magdalena como
 *                    serie de Fourier, oxígeno del día.
 *   8. Por tramos  → estrés del manglar por especie e índice de pesca.
 */

export const G = 9.81;
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;

// ═══════════════════════════════════════════════════════════════════════════
// 1. DECIMALES: MEZCLA DE AGUAS
// ═══════════════════════════════════════════════════════════════════════════
/** Promedio ponderado por los caudales: C = Σ(Qᵢ·Cᵢ)/ΣQᵢ. */
export function mezcla(pares) {
  let q = 0, qc = 0;
  for (const [Q, C] of pares) { q += Q; qc += Q * C; }
  return q > 0 ? qc / q : 0;
}
export const mmDiaAm3s = (mmDia, area) => (mmDia / 1000) * area / SEG_DIA;

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA CUBETA SOMERA (lineal y cuadrática)
// ═══════════════════════════════════════════════════════════════════════════
/** Área del espejo: crece en línea recta con la profundidad (el agua se extiende sobre el manglar). */
export const areaCienaga = (h, Ac, s) => Ac + s * Math.max(0, h);
/** Volumen: integral del área, V(h) = A_c·h + s·h²/2. */
export const volumenCienaga = (h, Ac, s) => Ac * Math.max(0, h) + (s * Math.max(0, h) ** 2) / 2;
/** Despeje de la cuadrática (s/2)h² + A_c·h − V = 0: h = (−A_c + √(A_c² + 2sV))/s. */
export const profundidadDeVolumen = (V, Ac, s) => (s > 0 ? (-Ac + Math.sqrt(Ac * Ac + 2 * s * Math.max(0, V))) / s : V / Ac);
export const tiempoResidencia = (V, Q) => (Q > 0 ? V / Q : Infinity);

// ═══════════════════════════════════════════════════════════════════════════
// 3. CAÑOS Y BOCA (raíz cuadrada)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Caudal por una abertura con desnivel Δh (positivo hacia la ciénaga):
 * Q = C·A·√(2g·|Δh|)·signo(Δh). Cerca de Δh = 0 se suaviza con δ para que el cálculo con el
 * reloj sea estable: Q = C·A·√(2g)·Δh/√(|Δh| + δ).
 */
export const caudalAbertura = (C, A, dh, delta = 0) => (A <= 0 ? 0 : (C * A * Math.sqrt(2 * G) * dh) / Math.sqrt(Math.abs(dh) + delta));
/** Velocidad en la abertura v = C·√(2g·Δh). */
export const velocidadAbertura = (C, dh) => C * Math.sqrt(2 * G * Math.abs(dh));

// ═══════════════════════════════════════════════════════════════════════════
// 4. MAREA Y CRECIENTE DEL MAGDALENA (periódicas)
// ═══════════════════════════════════════════════════════════════════════════
/** Componentes armónicas de la marea: período [h]. */
export const COMPONENTES = { K1: 23.934, O1: 25.819, M2: 12.421, S2: 12.0 };
/** Marea: η(t) = Σ aᵢ·cos(2π·t/Tᵢ − φᵢ), t en horas. */
export function marea(t, amps, fases = {}) {
  let eta = 0;
  for (const [k, T] of Object.entries(COMPONENTES)) eta += (amps[k] ?? 0) * Math.cos((2 * Math.PI * t) / T - (fases[k] ?? 0));
  return eta;
}
/** Número de forma de la marea F = (K1 + O1)/(M2 + S2): > 3 diurna, < 0.25 semidiurna. */
export const numeroForma = (a) => ((a.K1 ?? 0) + (a.O1 ?? 0)) / Math.max(1e-9, (a.M2 ?? 0) + (a.S2 ?? 0));
export function tipoMarea(F) {
  if (F < 0.25) return 'semidiurna';
  if (F < 1.5) return 'mixta, principalmente semidiurna';
  if (F < 3) return 'mixta, principalmente diurna';
  return 'diurna';
}
/**
 * Nivel del Magdalena frente a los caños como serie de Fourier de dos términos:
 * H(d) = H̄ + A₁·cos(2π(d − d₁)/365) + A₂·cos(4π(d − d₂)/365).
 */
export const nivelRio = (d, H, A1, d1, A2, d2) => H + A1 * Math.cos((2 * Math.PI * (d - d1)) / 365) + A2 * Math.cos((4 * Math.PI * (d - d2)) / 365);

// ═══════════════════════════════════════════════════════════════════════════
// 5. SALINIDAD (racional y exponencial)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Salinidad de equilibrio de la caja: entra agua de mar Q_m con S_mar, entra agua dulce Q_d y
 * se evapora E·A (se va el agua, no la sal). Lo que sale es Q_m + Q_d − E·A con la salinidad
 * de la ciénaga, así que S = S_mar·Q_m/(Q_m + Q_d − E·A). Si la evaporación iguala lo que
 * entra, el denominador se anula: asíntota vertical (la ciénaga se vuelve hipersalina).
 */
export function salinidadEquilibrio(Smar, Qm, Qd, EA) {
  const sale = Qm + Qd - EA;
  return sale > 0 ? (Smar * Qm) / sale : Infinity;
}
/** Acercamiento exponencial al equilibrio: S(t) = S_eq + (S₀ − S_eq)·e^(−t/τ). */
export const salinidadTiempo = (S0, Seq, tau, t) => Seq + (S0 - Seq) * Math.exp(-t / tau);

// ═══════════════════════════════════════════════════════════════════════════
// 6. MANGLAR Y PESCA (por tramos)
// ═══════════════════════════════════════════════════════════════════════════
/** Especies de manglar: salinidad del suelo a la que empiezan a sufrir y a la que mueren. */
export const ESPECIES = {
  rojo: { nombre: 'Mangle rojo (Rhizophora mangle)', Sopt: 40, Smax: 65, peso: 0.4 },
  blanco: { nombre: 'Mangle blanco (Laguncularia racemosa)', Sopt: 50, Smax: 80, peso: 0.2 },
  negro: { nombre: 'Mangle negro (Avicennia germinans)', Sopt: 60, Smax: 95, peso: 0.4 },
};
/** Estrés por tramos: 0 hasta S_opt, sube en línea recta hasta 1 en S_máx. */
export const estres = (S, Sopt, Smax) => Math.min(1, Math.max(0, (S - Sopt) / (Smax - Sopt)));
/** Salud del manglar: 1 − Σ pesoᵢ·estrésᵢ. */
export const saludManglar = (Ssuelo) => 1 - Object.values(ESPECIES).reduce((a, e) => a + e.peso * estres(Ssuelo, e.Sopt, e.Smax), 0);
/** La sal del suelo del manglar se concentra por la evaporación: S_suelo = 1.25·S + 5. */
export const salinidadSuelo = (S) => 1.25 * S + 5;
/**
 * Índice de pesca por tramos según la salinidad: crece de 0.5 (agua dulce) a 1 entre 5 y
 * 25 PSU (estuario productivo), baja a 0 entre 25 y 60 PSU; se multiplica por el oxígeno.
 */
export function indicePesca(S, ODmin) {
  let f;
  if (S < 5) f = 0.5 + 0.1 * S;
  else if (S <= 25) f = 1;
  else f = Math.max(0, 1 - (S - 25) / 35);
  const o = Math.min(1, Math.max(0, (ODmin - 1) / 3));
  return f * o;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. NUTRIENTES, ALGAS Y OXÍGENO
// ═══════════════════════════════════════════════════════════════════════════
export const fosforoCienaga = (Pin, tau) => Pin / (1 + Math.sqrt(Math.max(0, tau)));
export const clorofila = (P) => (P > 0 ? 10 ** (1.449 * Math.log10(P) - 1.136) : 0);
export function odSaturacion(T, S = 0) {
  const Tk = T + 273.15;
  const lnC = -139.34411 + 1.575701e5 / Tk - 6.642308e7 / Tk ** 2 + 1.2438e10 / Tk ** 3 - 8.621949e11 / Tk ** 4;
  return Math.exp(lnC) * (1 - 0.0051 * S);
}
/** Oxígeno a la hora h: ŌD − A·cos(2π(h − 5)/24). */
export const oxigenoHora = (ODm, A, hora) => ODm - A * Math.cos((2 * Math.PI * (hora - 5)) / 24);

// ═══════════════════════════════════════════════════════════════════════════
// 8. SEDIMENTOS (cuadrática y lineal)
// ═══════════════════════════════════════════════════════════════════════════
export const constanteStokes = (T = 28, rhoS = 2650, rho = 1000) => (G * (rhoS - rho)) / (18 * 2.414e-5 * 10 ** (247.8 / (T + 273.15 - 140)));
export const velocidadCaida = (d, T) => constanteStokes(T) * d * d;
export const fraccionRetenida = (vs, A, Q) => (Q > 0 ? Math.min(1, (vs * A) / Q) : 1);
/** Espesor depositado al año [mm/año] = masa·TE/(ρ_b·A). */
export const tasaDeposito = (Mt, TE, rhoB, A) => (1000 * Mt * TE) / (rhoB * A);
