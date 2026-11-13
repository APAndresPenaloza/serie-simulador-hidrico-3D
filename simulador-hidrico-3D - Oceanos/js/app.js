/**
 * app.js — Simulador de océanos: pestañas, controles, resultados, ecuaciones con valores
 * sustituidos y gráficas. El controlador común está en nucleo/app-base.js.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';
import * as N from './nodo.js';
import { Escena } from './escena3d.js';
import { hojasExcel } from './hojas.js';
import { iniciarSimulador, ecu, i, sub, tablaHTML } from './nucleo/app-base.js';
import { fmt, miles, MESES, muestrear, conSigno } from './nucleo/formato.js';
import { serieLinea, seriePuntos, serieGuia } from './nucleo/graficas.js';

const opciones = (obj) => Object.entries(obj).map(([valor, o]) => ({ valor, nombre: o.nombre }));
const MARCAS_MES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fmtMes = (v) => MESES[Math.round(v) - 1] ?? '';
const NIVEL_ALERTA = ['ok', 'ok', 'aviso', 'alerta', 'alerta'];

const TABS = [
  { id: 'olas', nombre: 'Olas', graficas: 2, intro: 'Los alisios soplan sobre el Caribe casi todo el año y levantan las olas: si el viento sopla el tiempo suficiente sobre una distancia grande, el mar llega a un estado de equilibrio que solo depende de la velocidad del viento. Las olas guardan energía y la llevan hasta la costa; sus alturas no son todas iguales sino que siguen una distribución de probabilidad.' },
  { id: 'mareas', nombre: 'Mareas', graficas: 2, intro: 'La marea es la suma de ondas con períodos que fijan la Luna y el Sol. En el Caribe es pequeña y mixta, principalmente diurna. Cuando dos ondas de períodos parecidos se suman, unas veces se refuerzan y otras se cancelan: así aparecen las semanas de marea grande y de marea pequeña.' },
  { id: 'viento', nombre: 'Viento y corrientes', graficas: 2, intro: 'Por la rotación de la Tierra, el agua que empuja el viento no va en la misma dirección que el viento: en el hemisferio norte se desvía a la derecha. Frente a La Guajira los alisios soplan paralelos a la costa y el agua de la superficie se va mar afuera; para reemplazarla sube agua fría y rica en nutrientes desde el fondo: es el afloramiento, que hace de esa costa una de las más productivas en pesca.' },
  { id: 'niebla', nombre: 'Bosque de niebla', graficas: 2, tablas: true, intro: 'En la punta de La Guajira, en medio del desierto, la Serranía de Macuira (Parque Nacional Natural desde 1977, unas 25 000 ha en el resguardo wayuu; cerro Palúa, 867 m) tiene un bosque de niebla desde los 550 m. Los alisios traen aire húmedo del mar: al subir por la serranía se enfría hasta su punto de rocío y forma nubes que envuelven las cumbres. El bosque atrapa el agua de esas nubes con sus hojas, musgos y bromelias: en 1985 recibió casi tanta agua de la niebla (796 mm) como de la lluvia (853 mm). Con mallas (atrapanieblas) se puede recoger esa agua para las comunidades wayuu. Si el aire se calienta y se seca, la base de las nubes sube y el bosque queda por debajo de ella.' },
  { id: 'temperatura', nombre: 'Temperatura y coral', graficas: 2, tablas: true, intro: 'El mar del Caribe es cálido arriba y frío abajo: entre las dos capas está la termoclina. Los corales viven cerca de su límite: cuando el agua pasa más de 1 °C su máxima media mensual durante semanas, expulsan las algas que les dan color y alimento, y se blanquean. El calor acumulado se mide en grados-semana (DHW).' },
  { id: 'salinidad', nombre: 'Salinidad y densidad', graficas: 2, intro: 'El Magdalena entrega al mar miles de metros cúbicos de agua dulce por segundo. Frente a la boca forma una capa menos salada que flota sobre el mar. La densidad del agua de mar baja con la temperatura y sube con la sal; las diferencias de densidad estratifican el océano.' },
  { id: 'nivel', nombre: 'Nivel del mar', graficas: 2, intro: 'El nivel del mar sube porque el agua se dilata al calentarse y porque se derrite el hielo de los glaciares y de Groenlandia y la Antártida. Hoy sube unos 3 a 4 mm al año y cada vez más rápido: la curva es una parábola. Ese nivel es el que reciben la ciénaga, el delta y la playa.' },
  { id: 'carbono', nombre: 'Carbono y acidez', graficas: 2, intro: 'El océano absorbe cerca de una cuarta parte del CO₂ que emitimos. Al disolverse forma ácido carbónico y el pH del mar baja. Con menos iones carbonato, al coral le cuesta más construir su esqueleto de aragonito.' },
];

const CONTROLES = [
  { tab: 'olas', grupo: 'Escenario' },
  { tab: 'olas', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS), escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio: El Niño, La Niña, alisios más fuertes, una gran creciente del Magdalena, menos niebla en Macuira o los años 2050 y 2100.' },
  { tab: 'olas', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS), extra: (v) => `Temperatura ${conSigno(S.CLIMAS[v].dT, 1)} °C, viento × ${fmt(S.CLIMAS[v].fU, 2)}, humedad del aire ${conSigno(S.CLIMAS[v].dHR, 0)} %.` },
  { tab: 'olas', grupo: 'Los alisios' },
  { tab: 'olas', id: 'U0', clave: 'U0', etiqueta: 'Velocidad media del viento', unidad: 'm/s', min: 1, max: 20, paso: 0.1, dec: 1 },
  { tab: 'olas', id: 'Ua', clave: 'Ua', etiqueta: 'Variación con la temporada (máximo a comienzos de febrero)', unidad: 'm/s', min: 0, max: 8, paso: 0.1, dec: 1 },

  { tab: 'mareas', grupo: 'Amplitudes de la marea' },
  { tab: 'mareas', id: 'K1', clave: 'K1', etiqueta: 'K1 (diurna lunisolar, 23.93 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'mareas', id: 'O1', clave: 'O1', etiqueta: 'O1 (diurna lunar, 25.82 h)', unidad: 'm', min: 0, max: 1, paso: 0.01, dec: 2 },
  { tab: 'mareas', id: 'M2', clave: 'M2', etiqueta: 'M2 (semidiurna lunar, 12.42 h)', unidad: 'm', min: 0, max: 3, paso: 0.01, dec: 2 },
  { tab: 'mareas', id: 'S2', clave: 'S2', etiqueta: 'S2 (semidiurna solar, 12 h)', unidad: 'm', min: 0, max: 1.5, paso: 0.01, dec: 2 },

  { tab: 'viento', grupo: 'Coriolis y Ekman' },
  { tab: 'viento', id: 'lat', clave: 'lat', etiqueta: 'Latitud', unidad: '°N', min: 1, max: 60, paso: 0.5, dec: 1 },
  { tab: 'viento', id: 'Cd', clave: 'Cd', etiqueta: 'Coeficiente de arrastre del viento', unidad: '', min: 0.0008, max: 0.0025, paso: 0.0001, dec: 4 },
  { tab: 'viento', id: 'Az', clave: 'Az', etiqueta: 'Viscosidad turbulenta vertical', unidad: 'm²/s', min: 0.001, max: 0.1, paso: 0.001, dec: 3 },
  { tab: 'viento', id: 'anchoAfloramiento', clave: 'anchoAfloramiento', etiqueta: 'Ancho de la franja de afloramiento', unidad: 'km', min: 5, max: 100, paso: 1, dec: 0 },
  { tab: 'viento', id: 'enfriamiento', clave: 'enfriamiento', etiqueta: 'Enfriamiento por cada m/día de afloramiento', unidad: '°C', min: 0, max: 0.5, paso: 0.01, dec: 2 },

  { tab: 'niebla', grupo: 'El aire que traen los alisios' },
  { tab: 'niebla', id: 'HR', clave: 'HR', etiqueta: 'Humedad relativa media del aire', unidad: '%', min: 50, max: 98, paso: 0.5, dec: 1, extra: (v, p, r) => `Ahora ${fmt(r.mac.aire.HR, 1)} % con ${fmt(r.mac.aire.T, 1)} °C: punto de rocío ${fmt(r.mac.aire.Td, 1)} °C.`, doc: 'Sube 10 % en la madrugada y baja 10 % en la tarde; también cambia con la temporada.' },
  { tab: 'niebla', id: 'HRa', clave: 'HRa', etiqueta: 'Variación con la temporada (máxima en octubre)', unidad: '%', min: 0, max: 15, paso: 0.5, dec: 1 },
  { tab: 'niebla', id: 'dHRcal', clave: 'dHRcal', etiqueta: 'Humedad que se pierde por cada °C de calentamiento', unidad: '%/°C', min: 0, max: 5, paso: 0.1, dec: 1, doc: 'Con el calentamiento global el aire se seca y la base de las nubes sube (Still et al., 1999).' },
  { tab: 'niebla', grupo: 'El bosque de niebla' },
  { tab: 'niebla', id: 'etaBosque', clave: 'etaBosque', etiqueta: 'Parte de la niebla que atrapa el bosque', unidad: '', min: 0, max: 0.3, paso: 0.001, dec: 3, doc: 'Eficiencia del dosel por metro cuadrado de suelo (hojas, musgos, bromelias y epífitas).' },
  { tab: 'niebla', id: 'lluviaMacuira', clave: 'lluviaMacuira', etiqueta: 'Lluvia del año en la serranía', unidad: 'mm', min: 0, max: 3000, paso: 10, dec: 0 },
  { tab: 'niebla', grupo: 'Atrapanieblas para una comunidad wayuu' },
  { tab: 'niebla', id: 'nAtrapa', clave: 'nAtrapa', etiqueta: 'Número de atrapanieblas', unidad: '', min: 0, max: 40, paso: 1, dec: 0 },
  { tab: 'niebla', id: 'areaMalla', clave: 'areaMalla', etiqueta: 'Área de malla de cada uno', unidad: 'm²', min: 1, max: 200, paso: 1, dec: 0, doc: 'Un atrapanieblas grande es una malla de 12 m × 4 m (48 m²).' },
  { tab: 'niebla', id: 'etaMalla', clave: 'etaMalla', etiqueta: 'Eficiencia de la malla', unidad: '', min: 0.05, max: 0.5, paso: 0.01, dec: 2, doc: 'Malla Raschel: atrapa cerca de la quinta parte del agua de la niebla que la atraviesa.' },
  { tab: 'niebla', id: 'zAtrapa', clave: 'zAtrapa', etiqueta: 'Altura de los atrapanieblas', unidad: 'm', min: 100, max: 860, paso: 10, dec: 0, doc: 'Más arriba hay más agua líquida en la nube y más horas de niebla.' },
  { tab: 'niebla', id: 'personas', clave: 'personas', etiqueta: 'Personas de la comunidad', unidad: '', min: 1, max: 500, paso: 1, dec: 0 },
  { tab: 'niebla', id: 'litrosPersona', clave: 'litrosPersona', etiqueta: 'Agua por persona al día', unidad: 'L', min: 5, max: 100, paso: 1, dec: 0 },

  { tab: 'temperatura', grupo: 'Temperatura del mar' },
  { tab: 'temperatura', id: 'Tmedia', clave: 'Tmedia', etiqueta: 'Temperatura media de la superficie', unidad: '°C', min: 20, max: 32, paso: 0.1, dec: 1 },
  { tab: 'temperatura', id: 'Tamp', clave: 'Tamp', etiqueta: 'Variación con la temporada (máximo en octubre)', unidad: '°C', min: 0, max: 4, paso: 0.1, dec: 1 },
  { tab: 'temperatura', id: 'Tfondo', clave: 'Tfondo', etiqueta: 'Temperatura bajo la termoclina', unidad: '°C', min: 4, max: 20, paso: 0.5, dec: 1 },
  { tab: 'temperatura', id: 'zMezcla', clave: 'zMezcla', etiqueta: 'Profundidad de la termoclina', unidad: 'm', min: 10, max: 150, paso: 1, dec: 0 },
  { tab: 'temperatura', id: 'delta', clave: 'delta', etiqueta: 'Espesor de la termoclina', unidad: 'm', min: 2, max: 60, paso: 1, dec: 0 },
  { tab: 'temperatura', id: 'tauSST', clave: 'tauSST', etiqueta: 'Tiempo de respuesta de la superficie', unidad: 'días', min: 2, max: 90, paso: 1, dec: 0 },
  { tab: 'temperatura', grupo: 'Arrecife de coral' },
  { tab: 'temperatura', id: 'MMM', clave: 'MMM', etiqueta: 'Máxima media mensual del arrecife (MMM)', unidad: '°C', min: 25, max: 32, paso: 0.1, dec: 1 },

  { tab: 'salinidad', grupo: 'El río en el mar' },
  { tab: 'salinidad', id: 'Smar', clave: 'Smar', etiqueta: 'Salinidad del mar abierto', unidad: 'PSU', min: 30, max: 40, paso: 0.1, dec: 1 },
  { tab: 'salinidad', id: 'Qrio', clave: 'Qrio', etiqueta: 'Caudal del río grande', unidad: 'm³/s', min: 0, max: 30000, paso: 100, dec: 0 },
  { tab: 'salinidad', id: 'areaPluma', clave: 'areaPluma', etiqueta: 'Área de mar frente a la boca', unidad: 'km²', min: 100, max: 20000, paso: 100, dec: 0 },
  { tab: 'salinidad', id: 'espesorPluma', clave: 'espesorPluma', etiqueta: 'Espesor de la capa de la pluma', unidad: 'm', min: 1, max: 50, paso: 1, dec: 0 },
  { tab: 'salinidad', id: 'renovacion', clave: 'renovacion', etiqueta: 'Tiempo de renovación de esa agua', unidad: 'días', min: 1, max: 90, paso: 1, dec: 0 },

  { tab: 'nivel', grupo: 'El año del horizonte' },
  { tab: 'nivel', id: 'anoHorizonte', clave: 'anoHorizonte', etiqueta: 'Año del horizonte', unidad: '', min: 2026, max: 2150, paso: 1, dec: 0, doc: 'Las proyecciones del nivel del mar, la temperatura y el carbono se calculan para este año; el nivel del mar es el que reciben la ciénaga, el delta y la costa.' },
  { tab: 'nivel', id: 'tasaMar', clave: 'tasaMar', etiqueta: 'Ascenso del mar hoy', unidad: 'mm/año', min: 0, max: 20, paso: 0.1, dec: 1 },
  { tab: 'nivel', id: 'aceleracion', clave: 'aceleracion', etiqueta: 'Aceleración del ascenso', unidad: 'mm/año²', min: 0, max: 0.3, paso: 0.005, dec: 3 },
  { tab: 'nivel', id: 'calentamiento', clave: 'calentamiento', etiqueta: 'Calentamiento de la superficie', unidad: '°C/año', min: 0, max: 0.08, paso: 0.001, dec: 3 },

  { tab: 'carbono', grupo: 'CO₂ y química del mar' },
  { tab: 'carbono', id: 'CO2', clave: 'CO2', etiqueta: 'CO₂ del aire hoy', unidad: 'ppm', min: 280, max: 600, paso: 1, dec: 0 },
  { tab: 'carbono', id: 'rCO2', clave: 'rCO2', etiqueta: 'Crecimiento anual del CO₂', unidad: '1/año', min: -0.01, max: 0.02, paso: 0.0005, dec: 4 },
  { tab: 'carbono', id: 'pH0', clave: 'pH0', etiqueta: 'pH del mar hoy', unidad: '', min: 7.6, max: 8.3, paso: 0.01, dec: 2 },
  { tab: 'carbono', id: 'Om0', clave: 'Om0', etiqueta: 'Saturación de aragonito hoy', unidad: '', min: 1, max: 5, paso: 0.05, dec: 2 },
];

function estados(p, r) {
  return [
    { id: 'olas', nombre: 'Olas', nivel: r.q.Hs <= 4 ? 'ok' : 'aviso', texto: `Olas: H_s ${fmt(r.q.Hs, 2)} m, T ${fmt(r.q.Tp, 1)} s` },
    { id: 'coral', nombre: 'Coral', nivel: NIVEL_ALERTA[r.alerta.nivel], texto: `Arrecife: ${fmt(r.T, 2)} °C, ${r.alerta.nombre}` },
    { id: 'afloramiento', nombre: 'Afloramiento', nivel: 'ok', texto: `La Guajira: ${fmt(r.Tg, 2)} °C (afloramiento de ${fmt(r.q.wDia, 1)} m/día)` },
    { id: 'niebla', nombre: 'Bosque de niebla', nivel: r.a.niebla >= 500 ? 'ok' : 'alerta', texto: `Macuira: nubes desde ${miles(r.mac.aire.zb)} m · ${miles(r.a.niebla)} mm de niebla al año` },
    { id: 'nivel', nombre: 'Nivel del mar', nivel: r.fu.nivel <= 300 ? 'ok' : 'aviso', texto: `Mar en ${p.anoHorizonte}: ${conSigno(r.fu.nivel / 10, 1)} cm` },
    { id: 'ph', nombre: 'pH', nivel: r.fu.Om >= 3 ? 'ok' : 'alerta', texto: `pH ${fmt(r.fu.pH, 3)}, aragonito ${fmt(r.fu.Om, 2)}` },
  ];
}

const PINTORES = {
  olas({ p, r, c }) {
    const q = r.q, a = r.a;
    const Hmax = Math.max(4, q.Hs * 2.2);
    return {
      metricas: [
        ['Viento ahora', q.U, 'm/s', '', 2],
        ['Altura significativa (Pierson y Moskowitz)', q.Hs, 'm', q.Hs <= 4 ? 'ok' : 'aviso', 2, '0.21·U²/g.'],
        ['Período pico', q.Tp, 's', '', 2, '7.16·U/g.'],
        ['Celeridad en aguas profundas', q.C0, 'm/s', '', 2, 'g·T/(2π).'],
        ['Longitud de onda', q.L0, 'm', '', 1, 'g·T²/(2π).'],
        ['Energía por metro cuadrado', q.E / 1000, 'kJ/m²', '', 2, 'ρ·g·H_s²/16.'],
        ['Potencia por metro de cresta', q.P / 1000, 'kW/m', '', 1, 'ρ·g²·H_s²·T_e/(64π).'],
        [`Ola más alta en ${S.SITIO.horasOleaje} horas (${miles(q.N)} olas)`, q.Hmax, 'm', '', 2, 'H_s·√(ln N/2).'],
        ['Altura significativa máxima del año', a.Hsmax, 'm', a.Hsmax <= 4 ? 'ok' : 'aviso', 2],
        ['Potencia media del año', a.P / 1000, 'kW/m', '', 1],
      ],
      ecuacion: [
        ecu.tipo('Cuadrática y lineal: el mar que levanta el viento'),
        ecu.formula(`${sub('H', 's')} = 0.21·${i('U')}²/${i('g')} = 0.21 × ${fmt(q.U, 2)}²/9.81 = ${fmt(q.Hs, 3)} m,  ${sub('T', 'p')} = 7.16·${i('U')}/${i('g')} = ${fmt(q.Tp, 2)} s`),
        ecu.tipo('Lineal y cuadrática: celeridad y longitud de onda'),
        ecu.formula(`${sub('C', '0')} = ${i('g')}${i('T')}/(2π) = ${fmt(q.C0, 2)} m/s,  ${sub('L', '0')} = ${i('g')}${i('T')}²/(2π) = ${fmt(q.L0, 1)} m`),
        ecu.tipo('Función potencia: energía que llevan las olas'),
        ecu.formula(`${i('P')} = ρ${i('g')}²${sub('H', 's')}²${sub('T', 'e')}/(64π) = 1025 × 9.81² × ${fmt(q.Hs, 2)}² × ${fmt(q.Te, 2)}/(64π) = ${fmt(q.P / 1000, 2)} kW/m`),
        ecu.tipo('Exponencial y raíz con logaritmo: la ola más alta'),
        ecu.formula(`P(${i('H')} > ${i('x')}) = e<sup>−2(${i('x')}/${sub('H', 's')})²</sup>,  ${sub('H', 'máx')} = ${sub('H', 's')}·√(ln ${i('N')}/2) = ${fmt(q.Hs, 2)} × √(ln ${miles(q.N)}/2) = ${fmt(q.Hmax, 2)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Mes', yTitulo: 'Altura significativa (m)', formatoX: fmtMes, formatoY: (v) => fmt(v, 1), marcasX: MARCAS_MES,
          series: [serieLinea('Media del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.Hs })), c.agua), serieLinea('Máxima del mes', a.meses.map((m, k) => ({ x: k + 1, y: m.Hsmax })), c.agua, { punteada: true, ancho: 1.5 }), serieLinea('Viento (m/s ÷ 4)', a.meses.map((m, k) => ({ x: k + 1, y: m.U / 4 })), c.tinta2, { punteada: true, ancho: 1 })],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'Con los alisios de diciembre a marzo el mar es más alto; en septiembre está en calma.' },
        { xTitulo: 'Altura de una ola (m)', yTitulo: 'Probabilidad de pasarla', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('P(H > x) = e^(−2(x/H_s)²)', muestrear((x) => M.probRayleigh(x, q.Hs), 0, Hmax, 150), c.agua), serieGuia('Altura significativa', { x: q.Hs, y: 0 }, { x: q.Hs, y: 1 }, c.tinta2), seriePuntos('Ola más alta', [{ x: q.Hmax, y: M.probRayleigh(q.Hmax, q.Hs) }], c.alerta)],
          limites: { x: { min: 0, max: Hmax }, y: { min: 0, max: 1 } }, pie: 'Solo una ola de cada siete pasa la altura significativa (e⁻² ≈ 0.135).' },
      ],
    };
  },

  mareas({ p, r, c }) {
    const amps = S.amplitudes(p);
    const t0 = r.t / 3600;
    const mes = muestrear((h) => M.marea(h, amps, { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 }), t0, t0 + 24 * 30, 720).map((pt) => ({ x: (pt.x - t0) / 24, y: pt.y }));
    const dia = (comp) => muestrear((h) => M.marea(h, { [comp]: amps[comp] }, { K1: 0.6, O1: 2.1, M2: 1.3, S2: 0.4 }), t0, t0 + 48, 200).map((pt) => ({ x: pt.x - t0, y: pt.y }));
    const rango = 2 * (p.K1 + p.O1 + p.M2 + p.S2);
    return {
      metricas: [
        ['Marea ahora', r.q.eta, 'm', '', 3],
        ['Número de forma F = (K1 + O1)/(M2 + S2)', r.F, '', '', 2],
        ['Tipo de marea', r.F < 0.25 ? 'semidiurna' : (r.F < 1.5 ? 'mixta, principalmente semidiurna' : (r.F < 3 ? 'mixta, principalmente diurna' : 'diurna')), ''],
        ['Rango máximo (todas las ondas juntas)', rango, 'm', '', 2],
        ['Ciclo de mareas vivas y muertas (M2 con S2)', r.mareaViva, 'días', '', 2, '1/(1/12 − 1/12.42) h.'],
        ['Ciclo de la marea diurna (K1 con O1)', r.mareaTropica, 'días', '', 2, '1/(1/23.93 − 1/25.82) h: manda en el Caribe.'],
      ],
      ecuacion: [
        ecu.tipo('Suma de cosenos (periódica): la marea'),
        ecu.formula(`η(${i('t')}) = Σ ${sub('a', 'i')}·cos(2π${i('t')}/${sub('T', 'i')} − ${sub('φ', 'i')}) = ${fmt(r.q.eta, 3)} m`),
        ecu.tipo('Racional: el batido de dos ondas'),
        ecu.formula(`${sub('T', 'batido')} = 1/|1/${sub('T', '1')} − 1/${sub('T', '2')}|`),
        ecu.sust(`K1 y O1: 1/|1/23.934 − 1/25.819| = ${fmt(r.mareaTropica * 24, 1)} h = ${fmt(r.mareaTropica, 2)} días;  M2 y S2: ${fmt(r.mareaViva * 24, 1)} h = ${fmt(r.mareaViva, 2)} días`),
      ].join(''),
      graficas: [
        { xTitulo: 'Días desde ahora', yTitulo: 'Marea (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 2),
          series: [serieLinea('η(t)', mes, c.agua)],
          limites: { x: { min: 0, max: 30 } }, pie: 'Un mes: las ondas K1 y O1 se refuerzan y se cancelan cada 13.7 días.' },
        { xTitulo: 'Horas desde ahora', yTitulo: 'Marea (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 2), marcasX: [0, 6, 12, 18, 24, 30, 36, 42, 48],
          series: [serieLinea('K1', dia('K1'), c.agua), serieLinea('O1', dia('O1'), c.ok), serieLinea('M2', dia('M2'), c.ocre), serieLinea('S2', dia('S2'), c.tinta2)],
          limites: { x: { min: 0, max: 48 } }, pie: 'Dos días de cada onda: las diurnas (K1 y O1) son las más grandes en el Caribe.' },
      ],
    };
  },

  viento({ p, r, c }) {
    const q = r.q, a = r.a;
    const V0 = q.tau / (M.RHO * Math.sqrt(Math.abs(q.f) * p.Az));      // corriente de Ekman en la superficie
    const espiral = [];
    for (let z = 0; z <= q.DE * 1.2; z += q.DE / 30) {
      const e = M.espiralEkman(z, V0, q.DE);
      const ang = (-e.giro * Math.PI) / 180;            // a la derecha del viento (que sopla hacia +y)
      espiral.push({ x: e.rapidez * Math.sin(-ang), y: e.rapidez * Math.cos(ang) });
    }
    return {
      metricas: [
        ['Viento ahora', q.U, 'm/s', '', 2],
        ['Esfuerzo del viento τ = ρ_a·C_D·U²', q.tau, 'Pa', '', 3],
        ['Parámetro de Coriolis f = 2Ω·sin φ', q.f * 1e5, '×10⁻⁵ 1/s', '', 3],
        ['Transporte de Ekman M = τ/(ρ·f)', q.Mek, 'm²/s', '', 2, 'm³/s por cada metro de costa, a 90° del viento.'],
        ['Profundidad de Ekman D = π·√(2A_z/f)', q.DE, 'm', '', 1],
        ['Velocidad del afloramiento', q.wDia, 'm/día', '', 1, 'M/(ancho de la franja).'],
        ['Afloramiento máximo del año', a.wMax, 'm/día', '', 1],
        ['Temperatura en La Guajira ahora', r.Tg, '°C', '', 2],
        ['Más fría del año en La Guajira', a.Tgmin, '°C', '', 2],
      ],
      ecuacion: [
        ecu.tipo('Trigonométrica: Coriolis'),
        ecu.formula(`${i('f')} = 2Ω·sin φ = 2 × 7.292·10⁻⁵ × sin ${fmt(p.lat, 1)}° = ${q.f.toExponential(3).replace('e-', '·10⁻').replace(/(\d+)$/, (d) => d.split('').map((x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[x]).join(''))} 1/s`),
        ecu.tipo('Cuadrática: esfuerzo del viento'),
        ecu.formula(`τ = ${sub('ρ', 'a')}·${sub('C', 'D')}·${i('U')}² = 1.2 × ${fmt(p.Cd, 4)} × ${fmt(q.U, 2)}² = ${fmt(q.tau, 4)} Pa`),
        ecu.tipo('Racional: transporte de Ekman'),
        ecu.formula(`${i('M')} = τ/(ρ·${i('f')}) = ${fmt(q.tau, 4)}/(1025 × ${fmt(q.f * 1e5, 3)}·10⁻⁵) = ${fmt(q.Mek, 2)} m²/s`),
        ecu.tipo('Raíz cuadrada: profundidad de Ekman'),
        ecu.formula(`${i('D')} = π·√(2${sub('A', 'z')}/${i('f')}) = π × √(2 × ${fmt(p.Az, 3)}/${fmt(q.f * 1e5, 3)}·10⁻⁵) = ${fmt(q.DE, 1)} m`),
        ecu.tipo('Lineal: el afloramiento enfría la superficie'),
        ecu.formula(`${sub('T', 'Guajira')} = ${sub('T', 'mar')} − ${i('c')}·${i('w')} = ${fmt(q.SSTeq, 2)} − ${fmt(p.enfriamiento, 2)} × ${fmt(q.wDia, 1)} = ${fmt(q.SSTgEq, 2)} °C (equilibrio)`),
      ].join(''),
      graficas: [
        { xTitulo: 'A la derecha del viento (cm/s)', yTitulo: 'En la dirección del viento (cm/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Espiral de Ekman (punta de la corriente a cada profundidad)', espiral.map((e) => ({ x: 100 * e.x, y: 100 * e.y })), c.agua), serieLinea('Viento (dirección)', [{ x: 0, y: 0 }, { x: 0, y: 100 * V0 * 1.2 }], c.tinta2, { punteada: true }), seriePuntos('Superficie', [{ x: 100 * espiral[0].x, y: 100 * espiral[0].y }], c.ocre)],
          limites: { x: { min: -100 * V0 * 0.2, max: 100 * V0 * 1.0 }, y: { min: -100 * V0 * 0.6, max: 100 * V0 * 1.25 } }, pie: 'La corriente de la superficie va 45° a la derecha del viento; más abajo gira más y se debilita.' },
        { xTitulo: 'Mes', yTitulo: 'Temperatura (°C)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Mar adentro', a.meses.map((m, k) => ({ x: k + 1, y: m.T })), c.alerta), serieLinea('La Guajira (afloramiento)', a.meses.map((m, k) => ({ x: k + 1, y: m.Tg })), c.agua), serieLinea('Afloramiento (m/día ÷ 4 + 20)', a.meses.map((m, k) => ({ x: k + 1, y: 20 + m.wDia / 4 })), c.tinta2, { punteada: true, ancho: 1 })],
          limites: { x: { min: 1, max: 12 }, y: { min: 20, max: 32 } }, pie: 'Con los alisios fuertes de febrero sube el agua fría frente a La Guajira.' },
      ],
    };
  },

  niebla({ p, r, c }) {
    const a = r.a, mac = r.mac, aire = mac.aire, nb = mac.nb;
    const { zBosque, zCima } = S.SITIO.macuira;
    const d = r.q.d;
    const dia = muestrear((h) => S.aireMacuira(p, d, h, r.Tg).zb, 0, 24, 97);
    const enNube = aire.zb < zCima;
    const espesor = Math.max(0, zCima - aire.zb);
    const xMes = (k) => k + 1;
    const nombreMes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return {
      metricas: [
        ['<b>El aire de los alisios ahora</b>', '', ''],
        ['Temperatura del aire en la costa', aire.T, '°C', '', 1, 'Mar de La Guajira + 0.5 °C, con el ciclo del día.'],
        ['Humedad relativa', aire.HR, '%', '', 1],
        ['Punto de rocío (Magnus)', aire.Td, '°C', '', 2, 'T_d = b·γ/(a − γ), γ = ln(HR/100) + a·T/(b + T).'],
        ['Base de las nubes', aire.zb, 'm', aire.zb <= zBosque ? 'ok' : (enNube ? '' : 'aviso'), 0, 'z_b = 125·(T − T_d).'],
        ['La cima (cerro Palúa, 867 m)', enNube ? 'dentro de la nube' : 'sobre la base de las nubes, sin niebla', ''],
        ['Espesor de nube sobre la serranía', espesor, 'm', '', 0],
        ['Parte del bosque dentro de la nube', 100 * nb.dentro, '%', '', 0, 'Del límite del bosque (550 m) a la cima.'],
        ['Temperatura en la cima', mac.Tcima, '°C', '', 1, 'Adiabática seca bajo la base y húmeda dentro de la nube.'],
        ['Agua líquida de la nube en el bosque', nb.lwcBosque, 'g/m³', '', 3],
        ['Viento de los alisios', r.q.U, 'm/s', '', 1],
        ['Niebla que atrapa el bosque a este ritmo', mac.mmDia, 'mm/día', '', 2, 'η·LWC·U por m² de suelo.'],
        ['<b>El año en Macuira</b>', '', ''],
        ['Agua de niebla del año', a.niebla, 'mm', a.niebla >= 500 ? 'ok' : 'alerta', 0],
        ['Lluvia del año', a.lluvia, 'mm', '', 0],
        ['Parte del agua del bosque que viene de la niebla', 100 * a.pctNiebla, '%', '', 0],
        ['Base media de las nubes', a.zb, 'm', '', 0],
        ['Horas del año con la cima en la nube', a.hCima, 'h', '', 0, `${fmt(100 * a.hCima / 8760, 0)} % del año.`],
        ['Horas con todo el bosque en la nube', a.hBosque, 'h', '', 0, `${fmt(100 * a.hBosque / 8760, 0)} % del año: la base de las nubes por debajo de 550 m.`],
        ['<b>Atrapanieblas</b>', '', ''],
        ['Agua por m² de malla ahora', mac.litrosM2Dia, 'L/(m²·día)', '', 2],
        ['Agua por m² de malla en el año', a.litros, 'L/(m²·día)', '', 2],
        ['Malla instalada', mac.malla, 'm²', '', 0],
        ['Agua de los atrapanieblas (media del año)', mac.aguaAno, 'L/día', '', 0, `Alcanza para ${fmt(mac.personasAno, 0)} personas a ${fmt(p.litrosPersona, 0)} L por día.`],
        [`Agua en el mes de menos niebla (${nombreMes[a.mesPeorNiebla]})`, mac.aguaPeor, 'L/día', mac.aguaPeor >= mac.demanda ? 'ok' : 'aviso', 0, `Lo que necesita la comunidad: ${miles(mac.demanda)} L/día.`],
      ],
      tablas: tablaHTML('La niebla y la lluvia en la Serranía de Macuira', ['Mes', 'Viento (m/s)', 'Mar (°C)', 'Base de nubes (m)', 'Horas con la cima en la nube', 'Niebla (mm)', 'Lluvia (mm)', 'Atrapanieblas (L/m²·día)'], a.meses.map((m, k) => [m.mes, fmt(m.U, 1), fmt(m.Tg, 1), { v: miles(m.zb), clase: m.zb > zBosque + 100 ? 'mal' : '' }, miles(m.hCima), fmt(m.niebla, 0), fmt(m.lluvia, 0), { v: fmt(m.litros, 2), clase: k === a.mesPeorNiebla ? 'mal' : '' }]), { numericas: [1, 2, 3, 4, 5, 6, 7], nota: 'Medias de cada mes; la base de las nubes cambia hora por hora (más baja en la madrugada). Bosque de niebla desde 550 m; cerro Palúa, 867 m.' }),
      ecuacion: [
        ecu.tipo('Logarítmica y racional: el punto de rocío (Magnus)'),
        ecu.formula(`γ = ln(HR/100) + ${i('a')}·${i('T')}/(${i('b')} + ${i('T')}),  ${sub('T', 'd')} = ${i('b')}·γ/(${i('a')} − γ),  ${i('a')} = 17.625, ${i('b')} = 243.04 °C`),
        ecu.sust(`γ = ln(${fmt(aire.HR / 100, 3)}) + 17.625 × ${fmt(aire.T, 2)}/(243.04 + ${fmt(aire.T, 2)}) = ${fmt(Math.log(aire.HR / 100) + (17.625 * aire.T) / (243.04 + aire.T), 4)} → ${sub('T', 'd')} = ${fmt(aire.Td, 2)} °C`),
        ecu.tipo('Lineal: la base de las nubes'),
        ecu.formula(`${sub('z', 'b')} = 125·(${i('T')} − ${sub('T', 'd')}) = 125 × (${fmt(aire.T, 2)} − ${fmt(aire.Td, 2)}) = ${miles(aire.zb)} m`),
        ecu.nota('El aire que sube se enfría 9.8 °C por kilómetro y su punto de rocío solo 1.8: se encuentran a unos 125 m por cada grado de diferencia.'),
        ecu.tipo('Por tramos: la temperatura del aire que sube'),
        ecu.formula(`${i('T')}(${i('z')}) = ${i('T')} − 0.0098·${i('z')} si ${i('z')} ≤ ${sub('z', 'b')};  ${i('T')} − 0.0098·${sub('z', 'b')} − 0.006·(${i('z')} − ${sub('z', 'b')}) si ${i('z')} > ${sub('z', 'b')}  →  ${i('T')}(867 m) = ${fmt(mac.Tcima, 1)} °C`),
        ecu.tipo('Por tramos: agua líquida de la nube'),
        ecu.formula(`LWC(${i('z')}) = mín(${fmt(S.SITIO.LWCmax, 2)}, máx(0, ${fmt(S.SITIO.gradLWC, 4)}·(${i('z')} − ${sub('z', 'b')}))) g/m³`),
        ecu.tipo('Producto: el agua que atrapan el bosque y la malla'),
        ecu.formula(`${i('F')} = η·LWC·${i('U')} = ${fmt(p.etaMalla, 2)} × ${fmt(nb.lwcAtrapa, 3)} × ${fmt(r.q.U, 1)} = ${fmt(nb.Fmalla, 4)} g/(m²·s) = ${fmt(mac.litrosM2Dia, 2)} L/(m²·día) en la malla`),
        ecu.sust(`Bosque: η = ${fmt(p.etaBosque, 3)} → ${fmt(mac.mmDia, 2)} mm/día; en el año ${miles(a.niebla)} mm de niebla y ${miles(a.lluvia)} mm de lluvia (${fmt(100 * a.pctNiebla, 0)} % de niebla).`),
      ].join(''),
      graficas: [
        { xTitulo: 'Hora del día', yTitulo: 'Altura (m)', formatoX: (v) => `${fmt(v, 0)} h`, formatoY: (v) => miles(v), marcasX: [0, 3, 6, 9, 12, 15, 18, 21, 24],
          series: [serieLinea('Base de las nubes hoy', dia, c.agua, { relleno: false }), serieGuia('Cima (cerro Palúa, 867 m)', { x: 0, y: zCima }, { x: 24, y: zCima }, c.tinta2), serieGuia('Límite del bosque de niebla (550 m)', { x: 0, y: zBosque }, { x: 24, y: zBosque }, c.ok), serieGuia('Atrapanieblas', { x: 0, y: p.zAtrapa }, { x: 24, y: p.zAtrapa }, c.ocre, { punteada: true, ancho: 1 }), seriePuntos('Ahora', [{ x: r.hora, y: aire.zb }], c.alerta)],
          limites: { x: { min: 0, max: 24 }, y: { min: 0, max: 1200, paso: 300 } }, pie: 'De noche el aire se enfría, se humedece y la base de las nubes baja: el bosque queda dentro de la nube. En la tarde sube.' },
        { xTitulo: 'Mes', yTitulo: 'Agua (mm al mes)', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Niebla que atrapa el bosque', a.meses.map((m, k) => ({ x: xMes(k), y: m.niebla })), c.agua, { relleno: true, colorRelleno: 'rgba(28, 134, 184, 0.30)' }), serieLinea('Lluvia', a.meses.map((m, k) => ({ x: xMes(k), y: m.lluvia })), c.ok), serieLinea('Atrapanieblas (L/m²·día × 5)', a.meses.map((m, k) => ({ x: xMes(k), y: 5 * m.litros })), c.ocre, { punteada: true })],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'De diciembre a abril casi no llueve, pero los alisios fuertes traen la niebla: el bosque vive de ella en la temporada seca.' },
      ],
    };
  },

  temperatura({ p, r, c }) {
    const a = r.a;
    const perfil = muestrear((z) => M.perfilTemperatura(z, r.T, p.Tfondo, p.zMezcla, p.delta), 0, 300, 150).map((pt) => ({ x: pt.y, y: -pt.x }));
    const alertaMes = a.meses.map((m) => M.alertaCoral(m.Tmax - p.MMM, m.dhw));
    return {
      metricas: [
        ['Temperatura de la superficie en el arrecife', r.T, '°C', '', 2],
        ['HotSpot (sobre la MMM)', r.hotspot, '°C', r.hotspot < 1 ? 'ok' : 'alerta', 2],
        ['Calor acumulado (DHW, 12 semanas)', r.DHW, '°C·semana', r.DHW < 4 ? 'ok' : 'alerta', 1],
        ['Alerta de hoy', r.alerta.nombre, ''],
        ['Temperatura máxima del año', a.Tmax, '°C', a.Tmax <= p.MMM + 1 ? 'ok' : 'aviso', 2],
        ['DHW máximo del año', a.dhwMax, '°C·semana', a.dhwMax < 4 ? 'ok' : 'alerta', 1],
        ['Peor alerta del año', r.alertaPeor.nombre, ''],
        ['Temperatura a 200 m', M.perfilTemperatura(200, r.T, p.Tfondo, p.zMezcla, p.delta), '°C', '', 2],
      ],
      tablas: tablaHTML('El arrecife en el año', ['Mes', 'Media (°C)', 'Máxima (°C)', 'DHW máximo', 'Alerta'], a.meses.map((m, k) => [m.mes, fmt(m.T, 2), fmt(m.Tmax, 2), fmt(m.dhw, 1), { v: alertaMes[k].nombre.split(':')[0], clase: alertaMes[k].nivel >= 3 ? 'mal' : '' }]), { numericas: [1, 2, 3], nota: `MMM del arrecife: ${fmt(p.MMM, 1)} °C. Alerta 1 con 4 °C·semana; alerta 2 con 8.` }),
      ecuacion: [
        ecu.tipo('Periódica y exponencial: la temperatura de la superficie'),
        ecu.formula(`${sub('T', 'eq')}(${i('d')}) = ${i('T̄')} + ${i('A')}·cos(2π(${i('d')} − 280)/365) + anomalía;  ${i('T')}(${i('t')} + Δ${i('t')}) = ${sub('T', 'eq')} + (${i('T')} − ${sub('T', 'eq')})·e<sup>−Δ${i('t')}/τ</sup>`),
        ecu.tipo('Logística: la termoclina'),
        ecu.formula(`${i('T')}(${i('z')}) = ${sub('T', 'f')} + (${sub('T', 's')} − ${sub('T', 'f')})/(1 + e<sup>(${i('z')} − ${sub('z', 't')})/δ</sup>)`),
        ecu.sust(`${i('T')}(${fmt(p.zMezcla, 0)} m) = ${fmt(p.Tfondo, 1)} + (${fmt(r.T, 2)} − ${fmt(p.Tfondo, 1)})/2 = ${fmt(M.perfilTemperatura(p.zMezcla, r.T, p.Tfondo, p.zMezcla, p.delta), 2)} °C: a la mitad del salto`),
        ecu.tipo('Suma por tramos: grados-semana de calor (DHW)'),
        ecu.formula(`DHW = (1/7)·Σ HotSpot  (solo los días con HotSpot ≥ 1 °C, en las últimas 12 semanas) = ${fmt(r.DHW, 2)} °C·semana → ${r.alerta.nombre}`),
      ].join(''),
      graficas: [
        { xTitulo: 'Temperatura (°C)', yTitulo: 'Profundidad (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(-v, 0),
          series: [serieLinea('T(z) logística', perfil, c.alerta), serieGuia('Termoclina', { x: p.Tfondo, y: -p.zMezcla }, { x: Math.ceil(r.T + 1), y: -p.zMezcla }, c.tinta2)],
          limites: { x: { min: Math.floor(p.Tfondo - 1), max: Math.ceil(r.T + 1) }, y: { min: -300, max: 0 } }, pie: 'Cálida y mezclada arriba; la temperatura cae rápido en la termoclina.' },
        { xTitulo: 'Mes', yTitulo: 'Temperatura (°C) · DHW', formatoX: fmtMes, formatoY: (v) => fmt(v, 0), marcasX: MARCAS_MES,
          series: [serieLinea('Temperatura media', a.meses.map((m, k) => ({ x: k + 1, y: m.T })), c.alerta), serieGuia('MMM + 1 °C', { x: 1, y: p.MMM + 1 }, { x: 12, y: p.MMM + 1 }, c.alerta), serieLinea('DHW máximo (°C·semana)', a.meses.map((m, k) => ({ x: k + 1, y: m.dhw })), c.ocre, { punteada: true })],
          limites: { x: { min: 1, max: 12 }, y: { min: 0, max: Math.max(32, Math.ceil(a.Tmax + 1), Math.ceil(a.dhwMax + 2)) } }, pie: 'Cuando la temperatura pasa la línea roja, el calor se acumula y el coral se blanquea.' },
      ],
    };
  },

  salinidad({ p, r, c }) {
    const pl = r.pl;
    const Qmax = Math.max(20000, p.Qrio * 1.5);
    const Ss = muestrear((Q) => M.salinidadPluma(p.Smar, pl.V, Q, p.renovacion * M.SEG_DIA), 0, Qmax, 120);
    const Tz = (z) => M.perfilTemperatura(z, r.T, p.Tfondo, p.zMezcla, p.delta);
    const dens = muestrear((z) => M.densidad(Tz(z), z < 5 ? pl.Sarrecife : 36.6), 0, 300, 150).map((pt) => ({ x: pt.y, y: -pt.x }));
    return {
      metricas: [
        ['Caudal del río grande', p.Qrio, 'm³/s', '', 0],
        ['Volumen de mar frente a la boca', pl.V / 1e9, 'km³', '', 1],
        ['Salinidad frente a la boca', pl.S, 'PSU', '', 2, 'S_mar·V/(V + Q·τ).'],
        ['Parte de agua de río frente a la boca', 100 * pl.fRio, '%', '', 1],
        ['Salinidad en el arrecife', pl.Sarrecife, 'PSU', pl.Sarrecife >= 34 ? 'ok' : 'aviso', 2],
        ['Densidad en la superficie del arrecife', r.rhoSup, 'kg/m³', '', 2],
        ['Densidad a 200 m', r.rho200, 'kg/m³', '', 2],
        ['Diferencia de densidad', r.rho200 - r.rhoSup, 'kg/m³', '', 2, 'Cuanto mayor, más estratificado el mar.'],
      ],
      ecuacion: [
        ecu.tipo('Racional y decimales: el río se mezcla con el mar'),
        ecu.formula(`${i('S')} = ${sub('S', 'mar')}·${i('V')}/(${i('V')} + ${i('Q')}·τ)`),
        ecu.sust(`${i('S')} = ${fmt(p.Smar, 1)} × ${fmt(pl.V / 1e9, 1)}·10⁹/(${fmt(pl.V / 1e9, 1)}·10⁹ + ${miles(p.Qrio)} × ${miles(p.renovacion * 86400)}) = ${fmt(pl.S, 2)} PSU`),
        ecu.tipo('Exponencial: la pluma se diluye mar afuera'),
        ecu.formula(`${sub('S', 'arrecife')} = ${i('S')} + (${sub('S', 'mar')} − ${i('S')})·(1 − e<sup>−${i('x')}/${i('L')}</sup>) = ${fmt(pl.Sarrecife, 2)} PSU con ${i('x')} = ${S.SITIO.xArrecife} km y ${i('L')} = ${S.SITIO.Lpluma} km`),
        ecu.tipo('Lineal: ecuación de estado del agua de mar'),
        ecu.formula(`ρ = ${sub('ρ', '0')}[1 − α(${i('T')} − 25) + β(${i('S')} − 35)],  α = 2.6·10⁻⁴ 1/°C,  β = 7.6·10⁻⁴ 1/PSU`),
        ecu.sust(`ρ = 1023.6 × [1 − 2.6·10⁻⁴ × (${fmt(r.T, 2)} − 25) + 7.6·10⁻⁴ × (${fmt(pl.Sarrecife, 2)} − 35)] = ${fmt(r.rhoSup, 2)} kg/m³`),
      ].join(''),
      graficas: [
        { xTitulo: 'Caudal del río (m³/s)', yTitulo: 'Salinidad (PSU)', formatoX: (v) => miles(v), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Frente a la boca', Ss, c.agua), serieLinea('En el arrecife', Ss.map((pt) => ({ x: pt.x, y: pt.y + (p.Smar - pt.y) * (1 - Math.exp(-S.SITIO.xArrecife / S.SITIO.Lpluma)) })), c.ok), serieGuia('Límite del arrecife (34)', { x: 0, y: 34 }, { x: Qmax, y: 34 }, c.alerta), seriePuntos('Ahora', [{ x: p.Qrio, y: pl.S }, { x: p.Qrio, y: pl.Sarrecife }], c.ocre)],
          limites: { x: { min: 0, max: Qmax }, y: { min: 0, max: Math.ceil(p.Smar + 1) } }, pie: 'Con más caudal, más agua dulce: la curva racional baja sin llegar a cero.' },
        { xTitulo: 'Densidad (kg/m³)', yTitulo: 'Profundidad (m)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(-v, 0),
          series: [serieLinea('ρ(z)', dens, c.agua)],
          limites: { y: { min: -300, max: 0 } }, pie: 'El agua cálida de arriba es más liviana: el mar está estratificado.' },
      ],
    };
  },

  nivel({ p, r, c }) {
    const fu = r.fu;
    const fin = Math.max(2100, p.anoHorizonte);
    const curva = (a, b) => muestrear((ano) => M.ascensoMar(ano - 2026, a, b) / 10, 2026, fin, 100);
    return {
      metricas: [
        ['Año del horizonte', p.anoHorizonte, '', '', 0],
        ['Ascenso del mar desde 2026', fu.nivel / 10, 'cm', fu.nivel <= 300 ? 'ok' : 'aviso', 1, 'a·t + b·t².'],
        ['Rapidez del ascenso en ese año', p.tasaMar + 2 * p.aceleracion * fu.t, 'mm/año', '', 2, 'Derivada: a + 2b·t.'],
        ['Calentamiento de la superficie', p.calentamiento * fu.t, '°C', '', 2],
        ['Expansión térmica si 700 m se calentaran igual', fu.termico / 10, 'cm', '', 1, 'α·ΔT·H: cota superior; las capas hondas se calientan menos.'],
        ['Nivel medio que reciben la ciénaga, el delta y la costa', fu.nivel / 1000, 'm', '', 3],
      ],
      ecuacion: [
        ecu.tipo('Cuadrática: el mar sube cada vez más rápido'),
        ecu.formula(`${i('h')}(${i('t')}) = ${i('a')}·${i('t')} + ${i('b')}·${i('t')}²`),
        ecu.sust(`${i('h')}(${fu.t}) = ${fmt(p.tasaMar, 2)} × ${fu.t} + ${fmt(p.aceleracion, 3)} × ${fu.t}² = ${fmt(fu.nivel, 1)} mm`),
        ecu.tipo('Lineal: expansión térmica'),
        ecu.formula(`Δ${i('h')} = α·Δ${i('T')}·${i('H')} = 2.6·10⁻⁴ × ${fmt(p.calentamiento * fu.t, 2)} × 700 = ${fmt(fu.termico / 1000, 3)} m`),
      ].join(''),
      graficas: [
        { xTitulo: 'Año', yTitulo: 'Ascenso desde 2026 (cm)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('h(t) = a·t + b·t²', curva(p.tasaMar, p.aceleracion), c.agua), serieLinea('Sin aceleración (recta)', curva(p.tasaMar, 0), c.tinta2, { punteada: true, ancho: 1 }), serieLinea('Muchas emisiones (b = 0.08)', curva(p.tasaMar, 0.08), c.alerta, { punteada: true, ancho: 1 }), seriePuntos('Horizonte', [{ x: p.anoHorizonte, y: fu.nivel / 10 }], c.ocre)],
          limites: { x: { min: 2026, max: fin }, y: { min: 0 } }, pie: 'La parábola se separa de la recta: el término b·t² manda a largo plazo.' },
        { xTitulo: 'Año', yTitulo: 'Rapidez del ascenso (mm/año)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('a + 2b·t', [{ x: 2026, y: p.tasaMar }, { x: fin, y: p.tasaMar + 2 * p.aceleracion * (fin - 2026) }], c.agua)],
          limites: { x: { min: 2026, max: fin }, y: { min: 0 } }, pie: 'La derivada de una parábola es una recta.' },
      ],
    };
  },

  carbono({ p, r, c }) {
    const fu = r.fu;
    const fin = Math.max(2100, p.anoHorizonte);
    const C = (ano) => M.co2(ano - 2026, p.CO2, p.rCO2);
    const ph = (ano) => M.phMar(C(ano), p.CO2, p.pH0);
    return {
      metricas: [
        [`CO₂ del aire en ${p.anoHorizonte}`, fu.C, 'ppm', '', 0, 'C₀·e^(r·t).'],
        [`pH del mar en ${p.anoHorizonte}`, fu.pH, '', '', 3, 'pH₀ − 0.9·log₁₀(C/C₀).'],
        ['Iones H⁺ comparados con hoy', fu.H / fu.H0, 'veces', '', 2, '10^(pH₀ − pH).'],
        ['Saturación de aragonito', fu.Om, '', fu.Om >= 3 ? 'ok' : 'alerta', 2],
        ['Calcificación del coral', fu.calcificacion, ''],
      ],
      ecuacion: [
        ecu.tipo('Exponencial: el CO₂ del aire'),
        ecu.formula(`${i('C')}(${i('t')}) = ${sub('C', '0')}·e<sup>${i('r')}·${i('t')}</sup> = ${miles(p.CO2)} × e<sup>${fmt(p.rCO2, 4)} × ${fu.t}</sup> = ${fmt(fu.C, 1)} ppm`),
        ecu.tipo('Logarítmica: el pH'),
        ecu.formula(`pH = −log₁₀[H⁺];  pH = ${sub('pH', '0')} − 0.9·log₁₀(${i('C')}/${sub('C', '0')}) = ${fmt(p.pH0, 2)} − 0.9 × log₁₀(${fmt(fu.C / p.CO2, 3)}) = ${fmt(fu.pH, 3)}`),
        ecu.sust(`[H⁺] = 10<sup>−${fmt(fu.pH, 3)}</sup> = ${fu.H.toExponential(2)} mol/L: ${fmt(fu.H / fu.H0, 2)} veces el de hoy`),
        ecu.tipo('Exponencial y por tramos: aragonito y calcificación'),
        ecu.formula(`Ω = ${sub('Ω', '0')}·10<sup>0.7(pH − ${sub('pH', '0')})</sup> = ${fmt(p.Om0, 2)} × 10<sup>0.7 × (${fmt(fu.pH - p.pH0, 3)})</sup> = ${fmt(fu.Om, 2)} → ${fu.calcificacion} (≥ 3.5 adecuada; 3–3.5 reducida; 2–3 marginal; < 2 crítica)`),
      ].join(''),
      graficas: [
        { xTitulo: 'Año', yTitulo: 'CO₂ (ppm)', formatoX: (v) => fmt(v, 0), formatoY: (v) => miles(v),
          series: [serieLinea('C(t) = C₀·e^(r·t)', muestrear(C, 2026, fin, 100), c.ocre), seriePuntos('Horizonte', [{ x: p.anoHorizonte, y: fu.C }], c.alerta)],
          limites: { x: { min: 2026, max: fin }, y: { min: 0 } }, pie: 'Crecimiento exponencial: el CO₂ se multiplica por el mismo factor cada año.' },
        { xTitulo: 'Año', yTitulo: 'pH · aragonito', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('pH', muestrear(ph, 2026, fin, 100), c.agua), serieLinea('Aragonito Ω', muestrear((ano) => M.aragonito(ph(ano), p.pH0, p.Om0), 2026, fin, 100), c.ok), serieGuia('Ω = 3', { x: 2026, y: 3 }, { x: fin, y: 3 }, c.alerta)],
          limites: { x: { min: 2026, max: fin }, y: { min: 0, max: 9 } }, pie: 'El pH baja con el logaritmo del CO₂ y con él el aragonito que necesita el coral.' },
      ],
    };
  },
};

iniciarSimulador({
  proyecto: 'oceanos',
  tabInicial: 'olas',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Océanos',
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
      { clave: 'U', nombre: 'Viento', unidad: 'm/s', dec: 2 },
      { clave: 'Hs', nombre: 'Altura significativa', unidad: 'm', dec: 2 },
      { clave: 'eta', nombre: 'Marea', unidad: 'm', dec: 3 },
      { clave: 'T', nombre: 'Temperatura del arrecife', unidad: '°C', dec: 2 },
      { clave: 'Tg', nombre: 'Temperatura en La Guajira', unidad: '°C', dec: 2 },
      { clave: 'DHW', nombre: 'Calor acumulado (DHW)', unidad: '°C·semana', dec: 2 },
      { clave: 'zb', nombre: 'Base de las nubes en Macuira', unidad: 'm', dec: 0 },
      { clave: 'niebla', nombre: 'Niebla en el bosque (a este ritmo)', unidad: 'mm/día', dec: 2 },
    ],
    tomar: (p, r) => ({ U: r.q.U, Hs: r.q.Hs, eta: r.q.eta, T: r.T, Tg: r.Tg, DHW: r.DHW, zb: r.mac.aire.zb, niebla: r.mac.mmDia }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'mar', nombre: 'Mar', titulo: 'El mar Caribe, los alisios y la costa' },
    { id: 'columna', nombre: 'Columna', titulo: 'Corte del océano: termoclina y espiral de Ekman' },
    { id: 'guajira', nombre: 'La Guajira', titulo: 'El afloramiento de agua fría' },
    { id: 'arrecife', nombre: 'Arrecife', titulo: 'El arrecife de coral' },
    { id: 'macuira', nombre: 'Macuira', titulo: 'La Serranía de Macuira y su bosque de niebla' },
  ],
});
