/**
 * hojas.js — Hojas propias del libro de Excel del simulador de costas (con fórmulas).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const q = r.q;
  const pr = r.pr;
  const ola = {
    nombre: 'Oleaje y remonte',
    descripcion: 'Longitud de onda en aguas profundas, remonte de Stockdon y nivel total con la marea, con fórmulas de Excel.',
    columnas: [62, 16, 12],
    filas: [
      [{ v: 'Oleaje, remonte y nivel total en la playa', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Altura significativa en aguas profundas H₀', e(q.H0, 3), 'm'],
      ['Período T', e(q.T, 2), 's'],
      ['Pendiente del frente de playa β', e(p.pendiente, 3), ''],
      ['Marea de ahora', e(q.eta, 3), 'm'],
      ['Sobreelevación de tormenta', e(q.surge, 3), 'm'],
      ['Cota del malecón', e(p.malecon, 2), 'm'],
      [],
      ['Longitud de onda L₀ = g·T²/(2π)', { f: '9.81*B5^2/(2*PI())', v: q.L0, dec: 2 }, 'm'],
      ['Remonte R2 = 1.1·[0.35β√(H₀L₀) + √(H₀L₀(0.563β² + 0.004))/2]', { f: '1.1*(0.35*B6*SQRT(B4*B11)+SQRT(B4*B11*(0.563*B6^2+0.004))/2)', v: q.R2, dec: 3 }, 'm'],
      ['Nivel total = marea + sobreelevación + remonte', { f: 'B7+B8+B12', v: q.TWL, dec: 3 }, 'm'],
      ['Margen bajo el malecón', { f: 'B9-B13', v: p.malecon - q.TWL, dec: 3 }, 'm'],
    ],
  };
  const perfil = {
    nombre: 'Perfil y Bruun',
    descripcion: 'Velocidad de caída de la arena, perfil de Dean, profundidad de cierre y retroceso de Bruun, con fórmulas de Excel.',
    columnas: [62, 16, 12],
    filas: [
      [{ v: 'Perfil de equilibrio y regla de Bruun', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul.', estilo: 'nota' }],
      [],
      ['Diámetro de la arena D50', e(p.D50, 3), 'mm'],
      ['Altura de ola de 12 horas al año H_e', e(p.He, 2), 'm'],
      ['Período de esa ola T_e', e(p.Te, 1), 's'],
      ['Altura de la berma B', e(p.berma, 2), 'm'],
      ['Ascenso del mar en 50 años', e((p.ascensoMar / 1000) * 50, 3), 'm'],
      [],
      ['Velocidad de caída w (Ferguson y Church)', { f: '1.65*9.81*(B4/1000)^2/(18*0.000001+SQRT(0.75*1.65*9.81*(B4/1000)^3))', v: pr.w, dec: 5 }, 'm/s'],
      ['Parámetro de Dean A = 0.067·(100w)^0.44', { f: '0.067*(100*B10)^0.44', v: pr.A, dec: 4 }, 'm^(1/3)'],
      ['Profundidad de cierre h_c = 2.28·H_e − 68.5·H_e²/(g·T_e²)', { f: '2.28*B5-68.5*B5^2/(9.81*B6^2)', v: pr.hc, dec: 3 }, 'm'],
      ['Ancho activo x_c = (h_c/A)^(3/2)', { f: '(B12/B11)^1.5', v: pr.xc, dec: 1 }, 'm'],
      ['Retroceso de Bruun R = S·x_c/(B + h_c)', { f: 'B8*B13/(B7+B12)', v: r.bruun50, dec: 2 }, 'm'],
    ],
  };
  const a = r.a;
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año de régimen (medias y extremos de cada mes)',
    nota: 'Simulación cada 2 horas; el ancho de playa cambia con el balance de arena y la regla de Bruun.',
    encabezados: ['Mes', 'H_s media (m)', 'H_s máxima (m)', 'Altura de rotura (m)', 'Ángulo en la rotura (°)', 'Corriente máxima (m/s)', 'Transporte que sale (m³/día)', 'Nivel total máximo (m)', 'Ancho al final del mes (m)'],
    filas: a.meses.map((m) => [m.mes, { v: m.Hs, dec: 2 }, { v: m.Hsmax, dec: 2 }, { v: m.Hb, dec: 2 }, { v: m.thetab, dec: 2 }, { v: m.Vmax, dec: 2 }, { v: m.Qout * 86400, dec: 0 }, { v: m.TWLmax, dec: 2 }, { v: m.W, dec: 2 }]),
    columnas: [10, 16, 16, 20, 22, 22, 26, 22, 24],
  };
  return [ola, perfil, ano];
}
