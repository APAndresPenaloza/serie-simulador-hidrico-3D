// Extrae de un simulador de la serie todo lo que necesitan su informe y su manual: datos de
// cada pestaña (controles, resultados, revisión, ecuaciones), series de las gráficas, estados,
// escenarios, vistas, hojas del Excel y frontera; y las capturas de pantalla.
// Uso: node extraer.cjs URL carpetaSalida
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [,, url, out] = process.argv;
  fs.mkdirSync(path.join(out, 'img'), { recursive: true });
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({ args });
  const errores = [];
  const abrir = async (w, h, dsf = 1.5) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errores.push('console ' + m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__sim && document.documentElement.dataset.listo === '1', null, { timeout: 30000 });
    // Reiniciar y pausar en la misma tarea: el reloj queda exactamente al inicio del escenario base
    await page.evaluate(() => { window.__sim.reiniciar(); window.__sim.pausar(); document.getElementById('ayuda')?.classList.add('oculta'); });
    // La escena 3D se dibuja a pedido y no en un ciclo continuo: en máquinas sin GPU (SwiftShader)
    // el ciclo deja sin tiempo a la captura de pantalla. __dibujar(n) termina el vuelo de la cámara
    // y dibuja n cuadros.
    await page.evaluate(() => {
      const e = window.__sim.escena;
      if (!e?.renderer) { window.__dibujar = () => {}; return; }
      e.renderer.setAnimationLoop(null);
      window.__dibujar = (n = 3) => { for (let i = 0; i < n; i++) { if (e.vuelo) e.vuelo.t = 1; e.animar(); } };
      window.__dibujar(3);
    });
    await page.waitForTimeout(600);
    return page;
  };

  // ── 1. Datos ─────────────────────────────────────────────────────────────
  let page = await abrir(1600, 1000);
  const datos = await page.evaluate(() => {
    const s = window.__sim;
    const def = s.def;
    const graficasDe = (tab) => {
      s.mostrarTab(tab);
      return [...document.querySelectorAll(`#ficha-${tab} .grafica canvas`)].map((cv) => {
        const g = window.Chart?.getChart(cv);
        if (!g) return null;
        const sc = g.options.scales;
        return {
          xTitulo: sc.x.title.text, yTitulo: sc.y.title.text, logY: sc.y.type === 'logarithmic',
          xMin: sc.x.min ?? null, xMax: sc.x.max ?? null, yMin: sc.y.min ?? null, yMax: sc.y.max ?? null,
          marcasX: g.scales.x.ticks.map((t) => ({ v: t.value, l: String(t.label) })),
          series: g.data.datasets.map((d) => ({ etiqueta: d.label, datos: d.data.map((p) => [p.x, p.y]), color: d.borderColor, punteada: (d.borderDash ?? []).length > 0, linea: d.showLine !== false, radio: d.pointRadius ?? 0, ancho: d.borderWidth ?? 2, escalon: Boolean(d.stepped), sinLeyenda: Boolean(d.sinLeyenda) })),
          pie: cv.closest('figure').querySelector('figcaption')?.textContent ?? '',
        };
      }).filter(Boolean);
    };
    const tabs = def.tabs.map((t) => ({ id: t.id, nombre: t.nombre, intro: t.intro, datos: s.datosTab(t.id), graficas: graficasDe(t.id) }));
    const escena = s.escena;
    const r = s.r, p = s.p;
    const revision = def.tabs.flatMap((t) => (r.revision?.[t.id] ?? []).map((c) => ({ pestana: t.nombre, tab: t.id, texto: c.texto, detalle: c.detalle, nivel: c.nivel, corregir: c.corregir ?? '' })));
    const limpiar = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
    return {
      proyecto: def.proyecto, titulo: def.titulo, subtitulo: def.subtitulo,
      tabs, revision,
      estados: s.estados().map((e) => ({ nombre: e.nombre, nivel: e.nivel, texto: limpiar(e.texto) })),
      escenarios: Object.entries(def.escenarios ?? {}).map(([id, e]) => ({ id, nombre: e.nombre, cambios: e.cambios })),
      vistas: def.vistas ?? [], pestanaVista: escena?.pestanaVista ?? {},
      etiquetas: escena ? escena.etiquetasDefs().map(([id, tab, titulo, clase]) => ({ id, tab, titulo, clase: clase ?? '' })) : [],
      reloj: { tipo: def.reloj?.tipo, velocidades: def.reloj?.velocidades ?? [], defecto: def.reloj?.defecto },
      serie: (def.serie?.columnas ?? []).map((c) => ({ nombre: c.nombre, unidad: c.unidad })),
      intervalos: (def.serie?.intervalos ?? []).map((x) => x.nombre),
      hojas: def.hojasExcel ? def.hojasExcel(p, r, s.sim).map((h) => ({ nombre: h.nombre, descripcion: h.descripcion ?? h.nota ?? h.titulo ?? '' })) : [],
      frontera: s.frontera(),
      entradas: (def.nodo?.entradas ?? []).map((e) => ({ origen: e.origen, claves: e.claves })),
      textoEntrada: def.nodo?.textoEntrada ?? '',
      parametros: JSON.parse(JSON.stringify(def.PARAMETROS)),
      reloj0: s.relojTexto(s.sim.t),
    };
  });
  // Escenarios: estados y criterios que no se cumplen
  for (const e of datos.escenarios) {
    const res = await page.evaluate((id) => {
      const s = window.__sim;
      s.escenario(id);
      const r = s.r;
      const lista = Object.values(r.revision ?? {}).flat();
      const limpiar = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
      return { estados: s.estados().map((x) => ({ nombre: x.nombre, nivel: x.nivel, texto: limpiar(x.texto) })), total: lista.length, fallas: lista.filter((c) => c.nivel !== 'ok').map((c) => limpiar(c.texto)) };
    }, e.id);
    Object.assign(e, res);
  }
  await page.evaluate(() => window.__sim.escenario('base'));
  fs.writeFileSync(path.join(out, 'datos.json'), JSON.stringify(datos, null, 1));
  await page.close();

  // ── 2. Capturas de la pantalla y de las vistas ─────────────────────────────
  page = await abrir(1600, 1000);
  await page.evaluate(() => window.__dibujar(3));
  await page.screenshot({ path: path.join(out, 'img', 'pantalla.png') });
  await page.locator('header.barra').screenshot({ path: path.join(out, 'img', 'barra.png') });
  for (const v of datos.vistas) {
    await page.evaluate((id) => { window.__sim.vista(id); window.__dibujar(3); }, v.id);
    await page.waitForTimeout(400);
    await page.locator('#escena').screenshot({ path: path.join(out, 'img', `vista_${v.id}.png`) });
  }
  await page.close();
  page = await abrir(390, 844, 2);
  await page.evaluate(() => window.__dibujar(3));
  await page.screenshot({ path: path.join(out, 'img', 'movil.png') });
  await page.close();

  // ── 3. Capturas del panel de cada pestaña ──────────────────────────────────
  page = await abrir(1500, 6000, 1.5);
  // Sin la escena 3D (no se ve en estas capturas y con esta altura sería muy lenta)
  await page.evaluate(() => { window.__sim.escena?.renderer?.setAnimationLoop(null); const e = document.getElementById('escena'); if (e) e.style.visibility = 'hidden'; });
  const piezas = { controles: '.controles', metricas: '.metricas', revision: '.bloque-revision', tablas: '.tablas', ecuacion: '.ecuacion', figura: '.figura-tab' };
  for (const t of datos.tabs) {
    await page.evaluate((id) => window.__sim.mostrarTab(id), t.id);
    await page.waitForTimeout(900);
    for (const [nombre, sel] of Object.entries(piezas)) {
      const loc = page.locator(`#ficha-${t.id} ${sel}`);
      if (await loc.count() === 0) continue;
      const vacio = await loc.first().evaluate((el) => el.hidden || !el.textContent.trim() && !el.querySelector('svg'));
      if (vacio) continue;
      // Las tablas anchas se deslizan de lado en el panel: para la captura se ensancha el panel
      // lo necesario para que se vean completas.
      const extra = nombre !== 'tablas' ? 0 : await loc.first().evaluate((el) =>
        Math.max(0, ...[...el.querySelectorAll('.tabla-desliza, .tabla-registro')].map((d) => d.scrollWidth - d.clientWidth)));
      if (extra > 0) {
        await page.evaluate((x) => {
          const w = document.querySelector('.panel').getBoundingClientRect().width + x + 12;
          const s = document.createElement('style'); s.id = 'ancho-tablas';
          s.textContent = `.layout{grid-template-columns:minmax(0,1fr) ${Math.min(1100, Math.ceil(w))}px !important}`;
          document.head.appendChild(s);
        }, extra);
        await page.waitForTimeout(400);
      }
      await loc.first().screenshot({ path: path.join(out, 'img', `${t.id}_${nombre}.png`) });
      if (extra > 0) {
        await page.evaluate(() => document.getElementById('ancho-tablas')?.remove());
        await page.waitForTimeout(400);
      }
    }
    const graf = page.locator(`#ficha-${t.id} .grafica`);
    for (let k = 0; k < await graf.count(); k++) await graf.nth(k).screenshot({ path: path.join(out, 'img', `${t.id}_g${k}.png`) });
  }
  for (const id of ['datos', 'conexion']) {
    await page.evaluate((x) => window.__sim.mostrarTab(x), id);
    await page.waitForTimeout(700);
    await page.locator(`#ficha-${id}`).screenshot({ path: path.join(out, 'img', `${id}.png`) });
  }
  await page.close();

  // ── 4. Escenarios en la escena (pantalla completa) ─────────────────────────
  page = await abrir(1600, 1000);
  for (const e of datos.escenarios.filter((x) => x.id !== 'base')) {
    await page.evaluate((id) => { window.__sim.escenario(id); }, e.id);
    const vista = datos.vistas[0]?.id;
    if (vista) await page.evaluate((v) => window.__sim.vista(v), vista);
    await page.evaluate(() => window.__dibujar(3));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, 'img', `esc_${e.id}.png`) });
  }
  await page.close();

  // ── 5. Pestaña Informe: la pestaña, la vista previa, la primera hoja y el QR ──
  // Un caso de ejemplo: se cambia un control de la segunda pestaña y corre el reloj tres días.
  const preparar = async (pg) => pg.evaluate(() => {
    const s = window.__sim;
    const val = (f) => (typeof f === 'function' ? f(s.p, s.r) : f);
    const apto = (x) => !x.tipo && !x.grupo && x.clave && !x.leer && Number.isFinite(val(x.min)) && Number.isFinite(val(x.max)) && (!x.visible || x.visible(s.p, s.r, s.sim));
    const tabs = s.def.tabs.map((t) => t.id);
    let c = s.def.controles.find((x) => apto(x) && x.tab === tabs[1]) ?? s.def.controles.find(apto);
    if (c) s.control(c.id, Number((val(c.min) + 0.37 * (val(c.max) - val(c.min))).toFixed(c.dec ?? 2)));
    else {
      c = s.def.controles.find((x) => x.tipo === 'opciones' && x.clave && x.clave !== 'escenario');
      const ops = typeof c.opciones === 'function' ? c.opciones(s.p, s.r) : c.opciones;
      s.control(c.id, ops.find((o) => String(o.valor) !== String(s.p[c.clave])).valor);
    }
    s.avanzar(3 * 86400);
    s.mostrarTab(c.tab);
    return c.id;
  });
  const llenar = async (pg) => {
    await pg.click('#pestana-informe');
    await pg.fill('#infTitulo', 'Informe de la simulación');
    await pg.fill('#infAutores', 'Andrés Mauricio Peñaloza Fernández y Eliana Carolina María Wong Lubo');
    await pg.fill('#infNotas', 'Caso de ejemplo del manual: se cambió un control y se dejó correr el reloj tres días.');
  };
  page = await abrir(1500, 2000);
  await preparar(page);
  await llenar(page);
  await page.waitForTimeout(500);
  await page.locator('#ficha-informe').screenshot({ path: path.join(out, 'img', 'informe.png') });
  await page.close();

  page = await abrir(1600, 1000);
  await preparar(page);
  await page.evaluate(() => window.__dibujar(3));
  await llenar(page);
  const ejemplo = await page.evaluate(() => ({ url: window.__sim.url(), parametros: window.__sim.parametrosCambiados(), reloj: window.__sim.relojTexto(window.__sim.sim.t) }));
  const html = await page.evaluate(() => window.__sim.informe());
  await page.waitForSelector('#vistaInforme iframe');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'img', 'informe_vista.png') });
  await page.close();
  fs.writeFileSync(path.join(out, 'informe_ejemplo.html'), html ?? '');
  // Primera hoja del informe tal como sale impresa (PDF → PNG)
  page = await browser.newPage();
  await page.setContent(html ?? '', { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(out, 'informe_ejemplo.pdf');
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  await page.close();
  const { execFileSync } = require('child_process');
  execFileSync('pdftoppm', ['-r', '110', '-f', '1', '-l', '1', '-png', '-singlefile', pdf, path.join(out, 'img', 'informe_hoja')]);
  const paginas = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())?.[1] ?? 0);
  // El simulador abierto desde el QR (en local: la misma dirección, con el servidor de la prueba)
  const SITIO = 'https://apandrespenaloza.github.io/serie-simulador-hidrico-3D/';
  const local = ejemplo.url.replace(SITIO, new URL('..', url).href);
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => errores.push('PAGEERROR(qr) ' + e.message));
  await page.goto(local, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sim && document.documentElement.dataset.listo === '1', null, { timeout: 30000 });
  await page.evaluate(() => {
    document.getElementById('ayuda')?.classList.add('oculta');
    const e = window.__sim.escena;
    if (e?.renderer) { e.renderer.setAnimationLoop(null); for (let i = 0; i < 3; i++) { if (e.vuelo) e.vuelo.t = 1; e.animar(); } }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'img', 'informe_qr.png') });
  const abierto = await page.evaluate(() => ({ reloj: window.__sim.relojTexto(window.__sim.sim.t), aviso: document.getElementById('avisoCompartido')?.textContent ?? '' }));
  await page.close();
  fs.writeFileSync(path.join(out, 'informe.json'), JSON.stringify({ ...ejemplo, longitud: ejemplo.url.length, paginas, abierto }, null, 1));

  await browser.close();
  fs.writeFileSync(path.join(out, 'errores.txt'), errores.join('\n'));
  console.log(`${datos.tabs.length} pestañas, ${datos.escenarios.length} escenarios, ${errores.length} errores`);
})();
