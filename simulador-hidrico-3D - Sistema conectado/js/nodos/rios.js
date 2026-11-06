/**
 * nodos/rios.js — Adaptador del simulador de ríos exorreicos (el proyecto de referencia).
 * -----------------------------------------------------------------------
 * El simulador de ríos no trae un nodo.js propio y no se modifica: este adaptador usa sus
 * funciones puras (lluvia.js y rio.js, en su carpeta hermana) para armar la frontera del río
 * con el mismo contrato de los demás proyectos:
 *   - Caudal de cada mes en la bocatoma con el clima del año (caudalMes: balance lluvia–caudal
 *     de 30 días de la cuenca) más el agua del lago, que entra por la cabecera como un afluente.
 *   - Sedimento: la curva de sedimento del río (sedimentoDeCaudal) mezclada con el agua clara
 *     del lago:  C = (Q₁·C₁ + Q₂·C₂)/(Q₁ + Q₂).
 *   - Calidad en la desembocadura (km 50): el perfil de mezcla, decaimiento y oxígeno de
 *     Streeter-Phelps del simulador de ríos (perfilCalidad) con el vertimiento elegido.
 *   - Fósforo: mezcla del lago, de la cuenca y del vertimiento. El simulador de ríos no modela
 *     el fósforo; sus concentraciones son valores de referencia de este adaptador (editables).
 *   - Tiempo de viaje del agua por las tres zonas: t = Σ L/u con la velocidad de Manning.
 */
const BASE = new URL('../../../simulador-hidrico-3D - Rios exorreicos/js/', import.meta.url);
const L = await import(new URL('lluvia.js', BASE).href);
const R = await import(new URL('rio.js', BASE).href);

export const NODO = { id: 'rios', nombre: 'Río de la Sierra Nevada' };

/** Fósforo total de cada tipo de vertimiento [µg/L] (valores típicos de referencia). */
export const P_VERTIMIENTO = { ninguno: 0, tratada: 3000, domestica: 7000, cafe: 10000, agricola: 1000 };

/** Tipos de vertimiento del simulador de ríos (nombre y caudal típico en L/s). */
export const VERTIMIENTOS = R.VERTIMIENTOS;
export const ZONAS = R.ZONAS;
export const KM_DESEMBOCADURA = R.KM_DESEMBOCADURA;
export const COTA_MIN_CAPTACION = R.COTA_MIN_CAPTACION;
export const MESES = L.MESES;
export const CLIMAS = L.CLIMAS;

export const PARAMETROS = Object.freeze({
  clima: 'normal',
  vertTipo: 'tratada',     // tipo de vertimiento (como en el simulador de ríos)
  vertZona: 'media',       // zona donde entra (alta, media, baja o abajo)
  Qvert: 20,               // L/s
  Pcuenca: 40,             // µg/L: fósforo de la escorrentía de la cuenca (el de los ríos de la ciénaga)
  odMin: 4,                // mg/L: oxígeno mínimo para la fauna del río
  // Lago de aguas arriba cuando llega por una frontera (constante en el año)
  Qlago: 0, Plago: 0, SSlago: 0,
});

const mezcla = (Q1, C1, Q2, C2) => (Q1 + Q2 > 0 ? (Q1 * C1 + Q2 * C2) / (Q1 + Q2) : 0);

/** Tiempo de viaje del agua por las tres zonas del río [días]. */
export function tiempoViaje(Qboc) {
  const hid = R.hidraulicaZonas(Qboc);
  let t = 0;
  for (const [id, z] of Object.entries(R.ZONAS)) t += ((z.km[1] - z.km[0]) * 1000) / hid[id].u;
  return t / 86400;
}

/**
 * Un año mes a mes. lago: los 12 meses del lago de aguas arriba ({ Q, fosforo, sedimento }),
 * o null para usar el lago constante de los parámetros (Qlago, Plago, SSlago).
 */
export function mensual(p, lago = null) {
  const tipo = R.VERTIMIENTOS[p.vertTipo] ?? R.VERTIMIENTOS.ninguno;
  const Qv = tipo === R.VERTIMIENTOS.ninguno ? 0 : Math.max(0, p.Qvert) / 1000;
  return L.MESES.map((m, k) => {
    const Qc = L.caudalMes(k, p.clima);                  // escorrentía de la cuenca en la bocatoma
    const Ql = Math.max(0, lago?.[k]?.Q ?? p.Qlago);
    const Q = Qc + Ql;
    const cal = R.perfilCalidad({ vertTipo: p.vertTipo, vertZona: p.vertZona, Qvert: p.Qvert }, Q);
    const d = cal.desembocadura;
    const SS = mezcla(Qc, L.sedimentoDeCaudal(Qc), Ql, lago?.[k]?.sedimento ?? p.SSlago);
    const Pnat = mezcla(Qc, p.Pcuenca, Ql, lago?.[k]?.fosforo ?? p.Plago);
    const cota = R.cotaDeCaudal(Q);
    return {
      mes: m.nombre, dias: m.dias, Q: Q + Qv, Qcuenca: Qc, Qlago: Ql, Qv,
      cota, capta: R.captaAgua(cota),
      sedimento: SS, fosforo: mezcla(Q, Pnat, Qv, P_VERTIMIENTO[p.vertTipo] ?? 0),
      temperatura: R.ZONAS.baja.Tagua, OD: d.OD, DBO: d.DBO, coliformes: d.CF, nitrogeno: d.NO3,
      odMin: cal.odMin.od, kmOdMin: cal.odMin.km, tViaje: tiempoViaje(Q),
    };
  });
}

/** Promedio del año: pesado por los días del mes (o por días × caudal, para concentraciones). */
function promedio(meses, clave, porCaudal = false) {
  let s = 0, w = 0;
  for (const m of meses) {
    const peso = m.dias * (porCaudal ? m.Q : 1);
    s += m[clave] * peso;
    w += peso;
  }
  return w > 0 ? s / w : 0;
}

/** Año del río con su revisión. */
export function calcular(p, lago = null) {
  const meses = mensual(p, lago);
  const a = {
    Q: promedio(meses, 'Q'), Qcuenca: promedio(meses, 'Qcuenca'), Qlago: promedio(meses, 'Qlago'),
    sedimento: promedio(meses, 'sedimento', true), fosforo: promedio(meses, 'fosforo', true),
    DBO: promedio(meses, 'DBO', true), coliformes: promedio(meses, 'coliformes', true), nitrogeno: promedio(meses, 'nitrogeno', true),
    OD: promedio(meses, 'OD'), temperatura: promedio(meses, 'temperatura'), tViaje: promedio(meses, 'tViaje'),
    odMin: Math.min(...meses.map((m) => m.odMin)), Qmin: Math.min(...meses.map((m) => m.Q)), Qmax: Math.max(...meses.map((m) => m.Q)),
    mesesSinCaptar: meses.filter((m) => !m.capta).map((m) => m.mes),
  };
  const peorOD = meses.reduce((x, m) => (m.odMin < x.odMin ? m : x), meses[0]);
  const revision = [
    { nivel: a.mesesSinCaptar.length ? 'alerta' : 'ok', texto: `La bocatoma capta todo el año (cota ≥ ${R.COTA_MIN_CAPTACION.toFixed(2)} m)`, detalle: a.mesesSinCaptar.length ? `Sin agua en ${a.mesesSinCaptar.join(', ')}` : `Caudal mínimo de ${a.Qmin.toFixed(2)} m³/s` },
    { nivel: a.odMin >= p.odMin ? 'ok' : 'alerta', texto: `Oxígeno disuelto mínimo del río ≥ ${p.odMin} mg/L`, detalle: `${a.odMin.toFixed(2)} mg/L en ${peorOD.mes} (km ${peorOD.kmOdMin.toFixed(1)})` },
  ];
  return { meses, a, revision };
}

/** Frontera de salida del río (la que recibe la ciénaga). */
export function salida(p, res) {
  const a = res.a;
  return {
    nodo: 'Río de la Sierra Nevada (desembocadura, km 50)',
    salida: { Q: a.Q, sedimento: a.sedimento, temperatura: a.temperatura, OD: a.OD, DBO: a.DBO, coliformes: a.coliformes, nitrogeno: a.nitrogeno, fosforo: a.fosforo },
    clima: { anio: p.clima, factorLluvia: L.clima(p.clima).fLluvia },
  };
}

export const textoEntrada = 'El agua que desagua el lago entra por la cabecera del río como un afluente más, con su fósforo y su poco sedimento.';
export const entradas = [
  {
    origen: 'lagos',
    claves: ['Qlago', 'Plago', 'SSlago'],
    aplicar: (p, f) => ({
      cambios: { Qlago: Math.max(0, f.salida.Q ?? 0), Plago: f.salida.fosforo ?? 0, SSlago: f.salida.sedimento ?? 0 },
      texto: `El lago entrega ${(f.salida.Q ?? 0).toFixed(2)} m³/s a la cabecera del río.`,
    }),
    ejemplo: { salida: { Q: 1.3, fosforo: 15, sedimento: 2, temperatura: 14 } },
  },
];
