/**
 * hojas.js — Hojas propias del libro de Excel del simulador de lagunas, con fórmulas de
 * Excel que se recalculan si se cambia un dato de entrada (en azul). Sin DOM: se prueban
 * con Node en tests/datos.test.js.
 */
import * as S from './sistema.js';

const L_S = (q) => q * 1000;

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const ca = r.ca;
  const fosforo = {
    nombre: 'Fósforo y estado trófico',
    descripcion: 'Vollenweider, Dillon y Rigler, Beer-Lambert y Carlson escritos con fórmulas de Excel: si se cambia un dato de entrada (en azul), Excel recalcula.',
    columnas: [52, 16, 14],
    filas: [
      [{ v: 'Fósforo y estado trófico de la laguna', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Carga de fósforo', e(ca.c.Ptotal, 2), 'kg/año'],
      ['Volumen que entra en el año', e(r.bal.Vin, 0), 'm³/año'],
      ['Tiempo de residencia τ', e(ca.tau, 4), 'años'],
      ['Turbidez del agua sola k_w', e(p.kw, 2), '1/m'],
      ['Sedimento en suspensión', e(r.sed.SSsale + S.SITIO.SSmax * r.olas.fFondo, 3), 'mg/L'],
      ['Cobertura de plantas V', e(ca.V, 4), ''],
      ['h_v', e(p.hv, 2), ''],
      ['Profundidad media z̄', e(ca.zMedia, 3), 'm'],
      [],
      ['Fósforo del agua que entra P_in', { f: 'B4*1000000/B5', v: ca.Pin, dec: 2 }, 'µg/L'],
      ['Fósforo en la laguna P = P_in/(1+√τ)', { f: 'B13/(1+SQRT(B6))', v: ca.P, dec: 2 }, 'µg/L'],
      ['Clorofila Chl = 10^(1.449·log P − 1.136)', { f: '10^(1.449*LOG10(B14)-1.136)', v: ca.Chl, dec: 2 }, 'µg/L'],
      ['Turbidez sin plantas E₀', { f: 'B7+0.02*B15+0.05*B8', v: ca.E0, dec: 3 }, '1/m'],
      ['Turbidez con plantas k_d', { f: 'B7+(B16-B7)*B10/(B10+B9)', v: ca.kd, dec: 3 }, '1/m'],
      ['Transparencia DS = 1.7/k_d', { f: '1.7/B17', v: ca.DS, dec: 2 }, 'm'],
      ['Luz en el fondo medio e^(−k_d·z̄)', { f: 'EXP(-B17*B11)', v: ca.luzFondoMedio, dec: 3 }, ''],
      ['TSI (transparencia) = 60 − 14.41·ln DS', { f: '60-14.41*LN(B18)', v: ca.tsi.SD, dec: 1 }, ''],
      ['TSI (clorofila) = 9.81·ln Chl + 30.6', { f: '9.81*LN(B15)+30.6', v: ca.tsi.Chl, dec: 1 }, ''],
      ['TSI (fósforo) = 14.42·ln P + 4.15', { f: '14.42*LN(B14)+4.15', v: ca.tsi.P, dec: 1 }, ''],
      ['TSI promedio', { f: 'AVERAGE(B20:B22)', v: ca.tsi.medio, dec: 1 }, ''],
    ],
  };
  const { Au, hu } = S.geometria(p);
  const cubeta = {
    nombre: 'Cubeta y vertedero',
    descripcion: 'El paraboloide de la laguna (área y volumen) y el vertedero de rebose, con fórmulas de Excel.',
    columnas: [52, 16, 14],
    filas: [
      [{ v: 'Cubeta en paraboloide y vertedero de rebose', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Área del espejo en el umbral A_u', e(Au, 0), 'm²'],
      ['Profundidad en el umbral h_u', e(hu, 2), 'm'],
      ['Profundidad máxima ahora h', e(r.h, 3), 'm'],
      ['Coeficiente del vertedero C', e(p.Cvertedero, 2), ''],
      ['Ancho del vertedero L', e(p.anchoVertedero, 2), 'm'],
      [],
      ['Área del espejo A = (A_u/h_u)·h', { f: 'B4/B5*B6', v: r.A, dec: 0 }, 'm²'],
      ['Volumen V = A_u·h²/(2·h_u)', { f: 'B4*B6^2/(2*B5)', v: r.V, dec: 0 }, 'm³'],
      ['Profundidad media V/A', { f: 'B11/B10', v: r.laguna.zMedia, dec: 3 }, 'm'],
      ['Caudal del vertedero C·L·(h − h_u)^1.5', { f: 'IF(B6>B5,B7*B8*(B6-B5)^1.5,0)', v: r.q.Qvert, dec: 4 }, 'm³/s'],
    ],
  };
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año mes a mes desde el 1 de enero',
    nota: 'Simulación día a día con los parámetros al exportar.',
    encabezados: ['Mes', 'Lluvia (mm)', 'Páramo (L/s)', 'Glaciar (L/s)', 'Sale (L/s)', 'Nivel al final (m)', 'Nivel mínimo (m)', 'Días rebosando'],
    filas: r.ano.meses.map((m) => [m.mes, { v: m.lluvia, dec: 0 }, { v: L_S(m.Qp), dec: 1 }, { v: L_S(m.Qg), dec: 1 }, { v: L_S(m.Qsale), dec: 1 }, { v: m.h, dec: 3 }, { v: m.hMin, dec: 3 }, m.diasRebose]),
    columnas: [10, 12, 14, 14, 12, 16, 16, 14],
  };
  return [fosforo, cubeta, ano];
}

