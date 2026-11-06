/**
 * modelo.js — Núcleo matemático del simulador de océanos
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM). Unidades del SI internamente: longitudes [m], tiempo [s],
 * temperatura [°C], salinidad [PSU], densidad [kg/m³].
 *
 * El océano de referencia es el mar Caribe frente a Colombia: los vientos alisios, el
 * afloramiento de agua fría frente a La Guajira, la termoclina, la pluma del Magdalena, los
 * arrecifes de coral de las Islas del Rosario y San Andrés, la marea pequeña, el ascenso del
 * nivel del mar y la acidificación. Objetos:
 *   1. Decimales     → mezcla del agua del río con el mar (salinidad de la pluma).
 *   2. Lineales      → celeridad en aguas profundas C = g·T/(2π); ecuación de estado
 *                      ρ = ρ₀[1 − α(T − T₀) + β(S − S₀)]; expansión térmica Δh = α·ΔT·H.
 *   3. Cuadráticas   → longitud de onda L₀ = g·T²/(2π); energía E = ρ·g·H²/16; esfuerzo del
 *                      viento τ = ρ_a·C_D·U²; altura de Pierson y Moskowitz H = 0.21·U²/g;
 *                      ascenso del mar con aceleración h(t) = a·t + b·t².
 *   4. Raíces        → profundidad de Ekman D = π·√(2A_z/f); ola máxima H_máx = H_s·√(ln N/2).
 *   5. Potencias     → potencia del oleaje P = ρ·g²·H²·T/(64π).
 *   6. Racionales    → transporte de Ekman M = τ/(ρ·f); período de mareas vivas y muertas
 *                      1/(1/T₁ − 1/T₂); salinidad de la pluma.
 *   7. Exponenciales → probabilidad de Rayleigh P(H > x) = e^(−2(x/H_s)²); CO₂ del aire
 *                      C(t) = C₀·e^(r·t); la temperatura se acerca a su equilibrio; aragonito.
 *   8. Logarítmicas  → pH = −log₁₀[H⁺] y su caída con el CO₂.
 *   9. Logística     → perfil de la temperatura con la profundidad (termoclina).
 *  10. Trigonométricas y periódicas → Coriolis f = 2Ω·sin φ; marea; temporada de los alisios y
 *                      de la temperatura del mar.
 *  11. Por tramos    → alerta de blanqueamiento del coral (NOAA Coral Reef Watch) y estado de la
 *                      calcificación según el aragonito.
 */

export const G = 9.81;
export const RHO = 1025;
export const RHO_AIRE = 1.2;
export const OMEGA = 7.2921e-5;
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;
export const rad = (g) => (g * Math.PI) / 180;

// ═══════════════════════════════════════════════════════════════════════════
// 1. OLAS EN MAR ABIERTO
// ═══════════════════════════════════════════════════════════════════════════
/** Celeridad y longitud de onda en aguas profundas. */
export const celeridadProfunda = (T) => (G * T) / (2 * Math.PI);
export const longitudProfunda = (T) => (G * T * T) / (2 * Math.PI);
/** Mar totalmente desarrollado (Pierson y Moskowitz): H_s = 0.21·U²/g y T_p = 7.16·U/g. */
export const alturaPM = (U) => (0.21 * U * U) / G;
export const periodoPM = (U) => (7.16 * U) / G;
/** Energía por metro cuadrado E = ρ·g·H_s²/16 [J/m²]. */
export const energiaOla = (Hs) => (RHO * G * Hs * Hs) / 16;
/** Potencia por metro de cresta en aguas profundas P = ρ·g²·H_s²·T_e/(64π) [W/m]. */
export const potenciaOla = (Hs, Te) => (RHO * G * G * Hs * Hs * Te) / (64 * Math.PI);
/** Rayleigh: probabilidad de que una ola pase la altura x. */
export const probRayleigh = (x, Hs) => Math.exp(-2 * (x / Hs) ** 2);
/** Ola más alta esperada entre N olas: H_máx ≈ H_s·√(ln N/2). */
export const olaMaxima = (Hs, N) => Hs * Math.sqrt(Math.log(Math.max(1, N)) / 2);

// ═══════════════════════════════════════════════════════════════════════════
// 2. MAREAS
// ═══════════════════════════════════════════════════════════════════════════
export const COMPONENTES = { K1: 23.934, O1: 25.819, M2: 12.421, S2: 12.0 };
export function marea(t, amps, fases = {}) {
  let eta = 0;
  for (const [k, T] of Object.entries(COMPONENTES)) eta += (amps[k] ?? 0) * Math.cos((2 * Math.PI * t) / T - (fases[k] ?? 0));
  return eta;
}
/** Período del batido entre dos ondas (mareas vivas y muertas): 1/(1/T₁ − 1/T₂). */
export const periodoBatido = (T1, T2) => 1 / Math.abs(1 / T1 - 1 / T2);
export const numeroForma = (a) => ((a.K1 ?? 0) + (a.O1 ?? 0)) / Math.max(1e-9, (a.M2 ?? 0) + (a.S2 ?? 0));

// ═══════════════════════════════════════════════════════════════════════════
// 3. VIENTO, CORIOLIS Y EKMAN
// ═══════════════════════════════════════════════════════════════════════════
/** Parámetro de Coriolis f = 2Ω·sin φ. */
export const coriolis = (latGrados) => 2 * OMEGA * Math.sin(rad(latGrados));
/** Esfuerzo del viento τ = ρ_a·C_D·U². */
export const esfuerzoViento = (U, Cd = 0.0013) => RHO_AIRE * Cd * U * U;
/** Transporte de Ekman por metro de costa M = τ/(ρ·f) [m²/s]. */
export const transporteEkman = (tau, f) => tau / (RHO * f);
/** Profundidad de Ekman D = π·√(2A_z/f). */
export const profundidadEkman = (Az, f) => Math.PI * Math.sqrt((2 * Az) / Math.abs(f));
/** Corriente de Ekman a la profundidad z: gira 45° en la superficie y luego con z/D; se apaga como e^(−πz/D). */
export function espiralEkman(z, V0, D) {
  const a = (Math.PI * z) / D;
  return { rapidez: V0 * Math.exp(-a), giro: 45 + (a * 180) / Math.PI };
}
/** Velocidad del afloramiento w = M/L (el agua que se va mar afuera sube en una franja de ancho L). */
export const velocidadAfloramiento = (M, L) => M / L;

// ═══════════════════════════════════════════════════════════════════════════
// 4. TEMPERATURA, SALINIDAD Y DENSIDAD
// ═══════════════════════════════════════════════════════════════════════════
/** Termoclina logística: T(z) = T_fondo + (T_sup − T_fondo)/(1 + e^((z − z_t)/δ)). */
export const perfilTemperatura = (z, Ts, Tf, zt, delta) => Tf + (Ts - Tf) / (1 + Math.exp((z - zt) / delta));
/** Ecuación de estado lineal ρ = ρ₀[1 − α(T − T₀) + β(S − S₀)]. */
export const densidad = (T, S, { rho0 = 1023.6, T0 = 25, S0 = 35, alfa = 2.6e-4, beta = 7.6e-4 } = {}) => rho0 * (1 - alfa * (T - T0) + beta * (S - S0));
/** Mezcla del río con el mar en una caja de volumen V renovada en τ: S = S_mar·V/(V + Q·τ). */
export const salinidadPluma = (Smar, V, Q, tau) => (Smar * V) / (V + Q * tau);
/** Acercamiento exponencial al equilibrio. */
export const relajar = (x, xeq, dt, tau) => xeq + (x - xeq) * Math.exp(-dt / tau);

// ═══════════════════════════════════════════════════════════════════════════
// 5. CORAL: BLANQUEAMIENTO (por tramos)
// ═══════════════════════════════════════════════════════════════════════════
/** Nivel de alerta de NOAA Coral Reef Watch con el HotSpot (°C) y los DHW (°C·semana). */
export function alertaCoral(hotspot, dhw) {
  if (hotspot <= 0) return { nivel: 0, nombre: 'sin estrés' };
  if (hotspot < 1) return { nivel: 1, nombre: 'vigilancia' };
  if (dhw < 4) return { nivel: 2, nombre: 'advertencia' };
  if (dhw < 8) return { nivel: 3, nombre: 'alerta 1: blanqueamiento probable' };
  return { nivel: 4, nombre: 'alerta 2: blanqueamiento grave y mortalidad' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. NIVEL DEL MAR Y CARBONO
// ═══════════════════════════════════════════════════════════════════════════
/** Ascenso del mar con aceleración: h(t) = a·t + b·t² (t en años desde hoy, h en mm). */
export const ascensoMar = (t, a, b) => a * t + b * t * t;
/** Expansión térmica de una capa de espesor H que se calienta ΔT: Δh = α·ΔT·H. */
export const expansionTermica = (dT, H, alfa = 2.6e-4) => alfa * dT * H;
/** CO₂ del aire con crecimiento exponencial C(t) = C₀·e^(r·t). */
export const co2 = (t, C0, r) => C0 * Math.exp(r * t);
/** pH del mar: cae con el logaritmo del CO₂, pH = pH₀ − k·log₁₀(C/C₀). */
export const phMar = (C, C0, pH0, k = 0.9) => pH0 - k * Math.log10(C / C0);
/** Concentración de H⁺ [mol/L] = 10^(−pH). */
export const hidrogeniones = (pH) => 10 ** -pH;
/** Saturación de aragonito Ω = Ω₀·10^(0.7·(pH − pH₀)). */
export const aragonito = (pH, pH0, Om0) => Om0 * 10 ** (0.7 * (pH - pH0));
/** Estado de la calcificación del coral por tramos según Ω. */
export const calcificacion = (Om) => (Om >= 3.5 ? 'adecuada' : (Om >= 3 ? 'reducida' : (Om >= 2 ? 'marginal' : 'crítica')));
