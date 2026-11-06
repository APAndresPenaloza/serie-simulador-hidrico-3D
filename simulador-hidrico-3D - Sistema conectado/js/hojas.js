/**
 * hojas.js — Hojas propias del libro de Excel del sistema conectado (con fórmulas).
 * Sin DOM: se prueban con Node en tests/datos.test.js.
 */
import * as C from './cadena.js';

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const col = (k) => COLS[k];

export function hojasExcel(p, r) {
  const cad = r.cad;
  const e = (v, dec = 0) => ({ v, dec, entrada: true });

  // ── 1. Red: matriz de adyacencia y su cuadrado con fórmulas ─────────────
  const { A } = C.matricesRed();
  const n = C.ORDEN.length;
  const filaA = 5;                       // fila de Excel donde empieza A (B5…H11)
  const red = {
    nombre: 'Red y matrices',
    descripcion: 'Matriz de adyacencia de la red (a_ij = 1 si i entrega a j) y su cuadrado A² = A·A, que cuenta los caminos de dos pasos, con fórmulas de Excel.',
    columnas: [16, 10, 10, 10, 10, 10, 10, 10, 30],
    filas: [
      [{ v: 'Matriz de adyacencia A de la red de la serie', estilo: 'titulo' }],
      [{ v: 'Fila: el proyecto que entrega; columna: el que recibe. Datos de entrada en azul.', estilo: 'nota' }],
      [],
      ['A', ...C.ORDEN.map((id) => C.NOMBRES[id])],
      ...C.ORDEN.map((id, i) => [C.NOMBRES[id], ...A[i].map((x) => e(x)), { f: `SUM(B${filaA + i}:${col(n)}${filaA + i})`, v: A[i].reduce((a, b) => a + b, 0), dec: 0 }]),
      ['Recibe de', ...C.ORDEN.map((_, j) => ({ f: `SUM(${col(j + 1)}${filaA}:${col(j + 1)}${filaA + n - 1})`, v: A.reduce((a, f) => a + f[j], 0), dec: 0 }))],
      [],
      ['A² = A·A', ...C.ORDEN.map((id) => C.NOMBRES[id])],
      ...C.ORDEN.map((id, i) => [C.NOMBRES[id], ...C.ORDEN.map((_, j) => {
        const f = C.ORDEN.map((__, k) => `${col(k + 1)}${filaA + i}*${col(j + 1)}${filaA + k}`).join('+');
        let v = 0;
        for (let k = 0; k < n; k++) v += A[i][k] * A[k][j];
        return { f, v, dec: 0 };
      })]),
      [],
      [{ v: `La última columna de A cuenta a cuántos proyectos entrega cada uno; la fila «Recibe de», de cuántos recibe. En A², la casilla (i, j) dice por cuántos caminos de dos pasos llega el agua (o la información) de i a j.`, estilo: 'nota' }],
    ],
  };
  red.filas[3].push('Entrega a');          // encabezado de la columna de sumas

  // ── 2. Trazadores: (I − M)·F = B y la comprobación de que cada fila suma 1 ──
  const T = cad.trazador;
  const nombresT = ['Laguna', 'Lago', 'Río', 'Ciénaga', 'Delta (río grande)', 'Mar frente a las bocas'];
  const fila0 = 5;
  const traz = {
    nombre: 'Trazadores',
    descripcion: 'Sistema lineal de los trazadores (I − M)·F = B resuelto con Gauss-Jordan: fracción del agua de cada cuerpo que viene de cada fuente.',
    columnas: [24, 14, 14, 14, 14, 16, 12],
    filas: [
      [{ v: 'De dónde viene el agua de cada cuerpo (fracciones)', estilo: 'titulo' }],
      [{ v: 'F: solución del sistema; la columna Suma (con fórmula) debe dar 1 en cada fila.', estilo: 'nota' }],
      [],
      ['Cuerpo', ...C.FUENTES.map((f) => f.nombre), 'Suma'],
      ...T.F.map((fila, i) => [nombresT[i], ...fila.map((x) => ({ v: x, dec: 6 })), { f: `SUM(B${fila0 + i}:E${fila0 + i})`, v: fila.reduce((a, b) => a + b, 0), dec: 6 }]),
      [],
      ['Salinidad del mar abierto', e(r.ind.oceano.Smar, 2), 'PSU'],
      ['Salinidad frente a las bocas = F(mar)·S_mar', { f: `D${fila0 + 5}*B${fila0 + 7}`, v: T.F[5][2] * r.ind.oceano.Smar, dec: 2 }, 'PSU'],
      ['Salinidad de la ciénaga sin evaporación = F(mar)·S_mar', { f: `D${fila0 + 3}*B${fila0 + 7}`, v: T.F[3][2] * r.ind.oceano.Smar, dec: 2 }, 'PSU'],
      ['Determinante de (I − M)', { v: T.det, dec: 6 }, ''],
    ],
  };

  // ── 3. Año conectado: caudal de cada mes con el promedio del año (fórmula) ──
  const ids = ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas'];
  const ano = {
    nombre: 'Año conectado',
    descripcion: 'Caudal medio de cada mes en la salida de cada eslabón y promedio del año pesado por los días del mes (con fórmulas de Excel).',
    columnas: [12, 10, 16, 16, 16, 18, 20],
    filas: [
      [{ v: 'Caudal de salida de cada eslabón, mes a mes [m³/s]', estilo: 'titulo' }],
      [{ v: 'Laguna: rebose; lago: desagüe; río: desembocadura; ciénaga: Boca de la Barra; delta: Bocas de Ceniza.', estilo: 'nota' }],
      [],
      ['Mes', 'Días', ...ids.map((id) => C.NOMBRES[id])],
      ...C.MESES.map((m, k) => [m, e(C.DIAS[k]), ...ids.map((id) => ({ v: cad.nodos[id].m[k].Q, dec: id === 'lagunas' ? 4 : (id === 'deltas' ? 0 : 2) }))]),
      ['Año', { f: 'SUM(B5:B16)', v: 365, dec: 0 }, ...ids.map((id, j) => ({ f: `SUMPRODUCT(${col(j + 2)}5:${col(j + 2)}16,$B$5:$B$16)/$B$17`, v: C.promedioAno(cad.nodos[id].m, 'Q'), dec: id === 'lagunas' ? 4 : (id === 'deltas' ? 0 : 2) }))],
    ],
  };

  // ── 4. Edad del agua: suma de los tiempos de residencia ─────────────────
  const ed = r.edad;
  const edad = {
    nombre: 'Edad del agua',
    descripcion: 'Tiempo que el agua de la laguna tarda en llegar al mar: suma de los tiempos de residencia de cada cuerpo (con fórmulas).',
    columnas: [30, 16, 16, 12],
    filas: [
      [{ v: 'Edad del agua al llegar al mar', estilo: 'titulo' }],
      [{ v: 'Tiempo de residencia τ = V/Q de la laguna, el lago y la ciénaga; tiempo de viaje L/u del río.', estilo: 'nota' }],
      [],
      ['Tramo', 'Tiempo (días)', 'Acumulado (días)', ''],
      ...ed.tramos.map((t, i) => [t.nombre, { v: Number.isFinite(t.dias) ? t.dias : 0, dec: 2, entrada: true }, { f: i === 0 ? 'B5' : `C${4 + i}+B${5 + i}`, v: t.acumulado, dec: 2 }]),
      ['Total en años', { f: `C${4 + ed.tramos.length}/365`, v: ed.total / 365, dec: 2 }, 'años'],
    ],
  };
  return [red, traz, ano, edad];
}
