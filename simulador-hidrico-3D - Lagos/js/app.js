/**
 * app.js — Simulador de lagos andinos profundos: pestañas, controles, resultados,
 * ecuaciones con valores sustituidos y gráficas. El controlador común está en
 * nucleo/app-base.js; aquí solo va lo propio del lago.
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

const TABS = [
  { id: 'cuenca', nombre: 'Cuenca', graficas: 2, tablas: true, intro: 'El lago está a 3 015 m de altitud, en un valle de los Andes. Le entra el agua de su cuenca (lluvia que se vuelve escorrentía y que el suelo suelta despacio), la lluvia que cae sobre el espejo y, si se conecta, el agua que rebosa de la laguna del páramo. Pierde agua por evaporación, por la extracción para los acueductos y el riego, y por el desagüe natural que alimenta el río. Con un área de 55 km², un milímetro de nivel son 55 000 m³: el nivel cambia despacio, pero el balance del año decide si el lago sigue desaguando.' },
  { id: 'morfometria', nombre: 'Morfometría', graficas: 2, tablas: true, intro: 'La forma de la cubeta decide cuánta agua guarda el lago y cómo se reparte en profundidad. La curva hipsométrica dice el área a cada profundidad: A(z) = A₀·(1 − z/z_máx)^m. Con m = 1 la cubeta sería un cono; con m < 1 las orillas son más empinadas y el lago guarda más agua. De ahí salen el volumen, la profundidad media y los índices de forma de la limnología.' },
  { id: 'temperatura', nombre: 'Temperatura', graficas: 2, tablas: true, intro: 'El sol calienta la capa de arriba (epilimnion) y el agua tibia, más liviana, flota sobre el agua fría del fondo (hipolimnion): el lago se estratifica. La densidad del agua es una parábola con su máximo en 4 °C, así que entre 11 y 14 °C la diferencia de densidad es pequeña y la estratificación de un lago tropical de montaña es débil. Aquí se ven el perfil de temperatura, la densidad y cómo cambia la superficie en el año.' },
  { id: 'viento', nombre: 'Viento', graficas: 2, intro: 'El viento empuja el agua de la superficie hacia la orilla de sotavento e inclina la termoclina en sentido contrario. El número de Wedderburn compara la estratificación con el empuje del viento: si es menor que 1, el viento levanta el agua del fondo hasta la superficie y el lago se mezcla. Cuando el viento para, el lago se mece como el agua de una bañera: son las seiches, en la superficie (minutos) y en la termoclina (días).' },
  { id: 'oxigeno', nombre: 'Oxígeno', graficas: 2, intro: 'Mientras el lago está estratificado, el hipolimnion no toca el aire: las bacterias que descomponen las algas muertas gastan su oxígeno y nadie lo repone. El consumo por metro cuadrado de fondo (la demanda del hipolimnion) crece con las algas, y el oxígeno baja en línea recta hasta que el viento vuelve a mezclar el lago. Sin oxígeno el fondo suelta fósforo y los peces se quedan sin espacio.' },
  { id: 'peces', nombre: 'Peces', graficas: 2, tablas: true, intro: 'En las jaulas del lago se puede criar la trucha arcoíris, que vino de Norteamérica (llegó a Tota en 1939 y desde 2005 se cría en jaulas), o peces nativos de los Andes colombianos: el capitán de la sabana, un bagre del altiplano Cundiboyacense que está en la lista de especies vulnerables, y la guapucha, un pez pequeño que se comía asado con maíz tostado. Cada especie crece mejor cerca de su temperatura óptima, necesita un oxígeno mínimo y convierte el alimento en carne con distinta eficiencia: lo que no se vuelve pescado queda en el lago como fósforo. En Tota, que desagua al Orinoco, los dos nativos llegaron en el siglo XX desde la cuenca del Magdalena; el único pez propio del lago, el pez graso, se considera extinto.' },
  { id: 'nutrientes', nombre: 'Nutrientes', graficas: 2, tablas: true, intro: 'El fósforo es el nutriente que limita las algas del lago. Llega de la cuenca, de la cebolla abonada con gallinaza, de las jaulas de peces y de las aguas residuales de los pueblos, y del fondo cuando se queda sin oxígeno. Con el modelo de Vollenweider se calcula el fósforo del lago y, con el índice de Carlson, la clorofila y la transparencia que se esperan.' },
];

const CONTROLES = [
  { tab: 'cuenca', grupo: 'Escenario' },
  { tab: 'cuenca', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio (El Niño, La Niña, más cebolla, más truchas, jaulas de capitán de la sabana o de guapucha, aguas residuales sin tratar, calentamiento o más extracción) sobre el escenario de referencia.' },
  { tab: 'cuenca', grupo: 'Lluvia y clima' },
  { tab: 'cuenca', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS),
    extra: (v) => `Lluvia × ${fmt(S.CLIMAS[v].fLluvia, 1)} y aire ${conSigno(S.CLIMAS[v].dT, 1)} °C frente a un año normal.`, doc: 'Año normal, El Niño (40 % menos lluvia, 0.8 °C más) o La Niña (40 % más lluvia, 0.4 °C menos).' },
  { tab: 'cuenca', id: 'lluviaAnual', clave: 'lluviaAnual', etiqueta: 'Lluvia de un año normal', unidad: 'mm', min: 400, max: 2500, paso: 10, dec: 0, doc: 'Se reparte en el año con el régimen bimodal de los Andes de Boyacá.' },
  { tab: 'cuenca', grupo: 'Cuenca' },
  { tab: 'cuenca', id: 'areaCuenca', clave: 'areaCuenca', etiqueta: 'Área de la cuenca (sin el lago)', unidad: 'km²', min: 20, max: 1000, paso: 5, dec: 0, doc: 'La escorrentía crece en proporción al área.' },
  { tab: 'cuenca', id: 'coefEscorrentia', clave: 'coefEscorrentia', etiqueta: 'Coeficiente de escorrentía', unidad: '', min: 0.1, max: 0.8, paso: 0.01, dec: 2, doc: 'Parte de la lluvia que llega al lago.' },
  { tab: 'cuenca', id: 'kCuenca', clave: 'kCuenca', etiqueta: 'Tiempo de respuesta de la cuenca', unidad: 'días', min: 5, max: 120, paso: 1, dec: 0, doc: 'La cuenca es un embalse lineal: suelta un caudal proporcional al agua que guarda.' },
  { tab: 'cuenca', grupo: 'Usos y desagüe' },
  { tab: 'cuenca', id: 'extraccion', clave: 'extraccion', etiqueta: 'Extracción para acueductos y riego', unidad: 'm³/s', min: 0, max: 4, paso: 0.05, dec: 2,
    extra: (v) => `Equivale al consumo de unas ${miles((v * 86400 * 1000) / 150)} personas con 150 L/hab·día.`, doc: 'Agua que se saca del lago; se suma a la evaporación como pérdida.' },
  { tab: 'cuenca', id: 'anchoDesague', clave: 'anchoDesague', etiqueta: 'Ancho del desagüe natural', unidad: 'm', min: 2, max: 60, paso: 1, dec: 0, doc: 'Vertedero Q = C·b·η^1.5 sobre el umbral del desagüe.' },
  { tab: 'cuenca', id: 'nivel', etiqueta: 'Nivel sobre el umbral del desagüe ahora', unidad: 'm', min: -1.5, max: 1, paso: 0.01, dec: 2, leer: (p, sim) => sim.eta, escribir: (v, p, sim) => { sim.eta = v; },
    doc: 'Cambia solo con el reloj; aquí se pone a mano para ver el desagüe o el lago bajo el umbral.' },
  { tab: 'cuenca', id: 'aporteExterno', clave: 'aporteExterno', etiqueta: 'Tributario de aguas arriba (laguna)', unidad: 'm³/s', min: 0, max: 2, paso: 0.005, dec: 3,
    extra: () => 'Lo pone la pestaña Conexión al recibir la frontera del simulador de lagunas.', doc: 'Agua que llega de la laguna del páramo (por defecto 0).' },

  { tab: 'morfometria', grupo: 'Forma de la cubeta' },
  { tab: 'morfometria', id: 'area', clave: 'area', etiqueta: 'Área del espejo de agua', unidad: 'km²', min: 1, max: 200, paso: 0.5, dec: 1, doc: 'A₀, el área en la superficie.' },
  { tab: 'morfometria', id: 'profMax', clave: 'profMax', etiqueta: 'Profundidad máxima', unidad: 'm', min: 5, max: 200, paso: 1, dec: 0, doc: 'z_máx de la curva hipsométrica.' },
  { tab: 'morfometria', id: 'exponente', clave: 'exponente', etiqueta: 'Exponente de la hipsometría m', unidad: '', min: 0.3, max: 2.5, paso: 0.05, dec: 2,
    extra: (v) => (v < 1 ? 'Orillas empinadas: más volumen.' : v > 1 ? 'Cubeta en punta: menos volumen.' : 'Cono.'), doc: 'Con m = 1 la cubeta es un cono (V = A₀·z_máx/2).' },
  { tab: 'morfometria', id: 'largo', clave: 'largo', etiqueta: 'Largo del lago', unidad: 'km', min: 1, max: 50, paso: 0.1, dec: 1, doc: 'Distancia mayor de orilla a orilla; fija las seiches y el empuje del viento.' },
  { tab: 'morfometria', id: 'perimetro', clave: 'perimetro', etiqueta: 'Perímetro de la orilla', unidad: 'km', min: 3, max: 200, paso: 0.5, dec: 1, doc: 'Con el área da el desarrollo de la orilla.' },

  { tab: 'temperatura', grupo: 'Temperatura del agua' },
  { tab: 'temperatura', id: 'Tsuperficie', clave: 'Tsuperficie', etiqueta: 'Temperatura media de la superficie', unidad: '°C', min: 5, max: 25, paso: 0.1, dec: 1, doc: 'T̄ de la sinusoide de la superficie en el año.' },
  { tab: 'temperatura', id: 'amplitudT', clave: 'amplitudT', etiqueta: 'Variación en el año (amplitud)', unidad: '°C', min: 0, max: 6, paso: 0.1, dec: 1, doc: 'A de la sinusoide: los lagos tropicales cambian poco en el año.' },
  { tab: 'temperatura', id: 'Tfondo', clave: 'Tfondo', etiqueta: 'Temperatura del hipolimnion', unidad: '°C', min: 4, max: 20, paso: 0.1, dec: 1, doc: 'El agua del fondo guarda la temperatura del último mezclado.' },
  { tab: 'temperatura', id: 'epilimnion', clave: 'epilimnion', etiqueta: 'Espesor del epilimnion', unidad: 'm', min: 2, max: 40, paso: 0.5, dec: 1, doc: 'Profundidad de la termoclina.' },
  { tab: 'temperatura', id: 'calentamiento', clave: 'calentamiento', etiqueta: 'Calentamiento sobre el clima de hoy', unidad: '°C', min: 0, max: 4, paso: 0.1, dec: 1, doc: 'Calienta sobre todo la superficie: la estratificación se hace más fuerte.' },

  { tab: 'viento', grupo: 'Viento' },
  { tab: 'viento', id: 'viento', clave: 'viento', etiqueta: 'Viento medio', unidad: 'm/s', min: 0, max: 15, paso: 0.1, dec: 1, doc: 'El viento del día sigue una sinusoide en el año con el máximo en agosto.' },
  { tab: 'viento', id: 'amplitudViento', clave: 'amplitudViento', etiqueta: 'Variación del viento en el año', unidad: 'm/s', min: 0, max: 6, paso: 0.1, dec: 1, doc: 'Amplitud de la sinusoide del viento.' },
  { tab: 'viento', id: 'ventarron', etiqueta: 'Ventarrón de un día', tipo: 'accion', accion: (p, sim) => S.ventarron(p, sim),
    extra: () => 'Un día de viento fuerte que mezcla el lago aunque esté estratificado.', doc: 'Mezcla el lago durante un día: el hipolimnion recibe oxígeno, o sube a la superficie si no lo tenía.' },

  { tab: 'oxigeno', grupo: 'Oxígeno del hipolimnion' },
  { tab: 'oxigeno', id: 'ODh', etiqueta: 'Oxígeno del hipolimnion ahora', unidad: 'mg/L', min: 0, max: 10, paso: 0.05, dec: 2, leer: (p, sim) => sim.ODh, escribir: (v, p, sim) => { sim.ODh = v; },
    doc: 'Cambia con el reloj: baja mientras el lago está estratificado y se recupera cuando se mezcla.' },

  { tab: 'nutrientes', grupo: 'Fuentes de fósforo' },
  { tab: 'nutrientes', id: 'areaCebolla', clave: 'areaCebolla', etiqueta: 'Cebolla con gallinaza en la cuenca', unidad: 'ha', min: 0, max: 8000, paso: 50, dec: 0, doc: 'Exporta 1 kg de fósforo por hectárea al año (referencia).' },
  { tab: 'peces', grupo: 'Cultivo en jaulas' },
  { tab: 'peces', id: 'especie', clave: 'especie', etiqueta: 'Especie que se cría', tipo: 'opciones', opciones: opciones(S.ESPECIES),
    extra: (v) => { const e = S.ESPECIES[v]; return `${e.cientifico}. ${e.origen}. Óptimo de ${fmt(e.Topt, 0)} °C (de ${fmt(e.Tmin, 0)} a ${fmt(e.Tmax, 0)} °C), oxígeno mínimo de ${fmt(e.ODmin, 0)} mg/L, conversión de alimento de ${fmt(e.FCA, 1)}${e.datos === 'supuestos' ? ' (valores supuestos: no hay datos publicados de su cultivo)' : ''}.`; },
    doc: 'La trucha es la referencia (exótica); el capitán de la sabana y la guapucha son peces nativos del altiplano Cundiboyacense.' },
  { tab: 'peces', id: 'peces', clave: 'peces', etiqueta: 'Producción de pescado en jaulas', unidad: 't/año', min: 0, max: 1500, paso: 10, dec: 0, extra: (v, p, r) => `${fmt(r.cultivo.LP, 1)} kg de fósforo por tonelada: ${miles(r.nu.fuentes.jaulas)} kg/año al lago.` },
  { tab: 'peces', id: 'pAlimento', clave: 'pAlimento', etiqueta: 'Fósforo del alimento', unidad: '%', min: 0.4, max: 1.6, paso: 0.01, dec: 2, doc: 'Alimentos con menos fósforo dejan menos fósforo en el lago.' },
  { tab: 'nutrientes', id: 'habitantes', clave: 'habitantes', etiqueta: 'Habitantes que vierten al lago', unidad: 'hab', min: 0, max: 60000, paso: 500, dec: 0, doc: '0.6 kg de fósforo por habitante al año.' },
  { tab: 'nutrientes', id: 'remocion', clave: 'remocion', etiqueta: 'Fósforo que quitan las plantas de tratamiento', unidad: '%', min: 0, max: 95, paso: 1, dec: 0, doc: 'Con 0 % las aguas residuales llegan sin tratar.' },
];

function estados(p, r) {
  const des = r.q.Qdesague > 1e-4;
  return [
    { id: 'nivel', nombre: 'Nivel', nivel: des ? 'ok' : (r.nivel.eta > -0.3 ? 'aviso' : 'alerta'), texto: des ? `Lago: ${fmt(r.nivel.eta, 2)} m sobre el desagüe, sale ${fmt(r.q.Qdesague, 2)} m³/s` : `Lago: ${fmt(Math.abs(r.nivel.eta), 2)} m bajo el umbral, no desagua` },
    { id: 'estratificacion', nombre: 'Estratificación', nivel: r.oxigeno.surgenciaAnoxica ? 'alerta' : 'ok', texto: r.tr.mezcla || r.oxigeno.ventarron ? (r.oxigeno.surgenciaAnoxica ? 'Surgencia: el viento sube agua sin oxígeno' : `Lago mezclado por el viento (W = ${fmt(r.tr.W, 2)})`) : `Estratificado (W = ${fmt(r.tr.W, 2)}, ${fmt(r.oxigeno.diasDesdeMezcla, 0)} días sin mezclarse)` },
    { id: 'oxigeno', nombre: 'Oxígeno del fondo', nivel: r.oxigeno.ODh >= 5 ? 'ok' : (r.oxigeno.ODh >= 2 ? 'aviso' : 'alerta'), texto: r.oxigeno.ODh >= 2 ? `Fondo: ${fmt(r.oxigeno.ODh, 2)} mg/L de oxígeno` : `Fondo sin oxígeno (${fmt(r.oxigeno.ODh, 2)} mg/L)` },
    { id: 'peces', nombre: 'Peces', nivel: r.cultivo.fHoy >= 0.5 && p.peces <= r.cultivo.prodMax ? 'ok' : 'aviso', texto: `Jaulas: ${miles(p.peces)} t/año de ${r.cultivo.nombre.split(' (')[0].toLowerCase()}, cosecha en ${miles(r.cultivo.dias)} días` },
    { id: 'trofico', nombre: 'Estado trófico', nivel: r.nu.tsi < 40 ? 'ok' : (r.nu.tsi < 50 ? 'ok' : (r.nu.tsi < 60 ? 'aviso' : 'alerta')), texto: `${r.nu.clase[0].toUpperCase()}${r.nu.clase.slice(1)}: P = ${fmt(r.nu.P, 1)} µg/L, Secchi ${fmt(r.nu.DS, 1)} m` },
  ];
}

const PINTORES = {
  cuenca({ p, r, c }) {
    const ano = r.ano.meses;
    const filas = ano.map((m) => [m.mes, `${fmt(m.lluvia, 0)} mm`, `${fmt(m.Qcuenca, 2)}`, `${fmt(m.Qevap, 2)}`, { v: `${fmt(m.Qdesague, 2)}`, clase: m.Qdesague < 1e-4 ? 'mal' : '' }, `${conSigno(m.eta, 2)} m`]);
    const tend = r.nivel.dhdt * 86400 * 1000;
    return {
      metricas: [
        ['<b>Entradas y salidas ahora</b>', '', ''],
        ['Entra de la cuenca', r.q.Qcuenca, 'm³/s', '', 2, 'Embalse lineal Q = S/k sobre el área de la cuenca.'],
        ['Lluvia sobre el lago', r.q.Qlluvia, 'm³/s', '', 2],
        ...(p.aporteExterno > 0 ? [['Tributario de aguas arriba (laguna)', p.aporteExterno, 'm³/s', '', 3]] : []),
        ['Evaporación del espejo', r.q.Qevap, 'm³/s', '', 2, '1.05·ET₀ de Hargreaves sobre 55 km².'],
        ['Extracción', r.q.Qext, 'm³/s', '', 2],
        ['Desagüe al río', r.q.Qdesague, 'm³/s', r.q.Qdesague >= r.nivel.Qeco ? 'ok' : 'alerta', 2, 'Q = C·b·η^1.5 con η el nivel sobre el umbral.'],
        ['Nivel sobre el umbral del desagüe', r.nivel.eta, 'm', r.nivel.eta > 0 ? 'ok' : 'aviso', 3],
        ['El nivel', Math.abs(tend) < 0.01 ? 'estable' : `${tend > 0 ? 'sube' : 'baja'} ${fmt(Math.abs(tend), 2)} mm al día`, '', '', 2, 'dh/dt = Q_neto/A.'],
        ['<b>Balance medio del año</b>', '', ''],
        ['Agua que entra (cuenca + lluvia)', r.bal.Qin, 'm³/s', '', 2],
        ['Evaporación del año', r.bal.Eanual, 'mm', '', 0],
        ['Desagüe medio', r.bal.Qdesague, 'm³/s', '', 2],
        ['Tiempo de residencia del agua', r.nu.tau, 'años', '', 1, 'τ = V/(desagüe + extracción).'],
        ['Nivel mínimo del año', r.ano.etaMin, 'm', r.ano.etaMin > -0.3 ? 'ok' : 'alerta', 2],
      ],
      tablas: tablaHTML('Un año mes a mes (m³/s)', ['Mes', 'Lluvia', 'Cuenca', 'Evaporación', 'Desagüe', 'Nivel al final'], filas, { numericas: [1, 2, 3, 4, 5], nota: `Simulación día a día desde el 1 de enero.${r.ano.mesesSinDesague.length ? ` No desagua en ${r.ano.mesesSinDesague.join(', ')}.` : ' Desagua los doce meses.'}` }),
      ecuacion: [
        ecu.tipo('Ecuación lineal: el nivel con caudales fijos'),
        ecu.formula(`d${i('h')}/d${i('t')} = (${sub('Q', 'cuenca')} + ${sub('Q', 'lluvia')} − ${sub('Q', 'evap')} − ${sub('Q', 'ext')} − ${sub('Q', 'desagüe')})/${i('A')}`),
        ecu.sust(`d${i('h')}/d${i('t')} = (${fmt(r.q.Qcuenca, 2)} + ${fmt(r.q.Qlluvia, 2)} − ${fmt(r.q.Qevap, 2)} − ${fmt(r.q.Qext, 2)} − ${fmt(r.q.Qdesague, 2)})/${miles(r.mo.A0)} × 86 400 = ${fmt(tend, 3)} mm/día`),
        ecu.tipo('Función potencia: desagüe natural'),
        ecu.formula(`${i('Q')} = ${i('C')}·${i('b')}·η<sup>1.5</sup>`),
        ecu.sust(`${i('Q')} = ${fmt(S.SITIO.Cdesague, 1)} × ${fmt(p.anchoDesague, 0)} × ${fmt(Math.max(0, r.nivel.eta), 3)}<sup>1.5</sup> = ${fmt(r.q.Qdesague, 3)} m³/s`),
        ecu.tipo('Racional: tiempo de residencia'),
        ecu.formula(`τ = ${i('V')}/${i('Q')}`),
        ecu.sust(`τ = ${miles(r.mo.V)}/(${fmt(r.bal.Qsale, 2)} × 31 536 000) = ${fmt(r.nu.tau, 1)} años`),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Caudal (m³/s)', formatoX: fmtMes, formatoY: (v) => fmt(v, 1), marcasX: MARCAS_MES,
          series: [serieLinea('Entra de la cuenca', ano.map((m, k) => ({ x: k + 1, y: m.Qcuenca + m.Qlluvia })), c.agua), serieLinea('Evaporación', ano.map((m, k) => ({ x: k + 1, y: m.Qevap })), c.ocre), serieLinea('Desagüe al río', ano.map((m, k) => ({ x: k + 1, y: m.Qdesague })), c.ok)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'Lo que entra (cuenca y lluvia), lo que se evapora y lo que desagua cada mes.' },
        { xTitulo: 'Mes', yTitulo: 'Nivel sobre el umbral (m)', formatoX: fmtMes, formatoY: (v) => fmt(v, 2), marcasX: MARCAS_MES,
          series: [serieLinea('Nivel al final del mes', ano.map((m, k) => ({ x: k + 1, y: m.eta })), c.agua), serieGuia('Umbral del desagüe', { x: 1, y: 0 }, { x: 12, y: 0 }, c.tinta2), serieGuia('Límite de referencia (−0.30 m)', { x: 1, y: -0.3 }, { x: 12, y: -0.3 }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: Math.min(-0.4, r.ano.etaMin - 0.05), max: Math.max(0.4, ...ano.map((m) => m.eta + 0.05)) } }, pie: 'Por debajo del umbral el lago deja de desaguar y el río de salida se seca.' },
      ],
    };
  },

  morfometria({ p, r, c }) {
    const mo = r.mo;
    const zs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1].map((f) => f * p.profMax);
    const capas = zs.map((z) => [`${fmt(z, 0)} m`, `${fmt(M.areaProfundidad(z, mo.A0, p.profMax, p.exponente) / 1e6, 2)} km²`, `${fmt(M.volumenBajo(z, mo.A0, p.profMax, p.exponente) / 1e6, 0)} hm³`, `${fmt((100 * M.volumenBajo(z, mo.A0, p.profMax, p.exponente)) / mo.V, 1)} %`]);
    return {
      metricas: [
        ['Volumen del lago', mo.V / 1e6, 'hm³', '', 0, 'V = A₀·z_máx/(m + 1): integral de la hipsometría.'],
        ['Profundidad media', mo.zmed, 'm', '', 1, 'z̄ = V/A₀ = z_máx/(m + 1).'],
        ['Desarrollo del volumen', mo.Vd, '', '', 2, 'V_d = 3·z̄/z_máx: 1 cono, 1.5 paraboloide, 3 cilindro.'],
        ['Desarrollo de la orilla', mo.DL, '', '', 2, 'D_L = P/(2√(πA)): 1 sería un círculo.'],
        ['Profundidad de la termoclina', mo.he, 'm', '', 1],
        ['Volumen del epilimnion', mo.Vepi / 1e6, 'hm³', '', 0, 'V − volumen por debajo de la termoclina.'],
        ['Volumen del hipolimnion', mo.Vhipo / 1e6, 'hm³', '', 0],
        ['Espesor medio del hipolimnion', mo.hh, 'm', '', 1],
        ['Área del fondo bajo la termoclina', mo.Ahipo / 1e6, 'km²', '', 1, 'A(h_e): el fondo que se queda sin oxígeno si hay anoxia.'],
      ],
      tablas: tablaHTML('El lago por capas', ['Profundidad', 'Área', 'Volumen por debajo', 'Del total'], capas, { numericas: [1, 2, 3], nota: 'La mitad del volumen está en la capa de arriba: el área es grande cerca de la superficie y se cierra hacia el fondo.' }),
      ecuacion: [
        ecu.tipo('Función potencia: curva hipsométrica'),
        ecu.formula(`${i('A')}(${i('z')}) = ${sub('A', '0')}·(1 − ${i('z')}/${sub('z', 'máx')})<sup>${i('m')}</sup>`),
        ecu.sust(`${i('A')}(${fmt(mo.he, 0)}) = ${fmt(p.area, 1)} × (1 − ${fmt(mo.he, 0)}/${fmt(p.profMax, 0)})<sup>${fmt(p.exponente, 2)}</sup> = ${fmt(mo.Ahipo / 1e6, 2)} km²`),
        ecu.tipo('Integral de la potencia: volumen y profundidad media'),
        ecu.formula(`${i('V')} = ${sub('A', '0')}·${sub('z', 'máx')}/(${i('m')} + 1),  z̄ = ${sub('z', 'máx')}/(${i('m')} + 1)`),
        ecu.sust(`${i('V')} = ${miles(mo.A0)} × ${fmt(p.profMax, 0)}/${fmt(p.exponente + 1, 2)} = ${fmt(mo.V / 1e6, 0)} hm³;  z̄ = ${fmt(mo.zmed, 1)} m`),
        ecu.tipo('Decimales y raíz: desarrollo de la orilla'),
        ecu.formula(`${sub('D', 'L')} = ${i('P')}/(2√(π${i('A')}))`),
        ecu.sust(`${sub('D', 'L')} = ${miles(p.perimetro * 1000)}/(2√(π × ${miles(mo.A0)})) = ${fmt(mo.DL, 2)}`),
      ].join(''),
      graficas: [
        { xTitulo: 'Área (km²)', yTitulo: 'Profundidad (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(-v, 0),
          series: [serieLinea('A(z)', muestrear((z) => z, 0, p.profMax, 120).map((pt) => ({ x: M.areaProfundidad(pt.x, mo.A0, p.profMax, p.exponente) / 1e6, y: -pt.x })), c.agua, { relleno: 'origin', colorRelleno: 'rgba(28,134,184,0.12)' }), serieGuia('Termoclina', { x: 0, y: -mo.he }, { x: p.area, y: -mo.he }, c.ocre)],
          limites: { x: { min: 0, max: p.area }, y: { min: -p.profMax, max: 0 } }, pie: 'Curva hipsométrica: el área del lago en cada profundidad.' },
        { xTitulo: 'Profundidad z (m)', yTitulo: 'Volumen por debajo (hm³)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Volumen bajo z', muestrear((z) => M.volumenBajo(z, mo.A0, p.profMax, p.exponente) / 1e6, 0, p.profMax, 120), c.agua), seriePuntos('Termoclina', [{ x: mo.he, y: (mo.V - mo.Vepi) / 1e6 }], c.ocre)],
          limites: { x: { min: 0, max: p.profMax }, y: { min: 0 } }, pie: 'Potencia (1 − z/z_máx)^(m+1): el volumen se concentra cerca de la superficie.' },
      ],
    };
  },

  temperatura({ p, r, c }) {
    const tr = r.tr;
    const perfil = muestrear((z) => z, 0, p.profMax, 160).map((pt) => ({ x: M.perfilTemperatura(pt.x, tr.Te, tr.Th, r.mo.he, S.SITIO.espesorTermoclina), y: -pt.x }));
    const filas = r.ano.meses.map((m) => [m.mes, `${fmt(m.Te, 2)} °C`, `${fmt(M.densidad(r.tr.Th) - M.densidad(m.Te), 3)}`, `${fmt(m.W, 2)}`, { v: m.diasMezcla > 15 ? 'mezclado' : 'estratificado', clase: m.diasMezcla > 15 ? 'bien' : '' }]);
    return {
      metricas: [
        ['Temperatura de la superficie hoy', tr.Te, '°C', '', 2, 'T̄ + A·cos(2π(d − 30)/365).'],
        ['Temperatura del hipolimnion', tr.Th, '°C', '', 2],
        ['Densidad de la superficie', M.densidad(tr.Te), 'kg/m³', '', 3, 'ρ = 1000 − 0.0068·(T − 4)².'],
        ['Densidad del fondo', M.densidad(tr.Th), 'kg/m³', '', 3],
        ['Diferencia de densidad', tr.drho, 'kg/m³', '', 3],
        ['Gravedad reducida g\'', tr.gp * 1000, '10⁻³ m/s²', '', 3, 'g\' = g·Δρ/ρ.'],
        ['Frecuencia de flotabilidad N', tr.N * 1000, '10⁻³ 1/s', '', 2, 'N = √(g\'/δ) en la termoclina.'],
        ['Estado del lago', tr.mezcla || r.oxigeno.ventarron ? 'mezclado' : 'estratificado', '', tr.mezcla ? 'ok' : ''],
        ['Días mezclado en el año', r.ano.diasMezcla, 'días', r.ano.diasMezcla > 0 ? 'ok' : 'alerta', 0],
        ['Estratificación seguida más larga', r.ano.maxEstrat, 'días', r.ano.maxEstrat <= 300 ? 'ok' : 'aviso', 0],
      ],
      tablas: tablaHTML('La superficie en el año', ['Mes', 'Superficie', 'Δρ (kg/m³)', 'Wedderburn', 'Estado'], filas, { numericas: [1, 2, 3], nota: 'En los meses fríos y de más viento (julio y agosto) la estratificación se debilita y el viento mezcla el lago: es monomíctico cálido.' }),
      ecuacion: [
        ecu.tipo('Ecuación cuadrática: la densidad del agua'),
        ecu.formula(`${i('ρ')}(${i('T')}) = 1000 − 0.0068·(${i('T')} − 4)²`),
        ecu.sust(`${i('ρ')}(${fmt(tr.Te, 2)}) = ${fmt(M.densidad(tr.Te), 4)};  ${i('ρ')}(${fmt(tr.Th, 2)}) = ${fmt(M.densidad(tr.Th), 4)} kg/m³ → Δ${i('ρ')} = ${fmt(tr.drho, 4)}`),
        ecu.nota('La parábola abre hacia abajo con el vértice en 4 °C: el agua más densa está a 4 °C. Lejos del vértice la curva es más empinada, así que el mismo grado de diferencia separa más las capas en un lago cálido.'),
        ecu.tipo('Función periódica: la superficie en el año'),
        ecu.formula(`${sub('T', 'e')}(${i('d')}) = ${i('T̄')} + ${i('A')}·cos(2π(${i('d')} − 30)/365)`),
        ecu.sust(`${sub('T', 'e')}(${r.d}) = ${fmt(p.Tsuperficie + S.clima(p).dT + p.calentamiento, 1)} + ${fmt(p.amplitudT, 1)} × cos(2π(${r.d} − 30)/365) = ${fmt(tr.Te, 2)} °C`),
        ecu.tipo('Exponencial: perfil logístico'),
        ecu.formula(`${i('T')}(${i('z')}) = ${sub('T', 'h')} + (${sub('T', 'e')} − ${sub('T', 'h')})/(1 + e<sup>(${i('z')} − ${sub('z', 't')})/δ</sup>)`),
      ].join(''),
      graficas: [
        { xTitulo: 'Temperatura (°C)', yTitulo: 'Profundidad (m)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(-v, 0),
          series: [serieLinea('T(z)', perfil, c.alerta), serieGuia('Termoclina', { x: tr.Th - 0.5, y: -r.mo.he }, { x: tr.Te + 0.5, y: -r.mo.he }, c.ocre)],
          limites: { x: { min: Math.floor(tr.Th - 1), max: Math.ceil(tr.Te + 1) }, y: { min: -p.profMax, max: 0 } }, pie: 'Perfil de temperatura: epilimnion tibio arriba, termoclina y agua fría en el fondo.' },
        { xTitulo: 'Temperatura (°C)', yTitulo: 'Densidad (kg/m³)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('ρ(T) = 1000 − 0.0068(T − 4)²', muestrear((T) => M.densidad(T), 0, 25, 100), c.agua), seriePuntos('Vértice (4 °C)', [{ x: 4, y: 1000 }], c.tinta2, 4), seriePuntos('Superficie', [{ x: tr.Te, y: M.densidad(tr.Te) }], c.alerta), seriePuntos('Fondo', [{ x: tr.Th, y: M.densidad(tr.Th) }], c.agua2 || c.agua)],
          limites: { x: { min: 0, max: 25 }, y: { min: 995.5, max: 1000.2 } }, pie: 'Parábola de la densidad: el máximo está en 4 °C.' },
      ],
    };
  },

  viento({ p, r, c }) {
    const tr = r.tr;
    const v = r.viento;
    const Us = muestrear((U) => M.wedderburn(tr.gp, r.mo.he, M.velocidadFriccion(M.esfuerzoViento(U, tr.rhoA)), r.mo.L), 0.5, 15, 120).map((pt) => ({ x: pt.x, y: Math.min(20, pt.y) }));
    const a = 0.05;
    const osc = muestrear((t) => 100 * M.oscilacion(a, v.Ts, t * 60), 0, 3 * v.Ts / 60, 200);
    return {
      metricas: [
        ['Viento de hoy', tr.U, 'm/s', '', 2, 'Sinusoide en el año con el máximo en agosto.'],
        ['Densidad del aire a 3 015 m', tr.rhoA, 'kg/m³', '', 3],
        ['Esfuerzo del viento', tr.tau, 'N/m²', '', 4, 'τ = ρ_a·C_D·U².'],
        ['Velocidad de fricción en el agua', tr.us * 100, 'cm/s', '', 3, 'u* = √(τ/ρ).'],
        ['Número de Wedderburn', tr.W, '', tr.W >= 1 ? 'ok' : 'aviso', 2, 'W = g\'·h_e²/(u*²·L); con W < 1 el viento mezcla el lago.'],
        ['Inclinación de la termoclina', v.Dh, 'm', '', 2, 'Δh = τ·L/(ρ·g\'·h_e).'],
        ['Levantamiento de la superficie', v.Lsup * 1000, 'mm', '', 2, 'Δη = τ·L/(ρ·g·z̄).'],
        ['Seiche superficial (Merian)', v.Ts / 60, 'min', '', 1, 'T = 2L/√(g·z̄).'],
        ['Seiche interna', v.Ti / 86400, 'días', '', 2, 'T_i = 2L/√(g\'·h_e·h_h/(h_e + h_h)).'],
      ],
      ecuacion: [
        ecu.tipo('Ecuación cuadrática: esfuerzo del viento'),
        ecu.formula(`τ = ${sub('ρ', 'a')}·${sub('C', 'D')}·${i('U')}²`),
        ecu.sust(`τ = ${fmt(tr.rhoA, 3)} × 0.0013 × ${fmt(tr.U, 2)}² = ${fmt(tr.tau, 4)} N/m²`),
        ecu.tipo('Racional: número de Wedderburn'),
        ecu.formula(`${i('W')} = ${i("g'")}·${sub('h', 'e')}²/(${i('u')}*²·${i('L')})`),
        ecu.sust(`${i('W')} = ${fmt(tr.gp, 5)} × ${fmt(r.mo.he, 1)}²/(${fmt(tr.us, 5)}² × ${miles(r.mo.L)}) = ${fmt(tr.W, 2)}`),
        ecu.tipo('Raíz cuadrada: seiches de Merian'),
        ecu.formula(`${i('T')} = 2${i('L')}/√(${i('g')}·z̄),  ${sub('T', 'i')} = 2${i('L')}/√(${i("g'")}·${sub('h', 'e')}${sub('h', 'h')}/(${sub('h', 'e')} + ${sub('h', 'h')}))`),
        ecu.sust(`${i('T')} = 2 × ${miles(r.mo.L)}/√(9.81 × ${fmt(r.mo.zmed, 1)}) = ${fmt(v.Ts, 0)} s = ${fmt(v.Ts / 60, 1)} min`),
        ecu.tipo('Función periódica: la seiche se mece'),
        ecu.formula(`η(${i('t')}) = ${i('a')}·cos(2π${i('t')}/${i('T')})`),
      ].join(''),
      graficas: [
        { xTitulo: 'Viento U (m/s)', yTitulo: 'Número de Wedderburn', formatoX: (x) => fmt(x, 0), formatoY: (y) => fmt(y, 0),
          series: [serieLinea('W(U) = g\'h_e²/(u*²L)', Us, c.agua), serieGuia('W = 1', { x: 0.5, y: 1 }, { x: 15, y: 1 }, c.alerta), seriePuntos('Hoy', [{ x: tr.U, y: Math.min(20, tr.W) }], c.ocre)],
          limites: { x: { min: 0, max: 15 }, y: { min: 0, max: 20 } }, pie: 'W baja con el cuadrado del viento: por debajo de 1 el lago se mezcla.' },
        { xTitulo: 'Minutos', yTitulo: 'Nivel en una orilla (cm)', formatoX: (x) => fmt(x, 0), formatoY: (y) => fmt(y, 1),
          series: [serieLinea(`η(t) = a·cos(2πt/T), T = ${fmt(v.Ts / 60, 1)} min`, osc, c.agua)],
          limites: { x: { min: 0, max: 3 * v.Ts / 60 }, y: { min: -6, max: 6 } }, pie: 'Seiche superficial con 5 cm de amplitud: el período lo fija la ecuación de Merian.' },
      ],
    };
  },

  oxigeno({ p, r, c }) {
    const o = r.oxigeno;
    const AHOD = r.nu.AHOD;
    const linea = muestrear((d) => M.oxigenoHipolimnion(o.ODsatFondo, AHOD, r.mo.hh, d), 0, 365, 100);
    return {
      metricas: [
        ['Oxígeno de saturación en la superficie', o.ODsatSup, 'mg/L', '', 2, 'APHA con la presión de 3 015 m.'],
        ['Oxígeno de saturación del agua del fondo', o.ODsatFondo, 'mg/L', '', 2],
        ['Oxígeno del hipolimnion ahora', o.ODh, 'mg/L', o.ODh >= 5 ? 'ok' : (o.ODh >= 2 ? 'aviso' : 'alerta'), 2],
        ['Días sin mezclarse', o.diasDesdeMezcla, 'días', '', 0],
        ['Demanda de oxígeno del hipolimnion', AHOD, 'g/m²·día', '', 3, 'Crece con las algas: 0.15 + 0.05·Chl (referencia).'],
        ['Pendiente del oxígeno del fondo', (1000 * AHOD) / r.mo.hh / 1000, 'mg/L por día', '', 4, 'AHOD/h_h.'],
        ['Días hasta la anoxia (2 mg/L)', o.diasAnoxiaRest, 'días', '', 0, 't = (OD − 2)·h_h/AHOD.'],
        ['Días sin oxígeno en el año', r.ano.diasAnoxia, 'días', r.ano.diasAnoxia === 0 ? 'ok' : 'alerta', 0],
        [`Hábitat del pez de las jaulas (volumen con OD ≥ ${fmt(r.cultivo.ODmin, 0)} mg/L)`, 100 * o.habitat, '%', o.habitat >= 0.7 ? 'ok' : 'aviso', 0],
      ],
      ecuacion: [
        ecu.tipo('Ecuación lineal: el oxígeno del fondo'),
        ecu.formula(`OD(${i('t')}) = ${sub('OD', '0')} − (AHOD/${sub('h', 'h')})·${i('t')}`),
        ecu.sust(`OD(${fmt(o.diasDesdeMezcla, 0)}) = ${fmt(o.ODsatFondo, 2)} − (${fmt(AHOD, 3)}/${fmt(r.mo.hh, 1)}) × ${fmt(o.diasDesdeMezcla, 0)} ≈ ${fmt(o.ODh, 2)} mg/L`),
        ecu.tipo('Raíz de la recta: días hasta la anoxia'),
        ecu.formula(`${i('t')} = (${sub('OD', '0')} − 2)·${sub('h', 'h')}/AHOD`),
        ecu.sust(`${i('t')} = (${fmt(o.ODh, 2)} − 2) × ${fmt(r.mo.hh, 1)}/${fmt(AHOD, 3)} = ${fmt(o.diasAnoxiaRest, 0)} días`),
      ].join(''),
      graficas: [
        { xTitulo: 'Días desde el último mezclado', yTitulo: 'Oxígeno del fondo (mg/L)', formatoX: (x) => fmt(x, 0), formatoY: (y) => fmt(y, 0),
          series: [serieLinea('OD(t) = OD₀ − (AHOD/h_h)·t', linea, c.agua), serieGuia(`${r.cultivo.nombre.split(' (')[0]} (${fmt(r.cultivo.ODmin, 0)} mg/L)`, { x: 0, y: r.cultivo.ODmin }, { x: 365, y: r.cultivo.ODmin }, c.aviso || c.ocre), serieGuia('Anoxia (2 mg/L)', { x: 0, y: 2 }, { x: 365, y: 2 }, c.alerta), seriePuntos('Ahora', [{ x: o.diasDesdeMezcla, y: o.ODh }], c.ocre)],
          limites: { x: { min: 0, max: 365 }, y: { min: 0, max: Math.ceil(o.ODsatFondo + 1) } }, pie: 'Recta de pendiente −AHOD/h_h: con más algas la recta baja más rápido.' },
        { xTitulo: 'Mes', yTitulo: 'Oxígeno mínimo del fondo (mg/L)', formatoX: fmtMes, formatoY: (y) => fmt(y, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Mínimo de cada mes', r.ano.meses.map((m, k) => ({ x: k + 1, y: m.ODmin })), c.agua), serieGuia('Anoxia (2 mg/L)', { x: 1, y: 2 }, { x: 12, y: 2 }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0, max: Math.ceil(o.ODsatFondo + 1) } }, pie: 'El fondo pierde oxígeno de noviembre a abril (estratificado) y se recupera con la mezcla de mitad de año.' },
      ],
    };
  },

  peces({ p, r, c }) {
    const cu = r.cultivo;
    const todas = Object.values(cu.todas);
    const colores = { trucha: c.alerta, capitan: c.ocre, guapucha: c.ok };
    const Tmeses = r.ano.meses.map((m) => m.Te);
    const Tlo = Math.min(...Tmeses), Thi = Math.max(...Tmeses);
    const nombreCorto = (e) => e.nombre.split(' (')[0];
    const diasMax = Math.min(720, Math.max(...todas.map((e) => (Number.isFinite(e.dias) ? e.dias : 0))) * 1.1 + 30);
    return {
      metricas: [
        [`<b>${cu.nombre}</b> · <i>${cu.cientifico}</i>`, '', ''],
        ['Origen', cu.origen, ''],
        ['Temperatura del agua de las jaulas hoy', r.tr.Te, '°C', '', 2, 'Epilimnion.'],
        ['Crecimiento frente al óptimo hoy', 100 * cu.fHoy, '%', cu.fHoy >= 0.5 ? 'ok' : 'aviso', 0, `Óptimo de ${fmt(cu.Topt, 0)} °C; nada fuera de ${fmt(cu.Tmin, 0)}–${fmt(cu.Tmax, 0)} °C.`],
        ['Crecimiento en el mes menos favorable', 100 * cu.fMin, '%', cu.fMin >= 0.5 ? 'ok' : 'aviso', 0],
        ['Tasa de crecimiento media del año', 100 * cu.G, '% al día', '', 2, 'G = G_máx·f(T) promedio.'],
        ['Peso de siembra → peso de cosecha', `${fmt(cu.W0, cu.W0 < 1 ? 1 : 0)} → ${fmt(cu.Wf, 0)} g`, ''],
        ['Días a la cosecha', cu.dias, 'días', '', 0, 't = ln(W_f/W₀)/G.'],
        ['Conversión de alimento (FCA)', cu.FCA, 'kg/kg', '', 2],
        ['Alimento del año', cu.alimento, 't', '', 0, 'FCA × producción.'],
        ['Fósforo que queda en el lago por tonelada', cu.LP, 'kg/t', '', 2, 'L_P = 1000·(FCA·p_a − p_p).'],
        ['Fósforo de las jaulas al lago', r.nu.fuentes.jaulas, 'kg/año', '', 0],
        ['Producción que aguanta el lago', cu.prodMax, 't/año', p.peces <= cu.prodMax ? 'ok' : 'alerta', 0, 'Hasta llegar a la carga admisible de Vollenweider con las demás fuentes.'],
        ['Oxígeno mínimo de la especie', cu.ODmin, 'mg/L', '', 0],
        ['Hábitat con ese oxígeno', 100 * r.oxigeno.habitat, '%', r.oxigeno.habitat >= 0.7 ? 'ok' : 'aviso', 0],
      ],
      tablas: tablaHTML('Las especies para las jaulas, en este lago', ['Especie', 'Origen', 'Óptimo (°C)', 'Rango (°C)', 'OD mín. (mg/L)', 'FCA', 'kg P/t', 'Días a la cosecha', 'Producción máxima (t/año)', 'Datos'],
        todas.map((e) => [{ v: nombreCorto(e), clase: e.clave === cu.clave ? 'total' : '' }, e.origen.split(':')[0].split(';')[0], fmt(e.Topt, 0), `${fmt(e.Tmin, 0)}–${fmt(e.Tmax, 0)}`, fmt(e.ODmin, 0), fmt(e.FCA, 1), fmt(e.LP, 1), miles(e.dias), { v: miles(e.prodMax), clase: p.peces > e.prodMax ? 'mal' : '' }, e.datos]),
        { numericas: [2, 4, 5, 6, 7, 8], nota: `Producción de ${miles(p.peces)} t/año con alimento de ${fmt(p.pAlimento, 2)} % de fósforo. «Datos»: medidos en Tota (trucha), ensayos de cultivo (capitán, AUNAP y UDCA) o supuestos de referencia (guapucha).` }),
      ecuacion: [
        ecu.tipo('Por tramos y cuadrática: el crecimiento según la temperatura'),
        ecu.formula(`${i('f')}(${i('T')}) = 1 − ((${sub('T', 'opt')} − ${i('T')})/(${sub('T', 'opt')} − ${sub('T', 'mín')}))² si ${i('T')} ≤ ${sub('T', 'opt')};  1 − ((${i('T')} − ${sub('T', 'opt')})/(${sub('T', 'máx')} − ${sub('T', 'opt')}))² si ${i('T')} > ${sub('T', 'opt')};  0 fuera del rango`),
        ecu.sust(`${i('f')}(${fmt(r.tr.Te, 2)}) = 1 − ((${fmt(cu.Topt, 0)} − ${fmt(r.tr.Te, 2)})/(${fmt(cu.Topt, 0)} − ${fmt(r.tr.Te <= cu.Topt ? cu.Tmin : cu.Tmax, 0)}))² = ${fmt(cu.fHoy, 3)}`),
        ecu.tipo('Exponencial y logarítmica: el pez crece y se cosecha'),
        ecu.formula(`${i('W')}(${i('t')}) = ${sub('W', '0')}·e<sup>${i('G')}·${i('t')}</sup>,  ${i('t')} = ln(${sub('W', 'f')}/${sub('W', '0')})/${i('G')}`),
        ecu.sust(`${i('t')} = ln(${fmt(cu.Wf, 0)}/${fmt(cu.W0, cu.W0 < 1 ? 1 : 0)})/${fmt(cu.G, 5)} = ${miles(cu.dias)} días`),
        ecu.tipo('Lineal: el fósforo del alimento que no se vuelve pescado'),
        ecu.formula(`${sub('L', 'P')} = 1000·(FCA·${sub('p', 'a')} − ${sub('p', 'p')}) = 1000 × (${fmt(cu.FCA, 2)} × ${fmt(p.pAlimento / 100, 4)} − ${fmt(cu.pPez, 4)}) = ${fmt(cu.LP, 2)} kg/t`),
        ecu.tipo('Racional: la producción que aguanta el lago'),
        ecu.formula(`${sub('T', 'máx')} = (${sub('L', 'c')} − ${sub('L', 'otras')})/${sub('L', 'P')} = (${miles(r.nu.Lc)} − ${miles(r.nu.carga - r.nu.fuentes.jaulas)})/${fmt(cu.LP, 2)} = ${miles(cu.prodMax)} t/año`),
      ].join(''),
      graficas: [
        { xTitulo: 'Temperatura del agua (°C)', yTitulo: 'Crecimiento frente al óptimo', formatoX: (x) => fmt(x, 0), formatoY: (y) => `${fmt(100 * y, 0)} %`,
          series: [...todas.map((e) => serieLinea(nombreCorto(e), muestrear((T) => M.factorTermico(T, e.Topt, e.Tmin, e.Tmax), 2, 26, 241), colores[e.clave], { ancho: e.clave === cu.clave ? 3 : 1.5, punteada: e.clave !== cu.clave })),
            serieGuia('Agua de las jaulas en el año (mín.)', { x: Tlo, y: 0 }, { x: Tlo, y: 1 }, c.agua, { punteada: true, ancho: 1 }), serieGuia('(máx.)', { x: Thi, y: 0 }, { x: Thi, y: 1 }, c.agua, { punteada: true, ancho: 1 }), seriePuntos('Hoy', [{ x: r.tr.Te, y: cu.fHoy }], c.tinta)],
          limites: { x: { min: 2, max: 26 }, y: { min: 0, max: 1.05 } }, pie: 'Parábolas por tramos: cada especie crece más cerca de su óptimo. Las líneas azules marcan la temperatura del epilimnion en el año.' },
        { xTitulo: 'Días desde la siembra', yTitulo: 'Peso / peso de cosecha', formatoX: (x) => fmt(x, 0), formatoY: (y) => `${fmt(100 * y, 0)} %`,
          series: [...todas.map((e) => serieLinea(`${nombreCorto(e)}: ${fmt(e.W0, e.W0 < 1 ? 1 : 0)} → ${fmt(e.Wf, 0)} g en ${miles(e.dias)} días`, muestrear((t) => M.pesoPez(e.W0, e.G, t) / e.Wf, 0, Math.min(diasMax, Number.isFinite(e.dias) ? e.dias : diasMax), 160), colores[e.clave], { ancho: e.clave === cu.clave ? 3 : 1.5, punteada: e.clave !== cu.clave })), serieGuia('Cosecha', { x: 0, y: 1 }, { x: diasMax, y: 1 }, c.tinta2), seriePuntos('Cosecha de cada especie', todas.filter((e) => Number.isFinite(e.dias) && e.dias <= diasMax).map((e) => ({ x: e.dias, y: 1 })), c.tinta)],
          limites: { x: { min: 0, max: diasMax }, y: { min: 0, max: 1.05 } }, pie: 'Crecimiento exponencial en el agua de este lago: la curva corta la línea de cosecha a los ln(W_f/W₀)/G días.' },
      ],
    };
  },

  nutrientes({ p, r, c }) {
    const nu = r.nu;
    const nombres = { ...Object.fromEntries(Object.entries(S.FUENTES).map(([k, f]) => [k, f.nombre])), interna: 'Fondo sin oxígeno (carga interna)', externo: 'Tributario de aguas arriba' };
    const filas = Object.entries(nu.fuentes).filter(([k, v]) => v > 0 || k !== 'externo').map(([k, v]) => [nombres[k], `${miles(v)} kg/año`, `${fmt((100 * v) / nu.carga, 1)} %`]);
    filas.push({ clase: 'total', celdas: ['Total', `${miles(nu.carga)} kg/año`, '100 %'] });
    const Lmax = techoRedondo(Math.max(nu.carga, nu.Lc) * 1.6);
    const Pde = (L) => M.fosforoLago(M.fosforoEntrada(L, nu.Vsale), nu.tau);
    return {
      metricas: [
        ['Carga de fósforo', nu.carga, 'kg/año', nu.carga <= nu.Lc ? 'ok' : 'alerta', 0],
        ['Carga admisible (P ≤ 20 µg/L)', nu.Lc, 'kg/año', '', 0, 'L_c = P_c·Q·(1 + √τ).'],
        ['Fósforo del agua que entra', nu.Pin, 'µg/L', '', 1, 'Carga/agua que sale en el año (la evaporación concentra).'],
        ['Tiempo de residencia', nu.tau, 'años', '', 1],
        ['Fósforo total del lago', nu.P, 'µg/L', nu.P <= 20 ? 'ok' : 'alerta', 1, 'Vollenweider: P = P_in/(1 + √τ).'],
        ['Índice de Carlson', nu.tsi, '', nu.tsi < 50 ? 'ok' : 'aviso', 1, 'TSI = 14.42·ln P + 4.15.'],
        ['Estado trófico', nu.clase, ''],
        ['Clorofila esperada', nu.Chl, 'µg/L', '', 2, 'Equivalencia de Carlson: e^((TSI − 30.6)/9.81).'],
        ['Transparencia esperada (Secchi)', nu.DS, 'm', '', 2, 'e^((60 − TSI)/14.41).'],
        ['Zona fótica (1 % de la luz)', nu.zEu, 'm', nu.zEu >= 5 ? 'ok' : 'aviso', 1, 'ln(100)/k con k = 1.7/DS.'],
      ],
      tablas: tablaHTML('Fuentes de fósforo del lago', ['Fuente', 'Carga', 'Parte'], filas, { numericas: [1, 2], nota: 'Coeficientes de exportación de referencia (tabla del modelo). La carga interna aparece cuando el fondo pasa días sin oxígeno.' }),
      ecuacion: [
        ecu.tipo('Lineal: la carga es la suma de las fuentes'),
        ecu.formula(`${i('L')} = 8·${sub('A', 'c')} + 1.0·${sub('A', 'cebolla')} + ${sub('L', 'P')}·${i('T')} + 0.6·hab·(1 − ${i('r')}) + ${sub('L', 'interna')},  ${sub('L', 'P')} = ${fmt(r.cultivo.LP, 2)} kg/t (${r.cultivo.nombre.split(' (')[0].toLowerCase()})`),
        ecu.tipo('Racional con raíz: Vollenweider'),
        ecu.formula(`${i('P')} = ${sub('P', 'in')}/(1 + √τ),  ${sub('L', 'c')} = ${sub('P', 'c')}·${i('Q')}·(1 + √τ)`),
        ecu.sust(`${i('P')} = ${fmt(nu.Pin, 1)}/(1 + √${fmt(nu.tau, 1)}) = ${fmt(nu.P, 1)} µg/L`),
        ecu.tipo('Logarítmica y exponencial: Carlson'),
        ecu.formula(`TSI = 14.42·ln ${i('P')} + 4.15,  DS = e<sup>(60 − TSI)/14.41</sup>`),
        ecu.sust(`TSI = 14.42 × ln ${fmt(nu.P, 1)} + 4.15 = ${fmt(nu.tsi, 1)} → DS = ${fmt(nu.DS, 2)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Carga de fósforo (kg/año)', yTitulo: 'Fósforo del lago (µg/L)', formatoX: (x) => miles(x), formatoY: (y) => fmt(y, 0),
          series: [serieLinea('P(L): recta por el origen', [{ x: 0, y: 0 }, { x: Lmax, y: Pde(Lmax) }], c.agua), serieGuia('P crítico (20 µg/L)', { x: 0, y: 20 }, { x: Lmax, y: 20 }, c.alerta), seriePuntos('Carga admisible', [{ x: nu.Lc, y: 20 }], c.tinta2, 4), seriePuntos('Ahora', [{ x: nu.carga, y: nu.P }], c.ocre)],
          limites: { x: { min: 0, max: Lmax }, y: { min: 0 } }, pie: 'Con el agua del año fija, el fósforo del lago es proporcional a la carga: la carga admisible es donde la recta llega a 20 µg/L.' },
        { xTitulo: 'Fósforo (µg/L)', yTitulo: 'Índice de Carlson', formatoX: (x) => fmt(x, 0), formatoY: (y) => fmt(y, 0),
          series: [serieLinea('TSI = 14.42·ln P + 4.15', muestrear((P) => M.tsiFosforo(P), 1, 150, 150), c.agua), serieGuia('Mesotrófico (40)', { x: 1, y: 40 }, { x: 150, y: 40 }, c.ok), serieGuia('Eutrófico (50)', { x: 1, y: 50 }, { x: 150, y: 50 }, c.ocre), seriePuntos('Ahora', [{ x: nu.P, y: nu.tsi }], c.alerta)],
          limites: { x: { min: 0, max: 150 }, y: { min: 0, max: 80 } }, pie: 'Curva logarítmica: cada vez que el fósforo se duplica el índice sube 10 puntos.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'lagos',
  tabInicial: 'cuenca',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Lagos andinos',
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
    velocidades: [{ valor: 3600, nombre: '1 h por segundo' }, { valor: 21600, nombre: '6 h por segundo' }, { valor: 86400, nombre: '1 día por segundo' }, { valor: 864000, nombre: '10 días por segundo' }, { valor: 2592000, nombre: '30 días por segundo' }],
    defecto: 86400,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 21600, nombre: '6 h' }, { valor: 86400, nombre: '1 día' }, { valor: 604800, nombre: '1 semana' }],
    intervaloDefecto: 86400,
    columnas: [
      { clave: 'eta', nombre: 'Nivel sobre el umbral', unidad: 'm', dec: 3 },
      { clave: 'Qcuenca', nombre: 'Entra de la cuenca', unidad: 'm³/s', dec: 2 },
      { clave: 'Qdesague', nombre: 'Desagüe', unidad: 'm³/s', dec: 2 },
      { clave: 'Te', nombre: 'Superficie', unidad: '°C', dec: 2 },
      { clave: 'W', nombre: 'Wedderburn', unidad: '', dec: 2 },
      { clave: 'ODh', nombre: 'Oxígeno del fondo', unidad: 'mg/L', dec: 2 },
    ],
    tomar: (p, r) => ({ eta: r.nivel.eta, Qcuenca: r.q.Qcuenca, Qdesague: r.q.Qdesague, Te: r.tr.Te, W: Math.min(999, r.tr.W), ODh: r.oxigeno.ODh }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'general', nombre: 'Lago', titulo: 'El lago en su valle' },
    { id: 'corte', nombre: 'Corte', titulo: 'Corte del lago: capas de temperatura y oxígeno' },
    { id: 'cuenca', nombre: 'Cuenca', titulo: 'La cuenca con la cebolla y los pueblos' },
    { id: 'jaulas', nombre: 'Jaulas', titulo: 'Las jaulas de peces y la boya de medición' },
  ],
});
