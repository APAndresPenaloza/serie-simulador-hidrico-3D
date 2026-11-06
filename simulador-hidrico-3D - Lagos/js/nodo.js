/**
 * nodo.js — El lago como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe de la laguna del páramo el agua que rebosa (un tributario más, con su fósforo) y
 * entrega al río el agua que desagua, con la temperatura y el oxígeno de la superficie, el
 * fósforo del lago y poco sedimento (el lago lo atrapa casi todo).
 */
import * as S from './sistema.js';

export const NODO = { id: 'lagos', nombre: 'Lago andino' };

export function salida(p, r) {
  return {
    nodo: 'Lago andino de alta montaña',
    salida: {
      Q: r.q.Qdesague,
      sedimento: 2,
      temperatura: r.tr.Te,
      OD: r.oxigeno.ODsatSup,
      fosforo: r.nu.P,
      nivel: r.nivel.eta,
    },
    clima: { anio: p.clima, factorLluvia: S.CLIMAS[p.clima]?.fLluvia ?? 1 },
  };
}

export const textoEntrada = 'El agua que rebosa de la laguna entra como un tributario más, con su fósforo.';
export const entradas = [
  {
    origen: 'lagunas',
    claves: ['aporteExterno', 'fosforoExterno'],
    aplicar: (p, f) => ({
      cambios: { aporteExterno: f.salida.Q ?? 0, fosforoExterno: f.salida.fosforo ?? 0 },
      texto: `Entra un tributario de ${(f.salida.Q ?? 0).toFixed(3)} m³/s con ${(f.salida.fosforo ?? 0).toFixed(1)} µg/L de fósforo.`,
    }),
    ejemplo: { salida: { Q: 0.1, fosforo: 5, temperatura: 4, sedimento: 1 } },
  },
];

/** Un año mes a mes para el sistema conectado. */
export function mensual(p) {
  const ano = S.anoMensual(p);
  const r = S.calcular(p, { ...S.estadoInicial(p), t: 6 * 3600 });
  return ano.meses.map((m) => ({ mes: m.mes, Q: m.Qdesague, nivel: m.eta, temperatura: m.Te, fosforo: r.nu.P, OD: m.ODmin, sedimento: 2 }));
}
