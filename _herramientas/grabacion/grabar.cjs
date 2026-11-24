// grabar.cjs — Graba el recorrido «Cómo usar el simulador» de un proyecto de la serie: portada,
// pasos con subtítulos, cursor, clics y marcos, cuadro por cuadro con un reloj falso (el video
// sale igual aunque la máquina sea lenta). Después arma el MP4, el GIF y la portada del video.
//
// Uso (con la serie servida, p. ej. python -m http.server 8765 desde la raíz):
//   node grabar.cjs <id> [--base http://localhost:8765/] [--salida carpeta] [--previa] [--verificar]
//     --previa     cuadros pequeños y uno de cada cuatro (para revisar el guion rápido)
//     --verificar  sin cuadros: corre las acciones e imprime lo que dice cada paso (para revisar las cifras)
// Los guiones están en guiones.cjs. Requiere Playwright con Chromium y ffmpeg.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const GUIONES = require('./guiones.cjs');

const FPS = 24;
const ANCHO = 1280;
const ALTO = 720;
const PORTADA = 2.6;          // s con la portada quieta
const FUNDIDO = 0.5;          // s en que la portada se desvanece
const FIN = 1.2;              // s del último cuadro

const arg = (n, d = null) => { const k = process.argv.indexOf(n); return k > 0 ? process.argv[k + 1] : d; };
const id = process.argv[2];
const G = GUIONES[id];
if (!G) { console.error(`Guion desconocido: ${id}. Hay: ${Object.keys(GUIONES).join(', ')}`); process.exit(1); }
const BASE = arg('--base', 'http://localhost:8765/');
const PREVIA = process.argv.includes('--previa');
const VERIFICAR = process.argv.includes('--verificar');
const SALIDA = arg('--salida', path.join(__dirname, 'salida', G.medio));
const CUADROS = path.join(SALIDA, 'cuadros');

const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);   // ease-in-out cúbica
const entre = (a, b, k) => a + (b - a) * k;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Capa del recorrido (portada, subtítulo, cursor, onda del clic y marco) ──
const CSS = `
#rec-capa { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: "Archivo", "Inter", "Segoe UI", system-ui, sans-serif; }
#rec-capa * { box-sizing: border-box; }
#rec-cursor { position: absolute; left: 0; top: 0; width: 28px; height: 28px; opacity: 0; filter: drop-shadow(0 1.5px 2px rgba(0,0,0,.5)); }
#rec-onda { position: absolute; left: 0; top: 0; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 3px solid #49ADDA; background: rgba(73,173,218,.18); opacity: 0; }
#rec-marco { position: absolute; border: 3px solid #1C86B8; border-radius: 9px; box-shadow: 0 0 0 5px rgba(28,134,184,.22), 0 0 18px rgba(28,134,184,.35); opacity: 0; }
#rec-sub { position: absolute; left: 14px; bottom: 46px; width: max-content; max-width: 780px; display: flex; gap: 13px; align-items: flex-start;
  padding: 13px 20px 14px 13px; background: rgba(14,32,45,.95); color: #fff; border-radius: 11px; font-size: 19.5px; line-height: 1.4;
  box-shadow: 0 8px 24px rgba(0,0,0,.35); opacity: 0; }
#rec-sub .n { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; background: #49ADDA; color: #0E2027; font-weight: 750; font-size: 16.5px;
  display: grid; place-items: center; margin-top: 0; }
#rec-sub b { color: #8FD3EE; font-weight: 700; }
#rec-portada { position: absolute; inset: 0; color: #fff; overflow: hidden;
  background: radial-gradient(120% 90% at 18% 10%, #2A8FC4 0%, #17699A 42%, #0C3F62 100%); }
#rec-portada svg.olas { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 46%; }
#rec-portada .cuerpo { position: absolute; left: 96px; right: 96px; top: 158px; }
#rec-portada .serie { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; opacity: .95; }
#rec-portada .serie svg { width: 17px; height: 17px; }
#rec-portada h1 { font-size: 58px; line-height: 1.06; margin: 16px 0 10px; font-weight: 750; letter-spacing: -.01em; }
#rec-portada .sub { font-size: 23px; opacity: .93; margin: 0; }
#rec-portada .pildora { display: inline-block; margin-top: 30px; padding: 9px 18px; border-radius: 999px; background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.28); font-size: 17px; font-weight: 650; }
#rec-portada .pie { position: absolute; left: 64px; right: 64px; bottom: 26px; display: flex; justify-content: space-between; gap: 24px;
  padding-top: 14px; border-top: 1px solid rgba(255,255,255,.35); font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0,20,35,.55); }
`;

function capaHTML(g) {
  const gota = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C16 3 6 14.5 6 20.5a10 10 0 0 0 20 0C26 14.5 16 3 16 3z" fill="#fff"/></svg>';
  const olas = `<svg class="olas" viewBox="0 0 1280 330" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 120 C 220 60 420 180 640 120 S 1060 60 1280 120 L1280 330 L0 330 Z" fill="rgba(255,255,255,.06)"/>
    <path d="M0 175 C 240 120 430 230 660 172 S 1080 118 1280 170 L1280 330 L0 330 Z" fill="rgba(255,255,255,.07)"/>
    <path d="M0 232 C 260 190 470 280 700 230 S 1090 190 1280 228 L1280 330 L0 330 Z" fill="rgba(8,34,54,.35)"/>
  </svg>`;
  return `<div id="rec-portada">${olas}<div class="cuerpo"><div class="serie">${gota}<span>Simulador hídrico 3D · Serie del páramo al océano</span></div>
      <h1>${g.titulo}</h1><p class="sub">${g.subtitulo}</p><span class="pildora">Cómo usar el simulador · ${g.numero} de 8</span></div>
      <div class="pie"><span>Institución Universitaria de Santa Marta · Ingeniería del Agua y Desarrollo Sostenible</span><span>Álgebra y Geometría Analítica · 2026-II</span></div></div>
    <div id="rec-marco"></div><div id="rec-sub"><span class="n"></span><span class="t"></span></div><div id="rec-onda"></div>
    <svg id="rec-cursor" viewBox="0 0 28 28"><path d="M4 2.5 L4 22.5 L9.2 17.6 L12.6 25.2 L16.2 23.6 L12.9 16.2 L20 16.2 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

/** Pinta la capa con el estado de este cuadro (lo llama Node en cada cuadro). */
function pintarCapa(e) {
  const $ = (id) => document.getElementById(id);
  const portada = $('rec-portada');
  portada.style.opacity = e.portada;
  portada.style.display = e.portada > 0 ? '' : 'none';
  const c = $('rec-cursor');
  c.style.opacity = e.cursor.visible ? 1 : 0;
  c.style.transform = `translate(${e.cursor.x - 4}px, ${e.cursor.y - 2.5}px)`;
  const o = $('rec-onda');
  o.style.opacity = e.onda ? 1 - e.onda.k : 0;
  if (e.onda) { o.style.left = `${e.onda.x}px`; o.style.top = `${e.onda.y}px`; o.style.transform = `scale(${0.45 + 0.9 * e.onda.k})`; }
  const m = $('rec-marco');
  m.style.opacity = e.marco ? e.marco.a : 0;
  if (e.marco) Object.assign(m.style, { left: `${e.marco.x - 6}px`, top: `${e.marco.y - 6}px`, width: `${e.marco.w + 12}px`, height: `${e.marco.h + 12}px` });
  const s = $('rec-sub');
  s.style.opacity = e.sub ? e.sub.a : 0;
  if (e.sub) {
    if (s.dataset.n !== String(e.sub.n)) {
      s.dataset.n = String(e.sub.n);
      s.querySelector('.n').textContent = e.sub.n;
      s.querySelector('.t').innerHTML = e.sub.html;
    }
    s.style.transform = `translateY(${(1 - e.sub.a) * 10}px)`;
    s.style.bottom = `${e.sub.abajo ?? 46}px`;
  }
}

// ── Navegador ───────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(CUADROS, { recursive: true });
  for (const f of fs.readdirSync(CUADROS)) fs.unlinkSync(path.join(CUADROS, f));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=TranslateUI'] });
  const ctx = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: PREVIA ? 0.75 : 1.5, colorScheme: 'light', locale: 'es-CO' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g/.test(m.text())) errores.push(m.text()); });
  await page.clock.install({ time: new Date('2026-11-24T08:00:00-05:00') });
  await page.goto(BASE + encodeURI(G.carpeta) + '/' + (G.hash ?? ''), { waitUntil: 'load' });
  for (let k = 0; k < 600; k++) {
    if (await page.evaluate(() => document.documentElement.dataset.listo === '1')) break;
    await dormir(100);
  }
  // Un solo requestAnimationFrame por cuadro del video (con el reloj falso corrían dos o tres por
  // cuadro y la escena 3D se dibujaba de más): los pedidos esperan en una cola y se atienden una
  // vez por cuadro, con la hora del reloj falso.
  await page.evaluate(() => {
    window.__rafCola = [];
    window.requestAnimationFrame = (cb) => { window.__rafCola.push(cb); return window.__rafCola.length; };
    window.cancelAnimationFrame = () => {};
    window.__rafPaso = () => { const cola = window.__rafCola; window.__rafCola = []; const t = performance.now(); for (const cb of cola) { try { cb(t); } catch (e) { console.error(e); } } };
  });
  // Reloj quieto: desde aquí el tiempo de la página solo avanza un cuadro a la vez
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);
  await page.evaluate(G.preparar ?? '0');
  await page.addStyleTag({ content: CSS });
  await page.evaluate((html) => { const d = document.createElement('div'); d.id = 'rec-capa'; d.innerHTML = html; document.body.appendChild(d); }, capaHTML(G));
  await page.clock.runFor(200);
  await page.evaluate(() => window.__rafPaso());

  // ── Línea de tiempo ───────────────────────────────────────────────────
  const pasos = [];
  let t0 = PORTADA + FUNDIDO * 0.6;
  for (const [k, p] of G.pasos.entries()) {
    pasos.push({ ...p, n: k + 1, inicio: t0, fin: t0 + p.dur });
    t0 += p.dur;
  }
  const total = t0 + FIN;
  const nCuadros = Math.round(total * FPS);
  const html = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Estado de lo que se dibuja encima
  const cursor = { x: ANCHO * 0.42, y: ALTO * 0.55, visible: false };
  let mov = null;            // { desde, hasta, t0, t1 }
  let onda = null;           // { x, y, t0 }
  let marco = null;          // { caja, t0, t1 }
  let arrastre = null;       // { desde, hasta, t0, t1, abajo }
  let rueda = null;          // { dy, t0, t1, dado }
  let rango = null;          // { sel, v0, v1, t0, t1 }
  let scroll = null;         // { sel0, y0, y1, t0, t1 }
  const hechas = new Set();
  const registro = [];

  const caja = async (sel) => page.evaluate((s) => {
    if (s.startsWith('filas:')) {            // filas:<contenedor>|<desde>|<hasta>: filas de resultados de una etiqueta a otra
      const [cont, desde, hasta = desde] = s.slice(6).split('|');
      const dts = [...document.querySelectorAll(`${cont} dl.metricas > dt`)];
      const i = dts.findIndex((d) => d.textContent.includes(desde));
      if (i < 0) return null;
      let j = i;
      for (let k = i; k < dts.length; k++) if (dts[k].textContent.includes(hasta)) { j = k; break; }
      const rs = dts.slice(i, j + 1).flatMap((d) => [d, d.nextElementSibling]).filter(Boolean).map((e) => e.getBoundingClientRect());
      const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
      return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.right)) - x0, h: Math.max(...rs.map((r) => r.bottom)) - y0 };
    }
    const parte = s.split(' >>> ');
    let el;
    let dx = 0, dy = 0;
    if (parte.length === 2) {          // dentro del iframe del informe
      const fr = document.querySelector(parte[0]);
      const r0 = fr?.getBoundingClientRect();
      el = fr?.contentDocument?.querySelector(parte[1]);
      dx = r0?.left ?? 0; dy = r0?.top ?? 0;
    } else el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + dx, y: r.top + dy, w: r.width, h: r.height };
  }, sel);
  const punto = async (a) => {
    if (a.escena) {
      const b = await caja('#escena');
      return { x: b.x + a.escena[0] * b.w, y: b.y + a.escena[1] * b.h };
    }
    if (a.sel) {
      const b = await caja(a.sel);
      if (!b) throw new Error(`No está: ${a.sel}`);
      return { x: b.x + (a.fx ?? 0.5) * b.w, y: b.y + (a.fy ?? 0.5) * b.h };
    }
    return { x: a.x, y: a.y };
  };
  const moverA = async (a, t, dur) => {
    const hasta = await punto(a);
    mov = { desde: { x: cursor.x, y: cursor.y }, hasta, t0: t, t1: t + Math.max(dur, 0.05) };
    cursor.visible = true;
    return hasta;
  };

  async function ejecutar(acc, t) {
    const d = acc.dur ?? 0.7;
    switch (acc.tipo) {
      case 'mover': await moverA(acc.a, t, d); break;
      case 'ocultar': cursor.visible = false; break;
      case 'clic': {
        const p = await moverA(acc.a, t, d);
        acc._clic = { p, t: t + d };
        break;
      }
      case 'arrastrar': {
        const desde = await punto(acc.desde);
        const hasta = await punto(acc.hasta);
        cursor.x = desde.x; cursor.y = desde.y; cursor.visible = true; mov = null;
        arrastre = { desde, hasta, t0: t, t1: t + d, abajo: false };
        break;
      }
      case 'rueda': {
        const p = await punto(acc.a);
        cursor.x = p.x; cursor.y = p.y; cursor.visible = true; mov = null;
        await page.mouse.move(p.x, p.y);
        rueda = { dy: acc.dy, t0: t, t1: t + d, dado: 0 };
        break;
      }
      case 'rango': {
        const info = await page.evaluate((s) => { const el = document.querySelector(s); return el && { v: Number(el.value), min: Number(el.min), max: Number(el.max) }; }, acc.sel);
        if (!info) throw new Error(`No está: ${acc.sel}`);
        const b = await caja(acc.sel);
        const xDe = (v) => b.x + 8 + ((v - info.min) / (info.max - info.min || 1)) * (b.w - 16);
        cursor.visible = true;
        mov = { desde: { x: cursor.x, y: cursor.y }, hasta: { x: xDe(info.v), y: b.y + b.h / 2 }, t0: t, t1: t + 0.5 };
        rango = { sel: acc.sel, v0: info.v, v1: acc.valor, t0: t + 0.55, t1: t + 0.55 + d, xDe, y: b.y + b.h / 2, paso: acc.paso };
        break;
      }
      case 'opcion': {
        const p = await moverA({ sel: acc.sel }, t, d);
        acc._opcion = { p, t: t + d };
        break;
      }
      case 'marco': {
        const b = await caja(acc.sel);
        if (!b) throw new Error(`No está: ${acc.sel}`);
        marco = { caja: b, t0: t, t1: t + (acc.dur ?? 1.6) };
        break;
      }
      case 'desplazar': {
        const r = await page.evaluate(({ s, margen }) => {
          const el = document.querySelector(s);
          const panel = document.querySelector('.panel');
          if (!el || !panel) return null;
          const y = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - margen;
          return { y0: panel.scrollTop, y1: Math.max(0, Math.min(y, panel.scrollHeight - panel.clientHeight)) };
        }, { s: acc.sel, margen: acc.margen ?? 70 });
        if (r) scroll = { ...r, t0: t, t1: t + d };
        break;
      }
      case 'arriba': {
        const y0 = await page.evaluate(() => document.querySelector('.panel')?.scrollTop ?? 0);
        scroll = { y0, y1: 0, t0: t, t1: t + d };
        break;
      }
      case 'js': await page.evaluate(acc.codigo); break;
      case 'informe': {
        // Clic en «Crear informe con QR»; mientras se arma (recorre las pestañas) no se graban cuadros
        await page.click('#btnInforme');
        for (let k = 0; k < 600; k++) {
          const listo = await page.evaluate(() => {
            const fr = document.querySelector('#vistaInforme iframe');
            return Boolean(fr && fr.contentDocument?.readyState === 'complete' && fr.contentDocument.querySelector('.qr svg') && !document.querySelector('#btnInforme').disabled);
          });
          if (listo) break;
          await page.clock.runFor(17);
          await page.evaluate(() => window.__rafPaso());
          await dormir(20);
        }
        await page.evaluate(() => new Promise((res) => {
          const fr = document.querySelector('#vistaInforme iframe');
          const imgs = [...(fr?.contentDocument?.images ?? [])];
          Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = r; i.onerror = r; })))).then(res);
        }));
        await dormir(300);
        break;
      }
      default: throw new Error(`Acción desconocida: ${acc.tipo}`);
    }
  }

  const paso = (n) => Math.round(n);
  const fotos = PREVIA ? 4 : 1;
  console.log(`${G.medio}: ${pasos.length} pasos, ${total.toFixed(1)} s, ${nCuadros} cuadros${PREVIA ? ' (previa)' : ''}${VERIFICAR ? ' (verificar)' : ''}`);
  const inicio = Date.now();
  for (let f = 0; f < nCuadros; f++) {
    const t = f / FPS;
    // Acciones que empiezan en este cuadro
    for (const p of pasos) {
      for (const [j, acc] of (p.acciones ?? []).entries()) {
        const clave = `${p.n}.${j}`;
        if (!hechas.has(clave) && t >= p.inicio + (acc.t ?? 0)) {
          hechas.add(clave);
          await ejecutar(acc, t);
        }
        if (acc._clic && !acc._clic.hecho && t >= acc._clic.t) {
          acc._clic.hecho = true;
          onda = { ...acc._clic.p, t0: t };
          if (acc.js) await page.evaluate(acc.js);
          else await page.mouse.click(acc._clic.p.x, acc._clic.p.y);
        }
        if (acc._opcion && !acc._opcion.hecho && t >= acc._opcion.t) {
          acc._opcion.hecho = true;
          onda = { ...acc._opcion.p, t0: t };
          await page.evaluate(({ s, v }) => {
            const el = document.querySelector(s);
            el.value = String(v);
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, { s: acc.sel, v: acc.valor });
        }
      }
      if (VERIFICAR && p.verificar && !hechas.has(`v${p.n}`) && t >= p.fin - 0.05) {
        hechas.add(`v${p.n}`);
        registro.push(`  ${p.n}. ${await page.evaluate(p.verificar)}`);
      }
    }
    // Movimiento continuo
    if (mov) {
      const k = Math.min(1, (t - mov.t0) / (mov.t1 - mov.t0));
      cursor.x = entre(mov.desde.x, mov.hasta.x, suave(k));
      cursor.y = entre(mov.desde.y, mov.hasta.y, suave(k));
      if (k >= 1) mov = null;
    }
    if (arrastre) {
      const k = Math.min(1, Math.max(0, (t - arrastre.t0) / (arrastre.t1 - arrastre.t0)));
      const x = entre(arrastre.desde.x, arrastre.hasta.x, suave(k));
      const y = entre(arrastre.desde.y, arrastre.hasta.y, suave(k));
      if (!arrastre.abajo) { await page.mouse.move(x, y); await page.mouse.down(); arrastre.abajo = true; }
      await page.mouse.move(x, y);
      cursor.x = x; cursor.y = y;
      if (k >= 1) { await page.mouse.up(); arrastre = null; }
    }
    if (rueda) {
      const k = Math.min(1, (t - rueda.t0) / (rueda.t1 - rueda.t0));
      const meta = rueda.dy * suave(k);
      const d = meta - rueda.dado;
      if (Math.abs(d) >= 1) { await page.mouse.wheel(0, d); rueda.dado = meta; }
      if (k >= 1) rueda = null;
    }
    if (rango && t >= rango.t0) {
      const k = Math.min(1, (t - rango.t0) / (rango.t1 - rango.t0));
      let v = entre(rango.v0, rango.v1, suave(k));
      if (rango.paso) v = Math.round(v / rango.paso) * rango.paso;
      await page.evaluate(({ s, v }) => {
        const el = document.querySelector(s);
        if (Number(el.value) !== v) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }
      }, { s: rango.sel, v });
      cursor.x = rango.xDe(Number(await page.evaluate((s) => document.querySelector(s).value, rango.sel)));
      cursor.y = rango.y;
      if (k >= 1) rango = null;
    }
    if (scroll) {
      const k = Math.min(1, (t - scroll.t0) / (scroll.t1 - scroll.t0));
      await page.evaluate((y) => { const p = document.querySelector('.panel'); if (p) p.scrollTop = y; }, entre(scroll.y0, scroll.y1, suave(k)));
      if (k >= 1) scroll = null;
    }
    // Lo que se dibuja encima
    const pa = pasos.find((p) => t >= p.inicio && t < p.fin) ?? (t >= pasos[pasos.length - 1].fin ? pasos[pasos.length - 1] : null);
    let sub = null;
    if (pa) {
      const a = Math.min(1, (t - pa.inicio) / 0.3) * (pa === pasos[pasos.length - 1] ? 1 : Math.min(1, (pa.fin - t) / 0.25));
      sub = { n: pa.n, html: html(pa.texto), a: Math.max(0, a), abajo: pa.abajo };
    }
    const estado = {
      portada: t < PORTADA ? 1 : Math.max(0, 1 - (t - PORTADA) / FUNDIDO),
      cursor,
      onda: onda && t - onda.t0 < 0.55 ? { x: onda.x, y: onda.y, k: (t - onda.t0) / 0.55 } : null,
      marco: marco && t < marco.t1 ? { ...marco.caja, a: Math.min(1, (t - marco.t0) / 0.25, (marco.t1 - t) / 0.3) } : null,
      sub,
    };
    if (!VERIFICAR) await page.evaluate(pintarCapa, estado);
    await page.clock.runFor(1000 / FPS);
    await page.evaluate(() => window.__rafPaso());
    if (!VERIFICAR && f % fotos === 0) {
      await page.screenshot({ path: path.join(CUADROS, `c_${String(paso(f / fotos)).padStart(5, '0')}.jpg`), type: 'jpeg', quality: PREVIA ? 70 : 90 });
    }
    if (f % 120 === 0) {
      const s = (Date.now() - inicio) / 1000;
      process.stdout.write(`  cuadro ${f}/${nCuadros} · ${s.toFixed(0)} s · faltan ~${((s / (f + 1)) * (nCuadros - f) / 60).toFixed(1)} min\n`);
    }
  }
  await browser.close();
  if (registro.length) console.log(registro.join('\n'));
  if (errores.length) console.log('errores en la página:\n  ' + errores.slice(0, 10).join('\n  '));
  if (VERIFICAR) return;

  // ── Video, GIF y portada ─────────────────────────────────────────────────
  const fps = PREVIA ? FPS / fotos : FPS;
  const mp4 = path.join(SALIDA, `${G.medio}.mp4`);
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(CUADROS, 'c_%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  if (PREVIA) { console.log(`previa: ${mp4}`); return; }
  const gif = G.gif ?? {};
  const gifRuta = path.join(SALIDA, `${G.medio}.gif`);
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', mp4, '-vf',
    `fps=${gif.fps ?? 12},scale=960:540:flags=lanczos,split[a][b];[a]palettegen=max_colors=${gif.colores ?? 128}:stats_mode=${gif.stats ?? 'diff'}[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    gifRuta]);
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', path.join(CUADROS, 'c_00194.jpg'), '-vf', 'scale=960:540:flags=lanczos', '-q:v', '3', path.join(SALIDA, `${G.medio}.jpg`)]);
  const mb = (p) => (fs.statSync(p).size / 1e6).toFixed(1);
  console.log(`listo: ${mp4} (${mb(mp4)} MB), ${gifRuta} (${mb(gifRuta)} MB), portada ${G.medio}.jpg · ${((Date.now() - inicio) / 60000).toFixed(1)} min`);
}

main().catch((e) => { console.error(e); process.exit(1); });
