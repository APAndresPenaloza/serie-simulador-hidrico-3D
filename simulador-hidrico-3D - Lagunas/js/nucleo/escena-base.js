/**
 * escena-base.js — Base de las escenas 3D de la serie (Three.js), con el mismo estilo del
 * simulador de ríos: terreno de polígonos planos con colores por vértice, agua con textura
 * animada, etiquetas HTML que abren la pestaña de cada componente, vistas con vuelo de la
 * cámara y selección con el ratón o el dedo.
 *
 * Cada proyecto extiende EscenaBase y define:
 *   construir()             arma el paisaje y los componentes
 *   etiquetasDefs()         [[id, pestaña, título], ...]
 *   vistasDefs()            { vista: { pos: [x, y, z], mira: [x, y, z], etiquetas: [...] } }
 *   pestanaVista            { pestaña: vista }
 *   aplicar(p, r, sim)      actualiza la escena con los resultados del modelo
 *   paso(dt, t)             animación de cada cuadro
 * La escena solo dibuja: todos los números vienen de sistema.js.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';

export { THREE };

export const suave = (t) => t * t * (3 - 2 * t);
export const mezclar = (a, b, t) => a + (b - a) * t;

/** Ruido determinista (para que la escena salga igual en cada carga). */
export function ruido2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
export function ruidoSuave(x, z, escala = 1) {
  const xi = Math.floor(x / escala), zi = Math.floor(z / escala);
  const fx = suave(x / escala - xi), fz = suave(z / escala - zi);
  const a = ruido2(xi, zi), b = ruido2(xi + 1, zi), c = ruido2(xi, zi + 1), d = ruido2(xi + 1, zi + 1);
  return mezclar(mezclar(a, b, fx), mezclar(c, d, fx), fz);
}

let semilla = 12345;
export function azar() {
  semilla = (semilla * 16807) % 2147483647;
  return (semilla - 1) / 2147483646;
}
export const reiniciarAzar = (s = 12345) => { semilla = s; };

/** Textura de ondas para el agua (lienzo 2D repetible). */
export function texturaAgua(fondo = '#e8eef0', trazo = 'rgba(255,255,255,0.55)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = fondo;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = trazo;
  g.lineWidth = 2;
  reiniciarAzar(777);
  for (let i = 0; i < 70; i++) {
    const x = azar() * 256, y = azar() * 256, l = 10 + azar() * 26;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y - 3, x + l, y);
    g.stroke();
    // repetir en los bordes para que la textura no tenga costuras
    if (x + l > 256) { g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + l / 2, y - 3, x - 256 + l, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Material del agua: color, transparencia y textura de ondas que se mueve. */
export function materialAgua(color = 0x2f8fbf, { opacidad = 0.86, repetir = 8, textura = null } = {}) {
  const map = textura ?? texturaAgua();
  map.repeat.set(repetir, repetir);
  return new THREE.MeshStandardMaterial({
    color, map, transparent: opacidad < 1, opacity: opacidad, roughness: 0.25, metalness: 0.05, depthWrite: opacidad >= 1,
  });
}

export function caja(w, h, d, color, { rugosidad = 0.85, sombra = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rugosidad, flatShading: true }));
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

export function cilindro(rArriba, rAbajo, h, color, { lados = 12, rugosidad = 0.8 } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rArriba, rAbajo, h, lados), new THREE.MeshStandardMaterial({ color, roughness: rugosidad, flatShading: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Tubo a lo largo de una curva de puntos [x, y, z]. */
export function tubo(puntos, radio, color, { segmentos = 64, lados = 8 } = {}) {
  const curva = new THREE.CatmullRomCurve3(puntos.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curva, segmentos, radio, lados, false), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.castShadow = true;
  return m;
}

/** Árbol de copa redonda o cónica (polígonos planos). */
export function arbol({ alto = 3, copa = 1.4, color = 0x3f7d3a, tronco = 0x6b4a2b, conico = false } = {}) {
  const g = new THREE.Group();
  const t = cilindro(0.12 * copa, 0.18 * copa, alto * 0.45, tronco, { lados: 6 });
  t.position.y = alto * 0.225;
  g.add(t);
  const geo = conico ? new THREE.ConeGeometry(copa, alto * 0.75, 7) : new THREE.IcosahedronGeometry(copa, 0);
  const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
  c.position.y = alto * (conico ? 0.7 : 0.62);
  c.castShadow = true;
  g.add(c);
  return g;
}

/** Palmera de cocotero. */
export function palmera(alto = 4, color = 0x4f8a3a) {
  const g = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, alto, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a45, flatShading: true }));
  tronco.position.y = alto / 2;
  tronco.rotation.z = 0.12;
  tronco.castShadow = true;
  g.add(tronco);
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide });
  for (let k = 0; k < 7; k++) {
    const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 3), mat);
    hoja.position.set(0.25, alto, 0);
    hoja.rotation.set(0, (k / 7) * Math.PI * 2, 1.9);
    hoja.translateY(0.9);
    g.add(hoja);
  }
  return g;
}

/** Casa sencilla de techo a dos aguas. */
export function casa({ ancho = 2.2, fondo = 2.6, alto = 1.6, pared = 0xe9e1d0, techo = 0xb5533a } = {}) {
  const g = new THREE.Group();
  const p = caja(ancho, alto, fondo, pared);
  p.position.y = alto / 2;
  g.add(p);
  const forma = new THREE.Shape();
  forma.moveTo(-ancho / 2 - 0.15, 0);
  forma.lineTo(0, alto * 0.55);
  forma.lineTo(ancho / 2 + 0.15, 0);
  forma.closePath();
  const tg = new THREE.ExtrudeGeometry(forma, { depth: fondo + 0.3, bevelEnabled: false });
  tg.translate(0, alto, -(fondo + 0.3) / 2);
  const t = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: techo, flatShading: true }));
  t.castShadow = true;
  g.add(t);
  return g;
}

/** Bote o canoa. */
export function bote(largo = 3, color = 0x9a5b32) {
  const forma = new THREE.Shape();
  forma.moveTo(-largo / 2, 0.25);
  forma.quadraticCurveTo(-largo / 2 + 0.2, -0.2, 0, -0.25);
  forma.quadraticCurveTo(largo / 2 - 0.2, -0.2, largo / 2, 0.25);
  forma.closePath();
  const g = new THREE.ExtrudeGeometry(forma, { depth: 0.7, bevelEnabled: false });
  g.translate(0, 0, -0.35);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true }));
  m.castShadow = true;
  return m;
}

/** Nube de polígonos planos. */
export function nube(escala = 1, color = 0xffffff, opacidad = 0.92) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, transparent: opacidad < 1, opacity: opacidad });
  const partes = [[0, 0, 0, 1.6], [1.5, -0.2, 0.3, 1.2], [-1.4, -0.3, -0.2, 1.1], [0.4, 0.5, -0.6, 1.0], [-0.5, 0.2, 0.8, 0.9]];
  for (const [x, y, z, r] of partes) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * escala, 0), mat);
    m.position.set(x * escala, y * escala, z * escala);
    g.add(m);
  }
  return g;
}

/**
 * Nube de partículas (puntos) con posiciones que se mueven en cada cuadro.
 * mover(i, pos, dt) cambia la posición i (arreglo plano de 3·n valores).
 */
export class Particulas {
  constructor(padre, n, { color = 0xffffff, tamano = 0.25, opacidad = 0.9, transparente = true } = {}) {
    this.n = n;
    this.pos = new Float32Array(3 * n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color, size: tamano, transparent: transparente, opacity: opacidad, depthWrite: false });
    this.obj = new THREE.Points(this.geo, this.mat);
    this.obj.frustumCulled = false;
    padre.add(this.obj);
  }

  set visible(v) { this.obj.visible = v; }
  get visible() { return this.obj.visible; }

  actualizar() {
    this.geo.attributes.position.needsUpdate = true;
  }
}

/** Lluvia: gotas que caen dentro de una caja y vuelven a empezar arriba. */
export class Lluvia extends Particulas {
  constructor(padre, n, { x0, x1, z0, z1, y0 = 0, y1 = 40, color = 0xa9c4d4 } = {}) {
    super(padre, n, { color, tamano: 0.22, opacidad: 0.75 });
    Object.assign(this, { x0, x1, z0, z1, y0, y1 });
    reiniciarAzar(4242);
    for (let i = 0; i < n; i++) {
      this.pos[3 * i] = mezclar(x0, x1, azar());
      this.pos[3 * i + 1] = mezclar(y0, y1, azar());
      this.pos[3 * i + 2] = mezclar(z0, z1, azar());
    }
    this.intensidad = 0;
  }

  paso(dt) {
    if (!this.obj.visible) return;
    const v = 28 * dt;
    for (let i = 0; i < this.n; i++) {
      this.pos[3 * i + 1] -= v;
      if (this.pos[3 * i + 1] < this.y0) this.pos[3 * i + 1] += this.y1 - this.y0;
    }
    this.actualizar();
  }
}

/** Partículas que recorren una curva (agua que fluye por un cauce o un caño). */
export class FlujoCurva extends Particulas {
  constructor(padre, n, puntos, { color = 0xdff3fb, tamano = 0.35, ancho = 1, alto = 0.05 } = {}) {
    super(padre, n, { color, tamano });
    this.curva = new THREE.CatmullRomCurve3(puntos.map((p) => new THREE.Vector3(...p)));
    this.largo = this.curva.getLength();
    this.ancho = ancho;
    this.alto = alto;
    reiniciarAzar(99);
    this.u = Float32Array.from({ length: n }, () => azar());
    this.lado = Float32Array.from({ length: n }, () => azar() - 0.5);
    this.velocidad = 1;
    this.sentido = 1;
    this.tmp = new THREE.Vector3();
    this.tan = new THREE.Vector3();
    this.colocar();
  }

  colocar() {
    for (let i = 0; i < this.n; i++) {
      const u = ((this.u[i] % 1) + 1) % 1;
      this.curva.getPointAt(u, this.tmp);
      this.curva.getTangentAt(u, this.tan);
      // desplazamiento lateral (perpendicular en el plano horizontal)
      const lx = -this.tan.z, lz = this.tan.x;
      const ln = Math.hypot(lx, lz) || 1;
      this.pos[3 * i] = this.tmp.x + (lx / ln) * this.lado[i] * this.ancho;
      this.pos[3 * i + 1] = this.tmp.y + this.alto;
      this.pos[3 * i + 2] = this.tmp.z + (lz / ln) * this.lado[i] * this.ancho;
    }
    this.actualizar();
  }

  paso(dt) {
    if (!this.obj.visible || this.velocidad === 0) return;
    const du = (this.sentido * this.velocidad * dt) / this.largo;
    for (let i = 0; i < this.n; i++) this.u[i] += du;
    this.colocar();
  }
}

/** Etiqueta de texto fija (sin interacción), por ejemplo una cota o un rótulo de corte. */
export function rotulo(texto, clase = 'rotulo3d') {
  const el = document.createElement('div');
  el.className = clase;
  el.textContent = texto;
  return new CSS2DObject(el);
}

export class EscenaBase {
  constructor(contenedor, { onSeleccion } = {}) {
    this.contenedor = contenedor;
    this.onSeleccion = onSeleccion || (() => {});
    this.etiquetas = {};
    this.seleccionables = [];
    this.tabActiva = null;
    this.vista = null;
    this.pestanaVista = {};
    this.listo = false;
    this.cielo = 0xcfe2e8;
    this.niebla = [160, 420];
  }

  // ── Por redefinir en cada proyecto ─────────────────────────────────────
  construir() {}
  etiquetasDefs() { return []; }
  vistasDefs() { return { general: { pos: [60, 50, 80], mira: [0, 0, 0] } }; }
  centrosEtiquetas() { return {}; }
  aplicar() {}
  paso() {}

  iniciar() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      return false;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    this.contenedor.appendChild(r.domElement);

    this.etiquetador = new CSS2DRenderer();
    const el = this.etiquetador.domElement;
    Object.assign(el.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '2' });
    this.contenedor.appendChild(el);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.cielo);
    this.scene.fog = new THREE.Fog(this.cielo, this.niebla[0], this.niebla[1]);

    this.camara = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);
    this.controles = new OrbitControls(this.camara, r.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.maxPolarAngle = 1.45;
    this.controles.minDistance = 6;
    this.controles.maxDistance = 1600;
    this.controles.addEventListener('start', () => {
      this.vuelo = null;
      this.contenedor.querySelector('.ayuda')?.classList.add('oculta');
    });

    this.luces();
    this.VISTAS = this.vistasDefs();
    this.construir();
    this.crearEtiquetas();
    const primera = Object.keys(this.VISTAS)[0];
    this.irAVista(this.vista ?? primera, true);
    new ResizeObserver(() => this.redimensionar()).observe(this.contenedor);
    this.redimensionar();
    this.eventosSeleccion();
    this.reloj = new THREE.Clock();
    this.t = 0;
    this.listo = true;
    if (this.p) this.aplicar(this.p, this.r, this.sim);
    r.setAnimationLoop(() => this.animar());
    return true;
  }

  grupo(tab) {
    const g = new THREE.Group();
    g.userData.tab = tab;
    this.scene.add(g);
    return g;
  }

  luces() {
    this.luzCielo = new THREE.HemisphereLight(0xe4f2f6, 0x8c7b56, 1.35);
    this.scene.add(this.luzCielo);
    const sol = new THREE.DirectionalLight(0xfff3df, 2.4);
    this.luzSol = sol;
    sol.position.set(80, 120, 70);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const s = sol.shadow.camera;
    s.left = -140; s.right = 140; s.top = 120; s.bottom = -120; s.near = 10; s.far = 420;
    sol.shadow.bias = -0.0006;
    sol.shadow.normalBias = 0.04;
    this.scene.add(sol, sol.target);
  }

  /**
   * Terreno de polígonos planos: altura(x, z) da la cota y color(c, x, z, y) el color.
   * Devuelve la malla; recalcular con this.repintarTerreno(malla).
   */
  terreno({ x0, x1, z0, z1, nx = 160, nz = 160, altura, color, sombra = true }) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const malla = new THREE.Mesh(geo, mat);
    malla.receiveShadow = sombra;
    malla.userData.altura = altura;
    malla.userData.color = color;
    this.repintarTerreno(malla);
    return malla;
  }

  repintarTerreno(malla, altura = malla.userData.altura, color = malla.userData.color) {
    const geo = malla.geometry;
    const pos = geo.attributes.position;
    const col = geo.attributes.color.array;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = altura(x, z);
      pos.setY(i, y);
      color(c, x, z, y);
      const k = 0.94 + 0.12 * ruido2(Math.round(x * 3), Math.round(z * 3));
      col[3 * i] = c.r * k; col[3 * i + 1] = c.g * k; col[3 * i + 2] = c.b * k;
    }
    pos.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  // ── Etiquetas ─────────────────────────────────────────────────────────
  crearEtiquetas() {
    const centros = this.centrosEtiquetas();
    for (const [id, tab, titulo, clase = ''] of this.etiquetasDefs()) {
      const el = document.createElement('div');
      el.className = `etiqueta3d ${clase}`.trim() + (tab ? '' : ' fija');
      el.innerHTML = `<b>${titulo}</b><span></span>`;
      if (tab) {
        el.dataset.tab = tab;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.addEventListener('click', () => this.onSeleccion(tab));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onSeleccion(tab); }
        });
      }
      const obj = new CSS2DObject(el);
      if (centros[id]) obj.center.set(...centros[id]);
      this.scene.add(obj);
      this.etiquetas[id] = { obj, el, titulo: el.querySelector('b'), valor: el.querySelector('span'), vistas: null };
    }
    this.mostrarEtiquetasVista();
  }

  etiqueta(id, texto, nivel = 'ok', pos, titulo) {
    const e = this.etiquetas[id];
    if (!e) return;
    if (e.valor.textContent !== texto) e.valor.textContent = texto;
    if (titulo && e.titulo.textContent !== titulo) e.titulo.textContent = titulo;
    if (e.el.dataset.nivel !== nivel) e.el.dataset.nivel = nivel;
    if (pos) e.obj.position.set(...(Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z]));
  }

  /** Muestra u oculta una etiqueta (además de la regla de la vista). */
  etiquetaVisible(id, visible) {
    const e = this.etiquetas[id];
    if (e) { e.forzada = visible; this.mostrarEtiquetasVista(); }
  }

  mostrarEtiquetasVista() {
    const reglas = this.VISTAS?.[this.vista]?.etiquetas;
    for (const [id, e] of Object.entries(this.etiquetas)) {
      let ver = !reglas || reglas.includes(id);
      if (e.forzada === false) ver = false;
      e.obj.visible = ver;
      e.el.style.display = ver ? '' : 'none';
    }
  }

  seleccionar(tab) {
    this.tabActiva = tab;
    for (const { el } of Object.values(this.etiquetas)) el.classList.toggle('activa', el.dataset.tab === tab);
    const vista = this.pestanaVista[tab];
    if (vista && vista !== this.vista) this.irAVista(vista);
    this.alSeleccionar?.(tab);
  }

  indexar(grupo) {
    grupo.traverse((o) => { if (o.isMesh) this.seleccionables.push(o); });
  }

  eventosSeleccion() {
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    let inicio = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { inicio = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 5) return;
      const rect = el.getBoundingClientRect();
      v.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(v, this.camara);
      const visible = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
      const hit = ray.intersectObjects(this.seleccionables, false).find((h) => visible(h.object));
      if (!hit) return;
      let o = hit.object;
      while (o && !o.userData.tab) o = o.parent;
      if (o) this.onSeleccion(o.userData.tab);
    });
  }

  // ── Cámara ────────────────────────────────────────────────────────────
  irAVista(nombre, inmediato = false) {
    const v = this.VISTAS[nombre];
    if (!v) return;
    this.vista = nombre;
    const lejos = this.factorLejania();
    const mira = new THREE.Vector3(...v.mira);
    const pos = new THREE.Vector3(...v.pos).sub(mira).multiplyScalar(lejos).add(mira);
    if (inmediato || !this.camara) {
      this.camara?.position.copy(pos);
      this.controles?.target.copy(mira);
      this.controles?.update();
      this.vuelo = null;
    } else {
      this.vuelo = { t: 0, dur: 1.4, p0: this.camara.position.clone(), m0: this.controles.target.clone(), p1: pos, m1: mira };
    }
    this.mostrarEtiquetasVista();
    this.alCambiarVista?.(nombre);
  }

  factorLejania() {
    const a = this.camara?.aspect ?? 1.6;
    return a < 1.3 ? 1.3 / a : 1;
  }

  redimensionar() {
    const w = this.contenedor.clientWidth;
    const h = this.contenedor.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.etiquetador.setSize(w, h);
    const antes = this.factorLejania();
    this.camara.aspect = w / h;
    const ahora = this.factorLejania();
    if (Math.abs(antes - ahora) > 1e-6) {
      const dir = new THREE.Vector3().subVectors(this.camara.position, this.controles.target).multiplyScalar(ahora / antes);
      this.camara.position.copy(this.controles.target).add(dir);
    }
    this.camara.updateProjectionMatrix();
  }

  /** Guarda los resultados; si la escena ya está lista, la actualiza. */
  actualizar(p, r, sim) {
    this.p = p;
    this.r = r;
    this.sim = sim;
    if (this.listo) this.aplicar(p, r, sim);
  }

  animar() {
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    this.t += dt;
    if (this.vuelo) {
      const f = this.vuelo;
      f.t += dt / f.dur;
      const k = f.t >= 1 ? 1 : (f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2);
      this.camara.position.lerpVectors(f.p0, f.p1, k);
      this.controles.target.lerpVectors(f.m0, f.m1, k);
      if (f.t >= 1) this.vuelo = null;
    }
    this.controles.update();
    if (this.camara.position.y < 1.5) this.camara.position.y = 1.5;
    this.paso(dt, this.t);
    this.renderer.render(this.scene, this.camara);
    this.etiquetador.render(this.scene, this.camara);
  }
}
