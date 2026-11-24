// poster.cjs — Póster vertical de 70 × 100 cm de la serie «Simulador hídrico 3D» (PowerPoint editable).
// Uso: node poster.cjs [--sangrado]   → POSTER/Poster_Simulador_Hidrico_3D_70x100.pptx
//      con --sangrado sale el lienzo de 70.6 × 100.6 cm (3 mm por lado) para el PDF de imprenta.
// Necesita las imágenes de imagenes/ (capturas.cjs, qr.py, el logo y la hoja del informe).
const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');

const AQUI = __dirname;
const IMG = (n) => path.join(AQUI, 'imagenes', n);
const SANGRADO = process.argv.includes('--sangrado');
const B = SANGRADO ? 3 / 25.4 : 0;            // 3 mm en pulgadas
const W = 70 / 2.54, H = 100 / 2.54;           // 27.56 × 39.37 in
const M = 1.1;                                 // margen
const CW = W - 2 * M;
const SALIDA = SANGRADO ? path.join(AQUI, 'salida', 'Poster_Simulador_Hidrico_3D_70x100_sangrado.pptx') : path.join(AQUI, '..', '..', 'POSTER', 'Poster_Simulador_Hidrico_3D_70x100.pptx');

const C = { navy: '0B3A55', navy2: '082C42', ink: '12303B', agua: '1C86B8', cielo: '8FD3EE', ocre: 'B4823F', gris: '4B6670', tarjeta: 'EEF4F6', linea: 'C6D2D1', blanco: 'FFFFFF', verde: '2F7D5B', fondo: 'F7FAFA' };
const F = { t: 'Calibri', m: 'Cambria' };

async function icono(Comp, color = 'FFFFFF') {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { size: 512, color: `#${color}` }));
  const png = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'POSTER', width: W + 2 * B, height: H + 2 * B });
  pres.layout = 'POSTER';
  pres.title = 'Simulador hídrico 3D · Póster de la serie';
  pres.author = 'Andrés Mauricio Peñaloza Fernández y Eliana Carolina María Wong Lubo';
  pres.subject = 'Serie de simuladores hídricos 3D del páramo al océano';
  pres.theme = { headFontFace: F.t, bodyFontFace: F.t };
  const s = pres.addSlide();
  s.background = { color: C.blanco };
  const X = (x) => x + B, Y = (y) => y + B;
  const txt = (texto, o) => s.addText(texto, { isTextBox: true, fontFace: F.t, color: C.ink, margin: 0, valign: 'top', ...o, x: X(o.x), y: Y(o.y) });
  const caja = (o, forma = pres.shapes.ROUNDED_RECTANGLE) => s.addShape(forma, { ...o, x: X(o.x), y: Y(o.y) });
  const img = (o) => s.addImage({ ...o, x: X(o.x), y: Y(o.y) });
  const titulo = (texto, x, y, w, n) => {
    caja({ x, y: y + 0.06, w: 0.78, h: 0.78, fill: { color: C.agua }, line: { color: C.agua }, rectRadius: 0.39, objectName: `Marca ${n}` });
    txt(String(n), { x, y: y + 0.06, w: 0.78, h: 0.78, fontSize: 30, bold: true, color: C.blanco, align: 'center', valign: 'middle', objectName: `Número ${n}` });
    txt(texto, { x: x + 1.0, y, w: w - 1.0, h: 0.9, fontSize: 50, bold: true, color: C.navy, valign: 'middle', objectName: `Título ${texto}` });
  };

  // ── 1. Portada ─────────────────────────────────────────────────────────
  const HH = 9.6;
  s.addImage({ path: IMG('portada_red.jpg'), x: 0, y: 0, w: W + 2 * B, h: HH + B, sizing: { type: 'cover', w: W + 2 * B, h: HH + B }, objectName: 'Escena de la serie' });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W + 2 * B, h: HH + B, fill: { color: C.navy2, transparency: 30 }, line: { color: C.navy2, transparency: 100 }, objectName: 'Velo de la portada' });
  txt('INSTITUCIÓN UNIVERSITARIA DE SANTA MARTA · INGENIERÍA DEL AGUA Y DESARROLLO SOSTENIBLE', { x: M, y: 1.05, w: 17.5, h: 0.5, fontSize: 22, bold: true, color: C.cielo, charSpacing: 2 });
  txt('Simulador hídrico 3D', { x: M - 0.06, y: 1.6, w: 18.8, h: 2.2, fontSize: 138, bold: true, color: C.blanco, valign: 'middle', objectName: 'Título del póster' });
  txt('Del páramo al océano: ocho simuladores web en 3D para estudiar el agua de Colombia con álgebra y geometría analítica', { x: M, y: 3.95, w: 18.2, h: 1.75, fontSize: 40, color: C.blanco, objectName: 'Subtítulo' });
  txt([
    { text: 'Andrés Mauricio Peñaloza Fernández', options: { bold: true } },
    { text: '   ·   ', options: { color: C.cielo } },
    { text: 'Eliana Carolina María Wong Lubo', options: { bold: true } },
  ], { x: M, y: 6.15, w: 20, h: 0.65, fontSize: 32, color: C.blanco, objectName: 'Autores' });
  txt('Proyecto integrador de primer semestre · Santa Marta, 2026-II', { x: M, y: 6.85, w: 20, h: 0.55, fontSize: 25, color: C.cielo });
  // Logo en su tarjeta blanca
  caja({ x: W - M - 6.3, y: 1.05, w: 6.3, h: 2.7, fill: { color: C.blanco }, line: { color: C.blanco }, rectRadius: 0.22, objectName: 'Tarjeta del logo' });
  img({ path: IMG('logo_usm.png'), x: W - M - 6.0, y: 1.32, w: 5.7, h: 5.7 * 672 / 1713, objectName: 'Logo de la USM' });
  // Cadena del agua sobre la portada
  const cadena = ['Laguna', 'Lago', 'Río', 'Ciénaga', 'Delta', 'Océano', 'Playa'];
  const cx0 = M, paso = CW / cadena.length;
  cadena.forEach((n, k) => {
    const x = cx0 + k * paso;
    caja({ x: x + 0.08, y: 7.95, w: paso - 0.16, h: 0.95, fill: { color: C.blanco, transparency: 82 }, line: { color: C.cielo, width: 1.5 }, rectRadius: 0.47, objectName: `Eslabón ${n}` });
    txt(n, { x: x + 0.08, y: 7.95, w: paso - 0.16, h: 0.95, fontSize: 28, bold: true, color: C.blanco, align: 'center', valign: 'middle' });
    if (k < cadena.length - 1) txt('›', { x: x + paso - 0.2, y: 7.92, w: 0.4, h: 0.95, fontSize: 40, bold: true, color: C.cielo, align: 'center', valign: 'middle' });
  });

  // ── 2. La serie ────────────────────────────────────────────────────────
  let y = 10.2;
  titulo('Una serie del páramo al océano', M, y, CW, 1);
  y += 1.15;
  txt([
    { text: 'El agua de Santa Marta y del Caribe colombiano viaja por una cadena: la laguna del páramo y el lago de la montaña, el río de la Sierra Nevada, la ciénaga, el delta del Magdalena, el mar y la playa. ', options: { breakLine: false } },
    { text: 'Lo que pasa arriba llega abajo.', options: { bold: true, color: C.navy, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: 'Cada eslabón es un simulador web con su escena 3D, sus ecuaciones con los valores del momento, la revisión del diseño y sus escenarios; le entrega a su vecino lo que sale de él, y el Sistema conectado los une en una sola red.' },
  ], { x: M, y, w: 11.6, h: 3.95, fontSize: 26, lineSpacingMultiple: 1.05, objectName: 'Texto de la serie' });
  // Cifras
  const cifras = [['8', 'simuladores'], ['62', 'pestañas de cálculo'], ['81', 'criterios de diseño'], ['328', 'pruebas automáticas'], ['16', 'documentos y 8 videos']];
  const cxs = M + 12.15, ancho = CW - 12.15;
  cifras.forEach(([n, et], k) => {
    const fila = k < 3 ? 0 : 1, col = k < 3 ? k : k - 3;
    const w = fila === 0 ? (ancho - 2 * 0.4) / 3 : (ancho - 0.4) / 2;
    const x = cxs + col * (w + 0.4);
    const yy = y + fila * 2.05;
    caja({ x, y: yy, w, h: 1.85, fill: { color: C.tarjeta }, line: { color: C.tarjeta }, rectRadius: 0.2, objectName: `Cifra ${et}` });
    txt(n, { x: x + 0.3, y: yy + 0.1, w: w - 0.6, h: 1.0, fontSize: 62, bold: true, color: k === 2 ? C.verde : C.agua });
    txt(et, { x: x + 0.3, y: yy + 1.13, w: w - 0.6, h: 0.58, fontSize: 24, color: C.gris });
  });

  // ── 3. Los ocho simuladores ─────────────────────────────────────────────
  y = 15.6;
  titulo('Los ocho simuladores', M, y, CW, 2);
  txt('Escanea el código de cada tarjeta para abrir el simulador en el celular', { x: M + 11.2, y: y + 0.15, w: CW - 11.2, h: 0.6, fontSize: 24, color: C.gris, align: 'right', valign: 'middle', italic: true });
  y += 1.15;
  const sims = [
    ['lagunas', 'lagunas_general.jpg', '1 · Lagunas', 'Laguna glaciar del páramo: glaciar, páramo, balance del agua, calidad y amenazas.'],
    ['lagos', 'lagos_general.jpg', '2 · Lagos', 'Lago andino: capas por densidad, oxígeno, nutrientes y peces nativos en jaulas.'],
    ['rios', 'rios_general.jpg', '3 · Ríos exorreicos', 'Río de la Sierra Nevada: lluvia, acueducto, riego, acuífero y arroyos de la ciudad.'],
    ['cienagas', 'cienagas_palafitos.jpg', '4 · Ciénagas', 'Ciénaga Grande: caños en los dos sentidos, sal, manglar y pesca.'],
    ['deltas', 'deltas_general.jpg', '5 · Deltas', 'Delta del Magdalena: brazos del río, cuña salina, pluma y dragado.'],
    ['costas', 'costas_playa.jpg', '6 · Costas', 'Playa de El Rodadero: oleaje, corriente, arena y agua de baño.'],
    ['oceanos', 'oceanos_macuira.jpg', '7 · Océanos', 'Mar Caribe: olas, mareas, afloramiento, niebla de Macuira y coral.'],
    ['sistema', 'sistema_red.jpg', '8 · Sistema conectado', 'Los siete modelos en una red: matrices, trazadores, clima y horizonte.'],
  ];
  const tw = (CW - 3 * 0.45) / 4, th = 5.75, ih = 3.45;
  sims.forEach(([id, foto, nombre, desc], k) => {
    const x = M + (k % 4) * (tw + 0.45), yy = y + Math.floor(k / 4) * (th + 0.4);
    caja({ x, y: yy, w: tw, h: th, fill: { color: id === 'sistema' ? 'E3F0F6' : C.tarjeta }, line: { color: id === 'sistema' ? C.agua : C.tarjeta, width: id === 'sistema' ? 2 : 0.5 }, rectRadius: 0.22, objectName: `Tarjeta ${nombre}` });
    img({ path: IMG(foto), x: x + 0.18, y: yy + 0.18, w: tw - 0.36, h: ih, sizing: { type: 'cover', w: tw - 0.36, h: ih }, objectName: `Escena ${nombre}` });
    txt(nombre, { x: x + 0.3, y: yy + ih + 0.32, w: tw - 0.6, h: 0.6, fontSize: 30, bold: true, color: C.navy });
    txt(desc, { x: x + 0.3, y: yy + ih + 0.95, w: tw - 2.05, h: 1.25, fontSize: 19, color: C.ink, lineSpacingMultiple: 1.0 });
    img({ path: IMG(`qr_${id}.png`), x: x + tw - 1.62, y: yy + th - 1.6, w: 1.42, h: 1.42, objectName: `QR ${nombre}` });
  });

  // ── 4. Cómo se usa · Las matemáticas · Informe con QR ───────────────────
  y = 29.25;
  const c3 = (CW - 2 * 0.6) / 3;
  titulo('Cómo se usa', M, y, c3, 3);
  titulo('Las matemáticas', M + c3 + 0.6, y, c3, 4);
  titulo('Informe con código QR', M + 2 * (c3 + 0.6), y, c3, 5);
  y += 1.15;
  const usos = [
    [fa.FaCube, 'Escena 3D', 'Se gira, se acerca y cambia de vista.'],
    [fa.FaSliders, 'Controles y escenarios', 'Cada cambio recalcula todo el sistema.'],
    [fa.FaListCheck, 'Revisión del diseño', 'Verde se cumple; rojo, hay que corregir.'],
    [fa.FaFileExcel, 'Datos', 'Libro de Excel con fórmulas y la serie de tiempo.'],
    [fa.FaDiagramProject, 'Conexión', 'Cada simulador le pasa su frontera al vecino.'],
  ];
  for (const [k, [Ic, t1, t2]] of usos.entries()) {
    const yy = y + k * 0.98;
    caja({ x: M, y: yy + 0.06, w: 0.78, h: 0.78, fill: { color: C.navy }, line: { color: C.navy } }, pres.shapes.OVAL);
    img({ data: await icono(Ic), x: M + 0.19, y: yy + 0.25, w: 0.4, h: 0.4 });
    txt([{ text: t1, options: { bold: true, color: C.navy, breakLine: true } }, { text: t2, options: { color: C.ink } }], { x: M + 1.0, y: yy, w: c3 - 1.0, h: 0.92, fontSize: 20, lineSpacingMultiple: 0.95 });
  }
  // Matemáticas (con subíndices y exponentes de verdad)
  const xm = M + c3 + 0.6;
  const e = (t, o = {}) => ({ text: t, options: { fontFace: F.m, italic: true, ...o } });
  const sub = (t) => e(t, { subscript: true });
  const sup = (t) => e(t, { superscript: true });
  const mates = [
    ['Lineal', [e('T(z) = T'), sub('mar'), e(' − Γ·z')]],
    ['Cuadrática', [e('V(h) = A'), sub('u'), e('·h'), sup('2'), e('/(2·h'), sub('u'), e(')')]],
    ['Potencia', [e('Q = C·L·h'), sup('1.5')]],
    ['Exponencial', [e('Q(t) = Q'), sub('0'), e('·e'), sup('−t/k')]],
    ['Periódica', [e('Q(d) = Q̄·[1 + A·cos(2π(d − d'), sub('1'), e(')/365)]')]],
    ['Matrices', [e('A'), sup('2'), { text: ' cuenta los caminos de la red', options: { fontFace: F.t } }]],
  ];
  caja({ x: xm, y: y - 0.02, w: c3, h: 4.95, fill: { color: C.tarjeta }, line: { color: C.tarjeta }, rectRadius: 0.2, objectName: 'Funciones' });
  mates.forEach(([tipo, runs], k) => {
    const yy = y + 0.18 + k * 0.77;
    txt(tipo, { x: xm + 0.35, y: yy, w: 2.3, h: 0.66, fontSize: 21, bold: true, color: C.ocre, valign: 'middle' });
    txt(runs, { x: xm + 2.65, y: yy, w: c3 - 2.9, h: 0.66, fontSize: 21, color: C.ink, valign: 'middle', fit: 'shrink' });
  });
  // Informe con QR
  const xi = M + 2 * (c3 + 0.6);
  img({ path: IMG('informe_hoja.jpg'), x: xi, y: y - 0.02, w: 3.55, h: 3.55, objectName: 'Primera hoja de un informe' });
  txt([
    { text: 'Nuevo: ', options: { bold: true, color: C.ocre } },
    { text: 'la pestaña Informe arma un PDF de la simulación con un código QR. Al escanearlo se abre el simulador con los mismos valores y la misma fecha del reloj.' },
  ], { x: xi + 3.8, y: y - 0.02, w: c3 - 3.8, h: 3.6, fontSize: 20, lineSpacingMultiple: 1.0 });
  txt('Sirve para entregar talleres, comparar escenarios y repetir el caso de otro estudiante.', { x: xi, y: y + 3.75, w: c3, h: 1.15, fontSize: 20, color: C.gris, italic: true });

  // ── 5. Relación con los cursos ──────────────────────────────────────────
  y = 35.6;
  const cursos = [
    ['Álgebra y Geometría Analítica', 'Rectas, parábolas, potencias, exponenciales, logaritmos y funciones periódicas, con los valores sustituidos.'],
    ['Álgebra lineal aplicada', 'La red como matriz de adyacencia, el sistema de ecuaciones de los trazadores y la iteración del lazo de la costa.'],
    ['Introducción a las Ciencias del Agua y a la Tecnología', 'Ciclo hidrológico y balance P = ETR + Q + ΔS, propiedades del agua, cuencas, calidad y tecnologías del agua.'],
  ];
  cursos.forEach(([t1, t2], k) => {
    const x = M + k * (c3 + 0.6);
    caja({ x, y, w: c3, h: 1.5, fill: { color: C.blanco }, line: { color: C.linea, width: 1 }, rectRadius: 0.18, objectName: `Curso ${t1}` });
    txt([{ text: t1, options: { bold: true, color: C.agua, breakLine: true } }, { text: t2, options: { color: C.ink } }], { x: x + 0.3, y: y + 0.17, w: c3 - 0.6, h: 1.2, fontSize: 19, lineSpacingMultiple: 1.0 });
  });

  // ── 6. Pie ─────────────────────────────────────────────────────────────
  // Banda de 1.9 in con el contenido centrado: el texto queda a más de 1.2 cm del corte
  const yp = H - 1.9;
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: Y(yp), w: W + 2 * B, h: 1.9 + B, fill: { color: C.navy }, line: { color: C.navy }, objectName: 'Pie' });
  caja({ x: M, y: yp + 0.27, w: 1.36, h: 1.36, fill: { color: C.blanco }, line: { color: C.blanco }, rectRadius: 0.08 });
  img({ path: IMG('qr_serie.png'), x: M + 0.05, y: yp + 0.32, w: 1.26, h: 1.26, objectName: 'QR de la serie' });
  txt([
    { text: 'apandrespenaloza.github.io/serie-simulador-hidrico-3D', options: { bold: true, color: C.blanco, breakLine: true } },
    { text: 'Simuladores, informes, manuales y recorridos en video', options: { color: C.cielo } },
  ], { x: M + 1.65, y: yp + 0.35, w: 10.3, h: 1.2, fontSize: 24, valign: 'middle' });
  txt('Docentes: Luis Mario Duarte Sánchez (Álgebra y Geometría Analítica) · Ellery Gregorio Chacuto López (Álgebra lineal aplicada) · David Ricardo De León Pérez y Jaris Jesid González Moreno (Introducción a las Ciencias del Agua y a la Tecnología) · Programa de Ingeniería del Agua y Desarrollo Sostenible · USM · 2026-II',
    { x: M + 12.2, y: yp + 0.34, w: CW - 12.2, h: 1.22, fontSize: 17, color: C.blanco, valign: 'middle', objectName: 'Créditos' });

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  await pres.writeFile({ fileName: SALIDA });
  // Sin las entradas de carpeta del ZIP (algunos servicios en la nube no abren el archivo con ellas)
  require('child_process').execFileSync('zip', ['-dq', SALIDA, '*/']);
  console.log('listo:', SALIDA);
})();
