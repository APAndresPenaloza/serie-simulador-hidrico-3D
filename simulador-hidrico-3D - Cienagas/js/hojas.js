/**
 * hojas.js — Hojas propias del libro de Excel del simulador de ciénagas (con fórmulas).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';

export function hojasExcel(p, r) {
  const e = (v, dec = 2) => ({ v, dec, entrada: true });
  const a = r.a;
  const mes = r.mesAhora;
  const sal = {
    nombre: 'Salinidad de equilibrio',
    descripcion: 'Balance de agua y sal de la ciénaga como una caja, con fórmulas de Excel (datos de entrada en azul).',
    columnas: [58, 16, 12],
    filas: [
      [{ v: 'Salinidad de equilibrio de la ciénaga (modelo de caja)', estilo: 'titulo' }],
      [{ v: 'Medias del mes de ahora; datos de entrada en azul.', estilo: 'nota' }],
      [],
      ['Salinidad del mar S_mar', e(p.Smar, 1), 'PSU'],
      ['Agua de mar que entra por la boca Q_m', e(mes.Qbin, 2), 'm³/s'],
      ['Agua dulce que entra Q_d (ríos, lo que entra por los caños, lluvia)', e(mes.Qr + mes.QcIn + mes.Qll, 2), 'm³/s'],
      ['Evaporación E·A', e(mes.Qe, 2), 'm³/s'],
      [],
      ['Agua que sale (por la boca y de vuelta al río) Q_m + Q_d − E·A', { f: 'B5+B6-B7', v: mes.Qbin + mes.Qr + mes.QcIn + mes.Qll - mes.Qe, dec: 2 }, 'm³/s'],
      ['Salinidad de equilibrio S = S_mar·Q_m/(Q_m + Q_d − E·A)', { f: 'IF(B9>0,B4*B5/B9,"hipersalina")', v: Number.isFinite(mes.Seq) ? mes.Seq : 0, dec: 2 }, 'PSU'],
      ['Salinidad del suelo del manglar 1.25·S + 5', { f: 'IF(ISNUMBER(B10),1.25*B10+5,"—")', v: Number.isFinite(mes.Seq) ? M.salinidadSuelo(mes.Seq) : 0, dec: 2 }, 'PSU'],
      ['Estrés del mangle rojo (40 a 65 PSU)', { f: 'IF(ISNUMBER(B11),MIN(1,MAX(0,(B11-40)/(65-40))),1)', v: Number.isFinite(mes.Seq) ? M.estres(M.salinidadSuelo(mes.Seq), 40, 65) : 1, dec: 3 }, ''],
    ],
  };
  const { Ac, s } = S.geometria(p);
  const cubeta = {
    nombre: 'Cubeta y caños',
    descripcion: 'Área y volumen de la ciénaga, inclinación del agua por el viento y caudal por los caños en los dos sentidos con la ley del orificio, con fórmulas de Excel.',
    columnas: [58, 16, 12],
    filas: [
      [{ v: 'Cubeta somera y caños del Magdalena', estilo: 'titulo' }],
      [{ v: 'Datos de entrada en azul; los resultados se recalculan con fórmulas.', estilo: 'nota' }],
      [],
      ['Área del fondo A_c', e(Ac, 0), 'm²'],
      ['Expansión s (área por metro de nivel)', e(s, 0), 'm²/m'],
      ['Profundidad media h', e(r.h, 3), 'm'],
      ['Número de caños', e(p.nCanos, 0), ''],
      ['Sección de cada caño', e(S.areaCanos(p), 1), 'm²'],
      ['Coeficiente del caño C', e(p.Ccano, 2), ''],
      ['Nivel del Magdalena frente a los caños H (con la marea)', e(r.q.H, 3), 'm.s.n.m.'],
      ['Nivel medio de la ciénaga z', e(r.z, 3), 'm.s.n.m.'],
      ['Viento de los alisios U', e(r.q.U, 2), 'm/s'],
      ['Largo de la ciénaga en la dirección del viento L', e(p.fetch * 1000, 0), 'm'],
      [],
      ['Área del espejo A = A_c + s·h', { f: 'B4+B5*B6', v: r.A, dec: 0 }, 'm²'],
      ['Volumen V = A_c·h + s·h²/2', { f: 'B4*B6+B5*B6^2/2', v: r.V, dec: 0 }, 'm³'],
      ['Inclinación por el viento Δη = 0.0013·(1.2/1000)·U²·L/(9.81·h)', { f: '0.0013*(1.2/1000)*B12^2*B13/(9.81*B6)', v: M.setupViento(r.q.U, p.fetch * 1000, r.h), dec: 4 }, 'm'],
      ['Agua en la orilla de los caños z + Δη/2', { f: 'B11+B17/2', v: r.z + M.setupViento(r.q.U, p.fetch * 1000, r.h) / 2, dec: 3 }, 'm.s.n.m.'],
      ['Desnivel río − orilla de los caños Δh', { f: 'B10-B18', v: r.q.H - r.q.zC, dec: 3 }, 'm'],
      ['Caudal por los caños n·C·A·√(2g·|Δh|)·signo(Δh) (+ entra, − vuelve al río)', { f: 'B7*B9*B8*SQRT(2*9.81*ABS(B19))*SIGN(B19)', v: p.nCanos * p.Ccano * S.areaCanos(p) * Math.sqrt(2 * 9.81 * Math.abs(r.q.H - r.q.zC)) * Math.sign(r.q.H - r.q.zC), dec: 2 }, 'm³/s'],
    ],
  };
  const ano = {
    nombre: 'Año mes a mes',
    titulo: 'Un año de régimen (medias de cada mes)',
    nota: 'Simulación cada 30 minutos con la marea, después de un año de arranque.',
    encabezados: ['Mes', 'Ríos (m³/s)', 'Entra del río por los caños (m³/s)', 'Vuelve al río por los caños (m³/s)', 'Neto por los caños (m³/s)', 'Días con agua saliendo al río', 'Mar que entra (m³/s)', 'Sale por la boca (m³/s)', 'Evaporación (m³/s)', 'Nivel medio (m.s.n.m.)', 'Salinidad media (PSU)', 'Salinidad máxima (PSU)', 'Salinidad de equilibrio (PSU)'],
    filas: a.meses.map((m) => [m.mes, { v: m.Qr, dec: 1 }, { v: m.QcIn, dec: 1 }, { v: m.QcOut, dec: 1 }, { v: m.Qc, dec: 1 }, { v: m.diasRet, dec: 1 }, { v: m.Qbin, dec: 1 }, { v: m.Qbout, dec: 1 }, { v: m.Qe, dec: 1 }, { v: m.z, dec: 3 }, { v: m.S, dec: 2 }, { v: m.Smax, dec: 2 }, Number.isFinite(m.Seq) ? { v: m.Seq, dec: 2 } : 'hipersalina']),
    columnas: [10, 12, 18, 18, 16, 16, 16, 18, 16, 18, 16, 18, 20],
  };
  return [sal, cubeta, ano];
}
