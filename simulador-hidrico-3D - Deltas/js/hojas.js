/**
 * hojas.js — Hojas propias del libro de Excel del simulador de deltas (con fórmulas).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const q = r.q;
  const gp = M.gReducida(p.Smar);
  const U = q.Qp / (p.anchoCanal * r.h);
  const Fr = M.froudeDensimetrico(U, gp, r.h);
  const cuna = {
    nombre: 'Cuña salina',
    descripcion: 'Longitud de la cuña salina de Schijf y Schönfeld con el caudal y la profundidad de ahora, con fórmulas de Excel.',
    columnas: [60, 16, 12],
    filas: [
      [{ v: 'Cuña salina en el canal de la desembocadura', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Caudal que llega a la boca Q', e(q.Qp, 1), 'm³/s'],
      ['Ancho del canal entre los tajamares B', e(p.anchoCanal, 0), 'm'],
      ['Profundidad del canal h', e(r.h, 3), 'm'],
      ['Salinidad del mar', e(p.Smar, 1), 'PSU'],
      ['Coeficiente de fricción en la interfaz C_i', e(p.Ci, 5), ''],
      [],
      ['Velocidad del río U = Q/(B·h)', { f: 'B4/(B5*B6)', v: U, dec: 3 }, 'm/s'],
      ["Gravedad reducida g' = 9.81 × 0.00078 × S", { f: '9.81*0.00078*B7', v: gp, dec: 4 }, 'm/s²'],
      ["Froude densimétrico Fr = U/√(g'·h)", { f: 'B10/SQRT(B11*B6)', v: Fr, dec: 4 }, ''],
      ['Longitud de equilibrio de la cuña L', { f: 'IF(B12>=1,0,B6/(4*B8)*(0.2/B12^2-2+3*B12^(2/3)-1.2*B12^(4/3)))', v: Math.min(S.SITIO.Lmax, M.cunaSalina(r.h, p.Ci, Fr)), dec: 0 }, 'm'],
    ],
  };
  const de = r.de;
  const sed = {
    nombre: 'Sedimento y delta',
    descripcion: 'Curva de sedimento, carga, oleaje (Komar y Gaughan, CERC) y avance del frente del delta, con fórmulas de Excel.',
    columnas: [62, 16, 14],
    filas: [
      [{ v: 'Sedimento del río y crecimiento del delta', estilo: 'titulo' }],
      [{ v: 'Medias del año; datos de entrada en azul.', estilo: 'nota' }],
      [],
      ['Caudal medio de referencia Q̄', e(p.Qm, 0), 'm³/s'],
      ['Concentración con el caudal medio C₀', e(p.C0, 0), 'mg/L'],
      ['Exponente de la curva de carga b', e(p.bSed, 2), ''],
      ['Caudal de ahora Q', e(q.Q, 1), 'm³/s'],
      [],
      ['Concentración C = C₀·(Q/Q̄)^(b−1)', { f: 'B5*(B7/B4)^(B6-1)', v: q.C, dec: 1 }, 'mg/L'],
      ['Carga de sedimento Q·C/1000', { f: 'B7*B9/1000', v: q.Qs, dec: 1 }, 'kg/s'],
      [],
      ['Sedimento del año (simulado)', e(r.a.Mt, 0), 't/año'],
      ['Parte que se queda en el frente', e(p.fRetencion, 2), ''],
      ['Densidad del depósito ρ_b', e(p.rhoB, 2), 't/m³'],
      ['Volumen que se queda V_s', { f: 'B13*B12/B14', v: de.Vs, dec: 0 }, 'm³/año'],
      ['Altura del oleaje en aguas profundas H₀', e(p.Hs, 2), 'm'],
      ['Período del oleaje T', e(p.Tp, 1), 's'],
      ['Ángulo del oleaje en la rotura θ', e(p.anguloOla, 1), '°'],
      ['Altura de rotura H_b = 0.39·g^(1/5)·(T·H₀²)^(2/5)', { f: '0.39*9.81^0.2*(B17*B16^2)^0.4', v: de.Hb, dec: 3 }, 'm'],
      ['Transporte litoral CERC', { f: '0.39*SQRT(9.81/0.78)*B19^2.5*SIN(2*RADIANS(B18))/(16*1.65*0.6)*365*86400', v: de.Vls, dec: 0 }, 'm³/año'],
      ['Dominancia R = V_s/transporte litoral', { f: 'B15/B20', v: de.R, dec: 3 }, ''],
      ['Altura del frente (profundidad + cota de la llanura)', e(de.H, 1), 'm'],
      ['Ancho del frente', e(p.anchoFrente * 1000, 0), 'm'],
      ['Avance del frente (V_s − litoral)/(ancho·altura)', { f: '(B15-B20)/(B23*B22)', v: de.avance, dec: 2 }, 'm/año'],
    ],
  };
  const a = r.a;
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año de régimen (medias de cada mes)',
    nota: 'Simulación cada 6 horas después de un año de arranque; el dragado devuelve el canal al calado de diseño.',
    encabezados: ['Mes', 'Caudal del río (m³/s)', 'A la boca (m³/s)', 'Canal del Dique (m³/s)', 'Sedimento (mg/L)', 'Carga (kg/s)', 'Profundidad del canal (m)', 'Cuña media (km)', 'Cuña máxima (km)', 'Alcance de la pluma (km)', 'Dragado (m³)'],
    filas: a.meses.map((m) => [m.mes, { v: m.Q, dec: 0 }, { v: m.Qp, dec: 0 }, { v: m.Qd, dec: 0 }, { v: m.C, dec: 0 }, { v: m.Qs, dec: 0 }, { v: m.h, dec: 2 }, { v: m.L / 1000, dec: 2 }, { v: m.Lmax / 1000, dec: 2 }, { v: m.alcance / 1000, dec: 1 }, { v: m.dragado, dec: 0 }]),
    columnas: [10, 18, 16, 18, 16, 14, 20, 14, 16, 20, 14],
  };
  return [cuna, sed, ano];
}
