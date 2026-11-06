/**
 * modelo.js — Núcleo matemático del simulador de deltas
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM). Unidades del SI internamente: caudal [m³/s], longitudes
 * [m], tiempo [s]; concentraciones en mg/L (= g/m³); salinidad en PSU.
 *
 * El delta de referencia es el del río Magdalena en Bocas de Ceniza (Barranquilla): el río
 * más caudaloso y con más sedimento del Caribe colombiano, encauzado entre tajamares, con el
 * Canal del Dique como brazo hacia la bahía de Cartagena. Objetos:
 *   1. Decimales     → reparto del caudal entre los brazos como fracciones.
 *   2. Lineales      → avance del frente del delta, ascenso relativo del mar, sobreelevación del
 *                      cauce (avulsión), volumen dragado.
 *   3. Cuadráticas   → área del lóbulo del delta A = π·r²/2; esfuerzo en el fondo τ = ρ·u*².
 *   4. Raíces        → número de Froude densimétrico Fr = U/√(g'·h).
 *   5. Potencias     → curva de sedimento C = C₀·(Q/Q̄)^(b−1); Manning A·R^(2/3)/n; altura de
 *                      rotura de Komar y Gaughan; transporte litoral CERC con H_b^(5/2).
 *   6. Racionales    → profundidad de régimen h = Q/(B·U_c); dominancia R = río/oleaje; años hasta
 *                      la avulsión y hasta que el mar alcance la llanura.
 *   7. Polinomio en Fr^(2/3) → longitud de la cuña salina (Schijf y Schönfeld).
 *   8. Exponenciales → la pluma se aclara mar adentro C(x) = C₀·e^(−x/L); relajación de la cuña y
 *                      del fondo del canal.
 *   9. Logarítmicas  → perfil de velocidad u(z) = (u* / κ)·ln(z/z₀); alcance de la pluma
 *                      x = L·ln(C₀/C_vis).
 *  10. Periódicas    → caudal del año como serie de Fourier de dos términos.
 *  11. Por tramos    → tipo de delta (río, oleaje o marea).
 */

export const G = 9.81;
export const RHO = 1000;
export const KAPPA = 0.41;
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;

// ═══════════════════════════════════════════════════════════════════════════
// 1. EL RÍO: CAUDAL Y SEDIMENTO (periódica y potencia)
// ═══════════════════════════════════════════════════════════════════════════
/** Caudal del día d: Q(d) = Q̄·[1 + A₁·cos(2π(d − d₁)/365) + A₂·cos(4π(d − d₂)/365)]. */
export const caudalRio = (d, Qm, A1, d1, A2, d2) =>
  Qm * (1 + A1 * Math.cos((2 * Math.PI * (d - d1)) / 365) + A2 * Math.cos((4 * Math.PI * (d - d2)) / 365));
/** Curva de sedimento: C = C₀·(Q/Q̄)^(b−1) [mg/L], así la carga Q·C crece como Q^b. */
export const concentracion = (Q, Qref, C0, b) => (Q > 0 ? C0 * (Q / Qref) ** (b - 1) : 0);
/** Carga de sedimento [kg/s] = Q [m³/s] × C [mg/L = g/m³] / 1000. */
export const carga = (Q, C) => (Q * C) / 1000;

// ═══════════════════════════════════════════════════════════════════════════
// 2. LOS BRAZOS DEL DELTA (potencia y decimales)
// ═══════════════════════════════════════════════════════════════════════════
/** Conductancia de Manning de un cauce rectangular: K = A·R^(2/3)/n, con R = A/P. */
export function conductancia(B, h, n) {
  const A = B * h, P = B + 2 * h;
  return (A * (A / P) ** (2 / 3)) / n;
}
/** Velocidad de Manning U = R^(2/3)·√S/n. */
export const velocidadManning = (B, h, n, S) => ((B * h / (B + 2 * h)) ** (2 / 3) * Math.sqrt(S)) / n;
/** Reparto del caudal entre brazos que comparten la caída: fracción ∝ K·√S (suman 1). */
export function reparto(brazos) {
  const k = brazos.map((b) => conductancia(b.B, b.h, b.n) * Math.sqrt(b.S) * (b.apertura ?? 1));
  const suma = k.reduce((a, x) => a + x, 0);
  return k.map((x) => (suma > 0 ? x / suma : 0));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. EL CANAL DE LA DESEMBOCADURA (racional, logarítmica, cuadrática, exponencial)
// ═══════════════════════════════════════════════════════════════════════════
/** Profundidad de régimen: el canal se ahonda o se llena hasta que U = Q/(B·h) = U_c. */
export const profundidadRegimen = (Q, B, Uc) => Q / (B * Uc);
/** Acercamiento exponencial a un equilibrio: x(t + Δt) = x_eq + (x − x_eq)·e^(−Δt/τ). */
export const relajar = (x, xeq, dt, tau) => xeq + (x - xeq) * Math.exp(-dt / tau);
/** Velocidad de fricción con el perfil logarítmico promediado en la vertical: u* = κ·U/(ln(h/z₀) − 1). */
export const velocidadFriccion = (U, h, z0) => (KAPPA * U) / (Math.log(h / z0) - 1);
/** Perfil logarítmico u(z) = (u* / κ)·ln(z/z₀). */
export const perfilLog = (z, us, z0) => (z > z0 ? (us / KAPPA) * Math.log(z / z0) : 0);
/** Esfuerzo en el fondo τ = ρ·u*² [Pa]. */
export const esfuerzoFondo = (us) => RHO * us * us;

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA CUÑA SALINA (raíz y polinomio en Fr^(2/3))
// ═══════════════════════════════════════════════════════════════════════════
/** Gravedad reducida g' = g·Δρ/ρ con Δρ/ρ ≈ 0.00078·S (agua de mar frente a agua dulce). */
export const gReducida = (S) => G * 0.00078 * S;
/** Número de Froude densimétrico Fr = U/√(g'·h). */
export const froudeDensimetrico = (U, gp, h) => U / Math.sqrt(gp * h);
/**
 * Longitud de la cuña salina detenida (Schijf y Schönfeld, 1953):
 * L = h/(4·C_i)·[Fr⁻²/5 − 2 + 3·Fr^(2/3) − (6/5)·Fr^(4/3)]. Con Fr ≥ 1 el río empuja la cuña
 * fuera de la boca (L = 0).
 */
export function cunaSalina(h, Ci, Fr) {
  if (!(Fr > 0)) return Infinity;
  if (Fr >= 1) return 0;
  const f = Fr ** (2 / 3);
  return (h / (4 * Ci)) * (0.2 / (Fr * Fr) - 2 + 3 * f - 1.2 * f * f);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA PLUMA (exponencial y logarítmica)
// ═══════════════════════════════════════════════════════════════════════════
/** Escala de la pluma L = U·h_p/w_s: lo que recorre el agua mientras el sedimento baja h_p. */
export const escalaPluma = (U, hp, ws) => (ws > 0 ? (U * hp) / ws : Infinity);
/** Concentración mar adentro C(x) = C₀·e^(−x/L). */
export const concentracionPluma = (x, C0, L) => C0 * Math.exp(-x / L);
/** Alcance de la pluma visible: la x donde C = C_vis, x = L·ln(C₀/C_vis). */
export const alcancePluma = (C0, L, Cvis) => (C0 > Cvis ? L * Math.log(C0 / Cvis) : 0);

// ═══════════════════════════════════════════════════════════════════════════
// 6. EL DELTA CRECE (lineal y cuadrática)
// ═══════════════════════════════════════════════════════════════════════════
/** Avance del frente [m/año] = volumen neto [m³/año]/(ancho del frente × altura del frente). */
export const avanceFrente = (Vneto, W, H) => Vneto / (W * H);
/** Área de un lóbulo semicircular de radio r: A = π·r²/2. */
export const areaLobulo = (r) => (Math.PI * r * r) / 2;
/** Años hasta que el mar alcanza una llanura de cota z con ascenso relativo de a mm/año. */
export const anosHastaMar = (z, aMmAno) => (aMmAno > 0 ? (1000 * z) / aMmAno : Infinity);
/** Años hasta la avulsión: la sobreelevación crece en línea recta hasta β·h. */
export const anosAvulsion = (beta, h, s0, tasaMmAno) => (tasaMmAno > 0 ? Math.max(0, (1000 * (beta * h - s0)) / tasaMmAno) : Infinity);

// ═══════════════════════════════════════════════════════════════════════════
// 7. EL OLEAJE (potencias y por tramos)
// ═══════════════════════════════════════════════════════════════════════════
/** Altura de rotura de Komar y Gaughan: H_b = 0.39·g^(1/5)·(T·H₀²)^(2/5). */
export const alturaRotura = (H0, T) => 0.39 * G ** 0.2 * (T * H0 * H0) ** 0.4;
/**
 * Transporte litoral de arena (fórmula CERC) [m³/s de arena depositada]:
 * Q = K·√(g/γ)·H_b^(5/2)·sin(2θ)/(16·(s − 1)·(1 − p)), con K = 0.39, γ = 0.78, s = 2.65 y p = 0.4.
 */
export function transporteLitoral(Hb, thetaGrados, { K = 0.39, gamma = 0.78, s = 2.65, poros = 0.4 } = {}) {
  const th = (thetaGrados * Math.PI) / 180;
  return (K * Math.sqrt(G / gamma) * Hb ** 2.5 * Math.sin(2 * th)) / (16 * (s - 1) * (1 - poros));
}
/** Tipo de delta por tramos: la marea manda si su rango pasa de 4 m; si no, el río o el oleaje según R. */
export function tipoDelta(R, rangoMarea) {
  if (rangoMarea > 4) return 'dominado por la marea';
  if (R >= 1) return 'dominado por el río';
  return 'dominado por el oleaje';
}
/** Clase de marea por su rango (Davies): micromareal < 2 m, mesomareal 2–4 m, macromareal > 4 m. */
export const claseMarea = (rango) => (rango < 2 ? 'micromareal' : (rango <= 4 ? 'mesomareal' : 'macromareal'));
