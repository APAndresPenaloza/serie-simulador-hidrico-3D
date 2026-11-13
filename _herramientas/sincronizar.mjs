// Copia el núcleo común (_nucleo) a cada proyecto de la serie y arma su index.html y su
// package.json a partir de proyecto.json. Uso: node _herramientas/sincronizar.mjs [carpeta…]
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const nucleo = join(raiz, '_nucleo');
const pedidas = process.argv.slice(2);
const proyectos = readdirSync(raiz).filter((d) => d.startsWith('simulador-hidrico-3D - ') && !d.includes('Rios exorreicos') && (!pedidas.length || pedidas.some((x) => d.includes(x))));

// Enlaces bajo el subtítulo: la página de la serie y los documentos y recorridos de este simulador
const enlaces = (d) => !d ? '' : `
        <nav class="enlaces" aria-label="Documentos de este simulador">
          <a href="../">Serie</a>
          <a href="${d.informe}" target="_blank" rel="noopener">Informe</a>
          <a href="${d.manual}" target="_blank" rel="noopener">Manual</a>
          <a href="${d.video}" target="_blank" rel="noopener">Video</a>
          <a href="${d.gif}" target="_blank" rel="noopener">GIF</a>
        </nav>`;

const plantilla = (m) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${m.titulo} · ${m.subtitulo}</title>
  <meta name="description" content="${m.descripcion}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 3C16 3 6 14.5 6 20.5a10 10 0 0 0 20 0C26 14.5 16 3 16 3z' fill='%231C86B8'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400;1,8..60,600&display=swap">
  <link rel="stylesheet" href="css/styles.css">
  <script type="importmap">
    {
      "imports": {
        "three": "./lib/three.module.min.js",
        "three/addons/": "./lib/addons/"
      }
    }
  </script>
  <script src="lib/chart.umd.js" defer></script>
  <script type="module" src="js/app.js"></script>
</head>
<body>
  <header class="barra">
    <div class="marca">
      <svg class="gota" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C16 3 6 14.5 6 20.5a10 10 0 0 0 20 0C26 14.5 16 3 16 3z"/></svg>
      <div>
        <h1>${m.titulo}</h1>
        <p>${m.subtitulo}</p>${enlaces(m.documentos)}
      </div>
    </div>

    <div class="estados" id="estados" aria-live="polite">
      <p class="estado" data-nivel="ok"><span class="punto"></span><span class="texto">Calculando…</span></p>
    </div>

    <div class="reloj" role="group" aria-label="Tiempo simulado">
      <button type="button" id="btnPlay" class="boton" aria-pressed="true">Pausar</button>
      <label class="sr" for="selVelocidad">Velocidad de la simulación</label>
      <select id="selVelocidad" class="boton"></select>
      <output id="reloj" class="hora">…</output>
      <button type="button" id="btnReiniciar" class="boton">Reiniciar</button>
    </div>
  </header>

  <main class="layout">
    <section class="escena" id="escena" aria-label="${m.etiquetaEscena}">
      <p class="ayuda" id="ayuda">${m.ayuda}</p>
      <div class="vistas" id="vistas" role="group" aria-label="Vista de la escena"></div>
      <p class="leyenda">${m.leyenda}</p>
      <p class="sin-webgl" id="sinWebgl" hidden>Tu navegador no pudo iniciar la vista 3D (WebGL). Los cálculos y las gráficas siguen funcionando en el panel.</p>
    </section>

    <aside class="panel" aria-label="Controles y resultados">
      <nav class="pestanas" role="tablist" id="pestanas"></nav>
      <div id="fichas"></div>
      <p class="pie">${m.pie}</p>
    </aside>
  </main>
</body>
</html>
`;

for (const p of proyectos) {
  const dir = join(raiz, p);
  cpSync(join(nucleo, 'lib'), join(dir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'css'), { recursive: true });
  cpSync(join(nucleo, 'css', 'styles.css'), join(dir, 'css', 'styles.css'));
  mkdirSync(join(dir, 'js', 'nucleo'), { recursive: true });
  cpSync(join(nucleo, 'js', 'excel.js'), join(dir, 'js', 'excel.js'));
  cpSync(join(nucleo, 'js', 'nucleo'), join(dir, 'js', 'nucleo'), { recursive: true });
  mkdirSync(join(dir, 'tests'), { recursive: true });
  cpSync(join(nucleo, 'tests', 'datos.test.js'), join(dir, 'tests', 'datos.test.js'));
  const meta = join(dir, 'proyecto.json');
  if (existsSync(meta)) {
    const m = JSON.parse(readFileSync(meta, 'utf8'));
    writeFileSync(join(dir, 'index.html'), plantilla(m));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: m.paquete, private: true, type: 'module', scripts: { test: 'node --test tests/*.test.js' } }, null, 2) + '\n');
  }
  console.log('sincronizado:', p);
}
