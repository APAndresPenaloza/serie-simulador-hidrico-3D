/**
 * conexion.js — Contrato de conexión entre los simuladores de la serie («frontera»).
 * -----------------------------------------------------------------------
 * Cada simulador entrega a sus vecinos lo que sale de él (caudal, sedimento, salinidad,
 * temperatura, calidad del agua, nivel) y recibe lo que le llega de aguas arriba o del mar.
 * El intercambio se hace de tres formas:
 *   1. Archivo: «Exportar frontera» descarga un .json; «Importar frontera» lo lee en otro
 *      simulador (sirve aunque cada uno esté publicado en un sitio distinto).
 *   2. En vivo: con dos simuladores abiertos en el mismo navegador y servidos desde la misma
 *      carpeta (mismo origen), el que entrega publica cada cambio por un BroadcastChannel y
 *      el que recibe lo aplica al instante.
 *   3. Sistema conectado: el proyecto «Sistema conectado» importa los modelos de todos los
 *      proyectos y los encadena del páramo al océano.
 * Las funciones de validación y de armado son puras (se prueban con Node).
 */

export const SERIE = 'simulador-hidrico-3D';
export const VERSION = 1;
export const CANAL = 'simulador-hidrico-3D:frontera:v1';

/** Proyectos de la serie, en orden del páramo al océano. */
export const PROYECTOS = [
  { id: 'lagunas', nombre: 'Lagunas', carpeta: 'simulador-hidrico-3D - Lagunas', cuerpo: 'Laguna de alta montaña' },
  { id: 'lagos', nombre: 'Lagos', carpeta: 'simulador-hidrico-3D - Lagos', cuerpo: 'Lago andino' },
  { id: 'rios', nombre: 'Ríos exorreicos', carpeta: 'simulador-hidrico-3D - Rios exorreicos', cuerpo: 'Río de la Sierra Nevada' },
  { id: 'cienagas', nombre: 'Ciénagas', carpeta: 'simulador-hidrico-3D - Cienagas', cuerpo: 'Ciénaga costera' },
  { id: 'deltas', nombre: 'Deltas', carpeta: 'simulador-hidrico-3D - Deltas', cuerpo: 'Delta del río grande' },
  { id: 'costas', nombre: 'Costas', carpeta: 'simulador-hidrico-3D - Costas', cuerpo: 'Playa del Caribe' },
  { id: 'oceanos', nombre: 'Océanos', carpeta: 'simulador-hidrico-3D - Oceanos', cuerpo: 'Mar abierto' },
  { id: 'sistema', nombre: 'Sistema conectado', carpeta: 'simulador-hidrico-3D - Sistema conectado', cuerpo: 'Del páramo al océano' },
];

/**
 * Red de la serie: de quién recibe cada proyecto y a quién entrega. El agua baja de la
 * laguna al lago, al río y a la ciénaga; la ciénaga y el delta se dan agua el uno al otro (el
 * río grande entra a la ciénaga por los caños en la creciente, la ciénaga le devuelve agua por
 * los mismos caños en el estiaje y sale al mar junto a la boca del delta); el delta le da
 * sedimento a la costa y agua dulce al océano; el océano fija la marea, el oleaje, el nivel del
 * mar y la salinidad de la ciénaga, el delta y la costa.
 */
export const RED = {
  lagunas: { recibe: [], entrega: ['lagos'] },
  lagos: { recibe: ['lagunas'], entrega: ['rios'] },
  rios: { recibe: ['lagos'], entrega: ['cienagas'] },
  cienagas: { recibe: ['rios', 'deltas', 'oceanos'], entrega: ['deltas'] },
  deltas: { recibe: ['cienagas', 'oceanos'], entrega: ['cienagas', 'costas', 'oceanos'] },
  costas: { recibe: ['deltas', 'oceanos'], entrega: [] },
  oceanos: { recibe: ['deltas'], entrega: ['cienagas', 'deltas', 'costas'] },
  sistema: { recibe: ['lagunas', 'lagos', 'rios', 'cienagas', 'deltas', 'costas', 'oceanos'], entrega: [] },
};

/** Magnitudes de la salida, con su unidad y si es obligatoria. */
export const MAGNITUDES = {
  Q: { nombre: 'Caudal', unidad: 'm³/s', obligatoria: true },
  sedimento: { nombre: 'Sedimento en suspensión', unidad: 'mg/L' },
  Qs: { nombre: 'Carga de sedimento', unidad: 'kg/s' },
  salinidad: { nombre: 'Salinidad', unidad: 'PSU' },
  temperatura: { nombre: 'Temperatura del agua', unidad: '°C' },
  OD: { nombre: 'Oxígeno disuelto', unidad: 'mg/L' },
  DBO: { nombre: 'DBO', unidad: 'mg/L' },
  coliformes: { nombre: 'Coliformes fecales', unidad: 'NMP/100 mL' },
  nitrogeno: { nombre: 'Nitrógeno', unidad: 'mg/L' },
  fosforo: { nombre: 'Fósforo total', unidad: 'µg/L' },
  nivel: { nombre: 'Nivel del agua', unidad: 'm' },
  Qtoma: { nombre: 'Caudal que la ciénaga toma del río por los caños', unidad: 'm³/s' },
  Qretorno: { nombre: 'Caudal que la ciénaga devuelve al río por los caños', unidad: 'm³/s' },
};

export const MAGNITUDES_MAR = {
  nivelMedio: { nombre: 'Nivel medio del mar (sobre el de referencia)', unidad: 'm' },
  ascenso: { nombre: 'Rapidez del ascenso del mar en el año del horizonte', unidad: 'mm/año' },
  marea: { nombre: 'Amplitud de la marea', unidad: 'm' },
  Hs: { nombre: 'Altura significativa del oleaje', unidad: 'm' },
  Tp: { nombre: 'Período pico del oleaje', unidad: 's' },
  direccion: { nombre: 'Dirección del oleaje respecto a la normal de la costa', unidad: '°' },
  salinidad: { nombre: 'Salinidad del mar', unidad: 'PSU' },
  temperatura: { nombre: 'Temperatura del mar', unidad: '°C' },
};

export const nombreProyecto = (id) => PROYECTOS.find((p) => p.id === id)?.nombre ?? id;

/** Arma la frontera que entrega un proyecto. */
export function crearFrontera(origen, { nodo = '', salida = {}, mar = null, clima = null, tiempo = null, fecha = new Date() } = {}) {
  const limpio = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)));
  const f = {
    serie: SERIE,
    version: VERSION,
    origen,
    nodo: nodo || nombreProyecto(origen),
    fecha: new Date(fecha).toISOString(),
    salida: limpio(salida),
  };
  if (tiempo) f.tiempo = tiempo;
  if (clima) f.clima = clima;
  if (mar) f.mar = limpio(mar);
  return f;
}

/** Revisa que un objeto sea una frontera válida de la serie. */
export function validarFrontera(f) {
  const errores = [];
  if (!f || typeof f !== 'object') return { ok: false, errores: ['El archivo no contiene un objeto JSON.'] };
  if (f.serie !== SERIE) errores.push(`No es una frontera de la serie «${SERIE}».`);
  if (f.version !== VERSION) errores.push(`Versión ${f.version} no compatible (se esperaba ${VERSION}).`);
  if (!PROYECTOS.some((p) => p.id === f.origen)) errores.push(`Origen desconocido: «${f.origen}».`);
  const s = f.salida ?? {};
  for (const [k, m] of Object.entries(MAGNITUDES)) {
    if (m.obligatoria && !(typeof s[k] === 'number' && Number.isFinite(s[k]))) errores.push(`Falta la magnitud obligatoria «${k}» (${m.nombre}).`);
  }
  for (const [k, v] of Object.entries(s)) {
    if (!(k in MAGNITUDES)) errores.push(`Magnitud desconocida en la salida: «${k}».`);
    else if (!(typeof v === 'number' && Number.isFinite(v))) errores.push(`«${k}» no es un número.`);
    else if (v < 0 && k !== 'nivel') errores.push(`«${k}» no puede ser negativo.`);
  }
  for (const k of Object.keys(f.mar ?? {})) if (!(k in MAGNITUDES_MAR)) errores.push(`Magnitud desconocida en el mar: «${k}».`);
  return { ok: errores.length === 0, errores };
}

/** ¿Este proyecto recibe datos de ese origen? */
export const recibeDe = (proyecto, origen) => (RED[proyecto]?.recibe ?? []).includes(origen);

/** Texto JSON con sangría (para descargar). */
export const textoFrontera = (f) => JSON.stringify(f, null, 2);

/** Nombre del archivo: frontera-cienagas_2026-11-05_14-35.json */
export function nombreFrontera(origen, fecha = new Date()) {
  const d2 = (n) => String(n).padStart(2, '0');
  return `frontera-${origen}_${fecha.getFullYear()}-${d2(fecha.getMonth() + 1)}-${d2(fecha.getDate())}_${d2(fecha.getHours())}-${d2(fecha.getMinutes())}.json`;
}

/** Lee un archivo .json elegido por la persona y lo valida. */
export function leerArchivo(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      try {
        const f = JSON.parse(String(lector.result));
        const v = validarFrontera(f);
        if (!v.ok) rechazar(new Error(v.errores.join(' ')));
        else resolver(f);
      } catch {
        rechazar(new Error('El archivo no es un JSON válido.'));
      }
    };
    lector.readAsText(archivo);
  });
}

/**
 * Enlace en vivo entre pestañas del navegador (mismo origen). Cada simulador publica su
 * frontera y escucha las de los demás; también responde «¿quién está?» para saber qué
 * proyectos están abiertos.
 */
export class EnlaceVivo {
  constructor(proyecto, { alRecibir = () => {}, alCambiarVecinos = () => {} } = {}) {
    this.proyecto = proyecto;
    this.alRecibir = alRecibir;
    this.alCambiarVecinos = alCambiarVecinos;
    this.vecinos = new Map();          // origen → { fecha, frontera }
    this.ultima = null;
    this.canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL) : null;
    if (!this.canal) return;
    this.canal.onmessage = (e) => this.mensaje(e.data);
    this.canal.postMessage({ tipo: 'hola', origen: proyecto });
  }

  get disponible() { return Boolean(this.canal); }

  mensaje(m) {
    if (!m || m.origen === this.proyecto) return;
    if (m.tipo === 'hola') {
      if (this.ultima) this.canal.postMessage({ tipo: 'frontera', origen: this.proyecto, frontera: this.ultima });
      else this.canal.postMessage({ tipo: 'presente', origen: this.proyecto });
    }
    if (m.tipo === 'presente' && !this.vecinos.has(m.origen)) {
      this.vecinos.set(m.origen, { fecha: Date.now(), frontera: null });
      this.alCambiarVecinos(this.vecinos);
    }
    if (m.tipo === 'frontera' && validarFrontera(m.frontera).ok) {
      this.vecinos.set(m.origen, { fecha: Date.now(), frontera: m.frontera });
      this.alCambiarVecinos(this.vecinos);
      this.alRecibir(m.frontera);
    }
    if (m.tipo === 'adios' && this.vecinos.delete(m.origen)) this.alCambiarVecinos(this.vecinos);
  }

  publicar(frontera) {
    this.ultima = frontera;
    this.canal?.postMessage({ tipo: 'frontera', origen: this.proyecto, frontera });
  }

  cerrar() {
    this.canal?.postMessage({ tipo: 'adios', origen: this.proyecto });
    this.canal?.close();
  }
}
