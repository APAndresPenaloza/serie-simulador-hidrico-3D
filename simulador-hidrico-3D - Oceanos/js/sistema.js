/**
 * sistema.js — Une el modelo del océano en un solo cálculo, con el reloj, los escenarios y la
 * revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): temperatura de la superficie mar adentro T y frente a La Guajira Tg
 * [°C], y los «HotSpots» de las últimas 12 semanas en el arrecife (uno por día). Con cada paso
 * del reloj (6 h como máximo) los alisios cambian con la temporada; la temperatura se acerca a
 * su equilibrio (temporada, El Niño o La Niña, calentamiento y afloramiento) en unas semanas, y
 * cada día se guarda cuánto pasa el arrecife su máximo mensual. Las proyecciones del nivel del
 * mar y del carbono se calculan para el año del horizonte.
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, fechaDeDia } from './nucleo/formato.js';

export const SITIO = {
  nombre: 'Mar Caribe frente a Colombia (La Guajira, el Magdalena y las Islas del Rosario)',
  anoBase: 2026,
  ventana: 84,             // días de la ventana de los DHW (12 semanas)
  direccionOla: 20,        // ° del oleaje de los alisios con la normal a la costa
  xArrecife: 30,           // km del arrecife a la boca del río
  Lpluma: 20,              // km: escala de la pluma mar afuera
  horasOleaje: 3,          // h de un estado de mar para la ola máxima
};
const FASES = { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 };

export const CLIMAS = {
  normal: { nombre: 'Año neutro', dT: 0, fU: 1 },
  nino: { nombre: 'El Niño (mar más caliente)', dT: 1.1, fU: 1.08 },
  nina: { nombre: 'La Niña (mar más fresco)', dT: -0.4, fU: 0.95 },
};

export const PARAMETROS = {
  escenario: 'base',
  clima: 'normal',
  lat: 11.5,
  // Vientos alisios
  U0: 8, Ua: 3, dU: 40, Cd: 0.0013, Az: 0.02, anchoAfloramiento: 30,
  // Marea
  K1: 0.09, O1: 0.07, M2: 0.06, S2: 0.02,
  // Temperatura y termoclina
  Tmedia: 28, Tamp: 1, dT: 280, Tfondo: 12, zMezcla: 40, delta: 15,
  enfriamiento: 0.15,      // °C por cada m/día de afloramiento
  tauSST: 20,              // días
  MMM: 29,                 // °C: máxima media mensual del arrecife
  // Salinidad y pluma
  Smar: 36.2, Qrio: 6800, areaPluma: 2000, espesorPluma: 10, renovacion: 10,
  // Nivel del mar y carbono
  anoHorizonte: 2026, tasaMar: 3.3, aceleracion: 0.04, calentamiento: 0.02,
  CO2: 425, rCO2: 0.0055, pH0: 8.05, Om0: 3.9,
};

export const ESCENARIOS = {
  base: { nombre: 'Mar Caribe de hoy (2026, año neutro)', cambios: {} },
  nino: { nombre: 'El Niño fuerte: ola de calor en el arrecife', cambios: { clima: 'nino' } },
  nina: { nombre: 'La Niña: mar más fresco', cambios: { clima: 'nina' } },
  alisios: { nombre: 'Alisios más fuertes: más afloramiento y más oleaje', cambios: { U0: 10 } },
  creciente: { nombre: 'Gran creciente del Magdalena: la pluma llega al arrecife', cambios: { Qrio: 16000 } },
  ano2050: { nombre: 'Año 2050 (emisiones intermedias)', cambios: { anoHorizonte: 2050 } },
  ano2100bajo: { nombre: 'Año 2100 con pocas emisiones', cambios: { anoHorizonte: 2100, rCO2: 0.002, calentamiento: 0.01, aceleracion: 0.02 } },
  ano2100alto: { nombre: 'Año 2100 con muchas emisiones', cambios: { anoHorizonte: 2100, rCO2: 0.009, calentamiento: 0.035, aceleracion: 0.08 } },
};

export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;
export const amplitudes = (p) => ({ K1: p.K1, O1: p.O1, M2: p.M2, S2: p.S2 });
const anos = (p) => p.anoHorizonte - SITIO.anoBase;

/** Viento, Ekman, olas y temperaturas de equilibrio del instante t. */
export function forzantes(p, t) {
  const d = diaDelAno(t);
  const cl = clima(p);
  const U = Math.max(0.5, (p.U0 + p.Ua * Math.cos((2 * Math.PI * (d - p.dU)) / 365)) * cl.fU);
  const tau = M.esfuerzoViento(U, p.Cd);
  const f = M.coriolis(p.lat);
  const Mek = M.transporteEkman(tau, f);
  const w = M.velocidadAfloramiento(Mek, p.anchoAfloramiento * 1000);
  const wDia = w * M.SEG_DIA;
  const DE = M.profundidadEkman(p.Az, f);
  const Hs = M.alturaPM(U), Tp = M.periodoPM(U);
  const Te = 0.9 * Tp;
  const P = M.potenciaOla(Hs, Te);
  const N = (SITIO.horasOleaje * 3600) / (0.71 * Tp);
  const SSTeq = p.Tmedia + p.Tamp * Math.cos((2 * Math.PI * (d - p.dT)) / 365) + cl.dT + p.calentamiento * anos(p);
  const SSTgEq = SSTeq - p.enfriamiento * wDia;
  const eta = M.marea(t / 3600, amplitudes(p), FASES);
  return { d, U, tau, f, Mek, w, wDia, DE, Hs, Tp, Te, L0: M.longitudProfunda(Tp), C0: M.celeridadProfunda(Tp), E: M.energiaOla(Hs), P, N, Hmax: M.olaMaxima(Hs, N), SSTeq, SSTgEq, eta };
}

/** DHW: suma de los HotSpots ≥ 1 °C de la ventana, en °C·semana. */
const dhw = (hot) => hot.reduce((a, h) => a + (h >= 1 ? h : 0), 0) / 7;

/** Avanza dt segundos (pasos de 6 h como máximo). */
export function avanzar(p, sim, dt) {
  let resta = dt;
  while (resta > 1e-9) {
    const paso = Math.min(21600, resta);
    const t0 = sim.t + (dt - resta);
    const q = forzantes(p, t0);
    sim.T = M.relajar(sim.T, q.SSTeq, paso, p.tauSST * M.SEG_DIA);
    sim.Tg = M.relajar(sim.Tg, q.SSTgEq, paso, p.tauSST * M.SEG_DIA);
    const dia0 = Math.floor(t0 / M.SEG_DIA), dia1 = Math.floor((t0 + paso) / M.SEG_DIA);
    for (let k = dia0; k < dia1; k++) {
      sim.hot.push(sim.T - p.MMM);
      if (sim.hot.length > SITIO.ventana) sim.hot.shift();
    }
    resta -= paso;
  }
}

/** Un año simulado día a día: medias y extremos de cada mes. */
function simularAno(p, sim) {
  const meses = [];
  for (let k = 0; k < 12; k++) {
    const ac = { U: 0, tau: 0, Mek: 0, wDia: 0, Hs: 0, Hsmax: 0, Tp: 0, P: 0, T: 0, Tmax: -Infinity, Tg: 0, Tgmin: Infinity, dhwMax: 0, n: 0 };
    for (let j = 0; j < DIAS_MES[k]; j++) {
      const q = forzantes(p, sim.t + 43200);
      ac.U += q.U; ac.tau += q.tau; ac.Mek += q.Mek; ac.wDia += q.wDia; ac.Hs += q.Hs; ac.Hsmax = Math.max(ac.Hsmax, q.Hs); ac.Tp += q.Tp; ac.P += q.P;
      avanzar(p, sim, M.SEG_DIA);
      sim.t += M.SEG_DIA;
      ac.T += sim.T; ac.Tmax = Math.max(ac.Tmax, sim.T); ac.Tg += sim.Tg; ac.Tgmin = Math.min(ac.Tgmin, sim.Tg);
      ac.dhwMax = Math.max(ac.dhwMax, dhw(sim.hot));
      ac.n++;
    }
    const n = ac.n;
    meses.push({ mes: MESES[k], U: ac.U / n, tau: ac.tau / n, Mek: ac.Mek / n, wDia: ac.wDia / n, Hs: ac.Hs / n, Hsmax: ac.Hsmax, Tp: ac.Tp / n, P: ac.P / n, T: ac.T / n, Tmax: ac.Tmax, Tg: ac.Tg / n, Tgmin: ac.Tgmin, dhw: ac.dhwMax });
  }
  return meses;
}

let memo = { clave: '', valor: null };
/** Año de régimen: un año de arranque y un año medido. */
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memo.clave === clave) return memo.valor;
  const q0 = forzantes(p, 0);
  const sim = { t: 0, T: q0.SSTeq, Tg: q0.SSTgEq, hot: [] };
  simularAno(p, sim);
  sim.t = 0;
  const inicio = { T: sim.T, Tg: sim.Tg, hot: [...sim.hot] };
  const m = simularAno(p, sim);
  const media = (k) => m.reduce((a, x, j) => a + x[k] * DIAS_MES[j], 0) / 365;
  const valor = {
    meses: m, inicio,
    U: media('U'), Hs: media('Hs'), Tp: media('Tp'), P: media('P'), T: media('T'),
    Hsmax: Math.max(...m.map((x) => x.Hsmax)), Tmax: Math.max(...m.map((x) => x.Tmax)), Tmin: Math.min(...m.map((x) => x.T)),
    Tgmin: Math.min(...m.map((x) => x.Tgmin)), dhwMax: Math.max(...m.map((x) => x.dhw)), wMax: Math.max(...m.map((x) => x.wDia)),
  };
  memo = { clave, valor };
  return valor;
}

export function estadoInicial(p) {
  const a = anoMensual(p);
  return { t: 0, T: a.inicio.T, Tg: a.inicio.Tg, hot: [...a.inicio.hot] };
}

/** Pluma del río: salinidad en la caja frente a la boca y en el arrecife. */
export function pluma(p) {
  const V = p.areaPluma * 1e6 * p.espesorPluma;
  const S = M.salinidadPluma(p.Smar, V, p.Qrio, p.renovacion * M.SEG_DIA);
  const Sarrecife = S + (p.Smar - S) * (1 - Math.exp(-SITIO.xArrecife / SITIO.Lpluma));
  return { V, S, Sarrecife, fRio: 1 - S / p.Smar };
}

/** Nivel del mar y carbono en el año del horizonte. */
export function futuro(p, a) {
  const t = anos(p);
  const nivel = M.ascensoMar(t, p.tasaMar, p.aceleracion);                 // mm
  const termico = 1000 * M.expansionTermica(p.calentamiento * t, 700);      // mm, capa de 700 m
  const C = M.co2(t, p.CO2, p.rCO2);
  const pH = M.phMar(C, p.CO2, p.pH0);
  const Om = M.aragonito(pH, p.pH0, p.Om0);
  return { t, nivel, termico, C, pH, H: M.hidrogeniones(pH), H0: M.hidrogeniones(p.pH0), Om, calcificacion: M.calcificacion(Om) };
}

export function calcular(p, sim) {
  const t = sim.t ?? 0;
  const hora = (t / 3600) % 24;
  const q = forzantes(p, t);
  const a = anoMensual(p);
  const fecha = fechaDeDia(q.d);
  const hotspot = sim.T - p.MMM;
  const DHW = dhw(sim.hot);
  const alerta = M.alertaCoral(hotspot, DHW);
  const fu = futuro(p, a);
  const pl = pluma(p);
  const zt = p.zMezcla;
  const rhoSup = M.densidad(sim.T, pl.Sarrecife);
  const rho200 = M.densidad(M.perfilTemperatura(200, sim.T, p.Tfondo, zt, p.delta), 36.6);
  const r = {
    t, hora, fecha, q, a, fu, pl,
    T: sim.T, Tg: sim.Tg, hotspot, DHW, alerta,
    alertaPeor: M.alertaCoral(a.Tmax - p.MMM, a.dhwMax),
    rhoSup, rho200, mareaViva: M.periodoBatido(M.COMPONENTES.M2, M.COMPONENTES.S2) / 24, mareaTropica: M.periodoBatido(M.COMPONENTES.K1, M.COMPONENTES.O1) / 24,
    F: M.numeroForma(amplitudes(p)),
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const ola = [], tem = [], sal = [], niv = [], car = [];
  const { a, fu } = r;
  revisar(ola, 'Altura significativa máxima del año ≤ 4 m (navegación costera)', a.Hsmax <= 4, `${fmt(a.Hsmax, 2)} m`, { nivelFalla: 'aviso', corregir: 'Con los alisios más fuertes, avisos a la navegación menor.' });
  revisar(tem, 'Sin alerta de blanqueamiento en el arrecife (DHW < 4 °C·semana)', a.dhwMax < 4, `${fmt(a.dhwMax, 1)} °C·semana (${r.alertaPeor.nombre})`, { corregir: 'El calor acumulado blanquea el coral: reducir las otras presiones (sedimento, nutrientes, pesca) para que se recupere.' });
  revisar(tem, 'Temperatura máxima en el arrecife ≤ MMM + 1 °C', a.Tmax <= p.MMM + 1, `${fmt(a.Tmax, 2)} °C (MMM ${fmt(p.MMM, 1)} °C)`, { nivelFalla: 'aviso' });
  revisar(sal, 'Salinidad en el arrecife ≥ 34 PSU (la pluma del río no llega)', r.pl.Sarrecife >= 34, `${fmt(r.pl.Sarrecife, 2)} PSU`, { nivelFalla: 'aviso', corregir: 'El agua dulce y turbia del río estresa el coral: controlar el Canal del Dique y la erosión de la cuenca.' });
  revisar(niv, `Ascenso del mar en ${p.anoHorizonte} ≤ 30 cm`, fu.nivel <= 300, `${fmt(fu.nivel / 10, 1)} cm`, { nivelFalla: 'aviso', corregir: 'Adaptar la costa: playas, manglares y obras deben contar con este ascenso.' });
  revisar(car, `Saturación de aragonito en ${p.anoHorizonte} ≥ 3 (el coral calcifica)`, fu.Om >= 3, `Ω = ${fmt(fu.Om, 2)} (${fu.calcificacion})`, { corregir: 'Solo bajar las emisiones de CO₂ detiene la acidificación.' });
  return { olas: ola, temperatura: tem, salinidad: sal, nivel: niv, carbono: car };
}
