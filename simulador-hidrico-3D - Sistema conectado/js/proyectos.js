/**
 * proyectos.js — Carga los modelos de los demás proyectos de la serie.
 * -----------------------------------------------------------------------
 * Cada proyecto vive en su carpeta hermana («../simulador-hidrico-3D - Lagunas/js/…»). Sus
 * módulos se importan con import() relativo a este archivo, así que el sistema conectado
 * funciona cuando todas las carpetas de la serie están juntas (como en el .zip de la serie) y
 * se sirven desde la carpeta que las contiene. El río usa un adaptador propio (nodos/rios.js)
 * porque el simulador de ríos no se modifica.
 * Si falta alguna carpeta, el sistema usa la frontera de referencia de ese proyecto
 * (referencia.js, valores del escenario base) y la revisión lo advierte.
 */
import { PROYECTOS } from './nucleo/conexion.js';

export const NODOS = ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas', 'oceanos', 'costas'];

const carpeta = (id) => PROYECTOS.find((x) => x.id === id)?.carpeta ?? id;

async function cargar(id) {
  try {
    if (id === 'rios') {
      const A = await import('./nodos/rios.js');
      return { id, ok: true, adaptador: true, S: null, N: A, A };
    }
    const base = new URL(`../../${carpeta(id)}/js/`, import.meta.url);
    const [S, N] = await Promise.all([import(new URL('sistema.js', base).href), import(new URL('nodo.js', base).href)]);
    return { id, ok: true, S, N };
  } catch (err) {
    return { id, ok: false, error: String(err?.message ?? err) };
  }
}

/** Módulos de cada proyecto: { id: { ok, S (sistema.js), N (nodo.js), error } }. */
export const MODULOS = Object.fromEntries(await Promise.all(NODOS.map(async (id) => [id, await cargar(id)])));
export const faltan = () => NODOS.filter((id) => !MODULOS[id].ok);
