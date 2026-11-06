// Genera js/referencia.js del sistema conectado: la frontera del año y los meses de cada
// eslabón en el escenario base conectado. El sistema conectado los usa si falta la carpeta de
// algún proyecto. Uso (desde la carpeta de la serie): node _herramientas/referencia-sistema.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(raiz, 'simulador-hidrico-3D - Sistema conectado', 'js');
const { MODULOS, faltan } = await import(join(dir, 'proyectos.js'));
if (faltan().length) throw new Error(`Faltan proyectos: ${faltan().join(', ')}`);
const C = await import(join(dir, 'cadena.js'));
const S = await import(join(dir, 'sistema.js'));
const cad = C.calcularCadena(MODULOS, structuredClone(S.PARAMETROS));
const redondo = (x) => (typeof x === 'number' ? Number(x.toPrecision(6)) : x);
const limpio = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, redondo(v)])) : undefined);
const CLAVES = ['Q', 'nivel', 'temperatura', 'salinidad', 'sedimento', 'fosforo', 'OD', 'Qs', 'Hs', 'Tp'];
const ref = {};
for (const id of C.ORDEN) {
  const n = cad.nodos[id];
  ref[id] = {
    nodo: n.f.nodo,
    salida: limpio(n.f.salida),
    ...(n.f.mar ? { mar: limpio(n.f.mar) } : {}),
    meses: n.m.map((m) => limpio(Object.fromEntries(CLAVES.filter((k) => Number.isFinite(m[k])).map((k) => [k, m[k]])))),
    flujos: limpio(n.flujos),
  };
}
const texto = `/**
 * referencia.js — Fronteras de referencia de cada eslabón (escenario base conectado).
 * Generado con _herramientas/referencia-sistema.mjs; no editar a mano. El sistema conectado
 * las usa solo si falta la carpeta de algún proyecto de la serie.
 */
export const REFERENCIA = {
${Object.entries(ref).map(([id, x]) => `  ${id}: {
    nodo: ${JSON.stringify(x.nodo)},
    salida: ${JSON.stringify(x.salida)},${x.mar ? `\n    mar: ${JSON.stringify(x.mar)},` : ''}
    flujos: ${JSON.stringify(x.flujos)},
    meses: [
${x.meses.map((m) => `      ${JSON.stringify(m)},`).join('\n')}
    ],
  },`).join('\n')}
};
`;
writeFileSync(join(dir, 'referencia.js'), texto);
console.log('referencia.js:', Object.keys(ref).join(', '));
