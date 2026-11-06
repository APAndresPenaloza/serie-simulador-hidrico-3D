/**
 * graficas.js — Gráficas 2D con Chart.js (cargado como script global), igual que en el
 * simulador de ríos: cada gráfica es un diagrama de dispersión con líneas, de modo que el
 * eje x es numérico y las rectas, parábolas y exponenciales se dibujan con exactitud.
 */

function css(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

export function paleta() {
  return {
    agua: css('--agua'),
    agua2: css('--agua-2'),
    ocre: css('--ocre'),
    alerta: css('--alerta'),
    piezo: css('--piezo'),
    tinta: css('--tinta'),
    tinta2: css('--tinta-2'),
    linea: css('--linea'),
    ok: css('--ok'),
    aviso: css('--aviso'),
    violeta: css('--violeta') || '#7A5BA6',
  };
}

export function crearGrafica(canvas, { xTitulo, yTitulo, formatoX, formatoY, marcasX = null, marcasY = null, logY = false }) {
  const Chart = window.Chart;
  if (!Chart) return null;
  const c = paleta();
  Chart.defaults.font.family = '"Archivo", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  const eje = (titulo, formato, marcas) => ({
    type: 'linear',
    title: { display: true, text: titulo, color: c.tinta2 },
    ticks: { color: c.tinta2, callback: formato, maxTicksLimit: marcas ? 13 : 7 },
    grid: { color: c.linea },
    border: { color: c.linea },
    ...(marcas ? { afterBuildTicks: (e) => { e.ticks = marcas.filter((v) => v >= e.min - 1e-9 && v <= e.max + 1e-9).map((value) => ({ value })); } } : {}),
  });
  const ejeY = eje(yTitulo, formatoY, marcasY);
  if (logY) ejeY.type = 'logarithmic';
  return new Chart(canvas, {
    type: 'scatter',
    data: { datasets: [] },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: c.tinta2, boxWidth: 14, boxHeight: 2, padding: 10, filter: (item, datos) => !datos.datasets[item.datasetIndex]?.sinLeyenda },
        },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: (${formatoX(ctx.parsed.x)}, ${formatoY(ctx.parsed.y)})` } },
      },
      scales: { x: eje(xTitulo, formatoX, marcasX), y: ejeY },
    },
  });
}

/** Serie dibujada como línea continua. */
export function serieLinea(etiqueta, datos, color, { punteada = false, ancho = 2, relleno = false, colorRelleno = null, escalon = false, sinLeyenda = false } = {}) {
  return {
    sinLeyenda,
    fill: relleno,
    stepped: escalon ? 'before' : false,
    label: etiqueta,
    data: datos,
    showLine: true,
    borderColor: color,
    backgroundColor: colorRelleno || color,
    borderWidth: ancho,
    borderDash: punteada ? [6, 4] : [],
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0,
  };
}

/** Serie de puntos destacados (valor actual, vértice, etc.). */
export function seriePuntos(etiqueta, datos, color, radio = 5, { sinLeyenda = false, estilo = 'circle' } = {}) {
  return {
    sinLeyenda,
    label: etiqueta,
    data: datos,
    showLine: false,
    borderColor: color,
    backgroundColor: color,
    pointStyle: estilo,
    pointRadius: radio,
    pointHoverRadius: radio + 1,
  };
}

/** Línea vertical u horizontal de referencia (umbral, límite). */
export function serieGuia(etiqueta, desde, hasta, color, opciones = {}) {
  return serieLinea(etiqueta, [desde, hasta], color, { punteada: true, ancho: 1.5, ...opciones });
}

/** Reemplaza las series y vuelve a aplicar los colores del tema actual. */
export function actualizarGrafica(grafica, series, limites = {}) {
  if (!grafica) return;
  const c = paleta();
  grafica.data.datasets = series;
  for (const ejeId of ['x', 'y']) {
    const eje = grafica.options.scales[ejeId];
    eje.ticks.color = c.tinta2;
    eje.title.color = c.tinta2;
    eje.grid.color = c.linea;
    eje.border.color = c.linea;
    eje.min = limites[ejeId]?.min;
    eje.max = limites[ejeId]?.max;
    eje.ticks.stepSize = limites[ejeId]?.paso;
    eje.reverse = Boolean(limites[ejeId]?.invertido);
  }
  grafica.options.plugins.legend.labels.color = c.tinta2;
  grafica.update('none');
}
