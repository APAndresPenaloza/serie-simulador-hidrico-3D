/**
 * hojas.js — Hojas propias del libro de Excel del simulador de lagos (con fórmulas de Excel).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const nu = r.nu;
  const mo = r.mo;
  const fosforo = {
    nombre: 'Fósforo y Carlson',
    descripcion: 'Vollenweider, carga admisible y equivalencias de Carlson con fórmulas de Excel (datos de entrada en azul).',
    columnas: [54, 16, 14],
    filas: [
      [{ v: 'Fósforo del lago (Vollenweider) y estado trófico (Carlson)', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Carga de fósforo', e(nu.carga, 0), 'kg/año'],
      ['Agua que sale del lago en el año (desagüe + extracción)', e(nu.Vsale, 0), 'm³/año'],
      ['Volumen del lago', e(mo.V, 0), 'm³'],
      ['Fósforo crítico P_c', e(S.SITIO.Pcritico, 0), 'µg/L'],
      [],
      ['Tiempo de residencia τ = V/Q', { f: 'B6/B5', v: nu.tau, dec: 2 }, 'años'],
      ['Fósforo que entra P_in', { f: 'B4*1000000/B5', v: nu.Pin, dec: 2 }, 'µg/L'],
      ['Fósforo del lago P = P_in/(1+√τ)', { f: 'B10/(1+SQRT(B9))', v: nu.P, dec: 2 }, 'µg/L'],
      ['Carga admisible L_c = P_c·Q·(1+√τ)/10⁶', { f: 'B7*B5*(1+SQRT(B9))/1000000', v: nu.Lc, dec: 0 }, 'kg/año'],
      ['TSI = 14.42·ln P + 4.15', { f: '14.42*LN(B11)+4.15', v: nu.tsi, dec: 1 }, ''],
      ['Clorofila esperada e^((TSI − 30.6)/9.81)', { f: 'EXP((B13-30.6)/9.81)', v: nu.Chl, dec: 2 }, 'µg/L'],
      ['Secchi esperado e^((60 − TSI)/14.41)', { f: 'EXP((60-B13)/14.41)', v: nu.DS, dec: 2 }, 'm'],
      ['Zona fótica ln(100)·DS/1.7', { f: 'LN(100)*B15/1.7', v: nu.zEu, dec: 2 }, 'm'],
    ],
  };
  const tr = r.tr;
  const fisica = {
    nombre: 'Densidad y seiches',
    descripcion: 'Densidad del agua (parábola con vértice en 4 °C), viento, número de Wedderburn y seiches de Merian con fórmulas de Excel.',
    columnas: [54, 16, 14],
    filas: [
      [{ v: 'Estratificación, viento y seiches', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Temperatura de la superficie T_e', e(tr.Te, 2), '°C'],
      ['Temperatura del fondo T_h', e(tr.Th, 2), '°C'],
      ['Viento U', e(tr.U, 2), 'm/s'],
      ['Densidad del aire ρ_a', e(tr.rhoA, 4), 'kg/m³'],
      ['Espesor del epilimnion h_e', e(mo.he, 1), 'm'],
      ['Espesor del hipolimnion h_h', e(mo.hh, 2), 'm'],
      ['Largo del lago L', e(mo.L, 0), 'm'],
      ['Profundidad media z̄', e(mo.zmed, 2), 'm'],
      [],
      ['ρ(T_e) = 1000 − 0.0068·(T_e − 4)²', { f: '1000-0.0068*(B4-4)^2', v: M.densidad(tr.Te), dec: 4 }, 'kg/m³'],
      ['ρ(T_h)', { f: '1000-0.0068*(B5-4)^2', v: M.densidad(tr.Th), dec: 4 }, 'kg/m³'],
      ["g' = g·Δρ/ρ", { f: '9.81*(B14-B13)/B14', v: tr.gp, dec: 6 }, 'm/s²'],
      ['τ = ρ_a·C_D·U²', { f: 'B7*0.0013*B6^2', v: tr.tau, dec: 5 }, 'N/m²'],
      ['u* = √(τ/ρ)', { f: 'SQRT(B16/1000)', v: tr.us, dec: 5 }, 'm/s'],
      ["Wedderburn W = g'·h_e²/(u*²·L)", { f: 'B15*B8^2/(B17^2*B10)', v: tr.W, dec: 3 }, ''],
      ['Seiche superficial T = 2L/√(g·z̄)', { f: '2*B10/SQRT(9.81*B11)/60', v: r.viento.Ts / 60, dec: 2 }, 'min'],
      ["Seiche interna T_i = 2L/√(g'·h_e·h_h/(h_e+h_h))", { f: '2*B10/SQRT(B15*B8*B9/(B8+B9))/86400', v: r.viento.Ti / 86400, dec: 3 }, 'días'],
    ],
  };
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año mes a mes desde el 1 de enero',
    nota: 'Simulación día a día con los parámetros al exportar.',
    encabezados: ['Mes', 'Lluvia (mm)', 'Cuenca (m³/s)', 'Evaporación (m³/s)', 'Desagüe (m³/s)', 'Nivel sobre el umbral (m)', 'Superficie (°C)', 'Wedderburn', 'Días de mezcla', 'OD mínimo del fondo (mg/L)'],
    filas: r.ano.meses.map((m) => [m.mes, { v: m.lluvia, dec: 0 }, { v: m.Qcuenca, dec: 2 }, { v: m.Qevap, dec: 2 }, { v: m.Qdesague, dec: 2 }, { v: m.eta, dec: 3 }, { v: m.Te, dec: 2 }, { v: m.W, dec: 2 }, m.diasMezcla, { v: m.ODmin, dec: 2 }]),
    columnas: [10, 12, 14, 16, 14, 18, 14, 12, 12, 18],
  };
  return [fosforo, fisica, ano];
}
