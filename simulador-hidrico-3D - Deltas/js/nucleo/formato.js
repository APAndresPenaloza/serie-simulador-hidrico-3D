/**
 * formato.js — Formatos numéricos y utilidades comunes de la serie de simuladores hídricos 3D.
 * -----------------------------------------------------------------------
 * Punto decimal, espacio fino para los miles y el signo menos tipográfico, igual que el
 * simulador de ríos. Solo funciones puras: también se usan en las pruebas con Node.
 */

/** Redondea a n decimales evitando errores de coma flotante (p. ej. 1.005 → 1.01). */
export function redondear(valor, decimales = 2) {
  const factor = 10 ** decimales;
  const signo = valor < 0 ? -1 : 1;
  return (signo * Math.round(Math.abs(valor) * factor + Number.EPSILON * factor)) / factor;
}

/** «1 234.56»: punto decimal, espacio fino para los miles y «−» para los negativos. */
export function fmt(x, d = 2) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const s = Math.abs(redondear(x, d)).toFixed(d);
  const [ent, dec] = s.split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const signo = x < 0 && redondear(x, d) !== 0 ? '−' : '';
  return signo + miles + (dec ? '.' + dec : '');
}

/** Entero con espacio fino para los miles. */
export const miles = (x) => fmt(x, 0);

/** «+1.20» o «−0.35»: con signo explícito. */
export const conSigno = (x, d = 2) => (x > 0 && redondear(x, d) !== 0 ? '+' : '') + fmt(x, d);

/** Porcentaje con d decimales a partir de una fracción. */
export const pct = (fraccion, d = 0) => `${fmt(100 * fraccion, d)} %`;

export const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/** Tiempo legible: minutos, horas, días o años. */
export function fmtTiempo(seg) {
  if (!Number.isFinite(seg)) return 'no ocurre con el balance actual';
  const s = Math.abs(seg);
  if (s < 3600) return `${fmt(seg / 60, 0)} min`;
  if (s < 48 * 3600) return `${fmt(seg / 3600, 1)} h`;
  if (s < 730 * 86400) return `${fmt(seg / 86400, 1)} días`;
  return `${fmt(seg / (365 * 86400), 1)} años`;
}

/** Redondea hacia arriba a un valor «redondo» (1, 2 o 5 × 10ⁿ) para los ejes. */
export function techoRedondo(v) {
  if (!(v > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * e >= v - 1e-12) return m * e;
  return 10 * e;
}

export const horaTexto = (h) => {
  const m = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const escaparHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Texto sin etiquetas HTML (para el Excel y las pruebas). */
export const textoPlano = (s) => String(s)
  .replace(/<sub>(.*?)<\/sub>/g, '_$1')
  .replace(/<sup>(.*?)<\/sup>/g, '^$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Día del año (1–365) en que empieza cada mes. */
export const INICIO_MES = DIAS_MES.reduce((a, d, k) => (a.push(k === 0 ? 1 : a[k - 1] + DIAS_MES[k - 1]), a), []);

/** Mes (0–11) y día del mes de un día del año (1–365; se repite cada año). */
export function fechaDeDia(diaAno) {
  let d = ((Math.floor(diaAno) - 1) % 365 + 365) % 365;
  for (let k = 0; k < 12; k++) {
    if (d < DIAS_MES[k]) return { mes: k, dia: d + 1 };
    d -= DIAS_MES[k];
  }
  return { mes: 11, dia: 31 };
}

/** «3 días», «1 día». */
export const textoDias = (n) => `${fmt(n, 0)} ${Math.abs(n - 1) < 1e-9 ? 'día' : 'días'}`;

/** Lista legible: «a, b y c». */
export const listaY = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : (xs[0] ?? ''));

/** Revisión de un criterio de diseño: ✓ (ok), ! (aviso) o ✗ (alerta). */
export function revisar(lista, texto, cumple, detalle, { nivelFalla = 'alerta', corregir = '', grupo = '' } = {}) {
  lista.push({ texto, nivel: cumple ? 'ok' : nivelFalla, detalle, corregir, grupo });
  return lista;
}

/** Interpolación lineal en una tabla [[x, y], ...] ordenada por x. */
export function interpolar(tabla, x) {
  if (x <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) {
    const [x1, y1] = tabla[i];
    if (x <= x1) {
      const [x0, y0] = tabla[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return tabla[tabla.length - 1][1];
}

/** Bisección: raíz de f en [a, b] (f(a) y f(b) con signos distintos). */
export function biseccion(f, a, b, tol = 1e-10, max = 200) {
  let fa = f(a);
  if (fa === 0) return a;
  for (let i = 0; i < max; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < tol) return m;
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return 0.5 * (a + b);
}

/** Puntos [x, f(x)] equiespaciados para dibujar una función. */
export function muestrear(f, a, b, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    if (Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}
