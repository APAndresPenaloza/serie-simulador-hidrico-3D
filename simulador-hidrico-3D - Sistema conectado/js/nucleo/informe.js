/**
 * informe.js — Pestaña «Informe» de los simuladores de la serie.
 * -----------------------------------------------------------------------
 * Arma un informe de la simulación para imprimir o guardar en PDF: los indicadores, los
 * parámetros que cambiaron, y de cada pestaña elegida sus figuras, resultados, revisión del
 * diseño, tablas, modelo matemático y gráficas, con la escena 3D. Lleva un código QR que
 * vuelve a abrir el simulador con los mismos valores y la misma fecha del reloj: el estado
 * viaja en la dirección, …/#s=<JSON en base64url>.
 *
 * Lo usan el núcleo (app-base.js) y el simulador de ríos (que tiene su propio app.js), cada
 * uno con un adaptador:
 *   { titulo, subtitulo, carpeta,
 *     tabs() → [{ id, nombre }], tabActiva() → id, mostrar(id, silencioso),
 *     escenario() → texto, estadoURL() → objeto,
 *     parametros() → [{ bloque, etiqueta, unidad, valor, referencia }],
 *     capturaEscena() → dataURL | null, textoReferencia (opcional) }
 * El resto (indicadores, resultados, revisión, tablas, figuras, gráficas y reloj) se lee de
 * la página, que ya lo tiene pintado.
 */
import qrcode from './qr.js';

/** Página pública de la serie: el QR apunta allí aunque el informe se arme en una copia local. */
export const SITIO = 'https://apandrespenaloza.github.io/serie-simulador-hidrico-3D/';
const CREDITOS = 'Serie de simuladores hídricos 3D · Ingeniería del Agua y Desarrollo Sostenible · Institución Universitaria de Santa Marta (USM).';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texto = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const esperarCuadro = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

// ── El estado en la dirección ─────────────────────────────────────────────
function aBase64(bytes) {
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(bin);
}
const aBase64url = (txt) => aBase64(new TextEncoder().encode(txt)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function deBase64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/**
 * Quita el ruido de los decimales para que la dirección (y el QR) sean cortos: los enteros
 * quedan iguales y los demás números se guardan con `cifras` cifras significativas.
 */
export function compactar(v, cifras = 10) {
  if (typeof v === 'number') return Number.isFinite(v) && !Number.isInteger(v) ? Number(v.toPrecision(cifras)) : v;
  if (Array.isArray(v)) return v.map((x) => compactar(x, cifras));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, compactar(x, cifras)]));
  return v;
}
/**
 * Serie larga de números (p. ej. los últimos 84 días de temperatura) → { '~': [e, q₀, q₁ − q₀, …] }:
 * enteros en unidades de 10^e (4 cifras de la mayor) guardados como diferencias, que son cortas.
 */
function empacarSerie(a) {
  const max = Math.max(...a.map((x) => Math.abs(x)));
  const e = max > 0 ? Math.floor(Math.log10(max)) - 3 : 0;
  const q = a.map((x) => Math.round(x / 10 ** e));
  return { '~': [e, ...q.map((x, k) => (k ? x - q[k - 1] : x))] };
}
function desempacar(v) {
  if (Array.isArray(v)) return v.map(desempacar);
  if (v && typeof v === 'object') {
    const s = v['~'];
    if (Array.isArray(s) && Object.keys(v).length === 1 && s.length > 0 && s.every(Number.isFinite)) {
      const [e, ...d] = s;
      let q = 0;
      return d.map((x) => { q += x; return Number((q * 10 ** e).toPrecision(12)); });
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desempacar(x)]));
  }
  return v;
}
const serieNumerica = (v) => Array.isArray(v) && v.length > 8 && v.every(Number.isFinite);

/** Estado dinámico (niveles, volúmenes…): 6 cifras; las series largas, empacadas. */
export function compactarEstado(s) {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, serieNumerica(v) ? empacarSerie(v) : compactar(v, 6)]));
}

export const codificarEstado = (estado) => aBase64url(JSON.stringify(estado));

/** Lee el estado de un «#s=…» (de la dirección actual si no se da otro). null si no hay o no se entiende. */
export function leerEstado(hash = location.hash) {
  const m = /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const obj = JSON.parse(deBase64url(m[1]));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? desempacar(obj) : null;
  } catch {
    return null;
  }
}

/** Dirección del simulador con el estado: la de la página publicada, o la de GitHub Pages si se trabaja en local. */
export function urlConEstado(carpeta, estado) {
  const publica = /\.github\.io$/i.test(location.hostname);
  const base = publica ? `${location.origin}${location.pathname}` : `${SITIO}${encodeURI(carpeta)}/`;
  return `${base}#s=${codificarEstado(estado)}`;
}

/** ¿El valor del estado compartido sirve para esta clave? (mismo tipo que el de referencia). */
export function mismoTipo(ref, v) {
  if (typeof ref === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (typeof ref === 'string' || typeof ref === 'boolean') return typeof v === typeof ref;
  if (Array.isArray(ref)) return Array.isArray(v);
  if (ref === null || typeof ref === 'object') return v === null || (typeof v === 'object' && !Array.isArray(v));
  return false;
}

/** Código QR en SVG para una dirección. '' si no cabe en un QR. */
export function qrSVG(url, { modulo = 4, margen = 4, titulo = 'Código QR' } = {}) {
  const niveles = url.length > 900 ? ['L'] : ['M', 'L'];
  for (const nivel of niveles) {
    try {
      const q = qrcode(0, nivel);
      q.addData(url, 'Byte');
      q.make();
      return q.createSvgTag({ cellSize: modulo, margin: margen, scalable: true, alt: titulo, title: titulo });
    } catch {
      /* no cabe con ese nivel de corrección */
    }
  }
  return '';
}

// ── Imágenes de la página ─────────────────────────────────────────────────
function rectanguloRedondo(g, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}
const visible = (el) => {
  const cs = getComputedStyle(el);
  return el.getClientRects().length > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
};

/**
 * Foto de la escena 3D con sus etiquetas (que son HTML encima del lienzo): se copia el lienzo
 * WebGL y se dibuja cada etiqueta con su fondo, su borde y sus textos.
 * `renderizar` dibuja un cuadro justo antes de copiar (hace falta si el lienzo no guarda el búfer).
 */
export function capturarEscena(contenedor, renderizar) {
  const gl = contenedor && [...contenedor.querySelectorAll('canvas')].find((c) => c.width > 0 && !c.closest('.etiqueta3d'));
  if (!gl) return null;
  const c = document.createElement('canvas');
  c.width = gl.width;
  c.height = gl.height;
  const g = c.getContext('2d');
  try {
    renderizar?.();
    g.drawImage(gl, 0, 0);
  } catch {
    return null;
  }
  const caja = gl.getBoundingClientRect();
  if (!caja.width) return null;
  const k = gl.width / caja.width;
  g.scale(k, k);
  for (const el of contenedor.querySelectorAll('.etiqueta3d, .rotulo3d')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right < caja.left || r.left > caja.right || r.bottom < caja.top || r.top > caja.bottom) continue;
    const cs = getComputedStyle(el);
    const x = r.left - caja.left, y = r.top - caja.top;
    rectanguloRedondo(g, x, y, r.width, r.height, parseFloat(cs.borderTopLeftRadius) || 0);
    g.fillStyle = cs.backgroundColor;
    g.fill();
    if (parseFloat(cs.borderTopWidth) > 0) {
      g.strokeStyle = cs.borderTopColor;
      g.lineWidth = 1;
      g.stroke();
    }
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    if (bl > 1.5) {
      g.fillStyle = cs.borderLeftColor;
      g.fillRect(x, y, bl, r.height);
    }
    // Cada nodo de texto en su sitio, con la letra y el color de su elemento
    const paseo = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = paseo.nextNode(); n; n = paseo.nextNode()) {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (!t || !visible(n.parentElement)) continue;
      const rango = document.createRange();
      rango.selectNodeContents(n);
      const rt = rango.getBoundingClientRect();
      if (!rt.width) continue;
      const ct = getComputedStyle(n.parentElement);
      g.font = `${ct.fontStyle} ${ct.fontWeight} ${ct.fontSize} ${ct.fontFamily}`;
      g.fillStyle = ct.color;
      g.textBaseline = 'middle';
      g.fillText(t, rt.left - caja.left, rt.top - caja.top + rt.height / 2);
    }
  }
  try {
    return c.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

/** Copia de un SVG de la página con los estilos calculados escritos en cada elemento (para usarlo fuera de la página). */
const PROPIEDADES_SVG = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'paint-order', 'visibility'];
function svgSuelto(svg) {
  const copia = svg.cloneNode(true);
  const a = [svg, ...svg.querySelectorAll('*')];
  const b = [copia, ...copia.querySelectorAll('*')];
  a.forEach((el, k) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') { b[k].setAttribute('display', 'none'); return; }
    b[k].setAttribute('style', PROPIEDADES_SVG.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    b[k].removeAttribute('class');
  });
  const r = svg.getBoundingClientRect();
  if (!copia.getAttribute('viewBox') && r.width) copia.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('width', String(Math.round(r.width || 600)));
  copia.setAttribute('height', String(Math.round(r.height || 300)));
  const xml = new XMLSerializer().serializeToString(copia);
  return `data:image/svg+xml;base64,${aBase64(new TextEncoder().encode(xml))}`;
}

// ── Lo que se lee de cada pestaña ──────────────────────────────────────────
function leerEstados() {
  return [...document.querySelectorAll('.estados .estado')]
    .filter((e) => texto(e.querySelector('.texto')))
    .map((e) => ({ nivel: e.dataset.nivel || 'ok', html: e.querySelector('.texto').innerHTML }));
}
function leerMetricas(ficha) {
  const dl = ficha.querySelector('dl.metricas');
  if (!dl) return [];
  return [...dl.querySelectorAll(':scope > dt')].map((dt) => {
    const dd = dt.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : null;
    if (!texto(dd)) return { grupo: texto(dt) };
    return { etiqueta: dt.innerHTML, valor: dd.innerHTML, nivel: dd.dataset.nivel ?? '' };
  });
}
function leerRevision(ficha) {
  return [...ficha.querySelectorAll('ul.revision > li')].map((li) => {
    const span = li.querySelector('span:not(.marca-rev)');
    const copia = (span ?? li).cloneNode(true);
    const det = copia.querySelector('small');
    const detalle = det ? det.innerHTML : '';
    det?.remove();
    return { nivel: li.dataset.nivel || 'ok', texto: copia.innerHTML, detalle };
  });
}
function leerFiguras(ficha) {
  const out = [];
  for (const fig of ficha.querySelectorAll('figure.plano, figure.zanja')) {
    if (fig.closest('.experimento')) continue;
    const svg = fig.querySelector('svg');
    if (!svg || !visible(fig)) continue;
    try {
      out.push({ src: svgSuelto(svg), pie: fig.querySelector('figcaption')?.innerHTML ?? '' });
    } catch { /* se omite */ }
  }
  return out;
}
function leerTablas(ficha) {
  return [...ficha.querySelectorAll('.tablas, .tabla-cantidades')].map((t) => t.innerHTML.trim()).filter(Boolean);
}
async function leerGraficas(ficha) {
  const out = [];
  for (const fig of ficha.querySelectorAll('figure.grafica')) {
    const canvas = fig.querySelector('canvas');
    const chart = canvas && window.Chart?.getChart?.(canvas);
    if (!chart || !chart.data.datasets.length || !visible(fig)) continue;
    const antes = chart.options.devicePixelRatio;
    try {
      chart.options.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);   // nítida en el papel
      chart.resize();
      chart.update('none');
      if (canvas.width && canvas.height) out.push({ src: canvas.toDataURL('image/png'), pie: fig.querySelector('figcaption')?.innerHTML ?? '' });
    } catch { /* lienzo sin datos */ } finally {
      chart.options.devicePixelRatio = antes;
      chart.resize();
      chart.update('none');
    }
  }
  return out;
}

// ── El documento del informe ───────────────────────────────────────────────
const MARCA = { ok: '✓', aviso: '!', alerta: '✗' };

function documento(d) {
  const estados = d.estados.map((e) => `<li data-nivel="${esc(e.nivel)}">${e.html}</li>`).join('');
  const ref = d.textoReferencia || (d.escenario ? `escenario «${esc(d.escenario)}»` : 'simulador al abrirlo');
  const parametros = d.parametros.length
    ? `<table class="param"><thead><tr><th>Pestaña</th><th>Parámetro</th><th class="num">Valor</th><th class="num">Referencia</th></tr></thead><tbody>${d.parametros.map((x) => `<tr><td>${esc(x.bloque)}</td><td>${x.etiqueta}</td><td class="num">${esc(x.valor)}${x.unidad ? ` <small>${x.unidad}</small>` : ''}</td><td class="num ref">${esc(x.referencia ?? '')}</td></tr>`).join('')}</tbody></table>
       <p class="nota">Referencia: el valor del ${ref}.</p>`
    : `<p class="nota">Se usan los valores del ${ref}, sin cambios.</p>`;
  const secciones = d.tabs.map((t) => {
    const fig = t.figuras.map((g) => `<figure class="figura"><img src="${g.src}" alt=""><figcaption>${g.pie}</figcaption></figure>`).join('');
    const met = t.metricas.map((m) => (m.grupo !== undefined
      ? `<tr class="grupo"><th colspan="2">${esc(m.grupo)}</th></tr>`
      : `<tr${m.nivel ? ` data-nivel="${esc(m.nivel)}"` : ''}><td>${m.etiqueta}</td><td class="num">${m.valor}</td></tr>`)).join('');
    const rev = t.revision.length ? `<h3>Revisión del diseño</h3><ul class="revision">${t.revision.map((c) => `<li data-nivel="${esc(c.nivel)}"><b>${MARCA[c.nivel] ?? '·'}</b><span>${c.texto}${c.detalle ? `<small>${c.detalle}</small>` : ''}</span></li>`).join('')}</ul>` : '';
    const tab = t.tablas.map((h) => `<div class="tablas">${h}</div>`).join('');
    const ecu = t.ecuacion ? `<h3>Modelo matemático</h3><div class="ecuacion">${t.ecuacion}</div>` : '';
    const graf = t.graficas.length ? `<div class="graficas">${t.graficas.map((g) => `<figure><img src="${g.src}" alt=""><figcaption>${g.pie}</figcaption></figure>`).join('')}</div>` : '';
    return `<section class="tab"><h2>${esc(t.nombre)}</h2>${fig}${met ? `<h3>Resultados</h3><table class="metricas"><tbody>${met}</tbody></table>` : ''}${rev}${tab}${ecu}${graf}</section>`;
  }).join('');
  const todas = d.tabs.flatMap((t) => t.revision);
  const cuenta = (n) => todas.filter((c) => c.nivel === n).length;
  const corta = d.url.split('#')[0].replace(/^https?:\/\//, '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.titulo)} · ${esc(d.simulador)}</title>
<style>
  @page { size: A4; margin: 14mm 13mm 15mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10pt/1.42 "Archivo", "Segoe UI", system-ui, sans-serif; color: #12303B; background: #fff; }
  .hoja { max-width: 184mm; margin: 0 auto; }
  .barra { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 0; }
  .barra button { font: inherit; font-weight: 600; padding: 7px 14px; border-radius: 6px; border: 1px solid #1C86B8; background: #1C86B8; color: #fff; cursor: pointer; }
  .en-marco .barra { display: none; }
  header { display: grid; grid-template-columns: 1fr 44mm; gap: 6mm; align-items: start; border-bottom: 2px solid #1C86B8; padding-bottom: 4mm; }
  .serie { font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: #1C86B8; font-weight: 700; }
  h1 { font-size: 19pt; margin: 1mm 0 1mm; line-height: 1.15; }
  .sim { font-size: 11pt; margin: 0 0 2.5mm; color: #4B6670; }
  dl.meta { display: grid; grid-template-columns: auto 1fr; gap: .5mm 4mm; margin: 0; font-size: 9.5pt; }
  dl.meta dt { color: #4B6670; } dl.meta dd { margin: 0; font-weight: 600; }
  .qr { text-align: center; font-size: 7.5pt; color: #4B6670; }
  .qr svg { width: 44mm; height: 44mm; display: block; }
  .qr p { margin: 1mm 0 0; line-height: 1.3; } .qr .url { word-break: break-all; color: #1C86B8; }
  h2 { font-size: 13.5pt; margin: 7mm 0 2mm; padding-bottom: 1mm; border-bottom: 1px solid #C6D2D1; break-after: avoid; page-break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 4mm 0 1.5mm; break-after: avoid; page-break-after: avoid; }
  section.tab > h2 { color: #1C86B8; }
  ul.estados { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 7mm; }
  ul.estados li { break-inside: avoid; padding: .6mm 0 .6mm 4.5mm; position: relative; }
  ul.estados li::before { content: ""; position: absolute; left: 0; top: 2.1mm; width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #2F7D5B; }
  ul.estados li[data-nivel="aviso"]::before { background: #B7790C; } ul.estados li[data-nivel="alerta"]::before { background: #C0422A; }
  .resumen { display: flex; flex-wrap: wrap; gap: 2mm 6mm; font-size: 9.5pt; margin: 2.5mm 0 0; }
  .resumen b { font-size: 12pt; } .resumen .ok b { color: #2F7D5B; } .resumen .aviso b { color: #B7790C; } .resumen .alerta b { color: #C0422A; }
  .escena img, figure.figura img { width: 100%; display: block; border-radius: 1.5mm; border: 1px solid #C6D2D1; }
  .escena img { max-height: 100mm; object-fit: contain; background: #F6F8F7; }
  figure { margin: 2mm 0 3mm; break-inside: avoid; page-break-inside: avoid; }
  figcaption, .nota { font-size: 8.5pt; color: #4B6670; margin-top: 1mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
  td, th { padding: .9mm 1.5mm; border-bottom: 1px solid #E1E8E7; text-align: left; vertical-align: top; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.metricas td.num, table.param td.num { font-weight: 600; }
  table.param td.ref { font-weight: 400; color: #4B6670; }
  td small, th small { font-weight: 400; color: #4B6670; margin-left: .8mm; }
  thead th { font-size: 8.3pt; color: #4B6670; font-weight: 600; }
  tr.grupo th { padding-top: 2.5mm; font-size: 9.3pt; color: #12303B; border-bottom: 1px solid #C6D2D1; }
  tr[data-nivel="aviso"] td.num { color: #9A6608; } tr[data-nivel="alerta"] td.num { color: #B03A24; } tr[data-nivel="ok"] td.num { color: #2F7D5B; }
  ul.revision { list-style: none; margin: 0; padding: 0; }
  ul.revision li { display: grid; grid-template-columns: 5mm 1fr; padding: .8mm 0; border-bottom: 1px solid #E1E8E7; break-inside: avoid; page-break-inside: avoid; }
  ul.revision li > b { color: #2F7D5B; } ul.revision li[data-nivel="aviso"] > b { color: #B7790C; } ul.revision li[data-nivel="alerta"] > b { color: #C0422A; }
  ul.revision small { display: block; color: #4B6670; font-size: 8.5pt; }
  .tablas h3 { font-size: 10pt; } .tablas table { margin: 1mm 0 2mm; font-size: 8.6pt; }
  .tablas td small { display: block; margin: 0; font-size: 7.8pt; }
  .tablas td.bien { color: #2F7D5B; font-weight: 600; } .tablas td.mal { color: #C0422A; font-weight: 600; } .tablas td.tenue { color: #4B6670; }
  .tablas .marcada, .tablas tr.elegida td { background: #E8F3F8; } .tablas tr.total td { font-weight: 600; border-top: 1px solid #C6D2D1; }
  .tablas .nota-tabla { font-size: 8.3pt; color: #4B6670; margin: 1mm 0 2mm; }
  .ecuacion { border-left: 3px solid #B4823F; padding: 1mm 0 1mm 3.5mm; font-size: 9.5pt; }
  .ecuacion p { margin: .6mm 0; }
  .ecuacion .formula { font-family: "Source Serif 4", Cambria, Georgia, serif; font-size: 11.5pt; }
  .ecuacion .sustitucion { font-family: "Source Serif 4", Cambria, Georgia, serif; font-size: 10.5pt; color: #4B6670; }
  .ecuacion .tipo { font-size: 8.8pt; color: #9A6A2C; font-weight: 600; margin-top: 2.5mm; }
  .ecuacion .tipo:first-child { margin-top: 0; }
  .ecuacion .nota { font-size: 8.5pt; } .ecuacion .nota.alerta { color: #C0422A; }
  .graficas { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 2mm; }
  .graficas figure { margin: 0; } .graficas img { width: 100%; display: block; border: 1px solid #E1E8E7; border-radius: 1.5mm; }
  .notas { white-space: pre-wrap; border-left: 3px solid #B4823F; padding: 1.5mm 3mm; background: #F6F8F7; margin: 0; }
  footer { margin-top: 8mm; padding-top: 2mm; border-top: 1px solid #C6D2D1; font-size: 7.5pt; color: #4B6670; }
  footer a { color: #1C86B8; word-break: break-all; }
  @media screen { body { background: #E6ECEA; } .hoja { background: #fff; padding: 12mm 13mm 14mm; margin: 0 auto 6mm; box-shadow: 0 1px 6px rgba(0,0,0,.15); } }
  @media screen and (max-width: 700px) { .hoja { padding: 6mm 5mm; } header { grid-template-columns: 1fr; } .qr svg { margin: 0 auto; } .graficas { grid-template-columns: 1fr; } ul.estados { columns: 1; } }
  @media print { .barra { display: none; } }
</style></head><body><div class="hoja">
<div class="barra"><button type="button" onclick="print()">Imprimir o guardar en PDF</button></div>
<header>
  <div>
    <div class="serie">Simulador hídrico 3D · Informe de la simulación</div>
    <h1>${esc(d.titulo)}</h1>
    <p class="sim">${esc(d.simulador)}</p>
    <dl class="meta">
      ${d.autores ? `<dt>Autores</dt><dd>${esc(d.autores)}</dd>` : ''}
      <dt>Fecha del informe</dt><dd>${esc(d.fecha)}</dd>
      <dt>Reloj simulado</dt><dd>${esc(d.reloj)}</dd>
      <dt>Escenario</dt><dd>${esc(d.escenario || 'el del simulador al abrirlo')}</dd>
      <dt>Pestañas</dt><dd>${d.tabs.length ? esc(d.tabs.map((t) => t.nombre).join(', ')) : '—'}</dd>
    </dl>
  </div>
  <div class="qr">${d.qr || '<p>La simulación tiene demasiados cambios para un código QR: usa el enlace del pie.</p>'}<p>Escanea el código para abrir esta simulación con los mismos valores.</p><p class="url">${esc(corta)}</p></div>
</header>
<h2>Estado de la simulación</h2>
<ul class="estados">${estados}</ul>
${todas.length ? `<p class="resumen"><span class="ok"><b>${cuenta('ok')}</b> criterios se cumplen</span><span class="aviso"><b>${cuenta('aviso')}</b> en aviso</span><span class="alerta"><b>${cuenta('alerta')}</b> por corregir</span></p>` : ''}
${d.notas ? `<h2>Observaciones</h2><p class="notas">${esc(d.notas)}</p>` : ''}
${d.escena ? `<h2>Escena 3D</h2><figure class="escena"><img src="${d.escena}" alt="Escena 3D del simulador"><figcaption>Vista de la escena al armar el informe (${esc(d.reloj)}).</figcaption></figure>` : ''}
<h2>Parámetros que cambiaron</h2>
${parametros}
${secciones}
<footer>${esc(CREDITOS)} Informe armado con la pestaña «Informe» del simulador.<br>Enlace de esta simulación: <a href="${esc(d.url)}">${esc(d.url)}</a></footer>
</div>
<script>if (window.self !== window.top) document.body.classList.add('en-marco');</script>
</body></html>`;
}

// ── Aviso al abrir una simulación compartida ──────────────────────────────
export function avisoCompartido(html) {
  const panel = document.querySelector('.panel') ?? document.body;
  document.getElementById('avisoCompartido')?.remove();
  const el = document.createElement('div');
  el.id = 'avisoCompartido';
  el.className = 'aviso-compartido';
  el.setAttribute('role', 'status');
  el.innerHTML = `<p>${html}</p><button type="button" class="cerrar-aviso" aria-label="Cerrar el aviso">×</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  panel.prepend(el);
  return el;
}

// ── La pestaña ─────────────────────────────────────────────────────────────
export function crearPanelInforme(f, ad) {
  const guardado = (k, def = '') => { try { return localStorage.getItem(`serie-informe-${k}`) ?? def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(`serie-informe-${k}`, v); } catch { /* sin almacenamiento */ } };
  const tabs = ad.tabs();
  f.innerHTML = `
    <p class="intro">Arma un informe de esta simulación para imprimir o guardar en PDF: el estado de los indicadores, los parámetros que cambiaron y, de cada pestaña que elijas, sus figuras, resultados, revisión del diseño, tablas, modelo matemático y gráficas, con la imagen de la escena 3D. Lleva un <b>código QR</b> que vuelve a abrir el simulador con los mismos valores y la misma fecha del reloj.</p>
    <h3>Datos del informe</h3>
    <div class="control campo"><label for="infTitulo">Título</label><input type="text" id="infTitulo" maxlength="120"></div>
    <div class="control campo"><label for="infAutores">Autores</label><input type="text" id="infAutores" maxlength="200" placeholder="Nombres de quienes presentan el informe"></div>
    <div class="control campo"><label for="infNotas">Observaciones</label><textarea id="infNotas" rows="3" maxlength="3000" placeholder="Qué se probó, qué se observó y qué se concluye"></textarea></div>
    <h3>Pestañas del informe</h3>
    <div class="acciones mini"><button type="button" class="boton" data-todas="1">Todas</button><button type="button" class="boton" data-todas="0">Ninguna</button></div>
    <div class="casillas-informe" id="infPestanas">${tabs.map((t) => `<label><input type="checkbox" value="${esc(t.id)}" checked><span>${esc(t.nombre)}</span></label>`).join('')}</div>
    <h3>Qué lleva cada pestaña</h3>
    <div class="casillas-informe">
      <label><input type="checkbox" id="infEscena" checked><span>Escena 3D</span></label>
      <label><input type="checkbox" id="infFiguras" checked><span>Figuras y planos</span></label>
      <label><input type="checkbox" id="infTablas" checked><span>Tablas</span></label>
      <label><input type="checkbox" id="infEcuaciones" checked><span>Modelo matemático</span></label>
      <label><input type="checkbox" id="infGraficas" checked><span>Gráficas</span></label>
    </div>
    <div class="acciones exportar"><button type="button" class="boton primario" id="btnInforme">Crear informe con QR</button></div>
    <p class="nota-datos" id="infNota" role="status"></p>
    <h3>Código QR de esta simulación</h3>
    <div class="qr-informe"><div class="qr-dibujo" id="infQR"></div><div><p class="nota-datos" id="infQRTexto">Abre este simulador con los valores y la fecha del reloj de este momento. Sirve para compartir la simulación o para llevarla en un póster.</p><div class="acciones"><button type="button" class="boton" id="btnCopiarEnlace">Copiar enlace</button></div></div></div>`;
  const $ = (s) => f.querySelector(s);
  const el = {
    titulo: $('#infTitulo'), autores: $('#infAutores'), notas: $('#infNotas'), pestanas: $('#infPestanas'),
    escena: $('#infEscena'), figuras: $('#infFiguras'), tablas: $('#infTablas'), ecuaciones: $('#infEcuaciones'), graficas: $('#infGraficas'),
    boton: $('#btnInforme'), nota: $('#infNota'), qr: $('#infQR'), qrTexto: $('#infQRTexto'), copiar: $('#btnCopiarEnlace'),
  };
  el.titulo.value = guardado('titulo', 'Informe de la simulación');
  el.autores.value = guardado('autores', '');
  el.titulo.addEventListener('change', () => guardar('titulo', el.titulo.value));
  el.autores.addEventListener('change', () => guardar('autores', el.autores.value));
  f.querySelectorAll('[data-todas]').forEach((b) => b.addEventListener('click', () => {
    for (const ch of el.pestanas.querySelectorAll('input')) ch.checked = b.dataset.todas === '1';
  }));

  let ultimoURL = '';
  let ultimoPintado = -1e9;
  /** QR del momento. Mientras corre el reloj se renueva cada 4 s (forzar: ya). */
  function pintar(forzar = false) {
    const ahora = performance.now();
    if (!forzar && ahora - ultimoPintado < 4000) return;
    ultimoPintado = ahora;
    const url = urlConEstado(ad.carpeta, ad.estadoURL());
    if (url === ultimoURL) return;
    ultimoURL = url;
    const svg = qrSVG(url, { modulo: 3, margen: 2, titulo: 'Código QR de esta simulación' });
    el.qr.innerHTML = svg || '<p class="nota-datos">Demasiados cambios para un QR.</p>';
    el.qr.title = url;
  }
  el.copiar.addEventListener('click', async () => {
    const url = urlConEstado(ad.carpeta, ad.estadoURL());
    try {
      await navigator.clipboard.writeText(url);
      el.nota.textContent = 'Enlace copiado: ábrelo en cualquier navegador para ver esta simulación.';
    } catch {
      el.nota.textContent = url;
    }
  });

  async function crear() {
    if (el.boton.disabled) return null;
    el.boton.disabled = true;
    el.nota.textContent = 'Armando el informe…';
    const original = ad.tabActiva();
    const raiz = document.documentElement;
    const tema = raiz.getAttribute('data-theme');
    let html = null;
    try {
      raiz.setAttribute('data-theme', 'light');          // el papel es claro: colores del tema claro
      await esperarCuadro();
      const elegidas = new Set([...el.pestanas.querySelectorAll('input:checked')].map((i) => i.value));
      const estado = ad.estadoURL();
      const url = urlConEstado(ad.carpeta, estado);
      const escena = el.escena.checked ? ad.capturaEscena() : null;
      const estados = leerEstados();
      const reloj = texto(document.getElementById('reloj'));
      const secciones = [];
      for (const t of tabs.filter((x) => elegidas.has(x.id))) {
        el.nota.textContent = `Armando el informe: ${t.nombre}…`;
        ad.mostrar(t.id, true);
        await esperarCuadro();
        const ficha = document.getElementById(`ficha-${t.id}`);
        if (!ficha) continue;
        secciones.push({
          nombre: t.nombre,
          figuras: el.figuras.checked ? leerFiguras(ficha) : [],
          metricas: leerMetricas(ficha),
          revision: leerRevision(ficha),
          tablas: el.tablas.checked ? leerTablas(ficha) : [],
          ecuacion: el.ecuaciones.checked ? (ficha.querySelector(':scope > .ecuacion')?.innerHTML.trim() ?? '') : '',
          graficas: el.graficas.checked ? await leerGraficas(ficha) : [],
        });
      }
      html = documento({
        titulo: el.titulo.value.trim() || 'Informe de la simulación', autores: el.autores.value.trim(), notas: el.notas.value.trim(),
        simulador: `${ad.titulo} · ${ad.subtitulo}`, fecha: new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }),
        reloj, escenario: ad.escenario(), textoReferencia: ad.textoReferencia ?? '', estados, parametros: ad.parametros(), escena, tabs: secciones,
        url, qr: qrSVG(url, { modulo: 4, margen: 2, titulo: 'Código QR de esta simulación' }),
      });
      el.nota.textContent = `Informe listo: ${secciones.length} ${secciones.length === 1 ? 'pestaña' : 'pestañas'}${escena ? ', la escena 3D' : ''} y el código QR.`;
    } catch (err) {
      console.error(err);
      el.nota.textContent = `No se pudo armar el informe: ${err.message}`;
    } finally {
      if (tema === null) raiz.removeAttribute('data-theme');
      else raiz.setAttribute('data-theme', tema);
      ad.mostrar(original, true);
      el.boton.disabled = false;
    }
    if (html) abrirVistaPrevia(html, nombreArchivo(ad.carpeta));
    return html;
  }
  el.boton.addEventListener('click', crear);
  return { pintar, crear };
}

function nombreArchivo(carpeta) {
  const f = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  const sim = carpeta.replace(/^simulador-hidrico-3D - /, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `informe-${sim}-${f.getFullYear()}${dos(f.getMonth() + 1)}${dos(f.getDate())}-${dos(f.getHours())}${dos(f.getMinutes())}.html`;
}

/** Ventana sobre la página con la vista previa del informe y los botones para imprimir, abrir o descargar. */
function abrirVistaPrevia(html, nombre) {
  document.getElementById('vistaInforme')?.remove();
  const capa = document.createElement('div');
  capa.id = 'vistaInforme';
  capa.className = 'vista-informe';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', 'Vista previa del informe');
  capa.innerHTML = `
    <div class="vista-caja">
      <div class="vista-barra">
        <b>Vista previa del informe</b>
        <div class="acciones">
          <button type="button" class="boton primario" data-accion="imprimir">Imprimir o guardar PDF</button>
          <button type="button" class="boton" data-accion="abrir">Abrir en otra pestaña</button>
          <button type="button" class="boton" data-accion="descargar">Descargar HTML</button>
          <button type="button" class="boton" data-accion="cerrar">Cerrar</button>
        </div>
      </div>
      <iframe title="Informe de la simulación"></iframe>
    </div>`;
  document.body.appendChild(capa);
  const marco = capa.querySelector('iframe');
  marco.srcdoc = html;
  const blob = () => URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(); });
  capa.querySelector('[data-accion="cerrar"]').addEventListener('click', cerrar);
  capa.querySelector('[data-accion="imprimir"]').addEventListener('click', () => { marco.contentWindow?.focus(); marco.contentWindow?.print(); });
  capa.querySelector('[data-accion="abrir"]').addEventListener('click', () => { window.open(blob(), '_blank', 'noopener'); });
  capa.querySelector('[data-accion="descargar"]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = blob();
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  });
  capa.querySelector('[data-accion="imprimir"]').focus();
}
