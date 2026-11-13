/**
 * sistema.js — Une el modelo de la ciénaga costera en un solo cálculo, con el reloj, los
 * escenarios y la revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): volumen de agua V [m³] y masa de sal M = S·V [PSU·m³]. Con cada
 * paso del reloj (30 min como máximo) entran los ríos de la Sierra, la lluvia y el mar por la
 * boca con la marea; sale la evaporación. Por los caños el agua va en los dos sentidos: entra
 * del Magdalena cuando el río está más alto que la orilla de los caños (creciente) y la
 * ciénaga le devuelve agua salobre al río cuando el río baja y los alisios del noreste
 * levantan el agua en esa orilla (estiaje). El reloj empieza el 1 de enero a las 06:00, con el
 * estado del final de un año de simulación previo (régimen periódico).
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, INICIO_MES, fechaDeDia } from './nucleo/formato.js';

export const SITIO = {
  nombre: 'Ciénaga Grande de Santa Marta (laguna costera del delta del Magdalena)',
  latitud: 10.9,
  delta: 0.02,           // m: suavizado del caudal por las aberturas cerca de Δh = 0
  bordeRio: 0.03,        // m: frente a los caños el río queda al menos así sobre el nivel medio del mar
  PSmar: 10,             // µg/L de fósforo del agua de mar
  rhoB: 0.9,             // t/m³ del lodo depositado
};

/** Caudal medio de cada mes frente al del año en los ríos de la Sierra (el del simulador de ríos). */
export const F_RIOS = [0.5, 0.4, 0.4, 0.6, 1.1, 1.05, 0.8, 0.95, 1.35, 1.9, 1.8, 1.15];
/** Lluvia de cada mes en Santa Marta (1991–2020), como fracción del año (la del simulador de ríos). */
const LLUVIA_SM = [3, 2, 2, 14, 55, 60, 60, 70, 90, 110, 65, 15];
export const F_LLUVIA = LLUVIA_SM.map((x) => x / LLUVIA_SM.reduce((a, b) => a + b, 0));
/**
 * Fuerza de los alisios del noreste en cada mes frente a la de febrero: soplan con fuerza de
 * diciembre a abril y se calman en octubre (en el mar frente a Santa Marta, cerca de 12 m/s en
 * febrero y de 6 m/s en octubre; Bastidas-Salamanca et al., 2016).
 */
export const F_VIENTO = [0.92, 1.0, 0.97, 0.85, 0.68, 0.7, 0.72, 0.64, 0.56, 0.52, 0.56, 0.78];

export const CLIMAS = {
  normal: { nombre: 'Año normal', fRios: 1, dH: 0, fLluvia: 1, fEvap: 1, fViento: 1 },
  nino: { nombre: 'El Niño (año seco)', fRios: 0.5, dH: -0.4, fLluvia: 0.6, fEvap: 1.1, fViento: 1.1 },
  nina: { nombre: 'La Niña (año lluvioso)', fRios: 1.6, dH: 0.4, fLluvia: 1.5, fEvap: 0.95, fViento: 0.9 },
};

export const ESTADOS_CANO = {
  dragados: { nombre: 'Dragados y ampliados (40 m² cada uno)', area: 40 },
  abiertos: { nombre: 'Abiertos (25 m² cada uno)', area: 25 },
  sedimentados: { nombre: 'Sedimentados (8 m² cada uno)', area: 8 },
  cerrados: { nombre: 'Cerrados por diques', area: 0 },
};

export const PARAMETROS = {
  escenario: 'base',
  clima: 'normal',
  // Ríos de la Sierra Nevada
  Qrios: 40,                // m³/s (Fundación, Aracataca, Sevilla y otros, en conjunto)
  SSrios: 150,              // mg/L
  Prios: 40,                // µg/L
  // Magdalena y caños
  Hrio: 0.55,               // m.s.n.m. nivel medio del Magdalena frente a los caños (en su delta)
  A1: 0.6, d1: 320,         // creciente principal (noviembre)
  A2: 0.12, d2: 150,        // creciente secundaria (mayo–junio)
  nCanos: 3,
  estadoCanos: 'abiertos',
  Ccano: 0.4,
  SSmag: 600,               // mg/L
  Pmag: 120,                // µg/L
  Smag: 0.1,                // PSU
  // La ciénaga
  areaFondo: 400,           // km² (A_c)
  expansion: 60,            // km² por metro de nivel (s)
  zFondo: -1.4,             // m.s.n.m. fondo medio
  lluviaAnual: 900,         // mm
  Taire: 28,                // °C
  amplitudDiaria: 9,
  pisoPalafitos: 0.8,       // m.s.n.m.
  // Mar y boca
  anchoBoca: 200, profBoca: 3, Cboca: 0.6,
  alcantarillas: 20, areaAlcantarilla: 3,
  Smar: 36,
  K1: 0.09, O1: 0.07, M2: 0.06, S2: 0.02,
  nivelMar: 0,              // m sobre el nivel medio de hoy (ascenso del mar)
  kMarea: 0.5,              // parte de la marea que sube por el río y llega a los caños
  // Viento (alisios del noreste)
  Uviento: 6,               // m/s sobre la ciénaga en febrero (el mes más ventoso)
  fetch: 25,                // km: largo de la ciénaga en la dirección del viento
};

export const ESCENARIOS = {
  base: { nombre: 'Ciénaga de referencia (año normal, caños abiertos)', cambios: {} },
  estiaje: { nombre: 'Estiaje de abril: la ciénaga le devuelve agua al río', cambios: {}, sim: (p) => estadoEnDia(p, 105, 8) },
  nino: { nombre: 'Sequía de El Niño', cambios: { clima: 'nino' } },
  nina: { nombre: 'Lluvias y creciente de La Niña', cambios: { clima: 'nina' } },
  carretera: { nombre: 'Años noventa: caños sedimentados y carretera sin alcantarillas', cambios: { estadoCanos: 'sedimentados', alcantarillas: 0 } },
  crisis: { nombre: 'Crisis del manglar: años noventa con El Niño', cambios: { estadoCanos: 'sedimentados', alcantarillas: 0, clima: 'nino' } },
  restauracion: { nombre: 'Restauración: caños dragados y más alcantarillas', cambios: { estadoCanos: 'dragados', nCanos: 4, alcantarillas: 40 } },
  boca: { nombre: 'Boca de la Barra sedimentada', cambios: { anchoBoca: 60, profBoca: 1.5 } },
  eutrofizacion: { nombre: 'Magdalena y ríos cargados de nutrientes', cambios: { Pmag: 450, Prios: 120 } },
  mar: { nombre: 'Ascenso del nivel del mar de 0.5 m', cambios: { nivelMar: 0.5 } },
};

export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;
export const areaCanos = (p) => (ESTADOS_CANO[p.estadoCanos]?.area ?? 25);
export const areaBoca = (p) => p.anchoBoca * p.profBoca + p.alcantarillas * p.areaAlcantarilla;
export const amplitudes = (p) => ({ K1: p.K1, O1: p.O1, M2: p.M2, S2: p.S2 });
const FASES = { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 };

export function geometria(p) { return { Ac: p.areaFondo * 1e6, s: p.expansion * 1e6 }; }

/** Forzantes del instante t: ríos, Magdalena, lluvia, evaporación, viento y mar. */
export function forzantes(p, t) {
  const d = diaDelAno(t);
  const { mes } = fechaDeDia(d);
  const cl = clima(p);
  const Qr = p.Qrios * F_RIOS[mes] * cl.fRios;
  const lluvia = (p.lluviaAnual * cl.fLluvia * F_LLUVIA[mes]) / DIAS_MES[mes];
  const Ra = radiacion(d);
  const ET0 = 0.0023 * (p.Taire + 17.8) * Math.sqrt(p.amplitudDiaria) * Ra * 0.408;
  const E = 1.05 * ET0 * cl.fEvap;
  const mareaHoy = M.marea(t / 3600, amplitudes(p), FASES);
  const eta = p.nivelMar + mareaHoy;
  // El Magdalena frente a los caños: su régimen del año (serie de Fourier), que sube con una
  // parte del ascenso del mar (remanso) pero no baja del nivel medio del mar (el río tiene que
  // correr hacia el mar: función por tramos con máx), más la parte de la marea que sube por la
  // desembocadura.
  const HF = M.nivelRio(d, p.Hrio + cl.dH, p.A1, p.d1, p.A2, p.d2);
  const Hd = Math.max(HF + p.kMarea * p.nivelMar, p.nivelMar + SITIO.bordeRio);
  const H = Hd + p.kMarea * mareaHoy;
  const U = p.Uviento * F_VIENTO[mes] * (cl.fViento ?? 1);
  return { d, mes, Qr, HF, Hd, H, lluvia, ET0, E, eta, mareaHoy, Ra, U };
}

function radiacion(d) {
  const phi = (SITIO.latitud * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * d) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * d) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/**
 * Caudales del instante con el estado (V, M). El viento inclina el agua: sube Δη/2 en la orilla
 * de los caños (al suroccidente, hacia donde soplan los alisios) y baja Δη/2 frente a la boca.
 * Por eso cada abertura ve su propio desnivel: Δh_caños = H − (z + Δη/2) y Δh_boca = η − (z − Δη/2).
 * Qc > 0: el Magdalena entra a la ciénaga; Qc < 0: la ciénaga le devuelve agua al río.
 */
export function caudales(p, sim) {
  const { Ac, s } = geometria(p);
  const f = forzantes(p, sim.t);
  const h = M.profundidadDeVolumen(sim.V, Ac, s);
  const z = h + p.zFondo;
  const A = M.areaCienaga(h, Ac, s);
  const S = sim.V > 0 ? sim.Msal / sim.V : 0;
  const dEta = M.setupViento(f.U, p.fetch * 1000, h);
  const zC = z + dEta / 2;
  const zB = z - dEta / 2;
  const Qc = p.nCanos * M.caudalAbertura(p.Ccano, areaCanos(p), f.H - zC, SITIO.delta);
  const Qb = M.caudalAbertura(p.Cboca, areaBoca(p), f.eta - zB, SITIO.delta);
  const Qll = M.mmDiaAm3s(f.lluvia, A);
  const Qe = M.mmDiaAm3s(f.E, A);
  return { ...f, h, z, A, S, dEta, zC, zB, Qc, Qb, Qll, Qe, Qneto: f.Qr + Qc + Qll - Qe + Qb };
}

/** Avanza dt segundos (pasos de 30 min como máximo). */
export function avanzar(p, sim, dt) {
  const { Ac, s } = geometria(p);
  let resta = dt;
  while (resta > 1e-9) {
    const h = Math.min(1800, resta);
    const t0 = sim.t + (dt - resta);
    const q = caudales(p, { ...sim, t: t0 });
    const S = q.S;
    const sal = (q.Qc > 0 ? q.Qc * p.Smag : q.Qc * S) + (q.Qb > 0 ? q.Qb * p.Smar : q.Qb * S);
    sim.V = Math.max(volumenMinimo(p), sim.V + q.Qneto * h);
    sim.Msal = Math.max(0, sim.Msal + sal * h);
    resta -= h;
  }
}
const volumenMinimo = (p) => M.volumenCienaga(0.05, geometria(p).Ac, geometria(p).s);

/**
 * Un año simulado: medias de cada mes. Por los caños se cuenta por aparte lo que entra del río
 * (Q⁺) y lo que vuelve al río (Q⁻), y el tiempo con el agua saliendo hacia el río.
 */
function simularAno(p, sim) {
  const meses = [];
  for (let k = 0; k < 12; k++) {
    const ac = { Qr: 0, Qc: 0, QcIn: 0, QcOut: 0, nRet: 0, Qbin: 0, Qbout: 0, Qe: 0, Qll: 0, z: 0, zMax: -Infinity, S: 0, Smax: 0, H: 0, U: 0, dEta: 0, n: 0 };
    const pasos = DIAS_MES[k] * 48;
    for (let j = 0; j < pasos; j++) {
      const q = caudales(p, sim);
      const c = M.partes(q.Qc);
      ac.Qr += q.Qr; ac.Qc += q.Qc; ac.QcIn += c.entra; ac.QcOut += c.sale; ac.Qe += q.Qe; ac.Qll += q.Qll; ac.z += q.z; ac.S += q.S; ac.n++;
      ac.H += q.H; ac.U += q.U; ac.dEta += q.dEta;
      if (q.Qc < 0) ac.nRet++;
      if (q.Qb > 0) ac.Qbin += q.Qb; else ac.Qbout -= q.Qb;
      ac.zMax = Math.max(ac.zMax, q.z); ac.Smax = Math.max(ac.Smax, q.S);
      avanzar(p, sim, 1800);
      sim.t += 1800;
    }
    const n = ac.n;
    const Qd = (ac.Qr + ac.QcIn + ac.Qll) / n;
    const Qm = ac.Qbin / n;
    meses.push({
      mes: MESES[k], Qr: ac.Qr / n, Qc: ac.Qc / n, QcIn: ac.QcIn / n, QcOut: ac.QcOut / n, fRet: ac.nRet / n, diasRet: ac.nRet / 48,
      Qbin: Qm, Qbout: ac.Qbout / n, Qe: ac.Qe / n, Qll: ac.Qll / n, H: ac.H / n, U: ac.U / n, dEta: ac.dEta / n,
      z: ac.z / n, zMax: ac.zMax, S: ac.S / n, Smax: ac.Smax, Seq: M.salinidadEquilibrio(p.Smar, Qm, Qd, ac.Qe / n),
    });
  }
  return meses;
}

let memo = { clave: '', valor: null };
/** Año de régimen: un año de arranque y un año medido. */
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memo.clave === clave) return memo.valor;
  const { Ac, s } = geometria(p);
  const V0 = M.volumenCienaga(1.4 - p.zFondo - 1.4 + 1.5, Ac, s);
  const sim = { V: V0, Msal: 20 * V0, t: 0 };
  simularAno(p, sim);
  sim.t = 0;
  const inicio = { V: sim.V, Msal: sim.Msal };
  const meses = simularAno(p, sim);
  const valor = {
    meses, inicio,
    Smax: Math.max(...meses.map((m) => m.Smax)), Smin: Math.min(...meses.map((m) => m.S)),
    zMax: Math.max(...meses.map((m) => m.zMax)),
    Qd: meses.reduce((a, m) => a + m.Qr + m.QcIn + m.Qll, 0) / 12,
    Qm: meses.reduce((a, m) => a + m.Qbin, 0) / 12,
    Qe: meses.reduce((a, m) => a + m.Qe, 0) / 12,
    Qr: meses.reduce((a, m) => a + m.Qr, 0) / 12,
    Qc: meses.reduce((a, m) => a + m.Qc, 0) / 12,
    QcIn: meses.reduce((a, m) => a + m.QcIn, 0) / 12,
    QcOut: meses.reduce((a, m) => a + m.QcOut, 0) / 12,
    Qsale: meses.reduce((a, m) => a + m.Qbout, 0) / 12,
    diasRetorno: meses.reduce((a, m) => a + m.diasRet, 0),
    mesesRetorno: meses.filter((m) => m.Qc < 0).map((m) => m.mes),
  };
  memo = { clave, valor };
  return valor;
}

export function estadoInicial(p) {
  const a = anoMensual(p);
  return { V: a.inicio.V, Msal: a.inicio.Msal, t: 0 };
}

/** Estado del año de régimen en un día y una hora (se avanza el reloj desde el 1 de enero). */
export function estadoEnDia(p, dia, hora = 6) {
  const sim = estadoInicial(p);
  const t = (dia - 1) * M.SEG_DIA + hora * 3600;
  avanzar(p, sim, t);
  sim.t = t;
  return sim;
}

/** Calidad: fósforo, clorofila y oxígeno (con las medias del año). */
export function calidad(p, a, S, hora) {
  const { Ac, s } = geometria(p);
  const Pin = M.mezcla([[a.Qr, p.Prios], [a.QcIn, p.Pmag], [a.Qm, SITIO.PSmar]]);
  const V = M.volumenCienaga(1.5, Ac, s);
  const tau = M.tiempoResidencia(V, a.Qsale + a.QcOut) / M.SEG_ANO;
  const P = M.fosforoCienaga(Pin, tau);
  const Chl = M.clorofila(P);
  const Tagua = p.Taire + 1;
  const ODsat = M.odSaturacion(Tagua, S);
  const A = Math.min(0.9 * ODsat, 0.06 * Chl);
  const D = 0.5 + 0.03 * Chl;
  const ODm = ODsat - D;
  return { Pin, tau, P, Chl, Tagua, ODsat, A, D, ODm, OD: Math.max(0, M.oxigenoHora(ODm, A, hora)), ODmin: Math.max(0, ODm - A), ODmax: ODm + A };
}

/** Sedimento que llega y se queda. */
export function sedimentos(p, a) {
  const { Ac, s } = geometria(p);
  const A = M.areaCienaga(1.5, Ac, s);
  const carga = ((a.Qr * p.SSrios + a.QcIn * p.SSmag) * M.SEG_ANO) / 1e6;   // t/año (mg/L × m³/s = g/s)
  const Qagua = a.Qd;
  const granos = [
    { nombre: 'Arena fina', d: 0.0001, f: 0.15 }, { nombre: 'Limo grueso', d: 0.00003, f: 0.35 },
    { nombre: 'Limo fino', d: 0.000008, f: 0.3 }, { nombre: 'Arcilla', d: 0.000002, f: 0.2 },
  ].map((g) => { const vs = M.velocidadCaida(g.d, p.Taire + 1); return { ...g, vs, ret: M.fraccionRetenida(vs, A, Qagua) }; });
  const TE = granos.reduce((x, g) => x + g.f * g.ret, 0);
  const mm = M.tasaDeposito(carga, TE, SITIO.rhoB, A);
  return { carga, granos, TE, mm, anos10cm: mm > 0 ? 100 / mm : Infinity, A };
}

export function calcular(p, sim) {
  const t = sim.t ?? 0;
  const hora = (t / 3600) % 24;
  const q = caudales(p, sim);
  const a = anoMensual(p);
  const fecha = fechaDeDia(q.d);
  const ca = calidad(p, a, q.S, hora);
  const sed = sedimentos(p, a);
  const { Ac, s } = geometria(p);
  const Ssuelo = M.salinidadSuelo(q.S);
  const SsueloMax = M.salinidadSuelo(a.Smax);
  const salud = M.saludManglar(Ssuelo);
  const saludPeor = M.saludManglar(SsueloMax);
  const especies = Object.fromEntries(Object.entries(M.ESPECIES).map(([k, e]) => [k, { ...e, estres: M.estres(Ssuelo, e.Sopt, e.Smax), estresPeor: M.estres(SsueloMax, e.Sopt, e.Smax) }]));
  const pesca = M.indicePesca(q.S, ca.ODmin);
  const mesAhora = a.meses[fecha.mes];
  const Qd = q.Qr + Math.max(0, q.Qc) + q.Qll;
  const tauDias = M.tiempoResidencia(sim.V, a.Qsale + a.QcOut) / M.SEG_DIA;
  const r = {
    t, hora, fecha, q, a, ca, sed, Ssuelo, SsueloMax, salud, saludPeor, especies, pesca, mesAhora, Qd, tauDias,
    V: sim.V, A: q.A, h: q.h, z: q.z, S: q.S,
    F: M.numeroForma(amplitudes(p)), tipoMarea: M.tipoMarea(M.numeroForma(amplitudes(p))),
    rangoMarea: 2 * (p.K1 + p.O1 + p.M2 + p.S2),
    areaBoca: areaBoca(p), areaCano: areaCanos(p),
    margenPalafitos: p.pisoPalafitos - a.zMax,
    retorno: {
      ahora: q.Qc < 0, Q: Math.max(0, -q.Qc), dias: a.diasRetorno, meses: a.mesesRetorno,
      volumen: (a.QcOut * M.SEG_ANO) / 1e6, toma: (a.QcIn * M.SEG_ANO) / 1e6,
    },
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const rio = [], cie = [], mar = [], sal = [], man = [], cal = [], sed = [];
  const { a } = r;
  revisar(rio, 'En el año los caños traen del Magdalena más agua de la que devuelven (intercambio neto > 0)', a.Qc > 1, `entran ${fmt(a.QcIn, 1)} y vuelven al río ${fmt(a.QcOut, 1)} m³/s: neto ${fmt(a.Qc, 1)} m³/s`, { corregir: 'Dragar los caños y quitar los tapones de sedimento y los diques.' });
  revisar(rio, 'Agua dulce del año ≥ evaporación del año', a.Qd >= a.Qe, `${fmt(a.Qd, 1)} ≥ ${fmt(a.Qe, 1)} m³/s`, { corregir: 'Más agua dulce: caños abiertos y ríos de la Sierra sin desviar para el riego.' });
  revisar(cie, 'Nivel máximo del año ≤ piso de los palafitos − 0.30 m', r.margenPalafitos >= 0.3, `${fmt(a.zMax, 2)} m.s.n.m. (piso a ${fmt(p.pisoPalafitos, 2)} m)`, { corregir: 'Subir los pisos de los palafitos o prepararse para las crecientes.' });
  revisar(cie, 'Tiempo de residencia ≤ 120 días (la ciénaga se renueva)', r.tauDias <= 120, `${fmt(r.tauDias, 0)} días`, { nivelFalla: 'aviso', corregir: 'Con más intercambio (caños y boca) el agua se renueva más rápido.' });
  revisar(mar, 'Boca abierta: sección ≥ 300 m²', r.areaBoca >= 300, `${fmt(r.areaBoca, 0)} m²`, { corregir: 'Dragar la Boca de la Barra y abrir alcantarillas bajo la carretera.' });
  revisar(mar, 'Intercambio con el mar ≥ 50 m³/s (entra agua de mar)', a.Qm >= 50, `${fmt(a.Qm, 1)} m³/s`, { nivelFalla: 'aviso', corregir: 'Sin intercambio con el mar la ciénaga se estanca.' });
  revisar(sal, 'Salinidad máxima del año ≤ 40 PSU (no hipersalina)', a.Smax <= 40, `${fmt(a.Smax, 1)} PSU`, { corregir: 'Más agua dulce en la temporada seca: caños abiertos.' });
  revisar(sal, 'Salinidad mínima del año ≥ 2 PSU (sigue siendo estuario)', a.Smin >= 2, `${fmt(a.Smin, 1)} PSU`, { nivelFalla: 'aviso', corregir: 'Con demasiada agua dulce cambian las especies del estuario.' });
  revisar(man, 'Salud del manglar en el peor mes ≥ 80 %', r.saludPeor >= 0.8, `${fmt(100 * r.saludPeor, 0)} % (suelo a ${fmt(r.SsueloMax, 1)} PSU)`, { corregir: 'Bajar la salinidad del suelo con agua dulce: el mangle rojo es el primero en morir.' });
  revisar(man, 'Estrés del mangle rojo en el peor mes ≤ 25 % (se recupera con las aguas altas)', r.especies.rojo.estresPeor <= 0.25, `${fmt(100 * r.especies.rojo.estresPeor, 0)} % de estrés`, { nivelFalla: 'aviso', corregir: 'El suelo pasó de 46 PSU en el estiaje: más agua dulce en la temporada seca (caños abiertos y ríos de la Sierra sin desviar).' });
  revisar(man, 'Índice de pesca ≥ 0.6', r.pesca >= 0.6, `${fmt(r.pesca, 2)}`, { nivelFalla: 'aviso', corregir: 'La pesca rinde más entre 5 y 25 PSU y con oxígeno suficiente.' });
  revisar(cal, 'Oxígeno mínimo de la madrugada ≥ 2 mg/L (sin mortandad de peces)', r.ca.ODmin >= 2, `${fmt(r.ca.ODmin, 2)} mg/L`, { corregir: 'Bajar los nutrientes del Magdalena y de los ríos: tratar las aguas residuales de la cuenca.' });
  revisar(cal, 'Clorofila ≤ 40 µg/L', r.ca.Chl <= 40, `${fmt(r.ca.Chl, 1)} µg/L`, { nivelFalla: 'aviso', corregir: 'Menos fósforo: menos algas.' });
  revisar(sed, 'Sedimentación ≤ 5 mm/año', r.sed.mm <= 5, `${fmt(r.sed.mm, 2)} mm/año`, { nivelFalla: 'aviso', corregir: 'Controlar la erosión en la cuenca del Magdalena y de la Sierra.' });
  return { rios: rio, cienaga: cie, mar, salinidad: sal, manglar: man, calidad: cal, sedimentos: sed };
}
