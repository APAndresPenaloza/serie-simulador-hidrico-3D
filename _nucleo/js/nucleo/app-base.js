/**
 * app-base.js — Controlador común de los simuladores de la serie.
 * -----------------------------------------------------------------------
 * Arma el panel (pestañas, controles, resultados, revisión del diseño, tablas, modelo
 * matemático y gráficas), la barra superior (indicadores y reloj simulado), la pestaña
 * Datos (registro y libro de Excel) y la pestaña Conexión (frontera con los demás
 * proyectos), y mueve el reloj. Cada proyecto entrega una definición:
 *
 *   iniciarSimulador({
 *     proyecto, titulo, subtitulo, pie, ayuda, leyenda,
 *     tabs: [{ id, nombre, intro, graficas: 0|1|2, figura: bool, tablas: bool }],
 *     controles: [{ tab, grupo } | { tab, id, clave, etiqueta, unidad, min, max, paso, dec,
 *                  tipo: 'rango'|'opciones'|'casilla'|'accion', opciones, extra, visible,
 *                  leer, escribir, aUI, deUI, alCambiar, doc }],
 *     PARAMETROS, estadoInicial(p), avanzar(p, sim, dt), calcular(p, sim) → r (con r.revision),
 *     reloj: { tipo: 'horas'|'dias'|'anos', inicio, velocidades: [{ valor, nombre }], defecto },
 *     estados(p, r, sim) → [{ id, nombre, nivel, texto }],
 *     pintores: { tab: (ctx) → { metricas, tablas, figura, figuraPie, ecuacion, graficas } },
 *     escenarios: { id: { nombre, cambios } }, serie: { columnas, tomar, intervalos },
 *     hojasExcel(p, r, sim), nodo: { salida(p, r, sim), entradas: [...] },
 *     Escena, vistas: [{ id, nombre, titulo }],
 *   })
 */
import { fmt, redondear, limitar, escaparHTML, textoPlano, horaTexto, fechaDeDia, NOMBRES_MES } from './formato.js';
import { crearGrafica, actualizarGrafica, paleta } from './graficas.js';
import { Registro, crearLibro, nombreArchivo, descargarArchivo } from './datos.js';
import { crearFrontera, textoFrontera, nombreFrontera, leerArchivo, EnlaceVivo, PROYECTOS, RED, MAGNITUDES, MAGNITUDES_MAR, nombreProyecto, recibeDe } from './conexion.js';

// ── Ayudas para los pintores (las mismas del simulador de ríos) ──────────────
export const ecu = {
  tipo: (t) => `<p class="tipo">${t}</p>`,
  formula: (t) => `<p class="formula">${t}</p>`,
  sust: (t) => `<p class="sustitucion">${t}</p>`,
  nota: (t, alerta = false) => `<p class="nota${alerta ? ' alerta' : ''}">${t}</p>`,
};
export const i = (v) => `<i>${v}</i>`;
export const sub = (v, s) => `<i>${v}</i><sub>${s}</sub>`;

/** Valor numérico con sus decimales (o un texto ya formateado). */
function textoValor(valor, unidad, dec = 2) {
  if (typeof valor !== 'number') return valor;
  const txt = fmt(valor, dec);
  return unidad === 'COP' && Number.isFinite(valor) ? `$ ${txt}` : txt;
}

/**
 * Filas de resultados: [etiqueta, valor, unidad, nivel, decimales, doc]. Una fila con la
 * etiqueta entre <b>…</b> y sin valor es un subtítulo de grupo.
 */
export function metricasHTML(filas) {
  return filas.map(([dt, valor, unidad = '', nivel = '', dec = 2, doc = '']) =>
    `<dt${doc ? ` title="${escaparHTML(textoPlano(doc))}"` : ''}>${dt}</dt><dd${nivel ? ` data-nivel="${nivel}"` : ''}>${textoValor(valor, unidad, dec)}${unidad ? `<small>${unidad}</small>` : ''}</dd>`).join('');
}

export function revisionHTML(lista) {
  return lista.map((c) => `<li data-nivel="${c.nivel}"><span class="marca-rev">${c.nivel === 'ok' ? '✓' : (c.nivel === 'aviso' ? '!' : '✗')}</span><span>${c.texto}<small>${c.detalle}</small></span></li>`).join('');
}

/** Tabla de comparación (cabecera, filas de celdas o { celdas, clase }; celda texto o { v, clase, nota }). */
export function tablaHTML(titulo, cabecera, filas, { nota = '', numericas = [], marcar = -1 } = {}) {
  const celda = (c, k, etiqueta = 'td') => {
    const o = c !== null && typeof c === 'object' ? c : { v: c };
    const clases = [o.clase, numericas.includes(k) ? 'num' : '', k === marcar ? 'marcada' : ''].filter(Boolean).join(' ');
    return `<${etiqueta}${clases ? ` class="${clases}"` : ''}>${o.v ?? ''}${o.nota ? `<small>${o.nota}</small>` : ''}</${etiqueta}>`;
  };
  const cuerpo = filas.map((f) => {
    const celdas = Array.isArray(f) ? f : f.celdas;
    return `<tr${f.clase ? ` class="${f.clase}"` : ''}>${celdas.map((c, k) => celda(c, k)).join('')}</tr>`;
  }).join('');
  return `<h3>${titulo}</h3><div class="tabla-desliza"><table class="cantidades comparar"><thead><tr>${cabecera.map((c, k) => celda(c, k, 'th')).join('')}</tr></thead><tbody>${cuerpo}</tbody></table></div>${nota ? `<p class="nota-tabla">${nota}</p>` : ''}`;
}

/** Texto del reloj según el tipo de simulador. */
export function textoReloj(t, tipo = 'horas', inicioAno = 0) {
  if (tipo === 'anos') {
    const anos = t / (365 * 86400);
    return `Año ${fmt(Math.floor(anos + 1e-9), 0)}${anos % 1 > 0.004 ? ` · ${fmt((anos % 1) * 12, 1)} meses` : ''}`;
  }
  const total = Math.floor(t / 60 + 1e-6);
  const dia = Math.floor(total / 1440) + 1;
  const hora = `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  if (tipo === 'dias') {
    const f = fechaDeDia(dia + inicioAno);
    return `${f.dia} de ${NOMBRES_MES[f.mes]}, ${hora}`;
  }
  return `Día ${dia}, ${hora}`;
}

export function iniciarSimulador(def) {
  const base = structuredClone(def.PARAMETROS);
  const p = structuredClone(base);
  const relojDef = { tipo: 'horas', inicio: 6 * 3600, velocidades: [{ valor: 600, nombre: '10 min por segundo' }], defecto: 600, inicioAno: 0, ...def.reloj };
  let sim = def.estadoInicial(p);
  sim.t = relojDef.inicio;
  sim.corriendo = true;
  sim.factor = relojDef.defecto;
  let r = def.calcular(p, sim);
  let tabActiva = def.tabInicial ?? def.tabs[0].id;
  const fichas = {};
  const graficas = {};
  const registro = new Registro(def.proyecto, def.serie?.columnas ?? [], def.serie?.intervaloDefecto ?? 3600);
  registro.reiniciar(sim.t);
  let entradaAplicada = null;     // frontera recibida (archivo o en vivo)
  let escena = null;
  let enlace = null;
  const relojTexto = (t) => textoReloj(t, relojDef.tipo, relojDef.inicioAno);

  const ctx = {
    get p() { return p; }, get r() { return r; }, get sim() { return sim; }, base,
    fmt, c: null, aplicarEscenario, reiniciarEstado, recalcular: () => cambio(),
  };

  // ── Barra superior ──────────────────────────────────────────────────────
  const elEstados = document.getElementById('estados');
  const btnPlay = document.getElementById('btnPlay');
  const selVel = document.getElementById('selVelocidad');
  const elReloj = document.getElementById('reloj');
  const btnReiniciar = document.getElementById('btnReiniciar');
  selVel.innerHTML = relojDef.velocidades.map((v) => `<option value="${v.valor}"${v.valor === relojDef.defecto ? ' selected' : ''}>${v.nombre}</option>`).join('');

  function pintarEstados() {
    const lista = def.estados(p, r, sim);
    if (elEstados.childElementCount !== lista.length) {
      elEstados.innerHTML = lista.map((e) => `<p class="estado" id="estado-${e.id}" data-nivel="ok"><span class="punto"></span><span class="texto"></span></p>`).join('');
    }
    lista.forEach((e, k) => {
      const el = elEstados.children[k];
      if (el.dataset.nivel !== e.nivel) el.dataset.nivel = e.nivel;
      const t = el.querySelector('.texto');
      if (t.__html !== e.texto) { t.innerHTML = e.texto; t.__html = e.texto; }
    });
  }

  // ── Panel ───────────────────────────────────────────────────────────────
  const elPestanas = document.getElementById('pestanas');
  const elFichas = document.getElementById('fichas');
  const todas = [...def.tabs, { id: 'datos', nombre: 'Datos', especial: 'datos' }, { id: 'conexion', nombre: 'Conexión', especial: 'conexion' }];
  elPestanas.style.setProperty('--columnas', Math.ceil(todas.length / 2));

  /**
   * Las pestañas van en dos filas; si sus nombres no caben en el ancho del panel se agrega
   * una fila más, hasta que quepan todas (ninguna queda escondida, ni la de Conexión). El
   * punto de alerta no ocupa ancho (va sobre el nombre), así que no cambia la medida.
   */
  function ajustarPestanas() {
    const ancho = elPestanas.clientWidth;
    if (!ancho) return;
    const n = todas.length;
    for (let filas = 2; filas <= n; filas++) {
      elPestanas.style.setProperty('--columnas', Math.ceil(n / filas));
      if (elPestanas.scrollWidth <= ancho + 1) break;
    }
  }

  const valorMax = (c) => (typeof c.max === 'function' ? c.max(p, r) : c.max);
  const valorMin = (c) => (typeof c.min === 'function' ? c.min(p, r) : c.min);
  function leerControl(c) {
    if (c.leer) return c.leer(p, sim, r);
    const v = p[c.clave];
    return c.aUI ? c.aUI(v) : v;
  }
  function escribirControl(c, valorUI) {
    const v = c.tipo === 'opciones' || c.tipo === 'casilla' ? valorUI : limitar(valorUI, valorMin(c), valorMax(c));
    if (c.escribir) c.escribir(v, p, sim);
    else p[c.clave] = c.deUI ? c.deUI(v) : v;
    c.alCambiar?.(v, p, sim, ctx);
  }
  const opcionesDe = (c) => (typeof c.opciones === 'function' ? c.opciones(p, r) : c.opciones);

  function crearControl(c, cont) {
    if (c.grupo) {
      const h = document.createElement('h3');
      h.textContent = c.grupo;
      h.className = 'grupo-controles';
      cont.appendChild(h);
      c.el = h;
      return;
    }
    const d = document.createElement('div');
    d.className = `control${c.tipo === 'casilla' ? ' casilla' : ''}`;
    d.dataset.id = c.id;
    if (c.tipo === 'opciones') {
      d.innerHTML = `<label for="c-${c.id}">${c.etiqueta}</label><select id="c-${c.id}"></select><p class="extra"></p>`;
      const sel = d.querySelector('select');
      sel.addEventListener('change', () => {
        escribirControl(c, c.numero ? Number(sel.value) : sel.value);
        cambio(c.id);
      });
    } else if (c.tipo === 'casilla') {
      d.innerHTML = `<label><input type="checkbox" id="c-${c.id}"><span>${c.etiqueta}</span></label><p class="extra"></p>`;
      const ch = d.querySelector('input');
      ch.addEventListener('change', () => { escribirControl(c, ch.checked); cambio(c.id); });
    } else if (c.tipo === 'accion') {
      d.innerHTML = `<div class="acciones"><button type="button" class="boton">${c.etiqueta}</button></div><p class="extra"></p>`;
      d.querySelector('button').addEventListener('click', () => { c.accion(p, sim, ctx); cambio(c.id); });
    } else {
      d.innerHTML = `<div class="fila"><label for="c-${c.id}">${c.etiqueta}</label><span class="valor"><input type="text" inputmode="decimal" aria-label="${escaparHTML(textoPlano(c.etiqueta))}"><span class="unidad">${c.unidad ?? ''}</span></span></div>
        <input type="range" id="c-${c.id}"><p class="extra"></p>`;
      const rango = d.querySelector('input[type="range"]');
      const caja = d.querySelector('.valor input');
      rango.addEventListener('input', () => { escribirControl(c, Number(rango.value)); cambio(c.id); });
      caja.addEventListener('change', () => {
        const v = Number(String(caja.value).replace(',', '.').replace(/\s/g, ''));
        if (Number.isFinite(v)) escribirControl(c, v);
        cambio();
      });
    }
    cont.appendChild(d);
    c.el = d;
  }

  function sincronizarControles(origen) {
    for (const c of def.controles) {
      if (!c.el || c.tab !== tabActiva) continue;
      const ver = c.visible ? c.visible(p, r, sim) : true;
      c.el.hidden = !ver;
      if (c.grupo || !ver) continue;
      const extra = c.el.querySelector('.extra');
      if (c.tipo === 'opciones') {
        const sel = c.el.querySelector('select');
        const ops = opcionesDe(c);
        const firma = ops.map((o) => `${o.valor}:${o.nombre}`).join('|');
        if (sel.__firma !== firma) {
          sel.innerHTML = ops.map((o) => `<option value="${escaparHTML(o.valor)}">${o.nombre}</option>`).join('');
          sel.__firma = firma;
        }
        sel.value = String(leerControl(c));
      } else if (c.tipo === 'casilla') {
        c.el.querySelector('input').checked = Boolean(leerControl(c));
      } else if (c.tipo !== 'accion') {
        const v = leerControl(c);
        const rango = c.el.querySelector('input[type="range"]');
        const caja = c.el.querySelector('.valor input');
        const mn = valorMin(c), mx = valorMax(c);
        rango.min = mn; rango.max = mx; rango.step = c.paso ?? 'any';
        if (origen !== c.id) rango.value = v;
        rango.style.setProperty('--pct', `${(100 * (limitar(v, mn, mx) - mn)) / (mx - mn || 1)}%`);
        if (document.activeElement !== caja) caja.value = fmt(v, c.dec ?? 2).replace(/ /g, ' ');
      }
      if (extra) {
        const t = c.extra ? c.extra(leerControl(c), p, r, sim) : '';
        if (extra.__html !== t) { extra.innerHTML = t; extra.__html = t; }
        extra.hidden = !t;
      }
    }
  }

  function crearPanel() {
    for (const t of todas) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pestana';
      b.id = `pestana-${t.id}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', `ficha-${t.id}`);
      b.dataset.tab = t.id;
      b.innerHTML = `<span class="nombre">${t.nombre}<span class="alerta-mini" hidden></span></span>`;
      b.addEventListener('click', () => mostrarTab(t.id));
      elPestanas.appendChild(b);

      const f = document.createElement('section');
      f.className = 'ficha';
      f.id = `ficha-${t.id}`;
      f.setAttribute('role', 'tabpanel');
      f.setAttribute('aria-labelledby', b.id);
      f.hidden = true;
      elFichas.appendChild(f);
      if (t.especial === 'datos') { crearFichaDatos(f); continue; }
      if (t.especial === 'conexion') { crearFichaConexion(f); continue; }
      const nGraf = t.graficas ?? 1;
      f.innerHTML = `
        <p class="intro">${t.intro}</p>
        ${t.figura ? '<figure class="plano figura-tab"><div class="svg-plano" role="img" aria-label="Esquema de la pestaña"></div><figcaption></figcaption></figure>' : ''}
        <div class="controles"></div>
        <h3>Resultados</h3>
        <dl class="metricas"></dl>
        <div class="bloque-revision"><h3>Revisión del diseño</h3><ul class="revision"></ul></div>
        ${t.tablas ? '<div class="tablas"></div>' : ''}
        <h3>Modelo matemático</h3>
        <div class="ecuacion"></div>
        ${Array.from({ length: nGraf }, (_, k) => `<figure class="grafica${k ? ' grafica-extra' : ''}${t.alta ? ' alta' : ''}" data-k="${k}"><div class="lienzo"><canvas aria-label="Gráfica ${k + 1} de ${t.nombre}"></canvas></div><figcaption></figcaption></figure>`).join('')}`;
      const cont = f.querySelector('.controles');
      for (const c of def.controles.filter((x) => x.tab === t.id)) crearControl(c, cont);
      fichas[t.id] = {
        raiz: f,
        figura: f.querySelector('.svg-plano'),
        figuraPie: f.querySelector('.figura-tab figcaption'),
        metricas: f.querySelector('.metricas'),
        revision: f.querySelector('.revision'),
        bloqueRevision: f.querySelector('.bloque-revision'),
        tablas: f.querySelector('.tablas'),
        ecuacion: f.querySelector('.ecuacion'),
        graficas: [...f.querySelectorAll('.grafica')],
      };
    }
  }

  function setHTML(el, html) {
    if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; }
  }

  /** Corre el pintor de una pestaña (sin dibujar). */
  function datosPintor(id) {
    ctx.c = paleta();
    const pintor = def.pintores[id];
    return pintor ? pintor(ctx) : {};
  }

  function pintarTab(id, conGraficas = true) {
    const f = fichas[id];
    if (!f) return;
    const d = datosPintor(id);
    setHTML(f.metricas, metricasHTML(d.metricas ?? []));
    const rev = r.revision?.[id] ?? [];
    f.bloqueRevision.hidden = rev.length === 0;
    setHTML(f.revision, revisionHTML(rev));
    if (f.tablas) setHTML(f.tablas, d.tablas ?? '');
    if (f.figura) { setHTML(f.figura, d.figura ?? ''); setHTML(f.figuraPie, d.figuraPie ?? ''); }
    setHTML(f.ecuacion, d.ecuacion ?? '');
    if (conGraficas) {
      (d.graficas ?? []).forEach((g, k) => {
        const fig = f.graficas[k];
        if (!fig) return;
        const clave = `${id}:${k}`;
        if (!graficas[clave] || graficas[clave].__firma !== `${g.xTitulo}|${g.yTitulo}|${Boolean(g.logY)}`) {
          graficas[clave]?.destroy();
          graficas[clave] = crearGrafica(fig.querySelector('canvas'), g);
          if (graficas[clave]) graficas[clave].__firma = `${g.xTitulo}|${g.yTitulo}|${Boolean(g.logY)}`;
        }
        actualizarGrafica(graficas[clave], g.series, g.limites ?? {});
        setHTML(fig.querySelector('figcaption'), g.pie ?? '');
      });
    }
  }

  function pintarAlertas() {
    for (const t of def.tabs) {
      const b = document.getElementById(`pestana-${t.id}`);
      const hay = (r.revision?.[t.id] ?? []).some((c) => c.nivel === 'alerta');
      b.querySelector('.alerta-mini').hidden = !hay;
    }
  }

  function mostrarTab(id) {
    tabActiva = id;
    for (const t of todas) {
      const b = document.getElementById(`pestana-${t.id}`);
      b.setAttribute('aria-selected', String(t.id === id));
      document.getElementById(`ficha-${t.id}`).hidden = t.id !== id;
    }
    sincronizarControles();
    if (id === 'datos') pintarDatos();
    else if (id === 'conexion') pintarConexion();
    else pintarTab(id);
    escena?.seleccionar(id);
  }

  // ── Recalcular ──────────────────────────────────────────────────────────
  function recalcular() {
    r = def.calcular(p, sim);
  }

  function cambio(origen) {
    recalcular();
    sincronizarControles(origen);
    pintarPanel(true);
    pintarEstados();
    pintarReloj(); // un escenario puede mover el reloj aunque la simulación esté en pausa
    escena?.actualizar(p, r, sim);
    publicarEnVivo();
  }

  function pintarPanel(conGraficas) {
    if (tabActiva === 'datos') pintarDatos();
    else if (tabActiva === 'conexion') pintarConexion();
    else pintarTab(tabActiva, conGraficas);
    pintarAlertas();
  }

  function reiniciarEstado(conservarReloj = true) {
    const t = sim.t, corr = sim.corriendo, fac = sim.factor;
    sim = def.estadoInicial(p);
    sim.t = conservarReloj ? t : relojDef.inicio;
    sim.corriendo = corr;
    sim.factor = fac;
  }

  function aplicarEscenario(id) {
    const e = def.escenarios?.[id];
    if (!e) return;
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, structuredClone(base), structuredClone(e.cambios ?? {}));
    p.escenario = id;
    if (entradaAplicada) aplicarFrontera(entradaAplicada, false);
    reiniciarEstado(true);
    if (e.sim) Object.assign(sim, e.sim(p, sim));
  }

  function reiniciarTodo() {
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, structuredClone(base));
    entradaAplicada = null;
    sim = def.estadoInicial(p);
    sim.t = relojDef.inicio;
    sim.corriendo = true;
    sim.factor = Number(selVel.value);
    registro.reiniciar(sim.t);
    cambio();
    pintarReloj();
  }

  // ── Reloj ───────────────────────────────────────────────────────────────
  function pintarReloj() {
    elReloj.textContent = relojTexto(sim.t);
    btnPlay.textContent = sim.corriendo ? 'Pausar' : 'Reanudar';
    btnPlay.setAttribute('aria-pressed', String(sim.corriendo));
  }

  function avanzarTiempo(segundos) {
    const antes = sim.t;
    const paso = def.pasoMaximo ?? 600;
    let resta = segundos;
    while (resta > 1e-9) {
      const dt = Math.min(paso, resta);
      def.avanzar(p, sim, dt);
      sim.t += dt;
      resta -= dt;
    }
    if (def.serie) registro.avanzar(antes, sim.t, (t) => def.serie.tomar(p, def.calcular(p, { ...sim, t }), { ...sim, t }));
  }

  btnPlay.addEventListener('click', () => { sim.corriendo = !sim.corriendo; pintarReloj(); });
  selVel.addEventListener('change', () => { sim.factor = Number(selVel.value); });
  btnReiniciar.addEventListener('click', reiniciarTodo);

  let ultimo = performance.now();
  let ultimoPanel = 0;
  let ultimaGrafica = 0;
  let ultimaEscena = 0;
  function bucle(ahora) {
    const dtReal = Math.min((ahora - ultimo) / 1000, 0.25);
    ultimo = ahora;
    if (sim.corriendo) {
      avanzarTiempo(dtReal * sim.factor);
      recalcular();
      if (ahora - ultimaEscena > 90) { escena?.actualizar(p, r, sim); ultimaEscena = ahora; }
      if (ahora - ultimoPanel > 250) {
        const conGraf = ahora - ultimaGrafica > 1000;
        if (conGraf) ultimaGrafica = ahora;
        pintarPanel(conGraf);
        pintarEstados();
        pintarReloj();
        ultimoPanel = ahora;
      }
    }
    requestAnimationFrame(bucle);
  }

  // ── Pestaña Datos ──────────────────────────────────────────────────────
  let elDatos = null;
  function crearFichaDatos(f) {
    const intervalos = def.serie?.intervalos ?? [{ valor: 3600, nombre: '1 h' }];
    f.innerHTML = `
      <p class="intro">Guarda la información de la simulación en un libro de Excel: los parámetros y resultados de todas las pestañas, la serie de tiempo que se registra mientras corre el reloj, la revisión del diseño, las tablas del simulador, la frontera de conexión y los escenarios que guardes para compararlos.</p>
      <h3>Libro de Excel</h3>
      <div class="acciones exportar"><button type="button" class="boton primario" id="btnExcel">Descargar Excel (.xlsx)</button></div>
      <p class="nota-datos" id="notaExcel"></p>
      <h3>Registro de la serie de tiempo</h3>
      <div class="control"><label for="selIntervalo">Guardar una fila cada</label><select id="selIntervalo">${intervalos.map((v) => `<option value="${v.valor}">${v.nombre}</option>`).join('')}</select></div>
      <p class="nota-datos" id="notaRegistro"></p>
      <div class="tabla-registro" id="tablaRegistro"></div>
      <div class="acciones"><button type="button" class="boton" id="btnBorrarRegistro">Empezar un registro nuevo</button></div>
      <h3>Escenarios guardados</h3>
      <p class="nota-datos">«Guardar escenario» copia todos los parámetros y resultados del momento; en el Excel cada escenario es una columna de la hoja «Parámetros y resultados».</p>
      <div class="guardar-escenario"><input type="text" id="nombreEscenario" maxlength="60" placeholder="Nombre del escenario" aria-label="Nombre del escenario"><button type="button" class="boton" id="btnGuardarEscenario">Guardar escenario</button></div>
      <ul class="escenarios" id="listaEscenarios"></ul>`;
    elDatos = {
      nota: f.querySelector('#notaExcel'), notaReg: f.querySelector('#notaRegistro'), tabla: f.querySelector('#tablaRegistro'),
      lista: f.querySelector('#listaEscenarios'), nombre: f.querySelector('#nombreEscenario'), intervalo: f.querySelector('#selIntervalo'),
    };
    elDatos.intervalo.value = String(registro.intervalo);
    elDatos.intervalo.addEventListener('change', () => { registro.cambiarIntervalo(Number(elDatos.intervalo.value), sim.t); pintarDatos(); });
    f.querySelector('#btnBorrarRegistro').addEventListener('click', () => { registro.reiniciar(sim.t); pintarDatos(); });
    f.querySelector('#btnGuardarEscenario').addEventListener('click', () => {
      registro.guardarEscenario(elDatos.nombre.value || `Escenario ${registro.escenarios.length + 1}`, filasActuales(), relojTexto(sim.t));
      elDatos.nombre.value = '';
      pintarDatos();
    });
    elDatos.lista.addEventListener('click', (e) => {
      const b = e.target.closest('.quitar');
      if (b) { registro.quitarEscenario(Number(b.dataset.i)); pintarDatos(); }
    });
    f.querySelector('#btnExcel').addEventListener('click', (e) => exportarExcel(e.currentTarget));
  }

  function pintarDatos() {
    if (!elDatos) return;
    const cols = registro.columnas;
    const ultimas = registro.filas.slice(-6).reverse();
    setHTML(elDatos.notaReg, `${registro.filas.length} filas registradas desde ${relojTexto(registro.inicio)}. Las últimas, de la más reciente a la más antigua:`);
    setHTML(elDatos.tabla, `<table><thead><tr><th>Tiempo</th>${cols.slice(0, 4).map((c) => `<th>${c.nombre}${c.unidad ? ` (${c.unidad})` : ''}</th>`).join('')}</tr></thead><tbody>${ultimas.map((f) => `<tr><td>${relojTexto(f.t)}</td>${cols.slice(0, 4).map((c) => `<td>${typeof f[c.clave] === 'number' ? fmt(f[c.clave], c.dec ?? 2) : (f[c.clave] ?? '')}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5">Deja correr el reloj para registrar.</td></tr>'}</tbody></table>`);
    setHTML(elDatos.lista, registro.escenarios.map((e, k) => `<li><span class="nombre">${escaparHTML(e.nombre)}</span><span class="detalle">${escaparHTML(e.reloj)} · ${e.filas.length} valores</span><button type="button" class="quitar" data-i="${k}" aria-label="Quitar ${escaparHTML(e.nombre)}">×</button></li>`).join('') || '<li class="vacia">Todavía no hay escenarios guardados.</li>');
    const rev = Object.values(r.revision ?? {}).flat();
    setHTML(elDatos.nota, `El libro trae ${4 + (def.hojasExcel ? def.hojasExcel(p, r, sim).length : 0) + 1} hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño (${rev.length} criterios), las tablas del simulador y la frontera de conexión.`);
  }

  /** Todos los parámetros y resultados de todas las pestañas, como filas para el Excel. */
  function filasActuales() {
    const filas = [];
    for (const t of def.tabs) {
      for (const c of def.controles.filter((x) => x.tab === t.id && !x.grupo && x.tipo !== 'accion')) {
        if (c.visible && !c.visible(p, r, sim)) continue;
        let valor = leerControl(c);
        if (c.tipo === 'opciones') valor = opcionesDe(c).find((o) => String(o.valor) === String(valor))?.nombre ?? String(valor);
        if (c.tipo === 'casilla') valor = valor ? 'sí' : 'no';
        filas.push({ clave: `${t.id}:c:${c.id}`, bloque: t.nombre, grupo: 'Parámetros', etiqueta: textoPlano(c.etiqueta), unidad: c.unidad ?? '', valor: typeof valor === 'string' ? textoPlano(valor) : valor, dec: c.dec ?? 2 });
      }
      let grupo = 'Resultados';
      for (const [dt, valor, unidad = '', , dec = 2] of datosPintor(t.id).metricas ?? []) {
        if (/^<b>/.test(dt) && (valor === '' || valor === undefined)) { grupo = textoPlano(dt); continue; }
        filas.push({ clave: `${t.id}:m:${textoPlano(dt)}`, bloque: t.nombre, grupo, etiqueta: textoPlano(dt), unidad: textoPlano(unidad), valor: typeof valor === 'number' ? valor : textoPlano(String(valor)), dec });
      }
    }
    return filas;
  }

  async function exportarExcel(boton) {
    boton.disabled = true;
    try {
      const fecha = new Date();
      const revision = def.tabs.flatMap((t) => (r.revision?.[t.id] ?? []).map((c) => ({ ...c, pestana: t.nombre })));
      const bytes = crearLibro({
        meta: { titulo: `${def.titulo} · ${def.subtitulo}`, subtitulo: 'Libro generado por el simulador (serie de simuladores hídricos 3D).', fecha: fecha.toLocaleString('es-CO'), reloj: relojTexto(sim.t), fechaObjeto: fecha },
        estados: def.estados(p, r, sim),
        actual: { nombre: `Al exportar (${relojTexto(sim.t)})`, filas: filasActuales() },
        registro, revision, relojTexto,
        tablas: def.hojasExcel ? def.hojasExcel(p, r, sim) : [],
        frontera: def.nodo ? fronteraActual() : null,
      });
      descargarArchivo(bytes, nombreArchivo(def.proyecto, fecha));
    } finally {
      boton.disabled = false;
    }
  }

  // ── Pestaña Conexión ───────────────────────────────────────────────────
  let elCon = null;
  const red = RED[def.proyecto] ?? { recibe: [], entrega: [] };
  const fronteraActual = () => {
    const s = def.nodo.salida(p, r, sim);
    return crearFrontera(def.proyecto, { nodo: s.nodo ?? def.subtitulo, salida: s.salida, mar: s.mar ?? null, clima: s.clima ?? null, tiempo: { reloj: relojTexto(sim.t), segundos: sim.t } });
  };

  function redSVG() {
    const ids = PROYECTOS.filter((x) => x.id !== 'sistema');
    const w = 380, paso = w / ids.length;
    const pos = Object.fromEntries(ids.map((x, k) => [x.id, paso * (k + 0.5)]));
    const flecha = (a, b, cls) => {
      const y = 40, x1 = pos[a], x2 = pos[b];
      const curva = Math.abs(x2 - x1) > paso * 1.2 ? -22 * Math.sign(x2 - x1 || 1) : 0;
      return `<path class="${cls}" d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + curva - (curva ? 14 : 0)} ${x2} ${y}" marker-end="url(#punta)"/>`;
    };
    const lazos = [];
    for (const [a, v] of Object.entries(RED)) {
      if (a === 'sistema') continue;
      for (const b of v.entrega) {
        const cls = a === def.proyecto || b === def.proyecto ? 'enlace activo' : 'enlace';
        lazos.push(flecha(a, b, cls));
      }
    }
    const nodos = ids.map((x) => `<g class="nodo${x.id === def.proyecto ? ' propio' : ''}${red.recibe.includes(x.id) ? ' recibe' : ''}${red.entrega.includes(x.id) ? ' entrega' : ''}" transform="translate(${pos[x.id]} 40)"><circle r="11"/><text y="28">${x.nombre.replace(' exorreicos', '')}</text></g>`).join('');
    return `<svg viewBox="0 0 ${w} 86" class="red-serie" role="img" aria-label="Red de la serie de simuladores"><defs><marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>${lazos.join('')}${nodos}</svg>`;
  }

  function crearFichaConexion(f) {
    f.innerHTML = `
      <p class="intro">Este simulador es parte de una serie que sigue el agua del páramo al océano. Aquí se ve lo que entrega a sus vecinos (su <b>frontera de salida</b>) y se aplica lo que le llega de aguas arriba o del mar. Se conecta de tres formas: con un archivo de frontera (.json), en vivo con otro simulador abierto en el mismo navegador, o con el proyecto <b>Sistema conectado</b>, que une todos los modelos.</p>
      <figure class="plano"><div class="svg-plano">${redSVG()}</div><figcaption>Red de la serie. En azul, este proyecto; las flechas resaltadas son sus conexiones: recibe de ${red.recibe.length ? red.recibe.map(nombreProyecto).join(', ') : 'ningún proyecto (es la cabecera)'} y entrega a ${red.entrega.length ? red.entrega.map(nombreProyecto).join(', ') : 'ningún proyecto (es el final de la cadena)'}.</figcaption></figure>
      <h3>Lo que entrega (frontera de salida)</h3>
      <dl class="metricas" id="conSalida"></dl>
      <div class="acciones"><button type="button" class="boton primario" id="btnExportarFrontera">Exportar frontera (.json)</button></div>
      <h3>Lo que recibe (frontera de entrada)</h3>
      <p class="nota-datos" id="conEntradaTexto"></p>
      <dl class="metricas" id="conEntrada"></dl>
      <div class="acciones">
        <label class="boton" for="archivoFrontera">Importar frontera…</label><input type="file" id="archivoFrontera" accept=".json,application/json" hidden>
        <button type="button" class="boton" id="btnQuitarFrontera">Quitar la frontera recibida</button>
      </div>
      <p class="nota-datos" id="conMensaje" role="status"></p>
      <h3>Enlace en vivo</h3>
      <div class="control casilla"><label><input type="checkbox" id="chkPublicar" checked><span>Publicar la frontera de salida a los simuladores abiertos en este navegador</span></label></div>
      <div class="control casilla"><label><input type="checkbox" id="chkRecibir"><span>Aplicar en vivo lo que publiquen los proyectos de los que recibe</span></label></div>
      <p class="nota-datos" id="conVecinos"></p>
      <h3>Cómo se usa</h3>
      <ol class="pasos-conexion">
        <li>Sirve la carpeta que contiene todos los proyectos de la serie (<code>python -m http.server 8000</code>) y abre cada simulador desde <code>http://localhost:8000</code>.</li>
        <li>En el simulador de aguas arriba deja marcada «Publicar la frontera de salida».</li>
        <li>En este simulador marca «Aplicar en vivo»: cada cambio de aguas arriba llega al instante.</li>
        <li>Sin servidor común, usa «Exportar frontera» en uno e «Importar frontera» en el otro.</li>
      </ol>`;
    elCon = {
      salida: f.querySelector('#conSalida'), entrada: f.querySelector('#conEntrada'), entradaTexto: f.querySelector('#conEntradaTexto'),
      mensaje: f.querySelector('#conMensaje'), vecinos: f.querySelector('#conVecinos'),
      publicar: f.querySelector('#chkPublicar'), recibir: f.querySelector('#chkRecibir'),
    };
    f.querySelector('#btnExportarFrontera').addEventListener('click', () => {
      if (!def.nodo) return;
      descargarArchivo(textoFrontera(fronteraActual()), nombreFrontera(def.proyecto), 'application/json');
    });
    f.querySelector('#archivoFrontera').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const fr = await leerArchivo(archivo);
        recibirFrontera(fr, 'archivo');
      } catch (err) {
        elCon.mensaje.textContent = `No se pudo importar: ${err.message}`;
      }
    });
    f.querySelector('#btnQuitarFrontera').addEventListener('click', () => {
      quitarFrontera();
      elCon.mensaje.textContent = 'Se quitó la frontera recibida: los parámetros volvieron a los del escenario.';
    });
    elCon.publicar.addEventListener('change', publicarEnVivo);
  }

  function filasMagnitudes(obj, tabla) {
    return Object.entries(obj ?? {}).map(([k, v]) => [tabla[k]?.nombre ?? k, v, tabla[k]?.unidad ?? '', '', Math.abs(v) >= 100 ? 1 : (Math.abs(v) >= 1 ? 2 : 3)]);
  }

  function pintarConexion() {
    if (!elCon || !def.nodo) return;
    const fr = fronteraActual();
    setHTML(elCon.salida, metricasHTML([...filasMagnitudes(fr.salida, MAGNITUDES), ...(fr.mar ? [['<b>Condiciones del mar</b>', '', ''], ...filasMagnitudes(fr.mar, MAGNITUDES_MAR)] : [])]));
    if (entradaAplicada) {
      setHTML(elCon.entradaTexto, `Aplicada la frontera de <b>${nombreProyecto(entradaAplicada.origen)}</b> (${escaparHTML(entradaAplicada.nodo)}), ${escaparHTML(entradaAplicada.tiempo?.reloj ?? '')}. ${escaparHTML(entradaAplicada.__texto ?? '')}`);
      setHTML(elCon.entrada, metricasHTML([...filasMagnitudes(entradaAplicada.salida, MAGNITUDES), ...(entradaAplicada.mar ? [['<b>Condiciones del mar</b>', '', ''], ...filasMagnitudes(entradaAplicada.mar, MAGNITUDES_MAR)] : [])]));
    } else {
      setHTML(elCon.entradaTexto, red.recibe.length ? `Recibe de ${red.recibe.map(nombreProyecto).join(', ')}. ${def.nodo.textoEntrada ?? ''} ${def.nodo.textoSinEntrada ?? 'Ahora usa sus propios valores de referencia (no hay frontera aplicada).'}` : 'Es la cabecera de la serie: no recibe de ningún proyecto.');
      setHTML(elCon.entrada, '');
    }
  }

  function aplicarFrontera(fr, avisar = true) {
    const entrada = (def.nodo.entradas ?? []).find((e) => e.origen === fr.origen);
    if (!entrada) {
      if (avisar && elCon) elCon.mensaje.textContent = `Este simulador no recibe datos de ${nombreProyecto(fr.origen)}.`;
      return false;
    }
    const res = entrada.aplicar(p, fr);
    if (!res) return false;
    Object.assign(p, res.cambios);
    fr.__texto = res.texto ?? '';
    return true;
  }

  function recibirFrontera(fr, como) {
    if (!recibeDe(def.proyecto, fr.origen)) {
      if (elCon) elCon.mensaje.textContent = `La frontera viene de ${nombreProyecto(fr.origen)}, que no entrega a este proyecto en la red de la serie.`;
      return;
    }
    if (aplicarFrontera(fr)) {
      entradaAplicada = fr;
      if (elCon) elCon.mensaje.textContent = `Frontera de ${nombreProyecto(fr.origen)} aplicada (${como}).`;
      cambio();
    }
  }

  function quitarFrontera() {
    if (!entradaAplicada) return;
    const entrada = (def.nodo.entradas ?? []).find((e) => e.origen === entradaAplicada.origen);
    for (const k of entrada?.claves ?? []) p[k] = base[k];
    entradaAplicada = null;
    cambio();
  }

  let ultimaPublicacion = 0;
  function publicarEnVivo() {
    if (!enlace || !def.nodo || (elCon && !elCon.publicar.checked)) return;
    const ahora = performance.now();
    if (ahora - ultimaPublicacion < 300) return;
    ultimaPublicacion = ahora;
    enlace.publicar(fronteraActual());
  }

  function iniciarEnlace() {
    if (!def.nodo) return;
    enlace = new EnlaceVivo(def.proyecto, {
      alRecibir: (fr) => { if (elCon?.recibir.checked && recibeDe(def.proyecto, fr.origen)) recibirFrontera(fr, 'en vivo'); },
      alCambiarVecinos: (v) => {
        if (!elCon) return;
        const lista = [...v.keys()].map(nombreProyecto);
        elCon.vecinos.textContent = lista.length ? `Abiertos en este navegador: ${lista.join(', ')}.` : 'No hay otros simuladores de la serie abiertos en este navegador.';
      },
    });
    if (elCon) elCon.vecinos.textContent = enlace.disponible ? 'Buscando otros simuladores de la serie abiertos en este navegador…' : 'Este navegador no permite el enlace en vivo; usa los archivos de frontera.';
    setInterval(publicarEnVivo, 2000);
    window.addEventListener('pagehide', () => enlace.cerrar());
  }

  // ── Vistas de la escena ────────────────────────────────────────────────
  function crearVistas() {
    const cont = document.getElementById('vistas');
    if (!cont || !def.vistas) return;
    cont.innerHTML = def.vistas.map((v, k) => `<button type="button" data-vista="${v.id}" aria-pressed="${k === 0}" title="${escaparHTML(v.titulo ?? v.nombre)}">${v.nombre}</button>`).join('');
    cont.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-vista]');
      if (b && escena) escena.irAVista(b.dataset.vista);
    });
  }
  function marcarVista(nombre) {
    for (const b of document.querySelectorAll('#vistas button')) b.setAttribute('aria-pressed', String(b.dataset.vista === nombre));
  }

  // ── API para documentar y probar (manual e informe) ─────────────────────
  window.__sim = {
    def, base,
    get p() { return p; }, get r() { return r; }, get sim() { return sim; }, get escena() { return escena; },
    relojTexto,
    setParam(clave, valor) { p[clave] = valor; cambio(); },
    aplicar(cambios = {}) { Object.assign(p, cambios); cambio(); },
    control(id, valor) {
      const c = def.controles.find((x) => x.id === id);
      if (!c) throw new Error(`control ${id}`);
      escribirControl(c, valor);
      cambio(id);
    },
    accion(id) { const c = def.controles.find((x) => x.id === id); c.accion(p, sim, ctx); cambio(id); },
    escenario(id) { aplicarEscenario(id); cambio(); },
    reiniciar: reiniciarTodo,
    pausar() { sim.corriendo = false; pintarReloj(); },
    reanudar() { sim.corriendo = true; pintarReloj(); },
    avanzar(segundos) { avanzarTiempo(segundos); cambio(); pintarReloj(); },
    mostrarTab,
    vista(id) { escena?.irAVista(id, true); },
    estados: () => def.estados(p, r, sim),
    frontera: () => (def.nodo ? fronteraActual() : null),
    recibir: (fr) => recibirFrontera(fr, 'prueba'),
    datosTab(id) {
      const d = datosPintor(id);
      const tab = def.tabs.find((t) => t.id === id);
      let grupo = '';
      const controles = [];
      for (const c of def.controles.filter((x) => x.tab === id)) {
        if (c.grupo) { grupo = c.grupo; continue; }
        const vis = c.visible ? c.visible(p, r, sim) : true;
        const v = c.tipo === 'accion' ? null : leerControl(c);
        controles.push({
          id: c.id, grupo, etiqueta: textoPlano(c.etiqueta), unidad: c.unidad ?? (c.tipo === 'opciones' ? 'lista' : (c.tipo === 'casilla' ? 'casilla' : '')),
          tipo: c.tipo ?? 'rango', min: c.tipo ? null : valorMin(c), max: c.tipo ? null : valorMax(c), dec: c.dec ?? 2, valor: v,
          texto: c.tipo === 'opciones' ? textoPlano(opcionesDe(c).find((o) => String(o.valor) === String(v))?.nombre ?? '') : (c.tipo === 'casilla' ? (v ? 'sí' : 'no') : (c.tipo === 'accion' ? '' : fmt(v, c.dec ?? 2))),
          nOpciones: c.tipo === 'opciones' ? opcionesDe(c).length : null, opciones: c.tipo === 'opciones' ? opcionesDe(c).map((o) => textoPlano(o.nombre)) : null,
          visible: vis, doc: c.doc ?? '',
        });
      }
      const metricas = [];
      let g = '';
      for (const [dt, valor, unidad = '', nivel = '', dec = 2, doc = ''] of d.metricas ?? []) {
        if (/^<b>/.test(dt) && (valor === '' || valor === undefined)) { g = textoPlano(dt); metricas.push({ grupo: g, titulo: true }); continue; }
        metricas.push({ grupo: g, etiqueta: textoPlano(dt), valor: typeof valor === 'number' ? valor : null, texto: textoPlano(textoValor(valor, unidad, dec)), unidad: textoPlano(unidad), nivel, doc: textoPlano(doc) });
      }
      return {
        id, nombre: tab?.nombre, intro: textoPlano(tab?.intro ?? ''), controles, metricas,
        revision: (r.revision?.[id] ?? []).map((c) => ({ texto: textoPlano(c.texto), detalle: textoPlano(c.detalle), nivel: c.nivel, corregir: textoPlano(c.corregir ?? '') })),
        ecuacion: textoPlano(d.ecuacion ?? ''), ecuacionHTML: d.ecuacion ?? '', tablas: textoPlano(d.tablas ?? ''),
        graficas: (d.graficas ?? []).map((x) => ({ pie: textoPlano(x.pie ?? ''), xTitulo: x.xTitulo, yTitulo: x.yTitulo })), figuraPie: textoPlano(d.figuraPie ?? ''),
      };
    },
  };

  // ── Arranque ───────────────────────────────────────────────────────────
  crearPanel();
  ajustarPestanas();
  window.addEventListener('resize', ajustarPestanas);
  document.fonts?.ready?.then(ajustarPestanas);
  crearVistas();
  if (def.Escena) {
    const cont = document.getElementById('escena');
    escena = new def.Escena(cont, { onSeleccion: (tab) => { mostrarTab(tab); if (window.matchMedia('(max-width: 900px)').matches) document.getElementById(`ficha-${tab}`)?.scrollIntoView({ behavior: 'smooth' }); } });
    escena.alCambiarVista = marcarVista;
    escena.actualizar(p, r, sim);
    if (!escena.iniciar()) {
      document.getElementById('sinWebgl').hidden = false;
      escena = null;
    }
  }
  if (def.escenarioInicial) aplicarEscenario(def.escenarioInicial);
  recalcular();
  mostrarTab(tabActiva);
  pintarEstados();
  pintarReloj();
  pintarAlertas();
  iniciarEnlace();
  escena?.actualizar(p, r, sim);
  requestAnimationFrame((t) => { ultimo = t; requestAnimationFrame(bucle); });
  document.documentElement.dataset.listo = '1';
  return window.__sim;
}

export { fmt, redondear, limitar, horaTexto };
