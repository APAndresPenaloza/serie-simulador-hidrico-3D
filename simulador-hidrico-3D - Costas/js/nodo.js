/**
 * nodo.js — La playa como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe del delta la carga de sedimento del río grande (la arena que alimenta las playas
 * crece y baja con ella) y del océano el oleaje de fondo, la marea y el nivel medio del mar.
 * Es el último eslabón de la costa: lo que entrega (la arena que sigue a lo largo de la costa y
 * el agua del emisario) queda escrito en su frontera para el sistema conectado.
 */
import * as S from './sistema.js';

export const NODO = { id: 'costas', nombre: 'Playa del Caribe' };
const QS_REF = 4200;        // kg/s: carga media que el delta entrega al mar en su escenario base
const ABRIGO = 0.75;        // la bahía deja entrar el 75 % de la altura del oleaje del mar abierto
const REFRACCION = 0.15;    // y lo refracta: llega con el 15 % del ángulo que trae mar afuera (20° → 3°)

export function salida(p, r) {
  return {
    nodo: 'Playa de bahía (referencia: El Rodadero)',
    salida: {
      Q: p.Qemisario,
      coliformes: r.col.C,
      Qs: r.a.Qout * 2650 * 0.6,
      temperatura: 28,
    },
    clima: { anio: p.clima },
  };
}

export const textoEntrada = 'El delta fija cuánta arena llega a la playa; el océano fija el oleaje de fondo, la marea y el nivel medio del mar.';
export const entradas = [
  {
    origen: 'deltas',
    claves: ['aporte'],
    aplicar: (p, f) => {
      // La carga del río grande ya trae el clima del año: se divide por el factor de arena del
      // clima de la playa para que el modelo no lo vuelva a aplicar.
      const Qs = f.salida.Qs ?? QS_REF;
      const llega = (S.PARAMETROS.aporte * Math.max(0, Qs)) / QS_REF;
      const aporte = Math.round(llega / (S.CLIMAS[p.clima]?.fAporte || 1));
      return { cambios: { aporte }, texto: `El río grande lleva ${Math.round(Qs)} kg/s de sedimento al mar: a la playa llegan ${(llega / 1000).toFixed(0)} mil m³ de arena al año.` };
    },
    ejemplo: { salida: { Q: 6800, sedimento: 590, Qs: 2100, salinidad: 0.1 } },
  },
  {
    origen: 'oceanos',
    claves: ['Hs0', 'Tp', 'theta0', 'nivelMar', 'ascensoMar', 'K1', 'O1', 'M2', 'S2'],
    aplicar: (p, f) => {
      const m = f.mar ?? {};
      const cambios = {};
      // El oleaje de mar afuera ya trae el clima del año (los alisios): se divide por el factor
      // de oleaje del clima de la playa para no contarlo dos veces.
      if (Number.isFinite(m.Hs)) cambios.Hs0 = (ABRIGO * m.Hs) / (S.CLIMAS[p.clima]?.fOla || 1);
      if (Number.isFinite(m.Tp)) cambios.Tp = m.Tp;
      if (Number.isFinite(m.direccion)) cambios.theta0 = Math.min(45, Math.abs(m.direccion) * REFRACCION);
      if (Number.isFinite(m.nivelMedio)) cambios.nivelMar = m.nivelMedio;
      if (Number.isFinite(m.ascenso)) cambios.ascensoMar = m.ascenso;
      if (Number.isFinite(m.marea)) {
        const suma = S.PARAMETROS.K1 + S.PARAMETROS.O1 + S.PARAMETROS.M2 + S.PARAMETROS.S2;
        for (const k of ['K1', 'O1', 'M2', 'S2']) cambios[k] = (S.PARAMETROS[k] * m.marea) / suma;
      }
      return { cambios, texto: 'El océano fija el oleaje de fondo (la bahía lo abriga al 75 % y lo refracta: llega con el 15 % de su ángulo, casi de frente), la marea, el nivel medio del mar y la rapidez con que sube.' };
    },
    ejemplo: { salida: { Q: 0 }, mar: { nivelMedio: 0.15, ascenso: 5, marea: 0.2, Hs: 1.5, Tp: 8, direccion: 20, salinidad: 36.2, temperatura: 28 } },
  },
];

/** Un año mes a mes para el sistema conectado. */
export function mensual(p) {
  const a = S.anoMensual(p);
  return a.meses.map((m) => ({ mes: m.mes, Q: p.Qemisario, Hs: m.Hs, Hb: m.Hb, ancho: m.W, Qs: m.Qout * 2650 * 0.6 }));
}
