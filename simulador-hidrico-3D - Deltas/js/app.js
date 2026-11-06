/**
 * app.js — Simulador de deltas: pestañas, controles, resultados, ecuaciones con valores
 * sustituidos y gráficas. El controlador común está en nucleo/app-base.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';
import * as N from './nodo.js';
import { Escena } from './escena3d.js';
import { hojasExcel } from './hojas.js';
import { iniciarSimulador, ecu, i, sub, tablaHTML } from './nucleo/app-base.js';
import { fmt, miles, MESES, muestrear, techoRedondo, conSigno } from './nucleo/formato.js';
import { serieLinea, seriePuntos, serieGuia } from './nucleo/graficas.js';

const opciones = (obj) => Object.entries(obj).map(([valor, o]) => ({ valor, nombre: o.nombre }));
const MARCAS_MES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fmtMes = (v) => MESES[Math.round(v) - 1] ?? '';
const km = (m) => m / 1000;

const TABS = [
  { id: 'rio', nombre: 'Río y sedimento', graficas: 2, tablas: true, intro: 'El Magdalena es el río más caudaloso del Caribe colombiano: lleva en promedio unos 7 200 m³/s y cerca de 140 millones de toneladas de sedimento al año. Su caudal sube dos veces: una creciente pequeña a mitad de año y la grande en octubre y noviembre; baja en febrero, marzo y abril. Cuanto más caudal, más turbia el agua: la carga de sedimento crece más rápido que el caudal.' },
  { id: 'canales', nombre: 'Brazos del delta', graficas: 2, intro: 'Antes de llegar al mar el río se reparte. El Canal del Dique se lleva una parte del agua y del sedimento hacia la bahía de Cartagena; el resto sale por Bocas de Ceniza. El reparto depende de lo ancho, lo hondo, lo áspero y lo inclinado de cada brazo. Con los años el río levanta su propio cauce sobre la llanura y puede cambiar de camino de golpe: una avulsión.' },
  { id: 'cuna', nombre: 'Cuña salina', graficas: 2, intro: 'El agua de mar es más densa que la del río y entra por el fondo del canal como una cuña, mientras el agua dulce sale por encima. Con mucho caudal el río la empuja hacia afuera; en la sequía la cuña avanza río arriba y puede llegar a la toma del acueducto. El número de Froude densimétrico compara la velocidad del río con la de una onda en la interfaz entre las dos aguas.' },
  { id: 'pluma', nombre: 'Pluma', graficas: 2, intro: 'Al salir al mar, el agua turbia del río flota sobre el agua salada y forma una pluma café que se ve desde el espacio. Mientras avanza, el sedimento cae y el agua se aclara: la concentración baja como una exponencial. Las corrientes la llevan hacia el occidente, hacia las playas de Puerto Colombia.' },
  { id: 'avance', nombre: 'Avance del delta', graficas: 2, intro: 'Parte del sedimento se queda frente a la boca y hace crecer el delta mar adentro; el oleaje se lleva otra parte a lo largo de la costa. Al mismo tiempo la llanura del delta se hunde (subsidencia) y el mar sube: si el río no la rellena, el mar la alcanza.' },
  { id: 'oleaje', nombre: 'Oleaje', graficas: 2, intro: 'Las olas que rompen en ángulo con la costa arrastran la arena a lo largo de la playa. Si el río trae más sedimento del que el oleaje puede llevarse, el delta sale al mar como una nariz (dominado por el río); si no, el delta se alisa (dominado por el oleaje). En costas con mareas grandes, la marea manda.' },
  { id: 'dragado', nombre: 'Canal y dragado', graficas: 2, tablas: true, intro: 'Los buques que entran al puerto de Barranquilla necesitan un calado mínimo. El canal entre los tajamares se ahonda con la creciente y se llena en la sequía, hasta la profundidad con la que la velocidad del río deja de mover el fondo. Cuando no alcanza el calado, la draga lo devuelve a la profundidad de diseño.' },
];

const CONTROLES = [
  { tab: 'rio', grupo: 'Escenario' },
  { tab: 'rio', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio: El Niño, La Niña, el Canal del Dique ampliado o con compuertas, las represas, la deforestación, sin dragado, más oleaje o el ascenso del mar.' },
  { tab: 'rio', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS),
    extra: (v) => `Caudal del año × ${fmt(S.CLIMAS[v].fQ, 2)}.`, doc: 'Multiplica el caudal de todo el año.' },
  { tab: 'rio', grupo: 'Caudal del río' },
  { tab: 'rio', id: 'Qm', clave: 'Qm', etiqueta: 'Caudal medio del río', unidad: 'm³/s', min: 500, max: 20000, paso: 100, dec: 0, doc: 'Q̄ de la serie de Fourier y referencia de la curva de sedimento.' },
  { tab: 'rio', id: 'A1', clave: 'A1', etiqueta: 'Creciente principal (amplitud anual, fracción de Q̄)', unidad: '', min: 0, max: 0.8, paso: 0.01, dec: 2, doc: 'A₁, con el máximo a mediados de noviembre.' },
  { tab: 'rio', id: 'A2', clave: 'A2', etiqueta: 'Creciente de mitad de año (amplitud semestral)', unidad: '', min: 0, max: 0.4, paso: 0.01, dec: 2, doc: 'A₂, con máximos en junio y diciembre.' },
  { tab: 'rio', grupo: 'Sedimento' },
  { tab: 'rio', id: 'C0', clave: 'C0', etiqueta: 'Sedimento con el caudal medio', unidad: 'mg/L', min: 20, max: 2000, paso: 10, dec: 0, doc: 'C₀ de la curva de sedimento.' },
  { tab: 'rio', id: 'bSed', clave: 'bSed', etiqueta: 'Exponente de la curva de carga', unidad: '', min: 1, max: 2.5, paso: 0.05, dec: 2, doc: 'La carga Q·C crece como Q^b.' },

  { tab: 'canales', grupo: 'Canal del Dique' },
  { tab: 'canales', id: 'anchoDique', clave: 'anchoDique', etiqueta: 'Ancho del Canal del Dique', unidad: 'm', min: 20, max: 400, paso: 5, dec: 0 },
  { tab: 'canales', id: 'profDique', clave: 'profDique', etiqueta: 'Profundidad del Canal del Dique', unidad: 'm', min: 1, max: 12, paso: 0.1, dec: 1 },
  { tab: 'canales', id: 'nDique', clave: 'nDique', etiqueta: 'Rugosidad de Manning del Dique', unidad: '', min: 0.015, max: 0.06, paso: 0.001, dec: 3 },
  { tab: 'canales', id: 'aperturaDique', clave: 'aperturaDique', etiqueta: 'Apertura de las compuertas del Dique', unidad: '', min: 0, max: 1, paso: 0.05, dec: 2, doc: '1 = sin compuertas; 0 = cerrado.' },
  { tab: 'canales', grupo: 'El cauce principal y la avulsión' },
  { tab: 'canales', id: 'anchoRio', clave: 'anchoRio', etiqueta: 'Ancho del cauce principal', unidad: 'm', min: 200, max: 2000, paso: 10, dec: 0 },
  { tab: 'canales', id: 'profRio', clave: 'profRio', etiqueta: 'Profundidad del cauce principal', unidad: 'm', min: 2, max: 20, paso: 0.1, dec: 1 },
  { tab: 'canales', id: 'sobreelevacion', clave: 'sobreelevacion', etiqueta: 'Altura del fondo del cauce sobre la llanura', unidad: 'm', min: 0, max: 10, paso: 0.1, dec: 1, doc: 'Sobreelevación de hoy.' },
  { tab: 'canales', id: 'agradacion', clave: 'agradacion', etiqueta: 'Agradación del cauce', unidad: 'mm/año', min: 0, max: 100, paso: 1, dec: 0, doc: 'Cuánto sube el fondo cada año con el sedimento que deja.' },

  { tab: 'cuna', grupo: 'Agua de mar y toma de agua' },
  { tab: 'cuna', id: 'Smar', clave: 'Smar', etiqueta: 'Salinidad del mar', unidad: 'PSU', min: 20, max: 40, paso: 0.1, dec: 1 },
  { tab: 'cuna', id: 'Ci', clave: 'Ci', etiqueta: 'Coeficiente de fricción en la interfaz', unidad: '', min: 0.0001, max: 0.002, paso: 0.00005, dec: 5, doc: 'C_i: cuanto más pequeño, más larga la cuña.' },
  { tab: 'cuna', id: 'xToma', clave: 'xToma', etiqueta: 'Distancia de la bocatoma del acueducto a la boca', unidad: 'km', min: 0.5, max: 40, paso: 0.5, dec: 1 },

  { tab: 'pluma', grupo: 'Pluma del río' },
  { tab: 'pluma', id: 'hPluma', clave: 'hPluma', etiqueta: 'Espesor de la pluma', unidad: 'm', min: 0.5, max: 10, paso: 0.1, dec: 1 },
  { tab: 'pluma', id: 'wsPluma', clave: 'wsPluma', etiqueta: 'Velocidad de caída del lodo (floculado)', unidad: 'mm/s', min: 0.05, max: 3, paso: 0.05, dec: 2 },
  { tab: 'pluma', id: 'Cvis', clave: 'Cvis', etiqueta: 'Concentración con la que el agua se ve turbia', unidad: 'mg/L', min: 2, max: 100, paso: 1, dec: 0 },
  { tab: 'pluma', id: 'Qcienaga', clave: 'Qcienaga', etiqueta: 'Agua de la ciénaga por la Boca de la Barra', unidad: 'm³/s', min: 0, max: 1000, paso: 5, dec: 0, doc: 'Una pluma pequeña al oriente (la del simulador de ciénagas).' },

  { tab: 'avance', grupo: 'Frente del delta' },
  { tab: 'avance', id: 'fRetencion', clave: 'fRetencion', etiqueta: 'Parte del sedimento que se queda en el frente', unidad: '', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'avance', id: 'anchoFrente', clave: 'anchoFrente', etiqueta: 'Ancho del frente del delta', unidad: 'km', min: 1, max: 50, paso: 0.5, dec: 1 },
  { tab: 'avance', id: 'profFrente', clave: 'profFrente', etiqueta: 'Profundidad al pie del frente', unidad: 'm', min: 5, max: 150, paso: 1, dec: 0 },
  { tab: 'avance', id: 'radioLobulo', clave: 'radioLobulo', etiqueta: 'Radio del lóbulo de hoy', unidad: 'km', min: 1, max: 30, paso: 0.5, dec: 1 },
  { tab: 'avance', grupo: 'El mar sube y la llanura se hunde' },
  { tab: 'avance', id: 'cotaLlanura', clave: 'cotaLlanura', etiqueta: 'Cota de la llanura del delta', unidad: 'm.s.n.m.', min: 0.2, max: 5, paso: 0.05, dec: 2 },
  { tab: 'avance', id: 'subsidencia', clave: 'subsidencia', etiqueta: 'Subsidencia', unidad: 'mm/año', min: 0, max: 30, paso: 0.5, dec: 1 },
  { tab: 'avance', id: 'ascensoMar', clave: 'ascensoMar', etiqueta: 'Ascenso del nivel del mar', unidad: 'mm/año', min: 0, max: 20, paso: 0.1, dec: 1 },

  { tab: 'oleaje', grupo: 'Oleaje y marea' },
  { tab: 'oleaje', id: 'Hs', clave: 'Hs', etiqueta: 'Altura significativa en aguas profundas', unidad: 'm', min: 0.2, max: 5, paso: 0.05, dec: 2 },
  { tab: 'oleaje', id: 'Tp', clave: 'Tp', etiqueta: 'Período del oleaje', unidad: 's', min: 3, max: 16, paso: 0.5, dec: 1 },
  { tab: 'oleaje', id: 'anguloOla', clave: 'anguloOla', etiqueta: 'Ángulo de las olas con la normal a la costa', unidad: '°', min: 0, max: 90, paso: 1, dec: 0 },
  { tab: 'oleaje', id: 'rangoMarea', clave: 'rangoMarea', etiqueta: 'Rango de la marea', unidad: 'm', min: 0, max: 10, paso: 0.05, dec: 2 },

  { tab: 'dragado', grupo: 'Canal de acceso entre los tajamares' },
  { tab: 'dragado', id: 'anchoCanal', clave: 'anchoCanal', etiqueta: 'Ancho del canal', unidad: 'm', min: 100, max: 1000, paso: 10, dec: 0 },
  { tab: 'dragado', id: 'largoCanal', clave: 'largoCanal', etiqueta: 'Largo del tramo que se draga', unidad: 'm', min: 500, max: 10000, paso: 100, dec: 0 },
  { tab: 'dragado', id: 'calado', clave: 'calado', etiqueta: 'Calado que piden los buques', unidad: 'm', min: 4, max: 16, paso: 0.1, dec: 1 },
  { tab: 'dragado', id: 'dragadoAuto', clave: 'dragadoAuto', etiqueta: 'Dragar cuando el canal no alcance el calado', tipo: 'casilla' },
  { tab: 'dragado', id: 'dragarYa', etiqueta: 'Dragar ahora', tipo: 'accion', accion: (p, sim) => { const o = p.calado + S.SITIO.margenDragado; if (sim.h < o) { sim.dragado += (o - sim.h) * p.anchoCanal * p.largoCanal; sim.h = o; } },
    doc: 'Devuelve el canal al calado de diseño más 0.5 m.' },
  { tab: 'dragado', grupo: 'Fondo del canal' },
  { tab: 'dragado', id: 'Uc', clave: 'Uc', etiqueta: 'Velocidad con la que el fondo ni se llena ni se ahonda', unidad: 'm/s', min: 0.4, max: 2.5, paso: 0.05, dec: 2 },
  { tab: 'dragado', id: 'tauCanal', clave: 'tauCanal', etiqueta: 'Tiempo de ajuste del fondo', unidad: 'días', min: 5, max: 365, paso: 5, dec: 0 },
  { tab: 'dragado', id: 'profMaxCanal', clave: 'profMaxCanal', etiqueta: 'Profundidad máxima (fondo duro)', unidad: 'm', min: 5, max: 30, paso: 0.5, dec: 1 },
];

function estados(p, r) {
  const L = km(r.L), x = p.xToma;
  return [
    { id: 'cuna', nombre: 'Cuña salina', nivel: r.L < 0.75 * x * 1000 ? 'ok' : (r.L < x * 1000 ? 'aviso' : 'alerta'), texto: `Cuña salina: ${fmt(L, 2)} km (toma a ${fmt(x, 1)} km)` },
    { id: 'rio', nombre: 'Río', nivel: 'ok', texto: `Río: ${miles(r.q.Q)} m³/s con ${miles(r.q.C)} mg/L` },
    { id: 'canal', nombre: 'Canal', nivel: r.h >= p.calado - 1e-9 ? 'ok' : 'alerta', texto: `Canal: ${fmt(r.h, 2)} m (calado ${fmt(p.calado, 1)} m)` },
    { id: 'delta', nombre: 'Delta', nivel: r.de.Vneto >= 0 ? 'ok' : 'alerta', texto: `Delta: ${conSigno(r.de.avance, 1)} m/año, ${r.de.tipo}` },
    { id: 'mar', nombre: 'Mar', nivel: r.de.anosMar > 100 ? 'ok' : 'alerta', texto: `Llanura sobre el mar por ${fmt(Math.min(9999, r.de.anosMar), 0)} años` },
  ];
}

const PINTORES = {
  rio({ p, r, c }) {
    const cl = S.clima(p);
    const Qd = (d) => M.caudalRio(d, p.Qm * cl.fQ, p.A1, p.d1, p.A2, p.d2);
    const a = r.a;
    const Qx = Math.max(16000, p.Qm * 2.2);
    return {
      metricas: [
        ['Caudal del río hoy', r.q.Q, 'm³/s', '', 0, 'Serie de Fourier de dos términos.'],
        ['Caudal medio del año', a.Q, 'm³/s', '', 0],
        ['Caudal mínimo del año (medio del mes)', a.Qmin, 'm³/s', a.Qmin >= 2500 ? 'ok' : 'aviso', 0],
        ['Caudal máximo del año (medio del mes)', a.Qmax, 'm³/s', '', 0],
        ['Sedimento en el agua hoy', r.q.C, 'mg/L', '', 0, 'C = C₀·(Q/Q̄)^(b−1).'],
        ['Carga de sedimento hoy', r.q.Qs, 'kg/s', '', 0, 'Q·C/1000.'],
        ['Sedimento del año', a.Mt / 1e6, 'millones de t', a.Mt >= 50e6 ? 'ok' : 'aviso', 1],
      ],
      tablas: tablaHTML('El río en el año', ['Mes', 'Caudal (m³/s)', 'Sedimento (mg/L)', 'Carga (kg/s)'], a.meses.map((m) => [m.mes, miles(m.Q), miles(m.C), miles(m.Qs)]), { numericas: [1, 2, 3], nota: 'Medias de cada mes del año de régimen.' }),
      ecuacion: [
        ecu.tipo('Serie de Fourier (periódica): el caudal del año'),
        ecu.formula(`${i('Q')}(${i('d')}) = ${i('Q̄')}·[1 + ${sub('A', '1')}·cos(2π(${i('d')} − ${sub('d', '1')})/365) + ${sub('A', '2')}·cos(4π(${i('d')} − ${sub('d', '2')})/365)]`),
        ecu.sust(`${i('Q')}(${r.q.d}) = ${miles(p.Qm * cl.fQ)}·[1 + ${fmt(p.A1, 2)}·cos(2π(${r.q.d} − ${p.d1})/365) + ${fmt(p.A2, 2)}·cos(4π(${r.q.d} − ${p.d2})/365)] = ${miles(r.q.Q)} m³/s`),
        ecu.tipo('Función potencia: curva de sedimento'),
        ecu.formula(`${i('C')} = ${sub('C', '0')}·(${i('Q')}/${i('Q̄')})<sup>${i('b')} − 1</sup>,  carga = ${i('Q')}·${i('C')} ∝ ${i('Q')}<sup>${i('b')}</sup>`),
        ecu.sust(`${i('C')} = ${miles(p.C0)} × (${miles(r.q.Q)}/${miles(p.Qm)})<sup>${fmt(p.bSed - 1, 2)}</sup> = ${miles(r.q.C)} mg/L;  carga = ${miles(r.q.Q)} × ${miles(r.q.C)}/1000 = ${miles(r.q.Qs)} kg/s`),
      ].join(''),
      graficas: [
        { xTitulo: 'Día del año', yTitulo: 'Caudal (m³/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => miles(v),
          series: [serieLinea('Q(d)', muestrear(Qd, 1, 365, 180), c.agua), serieLinea('Solo la onda anual', muestrear((d) => p.Qm * cl.fQ * (1 + p.A1 * Math.cos((2 * Math.PI * (d - p.d1)) / 365)), 1, 365, 120), c.tinta2, { punteada: true, ancho: 1 }), serieGuia('Q̄', { x: 1, y: p.Qm * cl.fQ }, { x: 365, y: p.Qm * cl.fQ }, c.tinta2), seriePuntos('Hoy', [{ x: r.q.d, y: r.q.Q }], c.alerta)],
          limites: { x: { min: 1, max: 365 }, y: { min: 0 } }, pie: 'Dos crecientes al año: la pequeña de mitad de año y la grande de noviembre.' },
        { xTitulo: 'Caudal (m³/s)', yTitulo: 'Sedimento (mg/L)', formatoX: (v) => miles(v), formatoY: (v) => miles(v),
          series: [serieLinea('C = C₀·(Q/Q̄)^(b−1)', muestrear((Q) => M.concentracion(Q, p.Qm, p.C0, p.bSed), 200, Qx, 150), c.ocre), seriePuntos('Meses', a.meses.map((m) => ({ x: m.Q, y: m.C })), c.agua, 4), seriePuntos('Hoy', [{ x: r.q.Q, y: r.q.C }], c.alerta)],
          limites: { x: { min: 0, max: Qx }, y: { min: 0 } }, pie: 'Función potencia: con el doble de caudal, el agua lleva más sedimento por litro.' },
      ],
    };
  },

  canales({ p, r, c }) {
    const Kp = M.conductancia(p.anchoRio, p.profRio, p.nRio);
    const Kd = M.conductancia(p.anchoDique, p.profDique, p.nDique);
    const Up = M.velocidadManning(p.anchoRio, p.profRio, p.nRio, p.pendRio);
    const Ud = M.velocidadManning(p.anchoDique, p.profDique, p.nDique, p.pendDique);
    const de = r.de;
    const fd = (ap) => S.fraccionDique({ ...p, aperturaDique: ap });
    const tMax = Math.max(100, Math.min(2000, techoRedondo(de.anosAv * 1.3)));
    return {
      metricas: [
        ['Conductancia del cauce principal K = A·R^(2/3)/n', Kp, 'm³/s', '', 0],
        ['Conductancia del Canal del Dique', Kd, 'm³/s', '', 0],
        ['Velocidad de Manning en el cauce principal', Up, 'm/s', '', 2],
        ['Velocidad de Manning en el Dique', Ud, 'm/s', '', 2],
        ['Parte del caudal que toma el Dique', 100 * r.fD, '%', r.fD <= 0.1 ? 'ok' : 'alerta', 2, 'K·√S·apertura del Dique sobre la suma de los dos brazos.'],
        ['Caudal del Dique hoy', r.q.Qd, 'm³/s', '', 0],
        ['Caudal que sale por Bocas de Ceniza hoy', r.q.Qp, 'm³/s', '', 0],
        ['Sedimento del Dique en el año', (r.fD * r.a.Mt) / 1e6, 'millones de t', '', 2],
        ['Años hasta la avulsión', de.anosAv, 'años', de.anosAv > 100 ? 'ok' : 'aviso', 0, '(β·h − s₀)/(agradación).'],
      ],
      ecuacion: [
        ecu.tipo('Función potencia: conductancia de Manning'),
        ecu.formula(`${i('K')} = ${i('A')}·${i('R')}<sup>2/3</sup>/${i('n')},  ${i('R')} = ${i('A')}/${i('P')}`),
        ecu.sust(`Dique: ${i('A')} = ${miles(p.anchoDique)} × ${fmt(p.profDique, 1)} = ${miles(p.anchoDique * p.profDique)} m², ${i('R')} = ${fmt((p.anchoDique * p.profDique) / (p.anchoDique + 2 * p.profDique), 2)} m → ${i('K')} = ${miles(Kd)} m³/s`),
        ecu.tipo('Decimales: reparto del caudal'),
        ecu.formula(`${sub('f', 'Dique')} = ${sub('K', 'D')}√${sub('S', 'D')}·a/(${sub('K', 'P')}√${sub('S', 'P')} + ${sub('K', 'D')}√${sub('S', 'D')}·a)`),
        ecu.sust(`${sub('f', 'Dique')} = ${miles(Kd * Math.sqrt(p.pendDique) * p.aperturaDique)}/(${miles(Kp * Math.sqrt(p.pendRio))} + ${miles(Kd * Math.sqrt(p.pendDique) * p.aperturaDique)}) = ${fmt(r.fD, 4)} = ${fmt(100 * r.fD, 2)} %`),
        ecu.tipo('Lineal y racional: el cauce sube hasta la avulsión'),
        ecu.formula(`${i('s')}(${i('t')}) = ${sub('s', '0')} + ${i('a')}·${i('t')};  avulsión cuando ${i('s')} = β·${i('h')}:  ${i('t')} = (β·${i('h')} − ${sub('s', '0')})/${i('a')}`),
        ecu.sust(`${i('t')} = (${fmt(p.beta, 1)} × ${fmt(p.profRio, 1)} − ${fmt(p.sobreelevacion, 1)})/${fmt(p.agradacion / 1000, 3)} m/año = ${miles(de.anosAv)} años`),
      ].join(''),
      graficas: [
        { xTitulo: 'Apertura de las compuertas del Dique', yTitulo: 'Parte del caudal (%)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Toma del Dique', muestrear((x) => 100 * fd(x), 0, 1, 60), c.ocre), serieGuia('Límite (10 %)', { x: 0, y: 10 }, { x: 1, y: 10 }, c.alerta), seriePuntos('Ahora', [{ x: p.aperturaDique, y: 100 * r.fD }], c.agua)],
          limites: { x: { min: 0, max: 1 }, y: { min: 0, max: Math.max(12, Math.ceil(100 * fd(1) + 3)) } }, pie: 'Con compuertas, el Dique toma menos agua y menos sedimento hacia la bahía de Cartagena.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Altura (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('Fondo del cauce sobre la llanura s(t)', [{ x: 0, y: p.sobreelevacion }, { x: tMax, y: p.sobreelevacion + (p.agradacion / 1000) * tMax }], c.ocre), serieGuia('Umbral de avulsión β·h', { x: 0, y: p.beta * p.profRio }, { x: tMax, y: p.beta * p.profRio }, c.alerta), ...(Number.isFinite(de.anosAv) && de.anosAv <= tMax ? [seriePuntos('Avulsión', [{ x: de.anosAv, y: p.beta * p.profRio }], c.alerta)] : [])],
          limites: { x: { min: 0, max: tMax }, y: { min: 0 } }, pie: 'El cauce se levanta en línea recta: donde cruza el umbral, el río busca un camino nuevo.' },
      ],
    };
  },

  cuna({ p, r, c }) {
    const gp = M.gReducida(p.Smar);
    const Leq = (Q) => Math.min(S.SITIO.Lmax, M.cunaSalina(r.h, p.Ci, M.froudeDensimetrico(Q / (p.anchoCanal * r.h), gp, r.h))) / 1000;
    const a = r.a;
    const Qx = Math.max(12000, r.q.Qp * 1.3);
    const Fr = r.q.Fr, f = Fr ** (2 / 3);
    return {
      metricas: [
        ['Caudal que llega a la boca', r.q.Qp, 'm³/s', '', 0],
        ['Profundidad del canal', r.h, 'm', '', 2],
        ['Velocidad del río U = Q/(B·h)', r.q.U, 'm/s', '', 3],
        ["Gravedad reducida g' = g·Δρ/ρ", gp, 'm/s²', '', 4],
        ["Velocidad de la onda en la interfaz √(g'·h)", Math.sqrt(gp * r.h), 'm/s', '', 3],
        ['Froude densimétrico Fr', Fr, '', Fr < 1 ? '' : 'ok', 3, 'Fr ≥ 1: el río saca la cuña de la boca.'],
        ['Longitud de equilibrio de la cuña', km(r.q.Leq), 'km', '', 2],
        ['Longitud de la cuña ahora', km(r.L), 'km', r.L < p.xToma * 1000 ? 'ok' : 'alerta', 2, 'Se acerca a la de equilibrio en unos dos días.'],
        ['Cuña máxima del año', km(a.Lmax), 'km', a.Lmax < p.xToma * 1000 ? 'ok' : 'alerta', 2],
      ],
      ecuacion: [
        ecu.tipo('Raíz cuadrada: número de Froude densimétrico'),
        ecu.formula(`Fr = ${i('U')}/√(${i("g'")}·${i('h')}),  ${i("g'")} = ${i('g')}·0.00078·${sub('S', 'mar')}`),
        ecu.sust(`Fr = ${fmt(r.q.U, 3)}/√(${fmt(gp, 4)} × ${fmt(r.h, 2)}) = ${fmt(Fr, 3)}`),
        ecu.tipo('Polinomio en Fr^(2/3): longitud de la cuña (Schijf y Schönfeld)'),
        ecu.formula(`${i('L')} = ${i('h')}/(4${sub('C', 'i')})·[Fr<sup>−2</sup>/5 − 2 + 3·Fr<sup>2/3</sup> − (6/5)·Fr<sup>4/3</sup>]`),
        ecu.sust(Fr < 1 ? `${i('L')} = ${fmt(r.h, 2)}/(4 × ${fmt(p.Ci, 5)}) × [${fmt(0.2 / (Fr * Fr), 3)} − 2 + ${fmt(3 * f, 3)} − ${fmt(1.2 * f * f, 3)}] = ${miles(r.q.Leq)} m` : `Fr ≥ 1: ${i('L')} = 0 (el río empuja la cuña fuera de la boca)`),
        ecu.tipo('Exponencial: la cuña se acerca al equilibrio'),
        ecu.formula(`${i('L')}(${i('t')} + Δ${i('t')}) = ${sub('L', 'eq')} + (${i('L')} − ${sub('L', 'eq')})·e<sup>−Δ${i('t')}/τ</sup>,  τ = 2 días`),
      ].join(''),
      graficas: [
        { xTitulo: 'Caudal que llega a la boca (m³/s)', yTitulo: 'Longitud de la cuña (km)', formatoX: (v) => miles(v), formatoY: (v) => fmt(v, 0),
          series: [serieLinea(`L(Q) con h = ${fmt(r.h, 1)} m`, muestrear(Leq, 300, Qx, 200), c.agua), serieGuia('Bocatoma', { x: 0, y: p.xToma }, { x: Qx, y: p.xToma }, c.alerta), seriePuntos('Ahora', [{ x: r.q.Qp, y: km(r.q.Leq) }], c.ocre)],
          limites: { x: { min: 0, max: Qx }, y: { min: 0, max: Math.max(p.xToma * 2, 10) } }, pie: 'Con poco caudal la cuña se alarga muy rápido: el polinomio crece como 1/Fr².' },
        { xTitulo: 'Mes', yTitulo: 'Longitud de la cuña (km)', formatoX: fmtMes, formatoY: (v) => fmt(v, 1), marcasX: MARCAS_MES,
          series: [serieLinea('Media del mes', a.meses.map((m, k) => ({ x: k + 1, y: km(m.L) })), c.agua), serieLinea('Máxima del mes', a.meses.map((m, k) => ({ x: k + 1, y: km(m.Lmax) })), c.agua, { punteada: true, ancho: 1.5 }), serieGuia('Bocatoma', { x: 1, y: p.xToma }, { x: 12, y: p.xToma }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0, max: Math.max(p.xToma * 1.5, Math.ceil(km(a.Lmax) + 1)) } }, pie: 'La cuña entra en la sequía (febrero a abril) y sale con la creciente.' },
      ],
    };
  },

  pluma({ p, r, c }) {
    const Lp = r.q.Lp;
    const C0 = r.q.C;
    const xMax = Math.max(60, Math.ceil(km(r.q.alcance) * 1.4 / 10) * 10);
    const a = r.a;
    return {
      metricas: [
        ['Sedimento a la salida de la boca', C0, 'mg/L', '', 0],
        ['Velocidad del agua en la boca', r.q.U, 'm/s', '', 2],
        ['Escala de la pluma L = U·h_p/w_s', km(Lp), 'km', '', 2],
        ['Alcance de la pluma visible', km(r.q.alcance), 'km', '', 1, 'Donde la concentración baja a la de agua turbia.'],
        [`Sedimento a ${S.SITIO.xPlaya} km (playas), media del año`, r.Cplaya, 'mg/L', r.Cplaya <= 150 ? 'ok' : 'aviso', 0],
        ['Agua de la ciénaga al mar', p.Qcienaga, 'm³/s', '', 0, 'Pluma pequeña al oriente, por la Boca de la Barra.'],
      ],
      ecuacion: [
        ecu.tipo('Racional: escala de la pluma'),
        ecu.formula(`${i('L')} = ${i('U')}·${sub('h', 'p')}/${sub('w', 's')}`),
        ecu.sust(`${i('L')} = ${fmt(r.q.U, 2)} × ${fmt(p.hPluma, 1)}/${fmt(p.wsPluma / 1000, 5)} = ${miles(Lp)} m`),
        ecu.tipo('Exponencial: el agua se aclara mar adentro'),
        ecu.formula(`${i('C')}(${i('x')}) = ${sub('C', '0')}·e<sup>−${i('x')}/${i('L')}</sup>`),
        ecu.tipo('Logarítmica: alcance de la pluma visible'),
        ecu.formula(`${i('x')} = ${i('L')}·ln(${sub('C', '0')}/${sub('C', 'vis')})`),
        ecu.sust(`${i('x')} = ${fmt(km(Lp), 2)} km × ln(${miles(C0)}/${miles(p.Cvis)}) = ${fmt(km(Lp), 2)} × ${fmt(Math.log(C0 / p.Cvis), 3)} = ${fmt(km(r.q.alcance), 1)} km`),
      ].join(''),
      graficas: [
        { xTitulo: 'Distancia mar adentro (km)', yTitulo: 'Sedimento (mg/L)', formatoX: (v) => fmt(v, 0), formatoY: (v) => miles(v),
          series: [serieLinea('C(x) = C₀·e^(−x/L)', muestrear((x) => M.concentracionPluma(x * 1000, C0, Lp), 0, xMax, 150), c.ocre), serieGuia('Agua turbia (C_vis)', { x: 0, y: p.Cvis }, { x: xMax, y: p.Cvis }, c.tinta2), seriePuntos('Alcance', [{ x: km(r.q.alcance), y: p.Cvis }], c.alerta)],
          limites: { x: { min: 0, max: xMax }, y: { min: 0 } }, pie: 'Cada L kilómetros la concentración se divide entre e ≈ 2.72.' },
        { xTitulo: 'Mes', yTitulo: 'Alcance de la pluma (km)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Alcance medio del mes', a.meses.map((m, k) => ({ x: k + 1, y: km(m.alcance) })), c.ocre), serieGuia('Playas', { x: 1, y: S.SITIO.xPlaya }, { x: 12, y: S.SITIO.xPlaya }, c.tinta2)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'La pluma llega más lejos con la creciente: más velocidad y más sedimento.' },
      ],
    };
  },

  avance({ p, r, c }) {
    const de = r.de;
    const v = de.avance;
    const area = (t) => M.areaLobulo(Math.max(0, de.r0 + v * t)) / 1e6;
    const z = (t) => p.cotaLlanura - p.nivelMar - (de.rslr / 1000) * t;
    const tMar = Math.min(300, Math.max(120, techoRedondo(de.anosMar * 1.2)));
    return {
      metricas: [
        ['Sedimento del año', r.a.Mt / 1e6, 'millones de t', '', 1],
        ['Volumen que se queda en el frente', de.Vs / 1e6, 'hm³/año', '', 2, 'f·M/ρ_b.'],
        ['Volumen que se lleva el oleaje', de.Vls / 1e6, 'hm³/año', '', 2],
        ['Balance del frente', de.Vneto / 1e6, 'hm³/año', de.Vneto >= 0 ? 'ok' : 'alerta', 2],
        ['Avance del frente', v, 'm/año', de.Vneto >= 0 ? 'ok' : 'alerta', 1],
        ['Área del lóbulo hoy', de.area0 / 1e6, 'km²', '', 1, 'π·r²/2.'],
        ['Área del lóbulo en 50 años', de.area50 / 1e6, 'km²', '', 1],
        ['Ascenso relativo del mar', de.rslr, 'mm/año', '', 1, 'Subsidencia + ascenso del mar.'],
        ['Años hasta que el mar alcance la llanura', de.anosMar, 'años', de.anosMar > 100 ? 'ok' : 'alerta', 0],
      ],
      ecuacion: [
        ecu.tipo('Lineal: avance del frente'),
        ecu.formula(`${i('v')} = (${sub('V', 's')} − ${sub('V', 'olas')})/(${i('W')}·${i('H')}),  ${sub('V', 's')} = ${i('f')}·${i('M')}/${sub('ρ', 'b')}`),
        ecu.sust(`${i('v')} = (${fmt(de.Vs / 1e6, 2)} − ${fmt(de.Vls / 1e6, 2)})·10⁶ m³/(${miles(p.anchoFrente * 1000)} m × ${fmt(de.H, 1)} m) = ${fmt(v, 1)} m/año`),
        ecu.tipo('Cuadrática: área del lóbulo'),
        ecu.formula(`${i('A')}(${i('t')}) = π·(${sub('r', '0')} + ${i('v')}·${i('t')})²/2`),
        ecu.sust(`${i('A')}(50) = π × (${miles(de.r0)} + ${fmt(v, 1)} × 50)²/2 = ${fmt(de.area50 / 1e6, 1)} km²`),
        ecu.tipo('Lineal y racional: el mar alcanza la llanura'),
        ecu.formula(`${i('z')}(${i('t')}) = ${sub('z', '0')} − ${i('a')}·${i('t')},  ${i('t')} = ${sub('z', '0')}/${i('a')}`),
        ecu.sust(`${i('t')} = ${fmt(p.cotaLlanura - p.nivelMar, 2)} m/${fmt(de.rslr / 1000, 4)} m/año = ${miles(de.anosMar)} años`),
      ].join(''),
      graficas: [
        { xTitulo: 'Años desde hoy', yTitulo: 'Área del lóbulo (km²)', formatoX: (v2) => fmt(v2, 0), formatoY: (v2) => fmt(v2, 0),
          series: [serieLinea('A(t) = π(r₀ + v·t)²/2', muestrear(area, 0, 100, 100), v >= 0 ? c.ok : c.alerta), seriePuntos('Hoy y en 50 años', [{ x: 0, y: de.area0 / 1e6 }, { x: 50, y: de.area50 / 1e6 }], c.ocre)],
          limites: { x: { min: 0, max: 100 }, y: { min: 0 } }, pie: 'Una parábola en el tiempo: el radio crece en línea recta y el área con su cuadrado.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Cota sobre el mar (m)', formatoX: (v2) => fmt(v2, 0), formatoY: (v2) => fmt(v2, 1),
          series: [serieLinea('Llanura del delta z(t)', [{ x: 0, y: z(0) }, { x: tMar, y: z(tMar) }], c.ocre), serieGuia('Nivel del mar', { x: 0, y: 0 }, { x: tMar, y: 0 }, c.agua), ...(de.anosMar <= tMar ? [seriePuntos('El mar la alcanza', [{ x: de.anosMar, y: 0 }], c.alerta)] : [])],
          limites: { x: { min: 0, max: tMar }, y: { min: Math.min(-0.5, z(tMar)), max: Math.max(1, z(0) + 0.2) } }, pie: 'Sin aportes de sedimento a la llanura, la recta cruza el nivel del mar.' },
      ],
    };
  },

  oleaje({ p, r, c }) {
    const de = r.de;
    const ls = (Hb) => (M.transporteLitoral(Hb, p.anguloOla) * M.SEG_ANO) / 1e6;
    const ang = (t) => (M.transporteLitoral(de.Hb, t) * M.SEG_ANO) / 1e6;
    return {
      metricas: [
        ['Altura de rotura (Komar y Gaughan)', de.Hb, 'm', '', 2],
        ['Transporte litoral (CERC)', de.Qls, 'm³/s', '', 3],
        ['Transporte litoral en el año', de.Vls / 1e6, 'hm³/año', '', 2],
        ['Sedimento del río que se queda en el frente', de.Vs / 1e6, 'hm³/año', '', 2],
        ['Dominancia R = río/oleaje', de.R, '', de.R >= 1 ? 'ok' : 'aviso', 2],
        ['Tipo de delta', de.tipo, ''],
        ['Clase de marea', `${de.claseMarea} (${fmt(p.rangoMarea, 2)} m)`, ''],
      ],
      ecuacion: [
        ecu.tipo('Función potencia: altura de rotura'),
        ecu.formula(`${sub('H', 'b')} = 0.39·${i('g')}<sup>1/5</sup>·(${i('T')}·${sub('H', '0')}²)<sup>2/5</sup>`),
        ecu.sust(`${sub('H', 'b')} = 0.39 × 9.81<sup>0.2</sup> × (${fmt(p.Tp, 1)} × ${fmt(p.Hs, 2)}²)<sup>0.4</sup> = ${fmt(de.Hb, 2)} m`),
        ecu.tipo('Función potencia 5/2: transporte litoral (CERC)'),
        ecu.formula(`${i('Q')} = ${i('K')}·√(${i('g')}/γ)·${sub('H', 'b')}<sup>5/2</sup>·sin(2θ)/(16·(${i('s')} − 1)·(1 − ${i('p')}))`),
        ecu.sust(`${i('Q')} = 0.39 × √(9.81/0.78) × ${fmt(de.Hb, 2)}<sup>2.5</sup> × sin(${fmt(2 * p.anguloOla, 0)}°)/(16 × 1.65 × 0.6) = ${fmt(de.Qls, 3)} m³/s`),
        ecu.tipo('Racional y por tramos: tipo de delta'),
        ecu.formula(`${i('R')} = ${sub('V', 's')}/${sub('V', 'olas')};  marea si rango > 4 m; río si ${i('R')} ≥ 1; oleaje si ${i('R')} < 1`),
        ecu.sust(`${i('R')} = ${fmt(de.Vs / 1e6, 2)}/${fmt(de.Vls / 1e6, 2)} = ${fmt(de.R, 2)} → ${de.tipo}`),
      ].join(''),
      graficas: [
        { xTitulo: 'Altura de rotura H_b (m)', yTitulo: 'Volumen al año (hm³)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Transporte litoral ∝ H_b^(5/2)', muestrear(ls, 0, Math.max(4, de.Hb * 1.3), 120), c.agua), serieGuia('Sedimento del río en el frente', { x: 0, y: de.Vs / 1e6 }, { x: Math.max(4, de.Hb * 1.3), y: de.Vs / 1e6 }, c.ocre), seriePuntos('Ahora', [{ x: de.Hb, y: de.Vls / 1e6 }], c.alerta)],
          limites: { x: { min: 0, max: Math.max(4, de.Hb * 1.3) }, y: { min: 0 } }, pie: 'Donde la curva pasa la línea del río, el oleaje gana y el delta retrocede.' },
        { xTitulo: 'Ángulo de las olas con la normal (°)', yTitulo: 'Volumen al año (hm³)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('∝ sin(2θ)', muestrear(ang, 0, 90, 91), c.agua), seriePuntos('Ahora', [{ x: p.anguloOla, y: de.Vls / 1e6 }], c.alerta)],
          limites: { x: { min: 0, max: 90 }, y: { min: 0 } }, pie: 'Las olas que llegan de frente (0°) no mueven arena a lo largo de la costa; a 45° la mueven más.' },
      ],
    };
  },

  dragado({ p, r, c }) {
    const a = r.a;
    const us = r.q.us;
    const perfil = muestrear((zz) => M.perfilLog(zz, us, p.z0), p.z0 * 1.5, r.h, 120).map((pt) => ({ x: pt.y, y: pt.x }));
    const heqMes = a.meses.map((m, k) => ({ x: k + 1, y: Math.min(p.profMaxCanal, Math.max(1, M.profundidadRegimen(m.Qp, p.anchoCanal, p.Uc))) }));
    return {
      metricas: [
        ['Profundidad del canal ahora', r.h, 'm', r.h >= p.calado - 1e-9 ? 'ok' : 'alerta', 2],
        ['Profundidad de régimen ahora h = Q/(B·U_c)', r.q.heq, 'm', '', 2],
        ['Velocidad media del agua', r.q.U, 'm/s', '', 2],
        ['Velocidad de fricción u*', us, 'm/s', '', 4, 'κ·U/(ln(h/z₀) − 1).'],
        ['Esfuerzo en el fondo τ = ρ·u*²', r.q.tau, 'Pa', '', 2],
        ['Dragado en lo que va del año', r.dragado / 1e6, 'hm³', '', 3],
        ['Dragado del año de régimen', a.dragado / 1e6, 'hm³/año', a.dragado <= 5e6 ? 'ok' : 'aviso', 2],
        ['Días por debajo del calado', a.diasBajo, 'días', a.diasBajo === 0 ? 'ok' : 'alerta', 0],
      ],
      tablas: tablaHTML('El canal en el año', ['Mes', 'A la boca (m³/s)', 'Media (m)', 'Mínima (m)', 'Dragado (miles de m³)'], a.meses.map((m) => [m.mes, miles(m.Qp), fmt(m.h, 2), { v: fmt(m.hmin, 2), clase: m.hmin < p.calado - 1e-9 ? 'mal' : '' }, miles(m.dragado / 1000)]), { numericas: [1, 2, 3, 4], nota: 'En la sequía el canal se llena; la draga lo devuelve al calado más 0.5 m.' }),
      ecuacion: [
        ecu.tipo('Racional: profundidad de régimen'),
        ecu.formula(`${sub('h', 'eq')} = ${i('Q')}/(${i('B')}·${sub('U', 'c')})`),
        ecu.sust(`${sub('h', 'eq')} = ${miles(r.q.Qp)}/(${miles(p.anchoCanal)} × ${fmt(p.Uc, 2)}) = ${fmt(M.profundidadRegimen(r.q.Qp, p.anchoCanal, p.Uc), 2)} m${M.profundidadRegimen(r.q.Qp, p.anchoCanal, p.Uc) > p.profMaxCanal ? ` → ${fmt(p.profMaxCanal, 1)} m (fondo duro)` : ''}`),
        ecu.tipo('Exponencial: el fondo se acerca a la profundidad de régimen'),
        ecu.formula(`${i('h')}(${i('t')} + Δ${i('t')}) = ${sub('h', 'eq')} + (${i('h')} − ${sub('h', 'eq')})·e<sup>−Δ${i('t')}/τ</sup>,  τ = ${miles(p.tauCanal)} días`),
        ecu.tipo('Logarítmica: perfil de velocidad'),
        ecu.formula(`${i('u')}(${i('z')}) = (${i('u')}*/κ)·ln(${i('z')}/${sub('z', '0')}),  ${i('u')}* = κ·${i('U')}/(ln(${i('h')}/${sub('z', '0')}) − 1)`),
        ecu.sust(`${i('u')}* = 0.41 × ${fmt(r.q.U, 3)}/(ln(${fmt(r.h, 2)}/${fmt(p.z0, 3)}) − 1) = ${fmt(us, 4)} m/s;  τ = 1000 × ${fmt(us, 4)}² = ${fmt(r.q.tau, 2)} Pa`),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Profundidad (m)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Media del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.h })), c.agua), serieLinea('Mínima del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.hmin })), c.agua, { punteada: true, ancho: 1.5 }), seriePuntos('Régimen Q/(B·U_c)', heqMes, c.ocre, 3), serieGuia('Calado', { x: 1, y: p.calado }, { x: 12, y: p.calado }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0, max: Math.ceil(p.profMaxCanal + 2) } }, pie: 'En la sequía la profundidad de régimen baja del calado: sin draga, el canal no alcanza.' },
        { xTitulo: 'Velocidad (m/s)', yTitulo: 'Altura sobre el fondo (m)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('u(z) = (u*/κ)·ln(z/z₀)', perfil, c.agua), serieGuia('Velocidad media', { x: r.q.U, y: 0 }, { x: r.q.U, y: r.h }, c.tinta2)],
          limites: { x: { min: 0, max: Math.max(0.5, Math.ceil(10 * M.perfilLog(r.h, us, p.z0) * 1.1) / 10) }, y: { min: 0, max: Math.ceil(r.h) } }, pie: 'La velocidad es cero en el fondo y crece como un logaritmo hacia la superficie.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'deltas',
  tabInicial: 'rio',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Deltas',
  tabs: TABS,
  controles: CONTROLES,
  PARAMETROS: S.PARAMETROS,
  escenarios: S.ESCENARIOS,
  estadoInicial: S.estadoInicial,
  avanzar: S.avanzar,
  calcular: S.calcular,
  pasoMaximo: 21600,
  reloj: {
    tipo: 'dias', inicio: 6 * 3600,
    velocidades: [{ valor: 3600, nombre: '1 h por segundo' }, { valor: 21600, nombre: '6 h por segundo' }, { valor: 86400, nombre: '1 día por segundo' }, { valor: 864000, nombre: '10 días por segundo' }, { valor: 2592000, nombre: '30 días por segundo' }],
    defecto: 86400,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 21600, nombre: '6 h' }, { valor: 86400, nombre: '1 día' }, { valor: 864000, nombre: '10 días' }],
    intervaloDefecto: 86400,
    columnas: [
      { clave: 'Q', nombre: 'Caudal del río', unidad: 'm³/s', dec: 0 },
      { clave: 'Qp', nombre: 'Caudal a la boca', unidad: 'm³/s', dec: 0 },
      { clave: 'C', nombre: 'Sedimento', unidad: 'mg/L', dec: 0 },
      { clave: 'h', nombre: 'Profundidad del canal', unidad: 'm', dec: 2 },
      { clave: 'L', nombre: 'Cuña salina', unidad: 'km', dec: 2 },
      { clave: 'alcance', nombre: 'Alcance de la pluma', unidad: 'km', dec: 1 },
    ],
    tomar: (p, r) => ({ Q: r.q.Q, Qp: r.q.Qp, C: r.q.C, h: r.h, L: r.L / 1000, alcance: r.q.alcance / 1000 }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'general', nombre: 'Delta', titulo: 'El delta, la pluma y el mar' },
    { id: 'boca', nombre: 'Boca', titulo: 'Bocas de Ceniza: los tajamares, el puerto y la draga' },
    { id: 'corte', nombre: 'Corte', titulo: 'Corte a lo largo del canal: la cuña salina' },
    { id: 'dique', nombre: 'Brazos', titulo: 'El reparto del agua: el Canal del Dique' },
  ],
});
