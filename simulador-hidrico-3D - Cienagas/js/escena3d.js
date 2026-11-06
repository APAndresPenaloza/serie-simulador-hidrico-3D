/**
 * escena3d.js — La ciénaga costera en 3D (Three.js).
 * Una laguna somera y grande separada del mar Caribe por una barra de arena con su carretera
 * y sus alcantarillas; al occidente el río Magdalena, perchado entre sus diques naturales, le
 * pasa agua por los caños; al oriente bajan los ríos de la Sierra Nevada; al nororiente la
 * Boca de la Barra comunica la ciénaga con el mar. El manglar la rodea (cada árbol se colorea
 * con el estrés de su especie por la sal del suelo) y en el agua está el pueblo de palafitos
 * con sus canoas. El color del agua sigue a la salinidad y a las algas.
 * La escena solo dibuja: los números vienen de sistema.js.
 */
import { EscenaBase, THREE, materialAgua, texturaAgua, caja, cilindro, casa, bote, nube, FlujoCurva, Lluvia, azar, reiniciarAzar, suave, mezclar, ruidoSuave } from './nucleo/escena-base.js';
import * as S from './sistema.js';
import { fmt, miles, conSigno } from './nucleo/formato.js';

const V = 3;                       // unidades por metro en la vertical (niveles y profundidades)
const CX = 0, CZ = 15, A = 105, B = 80;   // la ciénaga: elipse (1 unidad = 120 m)
const Z_BARRA = -82;               // eje de la barra de arena y de la carretera
const Z_PLAYA = -93;               // línea de la playa
const XR = (z) => -228 + 9 * Math.sin(z / 55);   // eje del río Magdalena
const H_REF = 1.0;                 // nivel del río con el que se arman las partículas
const limitar01 = (v) => Math.min(1, Math.max(0, v));

const COLOR = {
  llanura: new THREE.Color(0x7f9b52), pantano: new THREE.Color(0x6d7a45), lodo: new THREE.Color(0x4f4a35),
  lodoClaro: new THREE.Color(0x8a7f58), arena: new THREE.Color(0xdccba0), duna: new THREE.Color(0xb9b57c),
  fondoMar: new THREE.Color(0xc6b98c), marHondo: new THREE.Color(0x6c7d78), bosque: new THREE.Color(0x4f7d3f),
  seco: new THREE.Color(0x9a9a5a), roca: new THREE.Color(0x8b857a), nieve: new THREE.Color(0xf4f4f2),
  cauce: new THREE.Color(0x6b5b40), rioSierra: new THREE.Color(0x4c86a8),
};
const AGUA = {
  dulce: new THREE.Color(0x6a7f45), salobre: new THREE.Color(0x3f8a84), marina: new THREE.Color(0x2a7fb0),
  hiper: new THREE.Color(0x93d0c6), algas: new THREE.Color(0x4d8a34),
};
const MANGLE = {
  rojo: new THREE.Color(0x2c6431), blanco: new THREE.Color(0x63923c), negro: new THREE.Color(0x4a6f45),
  amarillo: new THREE.Color(0xb1a246), muerto: new THREE.Color(0xa49c88),
};

/** Distancia de un punto (x, z) a una polilínea [[x, z], ...]. */
function distPolilinea(x, z, pts) {
  let mejor = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < mejor) mejor = d;
  }
  return mejor;
}
/** Polilínea con su caja (para descartar rápido los puntos lejanos). */
function conCaja(pts, margen) {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return { pts, x0: Math.min(...xs) - margen, x1: Math.max(...xs) + margen, z0: Math.min(...zs) - margen, z1: Math.max(...zs) + margen };
}
const distCaja = (x, z, c) => (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1 ? Infinity : distPolilinea(x, z, c.pts));
/** Distancia a la polilínea y posición u (0 a 1) del punto más cercano a lo largo de ella. */
function distParam(x, z, c) {
  if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) return [Infinity, 0];
  const pts = c.pts;
  let mejor = Infinity, u = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < mejor) { mejor = d; u = (k + t) / (pts.length - 1); }
  }
  return [mejor, u];
}
/** Inversa de suave(s) = 3s² − 2s³ en [0, 1] (por bisección). */
function inversaSuave(v) {
  let a = 0, b = 1;
  for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (suave(m) < v) a = m; else b = m; }
  return (a + b) / 2;
}

/** Cinta de agua a lo largo de una polilínea (y por vértice, ancho variable). */
function cinta(pts, ancho, material) {
  const n = pts.length;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * n), 3));
  const uv = [];
  const idx = [];
  let largo = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) largo += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    uv.push(0, largo / 20, 1, largo / 20);
    if (k < n - 1) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.userData = { pts, ancho };
  m.renderOrder = 2;
  return m;
}
/** Coloca los vértices de la cinta: y(t) con t de 0 a 1 a lo largo, medio ancho w. */
function moverCinta(m, y, w = m.userData.ancho) {
  const { pts } = m.userData;
  const pos = m.geometry.attributes.position;
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l, nz = tx / l;
    const yy = y(k / (n - 1));
    pos.setXYZ(2 * k, pts[k][0] + nx * w, yy, pts[k][1] + nz * w);
    pos.setXYZ(2 * k + 1, pts[k][0] - nx * w, yy, pts[k][1] - nz * w);
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
  m.geometry.computeBoundingSphere();
}

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xd3e4ea;
    this.niebla = [520, 1350];
    this.pestanaVista = { rios: 'canos', cienaga: 'general', mar: 'boca', salinidad: 'general', manglar: 'palafitos', calidad: 'palafitos', sedimentos: 'canos' };
    this.zFondo = -1.4;
    this.anchoB = 6.5;
    this.fondoB = -9;
    this.nCanosVis = 3;
    this.lechoCanos = -1.6;
    this.anchoCanos = 2.6;
    this.HmaxCanos = 2.4;
    this.ult = {};
  }

  vistasDefs() {
    return {
      general: { pos: [-25, 375, 390], mira: [-25, 0, -5], etiquetas: ['cienaga', 'salinidad', 'magdalena', 'canos', 'sierra', 'boca', 'mar', 'manglar', 'palafitos'] },
      canos: { pos: [-110, 95, 135], mira: [-165, 0, 0], etiquetas: ['magdalena', 'canos', 'sedimentos', 'palafitos', 'manglar'] },
      boca: { pos: [175, 70, 15], mira: [70, 0, -78], etiquetas: ['boca', 'mar', 'carretera', 'manglar', 'cienaga'] },
      palafitos: { pos: [-22, 36, 72], mira: [-62, 2, 14], etiquetas: ['palafitos', 'pesca', 'oxigeno', 'salinidad', 'manglar'] },
    };
  }

  etiquetasDefs() {
    return [
      ['cienaga', 'cienaga', 'Ciénaga'],
      ['salinidad', 'salinidad', 'Salinidad'],
      ['magdalena', 'rios', 'Río Magdalena'],
      ['canos', 'rios', 'Caños'],
      ['sierra', 'rios', 'Ríos de la Sierra Nevada'],
      ['boca', 'mar', 'Boca de la Barra'],
      ['mar', 'mar', 'Mar Caribe'],
      ['carretera', 'mar', 'Carretera de la barra', 'secundaria'],
      ['manglar', 'manglar', 'Manglar'],
      ['palafitos', 'cienaga', 'Pueblo de palafitos'],
      ['pesca', 'manglar', 'Pesca', 'secundaria'],
      ['oxigeno', 'calidad', 'Oxígeno'],
      ['sedimentos', 'sedimentos', 'Sedimento de los caños', 'secundaria'],
    ];
  }

  centrosEtiquetas() { return { palafitos: [0.5, 1], manglar: [0.5, 1], sierra: [0.5, 1], magdalena: [0.5, 1], boca: [0, 0.5], carretera: [0.5, 1] }; }

  rho(x, z) { return Math.hypot((x - CX) / A, (z - CZ) / B); }
  /** Orilla occidental y oriental de la ciénaga a la altura z. */
  orilla(z, lado = -1) { const u = (z - CZ) / B; return CX + lado * A * Math.sqrt(Math.max(0, 1 - u * u)); }

  // ── Trazados ────────────────────────────────────────────────────────────
  trazados() {
    const zs = [10, -30, 45, -55, 70, -10];
    this.canos = zs.map((z0, k) => {
      const z1 = z0 * 0.92 + 2;
      const x0 = XR(z0) + 6, x1 = this.orilla(z1, -1) + 3;
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const t = j / 14;
        pts.push([mezclar(x0, x1, t), mezclar(z0, z1, t) + 4 * Math.sin(t * Math.PI * 2 + k * 1.7) * Math.sin(t * Math.PI)]);
      }
      return conCaja(pts, 6);
    });
    const sierra = [
      [[330, 175], [262, 150], [205, 128], [150, 100], [this.orilla(66, 1) + 4, 66]],
      [[330, 70], [268, 60], [210, 52], [160, 40], [this.orilla(34, 1) + 4, 34]],
      [[330, -42], [270, -30], [215, -14], [165, -2], [this.orilla(3, 1) + 4, 3]],
    ];
    this.riosSierra = sierra.map((pts) => conCaja(pts, 5));
    this.boca = conCaja([[64, -38], [70, -58], [76, -80], [80, -100], [82, -114]], 14);
  }

  // ── Terreno ─────────────────────────────────────────────────────────────
  altura(x, z) {
    const n1 = ruidoSuave(x + 300, z + 300, 25), n2 = ruidoSuave(x, z, 9);
    let y = 1.7 + 1.1 * (n1 - 0.5) + 0.4 * (n2 - 0.5);
    // Sierra Nevada al oriente (baja hacia el mar)
    if (x > 135) {
      const costa = suave(limitar01((z + 95) / 70));
      const monte = 95 * suave(limitar01((x - 135) / 190)) * (0.7 + 0.6 * (ruidoSuave(x, z + 900, 34) - 0.5)) + 10 * (ruidoSuave(x + 50, z, 12) - 0.5) * suave(limitar01((x - 150) / 60));
      y += monte * costa;
    }
    // La ciénaga: fondo plano, borde de manglar que se inunda y tierra firme
    const r = this.rho(x, z);
    if (r < 1.25) {
      const fondo = this.zFondo * V + 0.6 * (n2 - 0.5);
      if (r < 0.9) y = fondo;
      else if (r < 1.08) y = mezclar(fondo, 1.0, suave((r - 0.9) / 0.18));
      else y = mezclar(1.0, y, suave((r - 1.08) / 0.17));
    }
    // Barra de arena y mar
    if (z < -64) {
      if (z >= Z_BARRA) y = mezclar(y, 3.8, suave((-64 - z) / (-64 - Z_BARRA)));
      else if (z >= Z_PLAYA) y = mezclar(3.8, -0.4, suave((Z_BARRA - z) / (Z_BARRA - Z_PLAYA)));
      else { const d = Z_PLAYA - z; y = Math.max(-34, -0.4 - 0.14 * d - 0.0007 * d * d); }
    }
    // Río Magdalena entre sus diques naturales
    const ult = this.ult;
    ult.rio = Infinity; ult.cano = Infinity; ult.sierra = Infinity;
    if (z > -118) {
      const d = Math.abs(x - XR(z));
      ult.rio = d;
      const conDique = z > -70;
      if (d < 8) y = Math.min(y, -6 + 0.3 * n2);
      else if (d < 12) y = conDique ? mezclar(-6, 5.6, suave((d - 8) / 4)) : Math.min(y, mezclar(-6, y, suave((d - 8) / 4)));
      else if (d < 34 && conDique) y = Math.max(y, mezclar(5.6, y, suave((d - 12) / 22)));
    }
    // Caños del Magdalena a la ciénaga
    const wc = this.anchoCanos;
    for (let k = 0; k < this.nCanosVis; k++) {
      const [d, u] = distParam(x, z, this.canos[k]);
      if (d < ult.cano) ult.cano = d;
      if (d >= wc + 6.5) continue;
      // El agua alta del caño baja del río a la ciénaga; sus diques naturales quedan encima
      const cresta = Math.max(1.2, mezclar(this.HmaxCanos, 0.25, u) * V + 0.9);
      if (d < wc) y = Math.min(y, this.lechoCanos);
      else if (d < wc + 1.6) y = mezclar(this.lechoCanos, r < 1.05 ? Math.min(y, cresta) : Math.max(y, cresta), suave((d - wc) / 1.6));
      else if (r >= 1.05) y = Math.max(y, mezclar(cresta, y, suave((d - wc - 1.6) / 4.9)));
    }
    // Ríos de la Sierra
    for (const c of this.riosSierra) {
      const d = distCaja(x, z, c);
      if (d < ult.sierra) ult.sierra = d;
      if (d < 5 && r > 1.02) y -= 1.8 * (1 - suave(d / 5));
    }
    // Boca de la Barra
    const db = distCaja(x, z, this.boca);
    ult.boca = db;
    const w = this.anchoB;
    if (db < w + 6) y = Math.min(y, db < w ? this.fondoB : mezclar(this.fondoB, y, suave((db - w) / 6)));
    return y;
  }

  colorTerreno(c, x, z, y) {
    const u = this.ult;
    const r = this.rho(x, z);
    if (u.rio < 8.3 && z > -118) { c.copy(COLOR.cauce); return; }
    if (u.cano < this.anchoCanos) { c.copy(COLOR.cauce); return; }
    if ((u.rio < 13 && z > -70) || u.cano < this.anchoCanos + 1.8) { c.copy(COLOR.pantano).lerp(COLOR.lodoClaro, 0.25); return; }
    if (u.sierra < 1.8 && r > 1.02 && y > 0.5) { c.copy(COLOR.rioSierra); return; }
    if (y < -0.2) {
      if (z < Z_PLAYA - 2) { c.copy(COLOR.fondoMar).lerp(COLOR.marHondo, limitar01(-y / 25)); return; }
      c.copy(COLOR.lodo).lerp(COLOR.lodoClaro, limitar01((y + 4.5) / 4.5) ** 2);
      return;
    }
    if (z < -64 && y < 4.2 && x < 200) {
      if (z < Z_BARRA) { c.copy(COLOR.arena); return; }
      c.copy(COLOR.duna).lerp(COLOR.arena, limitar01((-70 - z) / 12));
      return;
    }
    if (y > 78) { c.copy(COLOR.nieve); return; }
    if (y > 55) { c.copy(COLOR.bosque).lerp(COLOR.roca, limitar01((y - 55) / 20)); return; }
    if (y > 12) { c.copy(COLOR.seco).lerp(COLOR.bosque, limitar01((y - 12) / 30)); return; }
    if (r < 1.25) { c.copy(COLOR.pantano).lerp(COLOR.llanura, limitar01((r - 1.05) / 0.2)); return; }
    c.copy(COLOR.llanura).lerp(COLOR.seco, limitar01((x - 120) / 60) * 0.6);
  }

  construir() {
    reiniciarAzar(1050);
    this.trazados();
    this.malla = this.terreno({ x0: -340, x1: 340, z0: -300, z1: 270, nx: 330, nz: 280, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.scene.add(this.malla);
    const sc = this.luzSol.shadow.camera;
    sc.left = -300; sc.right = 300; sc.top = 280; sc.bottom = -280; sc.far = 800;
    this.luzSol.position.set(160, 260, 140);
    sc.updateProjectionMatrix();

    // Agua de la ciénaga
    this.grupoCienaga = this.grupo('cienaga');
    this.matCienaga = materialAgua(AGUA.salobre, { opacidad: 0.88, repetir: 26 });
    const f = new THREE.Shape();
    f.absellipse(0, 0, A * 1.14, B * 1.14, 0, Math.PI * 2, false, 0);
    this.aguaCienaga = new THREE.Mesh(new THREE.ShapeGeometry(f, 120), this.matCienaga);
    this.aguaCienaga.rotation.x = -Math.PI / 2;
    this.aguaCienaga.position.set(CX, 0, CZ);
    this.aguaCienaga.renderOrder = -1;
    this.grupoCienaga.add(this.aguaCienaga);
    this.indexar(this.grupoCienaga);

    // Mar Caribe y espuma de la playa
    this.grupoMar = this.grupo('mar');
    this.matMar = materialAgua(0x1f6fa6, { opacidad: 0.9, repetir: 30 });
    this.aguaMar = new THREE.Mesh(new THREE.PlaneGeometry(700, 230), this.matMar);
    this.aguaMar.rotation.x = -Math.PI / 2;
    this.aguaMar.position.set(0, 0, -88 - 115);
    this.aguaMar.renderOrder = -1;
    this.espuma = new THREE.Mesh(new THREE.PlaneGeometry(700, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
    this.espuma.rotation.x = -Math.PI / 2;
    this.espuma.position.set(0, 0.1, Z_PLAYA + 0.6);
    this.grupoMar.add(this.aguaMar, this.espuma);
    this.indexar(this.grupoMar);

    this.armarMagdalena();
    this.armarCanos();
    this.armarSierra();
    this.armarBoca();
    this.armarCarretera();
    this.armarManglar();
    this.armarPueblos();
    this.armarCanoas();

    // Lluvia de la tarde y nubes
    this.lluvia = new Lluvia(this.scene, 1600, { x0: -150, x1: 150, z0: -70, z1: 110, y0: 0, y1: 80 });
    this.lluvia.visible = false;
    this.nubes = [];
    for (const [x, y, z, e] of [[-250, 95, -230, 7], [-60, 110, -280, 6], [170, 100, -240, 7], [300, 130, 40, 8], [250, 120, 220, 6], [-300, 100, 210, 7], [330, 110, 160, 5]]) {
      const n = nube(e, 0xffffff, 0.92);
      n.position.set(x, y, z);
      this.scene.add(n);
      this.nubes.push(n);
    }
  }

  armarMagdalena() {
    this.grupoMagdalena = this.grupo('rios');
    const pts = [];
    for (let z = 268; z >= Z_PLAYA - 1; z -= 5) pts.push([XR(z), z]);
    this.matRio = materialAgua(0xb0965f, { opacidad: 0.93, repetir: 1, textura: texturaAgua('#e9e2d2', 'rgba(255,255,255,0.75)') });
    this.matRio.map.repeat.set(1, 1);
    this.matRio.roughness = 0.16; this.matRio.metalness = 0.12;
    this.cintaRio = cinta(pts, 8.5, this.matRio);
    this.grupoMagdalena.add(this.cintaRio);
    this.indexar(this.grupoMagdalena);
    const pts3 = pts.map(([x, z]) => [x, (z > -50 ? H_REF : H_REF * limitar01((z - Z_PLAYA) / (-50 - Z_PLAYA))) * V + 0.2, z]);
    this.flujoRio = new FlujoCurva(this.scene, 700, pts3, { color: 0xfaf3e2, tamano: 1.5, ancho: 7, alto: 0.12 });
    this.flujoRio.velocidad = 26;
  }

  /** Nivel del río a lo largo de su eje (baja al mar en la desembocadura). */
  yRio(t, H, eta) {
    const z = mezclar(268, Z_PLAYA - 1, t);
    return (z > -50 ? H : mezclar(eta, H, limitar01((z - Z_PLAYA) / (-50 - Z_PLAYA)))) * V + 0.15;
  }

  armarCanos() {
    this.grupoCanos = this.grupo('rios');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const gr = cv.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    const g2 = cv.getContext('2d');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    this.texPluma = new THREE.CanvasTexture(cv);
    this.cintasCanos = [];
    this.flujosCanos = [];
    this.diques = [];
    this.tapones = [];
    this.plumas = [];
    for (const [k, c] of this.canos.entries()) {
      const mat = materialAgua(0xa89160, { opacidad: 0.92, repetir: 1, textura: texturaAgua('#e9e2d2', 'rgba(255,255,255,0.75)') });
      mat.map.repeat.set(1, 1);
      mat.roughness = 0.16; mat.metalness = 0.12;
      const m = cinta(c.pts, 1.8, mat);
      this.grupoCanos.add(m);
      this.cintasCanos.push(m);
      const pts3 = c.pts.map(([x, z], j) => [x, mezclar(H_REF * V, 0.15, j / (c.pts.length - 1)) + 0.15, z]);
      const fl = new FlujoCurva(this.scene, 90, pts3, { color: 0xfaf3e2, tamano: 1.0, ancho: 1.3, alto: 0.1 });
      this.flujosCanos.push(fl);
      // Dique (caño cerrado) y tapones de sedimento (caño sedimentado)
      const [x0, z0] = c.pts[1], [x1, z1] = c.pts[2];
      const dique = caja(3, 2.2, 9, 0x7a6342);
      dique.position.set(x0, 4.5, z0);
      dique.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      dique.visible = false;
      this.grupoCanos.add(dique);
      this.diques.push(dique);
      for (const j of [5, 9]) {
        const [xa, za] = c.pts[j];
        const t = caja(4.5, 1, 3.4, 0xc9b07a);
        t.position.set(xa, 0.6 + (1 - j / 14) * 2, za);
        t.rotation.y = k * 0.7 + j;
        t.visible = false;
        this.grupoCanos.add(t);
        this.tapones.push({ m: t, k, j });
      }
      // Pluma de sedimento en la entrada a la ciénaga
      const pl = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0x7b6845, map: this.texPluma, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
      pl.rotation.x = -Math.PI / 2;
      const [xe, ze] = c.pts[c.pts.length - 1];
      pl.position.set(xe + 8, 0.2, ze);
      pl.renderOrder = 3;
      this.grupoCanos.add(pl);
      this.plumas.push(pl);
    }
    this.indexar(this.grupoCanos);
  }

  armarSierra() {
    this.grupoSierra = this.grupo('rios');
    this.flujosSierra = this.riosSierra.map((c) => {
      const pts = [];
      for (let j = 0; j < c.pts.length - 1; j++) {
        const [ax, az] = c.pts[j], [bx, bz] = c.pts[j + 1];
        for (let s = 0; s < 6; s++) {
          const x = mezclar(ax, bx, s / 6), z = mezclar(az, bz, s / 6);
          pts.push([x, Math.max(0.3, this.altura(x, z) + 0.35), z]);
        }
      }
      const [xe, ze] = c.pts[c.pts.length - 1];
      pts.push([xe, 0.4, ze]);
      return new FlujoCurva(this.scene, 110, pts, { color: 0xe6f4fa, tamano: 0.7, ancho: 1.1, alto: 0.25 });
    });
    // Un pueblo de la zona bananera al pie de la Sierra
    reiniciarAzar(77);
    for (let k = 0; k < 10; k++) {
      const x = 150 + azar() * 30, z = 60 + azar() * 40;
      if (distCaja(x, z, this.riosSierra[0]) < 6 || distCaja(x, z, this.riosSierra[1]) < 6) continue;
      const c = casa({ ancho: 3, fondo: 3.4, alto: 2.2, techo: [0xb5533a, 0x9aa3a8][k % 2] });
      c.position.set(x, this.altura(x, z), z);
      c.rotation.y = azar();
      this.grupoSierra.add(c);
    }
    this.indexar(this.grupoSierra);
  }

  armarBoca() {
    this.grupoBoca = this.grupo('mar');
    this.matBoca = materialAgua(0x2a7fb0, { opacidad: 0.9, repetir: 1 });
    this.matBoca.map.repeat.set(1, 1);
    const pts = [[67, -48], [70, -58], [76, -80], [79.5, -97]];
    this.cintaBoca = cinta(pts, this.anchoB, this.matBoca);
    this.grupoBoca.add(this.cintaBoca);
    this.flujoBoca = new FlujoCurva(this.scene, 140, pts.map(([x, z]) => [x, 0.25, z]), { color: 0xf2fbff, tamano: 0.8, ancho: 4, alto: 0.1 });
    // Pueblo de Ciénaga, al oriente de la boca
    reiniciarAzar(91);
    for (let k = 0; k < 22; k++) {
      const x = 95 + azar() * 50, z = -68 + azar() * 34;
      if (this.altura(x, z) < 1.2 || distCaja(x, z, this.boca) < this.anchoB + 7) continue;
      const c = casa({ ancho: 3.2, fondo: 3.6, alto: 2.4, techo: [0xb5533a, 0xc96c48, 0x9aa3a8][k % 3], pared: [0xe9e1d0, 0xf0d9a8, 0xd7e3e8][k % 3] });
      c.position.set(x, this.altura(x, z), z);
      c.rotation.y = azar() * 0.6;
      this.grupoBoca.add(c);
    }
    this.indexar(this.grupoBoca);
  }

  armarCarretera() {
    this.grupoCarretera = this.grupo('mar');
    const via = caja(560, 0.7, 3.4, 0x55585d, { sombra: false });
    via.position.set(-60, 4.4, Z_BARRA);
    this.grupoCarretera.add(via);
    const linea = new THREE.Mesh(new THREE.PlaneGeometry(560, 0.25), new THREE.MeshBasicMaterial({ color: 0xf2c230 }));
    linea.rotation.x = -Math.PI / 2;
    linea.position.set(-60, 4.77, Z_BARRA);
    this.grupoCarretera.add(linea);
    // Pilas de los puentes sobre la boca y sobre el río
    for (const x of [73, 79]) { const p = cilindro(0.5, 0.5, 14, 0x9a9a96, { lados: 8 }); p.position.set(x, -2.5, Z_BARRA); this.grupoCarretera.add(p); }
    for (const dx of [-5, 0, 5]) { const p = cilindro(0.6, 0.6, 12, 0x9a9a96, { lados: 8 }); p.position.set(XR(Z_BARRA) + dx, -1.5, Z_BARRA); this.grupoCarretera.add(p); }
    // Alcantarillas bajo la carretera (de a pares por cada símbolo)
    this.alcantarillas = [];
    for (let k = 0; k < 20; k++) {
      const x = -190 + k * 12.5;
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const boca = caja(1.6, 1.2, 0.5, 0x2b2e33, { sombra: false });
        boca.position.set(0, 3.6, s * 2);
        g.add(boca);
      }
      g.position.set(x, 0, Z_BARRA);
      g.visible = false;
      this.grupoCarretera.add(g);
      this.alcantarillas.push(g);
    }
    // Carros
    this.carros = [];
    for (let k = 0; k < 6; k++) {
      const c = caja(2.6, 1.2, 1.5, [0xd04a3a, 0xf2f2f2, 0x3a6ea5][k % 3]);
      c.position.set(-300 + k * 95, 5.3, Z_BARRA + (k % 2 ? 0.8 : -0.8));
      c.userData.v = k % 2 ? 16 : -16;
      this.grupoCarretera.add(c);
      this.carros.push(c);
    }
    this.indexar(this.grupoCarretera);
  }

  armarManglar() {
    this.grupoManglar = this.grupo('manglar');
    reiniciarAzar(4040);
    const arboles = [];
    // Los caños inactivos no se excavan: cada árbol guarda su distancia a cada caño y se esconde
    // si queda dentro de un caño activo.
    const libre = (x, z, m = 4.5) => distCaja(x, z, this.boca) > 8.5 + m && this.riosSierra.every((c) => distCaja(x, z, c) > m) && Math.abs(x - XR(z)) > 13;
    const poner = (x, z, especie, banco = -1) => {
      if (!libre(x, z)) return;
      arboles.push({ x, z, especie, banco, r: 1.3 + azar() * 0.9, dc: this.canos.map((c) => distCaja(x, z, c)) });
    };
    // Franja alrededor de la ciénaga: rojo al borde del agua, blanco en medio, negro tierra adentro
    for (let k = 0; k < 760; k++) {
      const ang = azar() * Math.PI * 2;
      const u = azar();
      const rr = 0.995 + u * 0.19;
      const x = CX + Math.cos(ang) * A * rr, z = CZ + Math.sin(ang) * B * rr;
      if (z < -70) continue;
      poner(x, z, u < 0.33 ? 'rojo' : (u < 0.6 ? 'blanco' : 'negro'));
    }
    // Isla de Salamanca (entre el río y la ciénaga, junto a la barra) y orillas de los caños
    for (let k = 0; k < 260; k++) {
      const x = -212 + azar() * 110, z = -74 + azar() * 40;
      if (this.rho(x, z) < 1.02) continue;
      poner(x, z, ['rojo', 'blanco', 'negro', 'negro'][k % 4]);
    }
    this.canos.forEach((c, k) => {
      for (let j = 0; j < 22; j++) {
        const u = 1 + Math.floor(azar() * (c.pts.length - 2));
        const [xa, za] = c.pts[u];
        const s = azar() < 0.5 ? -1 : 1;
        const x = xa + (azar() - 0.5) * 6, z = za + s * (4.8 + azar() * 3);
        if (this.rho(x, z) > 1.02) poner(x, z, azar() < 0.7 ? 'rojo' : 'blanco', k);
      }
    });
    this.arboles = arboles;
    const n = arboles.length;
    this.copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), n);
    this.raices = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.45, 1, 5), new THREE.MeshStandardMaterial({ color: 0x5f4a33, roughness: 0.9, flatShading: true }), n);
    this.copas.castShadow = true;
    const m4 = new THREE.Matrix4();
    this.grupoManglar.add(this.copas, this.raices);
    this.pintarManglar({ rojo: 0, blanco: 0, negro: 0 });
    this.indexar(this.grupoManglar);
  }

  /** Color y tamaño de cada copa según el estrés de su especie (y los árboles de los caños activos). */
  pintarManglar(estres) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const n = this.nCanosVis;
    this.arboles.forEach((a, k) => {
      const x = estres[a.especie] ?? 0;
      let visible = a.banco < n;
      for (let j = 0; j < n && visible; j++) if (a.dc[j] < 4.5) visible = false;
      a.y = Math.max(-0.4, this.altura(a.x, a.z));
      const esc = visible ? a.r * (1 - 0.45 * x) : 0;
      e.set(0, (k * 0.37) % 6.28, 0);
      q.setFromEuler(e);
      s.set(esc, esc * 0.62, esc);
      p.set(a.x, a.y + 1.7 + 0.45 * a.r, a.z);
      m4.compose(p, q, s);
      this.copas.setMatrixAt(k, m4);
      m4.makeScale(visible ? 0.6 : 0, 1.8, visible ? 0.6 : 0).setPosition(a.x, a.y + 0.9, a.z);
      this.raices.setMatrixAt(k, m4);
      if (x < 0.5) c.copy(MANGLE[a.especie]).lerp(MANGLE.amarillo, x / 0.5);
      else c.copy(MANGLE.amarillo).lerp(MANGLE.muerto, (x - 0.5) / 0.5);
      this.copas.setColorAt(k, c);
    });
    this.copas.instanceMatrix.needsUpdate = true;
    this.raices.instanceMatrix.needsUpdate = true;
    if (this.copas.instanceColor) this.copas.instanceColor.needsUpdate = true;
    this.copas.computeBoundingSphere();
    this.raices.computeBoundingSphere();
  }

  armarPueblos() {
    this.grupoPalafitos = this.grupo('cienaga');
    this.armarPalafitos(0.8);
    this.indexar(this.grupoPalafitos);
    // Peces muertos (mortandad por falta de oxígeno)
    this.grupoPeces = this.grupo('calidad');
    reiniciarAzar(55);
    const n = 70;
    this.peces = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.6 }), n);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      const ang = azar() * Math.PI * 2, rr = 0.25 + azar() * 0.6;
      m4.makeScale(1.4, 0.25, 0.5).setPosition(CX - 40 + Math.cos(ang) * 50 * rr, 0, CZ + Math.sin(ang) * 45 * rr);
      this.peces.setMatrixAt(k, m4);
    }
    this.grupoPeces.add(this.peces);
    this.grupoPeces.visible = false;
    this.indexar(this.grupoPeces);
  }

  /** Casas de colores sobre pilotes, con el piso a la cota dada (m.s.n.m.). */
  armarPalafitos(piso) {
    const g = this.grupoPalafitos;
    const viejos = new Set();
    for (const o of [...g.children]) { g.remove(o); o.traverse((x) => { x.geometry?.dispose(); viejos.add(x); }); }
    if (viejos.size) this.seleccionables = this.seleccionables.filter((o) => !viejos.has(o));
    const yPiso = piso * V;
    reiniciarAzar(1999);
    const paredes = [0xe5736f, 0x5fa8d3, 0xf2c94c, 0x7dc28a, 0xf4f1ea, 0xc98ad0];
    const lugares = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) lugares.push([-78 + i * 9 + (azar() - 0.5) * 3, 2 + j * 9 + (azar() - 0.5) * 3]);
    lugares.forEach(([x, z], k) => {
      const grande = k === 5;
      const ancho = grande ? 6 : 3, fondo = grande ? 4.5 : 3.6;
      const casita = new THREE.Group();
      const plataforma = caja(ancho + 1.4, 0.3, fondo + 1.4, 0x7a5a3a);
      plataforma.position.y = 0.15;
      const c = casa({ ancho, fondo, alto: 2.3, pared: grande ? 0xffffff : paredes[k % paredes.length], techo: grande ? 0x3a6ea5 : (k % 3 ? 0x9aa3a8 : 0xa8804f) });
      c.position.y = 0.3;
      casita.add(plataforma, c);
      const fondoY = this.altura(x, z);
      const alto = yPiso - fondoY;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const pil = cilindro(0.16, 0.16, alto, 0x5b4630, { lados: 6 });
        pil.position.set(sx * (ancho / 2 + 0.5), -alto / 2, sz * (fondo / 2 + 0.5));
        casita.add(pil);
      }
      casita.position.set(x, yPiso, z);
      casita.rotation.y = (azar() - 0.5) * 0.5;
      g.add(casita);
    });
    this.pisoActual = piso;
  }

  armarCanoas() {
    this.grupoCanoas = this.grupo('manglar');
    reiniciarAzar(31);
    this.canoas = [];
    const sitios = [[-55, 42], [-88, 14], [-40, 8], [-20, 30], [10, -10], [35, 40], [-5, 65], [55, 5], [-70, -15], [20, 70]];
    for (const [x, z] of sitios) {
      const b = bote(3.4, [0x9a5b32, 0x3a6ea5, 0xc0392b][this.canoas.length % 3]);
      b.position.set(x, 0.2, z);
      b.rotation.y = azar() * Math.PI * 2;
      b.userData.fase = azar() * 6;
      this.grupoCanoas.add(b);
      this.canoas.push(b);
    }
    this.indexar(this.grupoCanoas);
  }

  // ── Resultados ──────────────────────────────────────────────────────────
  aplicar(p, r) {
    // Forma de la boca (rehace el terreno solo si cambia)
    const anchoB = 2.5 + 4 * Math.min(1.5, p.anchoBoca / 200);
    const fondoB = -Math.max(0.6, p.profBoca) * V;
    const nCanos = S.areaCanos(p) > 0 || p.estadoCanos === 'cerrados' ? Math.min(this.canos.length, p.nCanos) : 0;
    const lecho = { dragados: -2.2, abiertos: -1.6, sedimentados: 0.1, cerrados: -1.2 }[p.estadoCanos] ?? -1.6;
    const anchoC = { dragados: 3.2, abiertos: 2.6, sedimentados: 2.0, cerrados: 2.6 }[p.estadoCanos] ?? 2.6;
    const Hmax = Math.round(10 * Math.min(3, Math.max(0.5, p.Hrio + p.A1 + p.A2 + 0.4))) / 10;
    const forma = `${anchoB.toFixed(2)}|${fondoB.toFixed(2)}|${p.zFondo}|${nCanos}|${lecho}|${anchoC}|${Hmax}`;
    if (forma !== this.forma) {
      const primera = this.forma === undefined;
      this.forma = forma;
      const cambiaCanos = nCanos !== this.nCanosVis;
      this.anchoB = anchoB; this.fondoB = fondoB; this.zFondo = p.zFondo; this.nCanosVis = nCanos; this.lechoCanos = lecho;
      this.anchoCanos = anchoC; this.HmaxCanos = Hmax;
      if (!primera || forma !== '6.50|-9.00|-1.4|3|-1.6|2.6|2.4') this.repintarTerreno(this.malla);
      if (cambiaCanos || primera) this.firmaManglar = null;
    }
    const yC = r.z * V;
    const eta = r.q.eta;
    const H = r.q.H;
    this.nivelCienaga = yC;
    this.aguaCienaga.position.y = yC;
    this.aguaMar.position.y = eta * V;
    this.espuma.position.y = eta * V + 0.08;
    // Color del agua: dulce → salobre → marina → hipersalina, y verde con las algas
    const Sx = r.S;
    const c = this.matCienaga.color;
    if (Sx < 15) c.copy(AGUA.dulce).lerp(AGUA.salobre, Sx / 15);
    else if (Sx < 36) c.copy(AGUA.salobre).lerp(AGUA.marina, (Sx - 15) / 21);
    else c.copy(AGUA.marina).lerp(AGUA.hiper, limitar01((Sx - 36) / 25));
    c.lerp(AGUA.algas, Math.min(0.55, Math.max(0, (r.ca.Chl - 15) / 80)));

    // Magdalena
    const sOrilla = inversaSuave(limitar01((H * V + 6) / 11.6));
    moverCinta(this.cintaRio, (t) => this.yRio(t, H, eta), 8 + 4 * sOrilla + 0.2);
    this.flujoRio.obj.position.y = (H - H_REF) * V;

    // Caños
    const area = S.areaCanos(p);
    const porCano = p.nCanos > 0 ? r.q.Qc / p.nCanos : 0;
    const ancho = area > 0 ? (p.estadoCanos === 'sedimentados' ? 1.2 : this.anchoCanos + 0.25) : 0;
    this.cintasCanos.forEach((m, k) => {
      const activo = k < p.nCanos && area > 0;
      m.visible = activo;
      if (activo) moverCinta(m, (t) => mezclar(H, r.z, t) * V + 0.14, ancho);
      const fl = this.flujosCanos[k];
      fl.visible = activo && Math.abs(porCano) > 0.3;
      fl.sentido = porCano >= 0 ? 1 : -1;
      fl.velocidad = 3 + 7 * Math.sqrt(Math.abs(porCano) / 10);
      fl.ancho = Math.max(0.4, ancho * 0.7);
      fl.obj.position.y = ((H - H_REF) + r.z) / 2 * V;
      this.diques[k].visible = k < p.nCanos && p.estadoCanos === 'cerrados';
      const pl = this.plumas[k];
      const rad = Math.min(12, 2 + 0.3 * Math.sqrt(Math.max(0, porCano) * p.SSmag / 10));
      pl.visible = activo && porCano > 0.3;
      pl.scale.set(rad, rad, 1);
      pl.position.y = yC + 0.06;
    });
    for (const t of this.tapones) {
      t.m.visible = t.k < p.nCanos && p.estadoCanos === 'sedimentados';
      t.m.position.y = mezclar(H, r.z, t.j / 14) * V + 0.1;
    }

    // Ríos de la Sierra
    for (const fl of this.flujosSierra) { fl.visible = r.q.Qr > 0.2; fl.velocidad = 3 + 6 * Math.sqrt(r.q.Qr / 20); }

    // Boca de la Barra
    const abierta = r.areaBoca > 0 && p.anchoBoca > 0;
    this.cintaBoca.visible = p.anchoBoca > 0 && p.profBoca > 0;
    if (this.cintaBoca.visible) moverCinta(this.cintaBoca, (t) => mezclar(r.z, eta, t) * V + 0.14, anchoB);
    this.flujoBoca.visible = abierta && Math.abs(r.q.Qb) > 5 && p.anchoBoca > 0;
    this.flujoBoca.sentido = r.q.Qb >= 0 ? -1 : 1;   // los puntos van de la ciénaga al mar
    this.flujoBoca.velocidad = 3 + 10 * Math.sqrt(Math.abs(r.q.Qb) / 400);
    this.flujoBoca.ancho = anchoB * 0.7;
    this.flujoBoca.obj.position.y = (r.z + eta) / 2 * V;
    const nAl = Math.min(this.alcantarillas.length, Math.ceil(p.alcantarillas / 2));
    this.alcantarillas.forEach((g, k) => { g.visible = k < nAl; });

    // Manglar (solo si cambia el estrés)
    const firma = ['rojo', 'blanco', 'negro'].map((k) => r.especies[k].estres.toFixed(2)).join('|') + `|${this.nCanosVis}|${this.forma}`;
    if (firma !== this.firmaManglar) {
      this.firmaManglar = firma;
      this.pintarManglar({ rojo: r.especies.rojo.estres, blanco: r.especies.blanco.estres, negro: r.especies.negro.estres });
    }
    // Palafitos, canoas, peces, lluvia
    if (p.pisoPalafitos !== this.pisoActual) { this.armarPalafitos(p.pisoPalafitos); this.indexar(this.grupoPalafitos); }
    const nC = Math.max(2, Math.min(this.canoas.length, Math.round(2 + 8 * r.pesca)));
    this.canoas.forEach((b, k) => { b.visible = k < nC; });
    this.grupoPeces.visible = r.ca.ODmin < 2;
    this.peces.position.y = yC + 0.05;
    this.lluvia.visible = r.q.lluvia > 3 && r.hora >= 14 && r.hora < 18;
    const gris = this.lluvia.visible ? 0x9aa4ab : 0xffffff;
    for (const n of this.nubes) n.children.forEach((o) => o.material.color.setHex(gris));

    // Etiquetas
    const nivelSal = (s) => (s <= 40 ? 'ok' : (s <= 50 ? 'aviso' : 'alerta'));
    const estadoCano = S.ESTADOS_CANO[p.estadoCanos]?.nombre.split(' (')[0].toLowerCase() ?? '';
    this.etiqueta('cienaga', `nivel ${conSigno(r.z, 2)} m · ${fmt(r.A / 1e6, 0)} km² · ${fmt(r.h, 2)} m de agua`, r.margenPalafitos >= 0.3 ? 'ok' : 'alerta', [28, yC + 6, -22]);
    this.etiqueta('salinidad', `${fmt(r.S, 1)} PSU ahora · ${fmt(r.a.Smax, 1)} PSU en el peor mes`, nivelSal(r.a.Smax), [8, yC + 6, 46]);
    this.etiqueta('magdalena', `nivel ${fmt(H, 2)} m.s.n.m.`, 'ok', [XR(60), H * V + 8, 60]);
    this.etiqueta('canos', p.nCanos > 0 ? `${p.nCanos} ${estadoCano} · ${fmt(r.q.Qc, 1)} m³/s` : 'sin caños', r.a.Qc > 1 ? 'ok' : 'alerta', [-168, 7, this.canos[0].pts[7][1]]);
    this.etiqueta('sierra', `${fmt(r.q.Qr, 1)} m³/s · ${fmt(p.Qrios, 0)} de media`, 'ok', [235, 52, 40]);
    this.etiqueta('boca', `${miles(r.areaBoca)} m² · ${r.q.Qb >= 0 ? 'entra' : 'sale'} ${fmt(Math.abs(r.q.Qb), 0)} m³/s`, r.areaBoca >= 300 ? 'ok' : 'alerta', [86, 7, -64]);
    this.etiqueta('mar', `marea ${conSigno(eta, 2)} m · ${fmt(p.Smar, 1)} PSU`, 'ok', [-10, eta * V + 5, -150]);
    this.etiqueta('carretera', `${miles(p.alcantarillas)} alcantarillas`, p.alcantarillas > 0 ? 'ok' : 'aviso', [-120, 8, Z_BARRA]);
    const posManglar = { general: [40, 8, 100], canos: [-150, 10, -48], boca: [40, 8, -52], palafitos: [-100, 8, -18] };
    this.etiqueta('manglar', `${fmt(100 * r.salud, 0)} % sano · suelo ${fmt(r.Ssuelo, 0)} PSU`, r.saludPeor >= 0.8 ? 'ok' : 'alerta', posManglar[this.vista] ?? posManglar.general);
    this.etiqueta('palafitos', `piso ${fmt(p.pisoPalafitos, 2)} m · margen ${fmt(r.margenPalafitos, 2)} m`, r.margenPalafitos >= 0.3 ? 'ok' : 'alerta', [-64, p.pisoPalafitos * V + 6, 16]);
    this.etiqueta('pesca', `índice ${fmt(r.pesca, 2)}`, r.pesca >= 0.6 ? 'ok' : 'aviso', [-28, yC + 3.5, 30]);
    this.etiqueta('oxigeno', `${fmt(r.ca.OD, 1)} mg/L ahora · ${fmt(r.ca.ODmin, 1)} en la madrugada`, r.ca.ODmin >= 4 ? 'ok' : (r.ca.ODmin >= 2 ? 'aviso' : 'alerta'), [-38, yC + 4, -4]);
    const [xs, zs] = this.canos[0].pts[this.canos[0].pts.length - 1];
    this.etiqueta('sedimentos', `${fmt(r.sed.mm, 1)} mm/año de fondo`, r.sed.mm <= 5 ? 'ok' : 'aviso', [xs + 10, yC + 4, zs]);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    if (this.p && this.r && this.malla) this.aplicar(this.p, this.r, this.sim);
  }

  paso(dt, t) {
    if (!this.matCienaga) return;
    this.matCienaga.map.offset.x = (this.matCienaga.map.offset.x + 0.004 * dt) % 1;
    this.matMar.map.offset.y = (this.matMar.map.offset.y + 0.012 * dt) % 1;
    this.matRio.map.offset.y = (this.matRio.map.offset.y - 0.35 * dt) % 1;
    this.espuma.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6));
    this.flujoRio.paso(dt);
    for (const f of this.flujosCanos) f.paso(dt);
    for (const f of this.flujosSierra) f.paso(dt);
    this.flujoBoca.paso(dt);
    this.lluvia.paso(dt);
    const y = this.nivelCienaga ?? 0;
    for (const b of this.canoas) if (b.visible) b.position.y = y + 0.2 + Math.sin(t * 1.2 + b.userData.fase) * 0.08;
    for (const c of this.carros) { c.position.x += c.userData.v * dt; if (c.position.x > 220) c.position.x = -320; if (c.position.x < -320) c.position.x = 220; }
  }
}
