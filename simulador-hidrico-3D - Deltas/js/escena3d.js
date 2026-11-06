/**
 * escena3d.js — El delta en 3D (Three.js).
 * El río grande baja del sur, se reparte con el Canal del Dique y sale al mar entre dos
 * tajamares; en la orilla occidental están la ciudad y el puerto con sus grúas y buques, y la
 * bocatoma del acueducto; al oriente, la llanura del delta con su manglar y la ciénaga costera.
 * La pluma café se abre mar adentro y las olas llegan en ángulo a la costa. En la vista Corte
 * la mitad oriental se recorta como una maqueta y se ve, a lo largo del canal, la cuña salina
 * metida por debajo del agua del río. La escena solo dibuja: los números vienen de sistema.js.
 */
import { EscenaBase, THREE, materialAgua, texturaAgua, caja, cilindro, casa, bote, nube, FlujoCurva, azar, reiniciarAzar, suave, mezclar, ruidoSuave, rotulo } from './nucleo/escena-base.js';
import * as S from './sistema.js';
import { fmt, miles, conSigno } from './nucleo/formato.js';

const ESC = 120;                 // metros por unidad horizontal
const Z_PUNTA = -92;             // punta de los tajamares
const Z_COSTA = -60;             // costa al lado de la boca (sin el lóbulo)
const W_RIO = 9, W_CANAL = 4;    // medio ancho del río y del canal entre los tajamares (exagerados)
const limitar01 = (v) => Math.min(1, Math.max(0, v));
const XR = (z) => (z < 100 ? 0 : 26 * Math.sin((z - 100) / 70));   // eje del río

const COLOR = {
  llanura: new THREE.Color(0x8aa257), manglar: new THREE.Color(0x4d7a3f), ciudad: new THREE.Color(0xb9b2a2),
  arena: new THREE.Color(0xdccba0), fondoMar: new THREE.Color(0xc4b78c), marHondo: new THREE.Color(0x5f7275),
  cauce: new THREE.Color(0x6b5b40), cienaga: new THREE.Color(0x5b6a46),
};

function distPolilinea(x, z, pts) {
  let mejor = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    mejor = Math.min(mejor, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return mejor;
}

/** Cinta de agua a lo largo de una polilínea [[x, z], ...]. */
function cinta(pts, material) {
  const n = pts.length;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * n), 3));
  const uv = [], idx = [];
  let largo = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) largo += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    uv.push(0, largo / 25, 1, largo / 25);
    if (k < n - 1) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.userData.pts = pts;
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
    const t = k / (n - 1);
    const ww = w(t);
    pos.setXYZ(2 * k, pts[k][0] - (tz / l) * ww, y(t), pts[k][1] + (tx / l) * ww);
    pos.setXYZ(2 * k + 1, pts[k][0] + (tz / l) * ww, y(t), pts[k][1] - (tx / l) * ww);
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
  m.geometry.computeBoundingSphere();
}

/** Textura de degradado radial (para la pluma). */
function texturaDegradado() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xd3e4ea;
    this.niebla = [560, 1400];
    this.pestanaVista = { rio: 'general', canales: 'dique', cuna: 'corte', pluma: 'general', avance: 'general', oleaje: 'boca', dragado: 'boca' };
    this.lobulo = 6;
    this.ult = {};
  }

  vistasDefs() {
    return {
      general: { pos: [150, 330, 300], mira: [-10, 0, -70], etiquetas: ['rio', 'pluma', 'delta', 'oleaje', 'canal', 'dique', 'cienaga', 'ciudad'] },
      boca: { pos: [95, 62, -10], mira: [-5, 0, -85], etiquetas: ['canal', 'puerto', 'oleaje', 'pluma', 'toma'] },
      corte: { pos: [96, 9, -42], mira: [0, -6, -64], etiquetas: ['cuna', 'toma'] },
      dique: { pos: [70, 210, 420], mira: [-60, 0, 230], etiquetas: ['dique', 'rio', 'avulsion'] },
    };
  }

  etiquetasDefs() {
    return [
      ['rio', 'rio', 'Río Magdalena'],
      ['dique', 'canales', 'Canal del Dique'],
      ['avulsion', 'canales', 'Cauce sobre la llanura', 'secundaria'],
      ['cuna', 'cuna', 'Cuña salina'],
      ['toma', 'cuna', 'Bocatoma del acueducto'],
      ['pluma', 'pluma', 'Pluma del río'],
      ['delta', 'avance', 'Frente del delta'],
      ['oleaje', 'oleaje', 'Oleaje'],
      ['canal', 'dragado', 'Canal de acceso'],
      ['puerto', 'dragado', 'Puerto', 'secundaria'],
      ['cienaga', 'pluma', 'Ciénaga Grande', 'secundaria'],
      ['ciudad', '', 'Barranquilla', 'secundaria'],
    ];
  }

  centrosEtiquetas() { return { rio: [0.5, 1], dique: [0.5, 1], toma: [0, 0.5], cuna: [0.5, 1], ciudad: [0.5, 1] }; }

  /** Costa con el lóbulo del delta alrededor de la boca. */
  costa(x) { return Z_COSTA - this.lobulo * Math.exp(-(x * x) / (2 * 40 * 40)); }

  trazados() {
    this.ptsRio = [];
    for (let z = 330; z >= Z_PUNTA; z -= 6) this.ptsRio.push([XR(z), z]);
    if (this.ptsRio[this.ptsRio.length - 1][1] !== Z_PUNTA) this.ptsRio.push([0, Z_PUNTA]);
    this.ptsDique = [[XR(205), 205], [-40, 222], [-110, 248], [-190, 282], [-270, 305], [-352, 322]];
    this.cienaga = { x: 255, z: 30, a: 85, b: 70 };
    this.ptsBocaCienaga = [[262, -35], [266, -60], [270, -80]];
  }

  altura(x, z) {
    const n1 = ruidoSuave(x + 400, z + 400, 28), n2 = ruidoSuave(x, z, 9);
    let y = 1.6 + 1.2 * (n1 - 0.5) + 0.4 * (n2 - 0.5);
    const u = this.ult;
    u.rio = Infinity; u.dique = Infinity; u.cie = Infinity; u.playa = false;
    // Ciudad sobre la orilla occidental (un poco más alta)
    if (x < -14 && x > -170 && z > -70 && z < 150) y += 1.6 * suave(limitar01((-14 - x) / 12));
    // Ciénaga al oriente
    const c = this.cienaga;
    const rc = Math.hypot((x - c.x) / c.a, (z - c.z) / c.b);
    u.cie = rc;
    if (rc < 1.15) y = mezclar(-1.6, y, suave(limitar01((rc - 0.85) / 0.3)));
    // Costa, playa y mar
    const zc = this.costa(x);
    if (z < zc + 7) {
      if (z >= zc) { y = mezclar(-0.8, y, suave((z - zc) / 7)); u.playa = true; }
      else { const d = zc - z; y = Math.max(-60, -0.8 - 0.22 * d - 0.0014 * d * d); }
    }
    // Río y canal entre los tajamares
    const dR = Math.abs(x - XR(z));
    u.rio = dR;
    if (z > Z_PUNTA - 4) {
      const enCanal = z < this.costa(0) + 4;
      const w = enCanal ? W_CANAL : W_RIO;
      const fondo = enCanal ? -12 : -9;
      if (dR < w) y = Math.min(y, fondo + 0.4 * n2);
      else if (dR < w + 5) y = Math.min(y, mezclar(fondo, y, suave((dR - w) / 5)));
    }
    // Canal del Dique
    const dD = distPolilinea(x, z, this.ptsDique);
    u.dique = dD;
    if (dD < 3) y = Math.min(y, -5);
    else if (dD < 6) y = Math.min(y, mezclar(-5, y, suave((dD - 3) / 3)));
    // Boca de la ciénaga
    const dB = distPolilinea(x, z, this.ptsBocaCienaga);
    if (dB < 3) y = Math.min(y, -2);
    return y;
  }

  colorTerreno(c, x, z, y) {
    const u = this.ult;
    if (u.rio < W_RIO + 0.5 && z > Z_PUNTA - 4 && y < -1) { c.copy(COLOR.cauce); return; }
    if (u.dique < 3.2 && y < -1) { c.copy(COLOR.cauce); return; }
    if (y < -0.6) { c.copy(COLOR.fondoMar).lerp(COLOR.marHondo, limitar01(-y / 35)); return; }
    if (u.playa || (y < 0.6 && z < this.costa(x) + 9)) { c.copy(COLOR.arena); return; }
    if (u.cie < 1.3) { c.copy(COLOR.manglar); return; }
    if (x < -14 && x > -170 && z > -70 && z < 150) { c.copy(COLOR.ciudad).lerp(COLOR.llanura, 0.25 * ruidoSuave(x, z, 6)); return; }
    if (x > 14 && x < 175 && z < 60) { c.copy(COLOR.manglar).lerp(COLOR.llanura, 0.35 + 0.3 * ruidoSuave(x, z, 14)); return; }
    c.copy(COLOR.llanura);
  }

  construir() {
    reiniciarAzar(1936);
    this.trazados();
    this.malla = this.terreno({ x0: -350, x1: 350, z0: -300, z1: 330, nx: 280, nz: 252, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.scene.add(this.malla);
    const sc = this.luzSol.shadow.camera;
    sc.left = -320; sc.right = 320; sc.top = 320; sc.bottom = -320; sc.far = 900;
    this.luzSol.position.set(160, 280, 160);
    sc.updateProjectionMatrix();
    this.planoCorte = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

    // Mar
    this.grupoMar = this.grupo('oleaje');
    this.matMar = materialAgua(0x1f6fa6, { opacidad: 0.9, repetir: 30 });
    this.mar = new THREE.Mesh(new THREE.PlaneGeometry(1400, 620), this.matMar);
    this.mar.rotation.x = -Math.PI / 2;
    this.mar.position.set(0, 0, -30 - 310);
    this.mar.renderOrder = -1;          // el agua se dibuja antes que las crestas y la pluma
    this.grupoMar.add(this.mar);
    this.indexar(this.grupoMar);

    // Río y Canal del Dique
    this.grupoRio = this.grupo('rio');
    this.matRio = materialAgua(0xae9560, { opacidad: 0.95, repetir: 1, textura: texturaAgua('#e9e2d2', 'rgba(255,255,255,0.75)') });
    this.matRio.map.repeat.set(1, 1);
    this.matRio.roughness = 0.16; this.matRio.metalness = 0.12;
    this.cintaRio = cinta(this.ptsRio, this.matRio);
    moverCinta(this.cintaRio, (t) => 0.5 - 0.35 * t, (t) => (this.ptsRio[Math.round(t * (this.ptsRio.length - 1))][1] < this.costa(0) + 4 ? W_CANAL : W_RIO) + 0.3);
    this.grupoRio.add(this.cintaRio);
    this.indexar(this.grupoRio);
    this.flujoRio = new FlujoCurva(this.scene, 700, this.ptsRio.map(([x, z], k) => [x, 0.6 - 0.35 * (k / (this.ptsRio.length - 1)), z]), { color: 0xfaf3e2, tamano: 1.3, ancho: 6, alto: 0.1 });
    this.grupoDique = this.grupo('canales');
    this.matDique = materialAgua(0xa8915f, { opacidad: 0.95, repetir: 1, textura: texturaAgua('#e9e2d2', 'rgba(255,255,255,0.75)') });
    this.matDique.map.repeat.set(1, 1);
    this.cintaDique = cinta(this.ptsDique, this.matDique);
    moverCinta(this.cintaDique, () => 0.55, () => 2.5);
    this.grupoDique.add(this.cintaDique);
    this.flujoDique = new FlujoCurva(this.scene, 160, this.ptsDique.map(([x, z]) => [x, 0.75, z]), { color: 0xfaf3e2, tamano: 1.0, ancho: 1.5, alto: 0.05 });
    this.compuerta = caja(9, 3.2, 1.6, 0x6d7378);
    const [dx0, dz0] = this.ptsDique[1];
    this.compuerta.position.set(dx0, 1.4, dz0);
    this.compuerta.rotation.y = Math.atan2(this.ptsDique[2][0] - dx0, this.ptsDique[2][1] - dz0);
    this.grupoDique.add(this.compuerta);
    this.indexar(this.grupoDique);

    // Ciénaga y su pluma pequeña
    this.grupoCienaga = this.grupo('pluma');
    const fc = new THREE.Shape();
    fc.absellipse(0, 0, this.cienaga.a, this.cienaga.b, 0, Math.PI * 2, false, 0);
    this.aguaCienaga = new THREE.Mesh(new THREE.ShapeGeometry(fc, 80), materialAgua(0x3f8a84, { opacidad: 0.9, repetir: 12 }));
    this.aguaCienaga.rotation.x = -Math.PI / 2;
    this.aguaCienaga.position.set(this.cienaga.x, 0.15, this.cienaga.z);
    this.grupoCienaga.add(this.aguaCienaga);
    this.indexar(this.grupoCienaga);

    this.armarTajamares();
    this.armarPluma();
    this.armarCiudad();
    this.armarManglar();
    this.armarOlas();
    this.armarCorte();
    this.armarFrente();
    for (const [x, y, z, e] of [[-280, 110, -240, 7], [-60, 120, -280, 6], [220, 105, -250, 7], [300, 130, 250, 6], [-300, 100, 200, 7]]) {
      const n = nube(e, 0xffffff, 0.92);
      n.position.set(x, y, z);
      this.scene.add(n);
    }
  }

  armarTajamares() {
    this.grupoCanal = this.grupo('dragado');
    const zTierra = this.costa(0) + 5;
    for (const s of [-1, 1]) {
      const t = caja(2.2, 3.4, zTierra - Z_PUNTA, 0x8f8b82);
      t.position.set(s * (W_CANAL + 1.4), 0.4, (zTierra + Z_PUNTA) / 2);
      this.grupoCanal.add(t);
      const faro = cilindro(0.7, 0.9, 5, s < 0 ? 0xd04a3a : 0x3c8a4a, { lados: 8 });
      faro.position.set(s * (W_CANAL + 1.4), 4.6, Z_PUNTA + 1.5);
      this.grupoCanal.add(faro);
    }
    // Draga
    this.draga = new THREE.Group();
    const casco = caja(3, 1.2, 8, 0xd8a13a);
    casco.position.y = 0.4;
    const cabina = caja(2.2, 1.6, 2.2, 0xf2f2f2);
    cabina.position.set(0, 1.8, 2);
    const brazo = cilindro(0.15, 0.15, 7, 0x444444, { lados: 6 });
    brazo.rotation.x = 1.0;
    brazo.position.set(0, 0.6, -5);
    this.draga.add(casco, cabina, brazo);
    this.draga.position.set(0, 0, -76);
    this.grupoCanal.add(this.draga);
    // Buques del puerto y el que entra
    this.grupoPuerto = this.grupo('dragado');
    this.buques = [];
    const buque = (color) => {
      const g = new THREE.Group();
      const c = caja(3.2, 2, 16, color);
      c.position.y = 0.6;
      const p = caja(2.8, 2.6, 3, 0xf2f2f2);
      p.position.set(0, 2.6, 5.5);
      g.add(c, p);
      for (let k = 0; k < 3; k++) { const cont = caja(2.6, 1, 2.6, [0xc0392b, 0x2e86c1, 0x27ae60][k]); cont.position.set(0, 2.1, -4 + k * 3.2); g.add(cont); }
      return g;
    };
    for (const [z, col] of [[-30, 0x2b3a55], [-5, 0x5a2d2d], [22, 0x2d4f3a]]) {
      const b = buque(col);
      b.position.set(-W_RIO - 3.5, 0, z);
      this.grupoPuerto.add(b);
      this.buques.push(b);
      const grua = new THREE.Group();
      const torre = caja(1, 9, 1, 0xe0a33a);
      torre.position.y = 4.5;
      const pluma = caja(1, 0.8, 9, 0xe0a33a);
      pluma.position.set(3.5, 8.6, 0);
      pluma.rotation.y = Math.PI / 2;
      grua.add(torre, pluma);
      grua.position.set(-W_RIO - 10, this.altura(-W_RIO - 10, z), z);
      this.grupoPuerto.add(grua);
    }
    this.buqueEntra = buque(0x34495e);
    this.grupoPuerto.add(this.buqueEntra);
    this.indexar(this.grupoCanal);
    this.indexar(this.grupoPuerto);
    // Bocatoma (se coloca en aplicar)
    this.grupoToma = this.grupo('cuna');
    this.toma = new THREE.Group();
    const edif = caja(7, 3.2, 5, 0x5d8aa8);
    edif.position.set(-6, 1.6, 0);
    const tubo = cilindro(0.5, 0.5, 6, 0x777777, { lados: 8 });
    tubo.rotation.z = Math.PI / 2;
    tubo.position.set(0.5, 0.6, 0);
    this.toma.add(edif, tubo);
    this.grupoToma.add(this.toma);
    this.indexar(this.grupoToma);
  }

  armarPluma() {
    this.grupoPluma = this.grupo('pluma');
    const tex = texturaDegradado();
    // Cinta de 60 tramos y 5 vértices de ancho: la transparencia de cada vértice sigue C(x)/C₀
    const n = 60;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 5 * (n + 1)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(4 * 5 * (n + 1)), 4));
    const idx = [];
    for (let k = 0; k < n; k++) for (let j = 0; j < 4; j++) { const a = 5 * k + j; idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
    g.setIndex(idx);
    this.pluma = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.pluma.renderOrder = 3;
    this.pluma.frustumCulled = false;
    this.nPluma = n;
    this.plumaCienaga = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0x6f8a62, map: tex, transparent: true, opacity: 0.7, depthWrite: false }));
    this.plumaCienaga.rotation.x = -Math.PI / 2;
    this.plumaCienaga.renderOrder = 3;
    this.grupoPluma.add(this.pluma, this.plumaCienaga);
  }

  armarCiudad() {
    this.grupoCiudad = this.grupo('');
    reiniciarAzar(1813);
    const colores = [0xe9e1d0, 0xd7e3e8, 0xf0d9a8, 0xcfd6d9, 0xe7c9b0];
    for (let k = 0; k < 150; k++) {
      const x = -26 - azar() * 140, z = -50 + azar() * 190;
      if (x > -22 && z < 40) continue;
      const alto = 2 + azar() * azar() * 14;
      const b = caja(4 + azar() * 3, alto, 4 + azar() * 3, colores[k % colores.length]);
      b.position.set(x, this.altura(x, z) + alto / 2, z);
      this.grupoCiudad.add(b);
    }
    // Pueblo pequeño en la orilla oriental
    for (let k = 0; k < 8; k++) {
      const x = 30 + azar() * 30, z = 60 + azar() * 40;
      const c = casa({ ancho: 3, fondo: 3.4, alto: 2.2 });
      c.position.set(x, this.altura(x, z), z);
      this.grupoCiudad.add(c);
    }
  }

  armarManglar() {
    this.grupoManglar = this.grupo('avance');
    reiniciarAzar(77);
    const pts = [];
    for (let k = 0; k < 900; k++) {
      const x = 16 + azar() * 330, z = -70 + azar() * 160;
      const y = this.altura(x, z);
      const rc = Math.hypot((x - this.cienaga.x) / this.cienaga.a, (z - this.cienaga.z) / this.cienaga.b);
      if (y < 0.3 || y > 3 || rc < 1.0 || this.ult.playa || Math.abs(x - XR(z)) < W_RIO + 6) continue;
      if (rc > 1.6 && azar() < 0.7) continue;
      pts.push([x, y, z, 1.2 + azar() * 1.1]);
    }
    const copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x3d6b38, roughness: 0.9, flatShading: true }), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach(([x, y, z, r], k) => { m4.makeScale(r, r * 0.6, r).setPosition(x, y + 1.6, z); copas.setMatrixAt(k, m4); });
    copas.castShadow = true;
    this.grupoManglar.add(copas);
    this.indexar(this.grupoManglar);
  }

  /** Crestas de las olas: tramos cortos (instancias) que avanzan hacia la costa y no entran a tierra. */
  armarOlas() {
    this.grupoOlas = this.grupo('oleaje');
    this.nCrestas = 10;
    this.nTramos = 46;
    const geo = new THREE.PlaneGeometry(7.5, 1);
    geo.rotateX(-Math.PI / 2);
    this.olas = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), this.nCrestas * this.nTramos);
    this.olas.frustumCulled = false;
    this.olas.renderOrder = 2;
    this.grupoOlas.add(this.olas);
    this.faseOlas = 0;
    this.m4 = new THREE.Matrix4();
    this.q4 = new THREE.Quaternion();
    this.e4 = new THREE.Euler();
    this.v4 = new THREE.Vector3();
    this.s4 = new THREE.Vector3();
  }

  /** Corte a lo largo del canal (plano x = 0): agua del río, cuña salina, mar y suelo. */
  armarCorte() {
    this.grupoCorte = this.grupo('cuna');
    const plano = (puntos, color, z = 0.12, opacidad = 1) => {
      const f = new THREE.Shape();
      f.moveTo(puntos[0][0], puntos[0][1]);
      for (const [a, b] of puntos.slice(1)) f.lineTo(a, b);
      f.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(f), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacidad < 1, opacity: opacidad }));
      m.rotation.y = Math.PI / 2;     // el eje x de la forma va a lo largo de −z del mundo
      m.position.x = z;
      return m;
    };
    this.plano = plano;
    // Suelo bajo el canal y el mar (de la punta al sur)
    this.rotCorte = [rotulo('agua del río', 'rotulo3d claro'), rotulo('agua de mar', 'rotulo3d claro'), rotulo('', 'rotulo3d claro')];
    for (const r of this.rotCorte) this.grupoCorte.add(r);
    this.grupoCorte.visible = false;
  }

  pintarCorte(p, r) {
    for (const m of [this.cortaRio, this.cortaCuna, this.cortaMar, this.sueloCorte]) if (m) { this.grupoCorte.remove(m); m.geometry.dispose(); }
    const h = r.h;
    const zMar = Z_PUNTA;
    // suelo: fondo del río (9 m), del canal (h) y del mar
    const zc0 = this.costa(0) + 4;
    const suelo = [[-120, -9], [-zc0, -9], [-zc0, -h], [-zMar, -h]];
    for (let zz = zMar - 4; zz >= -300; zz -= 6) suelo.push([-zz, Math.min(-h, this.altura(0.01, zz) - 0.2)]);
    suelo.push([300, -24], [-120, -24]);
    this.sueloCorte = this.plano(suelo, 0x5c4b36, 0.06);
    this.grupoCorte.add(this.sueloCorte);
    // agua dulce: de la punta hacia el sur, de la superficie al fondo del canal
    const zc = this.costa(0) + 4;
    this.cortaRio = this.plano([[-zMar, 0.4], [-120, 0.4], [-120, -9], [-zc, -9], [-zc, -h], [-zMar, -h]], 0xa48b58, 0.1);
    // mar frente a la punta
    const fondoMar = [];
    for (let zz = zMar; zz >= -300; zz -= 6) fondoMar.push([-zz, Math.min(-h, this.altura(0.01, zz) - 0.2)]);
    this.cortaMar = this.plano([[-zMar, 0], ...fondoMar, [300, 0]], 0x2a6fb0, 0.1);
    // cuña: espesor e(x) = 0.9·h·(1 − x/L)^0.55 desde la punta hacia el sur
    const L = r.L / ESC;
    const pts = [[-zMar, -h]];
    if (L > 0.3) {
      for (let k = 0; k <= 30; k++) {
        const x = (L * k) / 30;
        pts.push([-(zMar + x), -h + 0.9 * h * (1 - k / 30) ** 0.55]);
      }
    }
    pts.push([-(zMar + L), -h]);
    this.cortaCuna = this.plano(pts, 0x2a6fb0, 0.14);
    this.grupoCorte.add(this.cortaRio, this.cortaMar, this.cortaCuna);
    this.rotCorte[0].position.set(0.3, -2.5, zMar + 40);
    this.rotCorte[1].position.set(0.3, -6, zMar - 30);
    this.rotCorte[2].element.textContent = `fondo del canal: ${fmt(h, 1)} m`;
    this.rotCorte[2].position.set(0.3, -h - 2.5, zMar + 18);
  }

  /** Línea del frente del delta dentro de 50 años. */
  armarFrente() {
    this.grupoFrente = this.grupo('avance');
    this.lineaFrente = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 4, gapSize: 3 }));
    this.grupoFrente.add(this.lineaFrente);
  }

  aplicar(p, r) {
    const lobulo = Math.min(20, 0.12 * (p.radioLobulo * 1000) / ESC);
    if (Math.abs(lobulo - this.lobulo) > 0.01) {
      this.lobulo = lobulo;
      this.repintarTerreno(this.malla);
      this.armarCorteSuelo = true;
    }
    if (this.armarCorteSuelo) { this.armarCorteSuelo = false; this.firmaCorte = null; }
    const q = r.q;
    // Río, Dique y flujo
    this.flujoRio.velocidad = 8 + 14 * Math.sqrt(q.Q / 7200);
    const wD = 0.6 + 6 * Math.sqrt(r.fD);
    moverCinta(this.cintaDique, () => 0.55, () => wD);
    this.flujoDique.visible = r.fD > 0.003;
    this.flujoDique.velocidad = 4 + 10 * Math.sqrt(r.fD * 10);
    this.compuerta.visible = p.aperturaDique < 0.999;
    this.compuerta.position.y = 1.4 + 2 * (1 - p.aperturaDique);
    // Pluma: sale de la punta hacia el norte y la corriente la tuerce al occidente; se aclara
    // con la exponencial C(x) = C₀·e^(−x/L) hasta el alcance visible
    const largo = Math.max(8, Math.min(430, (q.alcance * 1.15) / ESC));
    const Lu = q.Lp / ESC;
    const a0 = q.C > p.Cvis ? Math.min(0.92, 0.35 + q.C / 1500) : 0;
    const pos = this.pluma.geometry.attributes.position, col = this.pluma.geometry.attributes.color;
    const eje = (s2) => [-0.32 * s2 - 0.0009 * s2 * s2, Z_PUNTA - 0.92 * s2];
    for (let k = 0; k <= this.nPluma; k++) {
      const s2 = (largo * k) / this.nPluma;
      const [cx, cz] = eje(s2);
      const [dx, dz] = eje(s2 + 1);
      const l = Math.hypot(dx - cx, dz - cz) || 1;
      const nx = -(dz - cz) / l, nz = (dx - cx) / l;
      const w = 4 + 0.5 * s2;
      const alfa = a0 * Math.exp(-s2 / Lu);
      for (let j = 0; j < 5; j++) {
        const u = (j - 2) / 2;
        pos.setXYZ(5 * k + j, cx + nx * w * u, 0.12, cz + nz * w * u);
        col.setXYZW(5 * k + j, 0.5, 0.38, 0.22, alfa * (1 - 0.85 * u * u) * (k === this.nPluma ? 0 : 1));
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    const [px, pz] = eje(Math.min(largo, 2.2 * Lu) * 0.5);
    this.posPluma = [px, pz];
    const lc = Math.max(4, Math.min(40, 6 + p.Qcienaga / 20));
    this.plumaCienaga.scale.set(lc, lc * 0.7, 1);
    this.plumaCienaga.position.set(272, 0.11, this.costa(272) - 6 - lc * 0.5);
    this.plumaCienaga.visible = p.Qcienaga > 1;
    // Bocatoma a xToma km río arriba de la punta
    const zToma = Math.min(320, Z_PUNTA + (p.xToma * 1000) / ESC);
    this.toma.position.set(XR(zToma) - W_RIO - 0.5, this.altura(XR(zToma) - W_RIO - 6, zToma), zToma);
    // Draga y buque que entra
    this.draga.visible = p.dragadoAuto;
    const hayCalado = r.h >= p.calado - 1e-9;
    this.buqueEntra.userData.espera = !hayCalado;
    // Frente del delta en 50 años
    const d50 = (50 * r.de.avance) / ESC;
    const pts = [];
    for (let x = -120; x <= 120; x += 4) pts.push(new THREE.Vector3(x, 0.3, this.costa(x) - d50 * Math.exp(-(x * x) / (2 * 40 * 40))));
    this.lineaFrente.geometry.dispose();
    this.lineaFrente.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.lineaFrente.computeLineDistances();
    this.lineaFrente.material.color.setHex(r.de.Vneto >= 0 ? 0xffffff : 0xd04a3a);
    // Olas: dirección y fuerza
    this.olaAng = (p.anguloOla * Math.PI) / 180;
    this.olaVel = 4 + 3 * p.Tp / 7;
    this.olas.material.opacity = Math.min(0.85, 0.25 + p.Hs / 5);
    this.anchoOla = 0.5 + 0.5 * p.Hs;
    // Corte (solo si cambia)
    const firma = `${r.h.toFixed(2)}|${(r.L / 50).toFixed(0)}`;
    if (firma !== this.firmaCorte) { this.firmaCorte = firma; this.pintarCorte(p, r); }

    // Etiquetas
    const ok = (b) => (b ? 'ok' : 'alerta');
    this.etiqueta('rio', `${miles(q.Q)} m³/s · ${miles(q.C)} mg/L`, 'ok', [XR(this.vista === 'dique' ? 170 : 60) + 4, 10, this.vista === 'dique' ? 170 : 60]);
    this.etiqueta('dique', `${fmt(100 * r.fD, 1)} % · ${miles(q.Qd)} m³/s`, r.fD <= 0.1 ? 'ok' : 'alerta', [-75, 8, 238]);
    this.etiqueta('avulsion', `avulsión en ${miles(r.de.anosAv)} años`, r.de.anosAv > 100 ? 'ok' : 'aviso', [XR(290) + 6, 7, 290]);
    this.etiqueta('cuna', `${fmt(r.L / 1000, 2)} km río arriba`, r.L < p.xToma * 1000 ? 'ok' : 'alerta', [0.3, 2, Z_PUNTA + Math.max(4, r.L / ESC * 0.5)]);
    this.etiqueta('toma', `a ${fmt(p.xToma, 1)} km de la boca`, ok(r.a.Lmax < p.xToma * 1000), this.vista === 'corte' ? [0.3, 5, zToma] : [XR(zToma) - W_RIO - 4, 7, zToma]);
    this.etiqueta('pluma', `${fmt(q.alcance / 1000, 1)} km mar adentro`, r.Cplaya <= 150 ? 'ok' : 'aviso', [this.posPluma[0], 5, this.posPluma[1]]);
    this.etiqueta('delta', `${conSigno(r.de.avance, 1)} m/año · ${r.de.tipo}`, ok(r.de.Vneto >= 0), [70, 6, this.costa(70) + 4]);
    this.etiqueta('oleaje', `H_b = ${fmt(r.de.Hb, 2)} m · ${fmt(r.de.Vls / 1e6, 1)} hm³/año`, r.de.R >= 1 ? 'ok' : 'aviso', [130, 6, -160]);
    this.etiqueta('canal', `${fmt(r.h, 2)} m de fondo · calado ${fmt(p.calado, 1)} m`, ok(hayCalado), [W_CANAL + 6, 6, Z_PUNTA + 20]);
    this.etiqueta('puerto', `dragado ${fmt(r.a.dragado / 1e6, 2)} hm³/año`, r.a.dragado <= 5e6 ? 'ok' : 'aviso', [-W_RIO - 12, 12, -5]);
    this.etiqueta('cienaga', `${miles(p.Qcienaga)} m³/s al mar`, 'ok', [this.cienaga.x, 6, this.cienaga.z]);
    this.etiqueta('ciudad', '', 'ok', [-95, 16, 60]);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    if (!this.malla) return;
    const cortar = nombre === 'corte';
    const planos = cortar ? [this.planoCorte] : [];
    const mats = new Set([this.malla.material, this.matMar, this.matRio, this.matDique, this.aguaCienaga.material, this.pluma.material, this.plumaCienaga.material, this.lineaFrente.material]);
    for (const g of [this.grupoCiudad, this.grupoManglar, this.grupoCanal, this.grupoPuerto, this.grupoToma]) g.traverse((o) => { if (o.material) mats.add(o.material); });
    for (const m of mats) { m.clippingPlanes = planos; m.needsUpdate = true; }
    this.grupoCorte.visible = cortar;
    this.grupoOlas.visible = !cortar;
    this.grupoFrente.visible = !cortar;
    this.flujoRio.visible = !cortar;
    this.flujoDique.visible = !cortar && (this.r ? this.r.fD > 0.003 : true);
    if (this.p && this.r) this.aplicar(this.p, this.r, this.sim);
  }

  paso(dt, t) {
    if (!this.matMar) return;
    this.matMar.map.offset.y = (this.matMar.map.offset.y + 0.01 * dt) % 1;
    this.matRio.map.offset.y = (this.matRio.map.offset.y + 0.3 * dt) % 1;
    this.matDique.map.offset.y = (this.matDique.map.offset.y + 0.2 * dt) % 1;
    this.flujoRio.paso(dt);
    this.flujoDique.paso(dt);
    // Olas que avanzan hacia la costa con su ángulo (separadas 14 unidades)
    if (this.grupoOlas.visible) {
      const a = this.olaAng ?? 0.26, v = this.olaVel ?? 6, sep = 14;
      this.faseOlas = (this.faseOlas + v * dt) % sep;
      const dir = [Math.sin(a), Math.cos(a)];
      const tan = [Math.cos(a), -Math.sin(a)];
      this.e4.set(0, a, 0);
      this.q4.setFromEuler(this.e4);
      let k = 0;
      for (let c = 0; c < this.nCrestas; c++) {
        const d = this.faseOlas + c * sep;
        const cx = -dir[0] * (150 - d), cz = Z_COSTA - 8 - dir[1] * (150 - d);
        for (let j = 0; j < this.nTramos; j++) {
          const u = (j - this.nTramos / 2) * 8.2;
          const x = cx + tan[0] * u, z = cz + tan[1] * u;
          const tierra = z > this.costa(x) - 5 || Math.abs(x) > 340 || (Math.abs(x) < W_CANAL + 3 && z > Z_PUNTA - 2);
          const esc = tierra ? 0 : 1;
          this.s4.set(esc, 1, esc * (this.anchoOla ?? 1.25) * (0.6 + 0.4 * (c / this.nCrestas)));
          this.v4.set(x, 0.16, z);
          this.m4.compose(this.v4, this.q4, this.s4);
          this.olas.setMatrixAt(k++, this.m4);
        }
      }
      this.olas.instanceMatrix.needsUpdate = true;
    }
    // Draga que va y viene; buque que entra (o espera afuera si no hay calado)
    if (this.draga.visible) this.draga.position.z = (Z_PUNTA + this.costa(0)) / 2 + 5 * Math.sin(t * 0.25);
    const b = this.buqueEntra;
    if (b.userData.espera) { b.position.set(-40, 0, -175); b.rotation.y = 0.6; }
    else {
      const ciclo = (t * 0.04) % 1;
      b.position.set(0, 0, -200 + 260 * ciclo);
      b.rotation.y = 0;
      b.visible = b.position.z < 40;
    }
  }
}
