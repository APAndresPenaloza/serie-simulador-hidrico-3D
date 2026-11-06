/**
 * sistema.js — Une el modelo del delta en un solo cálculo, con el reloj, los escenarios y la
 * revisión de los criterios. Funciones puras (sin DOM).
 *
 * Estado dinámico (sim): longitud de la cuña salina L [m], profundidad del canal de acceso
 * entre los tajamares h [m] y volumen dragado en el año [m³]. Con cada paso del reloj (6 h como
 * máximo) el caudal del río cambia con su régimen, la cuña se acerca a su longitud de equilibrio
 * (en unos dos días) y el fondo del canal se acerca a su profundidad de régimen (en meses); si
 * el dragado está activo, la draga devuelve el canal al calado de diseño. El crecimiento del
 * delta, el oleaje y la avulsión se calculan con las medias del año.
 */
import * as M from './modelo.js';
import { revisar, fmt, MESES, DIAS_MES, fechaDeDia } from './nucleo/formato.js';

export const SITIO = {
  nombre: 'Delta del río Magdalena en Bocas de Ceniza (Barranquilla)',
  tauCuna: 2 * M.SEG_DIA,      // s: tiempo de ajuste de la cuña salina
  margenDragado: 0.5,         // m que la draga deja por debajo del calado
  Lmax: 60000,                // m: tope de la cuña (el río deja de ser río)
  xPlaya: 15,                 // km: playas de Puerto Colombia, al occidente de la boca
};

export const CLIMAS = {
  normal: { nombre: 'Año normal', fQ: 1 },
  nino: { nombre: 'El Niño (año seco)', fQ: 0.72 },
  nina: { nombre: 'La Niña (año lluvioso)', fQ: 1.3 },
};

export const PARAMETROS = {
  escenario: 'base',
  clima: 'normal',
  // El río
  Qm: 7200,                  // m³/s: caudal medio del Magdalena
  A1: 0.42, d1: 315,         // creciente principal (noviembre)
  A2: 0.12, d2: 160,         // creciente de mitad de año (junio)
  C0: 600,                   // mg/L de sedimento con el caudal medio
  bSed: 1.4,                 // exponente de la curva de carga Q·C ∝ Q^b
  // Los brazos
  anchoRio: 900, profRio: 9, nRio: 0.025, pendRio: 5e-5,
  anchoDique: 120, profDique: 5, nDique: 0.03, pendDique: 1e-4, aperturaDique: 1,
  // Canal de acceso entre los tajamares
  anchoCanal: 400, largoCanal: 3000,
  Uc: 1.2,                   // m/s: velocidad con la que el canal ni se llena ni se ahonda
  profMaxCanal: 13,          // m: el canal no se ahonda más (fondo duro al pie de los tajamares)
  tauCanal: 60,              // días: tiempo de ajuste del fondo
  calado: 10,                // m que piden los buques
  dragadoAuto: true,
  z0: 0.001,                 // m: rugosidad del fondo
  // Cuña salina
  Smar: 36, Ci: 2.5e-4, xToma: 4,
  // Pluma
  hPluma: 3, wsPluma: 0.35, Cvis: 20, Qcienaga: 250,
  // El delta
  fRetencion: 0.25,          // parte del sedimento que se queda en el frente del delta
  anchoFrente: 10,           // km
  profFrente: 40,            // m: profundidad al pie del frente
  cotaLlanura: 1.5,          // m.s.n.m.
  rhoB: 1.6,                 // t/m³
  radioLobulo: 6,            // km
  subsidencia: 5, ascensoMar: 3.3, nivelMar: 0,   // mm/año, mm/año, m
  sobreelevacion: 2, agradacion: 15, beta: 1,     // m, mm/año, —
  // El oleaje
  Hs: 1.5, Tp: 7, anguloOla: 15, rangoMarea: 0.4,
};

export const ESCENARIOS = {
  base: { nombre: 'Delta de referencia (año normal, con dragado)', cambios: {} },
  nino: { nombre: 'Sequía de El Niño', cambios: { clima: 'nino' } },
  nina: { nombre: 'Creciente de La Niña', cambios: { clima: 'nina' } },
  dique: { nombre: 'Canal del Dique ampliado', cambios: { anchoDique: 200, profDique: 7 } },
  compuertas: { nombre: 'Canal del Dique con compuertas', cambios: { aperturaDique: 0.3 } },
  represas: { nombre: 'Represas en la cuenca: el río trae una cuarta parte del sedimento', cambios: { C0: 150 } },
  deforestacion: { nombre: 'Cuenca deforestada: más sedimento', cambios: { C0: 900, agradacion: 30 } },
  sinDragado: { nombre: 'Sin dragado del canal de acceso', cambios: { dragadoAuto: false } },
  oleaje: { nombre: 'Oleaje más fuerte (mar de leva frecuente)', cambios: { Hs: 3, Tp: 9 } },
  mar: { nombre: 'Ascenso rápido del mar y subsidencia', cambios: { ascensoMar: 10, subsidencia: 10 } },
};

export const clima = (p) => CLIMAS[p.clima] ?? CLIMAS.normal;
const diaDelAno = (t) => Math.floor(t / M.SEG_DIA) % 365 + 1;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** Fracción del caudal que toma el Canal del Dique. */
export function fraccionDique(p) {
  const [, fd] = M.reparto([
    { B: p.anchoRio, h: p.profRio, n: p.nRio, S: p.pendRio },
    { B: p.anchoDique, h: p.profDique, n: p.nDique, S: p.pendDique, apertura: p.aperturaDique },
  ]);
  return fd;
}

/** Forzantes y estado del canal en el instante t con la profundidad h. */
export function forzantes(p, t, h, L = 0) {
  const d = diaDelAno(t);
  const cl = clima(p);
  const Q = M.caudalRio(d, p.Qm * cl.fQ, p.A1, p.d1, p.A2, p.d2);
  const C = M.concentracion(Q, p.Qm, p.C0, p.bSed);
  const fD = fraccionDique(p);
  const Qd = fD * Q;
  const Qp = Q - Qd;
  const U = Qp / (p.anchoCanal * h);
  const heq = limitar(M.profundidadRegimen(Qp, p.anchoCanal, p.Uc), 1, p.profMaxCanal);
  const gp = M.gReducida(p.Smar);
  const Fr = M.froudeDensimetrico(U, gp, h);
  const Leq = Math.min(SITIO.Lmax, M.cunaSalina(h, p.Ci, Fr));
  const Lp = M.escalaPluma(U, p.hPluma, p.wsPluma / 1000);
  const alcance = M.alcancePluma(C, Lp, p.Cvis);
  const us = M.velocidadFriccion(U, h, p.z0);
  return { d, Q, C, Qs: M.carga(Q, C), fD, Qd, Qp, U, heq, gp, Fr, Leq, Lp, alcance, us, tau: M.esfuerzoFondo(us), h, L };
}

/** Avanza dt segundos (pasos de 6 h como máximo). */
export function avanzar(p, sim, dt) {
  let resta = dt;
  while (resta > 1e-9) {
    const paso = Math.min(21600, resta);
    const t0 = sim.t + (dt - resta);
    const ano = Math.floor(t0 / M.SEG_ANO);
    if (sim.ano !== undefined && ano !== sim.ano) sim.dragado = 0;   // el volumen dragado se cuenta por año
    sim.ano = ano;
    const q = forzantes(p, t0, sim.h);
    sim.L = M.relajar(sim.L, q.Leq, paso, SITIO.tauCuna);
    let h = M.relajar(sim.h, q.heq, paso, p.tauCanal * M.SEG_DIA);
    if (p.dragadoAuto && h < p.calado) {
      const objetivo = p.calado + SITIO.margenDragado;
      sim.dragado += (objetivo - h) * p.anchoCanal * p.largoCanal;
      h = objetivo;
    }
    sim.h = h;
    resta -= paso;
  }
}

/** Un año simulado cada 6 h: medias de cada mes. */
function simularAno(p, sim) {
  const meses = [];
  let toneladas = 0, diasBajo = 0;
  sim.dragado = 0;
  sim.ano = 0;
  for (let k = 0; k < 12; k++) {
    const ac = { Q: 0, Qp: 0, Qd: 0, C: 0, Qs: 0, U: 0, h: 0, hmin: Infinity, L: 0, Lmax: 0, Fr: 0, alcance: 0, n: 0 };
    const drag0 = sim.dragado;
    for (let j = 0; j < DIAS_MES[k] * 4; j++) {
      const q = forzantes(p, sim.t, sim.h);
      ac.Q += q.Q; ac.Qp += q.Qp; ac.Qd += q.Qd; ac.C += q.C; ac.Qs += q.Qs; ac.U += q.U; ac.h += sim.h; ac.L += sim.L; ac.Fr += q.Fr; ac.alcance += q.alcance; ac.n++;
      ac.hmin = Math.min(ac.hmin, sim.h); ac.Lmax = Math.max(ac.Lmax, sim.L);
      if (sim.h < p.calado - 1e-9) diasBajo += 0.25;
      toneladas += (q.Qs * 21600) / 1000;
      avanzar(p, sim, 21600);
      sim.t += 21600;
    }
    const n = ac.n;
    meses.push({
      mes: MESES[k], Q: ac.Q / n, Qp: ac.Qp / n, Qd: ac.Qd / n, C: ac.C / n, Qs: ac.Qs / n, U: ac.U / n,
      h: ac.h / n, hmin: ac.hmin, L: ac.L / n, Lmax: ac.Lmax, Fr: ac.Fr / n, alcance: ac.alcance / n, dragado: sim.dragado - drag0,
    });
  }
  return { meses, toneladas, diasBajo, dragado: meses.reduce((a, m) => a + m.dragado, 0) };
}

let memo = { clave: '', valor: null };
/** Año de régimen: un año de arranque y un año medido. */
export function anoMensual(p) {
  const clave = JSON.stringify(p);
  if (memo.clave === clave) return memo.valor;
  const sim = { t: 0, L: 1000, h: p.calado + 1, dragado: 0 };
  simularAno(p, sim);
  sim.t = 0;
  const inicio = { L: sim.L, h: sim.h };
  const r = simularAno(p, sim);
  const m = r.meses;
  const media = (k) => m.reduce((a, x) => a + x[k], 0) / 12;
  const valor = {
    meses: m, inicio,
    Mt: r.toneladas, diasBajo: r.diasBajo, dragado: r.dragado,
    Q: media('Q'), Qp: media('Qp'), Qd: media('Qd'), C: media('C'), Qs: media('Qs'),
    Qmin: Math.min(...m.map((x) => x.Q)), Qmax: Math.max(...m.map((x) => x.Q)),
    Lmax: Math.max(...m.map((x) => x.Lmax)), hmin: Math.min(...m.map((x) => x.hmin)),
  };
  memo = { clave, valor };
  return valor;
}

export function estadoInicial(p) {
  const a = anoMensual(p);
  return { t: 0, L: a.inicio.L, h: a.inicio.h, dragado: 0, ano: 0 };
}

/** El delta en el año: sedimento que se queda, oleaje, avance, mar y avulsión. */
export function delta(p, a) {
  const Vs = (p.fRetencion * a.Mt) / p.rhoB;                 // m³/año que se quedan en el frente
  const Hb = M.alturaRotura(p.Hs, p.Tp);
  const Qls = M.transporteLitoral(Hb, p.anguloOla);          // m³/s
  const Vls = Qls * M.SEG_ANO;
  const Vneto = Vs - Vls;
  const R = Vls > 0 ? Vs / Vls : Infinity;
  const H = p.profFrente + p.cotaLlanura;
  const avance = M.avanceFrente(Vneto, p.anchoFrente * 1000, H);
  const r0 = p.radioLobulo * 1000;
  const area0 = M.areaLobulo(r0);
  const area50 = M.areaLobulo(Math.max(0, r0 + 50 * avance));
  const rslr = p.subsidencia + p.ascensoMar;
  const anosMar = M.anosHastaMar(p.cotaLlanura - p.nivelMar, rslr);
  const anosAv = M.anosAvulsion(p.beta, p.profRio, p.sobreelevacion, p.agradacion);
  return { Vs, Hb, Qls, Vls, Vneto, R, H, avance, r0, area0, area50, rslr, anosMar, anosAv, tipo: M.tipoDelta(R, p.rangoMarea), claseMarea: M.claseMarea(p.rangoMarea) };
}

export function calcular(p, sim) {
  const t = sim.t ?? 0;
  const hora = (t / 3600) % 24;
  const q = forzantes(p, t, sim.h, sim.L);
  const a = anoMensual(p);
  const fecha = fechaDeDia(q.d);
  const de = delta(p, a);
  const mesAhora = a.meses[fecha.mes];
  const Cplaya = M.concentracionPluma(SITIO.xPlaya * 1000, a.C, M.escalaPluma(p.Uc, p.hPluma, p.wsPluma / 1000));
  const r = {
    t, hora, fecha, q, a, de, mesAhora, Cplaya,
    L: sim.L, h: sim.h, dragado: sim.dragado,
    fD: q.fD, toma: sim.L >= p.xToma * 1000,
  };
  r.revision = revisionCompleta(p, r);
  return r;
}

export function revisionCompleta(p, r) {
  const rio = [], can = [], cun = [], plu = [], ava = [], ola = [], dra = [];
  const { a, de } = r;
  revisar(rio, 'Sedimento del año ≥ 50 millones de toneladas (alimenta el delta y las playas)', a.Mt >= 50e6, `${fmt(a.Mt / 1e6, 1)} Mt/año`, { nivelFalla: 'aviso', corregir: 'Las represas atrapan el sedimento: el delta y las playas se quedan sin arena.' });
  revisar(rio, 'Caudal mínimo del año ≥ 2 500 m³/s (navegación del río)', a.Qmin >= 2500, `${fmt(a.Qmin, 0)} m³/s`, { nivelFalla: 'aviso', corregir: 'En la sequía el río se vuelve poco profundo para los remolcadores.' });
  revisar(can, 'El Canal del Dique lleva ≤ 10 % del caudal (sedimento hacia la bahía de Cartagena)', r.fD <= 0.1, `${fmt(100 * r.fD, 1)} %`, { corregir: 'Controlar la entrada del Dique con compuertas o esclusas.' });
  revisar(can, 'La avulsión del cauce tarda más de 100 años', de.anosAv > 100, `${fmt(de.anosAv, 0)} años`, { nivelFalla: 'aviso', corregir: 'El cauce se eleva sobre la llanura: hay que vigilar los diques.' });
  revisar(cun, 'La cuña salina no llega a la bocatoma en el peor momento del año', a.Lmax < p.xToma * 1000, `${fmt(a.Lmax / 1000, 2)} km (toma a ${fmt(p.xToma, 1)} km)`, { corregir: 'Con poco caudal y el canal dragado, el agua de mar entra por el fondo: subir la toma o llevarla aguas arriba.' });
  revisar(plu, `Sedimento a ${SITIO.xPlaya} km de la boca (playas) ≤ 150 mg/L`, r.Cplaya <= 150, `${fmt(r.Cplaya, 0)} mg/L`, { nivelFalla: 'aviso', corregir: 'Menos erosión en la cuenca: agua más clara en las playas.' });
  revisar(ava, 'El frente del delta no retrocede (volumen neto ≥ 0)', de.Vneto >= 0, `${fmt(de.Vneto / 1e6, 2)} hm³/año`, { corregir: 'Sin sedimento del río el oleaje se come el delta.' });
  revisar(ava, 'La llanura del delta sigue sobre el mar más de 100 años', de.anosMar > 100, `${fmt(de.anosMar, 0)} años`, { corregir: 'Con el ascenso del mar y la subsidencia el delta se hunde: hay que dejar que el río lo inunde y lo rellene.' });
  revisar(ola, 'El río domina sobre el oleaje (R ≥ 1)', de.R >= 1, `R = ${fmt(de.R, 2)} (${de.tipo})`, { nivelFalla: 'aviso', corregir: 'Con poco sedimento o mucho oleaje el delta se alisa y retrocede.' });
  revisar(dra, 'Profundidad del canal ≥ calado todo el año', a.diasBajo === 0, a.diasBajo === 0 ? `mínima ${fmt(a.hmin, 2)} m` : `${fmt(a.diasBajo, 0)} días por debajo de ${fmt(p.calado, 1)} m`, { corregir: 'Dragar el canal de acceso en la temporada seca.' });
  revisar(dra, 'Volumen dragado ≤ 5 millones de m³ al año', a.dragado <= 5e6, `${fmt(a.dragado / 1e6, 2)} hm³/año`, { nivelFalla: 'aviso', corregir: 'Más sedimento o más calado: más dragado y más costo.' });
  return { rio, canales: can, cuna: cun, pluma: plu, avance: ava, oleaje: ola, dragado: dra };
}
