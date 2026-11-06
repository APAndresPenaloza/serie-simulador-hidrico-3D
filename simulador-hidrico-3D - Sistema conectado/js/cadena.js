/**
 * cadena.js — Encadena los modelos de la serie del páramo al océano (funciones puras).
 * -----------------------------------------------------------------------
 * Cada proyecto es una función: recibe sus parámetros (con lo que le entregan sus vecinos) y
 * devuelve su frontera de salida. El sistema conectado compone esas funciones en el orden de
 * la red:
 *     laguna → lago → río → ciénaga ⇄ delta ⇄ océano → playa
 * La laguna, el lago y el río forman una cadena simple (composición de funciones). La ciénaga,
 * el delta y el océano se reciben datos unos a otros (lazo): se resuelven con una iteración de
 * punto fijo (estilo Gauss-Seidel) hasta que lo que se intercambian deja de cambiar.
 * Las fronteras se intercambian con promedios del año; cada proyecto arma su año mes a mes con
 * su propio modelo (nodo.mensual). El río recibe el lago mes a mes.
 * Al final se resuelve el sistema lineal de los trazadores: qué fracción del agua de cada
 * cuerpo viene de la laguna, del río grande, del mar abierto o de la lluvia local.
 */
import { crearFrontera, validarFrontera, RED } from './nucleo/conexion.js';
import { gaussJordan, errorRelativo, identidad, adyacencia, alcanzabilidad, potencia } from './algebra.js';
import { REFERENCIA } from './referencia.js';

export const ORDEN = ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas', 'oceanos', 'costas'];
export const NOMBRES = { lagunas: 'Laguna', lagos: 'Lago', rios: 'Río', cienagas: 'Ciénaga', deltas: 'Delta', oceanos: 'Océano', costas: 'Playa' };
export const CUERPOS = {
  lagunas: 'Laguna glaciar del páramo', lagos: 'Lago andino', rios: 'Río de la Sierra Nevada', cienagas: 'Ciénaga Grande (laguna costera)',
  deltas: 'Delta del río grande', oceanos: 'Mar Caribe', costas: 'Playa de bahía',
};
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const SEG_ANO = 365 * 86400;

/** Climas del año (los mismos ids en todos los proyectos). */
export const CLIMAS = {
  normal: { nombre: 'Año normal' },
  nino: { nombre: 'El Niño (año seco)' },
  nina: { nombre: 'La Niña (año lluvioso)' },
};

/**
 * Horizontes: el mismo año futuro para toda la cadena. El océano fija el ascenso del mar, el
 * calor y el CO₂ (y por su frontera el nivel de la ciénaga, el delta y la playa); la laguna
 * pierde glaciar con los años y el lago se calienta como la superficie del mar.
 */
export const HORIZONTES = {
  hoy: { nombre: 'Hoy (2026)', ano: 2026, lagunas: { anosFuturo: 0 }, lagos: { calentamiento: 0 }, oceanos: {} },
  a2050: { nombre: '2050 (emisiones intermedias)', ano: 2050, lagunas: { anosFuturo: 24 }, lagos: { calentamiento: 0.48 }, oceanos: { anoHorizonte: 2050 } },
  a2100bajo: { nombre: '2100 con pocas emisiones', ano: 2100, lagunas: { anosFuturo: 74 }, lagos: { calentamiento: 0.74 }, oceanos: { anoHorizonte: 2100, rCO2: 0.002, calentamiento: 0.01, aceleracion: 0.02 } },
  a2100alto: { nombre: '2100 con muchas emisiones', ano: 2100, lagunas: { anosFuturo: 74 }, lagos: { calentamiento: 2.59 }, oceanos: { anoHorizonte: 2100, rCO2: 0.009, calentamiento: 0.035, aceleracion: 0.08 } },
};
const CLAVES_HORIZONTE = ['anosFuturo', 'anoHorizonte', 'rCO2', 'aceleracion'];

/**
 * Intervenciones de cada eslabón: escenarios de su propio simulador (sin los que cambian el
 * clima, el horizonte o lo que llega por la conexión, que aquí fija el sistema).
 */
export const INTERVENCIONES = {
  lagunas: ['base', 'degradado', 'papa', 'truchas', 'turbia', 'morrena', 'extraccion'],
  lagos: ['base', 'cebolla', 'truchas', 'aguas', 'calentamiento', 'extraccion'],
  cienagas: ['base', 'carretera', 'restauracion', 'boca', 'eutrofizacion'],
  deltas: ['base', 'dique', 'compuertas', 'represas', 'deforestacion', 'sinDragado', 'mar'],
  oceanos: ['base', 'alisios'],
  costas: ['base', 'leva', 'tormenta', 'espolon', 'relleno', 'sinTratamiento', 'emisarioCorto'],
};
const NOMBRE_INTERVENCION = {
  base: 'Sin intervención (referencia)',
  'cienagas:eutrofizacion': 'Magdalena cargado de nutrientes (450 µg/L de fósforo)',
  'deltas:mar': 'Subsidencia rápida del delta (10 mm/año)',
  'costas:relleno': 'Relleno de playa de 80 000 m³ de arena al año',
  'lagos:calentamiento': 'Calentamiento de 3 °C y menos viento (se suma al del horizonte)',
};

/** Claves de un proyecto que fija la conexión (las de sus entradas). */
export const clavesConexion = (mod) => new Set((mod?.N?.entradas ?? []).flatMap((e) => e.claves ?? []));

/** Lista de intervenciones disponibles de un eslabón: [{ valor, nombre, cambios }]. */
export function intervenciones(mods, id) {
  const mod = mods[id];
  if (!mod?.ok || !mod.S) return [{ valor: 'base', nombre: NOMBRE_INTERVENCION.base, cambios: {} }];
  const fijas = clavesConexion(mod);
  return (INTERVENCIONES[id] ?? ['base'])
    .filter((k) => mod.S.ESCENARIOS?.[k])
    .map((k) => {
      const cambios = Object.fromEntries(Object.entries(mod.S.ESCENARIOS[k].cambios ?? {})
        .filter(([c]) => c !== 'clima' && !fijas.has(c) && !CLAVES_HORIZONTE.includes(c)));
      return { valor: k, nombre: NOMBRE_INTERVENCION[`${id}:${k}`] ?? (k === 'base' ? NOMBRE_INTERVENCION.base : mod.S.ESCENARIOS[k].nombre), cambios };
    });
}

/** Parámetros de un eslabón: los de su simulador + su intervención + el clima y el horizonte. */
export function parametrosNodo(mods, id, p) {
  const mod = mods[id];
  const op = intervenciones(mods, id).find((o) => o.valor === p[`esc_${id}`]) ?? { cambios: {} };
  const h = HORIZONTES[p.horizonte] ?? HORIZONTES.hoy;
  const pn = { ...structuredClone(mod.S.PARAMETROS), ...structuredClone(op.cambios), clima: p.clima, escenario: p[`esc_${id}`] ?? 'base' };
  for (const [k, v] of Object.entries(h[id] ?? {})) pn[k] = k === 'calentamiento' && id === 'lagos' ? (pn[k] ?? 0) + v : v;
  return pn;
}

// ── Memoria de cálculos (los modelos son funciones puras de sus parámetros) ─────────────
const memo = new Map();
function memoizar(clave, fn, limite = 160) {
  if (memo.has(clave)) {
    const v = memo.get(clave);
    memo.delete(clave);
    memo.set(clave, v);
    return v;
  }
  const v = fn();
  memo.set(clave, v);
  if (memo.size > limite) memo.delete(memo.keys().next().value);
  return v;
}

/** Promedio del año de una magnitud de los meses (pesado por días o por días × caudal). */
export function promedioAno(meses, clave, porCaudal = false) {
  let s = 0, w = 0;
  meses.forEach((m, k) => {
    const v = m[clave];
    if (!Number.isFinite(v)) return;
    const peso = DIAS[k] * (porCaudal ? Math.max(0, m.Q ?? 0) : 1);
    s += v * peso;
    w += peso;
  });
  return w > 0 ? s / w : NaN;
}

const POR_DIAS = ['Q', 'nivel', 'temperatura', 'salinidad', 'Qs'];
const POR_CAUDAL = ['sedimento', 'fosforo', 'coliformes', 'DBO', 'nitrogeno'];

/** Frontera con los promedios del año (de los meses del propio modelo cuando los tiene). */
export function fronteraAnual(id, s, meses) {
  const salida = { ...(s.salida ?? {}) };
  const tiene = (k) => meses.some((m) => Number.isFinite(m[k]));
  for (const k of POR_DIAS) if (k in salida && tiene(k)) salida[k] = promedioAno(meses, k);
  for (const k of POR_CAUDAL) if (k in salida && tiene(k)) salida[k] = promedioAno(meses, k, promedioAno(meses, 'Q') > 0);
  const mar = s.mar ? { ...s.mar } : null;
  if (mar && tiene('Hs')) mar.Hs = promedioAno(meses, 'Hs');
  if (mar && tiene('Tp')) mar.Tp = promedioAno(meses, 'Tp');
  return crearFrontera(id, { nodo: s.nodo ?? CUERPOS[id], salida, mar, clima: s.clima ?? null, tiempo: { reloj: 'Promedio del año de régimen', segundos: 0 }, fecha: new Date(Date.UTC(2026, 0, 1)) });
}

/** Revisión de un proyecto: lista plana con la pestaña de cada criterio. */
function revisionDe(r) {
  const lista = Object.entries(r?.revision ?? {}).flatMap(([pestana, l]) => (Array.isArray(l) ? l : []).map((c) => ({ ...c, pestana })));
  return { lista, total: lista.length, ok: lista.filter((c) => c.nivel === 'ok').length, fallas: lista.filter((c) => c.nivel !== 'ok') };
}

// ── Evaluación de cada eslabón ─────────────────────────────────────────────
function nodoReferencia(id, motivo) {
  const ref = REFERENCIA[id];
  const f = crearFrontera(id, { nodo: ref.nodo, salida: ref.salida, mar: ref.mar ?? null, clima: { anio: 'normal' }, tiempo: { reloj: 'Valores de referencia', segundos: 0 }, fecha: new Date(Date.UTC(2026, 0, 1)) });
  return { id, fuente: 'referencia', motivo, f, m: ref.meses.map((x, k) => ({ mes: MESES[k], ...x })), r: null, pn: null, entradas: [], revision: revisionDe(null), flujos: ref.flujos ?? {} };
}

function nodoFijo(id, fr) {
  const f = structuredClone(fr);
  const m = MESES.map((mes) => ({ mes, ...f.salida, ...(f.mar ? { Hs: f.mar.Hs, Tp: f.mar.Tp } : {}) }));
  return { id, fuente: 'frontera', f, m, r: null, pn: null, entradas: [], revision: revisionDe(null), flujos: REFERENCIA[id]?.flujos ?? {} };
}

/** Aplica lo que le llega a un eslabón (fronteras de sus vecinos) sobre sus parámetros. */
function aplicarEntradas(mod, pn, llegan) {
  const aplicadas = [];
  for (const [origen, fr] of Object.entries(llegan)) {
    if (!fr) continue;
    const e = (mod.N.entradas ?? []).find((x) => x.origen === origen);
    if (!e) continue;
    const res = e.aplicar(pn, fr);
    if (!res) continue;
    Object.assign(pn, res.cambios);
    aplicadas.push({ origen, texto: res.texto ?? '', cambios: res.cambios });
  }
  return aplicadas;
}

/** Flujos de un eslabón para el sistema de trazadores [m³/s]. */
function flujosDe(id, nodo) {
  const r = nodo.r;
  if (!r) return nodo.flujos ?? REFERENCIA[id]?.flujos ?? {};
  if (id === 'lagos') return { Qin: r.bal.Qin, Qexterno: r.bal.Qexterno };
  if (id === 'rios') return { Qcuenca: r.a.Qcuenca, Qlago: r.a.Qlago };
  if (id === 'cienagas') return { Qd: r.a.Qd, Qm: r.a.Qm, Qr: r.a.Qr, Qc: r.a.Qc, Qe: r.a.Qe, Qrios: nodo.pn.Qrios };
  if (id === 'oceanos') return { Qoc: r.pl.V / (nodo.pn.renovacion * 86400) };
  return {};
}

/** Evalúa un eslabón con lo que le llega. mesesLago: el lago mes a mes (solo para el río). */
export function evaluarNodo(mods, id, p, llegan = {}, mesesLago = null) {
  const fija = p[`fr_${id}`];
  if (fija && validarFrontera(fija).ok) return nodoFijo(id, fija);
  const mod = mods[id];
  if (!mod?.ok) return nodoReferencia(id, mod?.error ?? 'no se cargó');
  if (id === 'rios') {
    const A = mod.A;
    const tipo = A.VERTIMIENTOS[p.vertRio] ? p.vertRio : 'tratada';
    const pn = { ...A.PARAMETROS, clima: p.clima, vertTipo: tipo, Qvert: tipo === 'tratada' ? A.PARAMETROS.Qvert : A.VERTIMIENTOS[tipo].Qtipico };
    const entradas = aplicarEntradas(mod, pn, llegan);
    const lago = entradas.length && mesesLago ? mesesLago.map((x) => ({ Q: x.Q, fosforo: x.fosforo, sedimento: x.sedimento })) : null;
    const res = memoizar(`rios|${JSON.stringify(pn)}|${JSON.stringify(lago)}`, () => A.calcular(pn, lago));
    const s = A.salida(pn, res);
    const nodo = { id, fuente: 'modelo', pn, m: res.meses, r: res, s, entradas, revision: { lista: res.revision.map((c) => ({ ...c, pestana: 'rio' })), total: res.revision.length, ok: res.revision.filter((c) => c.nivel === 'ok').length, fallas: res.revision.filter((c) => c.nivel !== 'ok') } };
    nodo.f = fronteraAnual(id, s, res.meses);
    nodo.flujos = flujosDe(id, nodo);
    return nodo;
  }
  const pn = parametrosNodo(mods, id, p);
  const entradas = aplicarEntradas(mod, pn, llegan);
  const { m, r, s } = memoizar(`${id}|${JSON.stringify(pn)}`, () => {
    const meses = mod.N.mensual(pn);
    const sim = { ...mod.S.estadoInicial(pn), t: 6 * 3600 };
    const rr = mod.S.calcular(pn, sim);
    return { m: meses, r: rr, s: mod.N.salida(pn, rr, sim) };
  });
  const nodo = { id, fuente: 'modelo', pn, m, r, s, entradas, revision: revisionDe(r) };
  nodo.f = fronteraAnual(id, s, m);
  nodo.flujos = flujosDe(id, nodo);
  return nodo;
}

/** Magnitudes que se intercambian en el lazo ciénaga ⇄ delta ⇄ océano. */
export const VARIABLES_LAZO = [
  { id: 'cienagas', clave: 'Q', nombre: 'Caudal que sale de la ciénaga', unidad: 'm³/s', dec: 1 },
  { id: 'cienagas', clave: 'salinidad', nombre: 'Salinidad de la ciénaga', unidad: 'PSU', dec: 2 },
  { id: 'deltas', clave: 'Q', nombre: 'Caudal del río grande en la boca', unidad: 'm³/s', dec: 0 },
  { id: 'deltas', clave: 'Qs', nombre: 'Carga de sedimento al mar', unidad: 'kg/s', dec: 0 },
  { id: 'oceanos', mar: true, clave: 'nivelMedio', nombre: 'Nivel medio del mar', unidad: 'm', dec: 3 },
  { id: 'oceanos', mar: true, clave: 'Hs', nombre: 'Altura significativa del oleaje', unidad: 'm', dec: 3 },
  { id: 'oceanos', mar: true, clave: 'salinidad', nombre: 'Salinidad del mar', unidad: 'PSU', dec: 2 },
];
const vectorLazo = (fr) => VARIABLES_LAZO.map((v) => (v.mar ? fr[v.id]?.mar?.[v.clave] : fr[v.id]?.salida?.[v.clave]) ?? 0);

/**
 * La cadena completa. p: parámetros del sistema (clima, horizonte, intervenciones, acoplar y
 * fronteras fijadas). Devuelve los eslabones, los enlaces, la iteración del lazo y los trazadores.
 */
export function calcularCadena(mods, p, { maxIter = 12, tol = 1e-6 } = {}) {
  const acoplar = p.acoplar !== false;
  const nodos = {};
  const fr = {};
  const recibe = (id) => (acoplar ? Object.fromEntries(RED[id].recibe.map((o) => [o, fr[o] ?? null])) : {});

  nodos.lagunas = evaluarNodo(mods, 'lagunas', p, {});
  fr.lagunas = nodos.lagunas.f;
  nodos.lagos = evaluarNodo(mods, 'lagos', p, recibe('lagos'));
  fr.lagos = nodos.lagos.f;
  nodos.rios = evaluarNodo(mods, 'rios', p, recibe('rios'), nodos.lagos.fuente === 'modelo' ? nodos.lagos.m : null);
  fr.rios = nodos.rios.f;

  // Semilla del lazo: cada eslabón solo, con sus propios valores de referencia
  const solo = {
    cienagas: evaluarNodo(mods, 'cienagas', p, {}),
    deltas: evaluarNodo(mods, 'deltas', p, {}),
    oceanos: evaluarNodo(mods, 'oceanos', p, {}),
  };
  fr.cienagas = solo.cienagas.f;
  fr.deltas = solo.deltas.f;
  fr.oceanos = solo.oceanos.f;
  const iteraciones = [{ k: 0, x: vectorLazo(fr), error: NaN }];
  let convergio = !acoplar;
  if (!acoplar) Object.assign(nodos, solo);
  for (let k = 1; acoplar && k <= maxIter; k++) {
    nodos.cienagas = evaluarNodo(mods, 'cienagas', p, recibe('cienagas'));
    fr.cienagas = nodos.cienagas.f;
    nodos.deltas = evaluarNodo(mods, 'deltas', p, recibe('deltas'));
    fr.deltas = nodos.deltas.f;
    nodos.oceanos = evaluarNodo(mods, 'oceanos', p, recibe('oceanos'));
    fr.oceanos = nodos.oceanos.f;
    const x = vectorLazo(fr);
    const error = errorRelativo(x, iteraciones[iteraciones.length - 1].x);
    iteraciones.push({ k, x, error });
    if (error < tol) { convergio = true; break; }
  }
  nodos.costas = evaluarNodo(mods, 'costas', p, recibe('costas'));
  fr.costas = nodos.costas.f;

  // Enlaces: lo que pasa por cada flecha de la red y cómo lo usa quien lo recibe
  const enlaces = [];
  for (const de of ORDEN) {
    for (const a of RED[de].entrega) {
      const usado = nodos[a].entradas?.find((e) => e.origen === de);
      enlaces.push({ de, a, frontera: fr[de], valida: validarFrontera(fr[de]).ok, texto: usado?.texto ?? (acoplar ? '' : 'Sin conexión: usa sus propios valores de referencia.'), cambios: usado?.cambios ?? {} });
    }
  }
  return { p: structuredClone(p), acoplar, nodos, fronteras: fr, enlaces, iteraciones, convergio, trazador: trazadores(nodos) };
}

/**
 * Sistema lineal de los trazadores. Incógnitas: la fracción del agua de cada cuerpo
 * (laguna, lago, río, ciénaga, delta y mar costero frente a las bocas) que viene de cada
 * fuente (la laguna del páramo, el río grande, el mar abierto y la lluvia y escorrentía local).
 * En cada cuerpo bien mezclado:  f_i = Σ_j m_ij·f_j + b_i   →   (I − M)·F = B
 * m_ij: parte del agua que entra al cuerpo i que viene del cuerpo j; b_i: parte que viene
 * directamente de cada fuente. Cada fila de [M | B] suma 1, así que cada fila de F también.
 */
export const CUERPOS_TRAZADOR = ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas', 'mar'];
export const FUENTES = [
  { id: 'laguna', nombre: 'Laguna del páramo' },
  { id: 'magdalena', nombre: 'Río grande' },
  { id: 'mar', nombre: 'Mar abierto' },
  { id: 'local', nombre: 'Lluvia y escorrentía local' },
];
export function trazadores(nodos) {
  const QL = nodos.lagunas.f.salida.Q;
  const K = flujosDe('lagos', nodos.lagos);
  const R = flujosDe('rios', nodos.rios);
  const C = flujosDe('cienagas', nodos.cienagas);
  const O = flujosDe('oceanos', nodos.oceanos);
  const QD = nodos.deltas.f.salida.Q;
  const QR = nodos.rios.f.salida.Q;
  const QCout = nodos.cienagas.f.salida.Q;
  // Lago: lo que entra de la laguna (si está conectado) y de su propia cuenca y lluvia
  const QinK = Math.max(1e-9, K.Qin);
  const mKL = Math.min(1, Math.max(0, K.Qexterno ?? 0) / QinK);
  // Río: el lago por la cabecera y la escorrentía de su cuenca
  const QinR = Math.max(1e-9, (R.Qcuenca ?? 0) + (R.Qlago ?? 0));
  const mRK = (R.Qlago ?? 0) / QinR;
  // Ciénaga: ríos (el de la cadena es una parte), caños del río grande, lluvia y mar
  const Qll = Math.max(0, C.Qd - C.Qr - Math.max(0, C.Qc));
  const QinC = Math.max(1e-9, C.Qd + C.Qm);
  const nuestro = C.Qrios > 0 ? Math.min(1, QR / C.Qrios) : 0;
  const mCR = (nuestro * C.Qr) / QinC;
  const mCX = C.Qm / QinC;
  // Mar costero frente a las bocas: el delta, la ciénaga y el intercambio con el mar abierto
  const QinX = QD + QCout + O.Qoc;
  const mXC = QCout / QinX;
  const mXD = QD / QinX;
  const n = CUERPOS_TRAZADOR.length;
  const M = identidad(n).map((f) => f.map(() => 0));
  const [iL, iK, iR, iC, iD, iX] = [0, 1, 2, 3, 4, 5];
  M[iK][iL] = mKL;
  M[iR][iK] = mRK;
  M[iC][iR] = mCR;
  M[iC][iX] = mCX;
  M[iX][iC] = mXC;
  M[iX][iD] = mXD;
  const B = [
    [1, 0, 0, 0],
    [0, 0, 0, 1 - mKL],
    [0, 0, 0, 1 - mRK],
    [0, Math.max(0, C.Qc) / QinC, 0, ((1 - nuestro) * C.Qr + Qll) / QinC],
    [0, 1, 0, 0],
    [0, 0, O.Qoc / QinX, 0],
  ];
  const IM = identidad(n).map((f, i) => f.map((x, j) => x - M[i][j]));
  const { X, det, operaciones } = gaussJordan(IM, B);
  return {
    M, B, IM, F: X, det, operaciones,
    flujos: { QL, QinK, QinR, QinC, QinX, Qll, QD, QR, QCout, Qoc: O.Qoc, Qm: C.Qm, Qc: C.Qc, Qr: C.Qr, Qe: C.Qe, nuestro, Qlago: R.Qlago, Qcuenca: R.Qcuenca, Qext: K.Qexterno },
  };
}

/** Matriz de adyacencia de los siete eslabones, su cuadrado y la alcanzabilidad. */
export function matricesRed() {
  const A = adyacencia(ORDEN, RED);
  return { A, A2: potencia(A, 2), A3: potencia(A, 3), R: alcanzabilidad(A) };
}

/** Valor de un día del año (0–365) interpolando linealmente entre las mitades de los meses. */
export function valorDia(serie, dia) {
  const mitad = [];
  let acum = 0;
  for (const d of DIAS) { mitad.push(acum + d / 2); acum += d; }
  const x = ((dia % 365) + 365) % 365;
  const lerp = (a, b, t) => a + (b - a) * t;
  if (x < mitad[0]) return lerp(serie[11], serie[0], (x - (mitad[11] - 365)) / (mitad[0] + 365 - mitad[11]));
  if (x >= mitad[11]) return lerp(serie[11], serie[0], (x - mitad[11]) / (mitad[0] + 365 - mitad[11]));
  let k = 0;
  while (mitad[k + 1] <= x) k++;
  return lerp(serie[k], serie[k + 1], (x - mitad[k]) / (mitad[k + 1] - mitad[k]));
}

export { SEG_ANO };
