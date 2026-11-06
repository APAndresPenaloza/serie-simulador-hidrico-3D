/**
 * datos.js — Registro de la simulación y libro de Excel (común a la serie).
 * -----------------------------------------------------------------------
 * Mientras corre el reloj se guarda una fila de la serie de tiempo cada cierto tiempo
 * simulado. Se pueden guardar escenarios (todos los parámetros y resultados de un momento)
 * para compararlos lado a lado. Todo se descarga en un libro de Excel armado con excel.js,
 * sin librerías ni conexión a internet. Este módulo no toca el DOM salvo descargarArchivo().
 */
import { crearXlsx, rangoTabla } from '../excel.js';
import { textoPlano } from './formato.js';

export const MAX_FILAS = 20000;

const num = (v, dec = 2) => (typeof v === 'number' ? { v, dec } : v);
const sec = (v) => ({ v, estilo: 'seccion' });
const nota = (v) => ({ v, estilo: 'nota' });
const enc = (v) => ({ v, estilo: 'encabezado' });

// ── Escenarios guardados en el navegador (si lo permite) ─────────────────────
function leerEscenarios(clave) {
  try {
    const lista = JSON.parse(globalThis.localStorage?.getItem(clave) ?? '[]');
    return Array.isArray(lista) ? lista.filter((e) => e && Array.isArray(e.filas)) : [];
  } catch {
    return [];
  }
}

function escribirEscenarios(clave, lista) {
  try {
    globalThis.localStorage?.setItem(clave, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento (modo privado, archivo local): los escenarios duran lo que dure la página
  }
}

/**
 * Registro de la simulación. columnas: [{ clave, nombre, unidad, dec }]; cada fila guarda
 * el instante t (s) y los valores de esas claves.
 */
export class Registro {
  constructor(proyecto, columnas, intervalo = 3600) {
    this.clave = `simulador-hidrico-3d:${proyecto}:escenarios:v1`;
    this.columnas = columnas;
    this.intervalo = intervalo;
    this.escenarios = leerEscenarios(this.clave);
    this.reiniciar(0);
  }

  reiniciar(t) {
    this.inicio = t;
    this.proxima = t;
    this.filas = [];
    this.recortado = false;
  }

  /** Llama a tomar(t) cada vez que el reloj pasa por un múltiplo del intervalo. */
  avanzar(tAntes, tDespues, tomar) {
    let n = 0;
    while (this.proxima <= tDespues + 1e-6 && n < 500) {
      if (this.proxima >= tAntes - 1e-6) this.agregarFila({ t: this.proxima, ...tomar(this.proxima) });
      this.proxima += this.intervalo;
      n++;
    }
    if (this.proxima <= tDespues) this.proxima = Math.ceil(tDespues / this.intervalo) * this.intervalo;
  }

  agregarFila(fila) {
    this.filas.push(fila);
    if (this.filas.length > MAX_FILAS) {
      this.filas.splice(0, this.filas.length - MAX_FILAS);
      this.recortado = true;
    }
  }

  cambiarIntervalo(seg, t) {
    this.intervalo = seg;
    this.proxima = Math.ceil(t / seg) * seg;
  }

  guardarEscenario(nombre, filas, reloj) {
    const e = { nombre: String(nombre || `Escenario ${this.escenarios.length + 1}`).slice(0, 60), reloj, fecha: new Date().toISOString(), filas };
    this.escenarios.push(e);
    escribirEscenarios(this.clave, this.escenarios);
    return e;
  }

  quitarEscenario(i) {
    this.escenarios.splice(i, 1);
    escribirEscenarios(this.clave, this.escenarios);
  }
}

/** Une las filas de varias columnas (escenarios) conservando el orden de aparición. */
export function unirEsquemas(listas) {
  const orden = [];
  const vistos = new Set();
  for (const filas of listas) {
    let pos = 0;
    for (const f of filas) {
      const i = orden.findIndex((o) => o.clave === f.clave);
      if (i >= 0) { pos = i + 1; continue; }
      if (!vistos.has(f.clave)) {
        orden.splice(pos, 0, { clave: f.clave, bloque: f.bloque, grupo: f.grupo, etiqueta: f.etiqueta, unidad: f.unidad });
        vistos.add(f.clave);
        pos += 1;
      }
    }
  }
  return orden;
}

function hojaResumen({ meta, estados, contenido, registro, conteo }) {
  const filas = [
    [{ v: meta.titulo, estilo: 'titulo' }],
    [nota(meta.subtitulo)],
    [],
    [sec('Datos de la exportación'), sec(''), sec('')],
    ['Fecha y hora de la exportación', meta.fecha],
    ['Tiempo simulado al exportar', meta.reloj],
    ['Filas de la serie de tiempo', registro.filas.length],
    ['Escenarios guardados', registro.escenarios.length],
    ['Criterios de diseño', `${conteo.ok} cumplen, ${conteo.aviso} con advertencia, ${conteo.alerta} no cumplen`],
    [],
    [sec('Estado al exportar'), sec(''), sec('')],
    ...estados.map((e) => [e.nombre, textoPlano(e.texto), e.nivel === 'ok' ? 'normal' : (e.nivel === 'alerta' ? 'falla' : 'advertencia')]),
    [],
    [sec('Contenido del libro'), sec(''), sec('')],
  ];
  const altos = {};
  const combinar = [];
  for (const [nombre, texto] of contenido) {
    const i = filas.length;
    filas.push([{ v: nombre, estilo: 'seccionArriba' }, { v: texto, estilo: 'parrafo' }]);
    combinar.push(`B${i + 1}:C${i + 1}`);
    altos[i] = 15 * Math.max(1, Math.ceil(String(texto).length / 50));
  }
  filas.push(
    [],
    [nota('Los valores se guardan con todos sus decimales: el formato de la celda solo cambia cómo se ven.')],
    [nota('El separador decimal (punto o coma) depende de la configuración regional de Excel.')],
  );
  if (registro.recortado) filas.push([nota(`La serie de tiempo guarda las últimas ${MAX_FILAS} filas.`)]);
  return { nombre: 'Resumen', columnas: [46, 34, 14], filas, altos, combinar };
}

function hojaParametrosResultados(actual, escenarios) {
  const columnas = [...escenarios, actual];
  const esquema = unirEsquemas(columnas.map((c) => c.filas));
  const indices = columnas.map((c) => new Map(c.filas.map((f) => [f.clave, f])));
  const filas = [[enc('Pestaña'), enc('Magnitud'), enc('Unidad'), ...columnas.map((c) => enc(c.nombre))]];
  let bloque = null;
  for (const e of esquema) {
    if (e.bloque !== bloque) {
      bloque = e.bloque;
      filas.push([sec(bloque), sec(''), sec(''), ...columnas.map(() => sec(''))]);
    }
    filas.push([
      { v: e.grupo ? `${bloque} · ${e.grupo}` : bloque, estilo: 'etiqueta' },
      e.etiqueta,
      e.unidad,
      ...indices.map((m) => {
        const f = m.get(e.clave);
        if (!f) return '';
        return typeof f.valor === 'number' ? num(f.valor, f.dec ?? 2) : f.valor;
      }),
    ]);
  }
  return { nombre: 'Parámetros y resultados', columnas: [26, 46, 14, ...columnas.map(() => 18)], congelar: { filas: 1, columnas: 3 }, filas, horizontal: true };
}

function hojaSerie(registro, relojTexto) {
  const cols = registro.columnas;
  const filas = [[enc('Tiempo simulado'), ...cols.map((c) => enc(c.unidad ? `${c.nombre} (${c.unidad})` : c.nombre))]];
  for (const f of registro.filas) {
    filas.push([relojTexto(f.t), ...cols.map((c) => (typeof f[c.clave] === 'number' ? num(f[c.clave], c.dec ?? 2) : (f[c.clave] ?? '')))]);
  }
  if (registro.filas.length === 0) filas.push([nota('Deja correr el reloj para registrar la serie de tiempo.')]);
  return { nombre: 'Serie de tiempo', columnas: [20, ...cols.map(() => 16)], congelar: { filas: 1, columnas: 1 }, filtro: registro.filas.length ? rangoTabla(0, cols.length + 1, registro.filas.length) : undefined, filas, horizontal: true };
}

function hojaRevision(revision) {
  const estado = { ok: 'Cumple', aviso: 'Advertencia', alerta: 'No cumple' };
  const filas = [[enc('Pestaña'), enc('Criterio'), enc('Resultado'), enc('Estado'), enc('Si no cumple')]];
  for (const c of revision) {
    filas.push([c.pestana, { v: textoPlano(c.texto), estilo: 'ajuste' }, textoPlano(c.detalle), estado[c.nivel] ?? c.nivel, { v: textoPlano(c.corregir || ''), estilo: 'ajuste' }]);
  }
  return { nombre: 'Revisión del diseño', columnas: [16, 54, 26, 14, 48], congelar: { filas: 1 }, filtro: rangoTabla(0, 5, revision.length), filas, horizontal: true };
}

function hojaTabla({ nombre, titulo, nota: n, encabezados, filas: datos, columnas }) {
  const filas = [];
  if (titulo) filas.push([{ v: titulo, estilo: 'titulo' }]);
  if (n) filas.push([nota(n)]);
  if (titulo || n) filas.push([]);
  const fe = filas.length;
  filas.push(encabezados.map(enc));
  for (const f of datos) filas.push(f);
  return { nombre, columnas: columnas ?? encabezados.map(() => 16), congelar: { filas: fe + 1 }, filas, horizontal: encabezados.length > 6 };
}

/** Hoja con la frontera de conexión (lo que el proyecto recibe y entrega a sus vecinos). */
function hojaFrontera(frontera) {
  const filas = [[enc('Bloque'), enc('Magnitud'), enc('Valor')]];
  const recorrer = (obj, bloque) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) recorrer(v, bloque ? `${bloque}.${k}` : k);
      else filas.push([bloque || '—', k, typeof v === 'number' ? num(v, 4) : String(v)]);
    }
  };
  recorrer(frontera, '');
  return { nombre: 'Conexión', columnas: [18, 26, 30], congelar: { filas: 1 }, filas };
}

/**
 * Arma todas las hojas del libro.
 * meta: { titulo, subtitulo, fecha, reloj }; estados: barra superior; actual: { nombre, filas };
 * revision: [{ pestana, texto, detalle, nivel, corregir }]; tablas: hojas extra del proyecto
 * ({ nombre, titulo, nota, encabezados, filas }) o hojas ya armadas ({ nombre, filas, columnas });
 * frontera: objeto de conexión.
 */
export function construirHojas({ meta, estados, actual, registro, revision, tablas = [], frontera = null, relojTexto }) {
  const conteo = { ok: 0, aviso: 0, alerta: 0 };
  for (const c of revision) conteo[c.nivel] = (conteo[c.nivel] ?? 0) + 1;
  const extra = tablas.map((t) => (t.encabezados ? hojaTabla(t) : t));
  const contenido = [
    ['Parámetros y resultados', 'Todos los parámetros y resultados de cada pestaña: una columna por escenario guardado y la última con el estado al exportar.'],
    ['Serie de tiempo', 'Una fila por intervalo de tiempo simulado mientras corre el reloj.'],
    ['Revisión del diseño', 'Los criterios de todas las pestañas con su resultado: cumple, advertencia o no cumple, y qué hacer si no cumple.'],
    ...extra.map((h) => [h.nombre, h.descripcion ?? (h.filas?.[0]?.[0]?.v ? String(h.filas[0][0].v) : 'Tabla del simulador.')]),
    ...(frontera ? [['Conexión', 'Lo que este simulador entrega a sus vecinos de la serie (la frontera de conexión).']] : []),
  ];
  return [
    hojaResumen({ meta, estados, contenido, registro, conteo }),
    hojaParametrosResultados(actual, registro.escenarios),
    hojaSerie(registro, relojTexto),
    hojaRevision(revision),
    ...extra,
    ...(frontera ? [hojaFrontera(frontera)] : []),
  ];
}

export function crearLibro(datos) {
  return crearXlsx(construirHojas(datos), {
    titulo: datos.meta.titulo,
    autor: 'Simulador hídrico 3D',
    aplicacion: 'Simulador hídrico 3D',
    fecha: datos.meta.fechaObjeto ?? new Date(),
  });
}

/** simulacion-lagunas_2026-11-05_14-35.xlsx */
export function nombreArchivo(proyecto, fecha = new Date(), extension = 'xlsx') {
  const d2 = (n) => String(n).padStart(2, '0');
  return `simulacion-${proyecto}_${fecha.getFullYear()}-${d2(fecha.getMonth() + 1)}-${d2(fecha.getDate())}_${d2(fecha.getHours())}-${d2(fecha.getMinutes())}.${extension}`;
}

/** Descarga los bytes (o un texto) como archivo en el navegador. */
export function descargarArchivo(bytes, nombre, tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const blob = new Blob([bytes], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
