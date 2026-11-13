/**
 * escena3d.js — La red del agua en 3D, del páramo al océano (Three.js).
 * Una maqueta esquemática de la región con el norte hacia el mar: al oriente la Sierra Nevada
 * con su glaciar, la laguna del páramo y el lago andino; el río de la Sierra baja al occidente
 * hasta la Ciénaga Grande, separada del mar por una barra de arena y comunicada con él por la
 * Boca de la Barra; al occidente el río grande llega por el sur, le pasa agua a la ciénaga por
 * los caños y forma su delta con su pluma de lodo; al nororiente la playa de la bahía, al pie de
 * la Sierra; al norte el mar Caribe con el oleaje. Cada día del reloj cambian los caudales, la
 * sal de la ciénaga, la pluma, el oleaje y el nivel del mar.
 * La escena solo dibuja: los números vienen de sistema.js (que los toma de cada simulador).
 */
import { EscenaBase, THREE, materialAgua, caja, nube, FlujoCurva, Lluvia, azar, reiniciarAzar, suave, ruidoSuave } from './nucleo/escena-base.js';
import * as C from './cadena.js';
import { fmt, miles, conSigno } from './nucleo/formato.js';

const V = 4;                                   // exageración vertical del nivel del mar y de la ciénaga
const CIE = { x: -110, z: -15, A: 62, B: 38 }; // la ciénaga (elipse)
const LAGUNA = { x: 160, z: 172, r: 9 };
const LAGO = { x: 105, z: 125, r: 20 };
const BOCA_DELTA = [-230, -100];
const limitar01 = (v) => Math.min(1, Math.max(0, v));

/** Línea de la costa: z de la orilla para cada x (el mar queda al norte, con z menor). */
function zCosta(x) {
  return -60 + 6 * Math.sin(x / 45)
    - 34 * Math.exp(-(((x + 230) / 42) ** 2))         // lóbulo del delta
    + 20 * Math.exp(-(((x - 125) / 26) ** 2))         // bahía de la playa
    - 14 * Math.exp(-(((x - 80) / 13) ** 2))          // puntas de la bahía
    - 16 * Math.exp(-(((x - 172) / 15) ** 2));
}

/** Forma de la orilla de la ciénaga: radio relativo según el ángulo. */
const formaCienaga = (a) => 1 + 0.07 * Math.sin(3 * a + 0.5) + 0.05 * Math.sin(5 * a + 2) + 0.03 * Math.sin(7 * a + 1);
/** Distancia relativa al centro de la ciénaga (1 en la orilla). */
function rhoCienaga(x, z) {
  const u = (x - CIE.x) / CIE.A, v = (z - CIE.z) / CIE.B;
  return Math.hypot(u, v) / formaCienaga(Math.atan2(v, u));
}

/** Distancia de (x, z) a una polilínea [[x, z]…] y posición t (0 a 1) del punto más cercano. */
function distParam(x, z, pts) {
  let mejor = Infinity, tMejor = 0, acum = 0;
  const largos = [];
  let total = 0;
  for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); largos.push(l); total += l; }
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < mejor) { mejor = d; tMejor = (acum + t * largos[k]) / total; }
    acum += largos[k];
  }
  return [mejor, tMejor];
}

/** Puntos de una curva suave (Catmull-Rom) por una polilínea [[x, z]…]. */
function suavizar(pts, n = 60) {
  const curva = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return curva.getSpacedPoints(n).map((v) => [v.x, v.z]);
}

/** Cinta de agua a lo largo de una polilínea: dos vértices por punto. */
function cinta(pts, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length * 6), 3));
  const idx = [];
  for (let k = 0; k < pts.length - 1; k++) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, material);
  m.userData.pts = pts;
  m.receiveShadow = true;
  return m;
}
function moverCinta(m, y, w) {
  const { pts } = m.userData;
  const pos = m.geometry.attributes.position;
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l, nz = tx / l;
    const t = k / (n - 1);
    const yy = y(t), ww = typeof w === 'function' ? w(t) : w;
    pos.setXYZ(2 * k, pts[k][0] + nx * ww, yy, pts[k][1] + nz * ww);
    pos.setXYZ(2 * k + 1, pts[k][0] - nx * ww, yy, pts[k][1] - nz * ww);
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
  m.geometry.computeBoundingSphere();
}

/** Abanico (pluma) con transparencia por vértice que se apaga hacia afuera. */
function abanico(color, abertura = Math.PI) {
  const nR = 14, nA = 28;
  const pos = new Float32Array((nR + 1) * (nA + 1) * 3);
  const col = new Float32Array((nR + 1) * (nA + 1) * 4);
  const idx = [];
  const c = new THREE.Color(color);
  for (let i = 0; i <= nR; i++) {
    for (let j = 0; j <= nA; j++) {
      const k = i * (nA + 1) + j;
      const a = -abertura / 2 + (abertura * j) / nA;
      pos[3 * k] = (i / nR) * Math.sin(a);
      pos[3 * k + 2] = -(i / nR) * Math.cos(a);
      const borde = Math.sin((Math.PI * j) / nA);
      col.set([c.r, c.g, c.b, 0.72 * (1 - (i / nR) ** 1.4) * borde ** 0.6], 4 * k);
      if (i < nR && j < nA) idx.push(k, k + 1, k + nA + 1, k + 1, k + nA + 2, k + nA + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  m.renderOrder = 3;
  return m;
}

// ── Trazados (x, z) ─────────────────────────────────────────────────────────
const RIO_SIERRA = suavizar([[86, 114], [66, 98], [44, 78], [20, 54], [-4, 32], [-27, 12], [-50, -6]], 70);
const ARROYO = suavizar([[152, 166], [140, 156], [126, 144], [116, 135]], 24);
const RIO_GRANDE = suavizar([[-250, 330], [-262, 230], [-244, 140], [-256, 60], [-238, -10], [-234, -60], [-230, -100]], 90);
const CANOS = [suavizar([[-246, 20], [-212, 8], [-171, -6]], 20), suavizar([[-237, -32], [-204, -32], [-166, -30]], 20)];
const BOCA_BARRA = suavizar([[-64, -40], [-58, -53], [-55, -70]], 12);

const COLOR = {
  arena: new THREE.Color(0xdccca0), playa: new THREE.Color(0xe8dcb4), llanura: new THREE.Color(0x86a356), pantano: new THREE.Color(0x667a45),
  bosque: new THREE.Color(0x3f6f37), selva: new THREE.Color(0x4b7a3a), paramo: new THREE.Color(0xa7a467), roca: new THREE.Color(0x8d877d),
  nieve: new THREE.Color(0xf4f6f7), fondoMar: new THREE.Color(0xb9ad84), marHondo: new THREE.Color(0x52646a), lecho: new THREE.Color(0x6a5c42),
};
const AGUA = { dulce: new THREE.Color(0x5f8a5a), salobre: new THREE.Color(0x3d8f8c), marina: new THREE.Color(0x2b7fb1), turbia: new THREE.Color(0x9c7a4a), clara: new THREE.Color(0x2f86b8), verde: new THREE.Color(0x4c8a46) };

/** Cota del terreno sin los cuerpos de agua. */
function base(x, z) {
  const dc = z - zCosta(x);
  if (dc < 0) return -0.3 - Math.min(26, -dc * 0.12) + 0.3 * ruidoSuave(x, z, 18) * limitar01(-dc / 10);
  const tierra = suave(Math.min(dc, 12) / 12);   // playa baja que sube hacia la llanura
  const lejos = suave(Math.min(dc, 30) / 30);    // los cerros empiezan detrás de la playa
  let y = 0.25 + 0.6 * tierra + Math.min(dc, 80) * 0.01 + 0.5 * ruidoSuave(x, z, 26) * tierra;
  // Sierra Nevada: macizo con crestas y una estribación hacia la costa
  const s1 = Math.exp(-(((x - 185) / 88) ** 2 + ((z - 150) / 82) ** 2));
  const cresta = 1 - Math.abs(2 * ruidoSuave(x + 31, z - 17, 17) - 1);
  y += lejos * 108 * s1 ** 1.45 * (0.78 + 0.38 * cresta);
  y += lejos * 26 * Math.exp(-(((x - 125) / 58) ** 2 + ((z - 62) / 50) ** 2)) * (0.7 + 0.45 * ruidoSuave(x, z, 11));
  y += lejos * 22 * Math.exp(-(((x - 140) / 40) ** 2 + ((z - 5) / 34) ** 2)) * (0.8 + 0.3 * ruidoSuave(x, z, 12));   // cerros de la bahía
  y += 10 * Math.exp(-(((x - 172) / 12) ** 2 + ((z + 62) / 14) ** 2)) + 8 * Math.exp(-(((x - 80) / 11) ** 2 + ((z + 66) / 12) ** 2));
  return y;
}

// Cotas del lago y de la laguna (las del terreno en su centro) y la cumbre del glaciar
const COTA_LAGO = base(LAGO.x, LAGO.z) - 0.5;
const COTA_LAGUNA = base(LAGUNA.x, LAGUNA.z) - 0.5;
const CUMBRE = (() => {
  let m = { x: 185, z: 150, y: -Infinity };
  for (let x = 140; x <= 230; x += 2) for (let z = 110; z <= 195; z += 2) { const y = base(x, z); if (y > m.y) m = { x, z, y }; }
  return m;
})();
/** Terreno con la ciénaga, el delta y las terrazas del lago y la laguna (sin los cauces). */
function alturaSinCauces(x, z) {
  let y = base(x, z);
  const dc = z - zCosta(x);
  // Ciénaga y su barra de arena
  const rho = rhoCienaga(x, z);
  if (rho < 1) y = -1.8 * (1 - rho * rho) - 0.15;
  else if (rho < 1.25 && dc > 0) y = Math.min(y, 0.5 + 2.5 * (rho - 1));
  // Delta: llanura baja alrededor de la boca
  const dDelta = Math.hypot((x + 232) / 55, (z + 50) / 75);
  if (dc > 0 && dDelta < 1) y = Math.min(y, 0.45 + 0.6 * dDelta);
  // Lago y laguna: cubeta y una terraza que se funde con la ladera
  for (const [L, cota, R] of [[LAGO, COTA_LAGO, 30], [LAGUNA, COTA_LAGUNA, 20]]) {
    const d = Math.hypot(x - L.x, z - L.z);
    if (d < L.r) y = cota - 3.2 * (1 - (d / L.r) ** 2) - 0.3;
    else if (d < L.r + R) y = cota + 0.8 + (y - cota - 0.8) * suave((d - L.r) / R);
  }
  return y;
}

/**
 * Perfil de la superficie del agua a lo largo de un cauce: baja siempre (nunca sube) y va
 * por debajo del terreno, desde la cota de la fuente hasta la de llegada.
 */
function perfil(pts, inicio, final) {
  const n = pts.length;
  const ws = new Float32Array(n);
  let prev = inicio;
  for (let k = 0; k < n; k++) {
    prev = Math.max(final, Math.min(prev - 0.03, alturaSinCauces(pts[k][0], pts[k][1]) - 0.5));
    ws[k] = prev;
  }
  for (let r = 0; r < 3; r++) for (let k = 1; k < n - 1; k++) ws[k] = Math.min(ws[k - 1], (ws[k - 1] + ws[k] + ws[k + 1]) / 3);
  return (t) => {
    const u = Math.min(n - 1, Math.max(0, t * (n - 1)));
    const k = Math.min(n - 2, Math.floor(u));
    return ws[k] + (ws[k + 1] - ws[k]) * (u - k);
  };
}
const aguaSierra = perfil(RIO_SIERRA, COTA_LAGO - 0.3, 0.12);
const aguaArroyo = perfil(ARROYO, COTA_LAGUNA - 0.3, COTA_LAGO + 0.05);

function altura(x, z) {
  let y = alturaSinCauces(x, z);
  // Cauces: el río de la Sierra, el arroyo de la laguna, el río grande, los caños y la boca
  const cauce = (pts, lecho, w, talud) => {
    const [d, t] = distParam(x, z, pts);
    if (d < w + talud) {
      const fondo = lecho(t);
      y = Math.min(y, d < w ? fondo : fondo + (y - fondo) * suave((d - w) / talud));
    }
  };
  if (x > -60 && z > -20 && x < 105) cauce(RIO_SIERRA, (t) => aguaSierra(t) - 1.1, 2.6, 12);
  if (x > 100 && x < 170 && z > 120) cauce(ARROYO, (t) => aguaArroyo(t) - 0.8, 1.4, 8);
  if (x < -200) cauce(RIO_GRANDE, (t) => -1.6 - 0.6 * t, 7, 6);
  if (x < -150 && x > -255 && z > -45 && z < 30) for (const c of CANOS) cauce(c, () => -0.9, 2.2, 3);
  if (x > -75 && x < -45 && z < -30) cauce(BOCA_BARRA, () => -1.2, 3.2, 3);
  return y;
}

function colorTerreno(c, x, z, y) {
  const dc = z - zCosta(x);
  if (dc < 0 || y < -0.3) {
    c.copy(COLOR.fondoMar).lerp(COLOR.marHondo, limitar01(-y / 18));
    return;
  }
  if (dc < 4 && y < 2.5) { c.copy(COLOR.playa); return; }
  if (y < 1.6) {
    c.copy(rhoCienaga(x, z) < 1.4 || x < -190 ? COLOR.pantano : COLOR.llanura);
    return;
  }
  if (y < 30) { c.copy(COLOR.llanura).lerp(COLOR.selva, limitar01((y - 2) / 14)); return; }
  if (y < 58) { c.copy(COLOR.bosque).lerp(COLOR.paramo, limitar01((y - 46) / 12)); return; }
  if (y < 86) { c.copy(COLOR.paramo).lerp(COLOR.roca, limitar01((y - 72) / 12)); return; }
  c.copy(COLOR.roca).lerp(COLOR.nieve, limitar01((y - 98) / 6));
}

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xd5e6ec;
    this.niebla = [700, 1700];
    this.pestanaVista = { red: 'red', caudal: 'sierra', calidad: 'costa', sedimento: 'costa', mar: 'mar', clima: 'red' };
    this.Hs = 1.4;
    this.nivelMar = 0;
    this.ult = {};
  }

  vistasDefs() {
    return {
      red: { pos: [10, 500, 420], mira: [-25, 0, -25], etiquetas: ['laguna', 'lago', 'rio', 'cienaga', 'delta', 'playa', 'mar', 'clima'] },
      sierra: { pos: [-60, 215, 400], mira: [120, 45, 125], etiquetas: ['laguna', 'lago', 'rio', 'glaciar', 'clima'] },
      costa: { pos: [-70, 165, 165], mira: [-150, 0, -40], etiquetas: ['cienaga', 'delta', 'canos', 'boca', 'rio', 'mar'] },
      mar: { pos: [215, 85, -235], mira: [100, 6, -40], etiquetas: ['mar', 'playa', 'boca', 'cienaga'] },
    };
  }

  etiquetasDefs() {
    return [
      ['laguna', 'caudal', 'Laguna del páramo'],
      ['glaciar', 'clima', 'Glaciar', 'secundaria'],
      ['lago', 'caudal', 'Lago andino'],
      ['rio', 'caudal', 'Río de la Sierra'],
      ['cienaga', 'calidad', 'Ciénaga Grande'],
      ['canos', 'calidad', 'Caños del río grande', 'secundaria'],
      ['boca', 'red', 'Boca de la Barra', 'secundaria'],
      ['delta', 'sedimento', 'Delta del río grande'],
      ['playa', 'sedimento', 'Playa de la bahía'],
      ['mar', 'mar', 'Mar Caribe'],
      ['clima', 'clima', 'Clima del año'],
    ];
  }

  centrosEtiquetas() { return { laguna: [0.5, 1], lago: [0.5, 1], glaciar: [0.5, 1], rio: [0.5, 1], delta: [0.5, 1], playa: [0.5, 1], clima: [0.5, 1] }; }

  construir() {
    reiniciarAzar(2026);
    // Terreno
    const g = this.grupo('red');
    this.suelo = this.terreno({ x0: -420, x1: 420, z0: -330, z1: 330, nx: 210, nz: 165, altura, color: colorTerreno });
    g.add(this.suelo);

    // Mar con oleaje (los vértices sobre la tierra se esconden bajo el terreno)
    const gm = this.grupo('mar');
    const geoMar = new THREE.PlaneGeometry(1500, 900, 150, 90);
    geoMar.rotateX(-Math.PI / 2);
    geoMar.translate(0, 0, -300);
    this.matMar = materialAgua(AGUA.marina, { opacidad: 0.9, repetir: 40 });
    this.mar = new THREE.Mesh(geoMar, this.matMar);
    this.mar.renderOrder = -1;
    const pm = geoMar.attributes.position;
    this.mascaraMar = new Float32Array(pm.count);
    for (let i = 0; i < pm.count; i++) {
      const x = pm.getX(i), z = pm.getZ(i);
      const dc = z - zCosta(x);
      const enCienaga = rhoCienaga(x, z) < 1.3;
      this.mascaraMar[i] = dc < 1.5 && !enCienaga ? limitar01((-dc + 1.5) / 25) : -1;
    }
    gm.add(this.mar);
    this.indexar(gm);

    // Ciénaga
    const gc = this.grupo('calidad');
    const geoC = new THREE.CircleGeometry(1, 120);
    geoC.rotateX(-Math.PI / 2);
    const pc = geoC.attributes.position;
    for (let i = 0; i < pc.count; i++) {
      const x = pc.getX(i), z = pc.getZ(i);
      const f = formaCienaga(Math.atan2(z, x)) * 1.01;
      pc.setXYZ(i, x * f, 0, z * f);
    }
    this.matCienaga = materialAgua(AGUA.salobre, { opacidad: 0.88, repetir: 10 });
    this.cienaga = new THREE.Mesh(geoC, this.matCienaga);
    this.cienaga.scale.set(CIE.A, 1, CIE.B);
    this.cienaga.position.set(CIE.x, 0.05, CIE.z);
    gc.add(this.cienaga);
    // Manglar alrededor de la ciénaga y en el delta
    const nM = 420;
    const geoMangle = new THREE.ConeGeometry(1.4, 3.2, 6);
    geoMangle.translate(0, 1.6, 0);
    this.manglar = new THREE.InstancedMesh(geoMangle, new THREE.MeshStandardMaterial({ color: 0x2f6a35, flatShading: true }), nM);
    const mm = new THREE.Matrix4();
    for (let k = 0; k < nM; k++) {
      let x, z;
      if (k < 300) {
        const a = azar() * Math.PI * 2, rr = (1.03 + 0.14 * azar()) * formaCienaga(a);
        x = CIE.x + CIE.A * rr * Math.cos(a); z = CIE.z + CIE.B * rr * Math.sin(a);
      } else {
        x = -232 + (azar() - 0.5) * 70; z = -70 + (azar() - 0.5) * 60;
        if (distParam(x, z, RIO_GRANDE)[0] < 10) { x += 22; }
      }
      const s = 0.7 + 0.6 * azar();
      mm.compose(new THREE.Vector3(x, Math.max(0.4, altura(x, z)), z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      this.manglar.setMatrixAt(k, mm);
    }
    this.manglar.castShadow = true;
    gc.add(this.manglar);
    this.indexar(gc);

    // Lago y laguna
    const gs = this.grupo('caudal');
    const disco = (L, cota, color) => {
      const geo = new THREE.CircleGeometry(L.r + 0.6, 48);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, materialAgua(color, { opacidad: 0.92, repetir: 3 }));
      m.position.set(L.x, cota + 0.05, L.z);
      return m;
    };
    this.lago = disco(LAGO, COTA_LAGO, AGUA.clara);
    this.laguna = disco(LAGUNA, COTA_LAGUNA, 0x3c7fa8);
    gs.add(this.lago, this.laguna);
    // Glaciar sobre la cumbre
    const geoG = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    geoG.scale(17, 6, 14);
    this.glaciar = new THREE.Mesh(geoG, new THREE.MeshStandardMaterial({ color: 0xf2f7f9, roughness: 0.55, flatShading: true }));
    this.glaciar.position.set(CUMBRE.x, CUMBRE.y - 3, CUMBRE.z);
    gs.add(this.glaciar);
    // Ríos (cintas) y partículas
    const matDulce = materialAgua(0x3f86ad, { opacidad: 0.92, repetir: 6 });
    this.cintaSierra = cinta(RIO_SIERRA, matDulce);
    this.cintaArroyo = cinta(ARROYO, matDulce);
    gs.add(this.cintaSierra, this.cintaArroyo);
    this.flujoSierra = new FlujoCurva(gs, 160, RIO_SIERRA.map(([x, z], k) => [x, aguaSierra(k / (RIO_SIERRA.length - 1)) + 0.1, z]), { color: 0xe6f6fc, tamano: 1.1, ancho: 2, alto: 0.25 });
    this.flujoArroyo = new FlujoCurva(gs, 50, ARROYO.map(([x, z], k) => [x, aguaArroyo(k / (ARROYO.length - 1)) + 0.1, z]), { color: 0xe6f6fc, tamano: 0.9, ancho: 0.8, alto: 0.2 });
    this.indexar(gs);

    // Río grande, caños, delta y pluma
    const gd = this.grupo('sedimento');
    const matGrande = materialAgua(0x8d7a52, { opacidad: 0.95, repetir: 10 });
    this.cintaGrande = cinta(RIO_GRANDE, matGrande);
    gd.add(this.cintaGrande);
    this.cintasCanos = CANOS.map((c) => { const m = cinta(c, materialAgua(0x7d7a55, { opacidad: 0.92, repetir: 2 })); gd.add(m); return m; });
    this.flujoGrande = new FlujoCurva(gd, 260, RIO_GRANDE.map(([x, z]) => [x, 0.5, z]), { color: 0xf1e2c2, tamano: 1.3, ancho: 6, alto: 0.3 });
    this.flujosCanos = CANOS.map((c) => new FlujoCurva(gd, 30, c.map(([x, z]) => [x, 0.4, z]), { color: 0xf1e2c2, tamano: 0.8, ancho: 1, alto: 0.2 }));
    this.pluma = abanico(0x7d6440, 2.2);
    this.pluma.position.set(BOCA_DELTA[0], 0.35, BOCA_DELTA[1] + 2);
    gd.add(this.pluma);
    // Tajamares de Bocas de Ceniza
    for (const lado of [-1, 1]) {
      const t = caja(1.6, 1.4, 26, 0x8f8a80);
      t.position.set(BOCA_DELTA[0] + lado * 9, 0.6, BOCA_DELTA[1] + 6);
      gd.add(t);
    }
    // Ciudad junto al delta
    for (let k = 0; k < 26; k++) {
      const h = 2 + azar() * 7;
      const b = caja(3 + azar() * 3, h, 3 + azar() * 3, [0xe3ddd0, 0xd8cdbb, 0xc9c2b4][k % 3]);
      b.position.set(-275 - azar() * 40, h / 2 + 0.6, -55 + azar() * 60);
      gd.add(b);
    }
    this.indexar(gd);

    // Boca de la Barra y su pluma
    const gb = this.grupo('red');
    this.cintaBoca = cinta(BOCA_BARRA, materialAgua(AGUA.salobre, { opacidad: 0.9, repetir: 2 }));
    gb.add(this.cintaBoca);
    this.flujoBoca = new FlujoCurva(gb, 40, BOCA_BARRA.map(([x, z]) => [x, 0.4, z]), { color: 0xdff3f0, tamano: 0.9, ancho: 1.6, alto: 0.2 });
    this.plumaBoca = abanico(0x6f8f6a, 2.0);
    this.plumaBoca.position.set(-55, 0.3, -72);
    gb.add(this.plumaBoca);

    // Playa, ciudad de la bahía y espuma
    const gp = this.grupo('sedimento');
    for (let k = 0; k < 34; k++) {
      const h = 1.5 + azar() * 6;
      const x = 103 + azar() * 46;
      const zc = zCosta(x);
      const b = caja(2.5 + azar() * 2.5, h, 2.5 + azar() * 2.5, [0xf0ebe0, 0xe2d6c2, 0xd9cfbd][k % 3]);
      b.position.set(x, altura(x, zc + 10) + h / 2, zc + 9 + azar() * 22);
      gp.add(b);
    }
    const ptsPlaya = Array.from({ length: 40 }, (_, k) => { const x = 92 + (k / 39) * 70; return [x, zCosta(x) - 1.5]; });
    this.espuma = cinta(ptsPlaya, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.espuma.renderOrder = 2;
    this.ptsPlaya = ptsPlaya;
    gp.add(this.espuma);
    this.indexar(gp);

    // Barco y boya
    const gmar = this.grupo('mar');
    this.barco = new THREE.Group();
    const casco = caja(16, 3, 4.5, 0x8a3b2b);
    casco.position.y = 1.2;
    const puente = caja(4, 3, 3.6, 0xf0f0ea);
    puente.position.set(-4.5, 4, 0);
    const carga = caja(8, 2.2, 3.8, 0x2f6f9a);
    carga.position.set(2.5, 3.5, 0);
    this.barco.add(casco, puente, carga);
    this.barco.position.set(-140, 0, -185);
    this.barco.rotation.y = 0.4;
    gmar.add(this.barco);
    this.boya = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0xe8b13b, flatShading: true }));
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    torre.position.y = 3;
    this.boya.add(cuerpo, torre);
    this.boya.position.set(120, 0, -140);
    gmar.add(this.boya);
    this.indexar(gmar);

    // Nubes y lluvia sobre la Sierra
    this.nubes = [];
    for (let k = 0; k < 8; k++) {
      const n = nube(3.2 + azar() * 2.4, 0xffffff, 0.88);
      n.position.set(60 + azar() * 230, 150 + azar() * 25, 60 + azar() * 170);
      this.scene.add(n);
      this.nubes.push(n);
    }
    this.lluvia = new Lluvia(this.scene, 1500, { x0: 40, x1: 280, z0: 60, z1: 230, y0: 5, y1: 150 });
  }

  aplicar(p, r) {
    if (!r?.cad) return;
    const { hoy, ind, cad } = r;
    const n = cad.nodos;
    // Nivel del mar del horizonte (exagerado) y de la ciénaga
    this.nivelMar = V * (ind.oceano.nivel || 0);
    this.cienaga.position.y = 0.05 + V * (hoy.cienagas.nivel ?? 0) + Math.max(0, this.nivelMar * 0.8);
    // Color de la ciénaga con la sal
    const S = hoy.cienagas.salinidad ?? 20;
    const cC = new THREE.Color();
    if (S < 18) cC.copy(AGUA.dulce).lerp(AGUA.salobre, limitar01(S / 18));
    else cC.copy(AGUA.salobre).lerp(AGUA.marina, limitar01((S - 18) / 18));
    this.matCienaga.color.copy(cC);
    // El lago se enverdece con el fósforo
    this.lago.material.color.copy(AGUA.clara).lerp(AGUA.verde, limitar01(((ind.lago.P || 10) - 10) / 30));
    // Glaciar: se encoge con el horizonte
    const g0 = C.HORIZONTES[p.horizonte]?.lagunas?.anosFuturo ?? 0;
    const fG = Math.max(0.05, Math.exp(-g0 / 45));
    this.glaciar.scale.set(fG ** 0.5, fG ** 0.4, fG ** 0.5);
    // Caudales del día: anchos de los ríos y rapidez de las partículas
    const ancho = (Q, a, b) => a * Math.max(0.25, Q / b) ** 0.4;
    const Qs = hoy.rios.Q ?? 7, Qa = hoy.lagunas.Q ?? 0.1, Qg = hoy.deltas.Q ?? 6800, Qci = hoy.cienagas.Q ?? 250;
    const clave = [Qs, Qa, Qg, Qci].map((x) => x.toFixed(2)).join('|');
    if (this.ult.clave !== clave) {
      this.ult.clave = clave;
      moverCinta(this.cintaSierra, (t) => aguaSierra(t), (t) => ancho(Qs, 1.6 + 1.6 * t, 7.8));
      moverCinta(this.cintaArroyo, (t) => aguaArroyo(t), ancho(Qa, 0.8, 0.11));
      moverCinta(this.cintaGrande, () => 0.3, ancho(Qg, 6.5, 6800));
      for (const m of this.cintasCanos) moverCinta(m, () => 0.25, 1.4);
      moverCinta(this.cintaBoca, () => 0.25, 2.6);
    }
    this.flujoSierra.velocidad = 6 + 4 * Math.log10(Math.max(1, Qs));
    this.flujoArroyo.velocidad = 2 + 30 * Qa;
    this.flujoGrande.velocidad = 8 + 3 * Math.log10(Qg / 1000 + 1);
    for (const f of this.flujosCanos) f.velocidad = 3;
    this.flujoBoca.velocidad = 3 + Qci / 100;
    // Plumas: crecen con el caudal y el sedimento
    const R = 26 + 45 * Math.sqrt(Qg / 6800) * (0.6 + 0.4 * limitar01((ind.delta.C || 600) / 800));
    this.pluma.scale.set(R, 1, R);
    this.pluma.position.y = 0.35 + this.nivelMar;
    const Rb = 10 + 12 * Math.sqrt(Qci / 250);
    this.plumaBoca.scale.set(Rb, 1, Rb);
    this.plumaBoca.position.y = 0.3 + this.nivelMar;
    // Oleaje de mar afuera y en la playa
    this.Hs = hoy.oceanos.Hs ?? ind.oceano.Hs ?? 1.4;
    this.Hplaya = hoy.costas.Hs ?? 1.1;
    // Lluvia y nubes con el mes y el clima
    const fQ = Qs / Math.max(0.1, ind.rio.Q || 7);
    const fClima = p.clima === 'nino' ? 0.55 : (p.clima === 'nina' ? 1.35 : 1);
    this.lluvia.visible = fQ > 1.15 && p.clima !== 'nino';
    this.lluvia.obj.material.opacity = limitar01(0.3 + 0.35 * (fQ - 1));
    this.nubes.forEach((nb, k) => { nb.visible = k < Math.round(3 + 5 * limitar01(fQ * fClima - 0.3)); });

    // Etiquetas
    const QL = n.lagunas.f.salida.Q;
    this.etiqueta('laguna', `${fmt(1000 * (hoy.lagunas.Q ?? QL), 0)} L/s hoy · τ ${fmt(ind.laguna.tauDias, 0)} días`, n.lagunas.revision.fallas.length ? 'aviso' : 'ok', [LAGUNA.x, COTA_LAGUNA + 6, LAGUNA.z]);
    this.etiqueta('glaciar', `${fmt(1000 * (ind.laguna.glaciar || 0), 1)} L/s de deshielo`, 'ok', [CUMBRE.x, CUMBRE.y + 6, CUMBRE.z]);
    this.etiqueta('lago', `${fmt(hoy.lagos.Q, 2)} m³/s hoy · τ ${fmt(ind.lago.tauAnos, 0)} años`, ind.lago.secos.length ? 'alerta' : 'ok', [LAGO.x, COTA_LAGO + 7, LAGO.z]);
    this.etiqueta('rio', `${fmt(Qs, 2)} m³/s hoy`, ind.rio.sinCaptar.length ? 'alerta' : 'ok', [RIO_SIERRA[44][0], aguaSierra(44 / 70) + 7, RIO_SIERRA[44][1]]);
    this.etiqueta('cienaga', `${fmt(S, 1)} PSU · sale ${fmt(Qci, 0)} m³/s`, S <= 40 ? 'ok' : 'alerta', [CIE.x, 5, CIE.z]);
    this.etiqueta('canos', Number.isFinite(ind.cienaga.QcOut) ? `entran ${fmt(ind.cienaga.QcIn, 0)} · vuelven al río ${fmt(ind.cienaga.QcOut, 1)} m³/s` : `${fmt(ind.cienaga.Qc, 0)} m³/s en el año`, 'ok', [-205, 3, 8]);
    this.etiqueta('boca', `al mar: ${fmt(Qci, 0)} m³/s`, 'ok', [-52, 3, -68]);
    this.etiqueta('delta', `${miles(Qg)} m³/s · ${fmt(ind.delta.C, 0)} mg/L`, 'ok', [BOCA_DELTA[0], 8, BOCA_DELTA[1] + 22]);
    this.etiqueta('playa', Number.isFinite(ind.playa.dW) ? `H ${fmt(this.Hplaya, 2)} m · ${conSigno(ind.playa.dW, 2)} m/año` : `H ${fmt(this.Hplaya, 2)} m`, !Number.isFinite(ind.playa.dW) || ind.playa.dW >= 0 ? 'ok' : 'alerta', [128, 7, zCosta(128) + 4]);
    this.etiqueta('mar', `H_s ${fmt(this.Hs, 2)} m · nivel ${conSigno(100 * (ind.oceano.nivel || 0), 0)} cm`, 'ok', [130, 6, -130]);
    this.etiqueta('clima', `${C.CLIMAS[p.clima]?.nombre ?? ''} · ${C.HORIZONTES[p.horizonte]?.ano ?? 2026}`, p.clima === 'normal' ? 'ok' : 'aviso', [CUMBRE.x - 40, CUMBRE.y + 26, CUMBRE.z - 20]);
  }

  paso(dt, t) {
    // Oleaje: tres trenes de ondas con la altura del día
    const pos = this.mar.geometry.attributes.position;
    const A = 0.45 * this.Hs;
    for (let i = 0; i < pos.count; i++) {
      const m = this.mascaraMar[i];
      if (m < 0) { pos.setY(i, -6); continue; }
      const x = pos.getX(i), z = pos.getZ(i);
      const w = Math.sin(0.06 * x + 0.11 * z + 1.3 * t) + 0.6 * Math.sin(0.09 * x - 0.05 * z + 1.9 * t) + 0.35 * Math.sin(0.15 * z + 2.6 * t);
      pos.setY(i, this.nivelMar + A * (0.25 + 0.75 * m) * w * 0.5);
    }
    pos.needsUpdate = true;
    this.mar.geometry.computeVertexNormals();
    this.matMar.map.offset.set((t * 0.004) % 1, (t * 0.011) % 1);
    this.matCienaga.map.offset.set((t * 0.003) % 1, 0);
    // Espuma de la rompiente: avanza y retrocede con el oleaje de la playa
    const f = 0.5 + 0.5 * Math.sin(1.6 * t);
    moverCinta(this.espuma, () => this.nivelMar + 0.35, 0.6 + 0.9 * this.Hplaya * f);
    this.espuma.material.opacity = 0.35 + 0.45 * f;
    // Partículas, barco, boya, nubes y lluvia
    this.flujoSierra.paso(dt);
    this.flujoArroyo.paso(dt);
    this.flujoGrande.paso(dt);
    for (const fc of this.flujosCanos) fc.paso(dt);
    this.flujoBoca.paso(dt);
    this.barco.position.x = -140 + ((t * 2.2) % 300);
    this.barco.position.y = this.nivelMar + 0.25 * this.Hs * Math.sin(1.1 * t);
    this.barco.rotation.z = 0.03 * this.Hs * Math.sin(0.9 * t);
    this.boya.position.y = this.nivelMar + 0.35 * this.Hs * Math.sin(1.5 * t + 1);
    for (const [k, nb] of this.nubes.entries()) nb.position.x = 50 + ((nb.position.x - 50 + dt * (1.5 + 0.2 * k)) % 260);
    this.lluvia.paso(dt);
  }
}
