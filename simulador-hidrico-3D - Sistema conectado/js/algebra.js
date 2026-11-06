/**
 * algebra.js — Álgebra lineal del sistema conectado (funciones puras, sin DOM).
 * -----------------------------------------------------------------------
 *  1. Matriz de adyacencia de la red: a_ij = 1 si el proyecto i entrega al proyecto j.
 *     Sus potencias cuentan caminos: (A^k)_ij = número de caminos de k pasos de i a j.
 *  2. Producto de matrices y alcanzabilidad R = A + A² + … + A^(n−1).
 *  3. Eliminación de Gauss-Jordan con pivoteo parcial para A·X = B (varios lados derechos).
 *  4. Iteración de punto fijo: error relativo entre dos iteraciones.
 */

/** Matriz n×n llena de un valor. */
export const matriz = (n, m = n, v = 0) => Array.from({ length: n }, () => Array(m).fill(v));
export const identidad = (n) => matriz(n).map((f, i) => f.map((_, j) => (i === j ? 1 : 0)));

/** Producto C = A·B. */
export function multiplicar(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  if (A[0].length !== k) throw new Error('Dimensiones incompatibles');
  const C = matriz(n, m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
    C[i][j] = s;
  }
  return C;
}

/** Potencia entera A^k (k ≥ 1). */
export function potencia(A, k) {
  let P = A;
  for (let i = 1; i < k; i++) P = multiplicar(P, A);
  return P;
}

export const sumar = (A, B) => A.map((f, i) => f.map((x, j) => x + B[i][j]));

/**
 * Matriz de adyacencia de una red { id: { entrega: [...] } } con los nodos en el orden dado.
 * a_ij = 1 si i entrega a j.
 */
export function adyacencia(nodos, red) {
  return nodos.map((a) => nodos.map((b) => ((red[a]?.entrega ?? []).includes(b) ? 1 : 0)));
}

/** Alcanzabilidad: r_ij = 1 si hay algún camino de i a j (de 1 a n − 1 pasos). */
export function alcanzabilidad(A) {
  const n = A.length;
  let S = matriz(n);
  let P = identidad(n);
  for (let k = 1; k < n; k++) {
    P = multiplicar(P, A);
    S = sumar(S, P);
  }
  return S.map((f) => f.map((x) => (x > 0 ? 1 : 0)));
}

/**
 * Gauss-Jordan con pivoteo parcial: resuelve A·X = B (B con una o varias columnas).
 * Devuelve { X, det, operaciones, aumentada } o lanza un error si A es singular.
 */
export function gaussJordan(A, B) {
  const n = A.length;
  const m = B[0].length;
  const M = A.map((f, i) => [...f, ...B[i]]);
  const aumentada = M.map((f) => [...f]);
  let det = 1;
  let operaciones = 0;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
    if (Math.abs(M[piv][c]) < 1e-14) throw new Error('La matriz es singular');
    if (piv !== c) { [M[piv], M[c]] = [M[c], M[piv]]; det = -det; operaciones++; }
    const d = M[c][c];
    det *= d;
    if (d !== 1) { for (let j = c; j < n + m; j++) M[c][j] /= d; operaciones++; }
    for (let i = 0; i < n; i++) {
      if (i === c || M[i][c] === 0) continue;
      const f = M[i][c];
      for (let j = c; j < n + m; j++) M[i][j] -= f * M[c][j];
      operaciones++;
    }
  }
  return { X: M.map((f) => f.slice(n)), det, operaciones, aumentada };
}

/** Error relativo máximo entre dos vectores (para la iteración de punto fijo). */
export function errorRelativo(x, y, piso = 1e-9) {
  let e = 0;
  for (let i = 0; i < x.length; i++) e = Math.max(e, Math.abs(x[i] - y[i]) / Math.max(Math.abs(x[i]), Math.abs(y[i]), piso));
  return e;
}
