/**
 * nodo.js — El delta como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe de la ciénaga el agua que sale por su boca (una pluma pequeña al oriente) y del océano
 * el oleaje, la marea, el nivel medio y la salinidad del mar. Entrega a la costa y al océano el
 * caudal medio del año que el río lleva al mar, con su sedimento: la arena que alimenta las
 * playas y el lodo de la pluma.
 */
import * as S from './sistema.js';

export const NODO = { id: 'deltas', nombre: 'Delta del río grande' };

export function salida(p, r) {
  return {
    nodo: 'Delta del Magdalena (Bocas de Ceniza)',
    salida: {
      Q: r.a.Qp,
      sedimento: r.a.C,
      Qs: r.a.Qs * (1 - r.fD),
      salinidad: 0.1,
      temperatura: 27.5,
    },
    clima: { anio: p.clima },
  };
}

export const textoEntrada = 'La ciénaga suma su pluma por la Boca de la Barra; el océano fija el oleaje, la marea, el nivel medio y la salinidad del mar.';
export const entradas = [
  {
    origen: 'cienagas',
    claves: ['Qcienaga'],
    aplicar: (p, f) => ({
      cambios: { Qcienaga: Math.max(0, f.salida.Q ?? S.PARAMETROS.Qcienaga) },
      texto: `La ciénaga entrega ${(f.salida.Q ?? 0).toFixed(1)} m³/s al mar por la Boca de la Barra.`,
    }),
    ejemplo: { salida: { Q: 254, salinidad: 17, temperatura: 29 } },
  },
  {
    origen: 'oceanos',
    claves: ['Hs', 'Tp', 'anguloOla', 'Smar', 'nivelMar', 'ascensoMar', 'rangoMarea'],
    aplicar: (p, f) => {
      const m = f.mar ?? {};
      const cambios = {};
      if (Number.isFinite(m.Hs)) cambios.Hs = m.Hs;
      if (Number.isFinite(m.Tp)) cambios.Tp = m.Tp;
      if (Number.isFinite(m.direccion)) cambios.anguloOla = Math.min(45, Math.abs(m.direccion));
      if (Number.isFinite(m.salinidad)) cambios.Smar = m.salinidad;
      if (Number.isFinite(m.nivelMedio)) cambios.nivelMar = m.nivelMedio;
      if (Number.isFinite(m.ascenso)) cambios.ascensoMar = m.ascenso;
      if (Number.isFinite(m.marea)) cambios.rangoMarea = 2 * m.marea;
      return { cambios, texto: 'El océano fija el oleaje que llega al delta, la marea, el nivel medio del mar, la rapidez con que sube y la salinidad del mar.' };
    },
    ejemplo: { salida: { Q: 0 }, mar: { nivelMedio: 0.1, ascenso: 5, marea: 0.2, Hs: 1.8, Tp: 8, direccion: 20, salinidad: 36.2, temperatura: 28 } },
  },
];

/** Un año mes a mes para el sistema conectado. */
export function mensual(p) {
  const a = S.anoMensual(p);
  const fD = S.fraccionDique(p);
  return a.meses.map((m) => ({ mes: m.mes, Q: m.Qp, sedimento: m.C, Qs: m.Qs * (1 - fD), salinidad: 0.1, cuna: m.Lmax }));
}
