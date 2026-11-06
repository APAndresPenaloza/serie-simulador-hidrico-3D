// Pruebas comunes de la serie: libro de Excel (se descomprime con zlib y se revisa), registro
// de la serie de tiempo y frontera de conexión con los demás proyectos. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import * as S from '../js/sistema.js';
import * as N from '../js/nodo.js';
import { hojasExcel } from '../js/hojas.js';
import { Registro, crearLibro, unirEsquemas } from '../js/nucleo/datos.js';
import { crearFrontera, validarFrontera, RED, PROYECTOS } from '../js/nucleo/conexion.js';
import { textoPlano } from '../js/nucleo/formato.js';

/** Lee las entradas de un ZIP (encabezados locales) y devuelve { ruta: texto }. */
function descomprimir(bytes) {
  const b = Buffer.from(bytes);
  const archivos = {};
  let i = 0;
  while (b.readUInt32LE(i) === 0x04034b50) {
    const metodo = b.readUInt16LE(i + 8);
    const tam = b.readUInt32LE(i + 18);
    const nNombre = b.readUInt16LE(i + 26);
    const nExtra = b.readUInt16LE(i + 28);
    const nombre = b.toString('utf8', i + 30, i + 30 + nNombre);
    const ini = i + 30 + nNombre + nExtra;
    const datos = b.subarray(ini, ini + tam);
    archivos[nombre] = (metodo === 8 ? inflateRawSync(datos) : datos).toString('utf8');
    i = ini + tam;
  }
  return archivos;
}

const p = structuredClone(S.PARAMETROS);
const sim = S.estadoInicial(p);
sim.t = 6 * 3600;
const r = S.calcular(p, sim);
const proyecto = N.NODO.id;

function libro() {
  const registro = new Registro(proyecto, [{ clave: 'x', nombre: 'Prueba', unidad: 'm', dec: 2 }], 3600);
  registro.reiniciar(0);
  registro.avanzar(0, 3 * 3600, (t) => ({ x: t / 3600 }));
  const revision = Object.entries(r.revision).flatMap(([pestana, l]) => l.map((c) => ({ ...c, pestana })));
  const frontera = crearFrontera(proyecto, N.salida(p, r, sim));
  const bytes = crearLibro({
    meta: { titulo: 'Prueba', subtitulo: 'Libro de prueba', fecha: '2026-11-05', reloj: 'Día 1, 06:00', fechaObjeto: new Date('2026-11-05T12:00:00Z') },
    estados: [{ nombre: 'Estado', texto: 'Todo <b>bien</b>', nivel: 'ok' }],
    actual: { nombre: 'Al exportar', filas: [{ clave: 'a', bloque: 'Pestaña', grupo: 'Parámetros', etiqueta: 'Valor', unidad: 'm', valor: 1.23456, dec: 2 }] },
    registro, revision, tablas: hojasExcel(p, r, sim), frontera, relojTexto: (t) => `t = ${t}`,
  });
  return { bytes, registro, revision, frontera };
}

test('Excel: el libro es un ZIP válido con todas sus hojas', () => {
  const { bytes } = libro();
  assert.equal(bytes[0], 0x50);   // «PK»
  assert.equal(bytes[1], 0x4b);
  const a = descomprimir(bytes);
  for (const parte of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'docProps/core.xml']) assert.ok(a[parte], parte);
  const nombres = [...a['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
  for (const n of ['Resumen', 'Parámetros y resultados', 'Serie de tiempo', 'Revisión del diseño', 'Conexión', ...hojasExcel(p, r, sim).map((h) => h.nombre)]) {
    assert.ok(nombres.includes(n.slice(0, 31)), `falta la hoja ${n}`);
  }
});

test('Excel: la revisión del diseño trae todos los criterios', () => {
  const { bytes, revision } = libro();
  const a = descomprimir(bytes);
  const i = [...a['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].findIndex((m) => m[1] === 'Revisión del diseño');
  const hoja = a[`xl/worksheets/sheet${i + 1}.xml`];
  const filas = (hoja.match(/<row /g) ?? []).length;
  assert.equal(filas, revision.length + 1);
  for (const c of revision.slice(0, 3)) assert.ok(hoja.includes(textoPlano(c.texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')));
});

test('Excel: las hojas del simulador traen fórmulas con su valor calculado', () => {
  const { bytes } = libro();
  const a = descomprimir(bytes);
  const hojas = Object.entries(a).filter(([k]) => k.startsWith('xl/worksheets/'));
  const formulas = hojas.flatMap(([, x]) => [...x.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>([^<]+)<\/f>(<v>([^<]+)<\/v>)?/g)]);
  assert.ok(formulas.length >= 5, 'al menos cinco fórmulas');
  for (const f of formulas) {
    assert.ok(!/undefined|NaN/.test(f[2]), `fórmula inválida en ${f[1]}: ${f[2]}`);
    assert.ok(f[4] !== undefined && Number.isFinite(Number(f[4])), `sin valor calculado en ${f[1]}`);
  }
});

test('Registro: una fila por intervalo y escenarios unidos en orden', () => {
  const { registro } = libro();
  assert.deepEqual(registro.filas.map((f) => f.t), [0, 3600, 7200, 10800]);
  const e = unirEsquemas([[{ clave: 'a' }, { clave: 'b' }], [{ clave: 'a' }, { clave: 'c' }, { clave: 'b' }]]);
  assert.deepEqual(e.map((x) => x.clave), ['a', 'c', 'b']);
});

test('Conexión: la frontera de salida es válida y la red es coherente', () => {
  const { frontera } = libro();
  const v = validarFrontera(frontera);
  assert.ok(v.ok, v.errores.join(' '));
  assert.equal(frontera.origen, proyecto);
  assert.ok(frontera.salida.Q >= 0);
  // Una frontera de otra serie o sin caudal no se acepta
  assert.equal(validarFrontera({ ...frontera, serie: 'otra' }).ok, false);
  assert.equal(validarFrontera({ ...frontera, salida: { sedimento: 10 } }).ok, false);
  // La red: lo que un proyecto entrega lo recibe el otro
  for (const [a, x] of Object.entries(RED)) for (const b of x.entrega) assert.ok(RED[b].recibe.includes(a), `${a} → ${b}`);
  // (el sistema conectado recibe de todos sin que ellos lo nombren: es el que los reúne)
  for (const [b, x] of Object.entries(RED)) if (b !== 'sistema') for (const a of x.recibe) assert.ok(RED[a].entrega.includes(b), `${b} recibe de ${a}, pero ${a} no le entrega`);
  assert.ok(PROYECTOS.some((x) => x.id === proyecto));
});

test('Conexión: el nodo aplica lo que recibe de sus vecinos', () => {
  for (const e of N.entradas ?? []) {
    assert.ok(RED[proyecto].recibe.includes(e.origen), `${proyecto} no recibe de ${e.origen}`);
    const ejemplo = crearFrontera(e.origen, e.ejemplo ?? { salida: { Q: 10, sedimento: 100, salinidad: 0.2, temperatura: 26 }, mar: { nivelMedio: 0.1, marea: 0.3, Hs: 1.2, Tp: 7, salinidad: 36, temperatura: 28 } });
    const res = e.aplicar(structuredClone(S.PARAMETROS), ejemplo);
    assert.ok(res && typeof res.cambios === 'object', `aplicar ${e.origen}`);
    for (const k of Object.keys(res.cambios)) assert.ok(k in S.PARAMETROS, `clave desconocida ${k}`);
    const q = { ...structuredClone(S.PARAMETROS), ...res.cambios };
    const rr = S.calcular(q, { ...S.estadoInicial(q), t: 6 * 3600 });
    assert.ok(Object.values(rr.revision).flat().length > 0);
  }
});
