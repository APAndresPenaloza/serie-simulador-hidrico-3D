/**
 * nodo.js — La ciénaga como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe uno de los ríos de la Sierra Nevada (el del simulador de ríos), el nivel y el
 * sedimento del río grande (el del delta: el Magdalena frente a los caños) y las condiciones
 * del mar (nivel, marea y salinidad, del simulador de océanos). Entrega al delta y al mar el
 * agua que sale por la boca, con su salinidad, su temperatura, su oxígeno y su fósforo, y al
 * delta lo que los caños le toman al río (Qtoma) y lo que la ciénaga le devuelve (Qretorno).
 */
import * as S from './sistema.js';

export const NODO = { id: 'cienagas', nombre: 'Ciénaga costera' };
const Q_RIO_REF = 6.35;     // m³/s: el río del simulador de ríos en condición normal
const Q_MAG_REF = 6800;     // m³/s: caudal medio que el río grande entrega al mar en el simulador de deltas

export function salida(p, r) {
  return {
    nodo: 'Ciénaga Grande (laguna costera)',
    salida: { Q: r.a.Qsale, salinidad: r.S, temperatura: r.ca.Tagua, OD: r.ca.OD, fosforo: r.ca.P, sedimento: 20, nivel: r.z, Qtoma: r.a.QcIn, Qretorno: r.a.QcOut },
    clima: { anio: p.clima },
  };
}

export const textoEntrada = 'El río de la Sierra reemplaza a uno de los ríos de referencia; el río grande fija el nivel frente a los caños; el mar fija el nivel medio, la marea y la salinidad.';
export const entradas = [
  {
    origen: 'rios',
    claves: ['Qrios', 'SSrios', 'Prios'],
    aplicar: (p, f) => {
      // El río reemplaza a uno de los ríos de referencia; los demás conservan su caudal y su
      // calidad, y la mezcla da el sedimento y el fósforo del conjunto: C = Σ Q·C / Σ Q.
      // El clima del año ya está en el caudal que llega: se divide por el factor de los ríos
      // del clima de la ciénaga para que el modelo no lo vuelva a aplicar.
      const Q = Math.max(0, f.salida.Q ?? Q_RIO_REF);
      const otros = Math.max(0, S.PARAMETROS.Qrios - Q_RIO_REF);
      const Qr = otros + Q;
      const fRios = S.CLIMAS[p.clima]?.fRios || 1;
      const mezcla = (C, Cotros) => (Qr > 0 ? (otros * Cotros + Q * C) / Qr : Cotros);
      const cambios = { Qrios: otros + Q / fRios };
      if (Number.isFinite(f.salida.sedimento)) cambios.SSrios = mezcla(f.salida.sedimento, S.PARAMETROS.SSrios);
      if (Number.isFinite(f.salida.fosforo)) cambios.Prios = mezcla(f.salida.fosforo, S.PARAMETROS.Prios);
      return { cambios, texto: `El río de la Sierra entrega ${Q.toFixed(2)} m³/s: con los demás ríos suman ${Qr.toFixed(1)} m³/s${cambios.SSrios ? `, con ${cambios.SSrios.toFixed(0)} mg/L de sedimento` : ''}${cambios.Prios ? ` y ${cambios.Prios.toFixed(1)} µg/L de fósforo` : ''}.` };
    },
    ejemplo: { salida: { Q: 9.5, sedimento: 800, fosforo: 60 } },
  },
  {
    origen: 'deltas',
    claves: ['Hrio', 'SSmag'],
    aplicar: (p, f) => {
      // El caudal del año ya trae el clima: se descuenta el cambio de nivel que el modelo de la
      // ciénaga le suma por el clima, para no contarlo dos veces.
      const Q = f.salida.Q ?? Q_MAG_REF;
      const cambios = { Hrio: S.PARAMETROS.Hrio + 0.00012 * (Q - Q_MAG_REF) - (S.CLIMAS[p.clima]?.dH ?? 0) };
      if (Number.isFinite(f.salida.sedimento)) cambios.SSmag = f.salida.sedimento;
      return { cambios, texto: `El río grande lleva ${Math.round(Q)} m³/s en el año: su nivel medio frente a los caños queda en ${(cambios.Hrio + (S.CLIMAS[p.clima]?.dH ?? 0)).toFixed(2)} m.` };
    },
    ejemplo: { salida: { Q: 5000, sedimento: 450 } },
  },
  {
    origen: 'oceanos',
    claves: ['nivelMar', 'Smar', 'K1', 'O1', 'M2', 'S2'],
    aplicar: (p, f) => {
      const m = f.mar ?? {};
      const cambios = {};
      if (Number.isFinite(m.nivelMedio)) cambios.nivelMar = m.nivelMedio;
      if (Number.isFinite(m.salinidad)) cambios.Smar = m.salinidad;
      if (Number.isFinite(m.marea)) {
        const suma = S.PARAMETROS.K1 + S.PARAMETROS.O1 + S.PARAMETROS.M2 + S.PARAMETROS.S2;
        const k = m.marea / suma;
        Object.assign(cambios, { K1: S.PARAMETROS.K1 * k, O1: S.PARAMETROS.O1 * k, M2: S.PARAMETROS.M2 * k, S2: S.PARAMETROS.S2 * k });
      }
      return { cambios, texto: 'El mar fija el nivel medio, la amplitud de la marea y la salinidad en la boca.' };
    },
    ejemplo: { salida: { Q: 0 }, mar: { nivelMedio: 0.2, marea: 0.3, salinidad: 36.5, temperatura: 28.5 } },
  },
];

export function mensual(p) {
  const a = S.anoMensual(p);
  const r = S.calcular(p, { ...S.estadoInicial(p), t: 6 * 3600 });
  return a.meses.map((m) => ({ mes: m.mes, Q: m.Qbout, salinidad: m.S, nivel: m.z, fosforo: r.ca.P, OD: r.ca.ODmin, sedimento: 20, Qtoma: m.QcIn, Qretorno: m.QcOut }));
}
