/**
 * nodo.js — El sistema conectado como nodo de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Recibe las fronteras de los siete proyectos: una frontera importada (archivo .json o enlace
 * en vivo con un simulador abierto en otra pestaña) reemplaza al modelo de ese eslabón en la
 * cadena, y todo lo que está aguas abajo se recalcula con ella. Entrega lo que la red lleva al
 * mar: el agua dulce del río grande y de la ciénaga, con su sedimento, y las condiciones del mar.
 */
import * as C from './cadena.js';
import { REFERENCIA } from './referencia.js';

export const NODO = { id: 'sistema', nombre: 'Sistema conectado' };

export function salida(p, r) {
  const n = r.cad.nodos;
  const D = n.deltas.f.salida;
  const Ci = n.cienagas.f.salida;
  const Q = D.Q + Ci.Q;
  const mezcla = (a, b) => (Q > 0 ? (D.Q * a + Ci.Q * b) / Q : 0);
  return {
    nodo: 'Del páramo al océano: lo que la red lleva al mar',
    salida: {
      Q,
      sedimento: mezcla(D.sedimento ?? 0, Ci.sedimento ?? 0),
      Qs: D.Qs ?? 0,
      salinidad: mezcla(D.salinidad ?? 0.1, Ci.salinidad ?? 0),
      temperatura: mezcla(D.temperatura ?? 27.5, Ci.temperatura ?? 29),
    },
    mar: n.oceanos.f.mar ?? null,
    clima: { anio: p.clima, horizonte: C.HORIZONTES[p.horizonte]?.ano ?? 2026 },
  };
}

export const textoEntrada = 'Una frontera importada de cualquier proyecto reemplaza a su modelo en la cadena y todo lo que está aguas abajo se recalcula con ella. Así se conecta un simulador abierto en otra pestaña (en vivo) o uno publicado en otro sitio (archivo).';

export const textoSinEntrada = 'Ahora cada eslabón usa su propio modelo (no hay fronteras importadas).';

export const entradas = C.ORDEN.map((origen) => ({
  origen,
  claves: [`fr_${origen}`],
  aplicar: (p, f) => ({
    cambios: { [`fr_${origen}`]: structuredClone(f) },
    texto: `La frontera de ${C.NOMBRES[origen].toLowerCase()} (${f.nodo ?? C.CUERPOS[origen]}) reemplaza a su modelo en la cadena.`,
  }),
  ejemplo: { nodo: REFERENCIA[origen].nodo, salida: REFERENCIA[origen].salida, ...(REFERENCIA[origen].mar ? { mar: REFERENCIA[origen].mar } : {}) },
}));
