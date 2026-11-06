/**
 * app.js — Simulador de ciénagas costeras: pestañas, controles, resultados, ecuaciones con
 * valores sustituidos y gráficas. El controlador común está en nucleo/app-base.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';
import * as N from './nodo.js';
import { Escena } from './escena3d.js';
import { hojasExcel } from './hojas.js';
import { iniciarSimulador, ecu, i, sub, tablaHTML } from './nucleo/app-base.js';
import { fmt, miles, MESES, muestrear, techoRedondo, conSigno, horaTexto } from './nucleo/formato.js';
import { serieLinea, seriePuntos, serieGuia } from './nucleo/graficas.js';

const opciones = (obj) => Object.entries(obj).map(([valor, o]) => ({ valor, nombre: o.nombre }));
const MARCAS_MES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fmtMes = (v) => MESES[Math.round(v) - 1] ?? '';
const NIVEL_SAL = (S) => (S <= 40 ? 'ok' : (S <= 50 ? 'aviso' : 'alerta'));

const TABS = [
  { id: 'rios', nombre: 'Ríos y caños', graficas: 2, tablas: true, intro: 'La ciénaga recibe agua dulce de dos lados. Por el oriente bajan los ríos de la Sierra Nevada (Fundación, Aracataca, Sevilla y otros), con el régimen del Caribe: poca agua de diciembre a abril y mucha en octubre y noviembre. Por el occidente entra el agua del río Magdalena por caños que lo conectan con la ciénaga; el caudal depende del desnivel entre el río y la ciénaga, que sube con la creciente del Magdalena (la principal en noviembre y otra menor en mayo y junio). Si los caños se sedimentan o se cierran con diques, la ciénaga pierde esa agua dulce.' },
  { id: 'cienaga', nombre: 'Ciénaga', graficas: 2, tablas: true, intro: 'La ciénaga es una laguna muy somera, de metro y medio de profundidad, con cerca de 500 km² de espejo: cuando sube el nivel, el agua se extiende sobre los bordes de manglar y el área crece en línea recta con la profundidad. Su nivel queda muy cerca del nivel del mar, porque la boca deja salir lo que sobra. En el agua viven pueblos de palafitos (casas sobre pilotes), cuyos pisos deben quedar por encima de las crecientes.' },
  { id: 'mar', nombre: 'Mar y boca', graficas: 2, intro: 'La ciénaga se comunica con el mar Caribe por la Boca de la Barra y por las alcantarillas que pasan bajo la carretera de la barra de arena. La marea del Caribe es pequeña (unas decenas de centímetros) y mixta, principalmente diurna: la suma de cuatro ondas de períodos distintos. Cuando el mar está más alto que la ciénaga entra agua salada; cuando está más bajo, sale agua de la ciénaga. La boca se puede sedimentar y el mar puede subir.' },
  { id: 'salinidad', nombre: 'Salinidad', graficas: 2, tablas: true, intro: 'La sal solo entra con el agua de mar, pero la evaporación se lleva el agua y deja la sal. Si llega poca agua dulce en la temporada seca, la ciénaga se vuelve más salada que el mar (hipersalina). Como una caja bien mezclada, su salinidad se acerca a un equilibrio que depende del agua de mar que entra, del agua dulce y de la evaporación; esa función racional tiene una asíntota donde la evaporación iguala lo que entra.' },
  { id: 'manglar', nombre: 'Manglar y pesca', graficas: 2, tablas: true, intro: 'El manglar rodea la ciénaga y sostiene su pesca. Cada especie de mangle aguanta una salinidad distinta en el suelo: el mangle rojo es el más sensible y el negro el más resistente. Cuando la carretera de la barra y los diques del Magdalena cortaron el agua dulce y el intercambio con el mar, la sal del suelo subió y murió una gran parte del manglar; la apertura de los caños desde los años noventa buscó revertirlo.' },
  { id: 'calidad', nombre: 'Calidad', graficas: 2, intro: 'El Magdalena y los ríos traen fósforo de las ciudades y de la agricultura de sus cuencas. En una ciénaga cálida y somera, ese fósforo alimenta muchas algas: de día producen oxígeno y de noche lo consumen, y en la madrugada el oxígeno puede caer tanto que los peces mueren. El agua salada guarda un poco menos de oxígeno que la dulce.' },
  { id: 'sedimentos', nombre: 'Sedimentos', graficas: 2, tablas: true, intro: 'Los caños traen el sedimento del Magdalena y los ríos el de la Sierra. En la ciénaga el agua se frena y los granos se depositan: el fondo sube unos milímetros cada año y los caños se sedimentan si no se mantienen. La ley de Stokes dice qué granos alcanzan a caer.' },
];

const CONTROLES = [
  { tab: 'rios', grupo: 'Escenario' },
  { tab: 'rios', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio: El Niño, La Niña, la ciénaga de los años noventa, la crisis del manglar, la restauración, la boca sedimentada, la eutrofización o el ascenso del mar.' },
  { tab: 'rios', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS),
    extra: (v) => { const c = S.CLIMAS[v]; return `Ríos × ${fmt(c.fRios, 1)}, Magdalena ${conSigno(c.dH, 1)} m, lluvia × ${fmt(c.fLluvia, 1)}, evaporación × ${fmt(c.fEvap, 2)}.`; },
    doc: 'Cambia el caudal de los ríos de la Sierra, el nivel del Magdalena, la lluvia y la evaporación.' },
  { tab: 'rios', grupo: 'Ríos de la Sierra Nevada' },
  { tab: 'rios', id: 'Qrios', clave: 'Qrios', etiqueta: 'Caudal medio de los ríos (en conjunto)', unidad: 'm³/s', min: 0, max: 150, paso: 0.5, dec: 1, doc: 'Se reparte en el año con el régimen del simulador de ríos.' },
  { tab: 'rios', grupo: 'Río Magdalena y caños' },
  { tab: 'rios', id: 'Hrio', clave: 'Hrio', etiqueta: 'Nivel medio del Magdalena frente a los caños', unidad: 'm.s.n.m.', min: -0.5, max: 3, paso: 0.01, dec: 2, doc: 'H̄ de la serie de Fourier.' },
  { tab: 'rios', id: 'A1', clave: 'A1', etiqueta: 'Creciente principal (amplitud anual)', unidad: 'm', min: 0, max: 2, paso: 0.01, dec: 2, doc: 'A₁: primer armónico, con el máximo a mediados de noviembre.' },
  { tab: 'rios', id: 'A2', clave: 'A2', etiqueta: 'Creciente de mitad de año (amplitud semestral)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2, doc: 'A₂: segundo armónico, con máximos en mayo–junio y noviembre.' },
  { tab: 'rios', id: 'nCanos', clave: 'nCanos', etiqueta: 'Número de caños', unidad: '', min: 0, max: 6, paso: 1, dec: 0, doc: 'Caños que comunican el Magdalena con la ciénaga.' },
  { tab: 'rios', id: 'estadoCanos', clave: 'estadoCanos', etiqueta: 'Estado de los caños', tipo: 'opciones', opciones: opciones(S.ESTADOS_CANO), doc: 'Fija la sección de cada caño.' },
  { tab: 'rios', id: 'Ccano', clave: 'Ccano', etiqueta: 'Coeficiente de descarga del caño', unidad: '', min: 0.05, max: 0.8, paso: 0.01, dec: 2, doc: 'Resume la fricción de un caño largo y sinuoso.' },

  { tab: 'cienaga', grupo: 'Forma de la ciénaga' },
  { tab: 'cienaga', id: 'areaFondo', clave: 'areaFondo', etiqueta: 'Área del fondo', unidad: 'km²', min: 50, max: 1000, paso: 5, dec: 0, doc: 'A_c: el área con el agua muy baja.' },
  { tab: 'cienaga', id: 'expansion', clave: 'expansion', etiqueta: 'Área que se inunda por cada metro de nivel', unidad: 'km²/m', min: 0, max: 300, paso: 5, dec: 0, doc: 's: pendiente de la recta A(h).' },
  { tab: 'cienaga', id: 'zFondo', clave: 'zFondo', etiqueta: 'Cota del fondo medio', unidad: 'm.s.n.m.', min: -4, max: 0, paso: 0.05, dec: 2, doc: 'La profundidad es la cota del agua menos la del fondo.' },
  { tab: 'cienaga', grupo: 'Clima local y palafitos' },
  { tab: 'cienaga', id: 'lluviaAnual', clave: 'lluviaAnual', etiqueta: 'Lluvia del año sobre la ciénaga', unidad: 'mm', min: 0, max: 3000, paso: 10, dec: 0, doc: 'Con la distribución mensual de Santa Marta.' },
  { tab: 'cienaga', id: 'Taire', clave: 'Taire', etiqueta: 'Temperatura media del aire', unidad: '°C', min: 22, max: 34, paso: 0.1, dec: 1, doc: 'Con la amplitud diaria fija la evaporación de Hargreaves.' },
  { tab: 'cienaga', id: 'pisoPalafitos', clave: 'pisoPalafitos', etiqueta: 'Cota del piso de los palafitos', unidad: 'm.s.n.m.', min: 0, max: 2, paso: 0.05, dec: 2, doc: 'Se revisa con el nivel máximo del año.' },

  { tab: 'mar', grupo: 'Boca y alcantarillas' },
  { tab: 'mar', id: 'anchoBoca', clave: 'anchoBoca', etiqueta: 'Ancho de la Boca de la Barra', unidad: 'm', min: 0, max: 600, paso: 5, dec: 0, doc: 'Con la profundidad da la sección de la boca.' },
  { tab: 'mar', id: 'profBoca', clave: 'profBoca', etiqueta: 'Profundidad de la boca', unidad: 'm', min: 0, max: 8, paso: 0.1, dec: 1, doc: 'La boca se sedimenta y pierde profundidad.' },
  { tab: 'mar', id: 'alcantarillas', clave: 'alcantarillas', etiqueta: 'Alcantarillas bajo la carretera', unidad: '', min: 0, max: 100, paso: 1, dec: 0, extra: (v, p) => `Sección total de la boca y las alcantarillas: ${miles(S.areaBoca(p))} m².`, doc: 'Cada una de 3 m²: comunican la ciénaga con el mar a través de la barra.' },
  { tab: 'mar', grupo: 'Marea y nivel del mar' },
  { tab: 'mar', id: 'K1', clave: 'K1', etiqueta: 'Amplitud de K1 (diurna lunisolar, 23.93 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2, doc: 'Componente diurna principal del Caribe.' },
  { tab: 'mar', id: 'O1', clave: 'O1', etiqueta: 'Amplitud de O1 (diurna lunar, 25.82 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2, doc: 'Segunda componente diurna.' },
  { tab: 'mar', id: 'M2', clave: 'M2', etiqueta: 'Amplitud de M2 (semidiurna lunar, 12.42 h)', unidad: 'm', min: 0, max: 2, paso: 0.01, dec: 2, doc: 'Principal en el Pacífico; pequeña en el Caribe.' },
  { tab: 'mar', id: 'S2', clave: 'S2', etiqueta: 'Amplitud de S2 (semidiurna solar, 12 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2, doc: 'Con M2 hace las mareas vivas y muertas.' },
  { tab: 'mar', id: 'nivelMar', clave: 'nivelMar', etiqueta: 'Ascenso del nivel del mar', unidad: 'm', min: 0, max: 1.5, paso: 0.01, dec: 2, doc: 'Sube el nivel medio del mar sobre el de hoy.' },
  { tab: 'mar', id: 'Smar', clave: 'Smar', etiqueta: 'Salinidad del mar', unidad: 'PSU', min: 30, max: 40, paso: 0.1, dec: 1, doc: 'Salinidad del agua que entra por la boca.' },

  { tab: 'calidad', grupo: 'Fósforo de los ríos' },
  { tab: 'calidad', id: 'Pmag', clave: 'Pmag', etiqueta: 'Fósforo total del Magdalena', unidad: 'µg/L', min: 10, max: 800, paso: 5, dec: 0, doc: 'Lo que traen los caños.' },
  { tab: 'calidad', id: 'Prios', clave: 'Prios', etiqueta: 'Fósforo total de los ríos de la Sierra', unidad: 'µg/L', min: 5, max: 400, paso: 5, dec: 0, doc: 'Lo que traen los ríos del oriente.' },

  { tab: 'sedimentos', grupo: 'Sedimento de los ríos' },
  { tab: 'sedimentos', id: 'SSmag', clave: 'SSmag', etiqueta: 'Sedimento en suspensión del Magdalena', unidad: 'mg/L', min: 0, max: 3000, paso: 10, dec: 0, doc: 'Lo que traen los caños.' },
  { tab: 'sedimentos', id: 'SSrios', clave: 'SSrios', etiqueta: 'Sedimento de los ríos de la Sierra', unidad: 'mg/L', min: 0, max: 3000, paso: 10, dec: 0, doc: 'Lo que traen los ríos del oriente.' },
];

function estados(p, r) {
  const sal = r.S;
  return [
    { id: 'salinidad', nombre: 'Salinidad', nivel: NIVEL_SAL(r.a.Smax), texto: `Salinidad: ${fmt(sal, 1)} PSU ahora, ${fmt(r.a.Smax, 1)} PSU en el peor mes` },
    { id: 'agua', nombre: 'Agua dulce', nivel: r.a.Qd >= r.a.Qe ? 'ok' : 'alerta', texto: `Agua dulce: ríos ${fmt(r.q.Qr, 1)} y caños ${fmt(r.q.Qc, 1)} m³/s` },
    { id: 'manglar', nombre: 'Manglar', nivel: r.saludPeor >= 0.8 ? (r.especies.rojo.estresPeor > 0 ? 'aviso' : 'ok') : 'alerta', texto: `Manglar: ${fmt(100 * r.saludPeor, 0)} % sano en el peor mes` },
    { id: 'oxigeno', nombre: 'Oxígeno', nivel: r.ca.ODmin >= 4 ? 'ok' : (r.ca.ODmin >= 2 ? 'aviso' : 'alerta'), texto: r.ca.ODmin >= 2 ? `Oxígeno de la madrugada: ${fmt(r.ca.ODmin, 2)} mg/L` : `Mortandad de peces: ${fmt(r.ca.ODmin, 2)} mg/L en la madrugada` },
    { id: 'nivel', nombre: 'Nivel', nivel: r.margenPalafitos >= 0.3 ? 'ok' : 'alerta', texto: `Nivel: ${conSigno(r.z, 2)} m.s.n.m. (marea ${conSigno(r.q.eta, 2)} m)` },
  ];
}

const PINTORES = {
  rios({ p, r, c }) {
    const cl = S.clima(p);
    const H = (d) => M.nivelRio(d, p.Hrio + cl.dH, p.A1, p.d1, p.A2, p.d2);
    const a = r.a.meses;
    return {
      metricas: [
        ['<b>Ríos de la Sierra</b>', '', ''],
        ['Caudal de los ríos hoy', r.q.Qr, 'm³/s', '', 1, 'Caudal medio por el factor del mes y del clima.'],
        ['Caudal medio del año', r.a.Qr, 'm³/s', '', 1],
        ['<b>Magdalena y caños</b>', '', ''],
        ['Nivel del Magdalena frente a los caños', r.q.H, 'm.s.n.m.', '', 2, 'Serie de Fourier de dos términos.'],
        ['Nivel de la ciénaga', r.z, 'm.s.n.m.', '', 3],
        ['Desnivel río − ciénaga', r.q.H - r.z, 'm', r.q.H > r.z ? 'ok' : 'aviso', 3],
        ['Sección de cada caño', r.areaCano, 'm²', '', 0],
        ['Velocidad en los caños', M.velocidadAbertura(p.Ccano, r.q.H - r.z), 'm/s', '', 2, 'v = C·√(2g·Δh).'],
        ['Caudal por los caños hoy', r.q.Qc, 'm³/s', r.q.Qc > 0 ? 'ok' : 'aviso', 1, 'Q = n·C·A·√(2g·Δh).'],
        ['Caudal medio de los caños en el año', r.a.Qc, 'm³/s', r.a.Qc > 1 ? 'ok' : 'alerta', 1],
        ['Agua dulce del año (ríos + caños + lluvia)', r.a.Qd, 'm³/s', r.a.Qd >= r.a.Qe ? 'ok' : 'alerta', 1],
      ],
      tablas: tablaHTML('El agua dulce de cada mes (m³/s)', ['Mes', 'Ríos', 'Caños', 'Lluvia', 'Evaporación'], a.map((m) => [m.mes, fmt(m.Qr, 1), { v: fmt(m.Qc, 1), clase: m.Qc < 1 ? 'mal' : '' }, fmt(m.Qll, 1), fmt(m.Qe, 1)]), { numericas: [1, 2, 3, 4], nota: 'Medias de cada mes del año de régimen.' }),
      ecuacion: [
        ecu.tipo('Serie de Fourier (periódica): el nivel del Magdalena'),
        ecu.formula(`${i('H')}(${i('d')}) = ${i('H̄')} + ${sub('A', '1')}·cos(2π(${i('d')} − ${sub('d', '1')})/365) + ${sub('A', '2')}·cos(4π(${i('d')} − ${sub('d', '2')})/365)`),
        ecu.sust(`${i('H')}(${r.q.d}) = ${fmt(p.Hrio + cl.dH, 2)} + ${fmt(p.A1, 2)}·cos(2π(${r.q.d} − ${p.d1})/365) + ${fmt(p.A2, 2)}·cos(4π(${r.q.d} − ${p.d2})/365) = ${fmt(r.q.H, 2)} m`),
        ecu.tipo('Raíz cuadrada: caudal por los caños (orificio)'),
        ecu.formula(`${i('Q')} = ${i('n')}·${i('C')}·${i('A')}·√(2${i('g')}·Δ${i('h')}) ≈ ${i('n')}·${i('C')}·${i('A')}·√(2${i('g')})·Δ${i('h')}/√(|Δ${i('h')}| + δ)`),
        ecu.sust(`${i('Q')} = ${p.nCanos} × ${fmt(p.Ccano, 2)} × ${fmt(r.areaCano, 0)} × √(2 × 9.81) × ${fmt(r.q.H - r.z, 3)}/√(${fmt(Math.abs(r.q.H - r.z), 3)} + ${fmt(S.SITIO.delta, 2)}) = ${fmt(r.q.Qc, 1)} m³/s`),
        ecu.nota(`La segunda forma es la misma raíz: Δh/√Δh = √Δh. El δ = ${fmt(S.SITIO.delta, 2)} m solo cuenta cuando el desnivel es de pocos centímetros; así el caudal cambia de sentido sin saltos y el cálculo con el reloj no oscila.`),
      ].join(''),
      graficas: [
        { xTitulo: 'Día del año', yTitulo: 'Nivel (m.s.n.m.)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('Magdalena H(d)', muestrear(H, 1, 365, 180), c.ocre), serieLinea('Solo la onda anual', muestrear((d) => p.Hrio + cl.dH + p.A1 * Math.cos((2 * Math.PI * (d - p.d1)) / 365), 1, 365, 120), c.tinta2, { punteada: true, ancho: 1 }), serieLinea('Ciénaga (media del mes)', a.map((m, k) => ({ x: 15 + 30.4 * k, y: m.z })), c.agua), seriePuntos('Hoy', [{ x: r.q.d, y: r.q.H }], c.alerta)],
          limites: { x: { min: 1, max: 365 }, y: { min: Math.min(-0.5, p.Hrio - 1.5), max: Math.max(2.5, p.Hrio + p.A1 + p.A2 + 0.3) } }, pie: 'El Magdalena sube con dos crecientes al año: la diferencia con la ciénaga empuja el agua por los caños.' },
        { xTitulo: 'Mes', yTitulo: 'Caudal (m³/s)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Ríos de la Sierra', a.map((m, k) => ({ x: k + 1, y: m.Qr })), c.ok), serieLinea('Caños del Magdalena', a.map((m, k) => ({ x: k + 1, y: m.Qc })), c.ocre), serieLinea('Evaporación', a.map((m, k) => ({ x: k + 1, y: m.Qe })), c.alerta, { punteada: true })],
          limites: { x: { min: 1, max: 12 }, y: { min: Math.min(0, ...a.map((m) => m.Qc)) } }, pie: 'De enero a abril llega poca agua dulce y la evaporación pesa más: la ciénaga se sala.' },
      ],
    };
  },

  cienaga({ p, r, c }) {
    const { Ac, s } = S.geometria(p);
    const a = r.a.meses;
    return {
      metricas: [
        ['Profundidad media', r.h, 'm', '', 2],
        ['Cota del agua', r.z, 'm.s.n.m.', '', 3],
        ['Área del espejo', r.A / 1e6, 'km²', '', 1, 'A = A_c + s·h.'],
        ['Volumen de agua', r.V / 1e6, 'hm³', '', 0, 'V = A_c·h + s·h²/2.'],
        ['Balance del instante', r.q.Qneto, 'm³/s', '', 1, 'Ríos + caños + lluvia − evaporación ± boca.'],
        ['Tiempo de residencia', r.tauDias, 'días', r.tauDias <= 120 ? 'ok' : 'aviso', 0, 'τ = V/(agua que sale por la boca).'],
        ['Nivel máximo del año', r.a.zMax, 'm.s.n.m.', r.margenPalafitos >= 0.3 ? 'ok' : 'alerta', 3],
        ['Margen bajo el piso de los palafitos', r.margenPalafitos, 'm', r.margenPalafitos >= 0.3 ? 'ok' : 'alerta', 2],
      ],
      tablas: tablaHTML('El nivel en el año', ['Mes', 'Nivel medio', 'Nivel máximo', 'Área media'], a.map((m) => [m.mes, `${conSigno(m.z, 3)} m`, `${conSigno(m.zMax, 3)} m`, `${fmt(M.areaCienaga(m.z - p.zFondo, Ac, s) / 1e6, 1)} km²`]), { numericas: [1, 2, 3], nota: 'La boca deja salir lo que sobra: el nivel sigue al mar y sube unos centímetros con la creciente.' }),
      ecuacion: [
        ecu.tipo('Lineal y cuadrática: área y volumen de la ciénaga'),
        ecu.formula(`${i('A')}(${i('h')}) = ${sub('A', 'c')} + ${i('s')}·${i('h')},  ${i('V')}(${i('h')}) = ${sub('A', 'c')}·${i('h')} + ${i('s')}·${i('h')}²/2`),
        ecu.sust(`${i('V')}(${fmt(r.h, 2)}) = ${fmt(p.areaFondo, 0)} × ${fmt(r.h, 2)} + ${fmt(p.expansion, 0)} × ${fmt(r.h, 2)}²/2 = ${fmt(r.V / 1e6, 1)} hm³`),
        ecu.nota('Con las áreas en km² y la profundidad en metros, el volumen sale en hm³ (millones de m³).'),
        ecu.tipo('Despeje de la cuadrática: profundidad a partir del volumen'),
        ecu.formula(`${i('h')} = (−${sub('A', 'c')} + √(${sub('A', 'c')}² + 2${i('s')}${i('V')}))/${i('s')}`),
        ecu.tipo('Racional: tiempo de residencia'),
        ecu.formula(`τ = ${i('V')}/${i('Q')}`),
        ecu.sust(`τ = ${fmt(r.V / 1e6, 0)} hm³/${fmt(r.a.Qsale, 1)} m³/s = ${fmt(r.tauDias, 0)} días`),
      ].join(''),
      graficas: [
        { xTitulo: 'Profundidad media h (m)', yTitulo: 'Volumen (hm³)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('V(h) = A_c·h + s·h²/2', muestrear((h) => M.volumenCienaga(h, Ac, s) / 1e6, 0, 3, 100), c.agua), serieLinea('Recta A_c·h (sin expansión)', [{ x: 0, y: 0 }, { x: 3, y: (Ac * 3) / 1e6 }], c.tinta2, { punteada: true, ancho: 1 }), seriePuntos('Ahora', [{ x: r.h, y: r.V / 1e6 }], c.ocre)],
          limites: { x: { min: 0, max: 3 }, y: { min: 0 } }, pie: 'La parábola se separa de la recta porque el área crece con el nivel.' },
        { xTitulo: 'Mes', yTitulo: 'Cota del agua (m.s.n.m.)', formatoX: fmtMes, formatoY: (v) => fmt(v, 2), marcasX: MARCAS_MES,
          series: [serieLinea('Nivel medio', a.map((m, k) => ({ x: k + 1, y: m.z })), c.agua), serieLinea('Nivel máximo', a.map((m, k) => ({ x: k + 1, y: m.zMax })), c.agua, { punteada: true, ancho: 1.5 }), serieGuia('Piso de los palafitos', { x: 1, y: p.pisoPalafitos }, { x: 12, y: p.pisoPalafitos }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: Math.min(-0.2, ...a.map((m) => m.z)) - 0.05, max: Math.max(p.pisoPalafitos + 0.2, r.a.zMax + 0.1) } }, pie: 'El nivel de la ciénaga y el piso de los palafitos.' },
      ],
    };
  },

  mar({ p, r, c }) {
    const amps = S.amplitudes(p);
    const t0 = r.t / 3600;
    const mar = muestrear((h) => p.nivelMar + M.marea(h, amps, { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 }), t0 - 24 * 15, t0 + 24 * 15, 600).map((pt) => ({ x: (pt.x - t0) / 24, y: pt.y }));
    // Tres días hacia adelante: nivel del mar, de la ciénaga y caudal por la boca
    const copia = { V: r.V, Msal: r.S * r.V, t: r.t };
    const pasos = [];
    for (let k = 0; k <= 144; k++) {
      const q = S.caudales(p, copia);
      pasos.push({ x: k / 2, mar: q.eta, cie: q.z, Qb: q.Qb });
      S.avanzar(p, copia, 1800);
      copia.t += 1800;
    }
    return {
      metricas: [
        ['Número de forma de la marea', r.F, '', '', 2, 'F = (K1 + O1)/(M2 + S2).'],
        ['Tipo de marea', r.tipoMarea, ''],
        ['Rango máximo de la marea', r.rangoMarea, 'm', '', 2, '2·(K1 + O1 + M2 + S2).'],
        ['Nivel del mar ahora', r.q.eta, 'm', '', 3],
        ['Nivel de la ciénaga ahora', r.z, 'm', '', 3],
        ['Sección de la boca y las alcantarillas', r.areaBoca, 'm²', r.areaBoca >= 300 ? 'ok' : 'alerta', 0],
        ['Caudal por la boca ahora', r.q.Qb, 'm³/s', '', 1, 'Positivo: entra agua de mar; negativo: sale agua de la ciénaga.'],
        ['Agua de mar que entra (media del año)', r.a.Qm, 'm³/s', r.a.Qm >= 50 ? 'ok' : 'aviso', 1],
        ['Agua que sale al mar (media del año)', r.a.Qsale, 'm³/s', '', 1],
      ],
      ecuacion: [
        ecu.tipo('Suma de cosenos (periódica): la marea'),
        ecu.formula(`η(${i('t')}) = Σ ${sub('a', 'i')}·cos(2π${i('t')}/${sub('T', 'i')} − ${sub('φ', 'i')}),  ${i('T')} = 23.93, 25.82, 12.42 y 12 h`),
        ecu.sust(`η = ${fmt(p.K1, 2)}·cos(…K1) + ${fmt(p.O1, 2)}·cos(…O1) + ${fmt(p.M2, 2)}·cos(…M2) + ${fmt(p.S2, 2)}·cos(…S2) ${p.nivelMar ? `+ ${fmt(p.nivelMar, 2)}` : ''} = ${fmt(r.q.eta, 3)} m`),
        ecu.tipo('Racional: número de forma'),
        ecu.formula(`${i('F')} = (K1 + O1)/(M2 + S2) = (${fmt(p.K1, 2)} + ${fmt(p.O1, 2)})/(${fmt(p.M2, 2)} + ${fmt(p.S2, 2)}) = ${fmt(r.F, 2)}`),
        ecu.tipo('Raíz cuadrada: caudal por la boca'),
        ecu.formula(`${i('Q')} = ${i('C')}·${i('A')}·√(2${i('g')}·(η − ${i('z')})) ≈ ${i('C')}·${i('A')}·√(2${i('g')})·(η − ${i('z')})/√(|η − ${i('z')}| + δ)`),
        ecu.sust(`${i('Q')} = ${fmt(p.Cboca, 2)} × ${miles(r.areaBoca)} × √(2 × 9.81) × ${fmt(r.q.eta - r.z, 3)}/√(${fmt(Math.abs(r.q.eta - r.z), 3)} + ${fmt(S.SITIO.delta, 2)}) = ${fmt(r.q.Qb, 1)} m³/s (${r.q.Qb >= 0 ? 'entra agua de mar' : 'sale agua de la ciénaga'})`),
      ].join(''),
      graficas: [
        { xTitulo: 'Días desde hoy', yTitulo: 'Nivel del mar (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('Marea η(t)', mar, c.agua), seriePuntos('Ahora', [{ x: 0, y: r.q.eta }], c.ocre)],
          limites: { x: { min: -15, max: 15 }, y: { min: p.nivelMar - r.rangoMarea * 0.6, max: p.nivelMar + r.rangoMarea * 0.6 } }, pie: 'Un mes de marea: las ondas K1 y O1 se adelantan y se atrasan y hacen semanas de marea grande y de marea pequeña.' },
        { xTitulo: 'Horas desde ahora', yTitulo: 'Nivel (cm) · caudal (decenas de m³/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0), marcasX: [0, 12, 24, 36, 48, 60, 72],
          series: [serieLinea('Mar (cm)', pasos.map((x) => ({ x: x.x, y: 100 * x.mar })), c.agua), serieLinea('Ciénaga (cm)', pasos.map((x) => ({ x: x.x, y: 100 * x.cie })), c.ok), serieLinea('Caudal por la boca ÷ 10', pasos.map((x) => ({ x: x.x, y: x.Qb / 10 })), c.ocre, { punteada: true })],
          limites: { x: { min: 0, max: 72 } }, pie: 'La ciénaga, muy grande frente a su boca, casi no sigue la marea: el desnivel entre el mar y la ciénaga hace entrar y salir el agua.' },
      ],
    };
  },

  salinidad({ p, r, c }) {
    const m = r.mesAhora;
    const Qm = m.Qbin, EA = m.Qe;
    const Qd = m.Qr + Math.max(0, m.Qc) + m.Qll;
    const asintota = EA - Qm;
    const xMax = Math.max(300, Qd * 1.5);
    const xMin = Math.min(0, asintota - 25);
    const curva = muestrear((q) => Math.min(80, M.salinidadEquilibrio(p.Smar, Qm, q, EA)), asintota + 0.2, xMax, 260);
    const a = r.a.meses;
    const tau = r.tauDias;
    return {
      metricas: [
        ['Salinidad ahora', r.S, 'PSU', NIVEL_SAL(r.S), 1],
        ['Salinidad media del año', a.reduce((x, y) => x + y.S, 0) / 12, 'PSU', '', 1],
        ['Salinidad máxima del año', r.a.Smax, 'PSU', NIVEL_SAL(r.a.Smax), 1],
        ['Salinidad mínima del año', r.a.Smin, 'PSU', r.a.Smin >= 2 ? 'ok' : 'aviso', 1],
        [`<b>Equilibrio de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][r.fecha.mes]}</b>`, '', ''],
        ['Agua de mar que entra Q_m', Qm, 'm³/s', '', 1],
        ['Agua dulce que entra Q_d', Qd, 'm³/s', '', 1],
        ['Evaporación E·A', EA, 'm³/s', '', 1],
        ['Salinidad de equilibrio del mes', Number.isFinite(m.Seq) ? m.Seq : 'hipersalina', Number.isFinite(m.Seq) ? 'PSU' : '', Number.isFinite(m.Seq) ? NIVEL_SAL(m.Seq) : 'alerta', 1, 'S = S_mar·Q_m/(Q_m + Q_d − E·A).'],
        ['Asíntota vertical Q_d = E·A − Q_m', asintota, 'm³/s', asintota > 0 ? 'alerta' : '', 1, asintota > 0 ? 'Con menos agua dulce que esta no sale nada por la boca y la sal se acumula sin límite.' : 'Negativa: entra más agua de mar que la que se evapora, así que la ciénaga no puede volverse infinitamente salada.'],
        ['Tiempo de respuesta de la salinidad', tau, 'días', '', 0, 'τ = V/Q: S(t) = S_eq + (S₀ − S_eq)·e^(−t/τ).'],
      ],
      tablas: tablaHTML('La salinidad en el año (PSU)', ['Mes', 'Media', 'Máxima', 'Equilibrio'], a.map((x) => [x.mes, fmt(x.S, 1), { v: fmt(x.Smax, 1), clase: x.Smax > 40 ? 'mal' : '' }, Number.isFinite(x.Seq) ? fmt(x.Seq, 1) : '∞']), { numericas: [1, 2, 3], nota: 'La salinidad va detrás del equilibrio de cada mes: la ciénaga tarda semanas en responder.' }),
      ecuacion: [
        ecu.tipo('Decimales: mezcla como promedio ponderado'),
        ecu.formula(`${i('S')} = (${sub('Q', 'm')}·${sub('S', 'mar')} + ${sub('Q', 'd')}·${sub('S', 'd')})/(${sub('Q', 'm')} + ${sub('Q', 'd')})`),
        ecu.tipo('Racional con asíntota: salinidad de equilibrio'),
        ecu.formula(`${sub('S', 'eq')} = ${sub('S', 'mar')}·${sub('Q', 'm')}/(${sub('Q', 'm')} + ${sub('Q', 'd')} − ${i('E')}·${i('A')})`),
        ecu.sust(`${sub('S', 'eq')} = ${fmt(p.Smar, 1)} × ${fmt(Qm, 1)}/(${fmt(Qm, 1)} + ${fmt(Qd, 1)} − ${fmt(EA, 1)}) = ${Number.isFinite(m.Seq) ? fmt(m.Seq, 1) + ' PSU' : 'sin límite (hipersalina)'}`),
        ecu.tipo('Exponencial: la salinidad se acerca al equilibrio'),
        ecu.formula(`${i('S')}(${i('t')}) = ${sub('S', 'eq')} + (${sub('S', '0')} − ${sub('S', 'eq')})·e<sup>−${i('t')}/τ</sup>`),
      ].join(''),
      graficas: [
        { xTitulo: 'Agua dulce que entra Q_d (m³/s)', yTitulo: 'Salinidad de equilibrio (PSU)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('S_eq(Q_d)', curva, c.agua), serieGuia('Mar', { x: xMin, y: p.Smar }, { x: xMax, y: p.Smar }, c.tinta2), serieGuia('Asíntota', { x: asintota, y: 0 }, { x: asintota, y: 80 }, c.alerta), serieGuia('Sin agua dulce (Q_d = 0)', { x: 0, y: 0 }, { x: 0, y: 80 }, c.tinta2, { punteada: false, ancho: 1 }), seriePuntos('Este mes', [{ x: Qd, y: Math.min(80, m.Seq) }], c.ocre)],
          limites: { x: { min: xMin, max: xMax }, y: { min: 0, max: 80 } }, pie: 'La función racional sube sin límite cerca de su asíntota. Solo la parte con Q_d ≥ 0 tiene sentido físico; por encima de la línea del mar la ciénaga es hipersalina.' },
        { xTitulo: 'Mes', yTitulo: 'Salinidad (PSU)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Media', a.map((x, k) => ({ x: k + 1, y: x.S })), c.agua), serieLinea('Máxima', a.map((x, k) => ({ x: k + 1, y: x.Smax })), c.agua, { punteada: true, ancho: 1.5 }), seriePuntos('Equilibrio', a.map((x, k) => ({ x: k + 1, y: Math.min(80, x.Seq) })), c.ocre, 3), serieGuia('Hipersalina (40)', { x: 1, y: 40 }, { x: 12, y: 40 }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0, max: Math.max(45, Math.ceil(r.a.Smax + 5)) } }, pie: 'Sube en la temporada seca y baja con la creciente del Magdalena.' },
      ],
    };
  },

  manglar({ p, r, c }) {
    const colores = { rojo: c.alerta, blanco: c.ocre, negro: c.tinta2 };
    const curvas = Object.entries(M.ESPECIES).map(([k, e]) => serieLinea(e.nombre.split(' (')[0], [{ x: 0, y: 0 }, { x: e.Sopt, y: 0 }, { x: e.Smax, y: 100 }, { x: 110, y: 100 }], colores[k]));
    const filas = Object.values(r.especies).map((e) => {
      const [comun, cientifico] = e.nombre.replace(')', '').split(' (');
      return [{ v: comun, nota: `<i>${cientifico}</i>` }, `${e.Sopt}–${e.Smax}`, { v: `${fmt(100 * e.estres, 0)} %`, clase: e.estres > 0 ? 'mal' : 'bien' }, { v: `${fmt(100 * e.estresPeor, 0)} %`, clase: e.estresPeor > 0 ? 'mal' : 'bien' }, `${fmt(100 * e.peso, 0)} %`];
    });
    const crudo = (r.SsueloMax - 40) / (65 - 40);
    return {
      metricas: [
        ['Salinidad del agua', r.S, 'PSU', '', 1],
        ['Salinidad del suelo del manglar', r.Ssuelo, 'PSU', NIVEL_SAL(r.Ssuelo), 1, 'La evaporación concentra la sal: S_suelo = 1.25·S + 5.'],
        ['Salinidad del suelo en el peor mes', r.SsueloMax, 'PSU', NIVEL_SAL(r.SsueloMax), 1],
        ['Salud del manglar ahora', 100 * r.salud, '%', r.salud >= 0.8 ? 'ok' : 'alerta', 0, '1 − Σ pesoᵢ·estrésᵢ.'],
        ['Salud del manglar en el peor mes', 100 * r.saludPeor, '%', r.saludPeor >= 0.8 ? 'ok' : 'alerta', 0],
        ['Índice de pesca', r.pesca, '', r.pesca >= 0.6 ? 'ok' : 'aviso', 2, 'Por tramos según la salinidad, por el factor del oxígeno.'],
      ],
      tablas: tablaHTML('Especies de mangle', ['Especie', 'Suelo (PSU)', 'Estrés ahora', 'Peor mes', 'Bosque'], filas, { numericas: [1, 2, 3, 4], nota: 'Suelo: salinidad a la que la especie empieza a sufrir y a la que muere (umbrales de referencia). Bosque: parte del manglar que ocupa cada especie.' }),
      ecuacion: [
        ecu.tipo('Lineal por tramos: estrés de cada especie'),
        ecu.formula(`estrés(${i('S')}) = 0 si ${i('S')} ≤ ${sub('S', 'opt')};  (${i('S')} − ${sub('S', 'opt')})/(${sub('S', 'máx')} − ${sub('S', 'opt')}) si ${sub('S', 'opt')} < ${i('S')} < ${sub('S', 'máx')};  1 si ${i('S')} ≥ ${sub('S', 'máx')}`),
        ecu.sust(`Mangle rojo con el suelo a ${fmt(r.SsueloMax, 1)} PSU en el peor mes: (${fmt(r.SsueloMax, 1)} − 40)/(65 − 40) = ${fmt(crudo, 3)} → ${fmt(100 * r.especies.rojo.estresPeor, 0)} %${crudo < 0 ? ' (por debajo del umbral, sin estrés)' : (crudo > 1 ? ' (pasó el máximo: muere)' : '')}`),
        ecu.tipo('Lineal: salinidad del suelo'),
        ecu.formula(`${sub('S', 'suelo')} = 1.25·${i('S')} + 5 = 1.25 × ${fmt(r.S, 1)} + 5 = ${fmt(r.Ssuelo, 1)} PSU`),
      ].join(''),
      graficas: [
        { xTitulo: 'Salinidad del suelo (PSU)', yTitulo: 'Estrés (%)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [...curvas, serieGuia('Suelo en el peor mes', { x: r.SsueloMax, y: 0 }, { x: r.SsueloMax, y: 100 }, c.agua)],
          limites: { x: { min: 0, max: 110 }, y: { min: 0, max: 105 } }, pie: 'Rectas por tramos: cada especie empieza a sufrir en su umbral y muere en su máximo.' },
        { xTitulo: 'Salinidad del agua (PSU)', yTitulo: 'Índice de pesca', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('Índice con el oxígeno de hoy', muestrear((Sx) => M.indicePesca(Sx, r.ca.ODmin), 0, 70, 140), c.ok), seriePuntos('Ahora', [{ x: r.S, y: r.pesca }], c.ocre)],
          limites: { x: { min: 0, max: 70 }, y: { min: 0, max: 1.05 } }, pie: 'La pesca rinde más en agua salobre (5 a 25 PSU) y cae con la hipersalinidad o con poco oxígeno.' },
      ],
    };
  },

  calidad({ p, r, c }) {
    const ca = r.ca;
    const dia = muestrear((h) => Math.max(0, M.oxigenoHora(ca.ODm, ca.A, h)), 0, 24, 96);
    return {
      metricas: [
        ['Fósforo del agua que entra', ca.Pin, 'µg/L', '', 1, 'Promedio ponderado de los ríos, los caños y el mar.'],
        ['Tiempo de residencia medio del año', ca.tau * 365, 'días', '', 0, 'τ = V(1.5 m)/(agua que sale por la boca en el año), en años para Vollenweider.'],
        ['Fósforo de la ciénaga', ca.P, 'µg/L', '', 1, 'P = P_in/(1 + √τ).'],
        ['Clorofila a', ca.Chl, 'µg/L', ca.Chl <= 40 ? 'ok' : 'aviso', 1, 'Dillon y Rigler: Chl = 0.0731·P^1.449.'],
        ['Temperatura del agua', ca.Tagua, '°C', '', 1],
        ['Oxígeno de saturación (con la sal)', ca.ODsat, 'mg/L', '', 2, 'APHA × (1 − 0.0051·S).'],
        [`Oxígeno a las ${horaTexto(r.hora)}`, ca.OD, 'mg/L', ca.OD >= 4 ? 'ok' : (ca.OD >= 2 ? 'aviso' : 'alerta'), 2],
        ['Mínimo de la madrugada (05:00)', ca.ODmin, 'mg/L', ca.ODmin >= 2 ? (ca.ODmin >= 4 ? 'ok' : 'aviso') : 'alerta', 2],
        ['Máximo de la tarde (17:00)', ca.ODmax, 'mg/L', '', 2],
      ],
      ecuacion: [
        ecu.tipo('Racional con raíz y potencia: fósforo y algas'),
        ecu.formula(`${i('P')} = ${sub('P', 'in')}/(1 + √τ),  Chl = 0.0731·${i('P')}<sup>1.449</sup>`),
        ecu.sust(`${i('P')} = ${fmt(ca.Pin, 1)}/(1 + √${fmt(ca.tau, 3)}) = ${fmt(ca.P, 1)} µg/L → Chl = ${fmt(ca.Chl, 1)} µg/L`),
        ecu.tipo('Periódica: el oxígeno del día'),
        ecu.formula(`OD(${i('t')}) = (${sub('OD', 'sat')} − ${i('D')}) − ${i('A')}·cos(2π(${i('t')} − 5)/24),  ${i('A')} = 0.06·Chl,  ${i('D')} = 0.5 + 0.03·Chl`),
        ecu.sust(`OD<sub>mín</sub> = ${fmt(ca.ODsat, 2)} − ${fmt(ca.D, 2)} − ${fmt(ca.A, 2)} = ${fmt(ca.ODmin, 2)} mg/L`),
        ecu.nota(ca.ODmin < 2 ? 'Con tantas algas el oxígeno de la madrugada no alcanza: mortandad de peces.' : 'El oxígeno de la madrugada alcanza para los peces.', ca.ODmin < 2),
      ].join(''),
      graficas: [
        { xTitulo: 'Hora del día', yTitulo: 'Oxígeno disuelto (mg/L)', formatoX: (v) => `${fmt(v, 0)} h`, formatoY: (v) => fmt(v, 0), marcasX: [0, 3, 6, 9, 12, 15, 18, 21, 24],
          series: [serieLinea('OD(t)', dia, c.agua), serieGuia('Saturación', { x: 0, y: ca.ODsat }, { x: 24, y: ca.ODsat }, c.tinta2), serieGuia('Mortandad de peces (2 mg/L)', { x: 0, y: 2 }, { x: 24, y: 2 }, c.alerta), seriePuntos('Ahora', [{ x: r.hora, y: ca.OD }], c.ocre)],
          limites: { x: { min: 0, max: 24 }, y: { min: 0, max: techoRedondo(ca.ODmax + 1) } }, pie: 'El oxígeno sube de día con la fotosíntesis y cae de noche.' },
        { xTitulo: 'Fósforo (µg/L)', yTitulo: 'Clorofila a (µg/L)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Chl = 0.0731·P^1.449', muestrear((P) => M.clorofila(P), 1, 200, 120), c.ok), seriePuntos('Ahora', [{ x: ca.P, y: ca.Chl }], c.ocre)],
          limites: { x: { min: 0, max: 200 }, y: { min: 0 } }, pie: 'Función potencia con exponente mayor que 1: cada µg de fósforo de más da más algas que el anterior.' },
      ],
    };
  },

  sedimentos({ p, r, c }) {
    const sd = r.sed;
    const ret = muestrear((x) => 100 * M.fraccionRetenida(10 ** x, sd.A, r.a.Qd), -8, -2, 200);
    return {
      metricas: [
        ['Sedimento que entra al año', sd.carga / 1e6, 'millones de t', '', 2, '(ríos × SS + caños × SS) × segundos del año.'],
        ['Se queda en la ciénaga', 100 * sd.TE, '%', '', 1, 'Cada grano se queda si cae más rápido que la carga superficial Q/A.'],
        ['Espesor que se deposita', sd.mm, 'mm/año', sd.mm <= 5 ? 'ok' : 'aviso', 2, 'masa·TE/(ρ_b·A).'],
        ['Años para perder 10 cm de profundidad', sd.anos10cm, 'años', '', 0],
      ],
      tablas: tablaHTML('Clases de grano', ['Clase', 'Diámetro', 'Velocidad de caída', 'Parte', 'Se queda'], sd.granos.map((g) => [g.nombre, `${fmt(g.d * 1e6, 0)} µm`, g.vs < 1e-4 ? `${fmt(g.vs * 1e6, 1)} µm/s` : `${fmt(g.vs * 1000, 2)} mm/s`, `${fmt(100 * g.f, 0)} %`, `${fmt(100 * g.ret, 0)} %`]), { numericas: [1, 2, 3, 4], nota: `Carga superficial Q/A = ${fmt((r.a.Qd / sd.A) * 1e6, 3)} µm/s: la ciénaga es tan grande que casi todo se deposita.` }),
      ecuacion: [
        ecu.tipo('Cuadrática: ley de Stokes'),
        ecu.formula(`${sub('v', 's')} = ${i('K')}·${i('d')}²,  ${i('K')} = ${i('g')}(${sub('ρ', 's')} − ρ)/(18μ)`),
        ecu.sust(`Arena fina a ${fmt(p.Taire + 1, 1)} °C: ${sub('v', 's')} = ${miles(M.constanteStokes(p.Taire + 1))} × (0.0001)² = ${fmt(1000 * M.velocidadCaida(1e-4, p.Taire + 1), 2)} mm/s`),
        ecu.tipo('Lineal: espesor que se deposita'),
        ecu.formula(`Δ${i('z')} = ${i('M')}·TE/(${sub('ρ', 'b')}·${i('A')})`),
        ecu.sust(`Δ${i('z')} = ${fmt(sd.carga / 1e6, 2)}·10⁶ t × ${fmt(sd.TE, 3)}/(${fmt(S.SITIO.rhoB, 1)} t/m³ × ${fmt(sd.A / 1e6, 0)}·10⁶ m²) = ${fmt(sd.mm / 1000, 5)} m = ${fmt(sd.mm, 2)} mm/año`),
      ].join(''),
      graficas: [
        { xTitulo: 'log₁₀ de la velocidad de caída (m/s)', yTitulo: 'Se queda (%)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('mín(1, v_s·A/Q)', ret, c.ocre), seriePuntos('Clases de grano', sd.granos.map((g) => ({ x: Math.log10(g.vs), y: 100 * g.ret })), c.agua)],
          limites: { x: { min: -8, max: -2 }, y: { min: 0, max: 105 } }, pie: 'Retención por tramos: todo lo que cae más rápido que la carga superficial se queda.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Profundidad media (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('h(t) = h₀ − Δz·t', [{ x: 0, y: r.h }, { x: 100, y: r.h - sd.mm * 0.1 }], c.agua)],
          limites: { x: { min: 0, max: 100 }, y: { min: Math.max(0, Math.floor(10 * (r.h - sd.mm * 0.1 - 0.1)) / 10), max: Math.ceil(10 * (r.h + 0.1)) / 10 } }, pie: 'Sin dragado ni ascenso del mar, el fondo sube y la ciénaga pierde profundidad en línea recta.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'cienagas',
  tabInicial: 'salinidad',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Ciénagas costeras',
  tabs: TABS,
  controles: CONTROLES,
  PARAMETROS: S.PARAMETROS,
  escenarios: S.ESCENARIOS,
  estadoInicial: S.estadoInicial,
  avanzar: S.avanzar,
  calcular: S.calcular,
  pasoMaximo: 1800,
  reloj: {
    tipo: 'dias', inicio: 6 * 3600,
    velocidades: [{ valor: 600, nombre: '10 min por segundo' }, { valor: 3600, nombre: '1 h por segundo' }, { valor: 21600, nombre: '6 h por segundo' }, { valor: 86400, nombre: '1 día por segundo' }, { valor: 864000, nombre: '10 días por segundo' }],
    defecto: 3600,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 3600, nombre: '1 h' }, { valor: 21600, nombre: '6 h' }, { valor: 86400, nombre: '1 día' }],
    intervaloDefecto: 21600,
    columnas: [
      { clave: 'z', nombre: 'Nivel', unidad: 'm.s.n.m.', dec: 3 },
      { clave: 'eta', nombre: 'Marea', unidad: 'm', dec: 3 },
      { clave: 'S', nombre: 'Salinidad', unidad: 'PSU', dec: 2 },
      { clave: 'Qc', nombre: 'Caños', unidad: 'm³/s', dec: 1 },
      { clave: 'Qb', nombre: 'Boca', unidad: 'm³/s', dec: 1 },
      { clave: 'OD', nombre: 'Oxígeno', unidad: 'mg/L', dec: 2 },
    ],
    tomar: (p, r) => ({ z: r.z, eta: r.q.eta, S: r.S, Qc: r.q.Qc, Qb: r.q.Qb, OD: r.ca.OD }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'general', nombre: 'Ciénaga', titulo: 'La ciénaga, la barra y el mar' },
    { id: 'canos', nombre: 'Caños', titulo: 'El Magdalena y los caños' },
    { id: 'boca', nombre: 'Boca', titulo: 'La boca, la carretera y el mar' },
    { id: 'palafitos', nombre: 'Palafitos', titulo: 'El pueblo de palafitos y el manglar' },
  ],
});
