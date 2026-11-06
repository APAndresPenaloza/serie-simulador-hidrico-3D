/**
 * nodo.js — La laguna como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Es la cabecera de la serie: no recibe agua de ningún otro proyecto. Entrega al lago (y,
 * por él, al río) el agua que rebosa, con su temperatura, su oxígeno, su fósforo y su
 * sedimento. El sistema conectado usa mensual() para encadenar un año completo.
 */
import * as S from './sistema.js';

export const NODO = { id: 'lagunas', nombre: 'Laguna de alta montaña' };

/** Frontera de salida con el estado actual. */
export function salida(p, r) {
  return {
    nodo: 'Laguna glaciar del páramo',
    salida: {
      Q: r.q.Qvert + r.q.Qglof,
      sedimento: r.ca.SS,
      temperatura: r.oxigeno.Tagua,
      OD: r.oxigeno.OD,
      fosforo: r.ca.P,
      nivel: r.h,
    },
    clima: { anio: p.clima, factorLluvia: S.CLIMAS[p.clima]?.fLluvia ?? 1 },
  };
}

/** No recibe de ningún proyecto (es la cabecera). */
export const entradas = [];
export const textoEntrada = '';

/** Un año mes a mes para el sistema conectado: caudal de salida y calidad de cada mes. */
export function mensual(p) {
  const ano = S.anoMensual(p);
  const sim = S.estadoInicial(p);
  const r = S.calcular(p, sim);
  return ano.meses.map((m) => ({
    mes: m.mes, Q: m.Qsale, Qp: m.Qp, Qg: m.Qg, nivel: m.h, sedimento: r.ca.SS, fosforo: r.ca.P, temperatura: r.temp.Tagua,
  }));
}
