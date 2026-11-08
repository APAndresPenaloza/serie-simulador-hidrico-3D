/**
 * nodo.js — El río de la Sierra Nevada como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe del lago el agua que desagua: entra por la cabecera (km 0) y recorre todo el río,
 * así que sube el caudal de las tres zonas y la cota en la bocatoma y diluye el vertimiento.
 * Entrega a la ciénaga lo que sale por la desembocadura (km 50): el caudal con el vertimiento,
 * el sedimento, la temperatura y la calidad del agua del perfil de Streeter-Phelps.
 *
 * El simulador de ríos no modela el fósforo: sus concentraciones son valores de referencia
 * (los mismos del sistema conectado) y se mezclan con C = (Q₁·C₁ + Q₂·C₂)/(Q₁ + Q₂).
 */
import * as R from './rio.js';
import * as L from './lluvia.js';

export const NODO = { id: 'rios', nombre: 'Río de la Sierra Nevada' };

/** Fósforo total de cada tipo de vertimiento [µg/L] (valores típicos de referencia). */
export const P_VERTIMIENTO = { ninguno: 0, tratada: 3000, domestica: 7000, cafe: 10000, agricola: 1000 };
/** Fósforo de la escorrentía de la cuenca [µg/L] (referencia). */
export const P_CUENCA = 40;

const mezcla = (Q1, C1, Q2, C2) => (Q1 + Q2 > 0 ? (Q1 * C1 + Q2 * C2) / (Q1 + Q2) : 0);

/** Frontera de salida: lo que el río entrega a la ciénaga en este instante. */
export function salida(p, r) {
  const cal = r.rio.calidad;
  const d = cal.desembocadura;
  const Qrio = cal.hid.baja.Q;                          // río en la zona baja, con la represa y el lago
  const Qlago = Math.max(0, p.Qlago ?? 0);
  const Qcuenca = Math.max(0, Qrio - Qlago);
  const Pnat = mezcla(Qcuenca, P_CUENCA, Qlago, p.Plago ?? 0);
  return {
    nodo: 'Río de la Sierra Nevada (desembocadura, km 50)',
    salida: {
      Q: Qrio + cal.Qv,
      sedimento: mezcla(Qcuenca, p.sedimento, Qlago, p.SSlago ?? 2),
      temperatura: R.ZONAS.baja.Tagua,
      OD: d.OD,
      DBO: d.DBO,
      coliformes: d.CF,
      nitrogeno: d.NO3,
      fosforo: mezcla(Qrio, Pnat, cal.Qv, P_VERTIMIENTO[p.vertTipo] ?? 0),
    },
    clima: { anio: p.climaAno, factorLluvia: L.clima(p.climaAno).fLluvia },
  };
}

export const textoEntrada = 'El agua que desagua el lago entra por la cabecera y recorre todo el río: sube el caudal de las tres zonas y la cota en la bocatoma, y diluye el vertimiento.';
export const textoSinEntrada = 'Ahora el río lleva solo el agua de su cuenca (no hay frontera del lago aplicada).';

export const entradas = [
  {
    origen: 'lagos',
    claves: ['Qlago', 'Plago', 'SSlago'],
    // El clima del año ya está en el caudal del lago; el clima del río solo mueve la lluvia de su cuenca.
    aplicar: (p, f) => {
      const Q = Math.max(0, f.salida.Q ?? 0);
      return {
        cambios: { Qlago: Q, Plago: f.salida.fosforo ?? 0, SSlago: f.salida.sedimento ?? 2 },
        texto: `El lago entrega ${Q.toFixed(2)} m³/s a la cabecera del río.`,
      };
    },
    ejemplo: { salida: { Q: 1.3, fosforo: 15, sedimento: 2, temperatura: 14 } },
  },
];
