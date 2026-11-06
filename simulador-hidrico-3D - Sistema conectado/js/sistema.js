/**
 * sistema.js — El sistema conectado: parámetros, reloj del año, cadena y revisión.
 * -----------------------------------------------------------------------
 * Une los siete eslabones de la serie (laguna, lago, río, ciénaga, delta, océano y playa) con
 * cadena.js. El reloj recorre el año de régimen día a día: los valores de cada día se
 * interpolan entre las medias de los meses que entrega cada modelo. Las comparaciones (El Niño
 * y La Niña, los horizontes) se calculan cuando se piden y quedan en memoria.
 * Funciones puras (sin DOM): se prueban con Node.
 */
import { MODULOS, NODOS, faltan } from './proyectos.js';
import * as C from './cadena.js';
import { fmt, revisar, fechaDeDia, listaY } from './nucleo/formato.js';
import { validarFrontera } from './nucleo/conexion.js';

export { MODULOS, NODOS, faltan };

export const PARAMETROS = Object.freeze({
  escenario: 'base',
  clima: 'normal',            // 'normal' | 'nino' | 'nina' (el mismo para toda la cadena)
  horizonte: 'hoy',           // 'hoy' | 'a2050' | 'a2100bajo' | 'a2100alto'
  acoplar: true,              // false: cada proyecto solo, con sus valores de referencia
  esc_lagunas: 'base', esc_lagos: 'base', vertRio: 'tratada', esc_cienagas: 'base',
  esc_deltas: 'base', esc_oceanos: 'base', esc_costas: 'base',
  // Fronteras fijadas por archivo o en vivo (reemplazan al modelo de ese eslabón)
  fr_lagunas: null, fr_lagos: null, fr_rios: null, fr_cienagas: null, fr_deltas: null, fr_oceanos: null, fr_costas: null,
});

export const ESCENARIOS = {
  base: { nombre: 'Del páramo al mar hoy (año normal, sin intervenciones)', cambios: {} },
  nino: { nombre: 'El Niño en toda la cadena', cambios: { clima: 'nino' } },
  nina: { nombre: 'La Niña en toda la cadena', cambios: { clima: 'nina' } },
  cuencas: { nombre: 'Cuencas intervenidas: páramo degradado, cebolla, aguas residuales y deforestación', cambios: { esc_lagunas: 'degradado', esc_lagos: 'cebolla', vertRio: 'domestica', esc_deltas: 'deforestacion' } },
  agua: { nombre: 'Más agua para las ciudades: tomas más grandes en la laguna y en el lago', cambios: { esc_lagunas: 'extraccion', esc_lagos: 'extraccion' } },
  represas: { nombre: 'Represas en la cuenca del río grande: menos arena para la playa', cambios: { esc_deltas: 'represas' } },
  restauracion: { nombre: 'Restauración: caños dragados en la ciénaga y relleno de playa', cambios: { esc_cienagas: 'restauracion', esc_costas: 'relleno' } },
  a2050: { nombre: 'Horizonte 2050', cambios: { horizonte: 'a2050' } },
  a2100alto: { nombre: 'Horizonte 2100 con muchas emisiones', cambios: { horizonte: 'a2100alto' } },
  ninoFuturo: { nombre: 'El Niño en 2100 con muchas emisiones', cambios: { clima: 'nino', horizonte: 'a2100alto' } },
  aislado: { nombre: 'Proyectos sin conectar (cada uno con sus valores de referencia)', cambios: { acoplar: false } },
};

export const SEG_DIA = 86400;

export function estadoInicial() {
  return { t: 0 };
}

/** El año de régimen se repite: el reloj solo avanza el día (el estado está en la cadena). */
export function avanzar() {}

// ── Cadena con memoria ─────────────────────────────────────────────────────
const CLAVES_CADENA = Object.keys(PARAMETROS).filter((k) => k !== 'escenario');
const memoCadena = new Map();
/** La cadena para unos parámetros (queda en memoria: los modelos son funciones puras). */
export function cadena(p, cambios = {}) {
  const q = { ...p, ...cambios };
  const clave = JSON.stringify(CLAVES_CADENA.map((k) => q[k] ?? null));
  if (memoCadena.has(clave)) return memoCadena.get(clave);
  const c = C.calcularCadena(MODULOS, q);
  memoCadena.set(clave, c);
  if (memoCadena.size > 24) memoCadena.delete(memoCadena.keys().next().value);
  return c;
}

/** El mismo sistema con los tres climas del año. */
export const compararClimas = (p) => Object.fromEntries(Object.keys(C.CLIMAS).map((k) => [k, cadena(p, { clima: k })]));
/** El mismo sistema en los cuatro horizontes. */
export const compararHorizontes = (p) => Object.fromEntries(Object.keys(C.HORIZONTES).map((k) => [k, cadena(p, { horizonte: k })]));

// ── Indicadores de cada eslabón ─────────────────────────────────────────────
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);

/** Los números clave de cada eslabón (NaN si el eslabón viene de una frontera sin modelo). */
export function indicadores(cad) {
  const n = cad.nodos;
  const s = (id) => n[id].f.salida;
  const meses = (id) => n[id].m;
  const L = n.lagunas.r, K = n.lagos.r, R = n.rios.r, Ci = n.cienagas.r, D = n.deltas.r, O = n.oceanos.r, P = n.costas.r;
  const secos = (id) => meses(id).filter((m) => !(m.Q > 1e-6)).map((m) => m.mes);
  return {
    laguna: {
      Q: s('lagunas').Q, tauDias: num(L?.laguna?.tauDias), V: num(L?.V), T: s('lagunas').temperatura, OD: s('lagunas').OD,
      P: s('lagunas').fosforo, SS: s('lagunas').sedimento, secos: secos('lagunas'), glaciar: num(L?.bal?.Qg), Qin: num(L?.bal?.Qin),
    },
    lago: {
      Q: s('lagos').Q, tauAnos: num(K?.nu?.tau), V: num(K?.mo?.V), Qin: num(K?.bal?.Qin), Qevap: num(K?.bal?.Qevap), Qext: num(K?.bal?.Qexterno),
      T: s('lagos').temperatura, P: s('lagos').fosforo, clase: K?.nu?.clase ?? '—', secos: secos('lagos'),
    },
    rio: {
      Q: s('rios').Q, Qcuenca: num(R?.a?.Qcuenca), Qlago: num(R?.a?.Qlago), tViaje: num(R?.a?.tViaje), SS: s('rios').sedimento, P: s('rios').fosforo,
      OD: s('rios').OD, odMin: num(R?.a?.odMin), DBO: s('rios').DBO, CF: s('rios').coliformes, N: s('rios').nitrogeno, sinCaptar: R?.a?.mesesSinCaptar ?? [],
      Qmin: num(R?.a?.Qmin), Qmax: num(R?.a?.Qmax),
    },
    cienaga: {
      Q: s('cienagas').Q, S: s('cienagas').salinidad, Smax: num(Ci?.a?.Smax), Smin: num(Ci?.a?.Smin), tauDias: num(Ci?.tauDias), V: num(Ci?.V),
      P: s('cienagas').fosforo, OD: s('cienagas').OD, sedMm: num(Ci?.sed?.mm), Qr: num(Ci?.a?.Qr), Qc: num(Ci?.a?.Qc), Qm: num(Ci?.a?.Qm), Qe: num(Ci?.a?.Qe),
      Qd: num(Ci?.a?.Qd), nivel: s('cienagas').nivel, salud: num(Ci?.saludPeor),
    },
    delta: {
      Q: s('deltas').Q, C: s('deltas').sedimento, Qs: s('deltas').Qs, Mt: num(D?.a?.Mt) / 1e6, Lmax: num(D?.a?.Lmax), hmin: num(D?.a?.hmin),
      Vneto: num(D?.de?.Vneto), anosMar: num(D?.de?.anosMar), dragado: num(D?.a?.dragado), Qmin: num(D?.a?.Qmin), Cplaya: num(D?.Cplaya),
    },
    oceano: {
      nivel: num(n.oceanos.f.mar?.nivelMedio), ascenso: num(n.oceanos.f.mar?.ascenso), marea: num(n.oceanos.f.mar?.marea), Hs: num(n.oceanos.f.mar?.Hs),
      Tp: num(n.oceanos.f.mar?.Tp), Smar: num(n.oceanos.f.mar?.salinidad), T: num(n.oceanos.f.mar?.temperatura), Tgmin: num(O?.a?.Tgmin),
      dhwMax: num(O?.a?.dhwMax), alerta: O?.alertaPeor?.nombre ?? '—', Spluma: num(O?.pl?.S), Sarrecife: num(O?.pl?.Sarrecife), pH: num(O?.fu?.pH), Om: num(O?.fu?.Om),
      Qoc: num(cad.trazador.flujos.Qoc), Hsmax: num(O?.a?.Hsmax),
    },
    playa: {
      Hs: num(P?.a?.Hs), Hb: num(P?.a?.Hb), dW: num(P?.a?.dW), balance: num(P?.a?.balance), W: num(P?.W), W50: num(P?.W50), bruun50: num(P?.bruun50),
      TWLmax: num(P?.a?.TWLmax), col: num(P?.col?.C), aporte: num(n.costas.pn?.aporte), Hs0: num(n.costas.pn?.Hs0), Qs: s('costas').Qs,
    },
  };
}

/** Edad media del agua al llegar al mar por la cadena del páramo [días]: suma de residencias. */
export function edadAgua(ind) {
  const tramos = [
    { id: 'lagunas', nombre: 'Laguna', dias: ind.laguna.tauDias },
    { id: 'lagos', nombre: 'Lago', dias: ind.lago.tauAnos * 365 },
    { id: 'rios', nombre: 'Río', dias: ind.rio.tViaje },
    { id: 'cienagas', nombre: 'Ciénaga', dias: ind.cienaga.tauDias },
  ];
  let acum = 0;
  for (const t of tramos) { acum += Number.isFinite(t.dias) ? t.dias : 0; t.acumulado = acum; }
  return { tramos, total: acum };
}

// ── Reloj ──────────────────────────────────────────────────────────────────
const VARIABLES_DIA = ['Q', 'temperatura', 'salinidad', 'sedimento', 'fosforo', 'Hs', 'Tp', 'nivel', 'Qs', 'Hb', 'ancho', 'dhw', 'afloramiento', 'cuna'];

export function calcular(p, sim) {
  const cad = cadena(p);
  const t = sim.t ?? 0;
  const diaAno = (t / SEG_DIA) % 365;
  const fecha = fechaDeDia(Math.floor(diaAno) + 1);
  const hoy = {};
  for (const id of C.ORDEN) {
    const m = cad.nodos[id].m;
    hoy[id] = {};
    for (const k of VARIABLES_DIA) if (m.every((x) => Number.isFinite(x[k]))) hoy[id][k] = C.valorDia(m.map((x) => x[k]), diaAno);
  }
  const ind = indicadores(cad);
  const r = { t, diaAno, fecha, mes: fecha.mes, cad, hoy, ind, edad: edadAgua(ind) };
  r.revision = revision(p, r);
  return r;
}

// ── Revisión ───────────────────────────────────────────────────────────────
/** Un criterio del simulador de un eslabón (por el comienzo de su texto), con el nombre del eslabón. */
function criterio(cad, id, inicio) {
  const c = cad.nodos[id].revision.lista.find((x) => x.texto.startsWith(inicio));
  return c ? { ...c, texto: `${C.NOMBRES[id]} · ${c.texto}` } : null;
}

const CRITERIOS_TAB = {
  caudal: [['lagunas', 'Rebosa todos los meses'], ['lagos', 'Desagua todos los meses'], ['rios', 'La bocatoma capta todo el año'], ['cienagas', 'Agua dulce del año'], ['cienagas', 'Tiempo de residencia'], ['deltas', 'Caudal mínimo del año']],
  calidad: [['lagos', 'Fósforo total'], ['rios', 'Oxígeno disuelto mínimo del río'], ['cienagas', 'Salinidad máxima del año'], ['cienagas', 'Oxígeno mínimo de la madrugada'], ['costas', 'Coliformes en la playa']],
  sedimento: [['lagunas', 'Pérdida de volumen por sedimentos'], ['cienagas', 'Sedimentación'], ['deltas', 'Sedimento del año'], ['deltas', 'El frente del delta no retrocede'], ['costas', 'Balance de arena del año'], ['costas', 'Ancho de playa en 50 años']],
  mar: [['oceanos', 'Ascenso del mar en'], ['cienagas', 'Nivel máximo del año'], ['deltas', 'La cuña salina no llega'], ['deltas', 'La llanura del delta sigue sobre el mar'], ['costas', 'Retroceso por el ascenso del mar'], ['costas', 'Nivel total máximo del año']],
  clima: [['lagunas', 'Lluvia del año'], ['cienagas', 'Salud del manglar en el peor mes'], ['oceanos', 'Sin alerta de blanqueamiento'], ['deltas', 'Volumen dragado']],
};

export function revision(p, r) {
  const { cad, ind } = r;
  const red = [];
  const faltantes = C.ORDEN.filter((id) => cad.nodos[id].fuente === 'referencia');
  revisar(red, 'Los siete proyectos de la serie están cargados', faltantes.length === 0,
    faltantes.length ? `Faltan ${listaY(faltantes.map((id) => C.NOMBRES[id]))}: se usan sus valores de referencia` : 'Laguna, lago, río, ciénaga, delta, océano y playa',
    { corregir: 'Pon todas las carpetas de la serie juntas y sirve la carpeta que las contiene (python -m http.server).' });
  if (cad.acoplar) {
    const it = cad.iteraciones;
    revisar(red, 'El lazo ciénaga ⇄ delta ⇄ océano converge (error relativo < 10⁻⁶)', cad.convergio,
      `${it.length - 1} iteraciones; error final ${it[it.length - 1].error === 0 ? '0 (exacto)' : it[it.length - 1].error.toExponential(1).replace('-', '−')}`, { corregir: 'Revisa los parámetros de la ciénaga, el delta y el océano.' });
  }
  const malas = cad.enlaces.filter((e) => !e.valida);
  revisar(red, `Las fronteras de los ${cad.enlaces.length} enlaces cumplen el contrato de la serie`, malas.length === 0,
    malas.length ? `No cumplen: ${malas.map((e) => `${C.NOMBRES[e.de]} → ${C.NOMBRES[e.a]}`).join(', ')}` : 'Caudal y magnitudes con sus unidades', { corregir: 'Revisa el archivo de frontera importado.' });
  for (const id of C.ORDEN) {
    const n = cad.nodos[id];
    if (n.fuente !== 'modelo') {
      red.push({ nivel: 'aviso', texto: `${C.NOMBRES[id]}: ${n.fuente === 'frontera' ? 'usa la frontera importada' : 'usa sus valores de referencia'}`, detalle: 'Sin su modelo no se revisan sus criterios', corregir: '' });
      continue;
    }
    const rv = n.revision;
    const alerta = rv.fallas.some((c) => c.nivel === 'alerta');
    red.push({
      nivel: rv.fallas.length === 0 ? 'ok' : (alerta ? 'alerta' : 'aviso'),
      texto: `${C.NOMBRES[id]}: ${rv.ok} de ${rv.total} criterios de su simulador se cumplen`,
      detalle: rv.fallas.length ? `No se cumple: ${rv.fallas.map((c) => c.texto).join('; ')}` : 'Todos se cumplen',
      corregir: rv.fallas[0]?.corregir ?? '',
    });
  }
  const out = { red };
  for (const [tab, lista] of Object.entries(CRITERIOS_TAB)) out[tab] = lista.map(([id, ini]) => criterio(cad, id, ini)).filter(Boolean);
  // Propios del sistema
  const T = cad.trazador;
  const sumaMax = Math.max(...T.F.map((f) => Math.abs(f.reduce((a, b) => a + b, 0) - 1)));
  out.calidad.unshift(
    { ...revisarUno('Balance de los trazadores: las fracciones de cada cuerpo suman 1', sumaMax < 1e-9, `desviación máxima ${sumaMax.toExponential(1).replace('-', '−')}`) },
    { ...revisarUno('La salinidad frente a las bocas que dan los trazadores coincide con la del océano (± 1 PSU)', Math.abs(T.F[5][2] * ind.oceano.Smar - ind.oceano.Spluma) <= 1 || !Number.isFinite(ind.oceano.Spluma),
      `${fmt(T.F[5][2] * ind.oceano.Smar, 2)} PSU con los trazadores; ${fmt(ind.oceano.Spluma, 2)} PSU en el océano`, 'aviso') },
  );
  const secos = [...ind.laguna.secos.map((m) => `laguna en ${m}`), ...ind.lago.secos.map((m) => `lago en ${m}`), ...ind.rio.sinCaptar.map((m) => `bocatoma en ${m}`)];
  out.clima.unshift(revisarUno('El agua baja del páramo al mar todos los meses (laguna, lago y río sin meses secos)', secos.length === 0,
    secos.length ? `Se cortan: ${secos.join(', ')}` : 'Los doce meses', 'alerta', 'Con El Niño hay que reducir las tomas de la laguna y del lago para que el agua siga bajando.'));
  return out;
}

function revisarUno(texto, cumple, detalle, nivelFalla = 'alerta', corregir = '') {
  const l = [];
  revisar(l, texto, cumple, detalle, { nivelFalla, corregir });
  return l[0];
}

/** ¿Es válida la frontera fijada de un eslabón? (para la pestaña de conexión) */
export const fronteraValida = (fr) => Boolean(fr) && validarFrontera(fr).ok;
