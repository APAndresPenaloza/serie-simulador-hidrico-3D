// Capturas de la pestaña Informe del simulador de ríos (proyecto de referencia, con su propio app.js)
// para el anexo de su manual: la pestaña, la vista previa, la primera hoja del informe y el
// simulador abierto desde el código QR.
// Uso: node rios_informe.cjs URL_de_la_serie carpetaSalida
//   URL_de_la_serie: la carpeta servida que contiene todos los proyectos (p. ej. http://localhost:8800/)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITIO = 'https://apandrespenaloza.github.io/serie-simulador-hidrico-3D/';
const CARPETA = 'simulador-hidrico-3D - Rios exorreicos';

(async () => {
  const [,, base, out] = process.argv;
  fs.mkdirSync(path.join(out, 'img'), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errores = [];
  const vigilar = (pg, etiqueta) => {
    pg.on('pageerror', (e) => errores.push(`PAGEERROR${etiqueta} ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g/.test(m.text())) errores.push(`console${etiqueta} ${m.text()}`); });
  };

  // Caso de ejemplo: el caudal de bombeo sube un 30 % y el reloj corre unos segundos; luego, en pausa.
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  page.setDefaultTimeout(180000);
  vigilar(page, '');
  await page.goto(new URL(encodeURI(CARPETA) + '/#depurar', base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sim && document.documentElement.dataset.listo === '1', null, { timeout: 90000 });
  await page.evaluate(() => {
    document.getElementById('ayuda')?.classList.add('oculta');
    const s = window.__sim;
    s.p.Qbombeo = Math.round(s.p.Qbombeo * 1.3 * 10) / 10;
    s.cambio();
  });
  await page.waitForTimeout(4000);
  await page.click('#btnPlay');
  await page.evaluate(() => window.__sim.mostrarTab('bombas'));
  await page.waitForTimeout(500);

  // La pestaña (alta, para que quepa entera)
  await page.setViewportSize({ width: 1500, height: 2000 });
  await page.click('#pestana-informe');
  await page.fill('#infTitulo', 'Informe de la simulación');
  await page.fill('#infAutores', 'Andrés Mauricio Peñaloza Fernández y Eliana Carolina María Wong Lubo');
  await page.fill('#infNotas', 'Caso de ejemplo del manual: se subió el caudal de bombeo y se dejó correr el reloj.');
  await page.waitForTimeout(800);
  await page.locator('#ficha-informe').screenshot({ path: path.join(out, 'img', 'informe.png') });

  // La vista previa
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(800);
  const ejemplo = await page.evaluate(() => ({
    url: window.__sim.url(),
    parametros: window.__sim.parametrosCambiados(),
    reloj: document.getElementById('reloj').textContent,
  }));
  const html = await page.evaluate(() => window.__sim.informe());
  await page.waitForSelector('#vistaInforme iframe');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'img', 'informe_vista.png') });
  await page.close();
  fs.writeFileSync(path.join(out, 'informe_ejemplo.html'), html ?? '');

  // Primera hoja tal como sale impresa (PDF → PNG)
  const hoja = await browser.newPage();
  await hoja.setContent(html ?? '', { waitUntil: 'load' });
  await hoja.emulateMedia({ media: 'print' });
  const pdf = path.join(out, 'informe_ejemplo.pdf');
  await hoja.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  await hoja.close();
  execFileSync('pdftoppm', ['-r', '110', '-f', '1', '-l', '1', '-png', '-singlefile', pdf, path.join(out, 'img', 'informe_hoja')]);
  const paginas = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())?.[1] ?? 0);

  // El simulador abierto desde el QR (la misma dirección, servida en local)
  const qr = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  qr.setDefaultTimeout(180000);
  vigilar(qr, '(qr)');
  await qr.goto(ejemplo.url.replace(SITIO, base), { waitUntil: 'load' });
  await qr.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 90000 });
  await qr.evaluate(() => document.getElementById('ayuda')?.classList.add('oculta'));
  await qr.waitForTimeout(1500);
  await qr.screenshot({ path: path.join(out, 'img', 'informe_qr.png') });
  const abierto = await qr.evaluate(() => ({ reloj: document.getElementById('reloj').textContent, aviso: document.getElementById('avisoCompartido')?.textContent ?? '' }));
  await qr.close();

  fs.writeFileSync(path.join(out, 'informe.json'), JSON.stringify({ ...ejemplo, longitud: ejemplo.url.length, paginas, abierto }, null, 1));
  fs.writeFileSync(path.join(out, 'errores.txt'), errores.join('\n'));
  await browser.close();
  console.log(`informe de ${paginas} páginas · enlace de ${ejemplo.url.length} caracteres · ${errores.length} errores`);
})();
