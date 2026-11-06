/**
 * app.js — Simulador de lagunas de alta montaña: pestañas, controles, resultados,
 * ecuaciones con valores sustituidos y gráficas. El controlador común está en
 * nucleo/app-base.js; aquí solo va lo propio de la laguna.
 */
import * as M from './modelo.js';
import * as S from './sistema.js';
import * as N from './nodo.js';
import { Escena } from './escena3d.js';
import { hojasExcel } from './hojas.js';
import { iniciarSimulador, ecu, i, sub, tablaHTML } from './nucleo/app-base.js';
import { fmt, miles, MESES, fmtTiempo, muestrear, techoRedondo, horaTexto } from './nucleo/formato.js';
import { serieLinea, seriePuntos, serieGuia } from './nucleo/graficas.js';

const opciones = (obj) => Object.entries(obj).map(([valor, o]) => ({ valor, nombre: o.nombre }));
const L_S = (q) => q * 1000;

// ── Pestañas ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'clima', nombre: 'Clima', graficas: 2, tablas: true, intro: 'La laguna está a 4 300 m de altitud, en el páramo de la Sierra Nevada de Santa Marta, al pie de un glaciar. El aire se enfría con la altura en línea recta, la lluvia del año sigue el régimen del Caribe (secas de diciembre a marzo, lluvias en mayo y de septiembre a noviembre) y el glaciar suelta agua de deshielo según cuántos grados pasa de 0 °C. Aquí se eligen el clima del año (normal, El Niño o La Niña), la lluvia, el calentamiento y cuántos años hacia el futuro se mira el glaciar.' },
  { id: 'paramo', nombre: 'Páramo', graficas: 2, tablas: true, intro: 'El páramo es una esponja: su suelo negro y húmedo y los musgos guardan la lluvia y la sueltan despacio, como un embalse lineal (el caudal es proporcional al agua guardada). Los frailejones atrapan además el agua de la niebla. Si el páramo se degrada con el ganado, las quemas y la papa, el suelo se compacta: el agua sale de golpe con los aguaceros y falta en el verano, y la cuenca suelta más sedimento y más fósforo.' },
  { id: 'laguna', nombre: 'Laguna', graficas: 2, tablas: true, intro: 'La cubeta de la laguna tiene forma de paraboloide: el área del espejo de agua crece en línea recta con la profundidad y el volumen con su cuadrado. El agua entra del páramo, del glaciar y de la lluvia; sale por evaporación, por infiltración, por la toma del acueducto veredal y, cuando el nivel pasa el umbral, por el vertedero natural que alimenta la quebrada. El nivel cambia con el reloj.' },
  { id: 'calidad', nombre: 'Calidad', graficas: 2, tablas: true, intro: 'Una laguna somera puede estar clara, con plantas sumergidas que fijan el fondo y compiten con las algas, o turbia, llena de algas y sin plantas. Los dos estados son estables con los mismos nutrientes (Scheffer, 1993): para que una laguna turbia vuelva a aclararse hay que bajar el fósforo mucho más de donde se enturbió. Aquí se calculan el fósforo, la clorofila, la transparencia, el índice de Carlson y el oxígeno, que a 4 300 m de altitud ya es poco.' },
  { id: 'viento', nombre: 'Viento', graficas: 2, intro: 'El viento del páramo levanta olas pequeñas cuyo tamaño depende de la velocidad del viento y del largo de agua libre que recorre (el fetch). Las olas mueven el agua hasta una profundidad cercana a la mitad de su longitud de onda: donde el fondo es más llano, levantan el sedimento y enturbian la laguna.' },
  { id: 'sedimentos', nombre: 'Sedimentos', graficas: 2, tablas: true, intro: 'La cuenca suelta sedimento que llega a la laguna y se deposita: los granos gruesos caen enseguida y los finos tardan más (ley de Stokes). Lo que se queda llena poco a poco la cubeta (colmatación). La papa en ladera y el páramo degradado multiplican el sedimento y acortan la vida de la laguna.' },
  { id: 'amenazas', nombre: 'Amenazas', graficas: 2, intro: 'Muchas lagunas glaciares están represadas por morrenas, diques de rocas sueltas que dejó el glaciar al retroceder. Si un dique se rompe, la laguna se vacía de golpe y una onda de crecida baja por la quebrada hasta el pueblo. Aquí se calcula el caudal pico del vaciado, cuánto se atenúa en el camino, cuánto tarda en llegar y si cabe en el cauce del pueblo, y el nivel de alerta.' },
];

// ── Controles ──────────────────────────────────────────────────────────────
const CONTROLES = [
  { tab: 'clima', grupo: 'Escenario' },
  { tab: 'clima', id: 'escenario', clave: 'escenario', etiqueta: 'Escenario', tipo: 'opciones', opciones: opciones(S.ESCENARIOS),
    escribir: () => {}, alCambiar: (v, p, sim, ctx) => ctx.aplicarEscenario(v),
    doc: 'Pone a la vez los valores de un caso de estudio (sequía de El Niño, lluvias de La Niña, páramo degradado, papa, truchas, laguna turbia, glaciar en 2050, morrena o más extracción) sobre el escenario de referencia.' },
  { tab: 'clima', grupo: 'Clima del año y lluvia' },
  { tab: 'clima', id: 'clima', clave: 'clima', etiqueta: 'Clima del año', tipo: 'opciones', opciones: opciones(S.CLIMAS),
    extra: (v) => `Lluvia × ${fmt(S.CLIMAS[v].fLluvia, 1)} y temperatura ${S.CLIMAS[v].dT >= 0 ? '+' : '−'}${fmt(Math.abs(S.CLIMAS[v].dT), 1)} °C frente a un año normal.`,
    doc: 'Año normal, El Niño (40 % menos lluvia y 0.8 °C más) o La Niña (50 % más lluvia y 0.5 °C menos).' },
  { tab: 'clima', id: 'lluviaAnual', clave: 'lluviaAnual', etiqueta: 'Lluvia de un año normal', unidad: 'mm', min: 500, max: 3000, paso: 10, dec: 0,
    extra: (v, p, r) => `Con el clima elegido caen ${fmt(v * S.clima(p).fLluvia, 0)} mm en el año; en el mes de ahora, ${fmt(S.lluviaMes(p, r.fecha.mes), 0)} mm.`,
    doc: 'La lluvia anual en la cuenca de la laguna; se reparte en los meses con el régimen bimodal del Caribe.' },
  { tab: 'clima', grupo: 'Temperatura y altitud' },
  { tab: 'clima', id: 'altitud', clave: 'altitud', etiqueta: 'Altitud de la laguna', unidad: 'm.s.n.m.', min: 3000, max: 4800, paso: 10, dec: 0,
    doc: 'Fija la temperatura del aire y del agua, la presión del aire, el oxígeno de saturación y el punto de ebullición.' },
  { tab: 'clima', id: 'gradiente', clave: 'gradiente', etiqueta: 'Enfriamiento con la altura (gradiente)', unidad: '°C/km', min: 4, max: 7, paso: 0.1, dec: 1, aUI: (v) => v * 1000, deUI: (v) => v / 1000,
    extra: (v, p) => `La isoterma de 0 °C queda a ${fmt(M.altitudCeroGrados(p.Tmar, p.gradiente), 0)} m de altitud.`,
    doc: 'La pendiente de la recta T(z) = T_mar − Γ·z.' },
  { tab: 'clima', id: 'calentamiento', clave: 'calentamiento', etiqueta: 'Calentamiento sobre el clima de hoy', unidad: '°C', min: 0, max: 3, paso: 0.1, dec: 1,
    doc: 'Sube la temperatura del aire, del agua y del frente del glaciar: más deshielo hoy y más evaporación.' },
  { tab: 'clima', grupo: 'Glaciar' },
  { tab: 'clima', id: 'areaGlaciar', clave: 'areaGlaciar', etiqueta: 'Área del glaciar hoy', unidad: 'km²', min: 0, max: 1.5, paso: 0.01, dec: 2,
    doc: 'El hielo que alimenta la laguna; su deshielo se suma al agua del páramo.' },
  { tab: 'clima', id: 'DDF', clave: 'DDF', etiqueta: 'Factor de grado-día del hielo', unidad: 'mm/(°C·día)', min: 3, max: 12, paso: 0.1, dec: 1,
    doc: 'Milímetros de hielo que se derriten por cada grado sobre 0 °C en un día.' },
  { tab: 'clima', id: 'perdidaGlaciar', clave: 'perdidaGlaciar', etiqueta: 'Pérdida de área del glaciar', unidad: '%/año', min: 0, max: 10, paso: 0.1, dec: 1,
    extra: (v) => (v > 0 ? `Con esta pérdida queda el 1 % del glaciar en ${fmt(M.anosHastaFraccion(v / 100), 0)} años.` : 'El glaciar no pierde área.'),
    doc: 'La tasa λ de la exponencial A(t) = A₀·e^(−λt); el IDEAM reporta pérdidas del 3 al 5 % al año en la Sierra Nevada.' },
  { tab: 'clima', id: 'tendenciaCalor', clave: 'tendenciaCalor', etiqueta: 'Calentamiento por año (tendencia)', unidad: '°C/año', min: 0, max: 0.06, paso: 0.005, dec: 3,
    doc: 'Pendiente de la recta con que sube la temperatura del frente del glaciar en los años futuros.' },
  { tab: 'clima', id: 'anosFuturo', clave: 'anosFuturo', etiqueta: 'Mirar el glaciar dentro de', unidad: 'años', min: 0, max: 60, paso: 1, dec: 0,
    extra: (v, p) => (v > 0 ? `Año ${2026 + v}: el glaciar tendría ${fmt(S.glaciar(p).A, 3)} km² y el aire estaría ${fmt(p.tendenciaCalor * v, 2)} °C más caliente.` : 'El glaciar de hoy.'),
    doc: 'Lleva el área del glaciar y la temperatura a un año futuro; toda la laguna se calcula con ese glaciar.' },

  { tab: 'paramo', grupo: 'Cuenca de la laguna' },
  { tab: 'paramo', id: 'areaCuenca', clave: 'areaCuenca', etiqueta: 'Área de la cuenca', unidad: 'km²', min: 0.5, max: 15, paso: 0.1, dec: 1,
    doc: 'El páramo cuya lluvia llega a la laguna; el caudal crece en proporción al área.' },
  { tab: 'paramo', id: 'estadoParamo', clave: 'estadoParamo', etiqueta: 'Estado del páramo', tipo: 'opciones', opciones: opciones(S.ESTADOS_PARAMO),
    extra: (v) => { const e = S.ESTADOS_PARAMO[v]; return `k = ${e.k} días · llega a la laguna el ${fmt(100 * e.c, 0)} % de la lluvia · niebla +${fmt(100 * e.niebla, 0)} % · sedimento ×${e.fRend}`; },
    doc: 'Cambia el tiempo de respuesta del suelo k, la parte de la lluvia que llega a la laguna, el agua de la niebla y el sedimento.' },
  { tab: 'paramo', grupo: 'Usos del suelo en la cuenca' },
  { tab: 'paramo', id: 'areaPotrero', clave: 'areaPotrero', etiqueta: 'Potreros con ganado', unidad: 'ha', min: 0, max: 300, paso: 1, dec: 0,
    doc: 'Exportan 0.4 kg de fósforo y 1 t de sedimento por hectárea al año (valores de referencia).' },
  { tab: 'paramo', id: 'areaPapa', clave: 'areaPapa', etiqueta: 'Cultivos de papa', unidad: 'ha', min: 0, max: 300, paso: 1, dec: 0,
    extra: (v, p) => `Queda páramo natural en ${fmt(S.usos(p).paramo, 0)} ha (${fmt((100 * S.usos(p).paramo) / S.usos(p).total, 1)} % de la cuenca).`,
    doc: 'La papa en ladera exporta 1 kg de fósforo y 10 t de sedimento por hectárea al año.' },

  { tab: 'laguna', grupo: 'Nivel del agua' },
  { tab: 'laguna', id: 'nivel', etiqueta: 'Profundidad máxima ahora', unidad: 'm', min: 0.5, max: (p) => p.profUmbral + 1.5, paso: 0.01, dec: 2,
    leer: (p, sim) => sim.h, escribir: (v, p, sim) => { sim.h = v; },
    extra: (v, p) => `El umbral del vertedero está a ${fmt(p.profUmbral, 2)} m y la toma del acueducto a ${fmt(p.profUmbral - S.SITIO.alturaToma, 2)} m.`,
    doc: 'El nivel cambia solo con el reloj; aquí se puede poner a mano para ver el vertedero, la toma o la laguna casi seca.' },
  { tab: 'laguna', grupo: 'Cubeta y vertedero' },
  { tab: 'laguna', id: 'areaUmbral', clave: 'areaUmbral', etiqueta: 'Área del espejo con el agua en el umbral', unidad: 'ha', min: 2, max: 60, paso: 0.5, dec: 1,
    doc: 'Fija la forma del paraboloide: A(h) = (A_u/h_u)·h.' },
  { tab: 'laguna', id: 'profUmbral', clave: 'profUmbral', etiqueta: 'Profundidad máxima en el umbral', unidad: 'm', min: 1, max: 20, paso: 0.1, dec: 1,
    doc: 'Una laguna somera tiene pocos metros; con más profundidad guarda más agua pero las plantas reciben menos luz.' },
  { tab: 'laguna', id: 'anchoVertedero', clave: 'anchoVertedero', etiqueta: 'Ancho del vertedero de rebose', unidad: 'm', min: 0.5, max: 10, paso: 0.1, dec: 1,
    doc: 'Con más ancho, el mismo caudal sale con menos lámina sobre el umbral.' },
  { tab: 'laguna', grupo: 'Usos y pérdidas' },
  { tab: 'laguna', id: 'extraccion', clave: 'extraccion', etiqueta: 'Toma del acueducto veredal', unidad: 'L/s', min: 0, max: 60, paso: 0.5, dec: 1,
    extra: (v) => `Abastece a unas ${miles((v * 86400) / 120)} personas con 120 L/hab·día.`,
    doc: 'Agua que se saca para el acueducto; solo funciona si el nivel está por encima de la toma.' },
  { tab: 'laguna', id: 'infiltracion', clave: 'infiltracion', etiqueta: 'Infiltración por el fondo', unidad: 'mm/día', min: 0, max: 10, paso: 0.1, dec: 1,
    doc: 'Agua que se pierde por el fondo y las orillas hacia la roca fracturada.' },

  { tab: 'calidad', grupo: 'Fósforo de las jaulas' },
  { tab: 'calidad', id: 'truchas', clave: 'truchas', etiqueta: 'Producción de trucha en jaulas', unidad: 't/año', min: 0, max: 60, paso: 0.5, dec: 1,
    extra: () => `Cada tonelada de trucha deja ${S.P_TRUCHA} kg de fósforo del alimento en la laguna.`,
    doc: 'La fuente de fósforo que cae directamente en la laguna; los potreros y la papa se fijan en la pestaña Páramo.' },
  { tab: 'calidad', grupo: 'Luz y plantas sumergidas' },
  { tab: 'calidad', id: 'kw', clave: 'kw', etiqueta: 'Turbidez del agua sola (color húmico)', unidad: '1/m', min: 0.05, max: 1.5, paso: 0.01, dec: 2,
    doc: 'Atenuación de la luz del agua del páramo, que es algo café por el humus.' },
  { tab: 'calidad', id: 'fLuzPlantas', clave: 'fLuzPlantas', etiqueta: 'Luz que necesitan las plantas en el fondo', unidad: '%', min: 5, max: 40, paso: 1, dec: 0,
    doc: 'Con ella sale la turbidez crítica h_e = ln(100/f)/z̄ por encima de la cual las plantas desaparecen.' },
  { tab: 'calidad', id: 'perturbar', etiqueta: 'Arrancar las plantas (perturbación)', tipo: 'accion', accion: (p, sim) => { sim.V = 0.02; },
    extra: () => 'Simula una perturbación que deja el fondo sin plantas (dragado, herbívoros o una tormenta). Deja correr el reloj para ver a qué estado vuelve la laguna.',
    doc: 'Deja la cobertura de plantas en 2 % sin cambiar los nutrientes.' },
  { tab: 'calidad', id: 'replantar', etiqueta: 'Replantar el fondo', tipo: 'accion', accion: (p, sim) => { sim.V = 1; },
    doc: 'Lleva la cobertura de plantas al 100 %.' },

  { tab: 'viento', grupo: 'Viento sobre la laguna' },
  { tab: 'viento', id: 'viento', clave: 'viento', etiqueta: 'Velocidad del viento', unidad: 'm/s', min: 0, max: 25, paso: 0.5, dec: 1,
    doc: 'Con el fetch (el diámetro del espejo de agua) fija la altura, el período y la longitud de las olas.' },

  { tab: 'sedimentos', grupo: 'Depósito en la laguna' },
  { tab: 'sedimentos', id: 'rhoB', clave: 'rhoB', etiqueta: 'Densidad del sedimento depositado', unidad: 't/m³', min: 0.6, max: 1.8, paso: 0.05, dec: 2,
    doc: 'Toneladas por metro cúbico del lodo del fondo: con menos densidad, el mismo sedimento ocupa más volumen.' },

  { tab: 'amenazas', grupo: 'Cierre de la laguna' },
  { tab: 'amenazas', id: 'cierre', clave: 'cierre', etiqueta: 'Qué represa la laguna', tipo: 'opciones', opciones: opciones(S.CIERRES),
    doc: 'Un umbral de roca es estable; un dique de morrena puede romperse y vaciar la laguna de golpe.' },
  { tab: 'amenazas', id: 'vaciar', etiqueta: 'Simular la rotura del dique', tipo: 'accion', accion: (p, sim) => { S.iniciarVaciado(p, sim); },
    visible: (p) => p.cierre === 'morrena',
    extra: () => 'Inicia el vaciado súbito: deja correr el reloj a «10 min por segundo» para ver bajar la laguna.',
    doc: 'Solo con dique de morrena: rompe el dique y la laguna se vacía hasta la mitad de su profundidad.' },
  { tab: 'amenazas', grupo: 'Quebrada y pueblo' },
  { tab: 'amenazas', id: 'distanciaPueblo', clave: 'distanciaPueblo', etiqueta: 'Distancia de la laguna al pueblo', unidad: 'km', min: 1, max: 40, paso: 0.5, dec: 1,
    doc: 'Más lejos, la onda llega más tarde y más atenuada.' },
  { tab: 'amenazas', id: 'velocidadOnda', clave: 'velocidadOnda', etiqueta: 'Velocidad de la onda de crecida', unidad: 'm/s', min: 1, max: 8, paso: 0.1, dec: 1,
    doc: 'Fija el tiempo de viaje t = distancia/velocidad, que es el tiempo para avisar.' },
  { tab: 'amenazas', id: 'cauceProf', clave: 'cauceProf', etiqueta: 'Profundidad del cauce en el pueblo', unidad: 'm', min: 0.5, max: 4, paso: 0.1, dec: 1,
    extra: (v, p) => `Capacidad del cauce: ${fmt(M.capacidadCauce(p.cauceAncho, v, p.cauceTalud, p.cauceN, p.caucePend), 1)} m³/s (Manning, fondo de ${fmt(p.cauceAncho, 1)} m, talud ${fmt(p.cauceTalud, 1)}).`,
    doc: 'Con la ecuación de Manning da cuánto caudal cabe en el cauce sin desbordarse.' },
];

// ── Indicadores de la barra superior ──────────────────────────────────────
const NIVEL_ALERTA = { verde: 'ok', amarilla: 'aviso', naranja: 'naranja', roja: 'alerta' };
function estados(p, r) {
  const lag = r.h < r.q.hToma ? { nivel: 'alerta', texto: `Laguna: ${fmt(r.h, 2)} m, bajo la toma del acueducto` }
    : (r.q.Qvert > 1e-5 ? { nivel: 'ok', texto: `Laguna: ${fmt(r.h, 2)} m, rebosa ${fmt(L_S(r.q.Qvert), 1)} L/s` } : { nivel: 'aviso', texto: `Laguna: ${fmt(r.h, 2)} m, no rebosa (umbral ${fmt(p.profUmbral, 2)} m)` });
  if (r.glof) Object.assign(lag, { nivel: 'alerta', texto: `Vaciado súbito: salen ${fmt(r.q.Qglof, 1)} m³/s` });
  return [
    { id: 'alerta', nombre: 'Nivel de alerta', nivel: NIVEL_ALERTA[r.alerta.nivel], texto: `Alerta ${r.alerta.nivel}${r.alerta.motivos.length ? `: ${r.alerta.motivos.join(', ')}` : ': laguna estable, sin amenazas'}` },
    { id: 'laguna', nombre: 'Laguna', ...lag },
    { id: 'entradas', nombre: 'Entradas', nivel: r.paramo.k >= 30 ? 'ok' : 'aviso', texto: `Entra: ${fmt(L_S(r.q.Qp + r.q.Qg), 1)} L/s (páramo ${fmt(L_S(r.q.Qp), 1)}, glaciar ${fmt(L_S(r.q.Qg), 1)})` },
    { id: 'calidad', nombre: 'Calidad', nivel: r.ca.V >= 0.5 && r.oxigeno.ODmin >= 5 ? 'ok' : (r.ca.V < 0.5 ? 'alerta' : 'aviso'), texto: r.ca.V >= 0.5 ? `Agua clara y ${r.ca.clase} (Secchi ${fmt(r.ca.DS, 1)} m)` : `Laguna turbia y ${r.ca.clase} (Secchi ${fmt(r.ca.DS, 1)} m)` },
    { id: 'glaciar', nombre: 'Glaciar', nivel: r.gl.A > 0.01 ? 'ok' : 'aviso', texto: `Glaciar: ${fmt(r.gl.A, 2)} km², aporta ${fmt((100 * r.q.Qg) / Math.max(1e-9, r.q.Qp + r.q.Qg), 0)} %` },
  ];
}

// ── Pintores de cada pestaña ──────────────────────────────────────────────
const PINTORES = {
  clima({ p, r, c }) {
    const T = r.temp;
    const zs = [0, 5700];
    const recta = muestrear((z) => M.temperaturaAltitud(z, p.Tmar, p.gradiente) + T.dT, 0, 5700, 2);
    const gl = r.gl;
    const futuro = muestrear((t) => L_S(M.deshieloFuturo(gl.base, t)), 0, 60, 120);
    const tPico = Math.max(0, gl.tPico);
    const filasClima = Object.entries(S.CLIMAS).map(([id, cl]) => {
      const q = { ...p, clima: id };
      const b = S.balanceMedio(q);
      const g = S.glaciar(q);
      return { clase: id === p.clima ? 'elegida' : '', celdas: [cl.nombre, `${fmt(p.lluviaAnual * cl.fLluvia, 0)} mm`, `${fmt(S.temperaturas(q).Tl, 2)} °C`, `${fmt(L_S(b.Qp), 1)} L/s`, `${fmt(L_S(g.Q), 1)} L/s`, `${fmt((100 * g.Q) / (b.Qp + g.Q), 1)} %`] };
    });
    return {
      metricas: [
        ['<b>Temperatura y altitud</b>', '', ''],
        ['Temperatura media del aire en la laguna', T.Tl, '°C', '', 2, 'Recta T(z) = T_mar − Γ·z más la anomalía del clima y el calentamiento.'],
        ['Temperatura en el frente del glaciar (4 900 m)', T.Tg, '°C', T.Tg > 0 ? 'ok' : 'aviso', 2, 'Si pasa de 0 °C el hielo se derrite.'],
        ['Isoterma de 0 °C', M.altitudCeroGrados(p.Tmar, p.gradiente) + T.dT / p.gradiente, 'm.s.n.m.', '', 0, 'Raíz de T(z) = 0: altitud donde el aire está a 0 °C en promedio.'],
        ['Presión del aire', r.oxigeno.presion, 'kPa', '', 1, 'Atmósfera estándar: P = 101.325·(1 − 2.25577·10⁻⁵·z)^5.25588.'],
        ['<b>Lluvia y evaporación</b>', '', ''],
        ['Lluvia del año con este clima', p.lluviaAnual * S.clima(p).fLluvia, 'mm', '', 0, 'Lluvia de un año normal por el factor del clima.'],
        [`Lluvia de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][r.fecha.mes]}`, S.lluviaMes(p, r.fecha.mes), 'mm', '', 0, 'Fracción del mes según el régimen bimodal del Caribe.'],
        ['Radiación extraterrestre del día', r.ev.Ra, 'MJ/m²·día', '', 1, 'FAO-56 para la latitud 10.85° N y el día del año.'],
        ['Evaporación de referencia ET₀ (Hargreaves)', r.ev.ET0, 'mm/día', '', 2, 'ET₀ = 0.0023·(T + 17.8)·√ΔT·R_a.'],
        ['Evaporación del espejo de agua', r.ev.E, 'mm/día', '', 2, '1.05·ET₀.'],
        ['<b>Glaciar</b>', '', ''],
        ['Área del glaciar', gl.A, 'km²', gl.A > 0.01 ? 'ok' : 'aviso', 3, 'A(t) = A₀·e^(−λt) en el año que se mira.'],
        ['Derretimiento por grado-día', gl.M, 'mm/día', '', 2, 'M = DDF·(T − 0 °C).'],
        ['Agua de deshielo que llega', L_S(gl.Q), 'L/s', '', 1, 'Derretimiento sobre el área del glaciar.'],
        ['Parte del agua que entra que es deshielo', (100 * r.q.Qg) / Math.max(1e-9, r.q.Qp + r.q.Qg), '%', '', 1, 'Frente al agua que suelta el páramo hoy.'],
        ['Pico del agua del glaciar', gl.tPico > 0 ? `dentro de ${fmt(gl.tPico, 1)} años` : `ya pasó (hace ${fmt(-gl.tPico, 1)} años)`, '', gl.tPico > 0 ? 'ok' : 'aviso', 2, 'Vértice de Q(t) = DDF·(T₀ + w·t)·A₀·e^(−λt): t* = 1/λ − T₀/w.'],
        ['Años hasta que quede el 1 % del glaciar', gl.anos1, 'años', '', 0, 't = ln(100)/λ.'],
      ],
      tablas: tablaHTML('El agua del año con cada clima', ['Clima', 'Lluvia', 'Aire en la laguna', 'Páramo (medio)', 'Glaciar', 'Deshielo'], filasClima, { numericas: [1, 2, 3, 4, 5], nota: 'Con El Niño llueve menos y hace más calor: el páramo entrega menos agua y el glaciar se derrite más, así que la laguna depende más del hielo que se está acabando.' }),
      ecuacion: [
        ecu.tipo('Ecuación lineal: temperatura con la altitud'),
        ecu.formula(`${i('T')}(${i('z')}) = ${sub('T', 'mar')} − Γ·${i('z')}`),
        ecu.sust(`${i('T')}(${fmt(p.altitud, 0)}) = ${fmt(p.Tmar, 1)} − ${fmt(p.gradiente, 4)} × ${fmt(p.altitud, 0)}${T.dT ? ` ${T.dT > 0 ? '+' : '−'} ${fmt(Math.abs(T.dT), 2)}` : ''} = ${fmt(T.Tl, 2)} °C`),
        ecu.tipo('Ecuación lineal: derretimiento por grado-día'),
        ecu.formula(`${i('M')} = DDF·(${i('T')} − ${sub('T', '0')}),  ${sub('Q', 'g')} = ${i('M')}·${sub('A', 'g')}`),
        ecu.sust(`${i('M')} = ${fmt(p.DDF, 1)} × (${fmt(T.Tg, 2)} − 0) = ${fmt(gl.M, 2)} mm/día → ${sub('Q', 'g')} = ${fmt(gl.M / 1000, 5)} × ${miles(gl.A * 1e6)} / 86 400 = ${fmt(L_S(gl.Q), 1)} L/s`),
        ecu.tipo('Exponencial y vértice: el pico del agua del glaciar'),
        ecu.formula(`${sub('Q', 'g')}(${i('t')}) = DDF·(${sub('T', '0')} + ${i('w')}·${i('t')})·${sub('A', '0')}·e<sup>−λ${i('t')}</sup>,  ${i('t')}* = 1/λ − ${sub('T', '0')}/${i('w')}`),
        ecu.sust(`${i('t')}* = 1/${fmt(gl.lambda, 3)} − ${fmt(gl.base.T0, 2)}/${fmt(p.tendenciaCalor, 3)} = ${fmt(gl.tPico, 1)} años`),
        ecu.nota(gl.tPico > 0 ? `El deshielo todavía sube durante ${fmt(gl.tPico, 1)} años (llega a ${fmt(L_S(gl.Qpico), 1)} L/s) y después baja porque el glaciar se acaba.` : 'El pico del agua del glaciar ya pasó: aunque cada año se derrite más hielo por metro cuadrado, el glaciar se encoge más rápido y el aporte solo baja.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Altitud (m.s.n.m.)', yTitulo: 'Temperatura del aire (°C)', formatoX: (v) => miles(v), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('T(z) = T_mar − Γ·z', recta, c.agua), serieGuia('0 °C', { x: zs[0], y: 0 }, { x: zs[1], y: 0 }, c.tinta2), seriePuntos('Laguna', [{ x: p.altitud, y: T.Tl }], c.ocre), seriePuntos('Frente del glaciar', [{ x: S.SITIO.altitudGlaciar, y: T.Tg }], c.alerta)],
          limites: { x: { min: 0, max: 5700 }, y: { min: -6, max: 32 } }, pie: 'La temperatura baja en línea recta con la altitud; donde la recta corta el 0 °C está la isoterma de congelación.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Agua de deshielo (L/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Deshielo Q(t)', futuro, c.agua2 || c.agua), seriePuntos('Año que se mira', [{ x: p.anosFuturo, y: L_S(M.deshieloFuturo(gl.base, p.anosFuturo)) }], c.ocre), ...(gl.tPico > 0 ? [seriePuntos('Pico (vértice)', [{ x: tPico, y: L_S(gl.Qpico) }], c.alerta, 4)] : [])],
          limites: { x: { min: 0, max: 60 }, y: { min: 0 } }, pie: 'Recta que sube (más calor) por una exponencial que baja (menos glaciar): el aporte del deshielo tiene un máximo y después se acaba.' },
      ],
    };
  },

  paramo({ p, r, c }) {
    const e = r.e;
    const Q0 = r.q.Qp;
    const curvas = Object.entries(S.ESTADOS_PARAMO).map(([id, x], k) => serieLinea(`${x.nombre.split(' (')[0]} (k = ${x.k} d)`, muestrear((t) => L_S(M.recesion(Q0, x.k, t)), 0, 120, 120), [c.ok, c.ocre, c.alerta][k], { ancho: id === p.estadoParamo ? 3 : 1.5, punteada: id !== p.estadoParamo }));
    const ano = r.ano.meses;
    const filas = Object.entries(S.ESTADOS_PARAMO).map(([id, x]) => {
      const q = { ...p, estadoParamo: id };
      const b = S.balanceMedio(q);
      let Sv = S.estadoInicial(q).S;
      for (let k = 0; k < 3; k++) Sv = M.pasoParamo(Sv, S.lluviaEfectiva(q, [1, 32, 60][k]), x.k, [31, 28, 31][k]);
      return { clase: id === p.estadoParamo ? 'elegida' : '', celdas: [x.nombre.split(' (')[0], `${x.k} días`, `${fmt(L_S(b.Qp), 1)} L/s`, `${fmt(L_S(M.mmDiaAm3s(M.salidaParamo(Sv, x.k), M.km2Am2(p.areaCuenca))), 1)} L/s`, `${fmt(S.cargas(q).Stotal, 0)} t/año`] };
    });
    return {
      metricas: [
        ['<b>El suelo del páramo (embalse lineal)</b>', '', ''],
        ['Lluvia de hoy (día del año)', S.lluviaDia(p, r.d), 'mm/día', '', 2, 'Lluvia del mes repartida en sus días.'],
        ['Lluvia efectiva que entra al suelo', r.paramo.Rhoy, 'mm/día', '', 2, 'R = c·P·(1 + niebla).'],
        ['Agua guardada en el suelo', r.paramo.S, 'mm', '', 1, 'Lámina de agua guardada en el suelo y los musgos (S).'],
        ['Tiempo de respuesta del suelo k', e.k, 'días', e.k >= 30 ? 'ok' : 'alerta', 0, 'Con k grande el páramo suelta el agua despacio y la reparte en el año.'],
        ['Caudal que suelta hoy', L_S(r.q.Qp), 'L/s', '', 1, 'Q = S/k sobre el área de la cuenca.'],
        ['Caudal medio del año', L_S(r.paramo.QpMedio), 'L/s', '', 1, 'Lluvia efectiva del año sobre la cuenca.'],
        ['Caudal al final del verano (31 de marzo)', L_S(r.paramo.QfinVerano), 'L/s', '', 1, 'Después de tres meses secos: lo que queda para la laguna.'],
        ['Si dejara de llover, en 30 días', L_S(r.paramo.recesion30), 'L/s', '', 1, 'Recesión Q = Q₀·e^(−30/k).'],
        ['Días para bajar a la mitad sin lluvia', M.diasRecesion(e.k, 0.5), 'días', '', 1, 't = k·ln 2.'],
        ['<b>Usos de la cuenca</b>', '', ''],
        ['Páramo natural', r.paramo.usos.paramo, 'ha', '', 0],
        ['Potreros y papa', r.paramo.usos.potrero + r.paramo.usos.papa, 'ha', '', 0],
        ['Cobertura natural', (100 * r.paramo.usos.paramo) / r.paramo.usos.total, '%', r.paramo.usos.paramo / r.paramo.usos.total >= 0.8 ? 'ok' : 'alerta', 1, 'Parte de la cuenca que sigue siendo páramo.'],
      ],
      tablas: tablaHTML('El mismo año con los tres estados del páramo', ['Estado', 'k', 'Caudal medio', 'Fin del verano', 'Sedimento'], filas, { numericas: [1, 2, 3, 4], nota: 'Con el páramo degradado el agua del año es algo menor, pero sobre todo se reparte peor: llega de golpe con las lluvias y falta al final del verano. Y la cuenca suelta mucho más sedimento.' }),
      ecuacion: [
        ecu.tipo('Ecuación lineal: embalse lineal del páramo'),
        ecu.formula(`${i('Q')} = ${i('S')}/${i('k')},  d${i('S')}/d${i('t')} = ${i('R')} − ${i('S')}/${i('k')}`),
        ecu.sust(`${i('Q')} = ${fmt(r.paramo.S, 1)}/${e.k} = ${fmt(r.paramo.S / e.k, 2)} mm/día × ${fmt(p.areaCuenca, 1)} km² = ${fmt(L_S(r.q.Qp), 1)} L/s`),
        ecu.tipo('Función exponencial: recesión sin lluvia'),
        ecu.formula(`${i('Q')}(${i('t')}) = ${sub('Q', '0')}·e<sup>−${i('t')}/${i('k')}</sup>,  ${sub('t', '½')} = ${i('k')}·ln 2`),
        ecu.sust(`${i('Q')}(30) = ${fmt(L_S(r.q.Qp), 1)} × e<sup>−30/${e.k}</sup> = ${fmt(L_S(r.paramo.recesion30), 1)} L/s,  ${sub('t', '½')} = ${e.k} × 0.693 = ${fmt(M.diasRecesion(e.k, 0.5), 1)} días`),
        ecu.nota('La solución exacta con lluvia constante es S(t) = R·k + (S₀ − R·k)·e^(−t/k): el suelo se acerca exponencialmente al equilibrio R·k.'),
      ].join(''),
      graficas: [
        { xTitulo: 'Días sin lluvia', yTitulo: 'Caudal del páramo (L/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: curvas, limites: { x: { min: 0, max: 120 }, y: { min: 0 } }, pie: 'Recesión desde el caudal de hoy: con el páramo conservado (k grande) el agua dura más.' },
        { xTitulo: 'Mes', yTitulo: 'Caudal (L/s)', formatoX: (v) => MESES[Math.round(v) - 1] ?? '', formatoY: (v) => fmt(v, 0), marcasX: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          series: [serieLinea('Lluvia del mes (mm)', ano.map((m, k) => ({ x: k + 1, y: m.lluvia })), c.tinta2, { escalon: true, ancho: 1 }), serieLinea('Páramo', ano.map((m, k) => ({ x: k + 1, y: L_S(m.Qp) })), c.ok), serieLinea('Sale de la laguna', ano.map((m, k) => ({ x: k + 1, y: L_S(m.Qsale) })), c.agua)],
          limites: { x: { min: 1, max: 12 }, y: { min: 0 } }, pie: 'Un año mes a mes: el páramo retrasa y suaviza la lluvia; la laguna rebosa todo el año si el páramo está sano.' },
      ],
    };
  },

  laguna({ p, r, c }) {
    const { Au, hu } = S.geometria(p);
    const hMax = hu + 1.5;
    const tend = r.laguna.dhdt * 86400 * 100;
    const ano = r.ano.meses;
    const tabla = tablaHTML('Un año mes a mes', ['Mes', 'Lluvia', 'Páramo', 'Glaciar', 'Sale', 'Nivel al final', 'Días rebosando'],
      ano.map((m) => [m.mes, `${fmt(m.lluvia, 0)} mm`, `${fmt(L_S(m.Qp), 1)} L/s`, `${fmt(L_S(m.Qg), 1)} L/s`, { v: `${fmt(L_S(m.Qsale), 1)} L/s`, clase: m.diasRebose === 0 ? 'mal' : '' }, `${fmt(m.h, 2)} m`, `${m.diasRebose}`]),
      { numericas: [1, 2, 3, 4, 5, 6], nota: `Simulación día a día desde el 1 de enero con los parámetros de ahora.${r.ano.mesesSinRebose.length ? ` No rebosa en ${r.ano.mesesSinRebose.join(', ')}.` : ' Rebosa los doce meses.'}` });
    return {
      metricas: [
        ['<b>La cubeta</b>', '', ''],
        ['Profundidad máxima', r.h, 'm', r.h > r.q.hToma ? 'ok' : 'alerta', 2, 'En el centro de la cubeta.'],
        ['Profundidad media', r.laguna.zMedia, 'm', '', 2, 'V/A = h/2 en el paraboloide.'],
        ['Área del espejo de agua', r.A / 10000, 'ha', '', 2, 'A(h) = (A_u/h_u)·h.'],
        ['Volumen de agua', r.V, 'm³', '', 0, 'V(h) = A_u·h²/(2·h_u).'],
        ['Lleno al (frente al umbral)', (100 * r.V) / r.Vu, '%', '', 1],
        ['<b>Entradas y salidas ahora</b>', '', ''],
        ['Entra del páramo', L_S(r.q.Qp), 'L/s', '', 1],
        ['Entra del glaciar', L_S(r.q.Qg), 'L/s', '', 1],
        ['Lluvia sobre la laguna', L_S(r.q.Qlluvia), 'L/s', '', 2],
        ['Evaporación', L_S(r.q.Qevap), 'L/s', '', 2],
        ['Infiltración', L_S(r.q.Qinf), 'L/s', '', 2],
        ['Toma del acueducto', L_S(r.q.Qext), 'L/s', r.q.Qext > 0 || p.extraccion === 0 ? '' : 'alerta', 1, 'Solo funciona con el nivel sobre la toma.'],
        ['Sale por el vertedero', L_S(r.q.Qvert), 'L/s', r.q.Qvert >= r.laguna.Qeco ? 'ok' : 'aviso', 1, 'Q = C·L·(h − h_u)^1.5.'],
        ...(r.q.Qglof > 0 ? [['Sale por la brecha del dique', r.q.Qglof, 'm³/s', 'alerta', 2]] : []),
        ['Lámina sobre el umbral', r.laguna.lamina * 100, 'cm', '', 1],
        ['Balance', L_S(r.q.Qneto), 'L/s', '', 2, 'Entradas menos salidas.'],
        ['El nivel', Math.abs(tend) < 0.005 ? 'estable' : `${tend > 0 ? 'sube' : 'baja'} ${fmt(Math.abs(tend), 2)} cm al día`, '', '', 2, 'dh/dt = Q_neto/A(h).'],
        ['<b>Usos y reservas</b>', '', ''],
        ['Caudal ecológico de la quebrada', L_S(r.laguna.Qeco), 'L/s', '', 1, '25 % del caudal medio que sale en el año.'],
        ['Autonomía si dejara de entrar agua', r.laguna.autonomia, 'días', r.laguna.autonomia >= 120 ? 'ok' : 'alerta', 0, 'Días hasta que el nivel baja a la toma: ΔV/(evaporación + infiltración + toma).'],
        ['Tiempo de residencia del agua', r.laguna.tauDias, 'días', '', 1, 'τ = V/Q_salida.'],
      ],
      tablas: tabla,
      ecuacion: [
        ecu.tipo('Lineal y cuadrática: la cubeta en paraboloide'),
        ecu.formula(`${i('A')}(${i('h')}) = (${sub('A', 'u')}/${sub('h', 'u')})·${i('h')},  ${i('V')}(${i('h')}) = ${sub('A', 'u')}·${i('h')}²/(2·${sub('h', 'u')})`),
        ecu.sust(`${i('V')}(${fmt(r.h, 2)}) = ${miles(Au)} × ${fmt(r.h, 2)}²/(2 × ${fmt(hu, 1)}) = ${miles(r.V)} m³;  ${i('A')} = ${fmt(r.A / 10000, 2)} ha`),
        ecu.tipo('Función potencia: vertedero de rebose'),
        ecu.formula(`${i('Q')} = ${i('C')}·${i('L')}·(${i('h')} − ${sub('h', 'u')})<sup>1.5</sup>`),
        ecu.sust(`${i('Q')} = ${fmt(p.Cvertedero, 2)} × ${fmt(p.anchoVertedero, 1)} × ${fmt(r.laguna.lamina, 3)}<sup>1.5</sup> = ${fmt(L_S(r.q.Qvert), 1)} L/s`),
        ecu.tipo('Ecuación lineal: el nivel con caudales fijos'),
        ecu.formula(`d${i('h')}/d${i('t')} = ${sub('Q', 'neto')}/${i('A')}(${i('h')})`),
        ecu.sust(`d${i('h')}/d${i('t')} = ${fmt(r.q.Qneto, 5)}/${miles(r.A)} × 86 400 = ${fmt(tend, 2)} cm/día`),
      ].join(''),
      graficas: [
        { xTitulo: 'Profundidad máxima h (m)', yTitulo: 'Volumen (miles de m³)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('V(h) = A_u·h²/(2h_u)', muestrear((h) => M.volumenLaguna(h, Au, hu) / 1000, 0, hMax, 120), c.agua), seriePuntos('Umbral', [{ x: hu, y: r.Vu / 1000 }], c.tinta2, 4), seriePuntos('Ahora', [{ x: r.h, y: r.V / 1000 }], c.ocre)],
          limites: { x: { min: 0, max: hMax }, y: { min: 0 } }, pie: 'Parábola con vértice en el fondo: cada metro de más guarda más agua que el anterior.' },
        { xTitulo: 'Mes', yTitulo: 'Profundidad máxima (m)', formatoX: (v) => MESES[Math.round(v) - 1] ?? '', formatoY: (v) => fmt(v, 2), marcasX: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          series: [serieLinea('Nivel al final del mes', ano.map((m, k) => ({ x: k + 1, y: m.h })), c.agua), serieLinea('Nivel mínimo del mes', ano.map((m, k) => ({ x: k + 1, y: m.hMin })), c.agua, { punteada: true, ancho: 1.5 }), serieGuia('Umbral del vertedero', { x: 1, y: hu }, { x: 12, y: hu }, c.tinta2), serieGuia('Toma del acueducto', { x: 1, y: hu - S.SITIO.alturaToma }, { x: 12, y: hu - S.SITIO.alturaToma }, c.alerta)],
          limites: { x: { min: 1, max: 12 }, y: { min: Math.max(0, hu - S.SITIO.alturaToma - 0.5), max: hu + 0.4 } }, pie: 'El nivel en un año: mientras rebosa casi no cambia (el vertedero suelta lo que sobra); si deja de rebosar, baja con la evaporación y la toma.' },
      ],
    };
  },

  calidad({ p, r, c }) {
    const ca = r.ca;
    const ks = muestrear((k) => M.plantasEquilibrio(k, ca.he, S.SITIO.pHill), 0.05, 2.0, 160);
    // Curva de la turbidez con plantas despejada como V(k): V = h_v·(E₀ − k_w)/(k − k_w) − h_v
    const linea = muestrear((k) => {
      const V = (p.hv * (ca.E0 - p.kw)) / (k - p.kw) - p.hv;
      return V >= 0 && V <= 1.02 ? V : NaN;
    }, p.kw + 0.01, 2.0, 200);
    const dia = muestrear((h) => Math.max(0, M.oxigenoHora(r.oxigeno.ODmedio, r.oxigeno.Aod, h)), 0, 24, 96);
    const cP = ca.c.P;
    const filasP = [
      ['Páramo natural', `${fmt(r.paramo.usos.paramo, 0)} ha`, `${S.USOS.paramo.P} kg/ha·año`, cP.paramo],
      ['Potreros con ganado', `${fmt(r.paramo.usos.potrero, 0)} ha`, `${S.USOS.potrero.P} kg/ha·año`, cP.potrero],
      ['Cultivos de papa', `${fmt(r.paramo.usos.papa, 0)} ha`, `${S.USOS.papa.P} kg/ha·año`, cP.papa],
      ['Jaulas de trucha', `${fmt(p.truchas, 1)} t/año`, `${S.P_TRUCHA} kg/t`, cP.truchas],
    ].map(([a, b, d, v]) => [a, b, d, `${fmt(v, 1)} kg/año`, `${fmt((100 * v) / Math.max(1e-9, ca.c.Ptotal), 0)} %`]);
    filasP.push({ clase: 'total', celdas: ['Total', '', '', `${fmt(ca.c.Ptotal, 1)} kg/año`, '100 %'] });
    const estables = ca.eq.filter((x) => x.estable);
    return {
      metricas: [
        ['<b>Fósforo y algas</b>', '', ''],
        ['Fósforo que entra (carga)', ca.c.Ptotal, 'kg/año', '', 1, 'Suma de las fuentes de la tabla.'],
        ['Concentración del agua que entra', ca.Pin, 'µg/L', '', 2, 'Carga/volumen que entra en el año.'],
        ['Tiempo de residencia', ca.tau * 365, 'días', '', 1, 'Volumen en el umbral / caudal medio de salida.'],
        ['Fósforo total en la laguna', ca.P, 'µg/L', ca.P <= 10 ? 'ok' : 'alerta', 2, 'Vollenweider: P = P_in/(1 + √τ).'],
        ['Clorofila a', ca.Chl, 'µg/L', '', 2, 'Dillon y Rigler: Chl = 0.0731·P^1.449.'],
        ['<b>Luz y plantas</b>', '', ''],
        ['Turbidez sin plantas E₀', ca.E0, '1/m', '', 3, 'Agua, algas y sedimento: E₀ = k_w + 0.02·Chl + 0.05·SS.'],
        ['Turbidez crítica de las plantas h_e', ca.he, '1/m', '', 3, 'h_e = ln(100/f)/z̄.'],
        ['Turbidez ahora k_d', ca.kd, '1/m', ca.kd <= ca.he ? 'ok' : 'alerta', 3, 'Con las plantas de ahora: k_d = k_w + (E₀ − k_w)·h_v/(h_v + V).'],
        ['Plantas sumergidas (cobertura del fondo)', 100 * ca.V, '%', ca.V >= 0.5 ? 'ok' : 'alerta', 0],
        ['Hacia dónde van las plantas', 100 * ca.Veq, '%', '', 0, 'Equilibrio de Hill V* = h_e^p/(h_e^p + k_d^p) con la turbidez de ahora.'],
        ['Estados estables con estos nutrientes', estables.length === 2 ? 'dos: clara y turbia' : (estables[0]?.V >= 0.5 ? 'uno: clara' : 'uno: turbia'), '', estables.length === 2 ? 'aviso' : '', 2, 'Raíces estables de V*(k_d(V)) = V.'],
        ['Transparencia (disco Secchi)', ca.DS, 'm', '', 2, 'DS = 1.7/k_d.'],
        ['Luz en el fondo medio', 100 * ca.luzFondoMedio, '%', ca.luzFondoMedio >= p.fLuzPlantas / 100 ? 'ok' : 'alerta', 1, 'e^(−k_d·z̄).'],
        ['Índice de Carlson (promedio)', ca.tsi.medio, '', ca.tsi.medio < 40 ? 'ok' : (ca.tsi.medio < 50 ? 'aviso' : 'alerta'), 1, 'Promedio de los índices de la transparencia, la clorofila y el fósforo.'],
        ['Estado trófico', ca.clase, ''],
        ['<b>Oxígeno a 4 300 m</b>', '', ''],
        [`Temperatura del agua a las ${horaTexto(r.hora)}`, r.oxigeno.Tagua, '°C', '', 1],
        ['Oxígeno de saturación', r.oxigeno.ODsat, 'mg/L', '', 2, 'APHA corregido por la presión de la altitud.'],
        [`Oxígeno disuelto a las ${horaTexto(r.hora)}`, r.oxigeno.OD, 'mg/L', r.oxigeno.OD >= 5 ? 'ok' : 'alerta', 2, 'Ciclo diario: OD(t) = ŌD − A·cos(2π(t − 5)/24).'],
        ['Mínimo de la madrugada (05:00)', r.oxigeno.ODmin, 'mg/L', r.oxigeno.ODmin >= 5 ? 'ok' : 'alerta', 2],
        ['Máximo de la tarde (17:00)', r.oxigeno.ODmax, 'mg/L', '', 2],
        ['El agua hierve a', r.oxigeno.ebullicion, '°C', '', 1, 'Unos 100 − z/300: para desinfectar hirviendo hay que hervir más tiempo.'],
      ],
      tablas: tablaHTML('Fuentes de fósforo de la laguna', ['Fuente', 'Cantidad', 'Exporta', 'Carga', 'Parte'], filasP, { numericas: [1, 2, 3, 4], nota: 'Coeficientes de exportación de referencia: se reemplazan por los medidos en la cuenca.' }),
      ecuacion: [
        ecu.tipo('Racional con raíz: fósforo de Vollenweider'),
        ecu.formula(`${i('P')} = ${sub('P', 'in')}/(1 + √τ)`),
        ecu.sust(`${i('P')} = ${fmt(ca.Pin, 2)}/(1 + √${fmt(ca.tau, 3)}) = ${fmt(ca.P, 2)} µg/L`),
        ecu.tipo('Función potencia: clorofila de Dillon y Rigler'),
        ecu.formula(`log<sub>10</sub>Chl = 1.449·log<sub>10</sub>${i('P')} − 1.136`),
        ecu.sust(`Chl = 10<sup>1.449 × ${fmt(Math.log10(ca.P), 3)} − 1.136</sup> = ${fmt(ca.Chl, 2)} µg/L`),
        ecu.tipo('Racionales: estados alternativos de Scheffer'),
        ecu.formula(`${sub('k', 'd')} = ${sub('k', 'w')} + (${sub('E', '0')} − ${sub('k', 'w')})·${sub('h', 'v')}/(${sub('h', 'v')} + ${i('V')}),  ${i('V')}* = ${sub('h', 'e')}<sup>${S.SITIO.pHill}</sup>/(${sub('h', 'e')}<sup>${S.SITIO.pHill}</sup> + ${sub('k', 'd')}<sup>${S.SITIO.pHill}</sup>)`),
        ecu.sust(`${sub('k', 'd')} = ${fmt(p.kw, 2)} + (${fmt(ca.E0, 3)} − ${fmt(p.kw, 2)}) × ${fmt(p.hv, 2)}/(${fmt(p.hv, 2)} + ${fmt(ca.V, 3)}) = ${fmt(ca.kd, 3)} 1/m → ${i('V')}* = ${fmt(ca.Veq, 3)}`),
        ecu.tipo('Logarítmica: índice de Carlson'),
        ecu.formula(`TSI = 60 − 14.41·ln DS,  DS = 1.7/${sub('k', 'd')}`),
        ecu.sust(`DS = 1.7/${fmt(ca.kd, 3)} = ${fmt(ca.DS, 2)} m → TSI = 60 − 14.41 × ln ${fmt(ca.DS, 2)} = ${fmt(ca.tsi.SD, 1)}`),
        ecu.tipo('Periódica: el oxígeno del día'),
        ecu.formula(`OD(${i('t')}) = ŌD − ${i('A')}·cos(2π(${i('t')} − 5)/24)`),
        ecu.sust(`OD(${fmt(r.hora, 2)}) = ${fmt(r.oxigeno.ODmedio, 2)} − ${fmt(r.oxigeno.Aod, 2)} × cos(2π(${fmt(r.hora, 2)} − 5)/24) = ${fmt(r.oxigeno.OD, 2)} mg/L`),
      ].join(''),
      graficas: [
        { xTitulo: 'Turbidez k_d (1/m)', yTitulo: 'Cobertura de plantas', formatoX: (v) => fmt(v, 1), formatoY: (v) => `${fmt(100 * v, 0)} %`,
          series: [serieLinea('Plantas en equilibrio V*(k)', ks, c.ok), serieLinea('Turbidez con plantas k_d(V)', linea, c.ocre), seriePuntos('Equilibrios', ca.eq.map((x) => ({ x: x.k, y: x.V })), c.tinta2, 4), seriePuntos('Ahora', [{ x: ca.kd, y: ca.V }], c.agua, 6)],
          limites: { x: { min: 0, max: 2 }, y: { min: 0, max: 1.05 } }, pie: 'Modelo gráfico de Scheffer: los equilibrios son los cruces de las dos curvas. Con dos cruces estables la laguna puede estar clara o turbia con los mismos nutrientes.' },
        { xTitulo: 'Hora del día', yTitulo: 'Oxígeno disuelto (mg/L)', formatoX: (v) => `${fmt(v, 0)} h`, formatoY: (v) => fmt(v, 1), marcasX: [0, 3, 6, 9, 12, 15, 18, 21, 24],
          series: [serieLinea('OD(t)', dia, c.agua), serieGuia('Saturación', { x: 0, y: r.oxigeno.ODsat }, { x: 24, y: r.oxigeno.ODsat }, c.tinta2), serieGuia('Mínimo para las truchas (5 mg/L)', { x: 0, y: 5 }, { x: 24, y: 5 }, c.alerta), seriePuntos('Ahora', [{ x: r.hora, y: r.oxigeno.OD }], c.ocre)],
          limites: { x: { min: 0, max: 24 }, y: { min: 0, max: techoRedondo(r.oxigeno.ODmax + 1) } }, pie: 'De día las algas y las plantas producen oxígeno; de noche todo respira y el mínimo llega en la madrugada.' },
      ],
    };
  },

  viento({ p, r, c }) {
    const o = r.olas;
    const Tmax = Math.max(2, techoRedondo(o.T * 1.6));
    const fU = muestrear((U) => 100 * M.fraccionFondoRemovido(M.baseOleaje(M.longitudOla(M.periodoOla(U, o.F))), r.h), 0, 25, 100);
    return {
      metricas: [
        ['Fetch (diámetro del espejo de agua)', o.F, 'm', '', 0, 'F = 2·√(A/π).'],
        ['Altura de las olas', o.H * 100, 'cm', '', 1, 'H = 0.0016·U·√(F/g).'],
        ['Período de las olas', o.T, 's', '', 2, 'T = 0.2857·(U/g)·(g·F/U²)^(1/3).'],
        ['Longitud de onda', o.L, 'm', '', 2, 'L = g·T²/(2π).'],
        ['Base del oleaje (L/2)', o.base, 'm', '', 2, 'Hasta esa profundidad las olas mueven el agua.'],
        ['Parte del fondo que mueven las olas', 100 * o.fFondo, '%', o.fFondo <= 0.25 ? 'ok' : 'aviso', 1, 'En el paraboloide, la fracción del fondo con profundidad menor que d es d/h.'],
        ['Sedimento que levantan ahora', r.ca.SSviento, 'mg/L', '', 2, 'Las plantas sumergidas reducen lo que se levanta.'],
      ],
      ecuacion: [
        ecu.tipo('Funciones potencia: olas limitadas por el fetch'),
        ecu.formula(`${i('H')} = 0.0016·${i('U')}·√(${i('F')}/${i('g')}),  ${i('T')} = 0.2857·(${i('U')}/${i('g')})·(${i('g')}${i('F')}/${i('U')}²)<sup>1/3</sup>`),
        ecu.sust(`${i('H')} = 0.0016 × ${fmt(p.viento, 1)} × √(${fmt(o.F, 0)}/9.81) = ${fmt(o.H, 3)} m;  ${i('T')} = ${fmt(o.T, 2)} s`),
        ecu.tipo('Ecuación cuadrática: longitud de onda en aguas profundas'),
        ecu.formula(`${i('L')} = ${i('g')}·${i('T')}²/(2π)`),
        ecu.sust(`${i('L')} = 9.81 × ${fmt(o.T, 2)}²/(2π) = ${fmt(o.L, 2)} m → base del oleaje ${fmt(o.base, 2)} m`),
        ecu.tipo('Lineal: fondo que alcanzan las olas en el paraboloide'),
        ecu.formula(`${i('f')} = (${i('L')}/2)/${i('h')}`),
        ecu.sust(`${i('f')} = ${fmt(o.base, 2)}/${fmt(r.h, 2)} = ${fmt(100 * o.fFondo, 1)} %`),
      ].join(''),
      graficas: [
        { xTitulo: 'Período T (s)', yTitulo: 'Longitud de onda L (m)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 1),
          series: [serieLinea('L = gT²/(2π)', muestrear((T) => M.longitudOla(T), 0, Tmax, 100), c.agua), seriePuntos('Olas de ahora', [{ x: o.T, y: o.L }], c.ocre)],
          limites: { x: { min: 0, max: Tmax }, y: { min: 0 } }, pie: 'Parábola con vértice en el origen: el doble de período da cuatro veces la longitud.' },
        { xTitulo: 'Viento U (m/s)', yTitulo: 'Fondo removido (%)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Parte del fondo que mueven las olas', fU, c.ocre), serieGuia('Límite de referencia (25 %)', { x: 0, y: 25 }, { x: 25, y: 25 }, c.alerta), seriePuntos('Ahora', [{ x: p.viento, y: 100 * o.fFondo }], c.agua)],
          limites: { x: { min: 0, max: 25 }, y: { min: 0, max: 100 } }, pie: 'Con más viento las olas son más largas y alcanzan una parte mayor del fondo.' },
      ],
    };
  },

  sedimentos({ p, r, c }) {
    const sd = r.sed;
    const { Au, hu } = S.geometria(p);
    const V0 = r.Vu;
    const anos = Math.min(5000, techoRedondo(Math.min(sd.vidaUtil, 5000) * 1.1));
    const Qmed = r.bal.Qp + r.bal.Qg;
    const ret = muestrear((x) => 100 * M.fraccionRetenida(10 ** x, r.A, Qmed), -8, -2, 200).map((pt) => ({ x: pt.x, y: pt.y }));
    return {
      metricas: [
        ['Sedimento que suelta la cuenca', sd.carga, 't/año', '', 1, 'Por usos del suelo y estado del páramo.'],
        ['Rendimiento de la cuenca', sd.rendimiento, 't/ha·año', sd.rendimiento <= 2 ? 'ok' : 'alerta', 2],
        ['Concentración del agua que entra', sd.Cin, 'mg/L', '', 1],
        ['Constante de Stokes K', sd.Kstokes, '1/(m·s)', '', 0, 'K = g(ρ_s − ρ)/(18μ) con el agua fría de la laguna.'],
        ['Se queda en la laguna (eficiencia de atrape)', 100 * sd.TE, '%', '', 1, 'Suma de las clases de grano retenidas.'],
        ['Sedimento en el agua que sale', sd.SSsale, 'mg/L', '', 2],
        ['Volumen que se llena al año', sd.dV, 'm³/año', '', 1, 'ΔV = M·TE/ρ_b.'],
        ['Pérdida de volumen', 100 * sd.fraccionAno, '% al año', sd.fraccionAno <= 0.001 ? 'ok' : 'alerta', 3],
        ['Lodo que se acumula en el fondo', sd.mmAno, 'mm/año', '', 2],
        ['Vida de la laguna (hasta llenarse)', sd.vidaUtil, 'años', '', 0, 'V/ΔV: recta que llega a cero.'],
      ],
      tablas: tablaHTML('Clases de grano del sedimento', ['Clase', 'Diámetro', 'Velocidad de caída', 'Parte de la carga', 'Se queda'],
        sd.granos.map((g) => [g.nombre, `${fmt(g.d * 1e6, 1)} µm`, `${g.vs < 1e-4 ? fmt(g.vs * 1e6, 2) + ' µm/s' : fmt(g.vs * 1000, 3) + ' mm/s'}`, `${fmt(100 * g.f, 0)} %`, { v: `${fmt(100 * g.ret, 0)} %`, clase: g.ret < 0.99 ? 'tenue' : '' }]),
        { numericas: [1, 2, 3, 4], nota: `Un grano se queda si cae más rápido que la carga superficial Q/A = ${fmt((Qmed / r.A) * 1e6, 2)} µm/s.` }),
      ecuacion: [
        ecu.tipo('Ecuación cuadrática: ley de Stokes'),
        ecu.formula(`${sub('v', 's')} = ${i('K')}·${i('d')}²,  ${i('K')} = ${i('g')}(${sub('ρ', 's')} − ${i('ρ')})/(18${i('μ')})`),
        ecu.sust(`${sub('v', 's')}(2 µm) = ${miles(sd.Kstokes)} × (2 × 10<sup>−6</sup>)² = ${fmt(sd.Kstokes * 4e-12 * 1e6, 3)} µm/s`),
        ecu.tipo('Lineal por tramos: lo que se queda de cada grano'),
        ecu.formula(`${i('f')} = mín(1, ${sub('v', 's')}·${i('A')}/${i('Q')})`),
        ecu.tipo('Ecuación lineal: la laguna se llena'),
        ecu.formula(`${i('V')}(${i('t')}) = ${sub('V', '0')} − Δ${i('V')}·${i('t')},  Δ${i('V')} = ${i('M')}·TE/${sub('ρ', 'b')}`),
        ecu.sust(`Δ${i('V')} = ${fmt(sd.carga, 1)} × ${fmt(sd.TE, 3)}/${fmt(p.rhoB, 2)} = ${fmt(sd.dV, 1)} m³/año → se llena en ${miles(sd.vidaUtil)} años`),
      ].join(''),
      graficas: [
        { xTitulo: 'log₁₀ de la velocidad de caída (m/s)', yTitulo: 'Se queda en la laguna (%)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('f = mín(1, v_s·A/Q)', ret, c.ocre), seriePuntos('Clases de grano', sd.granos.map((g) => ({ x: Math.log10(g.vs), y: 100 * g.ret })), c.agua)],
          limites: { x: { min: -8, max: -2 }, y: { min: 0, max: 105 } }, pie: 'Los granos que caen más rápido que la carga superficial se quedan todos; los coloides siguen con el agua.' },
        { xTitulo: 'Años desde hoy', yTitulo: 'Volumen (miles de m³)', formatoX: (v) => miles(v), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('V(t) = V₀ − ΔV·t', [{ x: 0, y: V0 / 1000 }, { x: anos, y: Math.max(0, V0 - sd.dV * anos) / 1000 }], c.agua), seriePuntos('Hoy', [{ x: 0, y: V0 / 1000 }], c.ocre)],
          limites: { x: { min: 0, max: anos }, y: { min: 0 } }, pie: `Recta de pendiente −${fmt(sd.dV, 1)} m³/año: la laguna se llena en ${miles(sd.vidaUtil)} años.` },
      ],
    };
  },

  amenazas({ p, r, c }) {
    const a = r.am;
    const tp = a.tp;
    const tViaje = a.tViaje;
    const atn = Math.exp(-p.distanciaPueblo / p.atenuacion);
    const hor = Math.max(4 * tp, tViaje + 3 * tp) / 3600;
    const hLag = muestrear((h) => M.hidrogramaVaciado(a.Qp, tp, h * 3600), 0, hor, 160);
    const hPue = muestrear((h) => atn * M.hidrogramaVaciado(a.Qp, tp, h * 3600 - tViaje), 0, hor, 160);
    return {
      metricas: [
        ['<b>Vaciado súbito (si el dique se rompe)</b>', '', ''],
        ['Qué represa la laguna', S.CIERRES[p.cierre].nombre, '', a.morrena ? 'aviso' : 'ok'],
        ['Volumen que saldría (hasta la mitad de la profundidad)', a.Vbrecha, 'm³', '', 0],
        ['Caudal pico en la laguna', a.Qp, 'm³/s', '', 1, 'Clague y Mathews: Q = 75·V^0.67, con V en millones de m³.'],
        ['Tiempo al pico', tp / 60, 'min', '', 1, 'Hidrograma Q(t) = Q_p·(t/t_p)·e^(1 − t/t_p) con el volumen de la brecha.'],
        ['Caudal pico en el pueblo', a.Qpueblo, 'm³/s', a.desborda && a.morrena ? 'alerta' : '', 1, 'Atenuación Q(x) = Q_p·e^(−x/λ).'],
        ['Capacidad del cauce en el pueblo', a.capacidad, 'm³/s', '', 1, 'Manning en un cauce trapezoidal.'],
        ['Tiempo de viaje hasta el pueblo (para avisar)', a.tViaje / 60, 'min', a.tViaje >= 1800 ? 'ok' : 'alerta', 0, 't = distancia/velocidad.'],
        ...(r.glof ? [['<b>Vaciado en curso</b>', '', ''], ['Sale ahora por la brecha', r.q.Qglof, 'm³/s', 'alerta', 2], ['Tiempo desde la rotura', fmtTiempo(r.t - r.glof.t0), '']] : []),
        ['<b>Nivel de alerta</b>', '', ''],
        ['Alerta', `alerta ${r.alerta.nivel}`, '', { verde: 'ok', amarilla: 'aviso', naranja: 'naranja', roja: 'alerta' }[r.alerta.nivel]],
        ['Motivos', r.alerta.motivos.join('; ') || 'sin amenazas', ''],
      ],
      ecuacion: [
        ecu.tipo('Función potencia: caudal pico del vaciado'),
        ecu.formula(`${sub('Q', 'p')} = 75·${i('V')}<sup>0.67</sup>  (${i('V')} en millones de m³)`),
        ecu.sust(`${sub('Q', 'p')} = 75 × ${fmt(a.Vbrecha / 1e6, 4)}<sup>0.67</sup> = ${fmt(a.Qp, 1)} m³/s`),
        ecu.tipo('Exponencial: atenuación río abajo'),
        ecu.formula(`${i('Q')}(${i('x')}) = ${sub('Q', 'p')}·e<sup>−${i('x')}/λ</sup>`),
        ecu.sust(`${i('Q')}(${fmt(p.distanciaPueblo, 1)}) = ${fmt(a.Qp, 1)} × e<sup>−${fmt(p.distanciaPueblo, 1)}/${fmt(p.atenuacion, 0)}</sup> = ${fmt(a.Qpueblo, 1)} m³/s`),
        ecu.tipo('Racional: tiempo para avisar'),
        ecu.formula(`${i('t')} = ${i('x')}/${i('v')}`),
        ecu.sust(`${i('t')} = ${miles(p.distanciaPueblo * 1000)}/${fmt(p.velocidadOnda, 1)} = ${miles(a.tViaje)} s = ${fmt(a.tViaje / 60, 0)} min`),
        ecu.nota(a.morrena ? (a.desborda ? 'Si el dique se rompe, la crecida no cabe en el cauce del pueblo: hace falta un sistema de alerta temprana.' : 'Si el dique se rompe, la crecida cabe en el cauce, pero hay que avisar a quienes estén en la quebrada.') : 'Con un umbral de roca la laguna no se puede vaciar de golpe; el cálculo muestra lo que pasaría si estuviera represada por una morrena.', a.morrena && a.desborda),
      ].join(''),
      graficas: [
        { xTitulo: 'Horas desde la rotura', yTitulo: 'Caudal (m³/s)', formatoX: (v) => fmt(v, 1), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('En la laguna', hLag, c.agua), serieLinea('En el pueblo', hPue, c.alerta), serieGuia('Capacidad del cauce', { x: 0, y: a.capacidad }, { x: hor, y: a.capacidad }, c.tinta2)],
          limites: { x: { min: 0, max: hor }, y: { min: 0 } }, pie: 'Hidrograma del vaciado en la laguna y en el pueblo: llega más tarde y más bajo.' },
        { xTitulo: 'Distancia desde la laguna (km)', yTitulo: 'Caudal pico (m³/s)', formatoX: (v) => fmt(v, 0), formatoY: (v) => fmt(v, 0),
          series: [serieLinea('Q(x) = Q_p·e^(−x/λ)', muestrear((x) => M.atenuacion(a.Qp, x, p.atenuacion), 0, 40, 100), c.ocre), serieGuia('Capacidad del cauce', { x: 0, y: a.capacidad }, { x: 40, y: a.capacidad }, c.tinta2), seriePuntos('Pueblo', [{ x: p.distanciaPueblo, y: a.Qpueblo }], c.alerta)],
          limites: { x: { min: 0, max: 40 }, y: { min: 0 } }, pie: 'La crecida pierde fuerza río abajo como una exponencial.' },
      ],
    };
  },
};

// ── Arranque ───────────────────────────────────────────────────────────────
iniciarSimulador({
  proyecto: 'lagunas',
  tabInicial: 'laguna',
  titulo: 'Simulador hídrico 3D',
  subtitulo: 'Lagunas de alta montaña',
  tabs: TABS,
  controles: CONTROLES,
  PARAMETROS: S.PARAMETROS,
  ESCENARIOS: S.ESCENARIOS,
  escenarios: S.ESCENARIOS,
  estadoInicial: S.estadoInicial,
  avanzar: S.avanzar,
  calcular: S.calcular,
  pasoMaximo: 3600,
  reloj: {
    tipo: 'dias', inicio: 6 * 3600, inicioAno: 0,
    velocidades: [{ valor: 600, nombre: '10 min por segundo' }, { valor: 3600, nombre: '1 h por segundo' }, { valor: 21600, nombre: '6 h por segundo' }, { valor: 86400, nombre: '1 día por segundo' }, { valor: 864000, nombre: '10 días por segundo' }],
    defecto: 3600,
  },
  estados,
  pintores: PINTORES,
  serie: {
    intervalos: [{ valor: 3600, nombre: '1 h' }, { valor: 21600, nombre: '6 h' }, { valor: 86400, nombre: '1 día' }],
    intervaloDefecto: 21600,
    columnas: [
      { clave: 'h', nombre: 'Profundidad máxima', unidad: 'm', dec: 3 },
      { clave: 'Qp', nombre: 'Páramo', unidad: 'L/s', dec: 1 },
      { clave: 'Qg', nombre: 'Glaciar', unidad: 'L/s', dec: 1 },
      { clave: 'Qvert', nombre: 'Sale por el vertedero', unidad: 'L/s', dec: 1 },
      { clave: 'Qext', nombre: 'Toma', unidad: 'L/s', dec: 1 },
      { clave: 'V', nombre: 'Plantas', unidad: '%', dec: 1 },
      { clave: 'OD', nombre: 'Oxígeno', unidad: 'mg/L', dec: 2 },
      { clave: 'T', nombre: 'Temperatura del agua', unidad: '°C', dec: 2 },
    ],
    tomar: (p, r) => ({ h: r.h, Qp: L_S(r.q.Qp), Qg: L_S(r.q.Qg), Qvert: L_S(r.q.Qvert + r.q.Qglof), Qext: L_S(r.q.Qext), V: 100 * r.ca.V, OD: r.oxigeno.OD, T: r.oxigeno.Tagua }),
  },
  hojasExcel,
  nodo: N,
  Escena,
  vistas: [
    { id: 'general', nombre: 'Páramo', titulo: 'El páramo, el glaciar y la laguna' },
    { id: 'laguna', nombre: 'Laguna', titulo: 'La laguna, el vertedero y la toma' },
    { id: 'glaciar', nombre: 'Glaciar', titulo: 'El glaciar y el deshielo' },
    { id: 'corte', nombre: 'Corte', titulo: 'Corte de la cubeta: luz, plantas y sedimento' },
    { id: 'pueblo', nombre: 'Quebrada', titulo: 'La quebrada de salida y el pueblo' },
  ],
});
