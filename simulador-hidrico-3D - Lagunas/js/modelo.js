/**
 * modelo.js — Núcleo matemático del simulador de lagunas de alta montaña
 * -----------------------------------------------------------------------
 * Solo funciones puras (sin DOM ni gráficos) para poder probarlas por separado.
 * Unidades del SI internamente: caudal [m³/s], longitudes [m], áreas [m²], tiempo [s];
 * la lluvia y la evaporación en mm. La interfaz convierte a L/s, ha, cm/día, etc.
 *
 * La laguna de referencia es una laguna glaciar somera del páramo de la Sierra Nevada de
 * Santa Marta, a 4 300 m.s.n.m. Objetos matemáticos:
 *   1. Decimales   → conversiones (mm sobre un área → m³; ha; L/s), punto de ebullición.
 *   2. Lineales    → temperatura con la altitud T(z) = T₀ − Γ·z, derretimiento por grado-día
 *                    M = DDF·(T − T₀), área del espejo A(h) = (A_u/h_u)·h, embalse lineal del
 *                    páramo Q = S/k, colmatación V(t) = V₀ − ΔV·t, nivel con caudales fijos.
 *   3. Cuadráticas → volumen de la cubeta V(h) = A_u·h²/(2h_u) (paraboloide), longitud de onda
 *                    L = g·T²/(2π), vértice del pico de agua del glaciar.
 *   4. Exponenciales y logarítmicas → recesión del páramo Q = Q₀·e^(−t/k), luz I(z) = I₀·e^(−k_d·z),
 *                    presión con la altitud, índice de Carlson TSI = 60 − 14.41·ln(DS),
 *                    retroceso del glaciar A_g(t) = A_g0·e^(−λt).
 *   5. Potencia, racionales y periódicas → vertedero Q = C·L·H^1.5, vaciado súbito
 *                    Q = 75·V^0.67, clorofila de Dillon y Rigler, cobertura de plantas de
 *                    Scheffer V = h^p/(h^p + k^p), fósforo de Vollenweider P = P_in/(1 + √τ),
 *                    ciclo diario del oxígeno OD(t) = ŌD − A·cos(2π(t − 5)/24).
 */

// ── Constantes físicas ──────────────────────────────────────────────────────
export const G = 9.81;               // gravedad [m/s²]
export const RHO = 1000;             // densidad del agua fría de la laguna [kg/m³]
export const RHO_S = 2650;           // densidad de los granos minerales [kg/m³]
export const SEG_DIA = 86400;
export const SEG_ANO = 365 * SEG_DIA;

// ═══════════════════════════════════════════════════════════════════════════
// 1. OPERACIONES CON DECIMALES
// ═══════════════════════════════════════════════════════════════════════════

/** Lámina de agua [mm] sobre un área [m²] → volumen [m³]. */
export const mmAm3 = (mm, area) => (mm / 1000) * area;
/** Lámina [mm/día] sobre un área [m²] → caudal [m³/s]. */
export const mmDiaAm3s = (mmDia, area) => (mmDia / 1000) * area / SEG_DIA;
/** Caudal [m³/s] sobre un área [m²] → lámina [mm/día]. */
export const m3sAmmDia = (Q, area) => (Q * SEG_DIA * 1000) / area;
export const haAm2 = (ha) => ha * 10000;
export const km2Am2 = (km2) => km2 * 1e6;

/** Punto de ebullición del agua con la altitud: baja cerca de 1 °C por cada 300 m. */
export const puntoEbullicion = (z) => 100 - z / 300;

/** Presión atmosférica relativa (atmósfera estándar): P/P₀ = (1 − 2.25577·10⁻⁵·z)^5.25588. */
export const presionRelativa = (z) => (1 - 2.25577e-5 * z) ** 5.25588;
export const presionAtm = (z) => 101.325 * presionRelativa(z);   // [kPa]

// ═══════════════════════════════════════════════════════════════════════════
// 2. CLIMA DE ALTA MONTAÑA Y GLACIAR (lineales y exponenciales)
// ═══════════════════════════════════════════════════════════════════════════

/** Temperatura media del aire con la altitud: recta T(z) = T_mar − Γ·z [°C]. */
export const temperaturaAltitud = (z, Tmar, gradiente) => Tmar - gradiente * z;

/** Altitud de la isoterma de 0 °C: raíz de T(z) = 0. */
export const altitudCeroGrados = (Tmar, gradiente) => Tmar / gradiente;

/** Derretimiento por grado-día: M = DDF·máx(0, T − T₀) [mm de agua al día]. */
export const derretimiento = (T, DDF, T0 = 0) => DDF * Math.max(0, T - T0);

/** Área del glaciar después de t años con una pérdida relativa λ al año: A = A₀·e^(−λt). */
export const areaGlaciar = (A0, lambda, t) => A0 * Math.exp(-lambda * t);

/**
 * Agua de deshielo t años en el futuro con el calentamiento w [°C/año]:
 * Q(t) = DDF·(T₀ + w·t)·A₀·e^(−λt). Es una recta por una exponencial que decae.
 */
export function deshieloFuturo({ T0, w, A0, lambda, DDF }, t) {
  const M = derretimiento(T0 + w * t, DDF);            // mm/día
  return mmDiaAm3s(M, areaGlaciar(A0, lambda, t));     // m³/s
}

/**
 * Pico del agua del glaciar: la derivada de (T₀ + w·t)·e^(−λt) se anula en
 * t* = 1/λ − T₀/w. Si t* ≤ 0 el pico ya pasó y el aporte solo baja.
 */
export function picoDeshielo({ T0, w, lambda }) {
  if (w <= 0) return 0;
  return 1 / lambda - T0 / w;
}

/** Años hasta que el glaciar queda con una fracción f de su área: t = ln(1/f)/λ. */
export const anosHastaFraccion = (lambda, f = 0.01) => Math.log(1 / f) / lambda;

/** Radiación extraterrestre diaria [MJ/m²·día] (FAO-56, ec. 21) para la latitud y el día del año. */
export function radiacionExtraterrestre(latitudGrados, diaAno) {
  const phi = (latitudGrados * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * diaAno) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * diaAno) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/** Evapotranspiración de referencia de Hargreaves y Samani: ET₀ = 0.0023·(T + 17.8)·√ΔT·R_a [mm/día]. */
export const hargreaves = (T, dT, RaMJ) => Math.max(0, 0.0023 * (T + 17.8) * Math.sqrt(Math.max(0, dT)) * RaMJ * 0.408);

// ═══════════════════════════════════════════════════════════════════════════
// 3. EL PÁRAMO COMO EMBALSE LINEAL (lineal y exponencial)
// ═══════════════════════════════════════════════════════════════════════════

/** Caudal que suelta el suelo del páramo: Q = S/k (S en mm, k en días) [mm/día]. */
export const salidaParamo = (S, k) => S / k;

/**
 * Un paso del embalse lineal dS/dt = R − S/k con la lluvia efectiva R constante:
 * solución exacta S(t) = R·k + (S₀ − R·k)·e^(−t/k)  (t en días).
 */
export const pasoParamo = (S0, R, k, tDias) => R * k + (S0 - R * k) * Math.exp(-tDias / k);

/** Recesión sin lluvia: Q(t) = Q₀·e^(−t/k). Días para bajar a la fracción f: t = k·ln(1/f). */
export const recesion = (Q0, k, tDias) => Q0 * Math.exp(-tDias / k);
export const diasRecesion = (k, f) => k * Math.log(1 / f);

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA CUBETA DE LA LAGUNA: PARABOLOIDE (lineal y cuadrática)
// ═══════════════════════════════════════════════════════════════════════════
// La cubeta es un paraboloide de revolución: la profundidad máxima h está en el centro y
// el área del espejo crece en línea recta con h; el volumen es su integral (cuadrático).

/** Área del espejo de agua A(h) = (A_u/h_u)·h [m²]. */
export const areaEspejo = (h, Au, hu) => (Au / hu) * Math.max(0, h);
/** Volumen V(h) = A_u·h²/(2·h_u) [m³]. */
export const volumenLaguna = (h, Au, hu) => (Au * Math.max(0, h) ** 2) / (2 * hu);
/** Nivel a partir del volumen (despeje de la cuadrática): h = √(2·h_u·V/A_u). */
export const nivelDeVolumen = (V, Au, hu) => Math.sqrt((2 * hu * Math.max(0, V)) / Au);
/** Profundidad media del paraboloide: V/A = h/2. */
export const profundidadMedia = (h) => h / 2;
/** Radio del espejo de agua (círculo de área A). */
export const radioEspejo = (A) => Math.sqrt(A / Math.PI);

/** Vertedero de rebose (umbral de roca o de morrena): Q = C·L·(h − h_u)^1.5 [m³/s]. */
export const vertedero = (h, hu, C, L) => (h > hu ? C * L * (h - hu) ** 1.5 : 0);
/** Lámina sobre el umbral para un caudal dado: H = (Q/(C·L))^(2/3). */
export const laminaVertedero = (Q, C, L) => (Q > 0 ? (Q / (C * L)) ** (2 / 3) : 0);

/** Cambio del nivel con caudales fijos: dh/dt = Q_neto/A(h) [m/s]. */
export const pendienteNivel = (Qneto, A) => (A > 0 ? Qneto / A : 0);

/**
 * Días para que el nivel pase de h1 a h2 con un caudal neto constante Q (sin vertedero):
 * el volumen cambia en línea recta, t = (V₂ − V₁)/Q.
 */
export function diasEntreNiveles(h1, h2, Qneto, Au, hu) {
  const dV = volumenLaguna(h2, Au, hu) - volumenLaguna(h1, Au, hu);
  if (Qneto === 0 || Math.sign(dV) !== Math.sign(Qneto)) return Infinity;
  return dV / Qneto / SEG_DIA;
}

/** Tiempo de residencia τ = V/Q_salida [s]. */
export const tiempoResidencia = (V, Qsale) => (Qsale > 0 ? V / Qsale : Infinity);

// ═══════════════════════════════════════════════════════════════════════════
// 5. VIENTO Y OLEAJE: OLAS LIMITADAS POR EL FETCH (potencia y cuadrática)
// ═══════════════════════════════════════════════════════════════════════════

/** Altura significativa de las olas con el fetch F [m] y el viento U [m/s]: H = 0.0016·U·√(F/g). */
export const alturaOla = (U, F) => 0.0016 * U * Math.sqrt(F / G);
/** Período pico: T = 0.2857·(U/g)·(g·F/U²)^(1/3). */
export const periodoOla = (U, F) => (U > 0 ? 0.2857 * (U / G) * ((G * F) / (U * U)) ** (1 / 3) : 0);
/** Longitud de onda en aguas profundas: L = g·T²/(2π) (parábola en T). */
export const longitudOla = (T) => (G * T * T) / (2 * Math.PI);
/** Base del oleaje: las olas mueven el fondo donde la profundidad es menor que L/2. */
export const baseOleaje = (L) => L / 2;
/**
 * Parte del fondo que las olas pueden remover. En el paraboloide la profundidad crece del
 * borde al centro y el área con profundidad menor que d es la fracción d/h (lineal).
 */
export const fraccionFondoRemovido = (d, h) => (h > 0 ? Math.min(1, d / h) : 1);

// ═══════════════════════════════════════════════════════════════════════════
// 6. NUTRIENTES, LUZ Y ESTADOS ALTERNATIVOS (racionales, potencia, exponencial, logaritmo)
// ═══════════════════════════════════════════════════════════════════════════

/** Concentración del fósforo que entra: P_in = carga [kg/año]·10⁶/volumen [m³/año] [µg/L]. */
export const fosforoEntrada = (cargaKg, volumenAno) => (volumenAno > 0 ? (cargaKg * 1e6) / volumenAno : 0);
/** Fósforo en la laguna (Vollenweider, 1976): P = P_in/(1 + √τ), τ en años. */
export const fosforoLaguna = (Pin, tauAnos) => Pin / (1 + Math.sqrt(Math.max(0, tauAnos)));
/** Clorofila a (Dillon y Rigler, 1974): log₁₀Chl = 1.449·log₁₀P − 1.136 → Chl = 0.0731·P^1.449 [µg/L]. */
export const clorofila = (P) => (P > 0 ? 10 ** (1.449 * Math.log10(P) - 1.136) : 0);

/** Luz que llega a la profundidad z: I/I₀ = e^(−k_d·z) (Beer-Lambert). */
export const fraccionLuz = (kd, z) => Math.exp(-kd * z);
/** Profundidad del disco Secchi (Poole y Atkins, 1929): DS = 1.7/k_d [m]. */
export const secchi = (kd) => 1.7 / kd;
/** Zona fótica (1 % de la luz): z_eu = ln(100)/k_d [m]. */
export const zonaFotica = (kd) => Math.log(100) / kd;

/** Índices del estado trófico de Carlson (1977). */
export const tsiSecchi = (DS) => 60 - 14.41 * Math.log(DS);
export const tsiClorofila = (Chl) => 9.81 * Math.log(Math.max(Chl, 1e-6)) + 30.6;
export const tsiFosforo = (P) => 14.42 * Math.log(Math.max(P, 1e-6)) + 4.15;
export function claseTrofica(tsi) {
  if (tsi < 40) return 'oligotrófica';
  if (tsi < 50) return 'mesotrófica';
  if (tsi < 70) return 'eutrófica';
  return 'hipereutrófica';
}

/**
 * Modelo gráfico de Scheffer (1993) para lagunas someras:
 *   turbidez con plantas k_d(V) = k_w + (E₀ − k_w)·h_v/(h_v + V)        (racional en V)
 *   plantas en equilibrio V*(k) = h_e^p/(h_e^p + k^p)                    (función de Hill)
 * E₀ es la turbidez que tendría la laguna sin plantas; h_e = ln(1/f)/z̄ es la turbidez con
 * la que al fondo medio llega apenas la fracción f de luz que necesitan las plantas.
 */
export const turbidezConPlantas = (V, E0, kw, hv) => kw + (E0 - kw) * (hv / (hv + Math.max(0, V)));
export const plantasEquilibrio = (k, he, p = 4) => he ** p / (he ** p + k ** p);
export const turbidezCritica = (zMedia, fLuz = 0.1) => Math.log(1 / fLuz) / zMedia;

/**
 * Equilibrios del modelo de Scheffer: raíces de f(V) = V*(k_d(V)) − V en [0, 1].
 * Devuelve [{ V, k, estable }] de la más clara a la más turbia.
 */
export function equilibriosScheffer(E0, kw, hv, he, p = 4, n = 400) {
  const f = (V) => plantasEquilibrio(turbidezConPlantas(V, E0, kw, hv), he, p) - V;
  const raices = [];
  let V0 = 0, f0 = f(0);
  for (let i = 1; i <= n; i++) {
    const V1 = i / n;
    const f1 = f(V1);
    if (f0 === 0 || f0 * f1 < 0) {
      let a = V0, b = V1, fa = f0;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
      }
      const V = (a + b) / 2;
      const d = (f(Math.min(1, V + 1e-4)) - f(Math.max(0, V - 1e-4))) / 2e-4;
      raices.push({ V, k: turbidezConPlantas(V, E0, kw, hv), estable: d < 0 });
    }
    V0 = V1; f0 = f1;
  }
  return raices.sort((x, y) => y.V - x.V);
}

/** Un paso de la cobertura de plantas: dV/dt = r·(V* − V) (se acerca al equilibrio). */
export function pasoPlantas(V, E0, kw, hv, he, r, tDias, p = 4) {
  // se integra en pasos de un día como máximo: la turbidez cambia con las plantas
  let x = V;
  let resta = tDias;
  while (resta > 1e-9) {
    const dt = Math.min(1, resta);
    const obj = plantasEquilibrio(turbidezConPlantas(x, E0, kw, hv), he, p);
    x = obj + (x - obj) * Math.exp(-r * dt);
    resta -= dt;
  }
  return Math.min(1, Math.max(0, x));
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. OXÍGENO Y TEMPERATURA DEL AGUA (periódicas)
// ═══════════════════════════════════════════════════════════════════════════

/** Oxígeno disuelto de saturación a nivel del mar (APHA) corregido por la presión de la altitud [mg/L]. */
export function odSaturacion(T, z = 0) {
  const Tk = T + 273.15;
  const lnC = -139.34411 + 1.575701e5 / Tk - 6.642308e7 / Tk ** 2 + 1.2438e10 / Tk ** 3 - 8.621949e11 / Tk ** 4;
  return Math.exp(lnC) * presionRelativa(z);
}

/** Temperatura del agua a la hora h: T̄ + A·sin(2π(h − 9)/24) (máxima a las 15:00). */
export const temperaturaAgua = (Tmedia, amplitud, hora) => Tmedia + amplitud * Math.sin((2 * Math.PI * (hora - 9)) / 24);

/**
 * Oxígeno a la hora h: de día las algas y las plantas producen oxígeno y de noche todos
 * respiran. ŌD = OD_sat − D_r y OD(h) = ŌD − A·cos(2π(h − 5)/24): mínimo a las 05:00 y
 * máximo a las 17:00.
 */
export const oxigenoHora = (ODmedio, amplitud, hora) => ODmedio - amplitud * Math.cos((2 * Math.PI * (hora - 5)) / 24);

// ═══════════════════════════════════════════════════════════════════════════
// 8. SEDIMENTOS Y COLMATACIÓN (cuadrática y lineal)
// ═══════════════════════════════════════════════════════════════════════════

/** Viscosidad dinámica del agua [Pa·s] con la temperatura (ajuste de Vogel). */
export const viscosidad = (T) => 2.414e-5 * 10 ** (247.8 / (T + 273.15 - 140));
/** Velocidad de caída de Stokes v = K·d², K = g(ρ_s − ρ)/(18μ) [m/s]. */
export const constanteStokes = (T) => (G * (RHO_S - RHO)) / (18 * viscosidad(T));
export const velocidadCaida = (d, T) => constanteStokes(T) * d * d;
/** Fracción de una clase de grano que se queda en la laguna: mín(1, v_s·A/Q) (carga superficial). */
export const fraccionRetenida = (vs, A, Q) => (Q > 0 ? Math.min(1, (vs * A) / Q) : 1);

/** Volumen que pierde la laguna al año: ΔV = M·TE/ρ_b [m³/año] (M en t/año, ρ_b en t/m³). */
export const volumenColmatado = (Mt, TE, rhoB) => (Mt * TE) / rhoB;

// ═══════════════════════════════════════════════════════════════════════════
// 9. VACIADO SÚBITO DE UNA LAGUNA DE MORRENA (potencia y exponencial)
// ═══════════════════════════════════════════════════════════════════════════

/** Caudal pico del vaciado (Clague y Mathews, 1973): Q = 75·V^0.67, V en millones de m³ [m³/s]. */
export const caudalVaciado = (V) => 75 * (Math.max(0, V) / 1e6) ** 0.67;
/** El pico se atenúa río abajo: Q(x) = Q_p·e^(−x/λ). */
export const atenuacion = (Qp, x, lambda) => Qp * Math.exp(-x / lambda);
/** Hidrograma del vaciado Q(t) = Q_p·(t/t_p)·e^(1 − t/t_p); su volumen es Q_p·t_p·e. */
export const hidrogramaVaciado = (Qp, tp, t) => (t <= 0 ? 0 : Qp * (t / tp) * Math.exp(1 - t / tp));
export const tiempoPicoVaciado = (V, Qp) => V / (Qp * Math.E);

/** Capacidad de un cauce trapezoidal con Manning: Q = (1/n)·A·R^(2/3)·S^(1/2). */
export function capacidadCauce(b, y, z, n, S) {
  const A = (b + z * y) * y;
  const P = b + 2 * y * Math.sqrt(1 + z * z);
  return (1 / n) * A * (A / P) ** (2 / 3) * Math.sqrt(S);
}
