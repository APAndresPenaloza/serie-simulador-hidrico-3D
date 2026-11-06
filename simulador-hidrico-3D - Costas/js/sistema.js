/**
 * sistema.js — Une el modelo de la playa en un solo cálculo, con el reloj, los escenarios y la
 * revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): ancho de la playa seca W [m] y el final de una tormenta pedida con el
 * botón (tormentaHasta [s]). Con cada paso del reloj (1 h como máximo) el oleaje de fondo cambia
 * con la temporada de los alisios, la brisa con la hora, la marea con la Luna y el Sol; la arena
 * que entra y la que se lleva el oleaje a lo largo de la playa cambian el ancho, y el ascenso del
 * mar lo reduce con la regla de Bruun. El año de régimen se simula cada 2 horas.
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, fechaDeDia } from './nucleo/formato.js';

export const SITIO = {
  nombre: 'Playa de bahía del Caribe (referencia: El Rodadero, Santa Marta)',
  thetaBrisa: 20,          // ° del mar de viento local con la normal a la costa
  gpEmisario: 0.245,       // m/s²: gravedad reducida del agua residual frente al mar
  horasBano: [8, 17],
  limiteColiformes: 200,   // NMP/100 mL para contacto primario
};
const FASES = { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 };

export const CLIMAS = {
  normal: { nombre: 'Año normal', fOla: 1, fViento: 1, fAporte: 1 },
  nino: { nombre: 'El Niño (alisios más fuertes, menos arena)', fOla: 1.08, fViento: 1.15, fAporte: 0.85 },
  nina: { nombre: 'La Niña (más lluvia, más arena de los ríos)', fOla: 0.93, fViento: 0.9, fAporte: 1.15 },
};

export const PARAMETROS = {
  escenario: 'base',
  clima: 'normal',
  // Oleaje de fondo de los alisios
  Hs0: 1.1, aEst: 0.35, dEst: 40, Tp: 7.5, theta0: 3,
  // Brisa de la tarde
  U0: 5, Ua: 3, horaBrisa: 15, fetch: 30,
  // Marea
  K1: 0.09, O1: 0.07, M2: 0.06, S2: 0.02, nivelMar: 0,
  // Tormenta (evento del año)
  tormenta: false, diaTormenta: 60, duracionTormenta: 3,
  HsTormenta: 3.2, TpTormenta: 12, presionTormenta: 1008, vientoTormenta: 12,
  plataforma: 20, profPlataforma: 30,
  // La playa
  D50: 0.25, pendiente: 0.08, berma: 1.5, malecon: 2.4, He: 3.0, Te: 9,
  largo: 3000, ancho0: 40, anchoMin: 20,
  aporte: 447000,          // m³/año de arena que llegan de los ríos y de la playa vecina
  retencion: 0.15,         // parte del transporte que retienen los cabos (y el espolón)
  relleno: 0,              // m³/año
  ascensoMar: 3.3,         // mm/año
  // Uso
  areaBanista: 10, visitantes: 6000,
  // Emisario submarino
  Qemisario: 0.6, zEmisario: 40, xEmisario: 3, corriente: 0.15, C0: 1e5, T90dia: 3, T90noche: 30, Ld: 250,
};

export const ESCENARIOS = {
  base: { nombre: 'Playa de referencia (año normal)', cambios: {} },
  leva: { nombre: 'Mar de leva de tres días en marzo', cambios: { tormenta: true } },
  tormenta: { nombre: 'Tormenta tropical cercana', cambios: { tormenta: true, diaTormenta: 250, HsTormenta: 3.0, TpTormenta: 10, presionTormenta: 980, vientoTormenta: 30 } },
  nino: { nombre: 'El Niño: alisios más fuertes y menos arena', cambios: { clima: 'nino' } },
  represa: { nombre: 'Menos arena de los ríos (represas y extracción)', cambios: { aporte: 380000 } },
  espolon: { nombre: 'Espolón al final de la playa', cambios: { retencion: 0.3 } },
  relleno: { nombre: 'Menos arena de los ríos, con relleno de 80 000 m³ al año', cambios: { aporte: 380000, relleno: 80000 } },
  mar: { nombre: 'Ascenso del mar de 10 mm/año', cambios: { ascensoMar: 10 } },
  sinTratamiento: { nombre: 'Emisario con agua residual sin tratar', cambios: { C0: 1e7 } },
  emisarioCorto: { nombre: 'Emisario corto y poco profundo', cambios: { xEmisario: 0.8, zEmisario: 15 } },
};

export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;
export const amplitudes = (p) => ({ K1: p.K1, O1: p.O1, M2: p.M2, S2: p.S2 });

/** El perfil de la playa: arena, parámetro de Dean, profundidad de cierre y ancho activo. */
export function perfil(p) {
  const w = M.velocidadCaida(p.D50 / 1000);
  const A = M.parametroDean(100 * w);
  const hc = M.profundidadCierre(p.He, p.Te);
  const xc = M.distanciaDean(hc, A);
  return { w, A, hc, xc, pendienteActiva: hc / xc };
}

/** ¿Hay tormenta en el instante t? (la del año o la pedida con el botón) */
function enTormenta(p, t, sim) {
  if (sim && sim.tormentaHasta && t < sim.tormentaHasta && t >= sim.tormentaHasta - p.duracionTormenta * M.SEG_DIA) return true;
  if (!p.tormenta) return false;
  const d = (t / M.SEG_DIA) % 365;
  return d >= p.diaTormenta - 1 && d < p.diaTormenta - 1 + p.duracionTormenta;
}

/** Oleaje, rotura, corriente, transporte y nivel del instante t. */
export function forzantes(p, t, sim = null) {
  const d = diaDelAno(t);
  const hora = (t / 3600) % 24;
  const cl = clima(p);
  const fEst = 1 + p.aEst * Math.cos((2 * Math.PI * (d - p.dEst)) / 365);
  const torm = enTormenta(p, t, sim);
  const Hsw = torm ? p.HsTormenta : p.Hs0 * fEst * cl.fOla;
  const Tsw = torm ? p.TpTormenta : p.Tp;
  const U = Math.max(0, (p.U0 + p.Ua * Math.cos((2 * Math.PI * (hora - p.horaBrisa)) / 24)) * cl.fViento * (0.85 + 0.15 * fEst));
  const local = M.oleajeViento(U, p.fetch * 1000);
  const comb = M.combinar(Hsw, Tsw, local.H, local.T);
  const H0 = comb.H, T = comb.T;
  const theta0 = H0 > 0 ? (Hsw * Hsw * p.theta0 + local.H * local.H * SITIO.thetaBrisa) / (H0 * H0) : p.theta0;
  const rb = M.rotura(H0, T, theta0);
  const V = M.corrienteLitoral(rb.Hb, rb.thetab);
  const Qls = M.transporteLitoral(rb.Hb, rb.thetab);
  const eta = p.nivelMar + M.marea(t / 3600, amplitudes(p), FASES);
  const surge = torm ? M.sobreelevacionPresion(p.presionTormenta) + M.sobreelevacionViento(p.vientoTormenta, p.plataforma * 1000, p.profPlataforma) : 0;
  const R2 = M.remonte(H0, T, p.pendiente);
  return { d, hora, fEst, torm, Hsw, Tsw, U, local, H0, T, theta0, L0: M.longitudProfunda(T), ...rb, V, Qls, eta, surge, R2, TWL: eta + surge + R2 };
}

/** Coliformes en la playa a la hora t: dilución y muerte durante el viaje desde el emisario. */
export function coliformes(p, t) {
  const S1 = M.dilucionInicial(SITIO.gpEmisario, p.zEmisario, p.Qemisario);
  const x = p.xEmisario * 1000;
  const S = S1 * (1 + x / p.Ld);
  const tv = x / Math.max(0.01, p.corriente);          // s
  let exp = 0;
  const n = 24;
  for (let k = 0; k < n; k++) {
    const tau = t - tv + ((k + 0.5) * tv) / n;
    exp += tv / n / 3600 / M.t90Hora(((tau / 3600) % 24 + 24) % 24, p.T90dia, p.T90noche);
  }
  return { S1, S, tv, exponente: exp, C: (p.C0 / S) * 10 ** -exp };
}

/** Tasas de la línea de costa [m/s]: balance de arena y regla de Bruun. */
function tasas(p, f, pr) {
  const cl = clima(p);
  const Qin = (p.aporte * cl.fAporte + p.relleno) / M.SEG_ANO;
  const Qout = f.Qls * (1 - p.retencion);
  const arena = M.cambioAncho(Qin, Qout, p.largo, p.berma, pr.hc);
  const mar = M.bruun(p.ascensoMar / 1000 / M.SEG_ANO, pr.xc, p.berma, pr.hc);
  return { Qin, Qout, arena, mar };
}

/** Avanza dt segundos (pasos de 1 h como máximo). */
export function avanzar(p, sim, dt) {
  const pr = perfil(p);
  let resta = dt;
  while (resta > 1e-9) {
    const paso = Math.min(3600, resta);
    const t0 = sim.t + (dt - resta);
    const f = forzantes(p, t0, sim);
    const ts = tasas(p, f, pr);
    sim.W = Math.max(0, sim.W + (ts.arena - ts.mar) * paso);
    resta -= paso;
  }
}

/** Un año simulado cada 2 horas: medias y extremos de cada mes. */
function simularAno(p) {
  const pr = perfil(p);
  const meses = [];
  let W = p.ancho0, horasInund = 0, t = 0;
  const paso = 7200;
  for (let k = 0; k < 12; k++) {
    const ac = { Hs: 0, Hsmax: 0, Hb: 0, thetab: 0, V: 0, Vmax: 0, Qls: 0, Qout: 0, TWLmax: -Infinity, U: 0, n: 0 };
    const W0 = W;
    for (let j = 0; j < DIAS_MES[k] * 12; j++) {
      const f = forzantes(p, t);
      const ts = tasas(p, f, pr);
      ac.Hs += f.H0; ac.Hsmax = Math.max(ac.Hsmax, f.H0); ac.Hb += f.Hb; ac.thetab += f.thetab; ac.V += f.V; ac.Vmax = Math.max(ac.Vmax, Math.abs(f.V));
      ac.Qls += f.Qls; ac.Qout += ts.Qout; ac.TWLmax = Math.max(ac.TWLmax, f.TWL); ac.U += f.U; ac.n++;
      if (f.TWL > p.malecon) horasInund += 2;
      W = Math.max(0, W + (ts.arena - ts.mar) * paso);
      t += paso;
    }
    const n = ac.n;
    meses.push({ mes: MESES[k], Hs: ac.Hs / n, Hsmax: ac.Hsmax, Hb: ac.Hb / n, thetab: ac.thetab / n, V: ac.V / n, Vmax: ac.Vmax, Qls: ac.Qls / n, Qout: ac.Qout / n, TWLmax: ac.TWLmax, U: ac.U / n, W, dW: W - W0 });
  }
  return { meses, horasInund, dW: W - p.ancho0 };
}

let memo = { clave: '', valor: null };
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memo.clave === clave) return memo.valor;
  const r = simularAno(p);
  const m = r.meses;
  const media = (k) => m.reduce((a, x, j) => a + x[k] * DIAS_MES[j], 0) / 365;   // pesada por los días del mes
  const pr = perfil(p);
  const cl = clima(p);
  const valor = {
    meses: m, horasInund: r.horasInund, dW: r.dW,
    Hs: media('Hs'), Hsmax: Math.max(...m.map((x) => x.Hsmax)), Hb: media('Hb'), Vmax: Math.max(...m.map((x) => x.Vmax)),
    Qls: media('Qls'), Qout: media('Qout'), TWLmax: Math.max(...m.map((x) => x.TWLmax)),
    Qin: (p.aporte * cl.fAporte + p.relleno) / M.SEG_ANO,
    bruun: M.bruun(p.ascensoMar / 1000, pr.xc, p.berma, pr.hc),
  };
  valor.balance = (valor.Qin - valor.Qout) * M.SEG_ANO;      // m³/año
  memo = { clave, valor };
  return valor;
}

export function estadoInicial(p) {
  return { t: 0, W: p.ancho0, tormentaHasta: 0 };
}

/** Pide una tormenta de la duración del parámetro desde el instante de la simulación. */
export function tormentaAhora(p, sim) {
  sim.tormentaHasta = sim.t + p.duracionTormenta * M.SEG_DIA;
}

export function calcular(p, sim) {
  const t = sim.t ?? 0;
  const q = forzantes(p, t, sim);
  const a = anoMensual(p);
  const pr = perfil(p);
  const fecha = fechaDeDia(q.d);
  const col = coliformes(p, t);
  let Cmax = 0;
  for (let h = SITIO.horasBano[0]; h <= SITIO.horasBano[1]; h += 0.5) Cmax = Math.max(Cmax, coliformes(p, h * 3600).C);
  const v = a.dW;                                     // m/año (arena y Bruun)
  const capacidad = (sim.W * p.largo) / p.areaBanista;
  const r = {
    t, hora: q.hora, fecha, q, a, pr, col, Cmax,
    W: sim.W, v, W50: Math.max(0, sim.W + 50 * v), anosMin: M.anosHastaMinimo(sim.W, p.anchoMin, v),
    bruun50: M.bruun((p.ascensoMar / 1000) * 50, pr.xc, p.berma, pr.hc),
    capacidad, ocupacion: p.visitantes / Math.max(1, capacidad),
    torm: q.torm,
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const ola = [], rom = [], niv = [], per = [], are = [], mar = [], cal = [];
  const { a } = r;
  revisar(ola, 'Altura significativa máxima del año ≤ 2.5 m (sin mar de leva)', a.Hsmax <= 2.5, `${fmt(a.Hsmax, 2)} m`, { nivelFalla: 'aviso', corregir: 'Con mar de leva hay que cerrar la playa al baño y proteger el malecón.' });
  revisar(rom, 'Corriente a lo largo de la playa ≤ 0.6 m/s (baño seguro)', a.Vmax <= 0.6, `${fmt(a.Vmax, 2)} m/s`, { nivelFalla: 'aviso', corregir: 'Con corrientes fuertes, bandera roja y salvavidas.' });
  revisar(niv, 'Nivel total máximo del año ≤ malecón − 0.30 m', a.TWLmax <= p.malecon - 0.3, `${fmt(a.TWLmax, 2)} m (malecón a ${fmt(p.malecon, 2)} m)`, { corregir: 'Subir el malecón o ensanchar la playa para que el remonte no lo alcance.' });
  revisar(per, `Ancho de playa seca ≥ ${fmt(p.anchoMin, 0)} m`, r.W >= p.anchoMin, `${fmt(r.W, 1)} m`, { corregir: 'Rellenar la playa con arena del mismo tamaño.' });
  revisar(per, 'Ocupación ≤ 100 % de la capacidad de la playa', r.ocupacion <= 1, `${fmt(100 * r.ocupacion, 0)} %`, { nivelFalla: 'aviso', corregir: 'Con menos playa caben menos bañistas.' });
  revisar(are, 'Balance de arena del año ≥ 0 (la playa no se erosiona)', a.balance >= 0, `${fmt(a.balance / 1000, 1)} miles de m³/año`, { corregir: 'Más arena: no extraerla de los ríos, rellenar o retener con un espolón.' });
  revisar(are, `Ancho de playa en 50 años ≥ ${fmt(p.anchoMin, 0)} m`, r.W50 >= p.anchoMin, `${fmt(r.W50, 1)} m`, { corregir: 'Plan de relleno de playa a largo plazo.' });
  revisar(mar, 'Retroceso por el ascenso del mar en 50 años ≤ 25 % del ancho de playa', r.bruun50 <= 0.25 * p.ancho0, `${fmt(r.bruun50, 1)} m`, { nivelFalla: 'aviso', corregir: 'Dejar espacio para que la playa retroceda: línea de retiro de las construcciones.' });
  revisar(cal, `Coliformes en la playa en horas de baño ≤ ${SITIO.limiteColiformes} NMP/100 mL`, r.Cmax <= SITIO.limiteColiformes, `${fmt(r.Cmax, 0)} NMP/100 mL`, { corregir: 'Tratar el agua residual o alargar el emisario.' });
  revisar(cal, 'Dilución total del emisario ≥ 100', r.col.S >= 100, `${fmt(r.col.S, 0)} veces`, { nivelFalla: 'aviso', corregir: 'Más profundidad y más distancia: más dilución.' });
  return { oleaje: ola, rompiente: rom, nivel: niv, perfil: per, arena: are, mar, calidad: cal };
}
