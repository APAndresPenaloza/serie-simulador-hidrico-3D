/**
 * modelo.js — Núcleo matemático del simulador de lagos andinos profundos
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM ni gráficos). Unidades del SI internamente: caudal [m³/s],
 * longitudes [m], áreas [m²], volúmenes [m³], tiempo [s]; la lluvia y la evaporación en mm.
 *
 * El lago de referencia es un lago andino profundo de alta montaña (inspirado en el lago de
 * Tota, Boyacá, a 3 015 m.s.n.m.). Objetos matemáticos:
 *   1. Decimales   → hm³, km², desarrollo de la orilla D_L = P/(2√(πA)).
 *   2. Lineales    → balance del nivel dh/dt = Q/A, oxígeno del hipolimnion OD(t) = OD₀ − r·t,
 *                    carga de fósforo como suma de fuentes, levantamiento del agua por el viento.
 *   3. Cuadráticas → densidad del agua ρ(T) = 1000 − 0.0068·(T − 4)² (vértice en 4 °C),
 *                    esfuerzo del viento τ = ρ_a·C_D·U².
 *   4. Raíces      → seiche de Merian T = 2L/√(g·z̄) y seiche interna T_i = 2L/√(g'·h_e·h_h/(h_e + h_h)).
 *   5. Exponenciales y logarítmicas → perfil logístico de la temperatura, luz e^(−k·z), índice de
 *                    Carlson y sus equivalencias.
 *   6. Potencia y racionales → hipsometría A(z) = A₀·(1 − z/z_máx)^m, fósforo de Vollenweider
 *                    P = P_in/(1 + √τ), tiempo de residencia τ = V/Q, número de Wedderburn.
 *   7. Periódicas  → temperatura de la superficie en el año y oscilación de las seiches.
 */

export const G = 9.81;
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;
export const CD = 1.3e-3;         // coeficiente de arrastre del viento sobre el agua

// ═══════════════════════════════════════════════════════════════════════════
// 1. DECIMALES Y MORFOMETRÍA (potencia)
// ═══════════════════════════════════════════════════════════════════════════
export const km2Am2 = (a) => a * 1e6;
export const m3Ahm3 = (v) => v / 1e6;
export const mmDiaAm3s = (mmDia, area) => (mmDia / 1000) * area / SEG_DIA;

/** Hipsometría: área del lago a la profundidad z [m²]: A(z) = A₀·(1 − z/z_máx)^m. */
export const areaProfundidad = (z, A0, zmax, m) => (z >= zmax ? 0 : A0 * Math.max(0, 1 - z / zmax) ** m);
/** Volumen del lago: integral de A(z) de 0 a z_máx = A₀·z_máx/(m + 1). */
export const volumenLago = (A0, zmax, m) => (A0 * zmax) / (m + 1);
/** Volumen de agua por debajo de la profundidad z: A₀·z_máx·(1 − z/z_máx)^(m+1)/(m + 1). */
export const volumenBajo = (z, A0, zmax, m) => (A0 * zmax * Math.max(0, 1 - z / zmax) ** (m + 1)) / (m + 1);
/** Profundidad media z̄ = V/A₀ = z_máx/(m + 1). */
export const profundidadMedia = (zmax, m) => zmax / (m + 1);
/** Desarrollo del volumen V_d = 3·z̄/z_máx (1 = cono, 1.5 = paraboloide, 3 = cilindro). */
export const desarrolloVolumen = (zmed, zmax) => (3 * zmed) / zmax;
/** Desarrollo de la orilla D_L = P/(2√(πA)) (1 = círculo). */
export const desarrolloOrilla = (P, A) => P / (2 * Math.sqrt(Math.PI * A));

// ═══════════════════════════════════════════════════════════════════════════
// 2. BALANCE DE AGUA (lineal y potencia)
// ═══════════════════════════════════════════════════════════════════════════
export const temperaturaAltitud = (z, Tmar, gradiente) => Tmar - gradiente * z;
export const hargreaves = (T, dT, RaMJ) => Math.max(0, 0.0023 * (T + 17.8) * Math.sqrt(Math.max(0, dT)) * RaMJ * 0.408);
export function radiacionExtraterrestre(latitudGrados, diaAno) {
  const phi = (latitudGrados * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * diaAno) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * diaAno) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}
/** Desagüe natural del lago: vertedero Q = C·b·η^1.5, η = nivel sobre el umbral [m]. */
export const desague = (eta, C, b) => (eta > 0 ? C * b * eta ** 1.5 : 0);
/** Cambio del nivel: dh/dt = Q_neto/A [m/s]. */
export const pendienteNivel = (Qneto, A) => Qneto / A;
/** Tiempo de residencia τ = V/Q [s]. */
export const tiempoResidencia = (V, Q) => (Q > 0 ? V / Q : Infinity);
/** Embalse lineal de la cuenca: Q = S/k; paso exacto con lluvia constante. */
export const pasoCuenca = (S0, R, k, tDias) => R * k + (S0 - R * k) * Math.exp(-tDias / k);

// ═══════════════════════════════════════════════════════════════════════════
// 3. TEMPERATURA Y DENSIDAD (periódica, logística y cuadrática)
// ═══════════════════════════════════════════════════════════════════════════
/** Temperatura de la superficie en el día d del año: T̄ + A·cos(2π(d − d_máx)/365). */
export const temperaturaSuperficie = (Tmedia, amplitud, d, dMax) => Tmedia + amplitud * Math.cos((2 * Math.PI * (d - dMax)) / 365);
/** Perfil logístico: T(z) = T_h + (T_e − T_h)/(1 + e^((z − z_t)/δ)). */
export const perfilTemperatura = (z, Te, Th, zt, delta) => Th + (Te - Th) / (1 + Math.exp((z - zt) / delta));
/** Densidad del agua dulce (parábola con vértice en 4 °C): ρ = 1000 − 0.0068·(T − 4)² [kg/m³]. */
export const densidad = (T) => 1000 - 0.0068 * (T - 4) ** 2;
/** Gravedad reducida g' = g·Δρ/ρ [m/s²]. */
export const gravedadReducida = (Te, Th) => (G * Math.max(0, densidad(Th) - densidad(Te))) / densidad(Th);
/** Frecuencia de flotabilidad N = √(g'/δ) [1/s] en la termoclina de espesor δ. */
export const frecuenciaFlotabilidad = (gp, espesor) => Math.sqrt(Math.max(0, gp) / espesor);

// ═══════════════════════════════════════════════════════════════════════════
// 4. VIENTO, WEDDERBURN Y SEICHES (cuadrática, racional y raíces)
// ═══════════════════════════════════════════════════════════════════════════
/** Densidad del aire con la altitud [kg/m³]. */
export const densidadAire = (z) => 1.225 * (1 - 2.25577e-5 * z) ** 4.25588;
/** Esfuerzo del viento sobre el agua τ = ρ_a·C_D·U² [N/m²] (parábola en U). */
export const esfuerzoViento = (U, rhoA) => rhoA * CD * U * U;
/** Velocidad de fricción en el agua u* = √(τ/ρ) [m/s]. */
export const velocidadFriccion = (tau, rho = 1000) => Math.sqrt(tau / rho);
/** Número de Wedderburn W = g'·h_e²/(u*²·L): si W < 1 el viento inclina la termoclina hasta la superficie. */
export const wedderburn = (gp, he, us, L) => (us > 0 ? (gp * he * he) / (us * us * L) : Infinity);
/** Levantamiento de la superficie por el viento Δη = τ·L/(ρ·g·z̄) [m]. */
export const levantamientoSuperficie = (tau, L, zmed, rho = 1000) => (tau * L) / (rho * G * zmed);
/** Inclinación de la termoclina Δh = τ·L/(ρ·g'·h_e) [m]. */
export const inclinacionTermoclina = (tau, L, gp, he, rho = 1000) => (gp > 0 ? (tau * L) / (rho * gp * he) : Infinity);
/** Seiche superficial (Merian): T = 2L/√(g·z̄) [s]. */
export const seicheSuperficial = (L, zmed) => (2 * L) / Math.sqrt(G * zmed);
/** Seiche interna de dos capas: T_i = 2L/√(g'·h_e·h_h/(h_e + h_h)) [s]. */
export const seicheInterna = (L, gp, he, hh) => (gp > 0 ? (2 * L) / Math.sqrt((gp * he * hh) / (he + hh)) : Infinity);
/** Oscilación de la seiche: η(t) = a·cos(2πt/T). */
export const oscilacion = (a, T, t) => a * Math.cos((2 * Math.PI * t) / T);

// ═══════════════════════════════════════════════════════════════════════════
// 5. OXÍGENO (lineal)
// ═══════════════════════════════════════════════════════════════════════════
export const presionRelativa = (z) => (1 - 2.25577e-5 * z) ** 5.25588;
/** Oxígeno de saturación (APHA) corregido por la presión de la altitud [mg/L]. */
export function odSaturacion(T, z = 0) {
  const Tk = T + 273.15;
  const lnC = -139.34411 + 1.575701e5 / Tk - 6.642308e7 / Tk ** 2 + 1.2438e10 / Tk ** 3 - 8.621949e11 / Tk ** 4;
  return Math.exp(lnC) * presionRelativa(z);
}
/** Consumo del oxígeno del hipolimnion: OD(t) = OD₀ − (AHOD/h_h)·t (AHOD en g/m²·día, t en días). */
export const oxigenoHipolimnion = (OD0, AHOD, hh, tDias) => Math.max(0, OD0 - (AHOD / hh) * tDias);
/** Días hasta que el hipolimnion baja a OD_lím: t = (OD₀ − OD_lím)·h_h/AHOD. */
export const diasHastaOxigeno = (OD0, ODlim, AHOD, hh) => (AHOD > 0 ? Math.max(0, OD0 - ODlim) * hh / AHOD : Infinity);

// ═══════════════════════════════════════════════════════════════════════════
// 6. NUTRIENTES Y ESTADO TRÓFICO (racional, potencia, logaritmo y exponencial)
// ═══════════════════════════════════════════════════════════════════════════
/** Concentración de entrada P_in = carga [kg/año]·10⁶/volumen [m³/año] [µg/L]. */
export const fosforoEntrada = (cargaKg, volumenAno) => (volumenAno > 0 ? (cargaKg * 1e6) / volumenAno : 0);
/** Vollenweider (1976): P = P_in/(1 + √τ), τ en años. */
export const fosforoLago = (Pin, tau) => Pin / (1 + Math.sqrt(Math.max(0, tau)));
/** Carga admisible para no pasar de P_c: L_c = P_c·Q_anual·(1 + √τ)/10⁶ [kg/año]. */
export const cargaAdmisible = (Pc, volumenAno, tau) => (Pc * volumenAno * (1 + Math.sqrt(Math.max(0, tau)))) / 1e6;
/** Índices de Carlson (1977) y sus equivalencias: el mismo TSI da la clorofila y el Secchi esperados. */
export const tsiFosforo = (P) => 14.42 * Math.log(Math.max(P, 1e-6)) + 4.15;
export const clorofilaDeTSI = (tsi) => Math.exp((tsi - 30.6) / 9.81);
export const secchiDeTSI = (tsi) => Math.exp((60 - tsi) / 14.41);
export const tsiSecchi = (DS) => 60 - 14.41 * Math.log(DS);
export function claseTrofica(tsi) {
  if (tsi < 40) return 'oligotrófico';
  if (tsi < 50) return 'mesotrófico';
  if (tsi < 70) return 'eutrófico';
  return 'hipereutrófico';
}
/** Luz: I/I₀ = e^(−k·z) con k = 1.7/DS; zona fótica (1 %) z_eu = ln(100)/k. */
export const atenuacionDeSecchi = (DS) => 1.7 / DS;
export const fraccionLuz = (k, z) => Math.exp(-k * z);
export const zonaFotica = (k) => Math.log(100) / k;
/** Demanda de oxígeno del hipolimnion según la clorofila (referencia) [g O₂/m²·día]. */
export const demandaHipolimnion = (Chl) => 0.15 + 0.05 * Chl;
