/**
 * app.js — Sistema conectado: pestañas, controles, resultados, ecuaciones con valores
 * sustituidos y gráficas. El controlador común está en nucleo/app-base.js.
 */
import * as S from './sistema.js';
import * as C from './cadena.js';
import * as N from './nodo.js';
import { Escena } from './escena3d.js';
import { hojasExcel } from './hojas.js';
import { iniciarSimulador, ecu, i, sub, tablaHTML } from './nucleo/app-base.js';
import { fmt, miles, MESES, NOMBRES_MES, conSigno, listaY } from './nucleo/formato.js';
import { serieLinea, seriePuntos, serieGuia } from './nucleo/graficas.js';

const { MODULOS } = S;
const SEG_ANO = 365 * 86400;
const MARCAS_MES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fmtMes = (v) => MESES[Math.round(v) - 1] ?? '';
const xHoy = (r) => 0.5 + (r.diaAno / 365) * 12;
const opciones = (obj) => Object.entries(obj).map(([valor, o]) => ({ valor, nombre: o.nombre }));
const opNodo = (id) => () => C.intervenciones(MODULOS, id).map((o) => ({ valor: o.valor, nombre: o.nombre }));
const VERT = MODULOS.rios.A?.VERTIMIENTOS ?? { tratada: { nombre: 'Aguas domésticas tratadas (PTAR con desinfección)', Qtipico: 20 } };
const nombreOp = (id, v) => C.intervenciones(MODULOS, id).find((o) => o.valor === v)?.nombre ?? v;

/** Número en notación científica: 1.03·10⁻⁶. */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function cientifico(x, d = 2) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 4) return fmt(x, Math.max(0, d + 1 - Math.max(0, e + 1)));
  const m = x / 10 ** e;
  return `${fmt(m, d)}·10${String(e).split('').map((ch) => SUP[ch] ?? ch).join('')}`;
}
/** Fracción como porcentaje legible (con notación científica si es muy pequeña). */
function pctFrac(f) {
  const v = 100 * f;
  if (v === 0) return '0 %';
  if (v >= 10) return `${fmt(v, 1)} %`;
  if (v >= 0.1) return `${fmt(v, 2)} %`;
  if (v >= 0.001) return `${fmt(v, 1 - Math.floor(Math.log10(v)))} %`;
  return `${cientifico(v, 1)} %`;
}
/** Marcas de un eje logarítmico: 0.01, 0.1, 1, 10, 1 000 o 1·10⁻⁶. */
const fmtLog = (v) => (v >= 1 ? miles(v) : (v >= 1e-3 ? fmt(v, -Math.floor(Math.log10(v) + 1e-9)) : cientifico(v, 0)));

const ETIQUETA_NODO = { lagunas: 'Laguna', lagos: 'Lago', rios: 'Río', cienagas: 'Ciénaga', deltas: 'Delta', oceanos: 'Océano', costas: 'Playa' };
const CON_CAUDAL = ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas'];
const fmtNodo = (lista) => (v) => ETIQUETA_NODO[lista[Math.round(v) - 1]] ?? '';

const TABS = [
  { id: 'red', nombre: 'Red del agua', graficas: 1, figura: true, tablas: true, intro: 'Los siete simuladores de la serie son eslabones de una sola red: el agua nace en la laguna del páramo, pasa por el lago y baja por el río hasta la ciénaga; allí se encuentra con el agua del río grande y del mar, y sale por las bocas al mar Caribe, que a su vez fija la marea, el oleaje y el nivel de la ciénaga, del delta y de la playa. Este simulador conecta los modelos: lo que sale de uno es lo que le entra al siguiente.' },
  { id: 'caudal', nombre: 'Caudal y tiempo', graficas: 2, tablas: true, intro: 'Del páramo al mar el caudal crece casi cinco órdenes de magnitud: de unos litros por segundo en la laguna a miles de metros cúbicos por segundo en el delta. El agua también se demora: cada cuerpo la retiene en promedio un tiempo de residencia igual a su volumen dividido por el caudal que sale de él.' },
  { id: 'calidad', nombre: 'Calidad y trazadores', graficas: 2, tablas: true, intro: 'El agua cambia de temperatura, de oxígeno, de nutrientes y de sal a medida que baja. Para saber de dónde viene el agua de cada cuerpo se siguen cuatro trazadores (la laguna del páramo, el río grande, el mar abierto y la lluvia local): sus fracciones son la solución de un sistema de ecuaciones lineales.' },
  { id: 'sedimento', nombre: 'Sedimento', graficas: 2, intro: 'El sedimento que arrastran las lluvias se queda en parte en los lagos y en la ciénaga, y el resto llega al mar. El del río grande construye el delta y alimenta las playas: si se represa o se extrae aguas arriba, la playa se queda sin arena.' },
  { id: 'mar', nombre: 'El mar y la costa', graficas: 2, tablas: true, intro: 'El océano es la frontera de abajo de la red: fija el nivel medio del mar, la marea, el oleaje y la salinidad que reciben la ciénaga, el delta y la playa. Con el ascenso del nivel del mar, los tres eslabones de la costa cambian a la vez.' },
  { id: 'clima', nombre: 'Clima y horizonte', graficas: 2, tablas: true, intro: 'El Niño y La Niña cambian la lluvia de toda la región al mismo tiempo. Al conectar los modelos se ve cómo la sequía o la creciente se propagan del páramo al mar: unos cuerpos la amortiguan y otros la amplifican.' },
];

const CONTROLES = [
  { tab: 'red', grupo: 'Escenario' },
  { tab: 'red', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez el clima, el horizonte y las intervenciones de un caso de estudio de toda la cadena.' },
  { tab: 'red', id: 'clima', clave: 'clima', etiqueta: 'Clima del año (para toda la cadena)', tipo: 'opciones', opciones: opciones(C.CLIMAS),
    doc: 'El mismo clima para los siete simuladores: cada uno cambia su lluvia, su viento o su temperatura como lo hace en su propio simulador.' },
  { tab: 'red', id: 'horizonte', clave: 'horizonte', etiqueta: 'Año del horizonte', tipo: 'opciones', opciones: opciones(C.HORIZONTES),
    extra: (v) => `El océano fija el ascenso del mar de ${C.HORIZONTES[v].ano}; la laguna pierde glaciar y el lago se calienta.`,
    doc: 'El océano calcula el nivel del mar, el calor y el CO₂ de ese año y los entrega a la ciénaga, al delta y a la playa; la laguna pierde glaciar con los años y el lago se calienta como la superficie del mar.' },
  { tab: 'red', id: 'acoplar', clave: 'acoplar', etiqueta: 'Conectar los proyectos (cada uno recibe lo que le entregan sus vecinos)', tipo: 'casilla',
    doc: 'Sin conectar, cada simulador usa sus propios valores de referencia para lo que le llega de aguas arriba y del mar.' },
  { tab: 'red', grupo: 'Intervenciones en cada eslabón' },
  { tab: 'red', id: 'esc_lagunas', clave: 'esc_lagunas', etiqueta: 'Laguna del páramo', tipo: 'opciones', opciones: opNodo('lagunas') },
  { tab: 'red', id: 'esc_lagos', clave: 'esc_lagos', etiqueta: 'Lago andino', tipo: 'opciones', opciones: opNodo('lagos') },
  { tab: 'red', id: 'vertRio', clave: 'vertRio', etiqueta: 'Vertimiento al río (zona media)', tipo: 'opciones', opciones: opciones(VERT),
    extra: (v) => (VERT[v]?.Qtipico ? `${fmt(VERT[v].Qtipico, 1)} L/s con ${fmt((MODULOS.rios.A?.P_VERTIMIENTO?.[v] ?? 0) / 1000, 1)} mg/L de fósforo.` : 'El río no recibe vertimientos.') },
  { tab: 'red', id: 'esc_cienagas', clave: 'esc_cienagas', etiqueta: 'Ciénaga', tipo: 'opciones', opciones: opNodo('cienagas') },
  { tab: 'red', id: 'esc_deltas', clave: 'esc_deltas', etiqueta: 'Delta y cuenca del río grande', tipo: 'opciones', opciones: opNodo('deltas') },
  { tab: 'red', id: 'esc_oceanos', clave: 'esc_oceanos', etiqueta: 'Océano', tipo: 'opciones', opciones: opNodo('oceanos') },
  { tab: 'red', id: 'esc_costas', clave: 'esc_costas', etiqueta: 'Playa', tipo: 'opciones', opciones: opNodo('costas') },
  { tab: 'red', id: 'quitarFronteras', etiqueta: 'Quitar las fronteras importadas', tipo: 'accion', visible: (p) => C.ORDEN.some((id) => p[`fr_${id}`]),
    accion: (p) => { for (const id of C.ORDEN) p[`fr_${id}`] = null; } },

  { tab: 'caudal', grupo: 'Lo que cambia el caudal' },
  { tab: 'caudal', id: 'clima2', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(C.CLIMAS) },
  { tab: 'caudal', id: 'esc_lagunas2', clave: 'esc_lagunas', etiqueta: 'Laguna del páramo', tipo: 'opciones', opciones: opNodo('lagunas') },
  { tab: 'caudal', id: 'esc_lagos2', clave: 'esc_lagos', etiqueta: 'Lago andino', tipo: 'opciones', opciones: opNodo('lagos') },

  { tab: 'calidad', grupo: 'Lo que cambia la calidad' },
  { tab: 'calidad', id: 'vertRio2', clave: 'vertRio', etiqueta: 'Vertimiento al río (zona media)', tipo: 'opciones', opciones: opciones(VERT) },
  { tab: 'calidad', id: 'esc_lagos3', clave: 'esc_lagos', etiqueta: 'Lago andino', tipo: 'opciones', opciones: opNodo('lagos') },
  { tab: 'calidad', id: 'esc_cienagas2', clave: 'esc_cienagas', etiqueta: 'Ciénaga', tipo: 'opciones', opciones: opNodo('cienagas') },

  { tab: 'sedimento', grupo: 'Lo que cambia el sedimento' },
  { tab: 'sedimento', id: 'esc_deltas2', clave: 'esc_deltas', etiqueta: 'Delta y cuenca del río grande', tipo: 'opciones', opciones: opNodo('deltas') },
  { tab: 'sedimento', id: 'esc_costas2', clave: 'esc_costas', etiqueta: 'Playa', tipo: 'opciones', opciones: opNodo('costas') },
  { tab: 'sedimento', id: 'esc_lagunas3', clave: 'esc_lagunas', etiqueta: 'Laguna del páramo', tipo: 'opciones', opciones: opNodo('lagunas') },

  { tab: 'mar', grupo: 'El mar' },
  { tab: 'mar', id: 'horizonte2', clave: 'horizonte', etiqueta: 'Año del horizonte', tipo: 'opciones', opciones: opciones(C.HORIZONTES) },
  { tab: 'mar', id: 'esc_oceanos2', clave: 'esc_oceanos', etiqueta: 'Océano', tipo: 'opciones', opciones: opNodo('oceanos') },
  { tab: 'mar', id: 'esc_costas3', clave: 'esc_costas', etiqueta: 'Playa', tipo: 'opciones', opciones: opNodo('costas') },

  { tab: 'clima', grupo: 'Clima y horizonte' },
  { tab: 'clima', id: 'clima3', clave: 'clima', etiqueta: 'Clima del año que se ve en la escena', tipo: 'opciones', opciones: opciones(C.CLIMAS) },
  { tab: 'clima', id: 'horizonte3', clave: 'horizonte', etiqueta: 'Año del horizonte', tipo: 'opciones', opciones: opciones(C.HORIZONTES) },
];

// ── Indicadores de la barra superior ───────────────────────────────────────
function estados(p, r) {
  const { cad, ind, hoy, fecha } = r;
  const faltantes = C.ORDEN.filter((id) => cad.nodos[id].fuente === 'referencia');
  const total = C.ORDEN.reduce((a, id) => a + cad.nodos[id].revision.total, 0);
  const cumplen = C.ORDEN.reduce((a, id) => a + cad.nodos[id].revision.ok, 0);
  const alertas = C.ORDEN.some((id) => cad.nodos[id].revision.fallas.some((c) => c.nivel === 'alerta'));
  const alMar = (hoy.deltas.Q ?? NaN) + (hoy.cienagas.Q ?? 0);
  return [
    { id: 'red', nombre: 'Red', nivel: faltantes.length ? 'alerta' : (cad.acoplar ? 'ok' : 'aviso'), texto: faltantes.length ? `Faltan ${listaY(faltantes.map((id) => C.NOMBRES[id].toLowerCase()))}` : (cad.acoplar ? 'Siete proyectos conectados' : 'Proyectos sin conectar') },
    { id: 'mar', nombre: 'Al mar', nivel: 'ok', texto: `${fecha.dia} de ${NOMBRES_MES[fecha.mes]}: al mar llegan ${miles(alMar)} m³/s de agua dulce` },
    { id: 'cienaga', nombre: 'Ciénaga', nivel: (hoy.cienagas.salinidad ?? 0) <= 40 ? 'ok' : 'alerta', texto: `Ciénaga: ${fmt(hoy.cienagas.salinidad, 1)} PSU` },
    { id: 'playa', nombre: 'Playa', nivel: !Number.isFinite(ind.playa.dW) || ind.playa.dW >= 0 ? 'ok' : 'alerta', texto: !Number.isFinite(ind.playa.dW) ? 'Playa: sin modelo' : (ind.playa.dW >= 0 ? `Playa: gana ${fmt(ind.playa.dW, 2)} m/año` : `Playa: pierde ${fmt(-ind.playa.dW, 2)} m/año`) },
    { id: 'criterios', nombre: 'Criterios', nivel: cumplen === total ? 'ok' : (alertas ? 'alerta' : 'aviso'), texto: `${cumplen} de ${total} criterios se cumplen` },
  ];
}

// ── Figura de la red (mapa esquemático con norte arriba) ──────────────────
const POS = { oceanos: [210, 26], deltas: [74, 82], cienagas: [186, 96], costas: [334, 74], rios: [258, 150], lagos: [322, 192], lagunas: [378, 228] };
function figuraRed(r) {
  const { cad, ind } = r;
  const nodos = cad.nodos;
  const Q = (id) => nodos[id].f.salida.Q;
  const radio = (id) => (id === 'oceanos' ? 14 : Math.max(7, Math.min(15, 7 + 1.6 * Math.log10(Math.max(Q(id), 0.01) / 0.05))));
  const nivelNodo = (id) => {
    const n = nodos[id];
    if (n.fuente !== 'modelo') return 'aviso';
    if (n.revision.fallas.some((c) => c.nivel === 'alerta')) return 'alerta';
    return n.revision.fallas.length ? 'aviso' : 'ok';
  };
  const COLOR = { ok: 'var(--ok)', aviso: 'var(--aviso)', alerta: 'var(--alerta)' };
  const flecha = (a, b, { ancho = 2, color = 'var(--agua)', punteada = false, curva = 0 } = {}) => {
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    const s = [x1 + ux * (radio(a) + 2), y1 + uy * (radio(a) + 2)];
    const e = [x2 - ux * (radio(b) + 7), y2 - uy * (radio(b) + 7)];
    const mx = (s[0] + e[0]) / 2 - uy * curva, my = (s[1] + e[1]) / 2 + ux * curva;
    return `<path d="M${s[0].toFixed(1)} ${s[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}" fill="none" stroke="${color}" stroke-width="${ancho.toFixed(2)}"${punteada ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#puntaRed)"/>`;
  };
  const anchoQ = (q) => 1 + 1.1 * Math.max(0, Math.log10(Math.max(q, 0.01) / 0.03));
  const enlaces = [
    flecha('lagunas', 'lagos', { ancho: anchoQ(Q('lagunas')) }),
    flecha('lagos', 'rios', { ancho: anchoQ(Q('lagos')) }),
    flecha('rios', 'cienagas', { ancho: anchoQ(Q('rios')) }),
    flecha('cienagas', 'deltas', { ancho: anchoQ(Q('cienagas')), curva: 11 }),
    flecha('deltas', 'cienagas', { ancho: anchoQ(Math.max(1, Number.isFinite(ind.cienaga.QcIn) ? ind.cienaga.QcIn : ind.cienaga.Qc)), color: 'var(--ocre)', curva: 11 }),
    flecha('deltas', 'oceanos', { ancho: anchoQ(Q('deltas')), curva: -10 }),
    flecha('deltas', 'costas', { ancho: 2.2, color: 'var(--ocre)', curva: -34 }),
    flecha('oceanos', 'cienagas', { ancho: 1.4, color: 'var(--tinta-2)', punteada: true }),
    flecha('oceanos', 'deltas', { ancho: 1.4, color: 'var(--tinta-2)', punteada: true, curva: -6 }),
    flecha('oceanos', 'costas', { ancho: 1.4, color: 'var(--tinta-2)', punteada: true, curva: 6 }),
  ].join('');
  const dato = {
    lagunas: `${fmt(1000 * Q('lagunas'), 0)} L/s`, lagos: `${fmt(Q('lagos'), 2)} m³/s`, rios: `${fmt(Q('rios'), 2)} m³/s`,
    cienagas: `${fmt(Q('cienagas'), 0)} m³/s · ${fmt(nodos.cienagas.f.salida.salinidad, 1)} PSU`, deltas: `${miles(Q('deltas'))} m³/s`,
    oceanos: `H_s ${fmt(ind.oceano.Hs, 2)} m · ${conSigno(100 * ind.oceano.nivel, 0)} cm`, costas: `${Number.isFinite(ind.playa.dW) ? `${conSigno(ind.playa.dW, 2)} m/año` : '—'}`,
  };
  const ladoTexto = { lagunas: 'izq', lagos: 'izq', rios: 'izq', cienagas: 'abajo', deltas: 'abajo', oceanos: 'der', costas: 'abajo' };
  const circulos = C.ORDEN.map((id) => {
    const [x, y] = POS[id];
    const rr = radio(id);
    const lado = ladoTexto[id];
    const tx = lado === 'izq' ? x - rr - 5 : (lado === 'der' ? x + rr + 5 : x);
    const ty = lado === 'abajo' ? y + rr + 11 : y - 1;
    const ancla = lado === 'izq' ? 'end' : (lado === 'der' ? 'start' : 'middle');
    return `<g><circle cx="${x}" cy="${y}" r="${rr.toFixed(1)}" fill="${id === 'oceanos' ? 'color-mix(in srgb, var(--agua) 55%, var(--panel))' : 'color-mix(in srgb, var(--agua) 22%, var(--panel))'}" stroke="${COLOR[nivelNodo(id)]}" stroke-width="2.4"/>`
      + `<text x="${tx}" y="${ty}" text-anchor="${ancla}" class="t-dato t-halo">${C.NOMBRES[id]}</text>`
      + `<text x="${tx}" y="${ty + 11}" text-anchor="${ancla}" class="t-chica t-halo">${dato[id]}</text></g>`;
  }).join('');
  const costa = 'M0 52 C40 48 60 62 92 60 S150 70 190 72 S250 62 290 58 S360 52 420 50 L420 0 L0 0 Z';
  return `<svg viewBox="0 0 420 250" role="img" aria-label="Mapa esquemático de la red del agua">
    <defs><marker id="puntaRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--tinta-2)"/></marker></defs>
    <path d="${costa}" fill="color-mix(in srgb, var(--agua) 16%, var(--panel))" stroke="var(--agua-2)" stroke-width="1"/>
    <path d="M300 250 L340 170 L365 150 L392 120 L420 135 L420 250 Z" fill="color-mix(in srgb, var(--ocre) 14%, var(--panel))"/>
    <text x="410" y="140" text-anchor="end" class="t-eje">Sierra Nevada</text>
    <path d="M28 250 C40 200 60 150 70 ${POS.deltas[1] + 14}" fill="none" stroke="var(--agua)" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
    <text x="34" y="242" class="t-eje">río grande</text>
    <text x="14" y="16" class="t-eje">Mar Caribe (norte)</text>
    ${enlaces}${circulos}
  </svg>`;
}

/** Resumen de lo que lleva una frontera (para la tabla de enlaces). */
function resumenFrontera(id, f) {
  const s = f.salida, m = f.mar ?? {};
  switch (id) {
    case 'lagunas': return `Q ${fmt(1000 * s.Q, 0)} L/s · P ${fmt(s.fosforo, 1)} µg/L · ${fmt(s.temperatura, 1)} °C`;
    case 'lagos': return `Q ${fmt(s.Q, 2)} m³/s · P ${fmt(s.fosforo, 1)} µg/L · SS ${fmt(s.sedimento, 0)} mg/L`;
    case 'rios': return `Q ${fmt(s.Q, 2)} m³/s · SS ${fmt(s.sedimento, 0)} mg/L · P ${fmt(s.fosforo, 1)} µg/L`;
    case 'cienagas': return `Q ${fmt(s.Q, 1)} m³/s · ${fmt(s.salinidad, 1)} PSU · P ${fmt(s.fosforo, 1)} µg/L`;
    case 'deltas': return `Q ${miles(s.Q)} m³/s · carga ${miles(s.Qs)} kg/s · ${fmt(s.sedimento, 0)} mg/L`;
    case 'oceanos': return `nivel ${conSigno(m.nivelMedio, 3)} m (${fmt(m.ascenso, 1)} mm/año) · marea ${fmt(m.marea, 2)} m · H_s ${fmt(m.Hs, 2)} m · T_p ${fmt(m.Tp, 1)} s · ${fmt(m.salinidad, 1)} PSU`;
    default: return `Q ${fmt(s.Q, 2)} m³/s`;
  }
}

function tablaMatriz(titulo, M, { dec = 0, cero = '·', nota = '', filas = C.ORDEN, columnas = C.ORDEN } = {}) {
  return tablaHTML(titulo, ['', ...columnas.map((id) => ETIQUETA_NODO[id] ?? id)],
    M.map((f, k) => [{ v: ETIQUETA_NODO[filas[k]] ?? filas[k], clase: 'tenue' }, ...f.map((x) => ({ v: x === 0 ? cero : fmt(x, dec) }))]),
    { numericas: columnas.map((_, k) => k + 1), nota });
}

// ── Pintores ───────────────────────────────────────────────────────────────
const PINTORES = {
  red({ p, r, c }) {
    const { cad, ind } = r;
    const n = cad.nodos;
    const total = C.ORDEN.reduce((a, id) => a + n[id].revision.total, 0);
    const cumplen = C.ORDEN.reduce((a, id) => a + n[id].revision.ok, 0);
    const conectados = C.ORDEN.filter((id) => n[id].fuente !== 'referencia').length;
    const { A, A2, R } = C.matricesRed();
    const sumaA2 = A2.flat().reduce((a, b) => a + b, 0);
    const it = cad.iteraciones;
    const QD = n.deltas.f.salida.Q, QC = n.cienagas.f.salida.Q;
    const T = cad.trazador;
    const solo = S.cadena(p, { acoplar: false });
    const cambio = CON_CAUDAL.map((id) => (n[id].f.salida.Q - solo.nodos[id].f.salida.Q) / solo.nodos[id].f.salida.Q);
    const err = it.slice(1).map((x) => x.error);
    const nivelCrit = cumplen === total ? 'ok' : (C.ORDEN.some((id) => n[id].revision.fallas.some((x) => x.nivel === 'alerta')) ? 'alerta' : 'aviso');
    return {
      figura: figuraRed(r),
      figuraPie: 'Mapa esquemático de la red, con el norte arriba. El grosor de cada flecha crece con el logaritmo del caudal. Las flechas ocres son lo que da el río grande: agua turbia a la ciénaga por los caños y arena a la playa; las punteadas son lo que fija el océano (nivel, marea y oleaje). El borde de cada círculo es verde si su simulador cumple todos sus criterios.',
      metricas: [
        ['<b>La red</b>', ''],
        ['Proyectos con su modelo cargado', `${conectados} de 7`, '', conectados === 7 ? 'ok' : 'alerta'],
        ['Enlaces de la red (unos en la matriz A)', cad.enlaces.length, '', '', 0, 'Cada flecha de la red es un uno en la matriz de adyacencia.'],
        ['Caminos de dos pasos (suma de A²)', sumaA2, '', '', 0],
        ['Iteraciones del lazo ciénaga ⇄ delta ⇄ océano', cad.acoplar ? it.length - 1 : 0, '', cad.convergio ? 'ok' : 'alerta', 0, 'Se repite el lazo hasta que lo que se intercambian cambia menos de una millonésima.'],
        ['Criterios de los siete simuladores que se cumplen', `${cumplen} de ${total}`, '', nivelCrit],
        ['<b>Lo que la red lleva al mar</b>', ''],
        ['Agua dulce (río grande y ciénaga)', QD + QC, 'm³/s', '', 0],
        ['Volumen del año', ((QD + QC) * SEG_ANO) / 1e9, 'km³', '', 1],
        ['Sedimento del río grande', ind.delta.Mt, 'Mt/año', '', 1],
        ['Parte del agua frente a las bocas que viene de la laguna', pctFrac(T.F[5][0]), '', '', 2, 'Solución del sistema de trazadores (pestaña Calidad y trazadores).'],
        ['<b>Lo que cambia al conectar</b>', ''],
        ['Caudal del lago (recibe la laguna)', 100 * cambio[1], '%', '', 1],
        ['Caudal del río (recibe el lago)', 100 * cambio[2], '%', '', 1],
        ['Caudal de la ciénaga (recibe el río, el río grande y el mar)', 100 * cambio[3], '%', '', 2],
      ],
      tablas: [
        tablaHTML('Lo que pasa por cada enlace', ['De → a', 'Lo que entrega (promedio del año)', 'Cómo lo usa quien lo recibe'],
          cad.enlaces.map((e) => [`${C.NOMBRES[e.de]} → ${C.NOMBRES[e.a]}`, { v: resumenFrontera(e.de, e.frontera), clase: e.valida ? '' : 'mal' }, { v: e.texto || '—', clase: 'tenue' }]),
          { nota: 'Las fronteras siguen el contrato de la serie (versión 1): caudal obligatorio y magnitudes con sus unidades. El río grande y el mar abierto entran por los bordes de la red.' }),
        tablaMatriz('Matriz de adyacencia A (fila: entrega; columna: recibe)', A, { nota: `Hay ${cad.enlaces.length} unos: uno por cada enlace. La suma de cada fila dice a cuántos entrega cada proyecto; la de cada columna, de cuántos recibe.` }),
        tablaMatriz('A² = A·A: caminos de dos pasos', A2, { nota: `(A²)ᵢⱼ cuenta los caminos de dos pasos de i a j: por ejemplo, de la laguna al río por el lago. Los números de la diagonal son lazos de ida y vuelta (ciénaga ⇄ delta, delta ⇄ océano). En la matriz de alcanzabilidad R = A + A² + … + A⁶ hay ${R.flat().reduce((a, b) => a + b, 0)} unos: la laguna alcanza a todos los demás.` }),
        cad.acoplar ? tablaHTML('Iteración de punto fijo del lazo ciénaga ⇄ delta ⇄ océano', ['Magnitud que se intercambia', ...it.map((x) => `k = ${x.k}`)],
          [...C.VARIABLES_LAZO.map((v, j) => [`${v.nombre} (${v.unidad})`, ...it.map((x) => fmt(x.x[j], v.dec))]),
            { celdas: ['Error relativo eₖ', ...it.map((x, k) => (k === 0 ? 'semilla' : (x.error === 0 ? '0 (exacto)' : cientifico(x.error, 1))))], clase: 'total' }],
          { numericas: it.map((_, k) => k + 1), nota: 'La semilla (k = 0) son los tres eslabones solos. En cada vuelta la ciénaga usa el delta y el océano de la vuelta anterior; el delta, la ciénaga nueva, y el océano, el delta nuevo (estilo Gauss-Seidel).' }) : '',
      ].join(''),
      ecuacion: [
        ecu.tipo('Composición de funciones: la salida de un eslabón es la entrada del siguiente'),
        ecu.formula(`${sub('Q', 'río')} = ${sub('f', 'río')}(${sub('f', 'lago')}(${sub('f', 'laguna')}(clima)))`),
        ecu.sust(`laguna: ${fmt(ind.laguna.Q, 3)} m³/s → lago: ${fmt(ind.lago.Q, 2)} m³/s → río: ${fmt(ind.rio.Qcuenca, 2)} + ${fmt(ind.rio.Qlago, 2)} + vertimiento = ${fmt(ind.rio.Q, 2)} m³/s`),
        ecu.tipo('Matrices: la red como matriz de adyacencia'),
        ecu.formula(`${sub('a', 'ij')} = 1 si ${i('i')} entrega a ${i('j')};  (${i('A')}²)${sub('', 'ij')} = Σ${sub('', 'k')} ${sub('a', 'ik')}·${sub('a', 'kj')}`),
        ecu.sust(`(${i('A')}²)${sub('', 'laguna, río')} = ${sub('a', 'laguna, lago')}·${sub('a', 'lago, río')} = 1 × 1 = 1: el agua de la laguna llega al río en dos pasos`),
        ecu.tipo('Sucesión que converge: iteración de punto fijo'),
        ecu.formula(`${sub('x', 'k+1')} = ${i('G')}(${sub('x', 'k')}),  ${sub('e', 'k')} = máx |${sub('x', 'k+1')} − ${sub('x', 'k')}| / |${sub('x', 'k+1')}|`),
        cad.acoplar ? ecu.sust(err.map((e, k) => `${sub('e', String(k + 1))} = ${e === 0 ? '0' : cientifico(e, 1)}`).join(';  ')) : ecu.nota('Sin conectar no hay lazo: cada eslabón se calcula una sola vez.'),
        ecu.nota('El lazo converge muy rápido porque el acople es débil: la ciénaga casi no cambia al río grande y el delta casi no cambia al mar abierto.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Eslabón', yTitulo: 'Cambio al conectar (%)', formatoX: fmtNodo(CON_CAUDAL), formatoY: (v) => fmt(v, 0), marcasX: [1, 2, 3, 4, 5],
          series: [
            ...cambio.map((x, k) => serieLinea(k === 0 ? 'Cambio del caudal medio del año' : '', [{ x: k + 1, y: 0 }, { x: k + 1, y: 100 * x }], c.agua, { ancho: 14, sinLeyenda: k > 0 })),
            seriePuntos('Valor', cambio.map((x, k) => ({ x: k + 1, y: 100 * x })), c.tinta, 3, { sinLeyenda: true }),
          ],
          limites: { x: { min: 0.5, max: 5.5 } }, pie: 'Al conectar, el lago recibe el rebose de la laguna y el río recibe el desagüe del lago; en la ciénaga y el delta el cambio casi no se nota porque su agua viene sobre todo del río grande y del mar.' },
      ],
    };
  },

  caudal({ r, c }) {
    const { cad, ind, edad, hoy } = r;
    const n = cad.nodos;
    const serie = (id) => n[id].m.map((m, k) => ({ x: k + 1, y: Math.max(m.Q, 1e-4) }));
    const colores = { lagunas: c.ok, lagos: c.violeta, rios: c.agua, cienagas: c.piezo, deltas: c.ocre };
    const ordenes = Math.log10(ind.delta.Q / ind.laguna.Q);
    const K = n.lagos.r;
    const mes = r.fecha.mes;
    return {
      metricas: [
        ['<b>Caudal medio del año</b>', ''],
        ['Laguna: rebose al lago', 1000 * ind.laguna.Q, 'L/s', '', 1],
        ['Lago: desagüe al río', ind.lago.Q, 'm³/s', ind.lago.secos.length ? 'alerta' : '', 2],
        ['Río: desembocadura en la ciénaga', ind.rio.Q, 'm³/s', ind.rio.sinCaptar.length ? 'alerta' : '', 2],
        ['Ciénaga: salida por la Boca de la Barra', ind.cienaga.Q, 'm³/s', '', 1],
        ['Ciénaga: entra del río grande por los caños', ind.cienaga.QcIn, 'm³/s', '', 1, 'En la creciente el río llena la ciénaga.'],
        ['Ciénaga: le devuelve al río grande por los caños', ind.cienaga.QcOut, 'm³/s', '', 1, Number.isFinite(ind.cienaga.diasRet) ? `En el estiaje: ${fmt(ind.cienaga.diasRet, 0)} días del año con el agua saliendo hacia el río.` : 'En el estiaje.'],
        ['Río grande: desembocadura del delta', ind.delta.Q, 'm³/s', '', 0],
        ['Órdenes de magnitud del delta a la laguna', ordenes, '', '', 2, 'log₁₀(Q del delta / Q de la laguna).'],
        [`<b>Hoy, ${r.fecha.dia} de ${NOMBRES_MES[mes]}</b>`, ''],
        ['Río', hoy.rios.Q, 'm³/s', '', 2],
        ['Ciénaga (salida)', hoy.cienagas.Q, 'm³/s', '', 1],
        ['Río grande en la boca', hoy.deltas.Q, 'm³/s', '', 0],
        ['<b>Tiempo de residencia y edad del agua</b>', ''],
        ['Laguna: τ = V/Q', ind.laguna.tauDias, 'días', '', 1],
        ['Lago: τ = V/Q', ind.lago.tauAnos, 'años', '', 1],
        ['Río: tiempo de viaje L/u por las tres zonas', 24 * ind.rio.tViaje, 'h', '', 1],
        ['Ciénaga: τ = V/Q', ind.cienaga.tauDias, 'días', '', 1],
        ['Edad media del agua de la laguna al llegar al mar', edad.total / 365, 'años', '', 1, 'Suma de los tiempos de residencia de la laguna, el lago, el río y la ciénaga.'],
      ],
      tablas: tablaHTML('Caudal de salida de cada eslabón, mes a mes (m³/s)', ['Mes', 'Laguna', 'Lago', 'Río', 'Ciénaga', 'Delta'],
        C.MESES.map((m, k) => ({ celdas: [m, fmt(n.lagunas.m[k].Q, 3), fmt(n.lagos.m[k].Q, 2), fmt(n.rios.m[k].Q, 2), fmt(n.cienagas.m[k].Q, 1), miles(n.deltas.m[k].Q)], clase: k === mes ? 'elegida' : '' })),
        { numericas: [1, 2, 3, 4, 5], nota: 'Cada simulador arma su año con su propio modelo y con lo que le entregan sus vecinos; la fila resaltada es el mes del reloj.' }),
      ecuacion: [
        ecu.tipo('Lineal: el caudal se suma en las confluencias'),
        ecu.formula(`${sub('Q', 'río')} = ${sub('Q', 'cuenca')} + ${sub('Q', 'lago')} = ${fmt(ind.rio.Qcuenca, 2)} + ${fmt(ind.rio.Qlago, 2)} ≈ ${fmt(ind.rio.Q, 2)} m³/s`),
        ecu.tipo('Racional: tiempo de residencia'),
        ecu.formula(`τ = ${i('V')}/${i('Q')}`),
        ecu.sust(Number.isFinite(ind.lago.tauAnos) ? `lago: τ = ${cientifico(ind.lago.V, 3)} m³ / ${cientifico(K.nu.Vsale, 3)} m³/año = ${fmt(ind.lago.tauAnos, 1)} años (sale por el desagüe, la evaporación y la toma)` : 'El lago viene de una frontera: sin su modelo no se conoce su volumen.'),
        ecu.tipo('Suma de una serie: la edad del agua'),
        ecu.formula(`${i('t')} = ${sub('τ', 'laguna')} + ${sub('τ', 'lago')} + ${sub('t', 'río')} + ${sub('τ', 'ciénaga')} = ${edad.tramos.map((t) => fmt(t.dias, t.id === 'lagos' ? 0 : 1)).join(' + ')} = ${miles(edad.total)} días ≈ ${fmt(edad.total / 365, 1)} años`),
        ecu.tipo('Logarítmica: órdenes de magnitud'),
        ecu.formula(`log₁₀(${sub('Q', 'delta')}/${sub('Q', 'laguna')}) = log₁₀(${miles(ind.delta.Q)}/${fmt(ind.laguna.Q, 3)}) = ${fmt(ordenes, 2)}`),
        ecu.nota('Por eso la gráfica de los caudales usa una escala logarítmica: en una escala lineal la laguna, el lago y el río quedarían pegados al cero.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Caudal (m³/s)', formatoX: fmtMes, formatoY: fmtLog, marcasX: MARCAS_MES, logY: true,
          series: [...CON_CAUDAL.map((id) => serieLinea(C.NOMBRES[id], serie(id), colores[id])), serieGuia('Hoy', { x: xHoy(r), y: 0.01 }, { x: xHoy(r), y: 30000 }, c.tinta2, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 12.5 }, y: { min: 0.01, max: 30000 } }, pie: 'Escala logarítmica: cada marca multiplica el caudal por diez. Los ríos de la Sierra crecen con las lluvias de mayo y de octubre; el río grande, con las de su cuenca andina.' },
        { xTitulo: 'Tramo', yTitulo: 'Edad acumulada (días)', formatoX: (v) => edad.tramos[Math.round(v) - 1]?.nombre ?? '', formatoY: fmtLog, marcasX: [1, 2, 3, 4], logY: true,
          series: [serieLinea('Edad al salir de cada cuerpo', edad.tramos.map((t, k) => ({ x: k + 1, y: Math.max(t.acumulado, 0.01) })), c.agua), seriePuntos('Al salir', edad.tramos.map((t, k) => ({ x: k + 1, y: Math.max(t.acumulado, 0.01) })), c.agua, 4, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 4.5 } }, pie: 'Escala logarítmica. El lago retiene el agua durante décadas: casi toda la edad del agua al llegar al mar se la da él.' },
      ],
    };
  },

  calidad({ r, c }) {
    const { cad, ind } = r;
    const T = cad.trazador;
    const F = T.F;
    const nombresT = ['Laguna', 'Lago', 'Río', 'Ciénaga', 'Delta', 'Mar frente a las bocas'];
    const Strz = F[3][2] * ind.oceano.Smar;
    const conc = ind.cienaga.S / Strz;
    const f = T.flujos;
    const piso = 1e-9;
    const prof = (k) => F.map((fila, j) => ({ x: j + 1, y: fila[k] })).filter((pt) => pt.y > piso);
    const fmtT = (v) => ['Laguna', 'Lago', 'Río', 'Ciénaga', 'Delta', 'Bocas'][Math.round(v) - 1] ?? '';
    return {
      metricas: [
        ['<b>Temperatura y oxígeno del agua que sale</b>', ''],
        ['Laguna', `${fmt(ind.laguna.T, 1)} °C · ${fmt(ind.laguna.OD, 2)} mg/L`, ''],
        ['Lago (superficie)', `${fmt(ind.lago.T, 1)} °C · ${fmt(cad.nodos.lagos.f.salida.OD, 2)} mg/L`, ''],
        ['Río (desembocadura)', `${fmt(cad.nodos.rios.f.salida.temperatura, 1)} °C · ${fmt(ind.rio.OD, 2)} mg/L`, ''],
        ['Ciénaga', `${fmt(cad.nodos.cienagas.f.salida.temperatura, 1)} °C · ${fmt(ind.cienaga.OD, 2)} mg/L`, ''],
        ['<b>Fósforo total</b>', ''],
        ['Laguna', ind.laguna.P, 'µg/L', '', 1],
        [`Lago (${ind.lago.clase})`, ind.lago.P, 'µg/L', ind.lago.P <= 20 ? 'ok' : 'alerta', 1],
        ['Río (cuenca, lago y vertimiento)', ind.rio.P, 'µg/L', '', 1],
        ['Ciénaga', ind.cienaga.P, 'µg/L', '', 1],
        ['<b>¿De dónde viene el agua? (trazadores)</b>', ''],
        ['Agua de la laguna en el lago', pctFrac(F[1][0]), ''],
        ['Agua de la laguna en el río', pctFrac(F[2][0]), ''],
        ['Agua de la laguna en la ciénaga', pctFrac(F[3][0]), ''],
        ['Agua de la laguna frente a las bocas', pctFrac(F[5][0]), ''],
        ['Ciénaga: río grande · mar · lluvia y ríos locales', `${pctFrac(F[3][1])} · ${pctFrac(F[3][2])} · ${pctFrac(F[3][3])}`, ''],
        ['<b>Salinidad</b>', ''],
        ['Ciénaga, media del año (modelo)', ind.cienaga.S, 'PSU', '', 2],
        ['Ciénaga solo por la mezcla (trazador × salinidad del mar)', Strz, 'PSU', '', 2],
        ['Concentración por la evaporación', conc, 'veces', '', 2, 'La evaporación se lleva agua pero deja la sal.'],
        ['Frente a las bocas: trazadores · océano', `${fmt(F[5][2] * ind.oceano.Smar, 2)} · ${fmt(ind.oceano.Spluma, 2)} PSU`, ''],
      ],
      tablas: [
        tablaHTML('Matriz aumentada [I − M | B] del sistema de trazadores', ['', ...nombresT.map((x) => x.split(' ')[0]), '| Laguna', 'Río grande', 'Mar abierto', 'Local'],
          T.IM.map((fila, k) => [{ v: nombresT[k], clase: 'tenue' }, ...fila.map((x) => (x === 0 ? '·' : fmt(x, 4))), ...T.B[k].map((x) => (x === 0 ? '·' : fmt(x, 4)))]),
          { numericas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], nota: `mᵢⱼ: parte del agua que entra al cuerpo i que viene del cuerpo j; bᵢ: la que llega directamente de cada fuente. Cada fila de [M | B] suma 1. det(I − M) = ${fmt(T.det, 5)}: el sistema tiene una sola solución.` }),
        tablaHTML('Solución F: de dónde viene el agua de cada cuerpo', ['Cuerpo', ...C.FUENTES.map((x) => x.nombre), 'Suma'],
          F.map((fila, k) => [nombresT[k], ...fila.map(pctFrac), fmt(fila.reduce((a, b) => a + b, 0), 6)]),
          { numericas: [1, 2, 3, 4, 5], nota: `Se resolvió con Gauss-Jordan (${T.operaciones} operaciones de fila). Que cada fila sume 1 es el balance de masa: toda el agua viene de alguna fuente.` }),
      ].join(''),
      ecuacion: [
        ecu.tipo('Lineal: la mezcla es un promedio ponderado'),
        ecu.formula(`${i('C')} = (${sub('Q', '1')}${sub('C', '1')} + ${sub('Q', '2')}${sub('C', '2')})/(${sub('Q', '1')} + ${sub('Q', '2')})`),
        ecu.sust(`agua de la laguna en el lago: ${sub('f', 'lago')} = ${sub('Q', 'laguna')}/${sub('Q', 'entra al lago')} = ${fmt(f.Qext, 3)}/${fmt(f.QinK, 2)} = ${pctFrac(F[1][0])}`),
        ecu.tipo('Sistema de ecuaciones lineales: (I − M)·F = B'),
        ecu.formula(`${sub('f', 'C')} − ${sub('m', 'CR')}${sub('f', 'R')} − ${sub('m', 'CX')}${sub('f', 'X')} = ${sub('b', 'C')},   ${sub('f', 'X')} − ${sub('m', 'XC')}${sub('f', 'C')} − ${sub('m', 'XD')}${sub('f', 'D')} = ${sub('b', 'X')}`),
        ecu.sust(`${sub('m', 'CX')} = ${fmt(T.M[3][5], 4)} (mar que entra a la ciénaga), ${sub('m', 'XC')} = ${fmt(T.M[5][3], 4)} (ciénaga en el mar frente a las bocas): la ciénaga y el mar costero dependen el uno del otro`),
        ecu.tipo('Determinante: la solución es única'),
        ecu.formula(`det(I − M) = 1 − ${sub('m', 'CX')}·${sub('m', 'XC')} = 1 − ${fmt(T.M[3][5], 4)} × ${fmt(T.M[5][3], 4)} = ${fmt(T.det, 5)} ≠ 0`),
        ecu.nota('Las demás filas forman una cadena (la matriz es casi triangular): la fracción de agua de la laguna que llega lejos es el producto de las fracciones de cada mezcla, y por eso cae varios órdenes de magnitud.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Cuerpo de agua', yTitulo: 'Fracción del agua', formatoX: fmtT, formatoY: fmtLog, marcasX: [1, 2, 3, 4, 5, 6], logY: true,
          series: [serieLinea('De la laguna del páramo', prof(0), c.ok), serieLinea('Del río grande', prof(1), c.ocre), serieLinea('Del mar abierto', prof(2), c.agua), serieLinea('Lluvia y escorrentía local', prof(3), c.tinta2, { punteada: true })],
          limites: { x: { min: 0.5, max: 6.5 }, y: { min: 1e-8, max: 1.5 } }, pie: 'El agua de la laguna se diluye en cada mezcla: en el mar frente a las bocas es apenas una parte en un millón.' },
        { xTitulo: 'Cuerpo de agua', yTitulo: 'Temperatura (°C) y fósforo (µg/L)', formatoX: (v) => ['Laguna', 'Lago', 'Río', 'Ciénaga', 'Mar'][Math.round(v) - 1] ?? '', formatoY: (v) => fmt(v, 0), marcasX: [1, 2, 3, 4, 5],
          series: [
            serieLinea('Temperatura (°C)', [ind.laguna.T, ind.lago.T, cad.nodos.rios.f.salida.temperatura, cad.nodos.cienagas.f.salida.temperatura, ind.oceano.T].map((y, k) => ({ x: k + 1, y })), c.piezo),
            serieLinea('Fósforo total (µg/L)', [ind.laguna.P, ind.lago.P, ind.rio.P, ind.cienaga.P].map((y, k) => ({ x: k + 1, y })), c.ok, { punteada: true }),
            seriePuntos('Valores', [ind.laguna.P, ind.lago.P, ind.rio.P, ind.cienaga.P].map((y, k) => ({ x: k + 1, y })), c.ok, 3, { sinLeyenda: true }),
          ],
          limites: { x: { min: 0.5, max: 5.5 }, y: { min: 0 } }, pie: `El agua baja de ${fmt(ind.laguna.T, 0)} °C en el páramo a ${fmt(cad.nodos.cienagas.f.salida.temperatura, 0)} °C en la ciénaga, y gana fósforo con las cuencas, los vertimientos y el río grande.` },
      ],
    };
  },

  sedimento({ r, c }) {
    const { cad, ind } = r;
    const n = cad.nodos;
    const D = n.deltas;
    const P = n.costas.r;
    const QsRef = 4200;
    const cargaRio = n.rios.m.map((m, k) => ({ x: k + 1, y: (m.Q * m.sedimento) / 1000 }));
    const cargaDelta = D.m.map((m, k) => ({ x: k + 1, y: m.Qs }));
    const perfil = [ind.laguna.SS, n.lagos.f.salida.sedimento, ind.rio.SS, ind.delta.C, ind.delta.Cplaya];
    return {
      metricas: [
        ['<b>Sedimento en suspensión del agua que sale</b>', ''],
        ['Laguna', ind.laguna.SS, 'mg/L', '', 2],
        ['Lago (atrapa casi todo lo que le llega)', n.lagos.f.salida.sedimento, 'mg/L', '', 1],
        ['Río (promedio pesado por el caudal)', ind.rio.SS, 'mg/L', '', 0],
        ['Ciénaga: se rellena', ind.cienaga.sedMm, 'mm/año', ind.cienaga.sedMm <= 5 ? 'ok' : 'alerta', 2],
        ['Río grande en la boca', ind.delta.C, 'mg/L', '', 0],
        ['Carga del río grande al mar', ind.delta.Mt, 'Mt/año', ind.delta.Mt >= 50 ? 'ok' : 'alerta', 1],
        ['Frente a las playas (15 km de la boca)', ind.delta.Cplaya, 'mg/L', ind.delta.Cplaya <= 150 ? 'ok' : 'aviso', 0],
        ['<b>La arena de la playa</b>', ''],
        ['Arena que llega a la playa', ind.playa.aporte / 1000, 'miles de m³/año', '', 0],
        ['Balance de arena del año', P ? P.a.balance / 1000 : NaN, 'miles de m³/año', !P || P.a.balance >= 0 ? 'ok' : 'alerta', 1],
        ['Cambio del ancho de la playa', ind.playa.dW, 'm/año', !Number.isFinite(ind.playa.dW) || ind.playa.dW >= 0 ? 'ok' : 'alerta', 2],
        ['Ancho de la playa en 50 años', ind.playa.W50, 'm', !Number.isFinite(ind.playa.W50) || ind.playa.W50 >= 20 ? 'ok' : 'alerta', 1],
      ],
      ecuacion: [
        ecu.tipo('Lineal: la carga es caudal por concentración'),
        ecu.formula(`${sub('Q', 's')} = ${i('Q')}·${i('C')} = ${miles(ind.delta.Q)} m³/s × ${fmt(ind.delta.C, 0)} g/m³ ≈ ${miles((ind.delta.Q * ind.delta.C) / 1000)} kg/s`),
        ecu.sust(`en el año: ${miles(ind.delta.Qs)} kg/s (lo que llega al mar) × 31 536 000 s = ${fmt((ind.delta.Qs * SEG_ANO) / 1e9, 1)} Mt; con lo que se queda en el Canal del Dique y en la llanura, el río trae ${fmt(ind.delta.Mt, 1)} Mt/año`),
        ecu.tipo('Proporcionalidad directa: la arena de la playa sigue a la carga del río grande'),
        ecu.formula(`${i('aporte')} = ${sub('aporte', 'ref')}·${sub('Q', 's')}/${sub('Q', 's,ref')} = 447 000 × ${miles(ind.delta.Qs)}/${miles(QsRef)} = ${miles(ind.playa.aporte)} m³/año`),
        ecu.tipo('Lineal: el ancho de la playa en el tiempo'),
        ecu.formula(`${i('W')}(${i('t')}) = ${sub('W', '0')} + ${i('v')}·${i('t')} = ${fmt(ind.playa.W, 1)} + (${fmt(ind.playa.dW, 3)}) × 50 = ${fmt(ind.playa.W50, 1)} m`),
        ecu.nota('Si se represa el río grande o se deforesta su cuenca, cambia la carga del delta y con ella la arena de la playa: el efecto viaja por la red.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Lugar', yTitulo: 'Sedimento (mg/L)', formatoX: (v) => ['Laguna', 'Lago', 'Río', 'Río grande', 'Playas'][Math.round(v) - 1] ?? '', formatoY: fmtLog, marcasX: [1, 2, 3, 4, 5], logY: true,
          series: [serieLinea('Sedimento', perfil.map((y, k) => ({ x: k + 1, y: Math.max(y, 0.1) })), c.ocre), seriePuntos('Valor', perfil.map((y, k) => ({ x: k + 1, y: Math.max(y, 0.1) })), c.ocre, 4, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 5.5 }, y: { min: 0.1, max: 10000 } }, pie: 'El lago deja pasar casi nada; el río de la Sierra y el río grande llevan cientos de miligramos por litro, que se diluyen en el mar antes de llegar a las playas.' },
        { xTitulo: 'Mes', yTitulo: 'Carga de sedimento (kg/s)', formatoX: fmtMes, formatoY: fmtLog, marcasX: MARCAS_MES, logY: true,
          series: [serieLinea('Río de la Sierra', cargaRio, c.agua), serieLinea('Río grande al mar', cargaDelta, c.ocre), serieGuia('Hoy', { x: xHoy(r), y: 0.01 }, { x: xHoy(r), y: 20000 }, c.tinta2, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 12.5 }, y: { min: 0.01, max: 20000 } }, pie: 'Escala logarítmica. La carga crece con el caudal y con la concentración: en los meses de lluvia se mueve casi todo el sedimento del año.' },
      ],
    };
  },

  mar({ p, r, c }) {
    const { cad, ind } = r;
    const n = cad.nodos;
    const O = n.oceanos;
    const ano = C.HORIZONTES[p.horizonte].ano;
    const pO = O.pn ?? {};
    const a = pO.tasaMar ?? 3.3, b = pO.aceleracion ?? 0.04, t = ano - 2026;
    const comp = S.compararHorizontes(p);
    const filaH = (k) => {
      const x = comp[k], ii = S.indicadores(x);
      const fallas = C.ORDEN.reduce((s, id) => s + x.nodos[id].revision.fallas.length, 0);
      return { celdas: [C.HORIZONTES[k].nombre, fmt(100 * ii.oceano.nivel, 1), fmt(ii.oceano.ascenso, 1), fmt(x.nodos.cienagas.r?.a?.zMax, 2), fmt(ii.cienaga.Smax, 1), miles(ii.delta.anosMar), fmt(ii.playa.bruun50, 1), fmt(ii.playa.W50, 1), { v: String(fallas), clase: fallas ? 'mal' : 'bien' }], clase: k === p.horizonte ? 'elegida' : '' };
    };
    const curva = (aa, bb) => Array.from({ length: 76 }, (_, k) => ({ x: 2026 + k, y: (aa * k + bb * k * k) / 10 }));
    const pr = n.costas.r?.pr;
    const berma = n.costas.pn?.berma ?? 2;
    return {
      metricas: [
        [`<b>Lo que entrega el océano en ${ano}</b>`, ''],
        ['Nivel medio del mar sobre el de hoy', 100 * ind.oceano.nivel, 'cm', ind.oceano.nivel <= 0.3 ? 'ok' : 'aviso', 1],
        ['Rapidez del ascenso en ese año', ind.oceano.ascenso, 'mm/año', '', 1, 'La derivada del ascenso: a + 2·b·t.'],
        ['Amplitud de la marea (suma de las cuatro ondas)', ind.oceano.marea, 'm', '', 2],
        ['Oleaje medio del año mar afuera', `H_s ${fmt(ind.oceano.Hs, 2)} m · T_p ${fmt(ind.oceano.Tp, 2)} s`, ''],
        ['Salinidad y temperatura del mar', `${fmt(ind.oceano.Smar, 1)} PSU · ${fmt(ind.oceano.T, 2)} °C`, ''],
        ['<b>Ciénaga</b>', ''],
        ['Nivel medio del año', n.cienagas.f.salida.nivel, 'm', '', 3],
        ['Salinidad máxima del año', ind.cienaga.Smax, 'PSU', ind.cienaga.Smax <= 40 ? 'ok' : 'alerta', 1],
        ['<b>Delta</b>', ''],
        ['Cuña salina más larga del año', ind.delta.Lmax / 1000, 'km', '', 2],
        ['Años hasta que el mar cubra la llanura del delta', ind.delta.anosMar, 'años', ind.delta.anosMar > 100 ? 'ok' : 'alerta', 0],
        ['<b>Playa</b>', ''],
        ['Oleaje que entra a la bahía (75 % del de mar afuera)', ind.playa.Hs0, 'm', '', 2],
        ['Retroceso por el ascenso del mar en 50 años (Bruun)', ind.playa.bruun50, 'm', '', 1],
        ['Nivel total máximo del año (marea, onda y remonte)', ind.playa.TWLmax, 'm', '', 2],
      ],
      tablas: tablaHTML('La costa en cada horizonte (con el clima y las intervenciones elegidas)', ['Horizonte', 'Mar (cm)', 'Ascenso (mm/año)', 'Ciénaga: nivel máx. (m)', 'Ciénaga: S máx. (PSU)', 'Delta: años sobre el mar', 'Playa: Bruun 50 años (m)', 'Playa: ancho en 50 años (m)', 'Criterios que fallan'],
        Object.keys(C.HORIZONTES).map(filaH), { numericas: [1, 2, 3, 4, 5, 6, 7, 8], nota: 'Cada fila es la red completa calculada con ese horizonte: el océano fija el nivel y la rapidez del ascenso, y la ciénaga, el delta y la playa los reciben por sus fronteras.' }),
      ecuacion: [
        ecu.tipo('Cuadrática: el ascenso del nivel del mar'),
        ecu.formula(`${i('h')}(${i('t')}) = ${i('a')}·${i('t')} + ${i('b')}·${i('t')}² = ${fmt(a, 1)} × ${t} + ${fmt(b, 3)} × ${t}² = ${fmt(a * t + b * t * t, 1)} mm`),
        ecu.tipo('Derivada: la rapidez del ascenso que reciben el delta y la playa'),
        ecu.formula(`${i('h')}′(${i('t')}) = ${i('a')} + 2${i('b')}·${i('t')} = ${fmt(a, 1)} + 2 × ${fmt(b, 3)} × ${t} = ${fmt(a + 2 * b * t, 2)} mm/año`),
        ecu.tipo('Lineal: la bahía abriga y refracta el oleaje'),
        ecu.formula(`${sub('H', 's,playa')} = 0.75·${sub('H', 's')} = 0.75 × ${fmt(ind.oceano.Hs, 2)} = ${fmt(ind.playa.Hs0, 2)} m,  ${sub('θ', 'playa')} = 0.15·θ = 0.15 × 20° = 3°`),
        ecu.tipo('Racional: regla de Bruun'),
        ecu.formula(`${i('R')} = ${i('S')}·${sub('x', 'c')}/(${i('B')} + ${sub('h', 'c')})`),
        pr ? ecu.sust(`${i('R')}(50 años) = ${fmt((50 * ind.oceano.ascenso) / 1000, 3)} m × ${fmt(pr.xc, 0)} m / (${fmt(berma, 1)} + ${fmt(pr.hc, 2)}) m ≈ ${fmt((((50 * ind.oceano.ascenso) / 1000) * pr.xc) / (berma + pr.hc), 1)} m`) : '',
      ].join(''),
      graficas: [
        { xTitulo: 'Año', yTitulo: 'Ascenso desde 2026 (cm)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Pocas emisiones (b = 0.02)', curva(3.3, 0.02), c.ok), serieLinea('Intermedias (b = 0.04)', curva(3.3, 0.04), c.agua), serieLinea('Muchas emisiones (b = 0.08)', curva(3.3, 0.08), c.alerta),
            seriePuntos(`Horizonte elegido (${ano})`, [{ x: ano, y: 100 * ind.oceano.nivel }], c.tinta, 6)],
          limites: { x: { min: 2026, max: 2100 }, y: { min: 0 } }, pie: 'El ascenso es una parábola: cada año sube un poco más rápido que el anterior.' },
        { xTitulo: 'Mes', yTitulo: 'Altura significativa (m)', formatoX: fmtMes, formatoY: (v) => fmt(v, 1), marcasX: MARCAS_MES,
          series: [serieLinea('Mar afuera (océano)', O.m.map((m, k) => ({ x: k + 1, y: m.Hs })), c.agua), serieLinea('En la playa', n.costas.m.map((m, k) => ({ x: k + 1, y: m.Hs })), c.ocre),
            serieGuia('Hoy', { x: xHoy(r), y: 0 }, { x: xHoy(r), y: 3 }, c.tinta2, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 12.5 }, y: { min: 0 } }, pie: 'Los alisios de comienzos del año levantan el mar y la bahía deja pasar tres cuartas partes de su altura media. En los meses de calma el mar que levanta el viento casi desaparece, pero a la playa sigue llegando el mar de fondo de tormentas lejanas.' },
      ],
    };
  },

  clima({ p, r, c }) {
    const comp = S.compararClimas(p);
    const ind = Object.fromEntries(Object.entries(comp).map(([k, x]) => [k, S.indicadores(x)]));
    const Qn = (k, id) => comp[k].nodos[id].f.salida.Q;
    const cambio = (k) => CON_CAUDAL.map((id) => (Qn(k, id) - Qn('normal', id)) / Qn('normal', id));
    const dNino = cambio('nino'), dNina = cambio('nina');
    const fL = { nino: -0.4, nina: 0.5 };
    const filas = [
      ['Laguna: rebose (L/s)', (k) => fmt(1000 * Qn(k, 'lagunas'), 1)],
      ['Lago: desagüe (m³/s)', (k) => fmt(Qn(k, 'lagos'), 2)],
      ['Lago: meses sin desaguar', (k) => String(ind[k].lago.secos.length), (k) => ind[k].lago.secos.length > 0],
      ['Río: caudal (m³/s)', (k) => fmt(Qn(k, 'rios'), 2)],
      ['Río: meses sin captar en la bocatoma', (k) => String(ind[k].rio.sinCaptar.length), (k) => ind[k].rio.sinCaptar.length > 0],
      ['Ciénaga: salida (m³/s)', (k) => fmt(Qn(k, 'cienagas'), 1)],
      ['Ciénaga: salinidad máxima (PSU)', (k) => fmt(ind[k].cienaga.Smax, 1), (k) => ind[k].cienaga.Smax > 40],
      ['Delta: caudal (m³/s)', (k) => miles(Qn(k, 'deltas'))],
      ['Delta: cuña salina más larga (km)', (k) => fmt(ind[k].delta.Lmax / 1000, 2)],
      ['Océano: calor en el arrecife (DHW, °C·semana)', (k) => fmt(ind[k].oceano.dhwMax, 1), (k) => ind[k].oceano.dhwMax >= 4],
      ['Playa: balance de arena (miles de m³/año)', (k) => fmt(comp[k].nodos.costas.r?.a?.balance / 1000, 1), (k) => (comp[k].nodos.costas.r?.a?.balance ?? 0) < 0],
      ['Criterios que fallan en toda la red', (k) => String(C.ORDEN.reduce((s, id) => s + comp[k].nodos[id].revision.fallas.length, 0)), (k) => C.ORDEN.some((id) => comp[k].nodos[id].revision.fallas.length)],
    ];
    const rio = (k) => comp[k].nodos.rios.m.map((m, j) => ({ x: j + 1, y: m.Q }));
    return {
      metricas: [
        ['<b>Cambio del caudal medio con El Niño (frente a un año normal)</b>', ''],
        ...CON_CAUDAL.map((id, k) => [C.NOMBRES[id], 100 * dNino[k], '%', dNino[k] <= -0.99 ? 'alerta' : '', 1]),
        ['<b>Cambio del caudal medio con La Niña</b>', ''],
        ...CON_CAUDAL.map((id, k) => [C.NOMBRES[id], 100 * dNina[k], '%', '', 1]),
        ['<b>¿Amplifica o amortigua? (cambio del caudal / cambio de la lluvia)</b>', ''],
        ...CON_CAUDAL.map((id, k) => [C.NOMBRES[id], `${fmt(dNino[k] / fL.nino, 2)} con El Niño · ${fmt(dNina[k] / fL.nina, 2)} con La Niña`, '']),
      ],
      tablas: tablaHTML(`Cada eslabón con los tres climas · horizonte: ${C.HORIZONTES[p.horizonte].nombre}`, ['Magnitud', 'Año normal', 'El Niño', 'La Niña'],
        filas.map(([nombre, val, mal]) => [nombre, ...['normal', 'nino', 'nina'].map((k) => ({ v: val(k), clase: mal?.(k) ? 'mal' : '' }))]),
        { numericas: [1, 2, 3], nota: 'Cada columna es la red completa calculada con ese clima. Rojo: el valor rompe un criterio de su simulador.' }),
      ecuacion: [
        ecu.tipo('Cambio porcentual'),
        ecu.formula(`Δ% = (${sub('Q', 'clima')} − ${sub('Q', 'normal')})/${sub('Q', 'normal')} × 100`),
        ecu.sust(`río con El Niño: (${fmt(Qn('nino', 'rios'), 2)} − ${fmt(Qn('normal', 'rios'), 2)})/${fmt(Qn('normal', 'rios'), 2)} × 100 = ${fmt(100 * dNino[2], 1)} %`),
        ecu.tipo('Razón de cambios (elasticidad)'),
        ecu.formula(`ε = (Δ${i('Q')}/${i('Q')})/(Δ${i('P')}/${i('P')})`),
        ecu.sust(`lago con El Niño: ε = ${fmt(dNino[1], 3)}/(${fmt(fL.nino, 2)}) = ${fmt(dNino[1] / fL.nino, 2)}; río: ε = ${fmt(dNino[2] / fL.nino, 2)}`),
        ecu.nota('Con ε > 1 el cuerpo amplifica la sequía: el lago evapora casi lo mismo con o sin lluvia, así que lo que le falta sale de su desagüe. Con ε < 1 la amortigua: la ciénaga y el delta reciben agua de cuencas grandes y del mar. Los cambios de la lluvia (−40 % y +50 %) son los del simulador de ríos; cada simulador usa los de su propia región.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Eslabón', yTitulo: 'Cambio del caudal (%)', formatoX: fmtNodo(CON_CAUDAL), formatoY: (v) => fmt(v, 0), marcasX: [1, 2, 3, 4, 5],
          series: [serieLinea('El Niño', dNino.map((x, k) => ({ x: k + 1, y: 100 * x })), c.alerta), seriePuntos('El Niño', dNino.map((x, k) => ({ x: k + 1, y: 100 * x })), c.alerta, 4, { sinLeyenda: true }),
            serieLinea('La Niña', dNina.map((x, k) => ({ x: k + 1, y: 100 * x })), c.agua), seriePuntos('La Niña', dNina.map((x, k) => ({ x: k + 1, y: 100 * x })), c.agua, 4, { sinLeyenda: true }),
            serieGuia('Sin cambio', { x: 0.5, y: 0 }, { x: 5.5, y: 0 }, c.tinta2, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 5.5 } }, pie: 'La sequía de El Niño se amplifica en el lago (deja de desaguar) y se amortigua en la ciénaga y el delta.' },
        { xTitulo: 'Mes', yTitulo: 'Caudal del río (m³/s)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Año normal', rio('normal'), c.tinta2), serieLinea('El Niño', rio('nino'), c.alerta), serieLinea('La Niña', rio('nina'), c.agua),
            serieGuia('Hoy', { x: xHoy(r), y: 0 }, { x: xHoy(r), y: 30 }, c.tinta2, { sinLeyenda: true })],
          limites: { x: { min: 0.5, max: 12.5 }, y: { min: 0 } }, pie: 'El río de la Sierra con los tres climas: el agua del lago y de su cuenca suben o bajan juntas.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'sistema',
  tabInicial: 'red',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Sistema conectado',
  tabs: TABS,
  controles: CONTROLES,
  PARAMETROS: S.PARAMETROS,
  escenarios: S.ESCENARIOS,
  estadoInicial: S.estadoInicial,
  avanzar: S.avanzar,
  calcular: S.calcular,
  pasoMaximo: 30 * 86400,
  reloj: {
    tipo: 'dias', inicio: 0,
    velocidades: [{ valor: 86400, nombre: '1 día por segundo' }, { valor: 5 * 86400, nombre: '5 días por segundo' }, { valor: 15 * 86400, nombre: '15 días por segundo' }, { valor: 30 * 86400, nombre: '30 días por segundo' }],
    defecto: 5 * 86400,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 86400, nombre: '1 día' }, { valor: 5 * 86400, nombre: '5 días' }, { valor: 15 * 86400, nombre: '15 días' }],
    intervaloDefecto: 5 * 86400,
    columnas: [
      { clave: 'Qlaguna', nombre: 'Caudal de la laguna', unidad: 'L/s', dec: 1 },
      { clave: 'Qrio', nombre: 'Caudal del río', unidad: 'm³/s', dec: 2 },
      { clave: 'Qcienaga', nombre: 'Salida de la ciénaga', unidad: 'm³/s', dec: 1 },
      { clave: 'Qdelta', nombre: 'Río grande en la boca', unidad: 'm³/s', dec: 0 },
      { clave: 'Scienaga', nombre: 'Salinidad de la ciénaga', unidad: 'PSU', dec: 2 },
      { clave: 'Hs', nombre: 'Oleaje mar afuera', unidad: 'm', dec: 2 },
      { clave: 'Hplaya', nombre: 'Oleaje en la playa', unidad: 'm', dec: 2 },
    ],
    tomar: (p, r) => ({ Qlaguna: 1000 * r.hoy.lagunas.Q, Qrio: r.hoy.rios.Q, Qcienaga: r.hoy.cienagas.Q, Qdelta: r.hoy.deltas.Q, Scienaga: r.hoy.cienagas.salinidad, Hs: r.hoy.oceanos.Hs, Hplaya: r.hoy.costas.Hs }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'red', nombre: 'Red', titulo: 'Del páramo al océano' },
    { id: 'sierra', nombre: 'Sierra', titulo: 'La laguna, el lago y el río' },
    { id: 'costa', nombre: 'Costa', titulo: 'La ciénaga, el delta y la playa' },
    { id: 'mar', nombre: 'Mar', titulo: 'El mar Caribe frente a la costa' },
  ],
});
