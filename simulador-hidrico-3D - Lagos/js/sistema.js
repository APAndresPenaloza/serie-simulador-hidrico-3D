/**
 * sistema.js — Une el modelo del lago en un solo cálculo, con el reloj simulado, los
 * escenarios y la revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): nivel sobre el umbral del desagüe η [m], agua guardada en la
 * cuenca S [mm], oxígeno del hipolimnion ODh [mg/L] y días seguidos con el lago estratificado.
 * El reloj empieza el 1 de enero a las 06:00 (temporada seca de los Andes).
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, INICIO_MES, fechaDeDia } from './nucleo/formato.js';

export const SITIO = {
  nombre: 'Lago andino de alta montaña (referencia: lago de Tota, Boyacá)',
  latitud: 5.55,
  Cdesague: 1.7,
  dMaxTemp: 30,          // día del año con la superficie más caliente (finales de enero)
  dMaxViento: 213,       // día del año con más viento (agosto)
  espesorTermoclina: 1.5,
  ODlimite: 2,           // mg/L: por debajo, anoxia
  ODtrucha: 5,           // mg/L que necesita la trucha
  liberacionP: 2,        // mg de fósforo por m² y día que suelta el fondo sin oxígeno
  Pcritico: 20,          // µg/L: límite del estado mesotrófico de referencia
};

/** Lluvia de cada mes como fracción del año en los Andes de Boyacá (bimodal). */
export const FRACCION_LLUVIA = [0.03, 0.04, 0.07, 0.12, 0.12, 0.08, 0.07, 0.07, 0.09, 0.13, 0.11, 0.07];

export const CLIMAS = {
  normal: { nombre: 'Año normal', fLluvia: 1, dT: 0 },
  nino: { nombre: 'El Niño (año seco y cálido)', fLluvia: 0.6, dT: 0.8 },
  nina: { nombre: 'La Niña (año lluvioso y frío)', fLluvia: 1.4, dT: -0.4 },
};

/** Fuentes de fósforo: coeficientes de exportación de referencia. */
export const FUENTES = {
  cuenca: { nombre: 'Cuenca natural (bosque y páramo)', coef: 8, unidad: 'kg/km²·año' },
  cebolla: { nombre: 'Cultivos de cebolla con gallinaza', coef: 1.0, unidad: 'kg/ha·año' },
  truchas: { nombre: 'Jaulas de trucha', coef: 10, unidad: 'kg/t' },
  aguas: { nombre: 'Aguas residuales de los pueblos', coef: 0.6, unidad: 'kg/hab·año' },
};

export const PARAMETROS = {
  escenario: 'base',
  // Cuenca y balance
  clima: 'normal',
  lluviaAnual: 1000,         // mm
  areaCuenca: 200,           // km² (sin el lago)
  coefEscorrentia: 0.40,
  kCuenca: 45,               // días
  extraccion: 0.8,           // m³/s para acueductos y riego
  aporteExterno: 0,          // m³/s de un tributario de aguas arriba (la laguna del páramo)
  fosforoExterno: 0,         // µg/L de ese tributario
  anchoDesague: 15,          // m
  altitud: 3015,             // m.s.n.m.
  Tmar: 27.6,
  gradiente: 0.0055,
  amplitudDiaria: 11,        // °C
  // Morfometría
  area: 55,                  // km²
  profMax: 60,               // m
  exponente: 0.8,            // m de la hipsometría
  largo: 12.3,               // km
  perimetro: 40,             // km
  // Temperatura y viento
  Tsuperficie: 13.2,         // °C media
  amplitudT: 1.3,            // °C
  Tfondo: 11.0,              // °C del hipolimnion
  epilimnion: 12,            // m
  calentamiento: 0,          // °C sobre el clima de hoy (solo la superficie)
  viento: 5,                 // m/s media
  amplitudViento: 2,         // m/s
  // Nutrientes
  areaCebolla: 1200,         // ha
  truchas: 100,              // t/año
  habitantes: 8000,
  remocion: 50,              // % del fósforo que quitan las plantas de tratamiento
};

export const ESCENARIOS = {
  base: { nombre: 'Lago de referencia (año normal)', cambios: {} },
  nino: { nombre: 'Sequía de El Niño', cambios: { clima: 'nino' } },
  nina: { nombre: 'Lluvias de La Niña', cambios: { clima: 'nina' } },
  cebolla: { nombre: 'Más cebolla con gallinaza en la cuenca', cambios: { areaCebolla: 3500 } },
  truchas: { nombre: 'Más jaulas de trucha', cambios: { truchas: 450 } },
  aguas: { nombre: 'Aguas residuales sin tratar', cambios: { remocion: 0, habitantes: 15000 } },
  calentamiento: { nombre: 'Calentamiento de 3 °C y menos viento', cambios: { calentamiento: 3, viento: 4 } },
  extraccion: { nombre: 'Más agua para las ciudades', cambios: { extraccion: 2.2 } },
};

export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;

export function morfometria(p) {
  const A0 = M.km2Am2(p.area);
  const V = M.volumenLago(A0, p.profMax, p.exponente);
  const zmed = M.profundidadMedia(p.profMax, p.exponente);
  const he = Math.min(p.epilimnion, p.profMax * 0.8);
  const hh = Math.max(1, zmed - he * (1 - (he / p.profMax) * 0.5));
  const Vepi = V - M.volumenBajo(he, A0, p.profMax, p.exponente);
  const Ahipo = M.areaProfundidad(he, A0, p.profMax, p.exponente);
  return { A0, V, zmed, Vd: M.desarrolloVolumen(zmed, p.profMax), DL: M.desarrolloOrilla(p.perimetro * 1000, A0), he, hh, Vepi, Vhipo: V - Vepi, Ahipo, L: p.largo * 1000 };
}

export const lluviaMes = (p, k) => p.lluviaAnual * clima(p).fLluvia * FRACCION_LLUVIA[k];
export const lluviaDia = (p, d) => { const { mes } = fechaDeDia(d); return lluviaMes(p, mes) / DIAS_MES[mes]; };

export function evaporacion(p, d) {
  const Taire = M.temperaturaAltitud(p.altitud, p.Tmar, p.gradiente) + clima(p).dT + p.calentamiento;
  const Ra = M.radiacionExtraterrestre(SITIO.latitud, d);
  const ET0 = M.hargreaves(Taire, p.amplitudDiaria, Ra);
  return { Taire, Ra, ET0, E: 1.05 * ET0 };
}

/** Temperatura de la superficie y del fondo, viento del día y estratificación. */
export function termica(p, d) {
  const mo = morfometria(p);
  const Te = M.temperaturaSuperficie(p.Tsuperficie + clima(p).dT + p.calentamiento, p.amplitudT, d, SITIO.dMaxTemp);
  const Th = p.Tfondo + 0.25 * p.calentamiento;
  const U = Math.max(0, p.viento + p.amplitudViento * Math.cos((2 * Math.PI * (d - SITIO.dMaxViento)) / 365));
  const gp = M.gravedadReducida(Te, Th);
  const rhoA = M.densidadAire(p.altitud);
  const tau = M.esfuerzoViento(U, rhoA);
  const us = M.velocidadFriccion(tau);
  const W = M.wedderburn(gp, mo.he, us, mo.L);
  return { Te, Th, U, gp, rhoA, tau, us, W, mezcla: W < 1, N: M.frecuenciaFlotabilidad(gp, SITIO.espesorTermoclina), drho: M.densidad(Th) - M.densidad(Te) };
}

/** Balance medio del año [m³/s]. */
export function balanceMedio(p) {
  const mo = morfometria(p);
  const Qcuenca = M.mmDiaAm3s((p.coefEscorrentia * p.lluviaAnual * clima(p).fLluvia) / 365, M.km2Am2(p.areaCuenca));
  const Qlluvia = M.mmDiaAm3s((p.lluviaAnual * clima(p).fLluvia) / 365, mo.A0);
  const Eanual = Array.from({ length: 12 }, (_, k) => evaporacion(p, INICIO_MES[k] + 14).E * DIAS_MES[k]).reduce((a, b) => a + b, 0);
  const Qevap = M.mmDiaAm3s(Eanual / 365, mo.A0);
  const Qin = Qcuenca + Qlluvia + p.aporteExterno;
  const Qneto = Qin - Qevap - p.extraccion;
  const Qdesague = Math.max(0, Qneto);
  return { Qcuenca, Qlluvia, Qevap, Qexterno: p.aporteExterno, Qin, Qneto, Qdesague, Eanual, Qsale: Qdesague + p.extraccion };
}

/** Fósforo, estado trófico y luz (con la carga interna del fondo sin oxígeno). */
export function nutrientes(p, diasAnoxia = 0) {
  const mo = morfometria(p);
  const bal = balanceMedio(p);
  const fuentes = {
    cuenca: p.areaCuenca * FUENTES.cuenca.coef,
    cebolla: p.areaCebolla * FUENTES.cebolla.coef,
    truchas: p.truchas * FUENTES.truchas.coef,
    aguas: p.habitantes * FUENTES.aguas.coef * (1 - p.remocion / 100),
    externo: (p.aporteExterno * p.fosforoExterno * M.SEG_ANO) / 1e6,
  };
  fuentes.interna = (SITIO.liberacionP * mo.Ahipo * diasAnoxia) / 1e6;   // kg/año
  const carga = Object.values(fuentes).reduce((a, b) => a + b, 0);
  const Vsale = bal.Qsale * M.SEG_ANO;
  const tau = M.tiempoResidencia(mo.V, bal.Qsale) / M.SEG_ANO;
  const Pin = M.fosforoEntrada(carga, Vsale);
  const P = M.fosforoLago(Pin, tau);
  const tsi = M.tsiFosforo(P);
  const Chl = M.clorofilaDeTSI(tsi);
  const DS = M.secchiDeTSI(tsi);
  const k = M.atenuacionDeSecchi(DS);
  const Lc = M.cargaAdmisible(SITIO.Pcritico, Vsale, tau);
  return { fuentes, carga, Vsale, tau, Pin, P, tsi, Chl, DS, k, zEu: M.zonaFotica(k), clase: M.claseTrofica(tsi), Lc, AHOD: M.demandaHipolimnion(Chl) };
}

// ── Estado inicial y avance del reloj ──────────────────────────────────────
export function estadoInicial(p) {
  const S = (p.coefEscorrentia * lluviaDia(p, 350)) * p.kCuenca * 1.4;
  const bal = balanceMedio(p);
  const eta = bal.Qdesague > 0 ? (bal.Qdesague / (SITIO.Cdesague * p.anchoDesague)) ** (2 / 3) : -0.1;
  const tr = termica(p, 1);
  // El hipolimnion lleva estratificado desde el último mezclado de agosto (≈ 150 días)
  const nu = nutrientes(p, 0);
  const ODsat = M.odSaturacion(tr.Th, p.altitud);
  const dias = 150;
  return { eta, S, ODh: M.oxigenoHipolimnion(ODsat, nu.AHOD, morfometria(p).hh, dias), dias, t: 0, ventarron: 0 };
}

export function caudales(p, sim) {
  const mo = morfometria(p);
  const d = diaDelAno(sim.t);
  const ev = evaporacion(p, d);
  const Qcuenca = M.mmDiaAm3s(sim.S / p.kCuenca, M.km2Am2(p.areaCuenca));
  const Qlluvia = M.mmDiaAm3s(lluviaDia(p, d), mo.A0);
  const Qevap = M.mmDiaAm3s(ev.E, mo.A0);
  const Qext = sim.eta > -1.5 ? p.extraccion : 0;
  const Qdesague = M.desague(sim.eta, SITIO.Cdesague, p.anchoDesague);
  const Qneto = Qcuenca + Qlluvia + p.aporteExterno - Qevap - Qext - Qdesague;
  return { d, ev, Qcuenca, Qlluvia, Qexterno: p.aporteExterno, Qevap, Qext, Qdesague, Qneto };
}

export function avanzar(p, sim, dt) {
  const mo = morfometria(p);
  let resta = dt;
  const nuBase = nutrientes(p, 0);
  while (resta > 1e-9) {
    const h = Math.min(3600, resta);
    const t = sim.t + (dt - resta);
    const d = diaDelAno(t);
    const q = caudales(p, { ...sim, t });
    sim.S = M.pasoCuenca(sim.S, p.coefEscorrentia * lluviaDia(p, d), p.kCuenca, h / M.SEG_DIA);
    sim.eta += (q.Qneto * h) / mo.A0;
    // Mezcla u oxígeno que se consume en el hipolimnion
    const tr = termica(p, d);
    const ventarron = t < sim.ventarron;
    if (tr.mezcla || ventarron) {
      const ODsat = M.odSaturacion(tr.Th, p.altitud);
      sim.ODh += (ODsat - sim.ODh) * Math.min(1, h / (6 * 3600));
      sim.dias = 0;
    } else {
      sim.ODh = Math.max(0, sim.ODh - (nuBase.AHOD / mo.hh) * (h / M.SEG_DIA));
      sim.dias += h / M.SEG_DIA;
    }
    resta -= h;
  }
}

/** Ventarrón: un día de viento fuerte que mezcla el lago. */
export function ventarron(p, sim) { sim.ventarron = sim.t + M.SEG_DIA; }

let memoAno = { clave: '', valor: null };
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memoAno.clave === clave) return memoAno.valor;
  const sim = estadoInicial(p);
  sim.t = 0;
  const meses = [];
  let diasAnoxia = 0, diasEstrat = 0, maxEstrat = 0, diasMezcla = 0;
  for (let k = 0; k < 12; k++) {
    const ac = { Qcuenca: 0, Qdesague: 0, Qevap: 0, Qlluvia: 0, n: 0, ODmin: Infinity, mezcla: 0 };
    for (let j = 0; j < DIAS_MES[k]; j++) {
      const q = caudales(p, sim);
      ac.Qcuenca += q.Qcuenca; ac.Qdesague += q.Qdesague; ac.Qevap += q.Qevap; ac.Qlluvia += q.Qlluvia; ac.n++;
      avanzar(p, sim, M.SEG_DIA);
      sim.t += M.SEG_DIA;
      ac.ODmin = Math.min(ac.ODmin, sim.ODh);
      if (sim.ODh < SITIO.ODlimite) diasAnoxia++;
      if (sim.dias === 0) { ac.mezcla++; diasMezcla++; diasEstrat = 0; } else { diasEstrat++; maxEstrat = Math.max(maxEstrat, diasEstrat); }
    }
    const tr = termica(p, INICIO_MES[k] + 14);
    meses.push({ mes: MESES[k], lluvia: lluviaMes(p, k), Qcuenca: ac.Qcuenca / ac.n, Qlluvia: ac.Qlluvia / ac.n, Qevap: ac.Qevap / ac.n, Qdesague: ac.Qdesague / ac.n, eta: sim.eta, ODh: sim.ODh, ODmin: ac.ODmin, Te: tr.Te, W: tr.W, diasMezcla: ac.mezcla });
  }
  const valor = { meses, diasAnoxia, maxEstrat, diasMezcla, mesesSinDesague: meses.filter((m) => m.Qdesague < 1e-4).map((m) => m.mes), etaMin: Math.min(...meses.map((m) => m.eta)), etaFin: sim.eta };
  memoAno = { clave, valor };
  return valor;
}

export function calcular(p, sim) {
  const t = sim.t ?? 0;
  const d = diaDelAno(t);
  const hora = (t / 3600) % 24;
  const fecha = fechaDeDia(d);
  const mo = morfometria(p);
  const bal = balanceMedio(p);
  const q = caudales(p, sim);
  const tr = termica(p, d);
  const ano = anoMensual(p);
  const nu = nutrientes(p, ano.diasAnoxia);
  const ODsatSup = M.odSaturacion(tr.Te, p.altitud);
  const ODsatFondo = M.odSaturacion(tr.Th, p.altitud);
  const diasAnoxiaRest = M.diasHastaOxigeno(sim.ODh, SITIO.ODlimite, nu.AHOD, mo.hh);
  const diasDesdeMezcla = sim.dias;
  const ventarron = t < (sim.ventarron ?? 0);
  // Viento y seiches
  const Lsup = M.levantamientoSuperficie(tr.tau, mo.L, mo.zmed);
  const Dh = M.inclinacionTermoclina(tr.tau, mo.L, tr.gp, mo.he);
  const Ts = M.seicheSuperficial(mo.L, mo.zmed);
  const Ti = M.seicheInterna(mo.L, tr.gp, mo.he, mo.hh);
  // Hábitat de la trucha: epilimnion siempre; hipolimnion si tiene oxígeno
  const habitat = (mo.Vepi + (sim.ODh >= SITIO.ODtrucha ? mo.Vhipo : 0)) / mo.V;
  const surgenciaAnoxica = (tr.mezcla || ventarron) && sim.ODh < SITIO.ODlimite + 1;
  const r = {
    t, d, hora, fecha, mo, bal, q, tr, ano, nu,
    nivel: { eta: sim.eta, A: mo.A0, dhdt: M.pendienteNivel(q.Qneto, mo.A0), Qeco: 0.3, tau: nu.tau },
    oxigeno: { ODsatSup, ODsatFondo, ODh: sim.ODh, diasAnoxiaRest, diasDesdeMezcla, habitat, surgenciaAnoxica, ventarron },
    viento: { Lsup, Dh, Ts, Ti },
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const { bal, ano, nu, oxigeno, tr, nivel } = r;
  const cue = [], tem = [], vie = [], oxi = [], nut = [];
  revisar(cue, 'El lago desagua al río: caudal de salida ≥ caudal ecológico (0.3 m³/s)', r.q.Qdesague >= nivel.Qeco, `${fmt(r.q.Qdesague, 2)} m³/s`, { corregir: 'Reducir la extracción en los meses secos: el río de salida necesita agua.' });
  revisar(cue, 'Extracción ≤ 30 % del agua que entra en el año', p.extraccion <= 0.3 * bal.Qin, `${fmt(p.extraccion, 2)} ≤ ${fmt(0.3 * bal.Qin, 2)} m³/s`, { corregir: 'Buscar otras fuentes y bajar las pérdidas de los acueductos.' });
  revisar(cue, 'Balance del año: el nivel no baja más de 0.30 m', ano.etaFin - r.ano.meses[0].eta > -0.3 - 1e-9 && ano.etaMin > -0.3, `nivel mínimo ${fmt(ano.etaMin, 2)} m sobre el umbral`, { corregir: 'Con El Niño la evaporación y la extracción superan lo que entra: hay que extraer menos.' });
  revisar(cue, 'Desagua todos los meses del año', ano.mesesSinDesague.length === 0, ano.mesesSinDesague.length ? `no desagua en ${ano.mesesSinDesague.join(', ')}` : 'los 12 meses', { nivelFalla: 'aviso', corregir: 'Reducir la extracción en la temporada seca.' });

  revisar(tem, 'El lago se mezcla al menos una vez al año', ano.diasMezcla > 0, ano.diasMezcla > 0 ? `${ano.diasMezcla} días de mezcla` : 'no se mezcla', { corregir: 'Sin mezcla el fondo no recibe oxígeno: vigilar la anoxia y la carga de nutrientes.' });
  revisar(tem, 'Estratificación seguida ≤ 300 días', ano.maxEstrat <= 300, `${ano.maxEstrat} días`, { nivelFalla: 'aviso', corregir: 'Con el calentamiento el lago se estratifica más tiempo.' });

  revisar(vie, 'Sin surgencia de agua sin oxígeno', !oxigeno.surgenciaAnoxica, oxigeno.surgenciaAnoxica ? 'el viento sube agua sin oxígeno' : (tr.mezcla ? 'mezcla con oxígeno' : `W = ${fmt(tr.W, 2)}`), { corregir: 'Con el fondo sin oxígeno, un ventarrón puede subir esa agua y matar peces en las jaulas.' });

  revisar(oxi, 'Oxígeno del hipolimnion ≥ 2 mg/L (sin anoxia)', oxigeno.ODh >= SITIO.ODlimite, `${fmt(oxigeno.ODh, 2)} mg/L`, { corregir: 'Bajar la carga de fósforo: menos algas, menos materia que consume el oxígeno del fondo.' });
  revisar(oxi, 'Días sin oxígeno en el año = 0', ano.diasAnoxia === 0, `${ano.diasAnoxia} días`, { corregir: 'El fondo sin oxígeno suelta fósforo (carga interna) y empeora el lago.' });
  revisar(oxi, 'Hábitat de la trucha ≥ 70 % del volumen', oxigeno.habitat >= 0.7, `${fmt(100 * oxigeno.habitat, 0)} %`, { nivelFalla: 'aviso', corregir: 'Con el hipolimnion bajo 5 mg/L la trucha solo vive en la capa de arriba.' });

  revisar(nut, 'Fósforo total ≤ 20 µg/L', nu.P <= SITIO.Pcritico, `${fmt(nu.P, 1)} µg/L`, { corregir: 'Tratar las aguas residuales y controlar la gallinaza de la cebolla.' });
  revisar(nut, 'Índice de Carlson < 50 (no eutrófico)', nu.tsi < 50, `${fmt(nu.tsi, 1)} (${nu.clase})`, { nivelFalla: nu.tsi < 60 ? 'aviso' : 'alerta', corregir: 'Bajar la carga de fósforo.' });
  revisar(nut, 'Carga de fósforo ≤ carga admisible de Vollenweider', nu.carga <= nu.Lc, `${fmt(nu.carga, 0)} ≤ ${fmt(nu.Lc, 0)} kg/año`, { corregir: 'Reducir las fuentes más grandes de la tabla.' });
  revisar(nut, 'Zona fótica ≥ 5 m', nu.zEu >= 5, `${fmt(nu.zEu, 1)} m`, { nivelFalla: 'aviso', corregir: 'Con menos algas la luz llega más hondo.' });
  return { cuenca: cue, temperatura: tem, viento: vie, oxigeno: oxi, nutrientes: nut };
}
