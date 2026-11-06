/**
 * hojas.js — Hojas propias del libro de Excel del simulador de océanos (con fórmulas).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const q = r.q;
  const viento = {
    nombre: 'Viento, Ekman y olas',
    descripcion: 'Esfuerzo del viento, Coriolis, transporte de Ekman, afloramiento y oleaje de Pierson y Moskowitz, con fórmulas de Excel.',
    columnas: [62, 16, 12],
    filas: [
      [{ v: 'Alisios, Ekman y oleaje en mar abierto', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Velocidad del viento U', e(q.U, 2), 'm/s'],
      ['Coeficiente de arrastre C_D', e(p.Cd, 4), ''],
      ['Latitud', e(p.lat, 2), '°'],
      ['Ancho de la franja de afloramiento', e(p.anchoAfloramiento * 1000, 0), 'm'],
      [],
      ['Esfuerzo del viento τ = 1.2·C_D·U²', { f: '1.2*B5*B4^2', v: q.tau, dec: 4 }, 'Pa'],
      ['Coriolis f = 2Ω·sin φ', { f: '2*0.000072921*SIN(RADIANS(B6))', v: q.f, dec: 8 }, '1/s'],
      ['Transporte de Ekman M = τ/(ρ·f)', { f: 'B9/(1025*B10)', v: q.Mek, dec: 3 }, 'm²/s'],
      ['Afloramiento w = M/L', { f: 'B11/B7*86400', v: q.wDia, dec: 2 }, 'm/día'],
      ['Altura significativa H_s = 0.21·U²/g', { f: '0.21*B4^2/9.81', v: q.Hs, dec: 3 }, 'm'],
      ['Período pico T_p = 7.16·U/g', { f: '7.16*B4/9.81', v: q.Tp, dec: 3 }, 's'],
      ['Longitud de onda L₀ = g·T²/(2π)', { f: '9.81*B14^2/(2*PI())', v: q.L0, dec: 2 }, 'm'],
      ['Potencia P = ρ·g²·H²·(0.9·T)/(64π)', { f: '1025*9.81^2*B13^2*0.9*B14/(64*PI())/1000', v: q.P / 1000, dec: 2 }, 'kW/m'],
    ],
  };
  const fu = r.fu;
  const carbono = {
    nombre: 'Nivel y carbono',
    descripcion: 'Ascenso del mar con aceleración, CO₂, pH y aragonito en el año del horizonte, con fórmulas de Excel.',
    columnas: [62, 16, 12],
    filas: [
      [{ v: 'El mar en el año del horizonte', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul.', estilo: 'nota' }],
      [],
      ['Años desde 2026', e(fu.t, 0), 'años'],
      ['Ascenso de hoy a', e(p.tasaMar, 2), 'mm/año'],
      ['Aceleración b', e(p.aceleracion, 3), 'mm/año²'],
      ['CO₂ del aire hoy', e(p.CO2, 0), 'ppm'],
      ['Crecimiento del CO₂ r', e(p.rCO2, 4), '1/año'],
      ['pH de hoy', e(p.pH0, 3), ''],
      ['Aragonito de hoy Ω₀', e(p.Om0, 2), ''],
      [],
      ['Ascenso del mar h = a·t + b·t²', { f: 'B5*B4+B6*B4^2', v: fu.nivel, dec: 1 }, 'mm'],
      ['CO₂ C = C₀·e^(r·t)', { f: 'B7*EXP(B8*B4)', v: fu.C, dec: 1 }, 'ppm'],
      ['pH = pH₀ − 0.9·log₁₀(C/C₀)', { f: 'B9-0.9*LOG10(B13/B7)', v: fu.pH, dec: 4 }, ''],
      ['Aragonito Ω = Ω₀·10^(0.7·(pH − pH₀))', { f: 'B10*10^(0.7*(B14-B9))', v: fu.Om, dec: 3 }, ''],
    ],
  };
  const a = r.a;
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año de régimen (medias de cada mes)',
    nota: 'Simulación día a día después de un año de arranque; DHW: calor acumulado en el arrecife en 12 semanas.',
    encabezados: ['Mes', 'Viento (m/s)', 'Transporte de Ekman (m²/s)', 'Afloramiento (m/día)', 'H_s media (m)', 'H_s máxima (m)', 'Potencia (kW/m)', 'Temperatura mar adentro (°C)', 'Temperatura en La Guajira (°C)', 'DHW máximo (°C·semana)'],
    filas: a.meses.map((m) => [m.mes, { v: m.U, dec: 2 }, { v: m.Mek, dec: 2 }, { v: m.wDia, dec: 1 }, { v: m.Hs, dec: 2 }, { v: m.Hsmax, dec: 2 }, { v: m.P / 1000, dec: 1 }, { v: m.T, dec: 2 }, { v: m.Tg, dec: 2 }, { v: m.dhw, dec: 2 }]),
    columnas: [10, 14, 24, 20, 14, 16, 16, 26, 28, 22],
  };
  return [viento, carbono, ano];
}
