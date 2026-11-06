/**
 * app.js — Simulador de costas (playas): pestañas, controles, resultados, ecuaciones con
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
const nivelColi = (C) => (C <= 200 ? 'ok' : (C <= 1000 ? 'aviso' : 'alerta'));

const TABS = [
  { id: 'oleaje', nombre: 'Oleaje', graficas: 2, intro: 'A la playa llegan dos oleajes. El mar de fondo viene de lejos, empujado por los vientos alisios: es más alto de diciembre a abril, cuando los alisios soplan fuerte. El mar de viento lo levanta la brisa de la tarde sobre la bahía: crece con la velocidad del viento y con la distancia que recorre sobre el agua (el fetch). Los dos se suman como los catetos de un triángulo.' },
  { id: 'rompiente', nombre: 'Rompiente', graficas: 2, intro: 'Al llegar a aguas poco profundas la ola se frena, se acorta y crece, y se tuerce para llegar casi de frente a la playa (refracción). Rompe cuando su altura llega a unas tres cuartas partes de la profundidad. Si llega en ángulo, empuja el agua a lo largo de la playa: es la corriente que arrastra a los bañistas y a la arena.' },
  { id: 'nivel', nombre: 'Marea y nivel', graficas: 2, intro: 'El nivel del agua en la playa es la suma de la marea, de la sobreelevación de una tormenta (la presión baja y el viento empujan el mar contra la costa) y del remonte de las olas, que suben por la arena. Si el total pasa la cota del malecón, el mar inunda la avenida.' },
  { id: 'perfil', nombre: 'Perfil de playa', graficas: 2, tablas: true, intro: 'Debajo del agua la playa tiene una forma de equilibrio: la profundidad crece rápido cerca de la orilla y después más despacio. La forma depende del tamaño de la arena (la arena gruesa hace playas más empinadas). Más allá de la profundidad de cierre las olas ya casi no mueven la arena. Con el ancho de la playa seca se calcula cuánta gente cabe.' },
  { id: 'arena', nombre: 'Arena de la playa', graficas: 2, tablas: true, intro: 'El oleaje lleva la arena a lo largo de la playa. Si sale más arena de la que llega (de los ríos y de la playa vecina), la playa se adelgaza; si llega más, se ensancha. Los cabos rocosos y los espolones retienen parte de la arena; el relleno la repone.' },
  { id: 'mar', nombre: 'Ascenso del mar', graficas: 2, intro: 'Cuando el mar sube, la playa no solo se inunda: todo el perfil de equilibrio se corre tierra adentro y sube con el mar. La regla de Bruun dice cuánto retrocede la orilla: mucho más que lo que sube el agua, porque el perfil activo es largo y poco inclinado.' },
  { id: 'calidad', nombre: 'Agua de baño', graficas: 2, intro: 'El agua residual de la ciudad sale por un emisario submarino, lejos de la playa y a buena profundidad. Al salir sube como una pluma y se mezcla con el agua de mar; después la corriente la lleva hacia la costa mientras el sol mata las bacterias. Para bañarse, el agua debe tener menos de 200 coliformes fecales por cada 100 mL.' },
];

const CONTROLES = [
  { tab: 'oleaje', grupo: 'Escenario' },
  { tab: 'oleaje', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio: mar de leva, tormenta tropical, El Niño, menos arena, espolón, relleno, ascenso del mar o problemas del emisario.' },
  { tab: 'oleaje', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS),
    extra: (v) => { const c = S.CLIMAS[v]; return `Oleaje × ${fmt(c.fOla, 2)}, viento × ${fmt(c.fViento, 2)}, arena de los ríos × ${fmt(c.fAporte, 2)}.`; } },
  { tab: 'oleaje', grupo: 'Mar de fondo de los alisios' },
  { tab: 'oleaje', id: 'Hs0', clave: 'Hs0', etiqueta: 'Altura significativa media del mar de fondo', unidad: 'm', min: 0.1, max: 4, paso: 0.05, dec: 2 },
  { tab: 'oleaje', id: 'aEst', clave: 'aEst', etiqueta: 'Variación con la temporada (fracción)', unidad: '', min: 0, max: 0.8, paso: 0.01, dec: 2, doc: 'Máximo a comienzos de febrero.' },
  { tab: 'oleaje', id: 'Tp', clave: 'Tp', etiqueta: 'Período del mar de fondo', unidad: 's', min: 3, max: 18, paso: 0.1, dec: 1 },
  { tab: 'oleaje', grupo: 'Brisa de la tarde' },
  { tab: 'oleaje', id: 'U0', clave: 'U0', etiqueta: 'Velocidad media del viento', unidad: 'm/s', min: 0, max: 15, paso: 0.1, dec: 1 },
  { tab: 'oleaje', id: 'Ua', clave: 'Ua', etiqueta: 'Variación en el día (máximo a las 15:00)', unidad: 'm/s', min: 0, max: 8, paso: 0.1, dec: 1 },
  { tab: 'oleaje', id: 'fetch', clave: 'fetch', etiqueta: 'Fetch (distancia que recorre el viento sobre el agua)', unidad: 'km', min: 1, max: 300, paso: 1, dec: 0 },

  { tab: 'rompiente', grupo: 'Dirección del oleaje' },
  { tab: 'rompiente', id: 'theta0', clave: 'theta0', etiqueta: 'Ángulo del mar de fondo con la normal a la costa', unidad: '°', min: 0, max: 60, paso: 0.5, dec: 1, doc: 'En una playa de bahía el oleaje llega casi de frente.' },

  { tab: 'nivel', grupo: 'Marea astronómica' },
  { tab: 'nivel', id: 'K1', clave: 'K1', etiqueta: 'Amplitud de K1 (23.93 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'nivel', id: 'O1', clave: 'O1', etiqueta: 'Amplitud de O1 (25.82 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'nivel', id: 'M2', clave: 'M2', etiqueta: 'Amplitud de M2 (12.42 h)', unidad: 'm', min: 0, max: 2, paso: 0.01, dec: 2 },
  { tab: 'nivel', id: 'S2', clave: 'S2', etiqueta: 'Amplitud de S2 (12 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'nivel', id: 'nivelMar', clave: 'nivelMar', etiqueta: 'Nivel medio del mar sobre el de hoy', unidad: 'm', min: 0, max: 1.5, paso: 0.01, dec: 2 },
  { tab: 'nivel', id: 'malecon', clave: 'malecon', etiqueta: 'Cota del malecón', unidad: 'm', min: 0.5, max: 6, paso: 0.05, dec: 2 },
  { tab: 'nivel', grupo: 'Tormenta del año' },
  { tab: 'nivel', id: 'tormenta', clave: 'tormenta', etiqueta: 'Hay una tormenta en el año', tipo: 'casilla' },
  { tab: 'nivel', id: 'diaTormenta', clave: 'diaTormenta', etiqueta: 'Día del año en que empieza', unidad: '', min: 1, max: 365, paso: 1, dec: 0 },
  { tab: 'nivel', id: 'duracionTormenta', clave: 'duracionTormenta', etiqueta: 'Duración', unidad: 'días', min: 0.5, max: 10, paso: 0.5, dec: 1 },
  { tab: 'nivel', id: 'HsTormenta', clave: 'HsTormenta', etiqueta: 'Altura significativa del oleaje de la tormenta', unidad: 'm', min: 0.5, max: 8, paso: 0.1, dec: 1 },
  { tab: 'nivel', id: 'TpTormenta', clave: 'TpTormenta', etiqueta: 'Período del oleaje de la tormenta', unidad: 's', min: 4, max: 20, paso: 0.5, dec: 1 },
  { tab: 'nivel', id: 'presionTormenta', clave: 'presionTormenta', etiqueta: 'Presión atmosférica en la tormenta', unidad: 'hPa', min: 940, max: 1013, paso: 1, dec: 0 },
  { tab: 'nivel', id: 'vientoTormenta', clave: 'vientoTormenta', etiqueta: 'Viento hacia la costa en la tormenta', unidad: 'm/s', min: 0, max: 60, paso: 1, dec: 0 },
  { tab: 'nivel', id: 'tormentaYa', etiqueta: 'Tormenta ahora', tipo: 'accion', accion: (p, sim) => S.tormentaAhora(p, sim), doc: 'Empieza ya una tormenta con los valores de arriba y la duración elegida.' },

  { tab: 'perfil', grupo: 'La arena y el perfil' },
  { tab: 'perfil', id: 'D50', clave: 'D50', etiqueta: 'Diámetro medio de la arena', unidad: 'mm', min: 0.08, max: 2, paso: 0.01, dec: 2 },
  { tab: 'perfil', id: 'pendiente', clave: 'pendiente', etiqueta: 'Pendiente del frente de playa', unidad: '', min: 0.01, max: 0.3, paso: 0.005, dec: 3 },
  { tab: 'perfil', id: 'berma', clave: 'berma', etiqueta: 'Altura de la berma', unidad: 'm', min: 0.3, max: 5, paso: 0.05, dec: 2 },
  { tab: 'perfil', id: 'He', clave: 'He', etiqueta: 'Ola que se supera 12 horas al año', unidad: 'm', min: 0.5, max: 10, paso: 0.1, dec: 1 },
  { tab: 'perfil', id: 'Te', clave: 'Te', etiqueta: 'Período de esa ola', unidad: 's', min: 4, max: 20, paso: 0.5, dec: 1 },
  { tab: 'perfil', grupo: 'Uso de la playa' },
  { tab: 'perfil', id: 'anchoMin', clave: 'anchoMin', etiqueta: 'Ancho mínimo de playa seca', unidad: 'm', min: 5, max: 100, paso: 1, dec: 0 },
  { tab: 'perfil', id: 'areaBanista', clave: 'areaBanista', etiqueta: 'Área por bañista', unidad: 'm²', min: 2, max: 40, paso: 0.5, dec: 1 },
  { tab: 'perfil', id: 'visitantes', clave: 'visitantes', etiqueta: 'Visitantes en un día de temporada', unidad: '', min: 0, max: 50000, paso: 100, dec: 0 },

  { tab: 'arena', grupo: 'La celda de la playa' },
  { tab: 'arena', id: 'largo', clave: 'largo', etiqueta: 'Largo de la playa', unidad: 'm', min: 200, max: 20000, paso: 50, dec: 0 },
  { tab: 'arena', id: 'ancho0', clave: 'ancho0', etiqueta: 'Ancho de playa seca de hoy', unidad: 'm', min: 0, max: 200, paso: 1, dec: 0, alCambiar: (v, p, sim) => { sim.W = v; } },
  { tab: 'arena', grupo: 'Arena que llega y que sale' },
  { tab: 'arena', id: 'aporte', clave: 'aporte', etiqueta: 'Arena que llega de los ríos y de la playa vecina', unidad: 'm³/año', min: 0, max: 3e6, paso: 1000, dec: 0 },
  { tab: 'arena', id: 'retencion', clave: 'retencion', etiqueta: 'Parte del transporte que retienen los cabos y los espolones', unidad: '', min: 0, max: 0.95, paso: 0.01, dec: 2 },
  { tab: 'arena', id: 'relleno', clave: 'relleno', etiqueta: 'Relleno de playa', unidad: 'm³/año', min: 0, max: 1e6, paso: 1000, dec: 0 },

  { tab: 'mar', grupo: 'El mar sube' },
  { tab: 'mar', id: 'ascensoMar', clave: 'ascensoMar', etiqueta: 'Ascenso del nivel del mar', unidad: 'mm/año', min: 0, max: 30, paso: 0.1, dec: 1 },

  { tab: 'calidad', grupo: 'El emisario submarino' },
  { tab: 'calidad', id: 'C0', clave: 'C0', etiqueta: 'Coliformes fecales en el agua residual', unidad: 'NMP/100 mL', min: 1e2, max: 1e8, paso: 100, dec: 0, doc: 'Unos 10⁷ sin tratar; 10⁵ con tratamiento secundario.' },
  { tab: 'calidad', id: 'Qemisario', clave: 'Qemisario', etiqueta: 'Caudal del emisario', unidad: 'm³/s', min: 0.05, max: 10, paso: 0.05, dec: 2 },
  { tab: 'calidad', id: 'zEmisario', clave: 'zEmisario', etiqueta: 'Profundidad de la descarga', unidad: 'm', min: 5, max: 100, paso: 1, dec: 0 },
  { tab: 'calidad', id: 'xEmisario', clave: 'xEmisario', etiqueta: 'Distancia de la descarga a la playa', unidad: 'km', min: 0.2, max: 10, paso: 0.1, dec: 1 },
  { tab: 'calidad', id: 'corriente', clave: 'corriente', etiqueta: 'Corriente hacia la playa', unidad: 'm/s', min: 0.02, max: 1, paso: 0.01, dec: 2 },
  { tab: 'calidad', grupo: 'Muerte de las bacterias' },
  { tab: 'calidad', id: 'T90dia', clave: 'T90dia', etiqueta: 'T90 a pleno sol', unidad: 'h', min: 0.5, max: 24, paso: 0.5, dec: 1 },
  { tab: 'calidad', id: 'T90noche', clave: 'T90noche', etiqueta: 'T90 de noche', unidad: 'h', min: 2, max: 100, paso: 1, dec: 0 },
];

function estados(p, r) {
  const q = r.q;
  return [
    { id: 'oleaje', nombre: 'Oleaje', nivel: r.torm ? 'alerta' : (q.H0 <= 2.5 ? 'ok' : 'aviso'), texto: r.torm ? `Tormenta: H_s ${fmt(q.H0, 2)} m, T ${fmt(q.T, 1)} s` : `Oleaje: H_s ${fmt(q.H0, 2)} m, T ${fmt(q.T, 1)} s` },
    { id: 'nivel', nombre: 'Nivel', nivel: q.TWL <= p.malecon - 0.3 ? 'ok' : (q.TWL <= p.malecon ? 'aviso' : 'alerta'), texto: `Nivel total: ${fmt(q.TWL, 2)} m (malecón a ${fmt(p.malecon, 2)} m)` },
    { id: 'playa', nombre: 'Playa', nivel: r.W >= p.anchoMin ? (r.v >= 0 ? 'ok' : 'aviso') : 'alerta', texto: `Playa: ${fmt(r.W, 1)} m de ancho (${conSigno(r.v, 2)} m/año)` },
    { id: 'bano', nombre: 'Agua de baño', nivel: nivelColi(r.Cmax), texto: `Agua de baño: ${miles(r.col.C)} NMP/100 mL ahora` },
    { id: 'corriente', nombre: 'Corriente', nivel: Math.abs(q.V) <= 0.6 ? 'ok' : 'aviso', texto: `Corriente litoral: ${fmt(Math.abs(q.V), 2)} m/s` },
  ];
}

const PINTORES = {
  oleaje({ p, r, c }) {
    const q = r.q, a = r.a, cl = S.clima(p);
    const sw = (d) => p.Hs0 * (1 + p.aEst * Math.cos((2 * Math.PI * (d * 30.4 - 15 - p.dEst)) / 365)) * cl.fOla;
    return {
      metricas: [
        ['<b>Mar de fondo</b>', '', ''],
        ['Altura del mar de fondo hoy', q.Hsw, 'm', q.torm ? 'alerta' : '', 2, 'H̄·[1 + a·cos(2π(d − 40)/365)].'],
        ['Período del mar de fondo', q.Tsw, 's', '', 1],
        ['<b>Mar de viento de la brisa</b>', '', ''],
        [`Viento a las ${horaTexto(r.hora)}`, q.U, 'm/s', '', 2],
        ['Altura del mar de viento', q.local.H, 'm', '', 2, 'SMB con el fetch de la bahía.'],
        ['Período del mar de viento', q.local.T, 's', '', 2],
        ['<b>Oleaje que llega</b>', '', ''],
        ['Altura significativa combinada', q.H0, 'm', q.H0 <= 2.5 ? 'ok' : 'aviso', 2, '√(H₁² + H₂²).'],
        ['Período ponderado por la energía', q.T, 's', '', 2],
        ['Longitud de onda en aguas profundas', q.L0, 'm', '', 1, 'g·T²/(2π).'],
        ['Altura significativa máxima del año', a.Hsmax, 'm', a.Hsmax <= 2.5 ? 'ok' : 'aviso', 2],
      ],
      ecuacion: [
        ecu.tipo('Hiperbólica y potencia: oleaje que levanta la brisa (método SMB)'),
        ecu.formula(`${i('g')}${i('H')}/${i('U')}² = 0.283·tanh[0.0125·(${i('g')}${i('F')}/${i('U')}²)<sup>0.42</sup>]`),
        ecu.sust(q.U > 0.1 ? `${i('g')}${i('F')}/${i('U')}² = 9.81 × ${miles(p.fetch * 1000)}/${fmt(q.U, 2)}² = ${miles((M.G * p.fetch * 1000) / (q.U * q.U))} → ${i('H')} = ${fmt(q.local.H, 3)} m` : 'Sin viento no hay mar de viento.'),
        ecu.tipo('Raíz cuadrada y decimales: los dos oleajes juntos'),
        ecu.formula(`${i('H')} = √(${sub('H', 'fondo')}² + ${sub('H', 'viento')}²),  ${i('T')} = (${sub('H', 'f')}²·${sub('T', 'f')} + ${sub('H', 'v')}²·${sub('T', 'v')})/${i('H')}²`),
        ecu.sust(`${i('H')} = √(${fmt(q.Hsw, 3)}² + ${fmt(q.local.H, 3)}²) = ${fmt(q.H0, 3)} m;  ${i('T')} = ${fmt(q.T, 2)} s`),
        ecu.tipo('Cuadrática: longitud de onda en aguas profundas'),
        ecu.formula(`${sub('L', '0')} = ${i('g')}·${i('T')}²/(2π) = 9.81 × ${fmt(q.T, 2)}²/(2π) = ${fmt(q.L0, 1)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Altura significativa (m)', formatoX: fmtMes, formatoY: (v) => fmt(v, 1), marcasX: MARCAS_MES,
          series: [serieLinea('Media del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.Hs })), c.agua), serieLinea('Máxima del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.Hsmax })), c.agua, { punteada: true, ancho: 1.5 }), serieLinea('Mar de fondo (temporada)', muestrear(sw, 1, 12, 60), c.tinta2, { punteada: true, ancho: 1 })],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'Con los alisios de diciembre a abril llega el oleaje más alto.' },
        { xTitulo: 'Velocidad del viento (m/s)', yTitulo: 'Altura del mar de viento (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea(`H(U) con F = ${fmt(p.fetch, 0)} km`, muestrear((U) => M.oleajeViento(U, p.fetch * 1000).H, 0.2, 25, 120), c.agua), serieLinea('F = 300 km', muestrear((U) => M.oleajeViento(U, 300000).H, 0.2, 25, 120), c.tinta2, { punteada: true, ancho: 1 }), seriePuntos('Ahora', [{ x: q.U, y: q.local.H }], c.ocre)],
          limites: { x: { min: 0, max: 25 }, y: { min: 0 } }, pie: 'Con un fetch corto el oleaje crece casi como U²; con uno largo crece más.' },
      ],
    };
  },

  rompiente({ p, r, c }) {
    const q = r.q;
    const hMax = Math.max(12, q.hb * 3);
    const Hh = muestrear((h) => M.transformar(q.H0, q.T, q.theta0, h).H, 0.3, hMax, 150);
    const xb = M.distanciaDean(q.hb, r.pr.A);
    const tb = M.transformar(q.H0, q.T, q.theta0, q.hb);
    return {
      metricas: [
        ['Ángulo del oleaje mar adentro', q.theta0, '°', '', 1, 'Mar de fondo y mar de viento, ponderados por su energía.'],
        ['Profundidad de rotura', q.hb, 'm', '', 2, 'Donde H(h) = 0.78·h.'],
        ['Altura de rotura', q.Hb, 'm', '', 2],
        ['Ángulo en la rotura', q.thetab, '°', '', 2, 'Snell: sin θ/C es constante.'],
        ['Coeficiente de asomeramiento K_s', tb.Ks, '', '', 3],
        ['Coeficiente de refracción K_r', tb.Kr, '', '', 3],
        ['Distancia de la rompiente a la orilla', xb, 'm', '', 0, '(h_b/A)^(3/2) con el perfil de Dean.'],
        ['Corriente a lo largo de la playa', Math.abs(q.V), 'm/s', Math.abs(q.V) <= 0.6 ? 'ok' : 'aviso', 3],
        ['Corriente máxima del año', r.a.Vmax, 'm/s', r.a.Vmax <= 0.6 ? 'ok' : 'aviso', 2],
      ],
      ecuacion: [
        ecu.tipo('Hiperbólica: dispersión de las olas'),
        ecu.formula(`${i('L')}(${i('h')}) ≈ ${sub('L', '0')}·tanh[(2π${i('h')}/${sub('L', '0')})<sup>3/4</sup>]<sup>2/3</sup>`),
        ecu.sust(`En la rotura: ${i('L')}(${fmt(q.hb, 2)}) = ${fmt(q.L0, 1)} × tanh[(2π × ${fmt(q.hb, 2)}/${fmt(q.L0, 1)})<sup>0.75</sup>]<sup>2/3</sup> = ${fmt(M.longitudOnda(q.T, q.hb), 1)} m`),
        ecu.tipo('Trigonométrica: refracción (ley de Snell)'),
        ecu.formula(`sin θ/${i('C')} = sin ${sub('θ', '0')}/${sub('C', '0')}`),
        ecu.sust(`sin ${sub('θ', 'b')} = sin ${fmt(q.theta0, 1)}° × ${fmt(tb.C, 2)}/${fmt(q.L0 / q.T, 2)} → ${sub('θ', 'b')} = ${fmt(q.thetab, 2)}°`),
        ecu.tipo('Lineal: criterio de rotura'),
        ecu.formula(`${sub('H', 'b')} = γ·${sub('h', 'b')} = 0.78 × ${fmt(q.hb, 2)} = ${fmt(q.Hb, 2)} m,  ${sub('H', 'b')} = ${sub('H', '0')}·${sub('K', 's')}·${sub('K', 'r')} = ${fmt(q.H0, 2)} × ${fmt(tb.Ks, 3)} × ${fmt(tb.Kr, 3)}`),
        ecu.tipo('Raíz cuadrada: corriente litoral (Longuet-Higgins)'),
        ecu.formula(`${i('V')} = 1.17·√(${i('g')}·${sub('H', 'b')})·sin ${sub('θ', 'b')}·cos ${sub('θ', 'b')} = 1.17 × √(9.81 × ${fmt(q.Hb, 2)}) × sin ${fmt(q.thetab, 2)}° × cos ${fmt(q.thetab, 2)}° = ${fmt(q.V, 3)} m/s`),
      ].join(''),
      graficas: [
        { xTitulo: 'Profundidad (m)', yTitulo: 'Altura de la ola (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('H(h) = H₀·K_s·K_r', Hh, c.agua), serieLinea('Rotura H = 0.78·h', [{ x: 0, y: 0 }, { x: hMax, y: 0.78 * hMax }], c.alerta, { punteada: true }), seriePuntos('Rotura', [{ x: q.hb, y: q.Hb }], c.ocre)],
          limites: { x: { min: 0, max: hMax, invertido: true }, y: { min: 0, max: Math.max(2, Math.ceil(q.Hb * 1.6)) } }, pie: 'La ola crece al llegar a la playa; rompe donde su curva corta la recta de rotura.' },
        { xTitulo: 'Profundidad (m)', yTitulo: 'Longitud de onda (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('L(h)', muestrear((h) => M.longitudOnda(q.T, h), 0.2, Math.max(60, q.L0 * 0.7), 150), c.agua), serieGuia('L₀ (aguas profundas)', { x: 0, y: q.L0 }, { x: Math.max(60, q.L0 * 0.7), y: q.L0 }, c.tinta2), seriePuntos('Rotura', [{ x: q.hb, y: M.longitudOnda(q.T, q.hb) }], c.ocre)],
          limites: { x: { min: 0, max: Math.max(60, q.L0 * 0.7) }, y: { min: 0 } }, pie: 'En aguas poco profundas la ola se acorta: la tangente hiperbólica tiende a L₀ mar adentro.' },
      ],
    };
  },

  nivel({ p, r, c }) {
    const t0 = r.t;
    const puntos = [];
    for (let k = 0; k <= 15 * 24; k += 2) {
      const f = S.forzantes(p, t0 + k * 3600, null);
      puntos.push({ x: k / 24, eta: f.eta + f.surge, twl: f.TWL });
    }
    const q = r.q;
    return {
      metricas: [
        ['Marea ahora', q.eta, 'm', '', 3],
        ['Sobreelevación de tormenta', q.surge, 'm', q.surge > 0 ? 'aviso' : '', 3, 'Presión baja + viento hacia la costa.'],
        ['Remonte del 2 % (Stockdon)', q.R2, 'm', '', 2],
        ['Nivel total ahora', q.TWL, 'm', q.TWL <= p.malecon - 0.3 ? 'ok' : 'alerta', 2],
        ['Margen bajo el malecón', p.malecon - q.TWL, 'm', p.malecon - q.TWL >= 0.3 ? 'ok' : 'alerta', 2],
        ['Nivel total máximo del año', r.a.TWLmax, 'm', r.a.TWLmax <= p.malecon - 0.3 ? 'ok' : 'alerta', 2],
        ['Horas del año con el mar sobre el malecón', r.a.horasInund, 'h', r.a.horasInund === 0 ? 'ok' : 'alerta', 0],
      ],
      ecuacion: [
        ecu.tipo('Periódica: marea'),
        ecu.formula(`η(${i('t')}) = Σ ${sub('a', 'i')}·cos(2π${i('t')}/${sub('T', 'i')} − ${sub('φ', 'i')}) = ${fmt(q.eta, 3)} m`),
        ecu.tipo('Lineal y cuadrática: sobreelevación de tormenta'),
        ecu.formula(`Δη = 0.01·(1013 − ${i('p')}) + ${sub('ρ', 'a')}${sub('C', 'D')}${i('U')}²${i('L')}/(ρ${i('g')}${i('h')})`),
        ecu.sust(r.torm ? `Δη = 0.01 × (1013 − ${miles(p.presionTormenta)}) + … = ${fmt(q.surge, 3)} m` : 'Sin tormenta: Δη = 0.'),
        ecu.tipo('Raíz cuadrada: remonte de las olas (Stockdon y otros, 2006)'),
        ecu.formula(`${sub('R', '2')} = 1.1·[0.35·β·√(${sub('H', '0')}${sub('L', '0')}) + √(${sub('H', '0')}${sub('L', '0')}·(0.563β² + 0.004))/2]`),
        ecu.sust(`${sub('R', '2')} = 1.1 × [0.35 × ${fmt(p.pendiente, 3)} × √(${fmt(q.H0, 2)} × ${fmt(q.L0, 1)}) + √(${fmt(q.H0 * q.L0, 1)} × ${fmt(0.563 * p.pendiente ** 2 + 0.004, 5)})/2] = ${fmt(q.R2, 3)} m`),
        ecu.tipo('Suma: nivel total'),
        ecu.formula(`nivel = η + Δη + ${sub('R', '2')} = ${fmt(q.eta, 3)} + ${fmt(q.surge, 3)} + ${fmt(q.R2, 3)} = ${fmt(q.TWL, 3)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Días desde ahora', yTitulo: 'Nivel (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('Marea y tormenta', puntos.map((x) => ({ x: x.x, y: x.eta })), c.agua), serieLinea('Nivel total (con el remonte)', puntos.map((x) => ({ x: x.x, y: x.twl })), c.ocre), serieGuia('Malecón', { x: 0, y: p.malecon }, { x: 15, y: p.malecon }, c.alerta)],
          limites: { x: { min: 0, max: 15 }, y: { min: Math.min(-0.5, ...puntos.map((x) => x.eta)) - 0.1, max: Math.max(p.malecon + 0.3, ...puntos.map((x) => x.twl)) } }, pie: 'Quince días: el remonte sube con la brisa de cada tarde y con el oleaje.' },
        { xTitulo: 'Altura del oleaje H₀ (m)', yTitulo: 'Remonte R2 (m)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 1),
          series: [serieLinea(`R2(H₀) con T = ${fmt(q.T, 1)} s`, muestrear((H) => M.remonte(H, q.T, p.pendiente), 0, 5, 100), c.agua), serieLinea('Con T = 12 s (mar de leva)', muestrear((H) => M.remonte(H, 12, p.pendiente), 0, 5, 100), c.tinta2, { punteada: true, ancho: 1 }), seriePuntos('Ahora', [{ x: q.H0, y: q.R2 }], c.ocre)],
          limites: { x: { min: 0, max: 5 }, y: { min: 0 } }, pie: 'El remonte crece como la raíz de H₀·L₀: las olas largas del mar de leva suben más.' },
      ],
    };
  },

  perfil({ p, r, c }) {
    const pr = r.pr;
    const xMax = Math.ceil(pr.xc * 1.25 / 50) * 50;
    const hb = r.q.hb;
    const As = (D) => M.parametroDean(100 * M.velocidadCaida(D / 1000));
    const filas = [0.1, 0.2, 0.3, 0.5, 1].map((D) => { const w = M.velocidadCaida(D / 1000); const A = M.parametroDean(100 * w); return [`${fmt(D, 2)} mm`, `${fmt(100 * w, 2)} cm/s`, fmt(A, 3), `${miles(M.distanciaDean(pr.hc, A))} m`]; });
    return {
      metricas: [
        ['Velocidad de caída de la arena', 100 * pr.w, 'cm/s', '', 2, 'Ferguson y Church.'],
        ['Parámetro de Dean A', pr.A, 'm^(1/3)', '', 4, '0.067·w^0.44.'],
        ['Profundidad de cierre', pr.hc, 'm', '', 2, 'Hallermeier.'],
        ['Ancho del perfil activo', pr.xc, 'm', '', 0, '(h_c/A)^(3/2).'],
        ['Pendiente media del perfil activo', pr.pendienteActiva, '', '', 4],
        ['Ancho de playa seca', r.W, 'm', r.W >= p.anchoMin ? 'ok' : 'alerta', 1],
        ['Bañistas que caben', r.capacidad, '', '', 0, 'W·L/(área por bañista).'],
        ['Ocupación en un día de temporada', 100 * r.ocupacion, '%', r.ocupacion <= 1 ? 'ok' : 'aviso', 0],
      ],
      tablas: tablaHTML('La arena hace el perfil', ['Arena', 'Caída', 'A (m^1/3)', 'Ancho activo'], filas, { numericas: [1, 2, 3], nota: `Con la misma profundidad de cierre (${fmt(pr.hc, 2)} m): la arena gruesa hace perfiles más cortos y empinados.` }),
      ecuacion: [
        ecu.tipo('Racional con raíz: velocidad de caída (Ferguson y Church)'),
        ecu.formula(`${i('w')} = ${i('R')}${i('g')}${i('D')}²/(18ν + √(0.75·${i('R')}${i('g')}${i('D')}³))`),
        ecu.sust(`${i('w')} = 1.65 × 9.81 × (${fmt(p.D50 / 1000, 5)})²/(18·10⁻⁶ + √(0.75 × 1.65 × 9.81 × (${fmt(p.D50 / 1000, 5)})³)) = ${fmt(pr.w, 4)} m/s`),
        ecu.tipo('Función potencia: perfil de equilibrio de Dean'),
        ecu.formula(`${i('h')}(${i('x')}) = ${i('A')}·${i('x')}<sup>2/3</sup>,  ${i('A')} = 0.067·${i('w')}<sup>0.44</sup> = 0.067 × ${fmt(100 * pr.w, 2)}<sup>0.44</sup> = ${fmt(pr.A, 4)}`),
        ecu.tipo('Cuadrática: profundidad de cierre (Hallermeier)'),
        ecu.formula(`${sub('h', 'c')} = 2.28·${sub('H', 'e')} − 68.5·${sub('H', 'e')}²/(${i('g')}${sub('T', 'e')}²) = 2.28 × ${fmt(p.He, 1)} − 68.5 × ${fmt(p.He, 1)}²/(9.81 × ${fmt(p.Te, 1)}²) = ${fmt(pr.hc, 3)} m`),
        ecu.tipo('Inversa de la potencia: ancho activo'),
        ecu.formula(`${sub('x', 'c')} = (${sub('h', 'c')}/${i('A')})<sup>3/2</sup> = (${fmt(pr.hc, 3)}/${fmt(pr.A, 4)})<sup>1.5</sup> = ${fmt(pr.xc, 1)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Distancia desde la orilla (m)', yTitulo: 'Cota (m)', formatoX: (v) => miles(v), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Perfil de Dean −A·x^(2/3)', muestrear((x) => -M.perfilDean(x, pr.A), 0, xMax, 160), c.ocre), serieLinea('Playa seca y berma', [{ x: -r.W, y: p.berma }, { x: 0, y: p.berma * 0.15 }, { x: 0, y: 0 }], c.ocre, { ancho: 1.5 }), serieGuia('Nivel del mar', { x: -r.W, y: 0 }, { x: xMax, y: 0 }, c.agua), serieGuia('Profundidad de cierre', { x: 0, y: -pr.hc }, { x: xMax, y: -pr.hc }, c.tinta2), seriePuntos('Rompiente', [{ x: M.distanciaDean(hb, pr.A), y: -hb }], c.alerta)],
          limites: { x: { min: -Math.max(10, r.W), max: xMax }, y: { min: -Math.ceil(pr.hc + 1), max: Math.ceil(p.berma + 0.5) } }, pie: 'La playa seca a la izquierda; bajo el agua, el perfil de equilibrio hasta la profundidad de cierre.' },
        { xTitulo: 'Diámetro de la arena (mm)', yTitulo: 'A (m^1/3)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('A(D) con w de Ferguson y Church', muestrear(As, 0.06, 2, 160), c.ocre), seriePuntos('Arena de la playa', [{ x: p.D50, y: pr.A }], c.agua)],
          limites: { x: { min: 0, max: 2 }, y: { min: 0 } }, pie: 'Con arena más gruesa el perfil es más empinado (A más grande).' },
      ],
    };
  },

  arena({ p, r, c }) {
    const a = r.a;
    const v = r.v;
    const tMax = 50;
    const anoVacio = Number.isFinite(r.anosMin) ? r.anosMin : null;
    return {
      metricas: [
        ['Transporte a lo largo de la playa ahora', r.q.Qls * 86400, 'm³/día', '', 0, 'CERC con la ola de rotura.'],
        ['Arena que llega en el año', a.Qin * M.SEG_ANO / 1000, 'miles de m³', '', 1],
        ['Arena que sale en el año', a.Qout * M.SEG_ANO / 1000, 'miles de m³', '', 1, 'Transporte por (1 − retención).'],
        ['Balance de arena', a.balance / 1000, 'miles de m³/año', a.balance >= 0 ? 'ok' : 'alerta', 1],
        ['Cambio del ancho (arena y ascenso del mar)', v, 'm/año', v >= 0 ? 'ok' : 'alerta', 2],
        ['Ancho de playa ahora', r.W, 'm', r.W >= p.anchoMin ? 'ok' : 'alerta', 2],
        ['Ancho de playa en 50 años', r.W50, 'm', r.W50 >= p.anchoMin ? 'ok' : 'alerta', 1],
        ['Años hasta el ancho mínimo', Number.isFinite(r.anosMin) ? r.anosMin : 'no llega', Number.isFinite(r.anosMin) ? 'años' : '', Number.isFinite(r.anosMin) ? 'alerta' : 'ok', 0],
      ],
      tablas: tablaHTML('La arena en el año', ['Mes', 'Altura de rotura (m)', 'Ángulo (°)', 'Sale (m³/día)', 'Ancho (m)'], a.meses.map((m) => [m.mes, fmt(m.Hb, 2), fmt(m.thetab, 2), miles(m.Qout * 86400), fmt(m.W, 2)]), { numericas: [1, 2, 3, 4], nota: `Llegan ${miles((a.Qin * 86400))} m³/día de arena todo el año; con los alisios sale más de la que llega y en la temporada tranquila se recupera.` }),
      ecuacion: [
        ecu.tipo('Potencia 5/2 y trigonométrica: transporte litoral (CERC)'),
        ecu.formula(`${i('Q')} = 0.39·√(${i('g')}/0.78)·${sub('H', 'b')}<sup>5/2</sup>·sin(2${sub('θ', 'b')})/(16 × 1.65 × 0.6)`),
        ecu.sust(`${i('Q')} = 0.39 × 3.546 × ${fmt(r.q.Hb, 2)}<sup>2.5</sup> × sin(${fmt(2 * r.q.thetab, 2)}°)/15.84 = ${fmt(r.q.Qls, 4)} m³/s = ${miles(r.q.Qls * 86400)} m³/día`),
        ecu.tipo('Lineal: el ancho de la playa con el balance de arena'),
        ecu.formula(`d${i('W')}/d${i('t')} = (${sub('Q', 'entra')} − ${sub('Q', 'sale')})/(${i('L')}·(${i('B')} + ${sub('h', 'c')})) − tasa de Bruun`),
        ecu.sust(`d${i('W')}/d${i('t')} = ${miles(a.balance)} m³/año/(${miles(p.largo)} × (${fmt(p.berma, 2)} + ${fmt(r.pr.hc, 2)})) − ${fmt(a.bruun, 3)} = ${fmt(v, 2)} m/año`),
        ecu.tipo('Lineal y racional: el ancho en el tiempo'),
        ecu.formula(`${i('W')}(${i('t')}) = ${sub('W', '0')} + ${i('v')}·${i('t')};  años hasta ${sub('W', 'mín')}: ${i('t')} = (${sub('W', '0')} − ${sub('W', 'mín')})/(−${i('v')})`),
        ecu.sust(Number.isFinite(r.anosMin) ? `${i('t')} = (${fmt(r.W, 1)} − ${fmt(p.anchoMin, 0)})/${fmt(-v, 2)} = ${fmt(r.anosMin, 0)} años` : 'La playa no se adelgaza: no llega al ancho mínimo.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Arena (m³/día)', formatoX: fmtMes, formatoY: (x) => miles(x), marcasX: MARCAS_MES,
          series: [serieLinea('Sale con el oleaje', a.meses.map((m, k) => ({ x: k + 1, y: m.Qout * 86400 })), c.agua), serieGuia('Llega de los ríos y la playa vecina', { x: 1, y: a.Qin * 86400 }, { x: 12, y: a.Qin * 86400 }, c.ocre)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'Donde la curva pasa la línea, la playa pierde arena.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Ancho de playa seca (m)', formatoX: (x) => fmt(x, 0), formatoY: (x) => fmt(x, 0),
          series: [serieLinea('W(t) = W₀ + v·t', muestrear((t) => Math.max(0, r.W + v * t), 0, tMax, 60), v >= 0 ? c.ok : c.alerta), serieGuia('Ancho mínimo', { x: 0, y: p.anchoMin }, { x: tMax, y: p.anchoMin }, c.alerta), ...(anoVacio !== null && anoVacio <= tMax ? [seriePuntos('Llega al mínimo', [{ x: anoVacio, y: p.anchoMin }], c.alerta)] : [])],
          limites: { x: { min: 0, max: tMax }, y: { min: 0 } }, pie: 'Una recta: la pendiente es el cambio del ancho en un año.' },
      ],
    };
  },

  mar({ p, r, c }) {
    const pr = r.pr;
    const S50 = (p.ascensoMar / 1000) * 50;
    const tasa = M.bruun(p.ascensoMar / 1000, pr.xc, p.berma, pr.hc);
    const retiro = M.bruun((p.ascensoMar / 1000) * 100, pr.xc, p.berma, pr.hc) + 10;
    return {
      metricas: [
        ['Ascenso del mar en 50 años', S50, 'm', '', 3],
        ['Ancho del perfil activo', pr.xc, 'm', '', 0],
        ['Altura del perfil activo B + h_c', p.berma + pr.hc, 'm', '', 2],
        ['Retroceso por cada metro que sube el mar', M.bruun(1, pr.xc, p.berma, pr.hc), 'm/m', '', 1, 'x_c/(B + h_c).'],
        ['Retroceso en un año', tasa, 'm/año', '', 3],
        ['Retroceso en 50 años', r.bruun50, 'm', r.bruun50 <= 0.25 * p.ancho0 ? 'ok' : 'aviso', 2],
        ['Parte del ancho de playa de hoy', (100 * r.bruun50) / Math.max(1, p.ancho0), '%', '', 0],
        ['Línea de retiro sugerida (100 años + 10 m)', retiro, 'm', '', 0, 'Distancia mínima de la orilla de hoy a las construcciones nuevas, además de la playa.'],
      ],
      ecuacion: [
        ecu.tipo('Racional: regla de Bruun'),
        ecu.formula(`${i('R')} = ${i('S')}·${sub('x', 'c')}/(${i('B')} + ${sub('h', 'c')})`),
        ecu.sust(`${i('R')} = ${fmt(S50, 3)} × ${fmt(pr.xc, 1)}/(${fmt(p.berma, 2)} + ${fmt(pr.hc, 2)}) = ${fmt(r.bruun50, 2)} m en 50 años`),
        ecu.nota(`Cada centímetro que sube el mar hace retroceder la orilla ${fmt(M.bruun(0.01, pr.xc, p.berma, pr.hc), 2)} m: el perfil es ${fmt(pr.xc / (p.berma + pr.hc), 0)} veces más largo que alto.`),
      ].join(''),
      graficas: [
        { xTitulo: 'Ascenso del mar S (m)', yTitulo: 'Retroceso de la orilla (m)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('R = S·x_c/(B + h_c)', [{ x: 0, y: 0 }, { x: 1, y: M.bruun(1, pr.xc, p.berma, pr.hc) }], c.agua), serieGuia('Ancho de playa de hoy', { x: 0, y: p.ancho0 }, { x: 1, y: p.ancho0 }, c.alerta), seriePuntos('En 50 años', [{ x: S50, y: r.bruun50 }], c.ocre)],
          limites: { x: { min: 0, max: 1 }, y: { min: 0 } }, pie: 'Con el perfil fijo, el retroceso es proporcional al ascenso del mar.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Retroceso (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea(`${fmt(p.ascensoMar, 1)} mm/año`, [{ x: 0, y: 0 }, { x: 100, y: 100 * tasa }], c.agua), serieLinea('10 mm/año', [{ x: 0, y: 0 }, { x: 100, y: 100 * M.bruun(0.01, pr.xc, p.berma, pr.hc) }], c.tinta2, { punteada: true, ancho: 1 }), serieGuia('Ancho de playa de hoy', { x: 0, y: p.ancho0 }, { x: 100, y: p.ancho0 }, c.alerta)],
          limites: { x: { min: 0, max: 100 }, y: { min: 0 } }, pie: 'Si el mar se acelera, la playa se queda sin espacio en pocas décadas.' },
      ],
    };
  },

  calidad({ p, r, c }) {
    const col = r.col;
    const dia = [];
    for (let h = 0; h <= 24; h += 0.25) dia.push({ x: h, y: Math.max(0.1, S.coliformes(p, Math.floor(r.t / 86400) * 86400 + h * 3600).C) });
    const dist = muestrear((x) => Math.max(0.1, S.coliformes({ ...p, xEmisario: x }, Math.floor(r.t / 86400) * 86400 + 13 * 3600).C), 0.3, 8, 120);
    return {
      metricas: [
        ['Dilución inicial de la pluma', col.S1, 'veces', '', 1, '0.089·g\'^(1/3)·z^(5/3)/Q^(2/3).'],
        ['Dilución total al llegar a la playa', col.S, 'veces', col.S >= 100 ? 'ok' : 'aviso', 0, 'S₁·(1 + x/L_d).'],
        ['Tiempo de viaje hasta la playa', col.tv / 3600, 'h', '', 2, 'x/u.'],
        [`T90 a las ${horaTexto(r.hora)}`, M.t90Hora(r.hora, p.T90dia, p.T90noche), 'h', '', 1],
        ['Exponente de la muerte en el viaje', col.exponente, '', '', 3, 'Σ Δt/T90.'],
        ['Coliformes en la playa ahora', col.C, 'NMP/100 mL', nivelColi(col.C), 0],
        ['Máximo en horas de baño (8:00 a 17:00)', r.Cmax, 'NMP/100 mL', nivelColi(r.Cmax), 0],
      ],
      ecuacion: [
        ecu.tipo('Potencia: dilución inicial de la pluma'),
        ecu.formula(`${sub('S', '1')} = 0.089·${i("g'")}<sup>1/3</sup>·${i('z')}<sup>5/3</sup>/${i('Q')}<sup>2/3</sup>`),
        ecu.sust(`${sub('S', '1')} = 0.089 × ${fmt(S.SITIO.gpEmisario, 3)}<sup>1/3</sup> × ${fmt(p.zEmisario, 0)}<sup>5/3</sup>/${fmt(p.Qemisario, 2)}<sup>2/3</sup> = ${fmt(col.S1, 1)};  ${i('S')} = ${fmt(col.S1, 1)} × (1 + ${miles(p.xEmisario * 1000)}/${miles(p.Ld)}) = ${miles(col.S)}`),
        ecu.tipo('Exponencial y logarítmica: muerte de las bacterias'),
        ecu.formula(`${i('C')} = (${sub('C', '0')}/${i('S')})·10<sup>−Σ Δ${i('t')}/T90</sup>;  en horas con T90 fijo: ${i('t')} = T90·log₁₀(${sub('C', 'inicial')}/${i('C')})`),
        ecu.sust(`${i('C')} = (${miles(p.C0)}/${miles(col.S)}) × 10<sup>−${fmt(col.exponente, 3)}</sup> = ${miles(col.C)} NMP/100 mL`),
        ecu.tipo('Periódica: el sol mata las bacterias'),
        ecu.formula(`T90(${i('h')}) = ${sub('T90', 'noche')} − (${sub('T90', 'noche')} − ${sub('T90', 'día')})·máx(0, sin(π(${i('h')} − 6)/12))`),
      ].join(''),
      graficas: [
        { xTitulo: 'Hora del día', yTitulo: 'Coliformes (NMP/100 mL)', formatoX: (v) => `${fmt(v, 0)} h`, formatoY: (v) => miles(v), marcasX: [0, 3, 6, 9, 12, 15, 18, 21, 24], logY: true,
          series: [serieLinea('En la playa', dia, c.ocre), serieGuia('Límite para bañarse (200)', { x: 0, y: 200 }, { x: 24, y: 200 }, c.alerta), seriePuntos('Ahora', [{ x: r.hora, y: Math.max(0.1, col.C) }], c.agua)],
          limites: { x: { min: 0, max: 24 } }, pie: 'De noche las bacterias viven más: el agua que llega en la mañana trae más.' },
        { xTitulo: 'Distancia del emisario a la playa (km)', yTitulo: 'Coliformes a las 13:00 (NMP/100 mL)', formatoX: (v) => fmt(v, 0), formatoY: (v) => miles(v), logY: true,
          series: [serieLinea('C(x)', dist, c.ocre), serieGuia('Límite (200)', { x: 0.3, y: 200 }, { x: 8, y: 200 }, c.alerta), seriePuntos('Emisario de hoy', [{ x: p.xEmisario, y: Math.max(0.1, S.coliformes(p, Math.floor(r.t / 86400) * 86400 + 13 * 3600).C) }], c.agua)],
          limites: { x: { min: 0, max: 8 } }, pie: 'Más lejos: más dilución y más tiempo para que el sol mate las bacterias.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'costas',
  tabInicial: 'oleaje',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Costas',
  tabs: TABS,
  controles: CONTROLES,
  PARAMETROS: S.PARAMETROS,
  escenarios: S.ESCENARIOS,
  estadoInicial: S.estadoInicial,
  avanzar: S.avanzar,
  calcular: S.calcular,
  pasoMaximo: 3600,
  reloj: {
    tipo: 'dias', inicio: 6 * 3600,
    velocidades: [{ valor: 600, nombre: '10 min por segundo' }, { valor: 3600, nombre: '1 h por segundo' }, { valor: 21600, nombre: '6 h por segundo' }, { valor: 86400, nombre: '1 día por segundo' }, { valor: 2592000, nombre: '30 días por segundo' }],
    defecto: 3600,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 3600, nombre: '1 h' }, { valor: 21600, nombre: '6 h' }, { valor: 86400, nombre: '1 día' }],
    intervaloDefecto: 3600,
    columnas: [
      { clave: 'H0', nombre: 'Altura significativa', unidad: 'm', dec: 2 },
      { clave: 'Hb', nombre: 'Altura de rotura', unidad: 'm', dec: 2 },
      { clave: 'V', nombre: 'Corriente litoral', unidad: 'm/s', dec: 3 },
      { clave: 'TWL', nombre: 'Nivel total', unidad: 'm', dec: 3 },
      { clave: 'W', nombre: 'Ancho de playa', unidad: 'm', dec: 3 },
      { clave: 'C', nombre: 'Coliformes en la playa', unidad: 'NMP/100 mL', dec: 0 },
    ],
    tomar: (p, r) => ({ H0: r.q.H0, Hb: r.q.Hb, V: r.q.V, TWL: r.q.TWL, W: r.W, C: r.col.C }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'playa', nombre: 'Playa', titulo: 'La bahía, la playa y el malecón' },
    { id: 'rompiente', nombre: 'Rompiente', titulo: 'Las olas rompen y empujan la arena' },
    { id: 'perfil', nombre: 'Perfil', titulo: 'Corte de la playa: el perfil de equilibrio' },
    { id: 'emisario', nombre: 'Emisario', titulo: 'El emisario submarino y su pluma' },
  ],
});
