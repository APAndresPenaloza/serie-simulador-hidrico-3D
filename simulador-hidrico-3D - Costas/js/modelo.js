/**
 * modelo.js — Núcleo matemático del simulador de costas (playas)
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM). Unidades del SI internamente: longitudes [m], tiempo [s],
 * caudales [m³/s]; coliformes en NMP/100 mL.
 *
 * La playa de referencia es una playa de bahía del Caribe colombiano (como El Rodadero, en
 * Santa Marta): arena entre dos cabos rocosos, mar de fondo de los alisios, brisa de la tarde,
 * marea pequeña y un emisario submarino mar afuera. Objetos:
 *   1. Decimales   → período del mar combinado como promedio ponderado por la energía.
 *   2. Lineales    → criterio de rotura H = γ·h; marea de tormenta por la presión; cambio del
 *                    ancho de playa con el balance de arena; ancho en el tiempo.
 *   3. Cuadráticas → longitud de onda en aguas profundas L₀ = g·T²/(2π); profundidad de cierre de
 *                    Hallermeier; sobreelevación por el viento ∝ U².
 *   4. Raíces      → altura combinada H = √(H₁² + H₂²); corriente litoral V ∝ √(g·H_b); remonte de
 *                    Stockdon ∝ √(H₀·L₀); velocidad de caída de la arena (Ferguson y Church).
 *   5. Potencias   → perfil de equilibrio de Dean h = A·x^(2/3) y su inversa; A = 0.067·w^0.44;
 *                    dilución del emisario ∝ z^(5/3)/Q^(2/3); transporte litoral CERC ∝ H_b^(5/2).
 *   6. Racionales  → regla de Bruun R = S·x_c/(B + h_c); años hasta el ancho mínimo.
 *   7. Hiperbólicas (exponenciales) → crecimiento del oleaje con el fetch (tanh) y dispersión de
 *                    las olas L = L₀·tanh((ω²h/g)^(3/4))^(2/3).
 *   8. Exponenciales y logarítmicas → muerte de las bacterias C = C₀·10^(−t/T90).
 *   9. Trigonométricas → refracción de Snell sin θ/C = constante; transporte ∝ sin(2θ).
 *  10. Periódicas  → marea (K1, O1, M2, S2), brisa del día y temporada de los alisios.
 */

export const G = 9.81;
export const RHO = 1025;
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;
export const rad = (g) => (g * Math.PI) / 180;
export const grados = (r) => (r * 180) / Math.PI;

// ═══════════════════════════════════════════════════════════════════════════
// 1. EL OLEAJE EN AGUAS PROFUNDAS
// ═══════════════════════════════════════════════════════════════════════════
/** Longitud de onda en aguas profundas L₀ = g·T²/(2π) y su celeridad C₀ = L₀/T. */
export const longitudProfunda = (T) => (G * T * T) / (2 * Math.PI);
/**
 * Oleaje que levanta un viento U sobre un fetch F (método SMB del Shore Protection Manual):
 * g·H/U² = 0.283·tanh[0.0125·(g·F/U²)^0.42]  y  g·T/U = 7.54·tanh[0.077·(g·F/U²)^0.25].
 */
export function oleajeViento(U, F) {
  if (U <= 0.1) return { H: 0, T: 0 };
  const x = (G * F) / (U * U);
  return { H: (0.283 * U * U * Math.tanh(0.0125 * x ** 0.42)) / G, T: (7.54 * U * Math.tanh(0.077 * x ** 0.25)) / G };
}
/** Mar combinado: H = √(H₁² + H₂²); T promedio ponderado por la energía (∝ H²). */
export function combinar(H1, T1, H2, T2) {
  const H = Math.sqrt(H1 * H1 + H2 * H2);
  return { H, T: H > 0 ? (H1 * H1 * T1 + H2 * H2 * T2) / (H * H) : T1 };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. LAS OLAS LLEGAN A LA COSTA: DISPERSIÓN, ASOMERAMIENTO, REFRACCIÓN, ROTURA
// ═══════════════════════════════════════════════════════════════════════════
/** Longitud de onda a la profundidad h (aproximación explícita de Fenton y McKee, 1990). */
export function longitudOnda(T, h) {
  const L0 = longitudProfunda(T);
  const k0h = (4 * Math.PI * Math.PI * h) / (G * T * T);
  return L0 * Math.tanh(k0h ** 0.75) ** (2 / 3);
}
/** Celeridad C = L/T y celeridad de grupo C_g = n·C, con n = ½·(1 + 2kh/sinh 2kh). */
export function celeridades(T, h) {
  const L = longitudOnda(T, h);
  const k = (2 * Math.PI) / L;
  const C = L / T;
  const kh2 = 2 * k * h;
  const n = kh2 > 50 ? 0.5 : 0.5 * (1 + kh2 / Math.sinh(kh2));
  return { L, C, Cg: n * C, n };
}
/** Altura y ángulo de la ola a la profundidad h: Snell y coeficientes de asomeramiento y refracción. */
export function transformar(H0, T, theta0Grados, h) {
  const L0 = longitudProfunda(T);
  const C0 = L0 / T;
  const { C, Cg } = celeridades(T, h);
  const s = (Math.sin(rad(theta0Grados)) * C) / C0;
  const th = Math.asin(Math.max(-1, Math.min(1, s)));
  const Ks = Math.sqrt((0.5 * C0) / Cg);
  const Kr = Math.sqrt(Math.cos(rad(theta0Grados)) / Math.cos(th));
  return { H: H0 * Ks * Kr, theta: grados(th), Ks, Kr, C, Cg };
}
/** Punto de rotura: la profundidad donde H(h) = γ·h (bisección). */
export function rotura(H0, T, theta0Grados, gamma = 0.78) {
  if (H0 <= 0) return { hb: 0, Hb: 0, thetab: 0 };
  let a = 0.02, b = Math.max(2, 4 * H0 + 2);
  const f = (h) => transformar(H0, T, theta0Grados, h).H - gamma * h;
  for (let k = 0; k < 60; k++) {
    const m = (a + b) / 2;
    if (f(m) > 0) a = m; else b = m;
  }
  const hb = (a + b) / 2;
  const t = transformar(H0, T, theta0Grados, hb);
  return { hb, Hb: t.H, thetab: t.theta };
}
/** Corriente a lo largo de la playa (Longuet-Higgins): V = 1.17·√(g·H_b)·sin θ_b·cos θ_b. */
export const corrienteLitoral = (Hb, thetabGrados) => 1.17 * Math.sqrt(G * Hb) * Math.sin(rad(thetabGrados)) * Math.cos(rad(thetabGrados));
/** Transporte litoral CERC [m³/s de arena depositada], con K = 0.39, γ = 0.78, s = 2.65, p = 0.4. */
export const transporteLitoral = (Hb, thetabGrados) => (0.39 * Math.sqrt(G / 0.78) * Hb ** 2.5 * Math.sin(2 * rad(thetabGrados))) / (16 * 1.65 * 0.6);

// ═══════════════════════════════════════════════════════════════════════════
// 3. EL NIVEL DEL MAR EN LA PLAYA
// ═══════════════════════════════════════════════════════════════════════════
export const COMPONENTES = { K1: 23.934, O1: 25.819, M2: 12.421, S2: 12.0 };
/** Marea η(t) = Σ aᵢ·cos(2π·t/Tᵢ − φᵢ), t en horas. */
export function marea(t, amps, fases = {}) {
  let eta = 0;
  for (const [k, T] of Object.entries(COMPONENTES)) eta += (amps[k] ?? 0) * Math.cos((2 * Math.PI * t) / T - (fases[k] ?? 0));
  return eta;
}
/** Sobreelevación por la presión (barómetro invertido): 1 cm por cada hPa bajo 1 013 hPa. */
export const sobreelevacionPresion = (p) => 0.01 * (1013 - p);
/** Sobreelevación por el viento sobre la plataforma: Δη = ρ_a·C_D·U²·L/(ρ·g·h). */
export const sobreelevacionViento = (U, Lplat, hPlat) => (1.2 * 0.0012 * U * U * Lplat) / (RHO * G * hPlat);
/** Remonte del 2 % (Stockdon y otros, 2006): R2 = 1.1·[0.35·β·√(H₀L₀) + √(H₀L₀·(0.563β² + 0.004))/2]. */
export function remonte(H0, T, beta) {
  const HL = H0 * longitudProfunda(T);
  return 1.1 * (0.35 * beta * Math.sqrt(HL) + Math.sqrt(HL * (0.563 * beta * beta + 0.004)) / 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. EL PERFIL DE LA PLAYA
// ═══════════════════════════════════════════════════════════════════════════
/** Velocidad de caída de un grano (Ferguson y Church, 2004): w = R·g·D²/(C₁ν + √(0.75·C₂·R·g·D³)). */
export function velocidadCaida(D, { R = 1.65, nu = 1e-6, C1 = 18, C2 = 1 } = {}) {
  return (R * G * D * D) / (C1 * nu + Math.sqrt(0.75 * C2 * R * G * D * D * D));
}
/** Parámetro del perfil de Dean A = 0.067·w^0.44 (w en cm/s, A en m^(1/3)). */
export const parametroDean = (wCms) => 0.067 * wCms ** 0.44;
/** Perfil de equilibrio h(x) = A·x^(2/3). */
export const perfilDean = (x, A) => A * Math.max(0, x) ** (2 / 3);
/** Distancia desde la orilla hasta la profundidad h: x = (h/A)^(3/2). */
export const distanciaDean = (h, A) => (Math.max(0, h) / A) ** 1.5;
/** Profundidad de cierre de Hallermeier: h_c = 2.28·H_e − 68.5·H_e²/(g·T_e²). */
export const profundidadCierre = (He, Te) => 2.28 * He - (68.5 * He * He) / (G * Te * Te);

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA LÍNEA DE COSTA
// ═══════════════════════════════════════════════════════════════════════════
/** Cambio del ancho de playa [m/s] con el balance de arena: (Q_entra − Q_sale)/(L·(B + h_c)). */
export const cambioAncho = (Qentra, Qsale, L, B, hc) => (Qentra - Qsale) / (L * (B + hc));
/** Regla de Bruun: retroceso R = S·x_c/(B + h_c). */
export const bruun = (S, xc, B, hc) => (S * xc) / (B + hc);
/** Años hasta que el ancho W llegue a W_min con una tasa v [m/año] (negativa si se erosiona). */
export const anosHastaMinimo = (W, Wmin, v) => (v < 0 ? Math.max(0, (W - Wmin) / -v) : Infinity);

// ═══════════════════════════════════════════════════════════════════════════
// 6. EL AGUA DE BAÑO
// ═══════════════════════════════════════════════════════════════════════════
/** Dilución inicial de una pluma redonda boyante: S = 0.089·g'^(1/3)·z^(5/3)/Q^(2/3). */
export const dilucionInicial = (gp, z, Q) => (0.089 * gp ** (1 / 3) * z ** (5 / 3)) / Q ** (2 / 3);
/** Muerte de las bacterias: C = C₀·10^(−t/T90). */
export const decaimiento = (C0, t, T90) => C0 * 10 ** (-t / T90);
/** Horas que tarda en morir el 90 % según la luz: de día T90 corto, de noche largo. */
export function t90Hora(hora, T90dia, T90noche) {
  const luz = Math.max(0, Math.sin((Math.PI * (hora - 6)) / 12));
  return T90noche - (T90noche - T90dia) * luz;
}
