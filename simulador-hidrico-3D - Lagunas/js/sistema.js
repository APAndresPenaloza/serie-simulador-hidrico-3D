/**
 * sistema.js — Une el modelo de la laguna en un solo cálculo, con el reloj simulado y la
 * revisión de los criterios. Funciones puras: el panel, la escena y las pruebas las usan.
 *
 * Estado dinámico (sim): nivel h [m], agua guardada en el suelo del páramo S [mm], cobertura
 * de plantas sumergidas V [0–1] y, si ocurre, el vaciado súbito de la laguna. El reloj empieza
 * el 1 de enero a las 06:00, al comienzo de la temporada seca del Caribe.
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, INICIO_MES, fechaDeDia } from './nucleo/formato.js';

// ── Sitio y valores de referencia (editables) ──────────────────────────────
export const SITIO = {
  nombre: 'Laguna glaciar del páramo de la Sierra Nevada de Santa Marta',
  latitud: 10.85,
  altitudGlaciar: 4900,     // frente del glaciar [m.s.n.m.]
  alturaToma: 2,            // la toma del acueducto está 2 m por debajo del umbral
  rVegetacion: 0.05,        // rapidez con que las plantas se acercan al equilibrio [1/día]
  pHill: 8,                 // exponente de la función de Hill de las plantas
  kc: 0.02,                 // turbidez por cada µg/L de clorofila [m²/mg]
  ks: 0.05,                 // turbidez por cada mg/L de sedimento en suspensión [L/(mg·m)]
  SSmax: 30,                // sedimento que levantan las olas donde alcanzan el fondo [mg/L]
  fCaudalEco: 0.25,         // caudal ecológico: fracción del caudal medio de salida
};

/** Fracción de la lluvia del año que cae cada mes en la alta montaña (régimen bimodal del Caribe). */
export const FRACCION_LLUVIA = [0.02, 0.02, 0.03, 0.06, 0.11, 0.09, 0.08, 0.10, 0.13, 0.15, 0.13, 0.08];

/** Clima del año: lluvia frente a un año normal y anomalía de temperatura. */
export const CLIMAS = {
  normal: { nombre: 'Año normal', fLluvia: 1, dT: 0 },
  nino: { nombre: 'El Niño (año seco y cálido)', fLluvia: 0.6, dT: 0.8 },
  nina: { nombre: 'La Niña (año lluvioso y frío)', fLluvia: 1.5, dT: -0.5 },
};

/**
 * Estado del páramo: k es el tiempo de respuesta del suelo (embalse lineal), c la parte de la
 * lluvia que llega a la laguna, niebla el agua extra que capturan los frailejones y fRend
 * cuánto se multiplica el sedimento que suelta el suelo.
 */
export const ESTADOS_PARAMO = {
  conservado: { nombre: 'Conservado (frailejones y musgos)', k: 60, c: 0.65, niebla: 0.10, fRend: 1 },
  intervenido: { nombre: 'Intervenido (pastoreo y quemas ocasionales)', k: 30, c: 0.62, niebla: 0.05, fRend: 3 },
  degradado: { nombre: 'Degradado (suelo compactado y quemado)', k: 12, c: 0.58, niebla: 0, fRend: 10 },
};

/** Usos del suelo: fósforo que exporta [kg/ha·año] y sedimento [t/ha·año] (valores de referencia). */
export const USOS = {
  paramo: { nombre: 'Páramo natural', P: 0.05, sed: 0.1 },
  potrero: { nombre: 'Potrero con ganado', P: 0.4, sed: 1 },
  papa: { nombre: 'Cultivo de papa', P: 1.0, sed: 10 },
};
export const P_TRUCHA = 10;   // kg de fósforo por tonelada de trucha producida (alimento)

/** Clases de grano del sedimento que llega (fracción de la carga). */
export const GRANOS = [
  { nombre: 'Arena fina', d: 0.0001, f: 0.20 },
  { nombre: 'Limo grueso', d: 0.00003, f: 0.30 },
  { nombre: 'Limo fino', d: 0.000008, f: 0.30 },
  { nombre: 'Arcilla', d: 0.000002, f: 0.15 },
  { nombre: 'Coloides', d: 0.0000007, f: 0.05 },
];

export const CIERRES = {
  roca: { nombre: 'Umbral de roca (estable)' },
  morrena: { nombre: 'Dique de morrena (puede romperse)' },
};

export const PARAMETROS = {
  escenario: 'base',
  // Clima y glaciar
  clima: 'normal',
  lluviaAnual: 1300,          // mm (año normal)
  altitud: 4300,              // m.s.n.m.
  Tmar: 27.6,                 // °C a nivel del mar
  gradiente: 0.0055,          // °C/m
  amplitudDiaria: 9,          // °C entre la mínima y la máxima del día
  calentamiento: 0,           // °C sobre el clima de hoy
  areaGlaciar: 0.25,          // km²
  DDF: 7,                     // mm/(°C·día)
  perdidaGlaciar: 4,          // % del área al año
  tendenciaCalor: 0.02,       // °C/año
  anosFuturo: 0,              // años desde hoy para el glaciar
  // Páramo
  areaCuenca: 3.5,            // km²
  estadoParamo: 'conservado',
  areaPotrero: 20,            // ha
  areaPapa: 0,                // ha
  // Laguna
  areaUmbral: 12,             // ha (espejo con el agua en el umbral)
  profUmbral: 6,              // m (profundidad máxima con el agua en el umbral)
  anchoVertedero: 3,          // m
  Cvertedero: 1.7,            // coeficiente del vertedero (SI)
  extraccion: 4,              // L/s para el acueducto veredal
  infiltracion: 1,            // mm/día
  rhoB: 1.2,                  // densidad del sedimento depositado [t/m³]
  // Calidad
  truchas: 0,                 // t/año en jaulas
  kw: 0.30,                   // turbidez del agua sola y del color húmico [1/m]
  hv: 0.2,                    // cobertura con la que las plantas reducen la turbidez a la mitad
  fLuzPlantas: 20,            // % de la luz que necesitan las plantas en el fondo medio
  // Viento
  viento: 6,                  // m/s
  // Amenazas
  cierre: 'roca',
  distanciaPueblo: 12,        // km
  velocidadOnda: 3,           // m/s
  atenuacion: 30,             // km
  cauceAncho: 5, cauceProf: 1.0, cauceTalud: 1.5, cauceN: 0.045, caucePend: 0.02,
};

export const ESCENARIOS = {
  base: { nombre: 'Laguna de referencia (año normal, páramo conservado)', cambios: {} },
  nino: { nombre: 'Sequía de El Niño', cambios: { clima: 'nino' } },
  nina: { nombre: 'Lluvias de La Niña', cambios: { clima: 'nina' } },
  degradado: { nombre: 'Páramo degradado por ganadería y quemas', cambios: { estadoParamo: 'degradado', areaPotrero: 120 } },
  papa: { nombre: 'Papa en la cuenca', cambios: { estadoParamo: 'intervenido', areaPapa: 60 } },
  truchas: { nombre: 'Jaulas de trucha en la laguna', cambios: { truchas: 25 } },
  turbia: { nombre: 'Laguna turbia: truchas y plantas arrancadas', cambios: { truchas: 25 }, sim: () => ({ V: 0.02 }) },
  glaciar2050: { nombre: 'El glaciar en 2050', cambios: { anosFuturo: 25 } },
  morrena: { nombre: 'Laguna represada por una morrena', cambios: { cierre: 'morrena' } },
  extraccion: { nombre: 'Más agua para el acueducto', cambios: { extraccion: 30 } },
  sequia2066: { nombre: 'El Niño en 2066: sin glaciar y con más toma', cambios: { clima: 'nino', anosFuturo: 40, extraccion: 45 } },
};

// ── Ayudas ─────────────────────────────────────────────────────────────────
export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
export const paramo = (p) => ESTADOS_PARAMO[p.estadoParamo] ?? ESTADOS_PARAMO.conservado;
export const geometria = (p) => ({ Au: M.haAm2(p.areaUmbral), hu: p.profUmbral });
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;
const horaDelDia = (t) => (t / 3600) % 24;

/** Lluvia del mes k [mm] con el clima del año. */
export const lluviaMes = (p, k) => p.lluviaAnual * clima(p).fLluvia * FRACCION_LLUVIA[k];
/** Lluvia del día d del año [mm/día] (uniforme dentro del mes). */
export const lluviaDia = (p, d) => { const { mes } = fechaDeDia(d); return lluviaMes(p, mes) / DIAS_MES[mes]; };
/** Lluvia que se vuelve agua en el suelo del páramo [mm/día]: R = c·P·(1 + niebla). */
export const lluviaEfectiva = (p, d) => { const e = paramo(p); return e.c * lluviaDia(p, d) * (1 + e.niebla); };

/** Temperaturas: de la laguna, del frente del glaciar y del agua (media) [°C]. */
export function temperaturas(p) {
  const dT = clima(p).dT + p.calentamiento + p.tendenciaCalor * p.anosFuturo;
  const Tl = M.temperaturaAltitud(p.altitud, p.Tmar, p.gradiente) + dT;
  const Tg = M.temperaturaAltitud(SITIO.altitudGlaciar, p.Tmar, p.gradiente) + dT;
  return { dT, Tl, Tg, Tagua: Math.max(0.5, Tl + 0.5) };
}

/** Evaporación del espejo de agua del día d [mm/día]: 1.05·ET₀ de Hargreaves. */
export function evaporacion(p, d) {
  const { Tl } = temperaturas(p);
  const Ra = M.radiacionExtraterrestre(SITIO.latitud, d);
  const ET0 = M.hargreaves(Tl, p.amplitudDiaria, Ra);
  return { Ra, ET0, E: 1.05 * ET0 };
}

/** Glaciar con los años futuros: área, derretimiento y caudal. */
export function glaciar(p) {
  const { Tg } = temperaturas(p);
  const lambda = p.perdidaGlaciar / 100;
  const A = M.areaGlaciar(p.areaGlaciar, lambda, p.anosFuturo);   // km²
  const Mm = M.derretimiento(Tg, p.DDF);                            // mm/día
  const Q = M.mmDiaAm3s(Mm, M.km2Am2(A));
  const base = { T0: M.temperaturaAltitud(SITIO.altitudGlaciar, p.Tmar, p.gradiente) + clima(p).dT + p.calentamiento, w: p.tendenciaCalor, A0: M.km2Am2(p.areaGlaciar), lambda, DDF: p.DDF };
  const tPico = M.picoDeshielo(base);
  return { A, Tg, M: Mm, Q, lambda, tPico, Qpico: M.deshieloFuturo(base, Math.max(0, tPico)), anos1: M.anosHastaFraccion(lambda, 0.01), base };
}

/** Áreas de la cuenca por uso [ha]. */
export function usos(p) {
  const total = p.areaCuenca * 100;
  const potrero = Math.min(p.areaPotrero, total);
  const papa = Math.min(p.areaPapa, total - potrero);
  return { total, potrero, papa, paramo: total - potrero - papa };
}

/** Cargas de fósforo [kg/año] y de sedimento [t/año] de la cuenca y de las jaulas. */
export function cargas(p) {
  const u = usos(p);
  const e = paramo(p);
  const P = {
    paramo: u.paramo * USOS.paramo.P,
    potrero: u.potrero * USOS.potrero.P,
    papa: u.papa * USOS.papa.P,
    truchas: p.truchas * P_TRUCHA,
  };
  const S = {
    paramo: u.paramo * USOS.paramo.sed * e.fRend,
    potrero: u.potrero * USOS.potrero.sed * e.fRend,
    papa: u.papa * USOS.papa.sed,
  };
  return { u, P, Ptotal: P.paramo + P.potrero + P.papa + P.truchas, S, Stotal: S.paramo + S.potrero + S.papa };
}

/** Caudal medio de un año que entra a la laguna desde el páramo [m³/s] (sin pérdidas en el camino). */
export function caudalMedioParamo(p) {
  const e = paramo(p);
  return M.mmDiaAm3s((e.c * p.lluviaAnual * clima(p).fLluvia * (1 + e.niebla)) / 365, M.km2Am2(p.areaCuenca));
}

/** Balance medio del año para el tiempo de residencia, el fósforo y el caudal ecológico. */
export function balanceMedio(p) {
  const { Au, hu } = geometria(p);
  const Qp = caudalMedioParamo(p);
  const Qg = glaciar(p).Q;
  const Eanual = Array.from({ length: 12 }, (_, k) => evaporacion(p, INICIO_MES[k] + 14).E * DIAS_MES[k]).reduce((a, b) => a + b, 0);
  const Qlluvia = M.mmDiaAm3s((p.lluviaAnual * clima(p).fLluvia) / 365, Au);
  const Qevap = M.mmDiaAm3s(Eanual / 365, Au);
  const Qinf = M.mmDiaAm3s(p.infiltracion, Au);
  const Qext = p.extraccion / 1000;
  const Qin = Qp + Qg + Qlluvia;
  const Qsale = Math.max(0, Qin - Qevap - Qinf - Qext);
  return { Qp, Qg, Qlluvia, Qevap, Qinf, Qext, Qin, Qsale, Eanual, Vin: (Qp + Qg) * M.SEG_ANO };
}

/**
 * Calidad del agua: fósforo, clorofila, turbidez sin plantas (E₀), umbral de las plantas y
 * turbidez con la cobertura V de ahora.
 */
export function calidad(p, h, Vplantas, bal = balanceMedio(p), olas = oleaje(p, h), conEquilibrios = true) {
  const c = cargas(p);
  const { Au, hu } = geometria(p);
  const Vlag = M.volumenLaguna(hu, Au, hu);
  const tau = bal.Qsale > 0 ? M.tiempoResidencia(Vlag, bal.Qsale) / M.SEG_ANO : 50;
  const Pin = M.fosforoEntrada(c.Ptotal, bal.Vin);
  const P = M.fosforoLaguna(Pin, tau);
  const Chl = M.clorofila(P);
  const sed = sedimentos(p, h, bal);
  const SSviento = SITIO.SSmax * olas.fFondo * (1 - 0.8 * Math.min(1, Vplantas));
  const SS = sed.SSsale + SSviento;
  const E0 = p.kw + SITIO.kc * Chl + SITIO.ks * (sed.SSsale + SITIO.SSmax * olas.fFondo);
  const zMedia = M.profundidadMedia(Math.max(h, 0.2));
  const he = M.turbidezCritica(zMedia, p.fLuzPlantas / 100);
  const kd = M.turbidezConPlantas(Vplantas, E0, p.kw, p.hv);
  const Veq = M.plantasEquilibrio(kd, he, SITIO.pHill);
  const eq = conEquilibrios ? M.equilibriosScheffer(E0, p.kw, p.hv, he, SITIO.pHill) : [];
  const DS = M.secchi(kd);
  const tsi = { SD: M.tsiSecchi(DS), Chl: M.tsiClorofila(Chl), P: M.tsiFosforo(P) };
  tsi.medio = (tsi.SD + tsi.Chl + tsi.P) / 3;
  return { c, tau, Pin, P, Chl, SS, SSviento, E0, zMedia, he, kd, V: Vplantas, Veq, eq, DS, zEu: M.zonaFotica(kd), luzFondoMedio: M.fraccionLuz(kd, zMedia), luzFondo: M.fraccionLuz(kd, h), tsi, clase: M.claseTrofica(tsi.medio), estado: Vplantas >= 0.5 ? 'clara' : 'turbia' };
}

/** Oleaje con el viento: el fetch es el diámetro del espejo de agua. */
export function oleaje(p, h) {
  const { Au, hu } = geometria(p);
  const A = M.areaEspejo(h, Au, hu);
  const F = 2 * M.radioEspejo(A);
  const H = M.alturaOla(p.viento, F);
  const T = M.periodoOla(p.viento, F);
  const L = M.longitudOla(T);
  const base = M.baseOleaje(L);
  return { A, F, H, T, L, base, fFondo: M.fraccionFondoRemovido(base, h) };
}

/** Sedimento: carga, retención por clase de grano (Stokes), colmatación y vida útil. */
export function sedimentos(p, h, bal = balanceMedio(p)) {
  const c = cargas(p);
  const { Au, hu } = geometria(p);
  const T = temperaturas(p).Tagua;
  const A = M.areaEspejo(Math.max(h, 0.2), Au, hu);
  const Qmed = bal.Qp + bal.Qg;
  const granos = GRANOS.map((g) => {
    const vs = M.velocidadCaida(g.d, T);
    return { ...g, vs, ret: M.fraccionRetenida(vs, A, Qmed) };
  });
  const TE = granos.reduce((s, g) => s + g.f * g.ret, 0);
  const Cin = bal.Vin > 0 ? (c.Stotal * 1e9) / (bal.Vin * 1000) : 0;   // mg/L
  const dV = M.volumenColmatado(c.Stotal, TE, p.rhoB);
  const V = M.volumenLaguna(hu, Au, hu);
  return {
    granos, TE, Cin, SSsale: Cin * (1 - TE), carga: c.Stotal, rendimiento: c.Stotal / (p.areaCuenca * 100),
    dV, fraccionAno: dV / V, mmAno: (1000 * dV) / Au, vidaUtil: dV > 0 ? V / dV : Infinity, Kstokes: M.constanteStokes(T),
  };
}

/** Vaciado súbito (solo si la laguna está represada por una morrena). */
export function amenaza(p, h) {
  const { Au, hu } = geometria(p);
  const V = M.volumenLaguna(h, Au, hu);
  const Vbrecha = V - M.volumenLaguna(hu * 0.5, Au, hu);   // la brecha baja hasta la mitad de la profundidad
  const Qp = M.caudalVaciado(Vbrecha);
  const Qpueblo = M.atenuacion(Qp, p.distanciaPueblo, p.atenuacion);
  const tViaje = (p.distanciaPueblo * 1000) / p.velocidadOnda;
  const capacidad = M.capacidadCauce(p.cauceAncho, p.cauceProf, p.cauceTalud, p.cauceN, p.caucePend);
  const tp = M.tiempoPicoVaciado(Vbrecha, Qp);
  return { morrena: p.cierre === 'morrena', Vbrecha, Qp, Qpueblo, tViaje, capacidad, desborda: Qpueblo > capacidad, tp };
}

// ── Estado inicial y avance del reloj ──────────────────────────────────────
export function estadoInicial(p) {
  const e = paramo(p);
  // El suelo del páramo empieza en equilibrio con la lluvia de diciembre
  const S = lluviaEfectiva(p, 350) * e.k;
  const { Au, hu } = geometria(p);
  // El nivel empieza en equilibrio: la lámina sobre el umbral deja salir lo que entra
  const Qp0 = M.mmDiaAm3s(M.salidaParamo(S, e.k), M.km2Am2(p.areaCuenca));
  const ev = evaporacion(p, 1);
  const neto0 = Qp0 + glaciar(p).Q + M.mmDiaAm3s(lluviaDia(p, 1) - ev.E - p.infiltracion, Au) - p.extraccion / 1000;
  const h0 = hu + M.laminaVertedero(Math.max(0, neto0), p.Cvertedero, p.anchoVertedero);
  const q = calidad(p, h0, 1);
  // Las plantas empiezan en el equilibrio más claro posible
  const V = q.eq.find((x) => x.estable)?.V ?? 1;
  return { h: h0, S, V, glof: null, t: 0 };
}

/** Caudales instantáneos de la laguna con el estado actual [m³/s]. */
export function caudales(p, sim) {
  const { Au, hu } = geometria(p);
  const d = diaDelAno(sim.t);
  const e = paramo(p);
  const h = sim.h;
  const A = M.areaEspejo(h, Au, hu);
  const ev = evaporacion(p, d);
  const Qp = M.mmDiaAm3s(M.salidaParamo(sim.S, e.k), M.km2Am2(p.areaCuenca));
  const Qg = glaciar(p).Q;
  const Qlluvia = M.mmDiaAm3s(lluviaDia(p, d), A);
  const Qevap = M.mmDiaAm3s(ev.E, A);
  const Qinf = M.mmDiaAm3s(p.infiltracion, A);
  const hToma = hu - SITIO.alturaToma;
  const Qext = h > hToma ? p.extraccion / 1000 : 0;
  const Qvert = M.vertedero(h, hu, p.Cvertedero, p.anchoVertedero);
  let Qglof = 0;
  if (sim.glof) Qglof = M.hidrogramaVaciado(sim.glof.Qp, sim.glof.tp, sim.t - sim.glof.t0);
  const Qin = Qp + Qg + Qlluvia;
  const Qneto = Qin - Qevap - Qinf - Qext - Qvert - Qglof;
  return { d, A, ev, Qp, Qg, Qlluvia, Qevap, Qinf, Qext, Qvert, Qglof, Qin, Qneto, hToma };
}

/** Avanza el estado dt segundos (pasos internos de 30 min como máximo). */
export function avanzar(p, sim, dt) {
  const { Au, hu } = geometria(p);
  const e = paramo(p);
  let resta = dt;
  while (resta > 1e-9) {
    const h = Math.min(1800, resta);
    const d = diaDelAno(sim.t + (dt - resta));
    const q = caudales(p, { ...sim, t: sim.t + (dt - resta) });
    sim.S = M.pasoParamo(sim.S, lluviaEfectiva(p, d), e.k, h / M.SEG_DIA);
    let V = M.volumenLaguna(sim.h, Au, hu) + q.Qneto * h;
    if (sim.glof) {
      const fondo = sim.glof.hFinal;
      if (sim.h <= fondo + 1e-3 || sim.t + (dt - resta) - sim.glof.t0 > 8 * sim.glof.tp) sim.glof = null;
      V = Math.max(V, M.volumenLaguna(fondo, Au, hu) * (sim.glof ? 1 : 0));
    }
    sim.h = Math.max(0.05, M.nivelDeVolumen(V, Au, hu));
    const ca = calidad(p, sim.h, sim.V, balanceMedio(p), oleaje(p, sim.h), false);
    sim.V = M.pasoPlantas(sim.V, ca.E0, p.kw, p.hv, ca.he, SITIO.rVegetacion, h / M.SEG_DIA, SITIO.pHill);
    resta -= h;
  }
}

/** Inicia el vaciado súbito (solo con dique de morrena). */
export function iniciarVaciado(p, sim) {
  if (p.cierre !== 'morrena' || sim.glof) return false;
  const a = amenaza(p, sim.h);
  sim.glof = { t0: sim.t, Qp: a.Qp, tp: a.tp, hFinal: geometria(p).hu * 0.5 };
  return true;
}

// ── Un año mes a mes (y la frontera mensual del sistema conectado) ──────────
let memoAno = { clave: '', valor: null };
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memoAno.clave === clave) return memoAno.valor;
  const sim = estadoInicial(p);
  sim.t = 0;
  const meses = [];
  for (let k = 0; k < 12; k++) {
    const acum = { Qp: 0, Qg: 0, Qvert: 0, Qext: 0, dias: 0, diasRebose: 0, hMin: Infinity };
    for (let j = 0; j < DIAS_MES[k]; j++) {
      const q = caudales(p, sim);
      acum.Qp += q.Qp; acum.Qg += q.Qg; acum.Qvert += q.Qvert; acum.Qext += q.Qext; acum.dias += 1;
      if (q.Qvert > 1e-6) acum.diasRebose += 1;
      avanzar(p, sim, M.SEG_DIA);
      sim.t += M.SEG_DIA;
      acum.hMin = Math.min(acum.hMin, sim.h);
    }
    meses.push({
      mes: MESES[k], lluvia: lluviaMes(p, k), Qp: acum.Qp / acum.dias, Qg: acum.Qg / acum.dias, Qsale: acum.Qvert / acum.dias,
      Qext: acum.Qext / acum.dias, h: sim.h, hMin: acum.hMin, diasRebose: acum.diasRebose, V: sim.V,
    });
  }
  const valor = { meses, mesesSinRebose: meses.filter((m) => m.diasRebose === 0).map((m) => m.mes), hMin: Math.min(...meses.map((m) => m.hMin)) };
  memoAno = { clave, valor };
  return valor;
}

// ── Cálculo completo ───────────────────────────────────────────────────────
export function calcular(p, sim) {
  const { Au, hu } = geometria(p);
  const t = sim.t ?? 0;
  const d = diaDelAno(t);
  const hora = horaDelDia(t);
  const fecha = fechaDeDia(d);
  const temp = temperaturas(p);
  const ev = evaporacion(p, d);
  const gl = glaciar(p);
  const e = paramo(p);
  const bal = balanceMedio(p);
  const q = caudales(p, sim);
  const h = sim.h;
  const A = q.A;
  const V = M.volumenLaguna(h, Au, hu);
  const Vu = M.volumenLaguna(hu, Au, hu);
  const olas = oleaje(p, h);
  const ca = calidad(p, h, sim.V, bal, olas);
  const sed = sedimentos(p, h, bal);
  const am = amenaza(p, h);
  const ano = anoMensual(p);

  // Páramo: caudal que suelta hoy, recesión si dejara de llover y caudal al final del verano
  const Rhoy = lluviaEfectiva(p, d);
  const QpMedio = bal.Qp;
  let Sver = estadoInicial(p).S;
  for (let k = 0; k < 3; k++) Sver = M.pasoParamo(Sver, lluviaEfectiva(p, INICIO_MES[k] + 1), e.k, DIAS_MES[k]);
  const QfinVerano = M.mmDiaAm3s(M.salidaParamo(Sver, e.k), M.km2Am2(p.areaCuenca));
  const recesion30 = M.recesion(q.Qp, e.k, 30);

  // Laguna: tendencia, rebose, toma y autonomía
  const Qeco = SITIO.fCaudalEco * bal.Qsale;
  const dhdt = M.pendienteNivel(q.Qneto, A);
  const sinLluvia = q.Qevap + q.Qinf + p.extraccion / 1000;   // si dejara de entrar agua
  const autonomia = M.diasEntreNiveles(Math.max(h, q.hToma), q.hToma, -sinLluvia, Au, hu);
  const tauDias = q.Qvert + q.Qext + q.Qevap + q.Qinf > 0 ? V / (q.Qvert + q.Qext + q.Qevap + q.Qinf) / M.SEG_DIA : Infinity;

  // Oxígeno y temperatura del agua (ciclo diario)
  const Tagua = M.temperaturaAgua(temp.Tagua, 1.5, hora);
  const ODsat = M.odSaturacion(temp.Tagua, p.altitud);
  const Dr = 0.2 + 0.08 * ca.Chl + 0.6 * (1 - ca.V) * Math.min(1, ca.Chl / 10);
  const Aod = 0.2 + 0.1 * ca.Chl;
  const ODmedio = ODsat - Dr;
  const OD = Math.max(0, M.oxigenoHora(ODmedio, Aod, hora));
  const ODmin = Math.max(0, ODmedio - Aod);
  const ODmax = ODmedio + Aod;

  // Alerta
  let alerta = 'verde';
  const motivos = [];
  if (am.morrena) { alerta = am.desborda ? 'naranja' : 'amarilla'; motivos.push('laguna represada por una morrena'); }
  if (sim.glof) { alerta = 'roja'; motivos.unshift('vaciado súbito en curso'); }
  if (h < q.hToma) { alerta = 'roja'; motivos.push('la laguna bajó de la toma del acueducto'); }
  else if (ano.mesesSinRebose.length >= 3 && alerta === 'verde') { alerta = 'amarilla'; motivos.push(`no rebosa en ${ano.mesesSinRebose.length} meses del año`); }
  if (p.clima !== 'normal' && alerta === 'verde') { alerta = 'amarilla'; motivos.push(CLIMAS[p.clima].nombre); }

  const r = {
    t, d, hora, fecha, temp, ev, gl, e, bal, q, h, A, V, Vu, olas, ca, sed, am, ano,
    paramo: { Rhoy, S: sim.S, k: e.k, Qp: q.Qp, QpMedio, QfinVerano, recesion30, usos: usos(p) },
    laguna: { Qeco, dhdt, autonomia, tauDias, zMedia: M.profundidadMedia(h), radio: M.radioEspejo(A), lamina: Math.max(0, h - hu), Hmedia: M.laminaVertedero(bal.Qsale, p.Cvertedero, p.anchoVertedero) },
    oxigeno: { Tagua, ODsat, Dr, Aod, ODmedio, OD, ODmin, ODmax, ebullicion: M.puntoEbullicion(p.altitud), presion: M.presionAtm(p.altitud) },
    alerta: { nivel: alerta, motivos },
    glof: sim.glof,
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const { ca, sed, am, bal, gl, q, ano } = r;
  const clima_ = [], par = [], lag = [], cal = [], vie = [], sedi = [], ame = [];
  const fLl = clima(p).fLluvia;
  revisar(clima_, 'Lluvia del año ≥ 70 % de la normal', fLl >= 0.7, `${fmt(100 * fLl, 0)} % (${fmt(p.lluviaAnual * fLl, 0)} mm)`, { nivelFalla: 'aviso', corregir: 'Prever reservas: con El Niño el páramo y la laguna entregan mucho menos agua.' });
  revisar(clima_, 'Glaciar: pérdida de área ≤ 5 % al año', p.perdidaGlaciar <= 5, `${fmt(p.perdidaGlaciar, 1)} % al año`, { nivelFalla: 'aviso', corregir: 'Medir el glaciar con imágenes de satélite y planear el agua sin él.' });
  const fG = bal.Qin > 0 ? gl.Q / (bal.Qp + gl.Q) : 0;
  revisar(clima_, 'El glaciar aporta ≤ 30 % del agua que entra', fG <= 0.3, `${fmt(100 * fG, 1)} %`, { nivelFalla: 'aviso', corregir: 'La laguna depende de un glaciar que desaparece: conservar el páramo para reemplazar ese aporte.' });

  revisar(par, 'Regulación del páramo: tiempo de respuesta k ≥ 30 días', r.paramo.k >= 30, `${fmt(r.paramo.k, 0)} días`, { corregir: 'Restaurar el páramo: sacar el ganado, evitar las quemas y dejar que vuelvan los frailejones y los musgos.' });
  const demanda = p.extraccion / 1000 + r.laguna.Qeco;
  revisar(par, 'Caudal del páramo al final del verano ≥ extracción + caudal ecológico', r.paramo.QfinVerano >= demanda, `${fmt(r.paramo.QfinVerano * 1000, 1)} ≥ ${fmt(demanda * 1000, 1)} L/s`, { corregir: 'Reducir la extracción en el verano o conservar el páramo para que suelte agua por más tiempo.' });
  const fNat = r.paramo.usos.paramo / r.paramo.usos.total;
  revisar(par, 'Cobertura natural del páramo ≥ 80 % de la cuenca', fNat >= 0.8, `${fmt(100 * fNat, 1)} %`, { corregir: 'Reconvertir potreros y cultivos de papa de la cuenca alta.' });

  revisar(lag, 'La laguna entrega el caudal ecológico (rebose ≥ 25 % del medio)', q.Qvert >= r.laguna.Qeco - 1e-9, `${fmt(q.Qvert * 1000, 1)} ≥ ${fmt(r.laguna.Qeco * 1000, 1)} L/s`, { corregir: 'Reducir la extracción o esperar a que suba el nivel; el arroyo de salida necesita agua.' });
  revisar(lag, 'Extracción ≤ 30 % del caudal medio que entra', p.extraccion / 1000 <= 0.3 * bal.Qin, `${fmt(p.extraccion, 1)} ≤ ${fmt(0.3 * bal.Qin * 1000, 1)} L/s`, { corregir: 'Buscar otra fuente o reducir las pérdidas del acueducto veredal.' });
  revisar(lag, 'Autonomía sin lluvia ≥ 120 días (el verano)', r.laguna.autonomia >= 120, Number.isFinite(r.laguna.autonomia) ? `${fmt(r.laguna.autonomia, 0)} días` : 'no baja', { corregir: 'Bajar la toma o reducir la extracción.' });
  revisar(lag, 'Nivel por encima de la toma del acueducto', r.h > q.hToma, `${fmt(r.h, 2)} > ${fmt(q.hToma, 2)} m`, { corregir: 'Suspender la extracción hasta que la laguna se recupere.' });
  revisar(lag, 'Rebosa todos los meses del año', ano.mesesSinRebose.length === 0, ano.mesesSinRebose.length ? `no rebosa en ${ano.mesesSinRebose.join(', ')}` : 'los 12 meses', { nivelFalla: 'aviso', corregir: 'Con El Niño o con más extracción, el arroyo de salida se seca en el verano.' });

  revisar(cal, 'Fósforo total ≤ 10 µg/L (laguna oligotrófica)', ca.P <= 10, `${fmt(ca.P, 1)} µg/L`, { corregir: 'Reducir el fósforo: quitar las jaulas de trucha y los cultivos de papa de la orilla.' });
  revisar(cal, 'Índice de Carlson < 50 (no eutrófica)', ca.tsi.medio < 50, `${fmt(ca.tsi.medio, 1)} (${ca.clase})`, { nivelFalla: ca.tsi.medio < 60 ? 'aviso' : 'alerta', corregir: 'Bajar la carga de nutrientes de la cuenca.' });
  revisar(cal, 'Estado claro: plantas sumergidas en ≥ 50 % del fondo', ca.V >= 0.5, `${fmt(100 * ca.V, 0)} %`, { corregir: 'Bajar los nutrientes mucho más que donde la laguna se enturbió (histéresis) y replantar.' });
  revisar(cal, 'Luz en el fondo medio ≥ la que necesitan las plantas', ca.luzFondoMedio >= p.fLuzPlantas / 100, `${fmt(100 * ca.luzFondoMedio, 0)} % ≥ ${fmt(p.fLuzPlantas, 0)} %`, { corregir: 'Reducir la turbidez (sedimento y algas).' });
  revisar(cal, 'Oxígeno mínimo de la madrugada ≥ 5 mg/L', r.oxigeno.ODmin >= 5, `${fmt(r.oxigeno.ODmin, 2)} mg/L`, { corregir: 'Menos algas: menos fósforo; sin jaulas de trucha.' });

  revisar(vie, 'Fondo removido por las olas ≤ 25 %', r.olas.fFondo <= 0.25, `${fmt(100 * r.olas.fFondo, 1)} %`, { nivelFalla: 'aviso', corregir: 'Las plantas sumergidas protegen el fondo del oleaje.' });

  revisar(sedi, 'Pérdida de volumen por sedimentos ≤ 0.1 % al año', sed.fraccionAno <= 0.001, `${fmt(100 * sed.fraccionAno, 3)} % al año`, { corregir: 'Controlar la erosión: coberturas, sin papa en ladera ni quemas.' });
  revisar(sedi, 'Sedimento de la cuenca ≤ 2 t/ha·año', sed.rendimiento <= 2, `${fmt(sed.rendimiento, 2)} t/ha·año`, { corregir: 'Barreras vivas, curvas de nivel y restauración del páramo.' });

  if (am.morrena) {
    revisar(ame, 'Cierre estable: sin riesgo de vaciado súbito', false, 'dique de morrena', { nivelFalla: 'aviso', corregir: 'Bajar el nivel con un canal controlado y vigilar el dique.' });
    revisar(ame, 'Si se vacía, el pico en el pueblo cabe en el cauce', !am.desborda, `${fmt(am.Qpueblo, 1)} frente a ${fmt(am.capacidad, 1)} m³/s`, { corregir: 'Sistema de alerta temprana y zonas de evacuación junto al cauce.' });
    revisar(ame, 'Tiempo de aviso al pueblo ≥ 30 min', am.tViaje >= 1800, `${fmt(am.tViaje / 60, 0)} min`, { corregir: 'Sensores en la laguna y sirenas en el pueblo.' });
  } else {
    revisar(ame, 'Cierre estable: sin riesgo de vaciado súbito', true, 'umbral de roca', {});
  }
  revisar(ame, `Nivel de alerta`, r.alerta.nivel === 'verde', `alerta ${r.alerta.nivel}${r.alerta.motivos.length ? ': ' + r.alerta.motivos.join(', ') : ''}`, { nivelFalla: r.alerta.nivel === 'roja' ? 'alerta' : 'aviso', corregir: 'Atender la causa de la alerta (vaciado, sequía o clima del año).' });

  return { clima: clima_, paramo: par, laguna: lag, calidad: cal, viento: vie, sedimentos: sedi, amenazas: ame };
}
