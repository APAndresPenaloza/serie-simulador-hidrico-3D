/**
 * nodo.js — El océano como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe del delta el caudal del río grande (su pluma baja la salinidad frente a la boca y
 * en el arrecife) y entrega a la ciénaga, al delta y a la costa las condiciones del mar: el
 * nivel medio en el año del horizonte y la rapidez con que sube (la derivada de su ascenso), la
 * amplitud de la marea, el oleaje medio del año (altura, período y dirección), la salinidad y la
 * temperatura del mar.
 */
import * as S from './sistema.js';

export const NODO = { id: 'oceanos', nombre: 'Mar abierto' };

export function salida(p, r) {
  return {
    nodo: 'Mar Caribe frente a Colombia',
    salida: { Q: 0, salinidad: p.Smar, temperatura: r.a.T },
    mar: {
      nivelMedio: r.fu.nivel / 1000,
      ascenso: p.tasaMar + 2 * p.aceleracion * r.fu.t,
      marea: p.K1 + p.O1 + p.M2 + p.S2,
      Hs: r.a.Hs,
      Tp: r.a.Tp,
      direccion: S.SITIO.direccionOla,
      salinidad: p.Smar,
      temperatura: r.a.T,
    },
    clima: { anio: p.clima },
  };
}

export const textoEntrada = 'El delta entrega el caudal del río grande: su pluma de agua dulce baja la salinidad frente a la boca y, si es muy grande, en el arrecife.';
export const entradas = [
  {
    origen: 'deltas',
    claves: ['Qrio'],
    aplicar: (p, f) => ({
      cambios: { Qrio: Math.max(0, f.salida.Q ?? S.PARAMETROS.Qrio) },
      texto: `El río grande entrega ${Math.round(f.salida.Q ?? 0)} m³/s al mar.`,
    }),
    ejemplo: { salida: { Q: 9000, sedimento: 650, Qs: 5800, salinidad: 0.1 } },
  },
];

/** Un año mes a mes para el sistema conectado. */
export function mensual(p) {
  const a = S.anoMensual(p);
  return a.meses.map((m) => ({ mes: m.mes, Q: 0, Hs: m.Hs, Tp: m.Tp, temperatura: m.T, afloramiento: m.Tg, dhw: m.dhw }));
}
