/**
 * sistema.js — Une el modelo del océano en un solo cálculo, con el reloj, los escenarios y la
 * revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): temperatura de la superficie mar adentro T y frente a La Guajira Tg
 * [°C], y los «HotSpots» de las últimas 12 semanas en el arrecife (uno por día). Con cada paso
 * del reloj (6 h como máximo) los alisios cambian con la temporada; la temperatura se acerca a
 * su equilibrio (temporada, El Niño o La Niña, calentamiento y afloramiento) en unas semanas, y
 * cada día se guarda cuánto pasa el arrecife su máximo mensual. Las proyecciones del nivel del
 * mar y del carbono se calculan para el año del horizonte. Con la temperatura del mar en La
 * Guajira y los alisios se calcula, hora por hora, la niebla que envuelve la Serranía de
 * Macuira: el punto de rocío del aire, la base de las nubes, el agua líquida de la nube y el
 * agua que atrapan el bosque de niebla y los atrapanieblas.
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
  // Serranía de Macuira (PNN Macuira, Alta Guajira): bosque de niebla desde 550 m; cerro Palúa, 867 m
  macuira: { zBosque: 550, zCima: 867, areaHa: 25000, bosqueKm2: 15 },
  aireMar: 0.5,            // °C: el aire de los alisios sobre el mar, un poco más caliente que el agua
  Tdia: 2.5,               // °C: variación del aire en el día (máxima a las 14:00)
  HRdia: 10,               // %: variación de la humedad en el día (máxima a las 05:00)
  gradLWC: 0.0004,         // g/m³ de agua líquida por cada metro sobre la base de las nubes
  LWCmax: 0.25,            // g/m³: agua líquida máxima de la niebla
};
/** Lluvia de cada mes en la Alta Guajira como fracción del año (bimodal: mayo y octubre). */
const LLUVIA_GUAJIRA = [5, 3, 4, 30, 70, 30, 20, 40, 90, 170, 140, 50];
export const F_LLUVIA = LLUVIA_GUAJIRA.map((x) => x / LLUVIA_GUAJIRA.reduce((a, b) => a + b, 0));
const FASES = { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 };

export const CLIMAS = {
  normal: { nombre: 'Año neutro', dT: 0, fU: 1, dHR: 0 },
  nino: { nombre: 'El Niño (mar más caliente)', dT: 1.1, fU: 1.08, dHR: -3 },
  nina: { nombre: 'La Niña (mar más fresco)', dT: -0.4, fU: 0.95, dHR: 3 },
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
  // Bosque de niebla de la Serranía de Macuira
  HR: 76,                  // % de humedad relativa media del aire que traen los alisios
  HRa: 4,                  // % de variación con la temporada (máxima en octubre)
  dHRcal: 1.5,             // % que baja la humedad por cada °C que se calienta el mar
  etaBosque: 0.048,        // parte de la niebla que pasa que atrapa el bosque (por m² de suelo)
  lluviaMacuira: 850,      // mm de lluvia al año en la serranía
  // Atrapanieblas para una comunidad wayuu
  nAtrapa: 4, areaMalla: 48, etaMalla: 0.2, zAtrapa: 700, personas: 40, litrosPersona: 20,
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

/**
 * El aire que llega a la Serranía de Macuira a la hora h del día d: viene del mar de La Guajira
 * (un poco más caliente que el agua, con su ciclo del día) y su humedad cambia con la
 * temporada, el día, el clima del año y el calentamiento. Con la humedad y la temperatura se
 * calculan el punto de rocío y la base de las nubes.
 */
export function aireMacuira(p, d, hora, Tg) {
  const cl = clima(p);
  const T = Tg + SITIO.aireMar + SITIO.Tdia * Math.cos((2 * Math.PI * (hora - 14)) / 24);
  const HR = Math.min(99.5, p.HR + p.HRa * Math.cos((2 * Math.PI * (d - 290)) / 365) + (cl.dHR ?? 0) - p.dHRcal * p.calentamiento * anos(p) + SITIO.HRdia * Math.cos((2 * Math.PI * (hora - 5)) / 24));
  const Td = M.puntoRocio(T, HR);
  return { T, HR, Td, zb: M.baseNubes(T, Td) };
}

/**
 * La niebla en la serranía con el aire y el viento del momento: agua líquida media en la franja
 * del bosque (de 550 m a la cima, en seis alturas), parte del bosque dentro de la nube, agua
 * líquida a la altura de los atrapanieblas y agua que atrapan por segundo.
 */
export function nieblaMacuira(p, aire, U) {
  const { zBosque, zCima } = SITIO.macuira;
  const n = 6;
  let lwcBosque = 0, dentro = 0;
  for (let k = 0; k < n; k++) {
    const z = zBosque + ((k + 0.5) / n) * (zCima - zBosque);
    lwcBosque += M.aguaLiquida(z, aire.zb, SITIO.gradLWC, SITIO.LWCmax) / n;
    if (z > aire.zb) dentro += 1 / n;
  }
  const lwcAtrapa = M.aguaLiquida(p.zAtrapa, aire.zb, SITIO.gradLWC, SITIO.LWCmax);
  return {
    lwcBosque, lwcAtrapa, dentro, U,
    Fbosque: M.flujoNiebla(p.etaBosque, lwcBosque, U),   // g/(m²·s) por m² de suelo del bosque
    Fmalla: M.flujoNiebla(p.etaMalla, lwcAtrapa, U),     // g/(m²·s) por m² de malla
    cimaEnNube: aire.zb < zCima, bosqueEnNube: aire.zb < zBosque,
  };
}

/** Un día de niebla en la serranía, hora por hora. */
export function nieblaDia(p, d, Tg, U) {
  const r = { mm: 0, litros: 0, hCima: 0, hBosque: 0, zb: 0, zbMin: Infinity, zbMax: 0, lwc: 0 };
  for (let h = 0; h < 24; h++) {
    const a = aireMacuira(p, d, h + 0.5, Tg);
    const n = nieblaMacuira(p, a, U);
    r.mm += M.litrosPorM2(n.Fbosque, 3600);
    r.litros += M.litrosPorM2(n.Fmalla, 3600);
    if (n.cimaEnNube) r.hCima++;
    if (n.bosqueEnNube) r.hBosque++;
    r.zb += a.zb / 24; r.lwc += n.lwcBosque / 24;
    r.zbMin = Math.min(r.zbMin, a.zb); r.zbMax = Math.max(r.zbMax, a.zb);
  }
  return r;
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
    const ac = { U: 0, tau: 0, Mek: 0, wDia: 0, Hs: 0, Hsmax: 0, Tp: 0, P: 0, T: 0, Tmax: -Infinity, Tg: 0, Tgmin: Infinity, dhwMax: 0, niebla: 0, litros: 0, litrosMin: Infinity, hCima: 0, hBosque: 0, zb: 0, lwc: 0, n: 0 };
    for (let j = 0; j < DIAS_MES[k]; j++) {
      const q = forzantes(p, sim.t + 43200);
      ac.U += q.U; ac.tau += q.tau; ac.Mek += q.Mek; ac.wDia += q.wDia; ac.Hs += q.Hs; ac.Hsmax = Math.max(ac.Hsmax, q.Hs); ac.Tp += q.Tp; ac.P += q.P;
      const nd = nieblaDia(p, q.d, sim.Tg, q.U);
      ac.niebla += nd.mm; ac.litros += nd.litros; ac.litrosMin = Math.min(ac.litrosMin, nd.litros);
      ac.hCima += nd.hCima; ac.hBosque += nd.hBosque; ac.zb += nd.zb; ac.lwc += nd.lwc;
      avanzar(p, sim, M.SEG_DIA);
      sim.t += M.SEG_DIA;
      ac.T += sim.T; ac.Tmax = Math.max(ac.Tmax, sim.T); ac.Tg += sim.Tg; ac.Tgmin = Math.min(ac.Tgmin, sim.Tg);
      ac.dhwMax = Math.max(ac.dhwMax, dhw(sim.hot));
      ac.n++;
    }
    const n = ac.n;
    meses.push({
      mes: MESES[k], U: ac.U / n, tau: ac.tau / n, Mek: ac.Mek / n, wDia: ac.wDia / n, Hs: ac.Hs / n, Hsmax: ac.Hsmax, Tp: ac.Tp / n, P: ac.P / n, T: ac.T / n, Tmax: ac.Tmax, Tg: ac.Tg / n, Tgmin: ac.Tgmin, dhw: ac.dhwMax,
      niebla: ac.niebla, lluvia: p.lluviaMacuira * F_LLUVIA[k], litros: ac.litros / n, litrosMin: ac.litrosMin, hCima: ac.hCima, hBosque: ac.hBosque, zb: ac.zb / n, lwc: ac.lwc / n,
    });
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
    niebla: m.reduce((s, x) => s + x.niebla, 0), lluvia: m.reduce((s, x) => s + x.lluvia, 0),
    hCima: m.reduce((s, x) => s + x.hCima, 0), hBosque: m.reduce((s, x) => s + x.hBosque, 0), zb: media('zb'), litros: media('litros'),
  };
  valor.pctNiebla = valor.niebla / Math.max(1e-9, valor.niebla + valor.lluvia);
  const peor = m.reduce((a2, x, j) => (x.litros < m[a2].litros ? j : a2), 0);
  valor.mesPeorNiebla = peor;
  valor.litrosPeor = m[peor].litros;
  memo = { clave, valor };
  return valor;
}

export function estadoInicial(p) {
  const a = anoMensual(p);
  return { t: 0, T: a.inicio.T, Tg: a.inicio.Tg, hot: [...a.inicio.hot] };
}

/** La Serranía de Macuira ahora y en el año: niebla, bosque y atrapanieblas. */
export function macuira(p, a, t, Tg, U) {
  const d = diaDelAno(t);
  const hora = (t / 3600) % 24;
  const aire = aireMacuira(p, d, hora, Tg);
  const nb = nieblaMacuira(p, aire, U);
  const malla = p.nAtrapa * p.areaMalla;
  const demanda = p.personas * p.litrosPersona;
  const aguaAno = a.litros * malla;              // L/día de los atrapanieblas en promedio
  const aguaPeor = a.litrosPeor * malla;         // L/día en el mes de menos niebla
  return {
    aire, nb, malla, demanda, aguaAno, aguaPeor,
    mmDia: M.litrosPorM2(nb.Fbosque, M.SEG_DIA), litrosM2Dia: M.litrosPorM2(nb.Fmalla, M.SEG_DIA),
    personasAno: aguaAno / p.litrosPersona, personasPeor: aguaPeor / p.litrosPersona,
    Tcima: M.temperaturaAltura(SITIO.macuira.zCima, aire.T, aire.zb),
  };
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
  const mac = macuira(p, a, t, sim.Tg, q.U);
  const zt = p.zMezcla;
  const rhoSup = M.densidad(sim.T, pl.Sarrecife);
  const rho200 = M.densidad(M.perfilTemperatura(200, sim.T, p.Tfondo, zt, p.delta), 36.6);
  const r = {
    t, hora, fecha, q, a, fu, pl, mac,
    T: sim.T, Tg: sim.Tg, hotspot, DHW, alerta,
    alertaPeor: M.alertaCoral(a.Tmax - p.MMM, a.dhwMax),
    rhoSup, rho200, mareaViva: M.periodoBatido(M.COMPONENTES.M2, M.COMPONENTES.S2) / 24, mareaTropica: M.periodoBatido(M.COMPONENTES.K1, M.COMPONENTES.O1) / 24,
    F: M.numeroForma(amplitudes(p)),
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const ola = [], tem = [], nie = [], sal = [], niv = [], car = [];
  const { a, fu } = r;
  revisar(ola, 'Altura significativa máxima del año ≤ 4 m (navegación costera)', a.Hsmax <= 4, `${fmt(a.Hsmax, 2)} m`, { nivelFalla: 'aviso', corregir: 'Con los alisios más fuertes, avisos a la navegación menor.' });
  revisar(tem, 'Sin alerta de blanqueamiento en el arrecife (DHW < 4 °C·semana)', a.dhwMax < 4, `${fmt(a.dhwMax, 1)} °C·semana (${r.alertaPeor.nombre})`, { corregir: 'El calor acumulado blanquea el coral: reducir las otras presiones (sedimento, nutrientes, pesca) para que se recupere.' });
  revisar(tem, 'Temperatura máxima en el arrecife ≤ MMM + 1 °C', a.Tmax <= p.MMM + 1, `${fmt(a.Tmax, 2)} °C (MMM ${fmt(p.MMM, 1)} °C)`, { nivelFalla: 'aviso' });
  revisar(nie, 'Agua de niebla del año en el bosque de Macuira ≥ 500 mm (el bosque de niebla se sostiene)', a.niebla >= 500, `${fmt(a.niebla, 0)} mm de niebla y ${fmt(a.lluvia, 0)} mm de lluvia (base media de las nubes a ${fmt(a.zb, 0)} m)`, { corregir: 'Si la base de las nubes sube por encima del bosque, la niebla ya no lo moja: el aire más caliente y más seco del calentamiento global la sube.' });
  revisar(nie, 'Los atrapanieblas cubren lo que necesita la comunidad en el mes de menos niebla', r.mac.aguaPeor >= r.mac.demanda, `${fmt(r.mac.aguaPeor, 0)} L/día en ${MESES[a.mesPeorNiebla]} para ${fmt(p.personas, 0)} personas a ${fmt(p.litrosPersona, 0)} L (${fmt(r.mac.demanda, 0)} L/día)`, { nivelFalla: 'aviso', corregir: 'Más malla, atrapanieblas más altos (más agua líquida en la nube) o un tanque que guarde el agua de los meses de más niebla.' });
  revisar(sal, 'Salinidad en el arrecife ≥ 34 PSU (la pluma del río no llega)', r.pl.Sarrecife >= 34, `${fmt(r.pl.Sarrecife, 2)} PSU`, { nivelFalla: 'aviso', corregir: 'El agua dulce y turbia del río estresa el coral: controlar el Canal del Dique y la erosión de la cuenca.' });
  revisar(niv, `Ascenso del mar en ${p.anoHorizonte} ≤ 30 cm`, fu.nivel <= 300, `${fmt(fu.nivel / 10, 1)} cm`, { nivelFalla: 'aviso', corregir: 'Adaptar la costa: playas, manglares y obras deben contar con este ascenso.' });
  revisar(car, `Saturación de aragonito en ${p.anoHorizonte} ≥ 3 (el coral calcifica)`, fu.Om >= 3, `Ω = ${fmt(fu.Om, 2)} (${fu.calcificacion})`, { corregir: 'Solo bajar las emisiones de CO₂ detiene la acidificación.' });
  return { olas: ola, temperatura: tem, niebla: nie, salinidad: sal, nivel: niv, carbono: car };
}
