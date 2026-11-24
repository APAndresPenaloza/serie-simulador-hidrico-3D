// capturas.cjs — Imágenes de la escena 3D de cada simulador para el póster (sin panel ni etiquetas).
// Uso: node capturas.cjs [base] [salida]   (con la serie servida en base)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || path.join(__dirname, 'imagenes');
const SIMS = [
  ['lagunas', 'Lagunas', ['general', 'laguna']], ['lagos', 'Lagos', ['general', 'jaulas']], ['rios', 'Rios exorreicos', ['general', 'cuenca']],
  ['cienagas', 'Cienagas', ['general', 'palafitos']], ['deltas', 'Deltas', ['general', 'boca']], ['costas', 'Costas', ['playa', 'rompiente']],
  ['oceanos', 'Oceanos', ['mar', 'macuira', 'arrecife']], ['sistema', 'Sistema conectado', ['red', 'sierra']],
];
const CSS = `.barra, .panel, .ayuda, .vistas, .leyenda, .etiqueta3d, .rotulo3d, #avisoCompartido { display: none !important; }
  body { height: 100vh !important; overflow: hidden !important; } .layout { display: block !important; height: 100vh !important; }
  .escena { height: 100vh !important; width: 100vw !important; }`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const foto = async (id, carpeta, vista, w, h, dsf, nombre) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    await p.goto(BASE + encodeURI('simulador-hidrico-3D - ' + carpeta) + '/' + (id === 'rios' ? '#depurar' : ''), { waitUntil: 'load' });
    await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 90000 });
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => window.dispatchEvent(new Event('resize')));
    await p.evaluate((v) => {
      const s = window.__sim;
      if (s?.pausar) s.pausar(); else if (s?.sim) s.sim.corriendo = false;
      const e = s?.escena;
      if (e?.redimensionar) e.redimensionar();
      if (e?.irAVista) e.irAVista(v, true);
    }, vista);
    await p.waitForTimeout(2500);
    await p.locator('#escena').screenshot({ path: path.join(OUT, nombre), type: 'jpeg', quality: 93 });
    await p.close();
    console.log('  ', nombre);
  };
  for (const [id, carpeta, vistas] of SIMS) {
    for (const v of vistas) await foto(id, carpeta, v, 1500, 1000, 1, `${id}_${v}.jpg`);
  }
  await foto('sistema', 'Sistema conectado', 'red', 1800, 900, 2, 'portada_red.jpg');
  await foto('sistema', 'Sistema conectado', 'sierra', 1800, 900, 2, 'portada_sierra.jpg');
  await b.close();
})();
