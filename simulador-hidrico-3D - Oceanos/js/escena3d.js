/**
 * escena3d.js — El mar Caribe en 3D (Three.js), en forma esquemática.
 * La superficie del mar se mueve con tres trenes de olas que empujan los alisios; su color
 * sigue a la temperatura (más fría frente a la costa de La Guajira, donde aflora el agua del
 * fondo). Al sur está la costa con el mareógrafo, al occidente la boca del río grande con su
 * pluma y el arrecife de coral, que se blanquea con el calor acumulado. En la vista Columna la
 * mitad oriental se recorta y se ve la columna de agua coloreada por la temperatura, con la
 * termoclina, la espiral de Ekman y la celda del afloramiento. La escena solo dibuja: los
 * números vienen de sistema.js.
 */
import { EscenaBase, THREE, caja, cilindro, nube, azar, reiniciarAzar, suave, mezclar, ruidoSuave, rotulo } from './nucleo/escena-base.js';
import * as M from './modelo.js';
import { fmt, miles, conSigno } from './nucleo/formato.js';

const LADO = 460;                     // ancho del mar dibujado
const Z_COSTA = 120;                  // costa al sur
const VZ = 0.35;                      // unidades por metro en el corte (profundidad)
const PROF = 300;                     // m de la columna dibujada
const limitar01 = (v) => Math.min(1, Math.max(0, v));
const FRIO = new THREE.Color(0x2f9a9a), TIBIO = new THREE.Color(0x1f6fb0), CALIDO = new THREE.Color(0x1b4f9c);

/** Color de una temperatura para el corte (de azul frío a rojo cálido). */
function colorT(T) {
  const stops = [[8, [40, 60, 140]], [14, [50, 110, 190]], [20, [70, 170, 200]], [25, [240, 200, 90]], [29, [230, 110, 60]], [32, [190, 40, 40]]];
  for (let k = 0; k < stops.length - 1; k++) {
    const [a, ca] = stops[k], [b, cb] = stops[k + 1];
    if (T <= b || k === stops.length - 2) {
      const t = limitar01((T - a) / (b - a));
      return ca.map((x, j) => Math.round(mezclar(x, cb[j], t)));
    }
  }
  return stops[0][1];
}

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xcfe4ee;
    this.niebla = [520, 1300];
    this.pestanaVista = { olas: 'mar', mareas: 'guajira', viento: 'columna', temperatura: 'arrecife', salinidad: 'mar', nivel: 'guajira', carbono: 'arrecife' };
    this.amp = 1; this.longitud = 40; this.periodo = 6; this.Ufac = 1;
  }

  vistasDefs() {
    return {
      mar: { pos: [120, 190, 330], mira: [0, 0, 20], etiquetas: ['olas', 'viento', 'afloramiento', 'pluma', 'arrecife', 'nivel'] },
      columna: { pos: [165, 45, 120], mira: [5, -38, 5], etiquetas: ['termoclina', 'ekman', 'afloramiento'] },
      guajira: { pos: [190, 55, 215], mira: [120, 0, 90], etiquetas: ['afloramiento', 'nivel', 'viento', 'olas'] },
      arrecife: { pos: [-140, 40, 160], mira: [-185, -6, 70], etiquetas: ['arrecife', 'carbono', 'pluma'] },
    };
  }

  etiquetasDefs() {
    return [
      ['olas', 'olas', 'Olas'],
      ['viento', 'viento', 'Alisios'],
      ['afloramiento', 'viento', 'Afloramiento'],
      ['ekman', 'viento', 'Espiral de Ekman', 'secundaria'],
      ['termoclina', 'temperatura', 'Termoclina'],
      ['arrecife', 'temperatura', 'Arrecife de coral'],
      ['carbono', 'carbono', 'pH y aragonito', 'secundaria'],
      ['pluma', 'salinidad', 'Pluma del río grande'],
      ['nivel', 'nivel', 'Mareógrafo'],
    ];
  }

  centrosEtiquetas() { return { nivel: [0.5, 1], arrecife: [0.5, 1] }; }

  altura(x, z) {
    // Fondo del mar: plataforma cerca de la costa, talud y mar profundo
    const d = Z_COSTA - z;                                  // distancia a la costa (hacia el norte)
    let y = -4 - 0.12 * d - 30 * suave(limitar01((d - 60) / 120));
    // Arrecife: plataforma somera al occidente
    const ra = Math.hypot((x + 185) / 45, (z - 70) / 30);
    if (ra < 1.3) y = Math.max(y, mezclar(-3.5, y, suave(limitar01((ra - 0.7) / 0.6))));
    // Tierra al sur y península al oriente
    if (z > Z_COSTA - 4 || (x > 170 && z > -40)) {
      const t = z > Z_COSTA - 4 ? limitar01((z - Z_COSTA + 4) / 10) : limitar01((x - 170) / 12) * limitar01((z + 40) / 12);
      y = mezclar(y, 2 + 8 * ruidoSuave(x, z, 30) + 10 * suave(limitar01((z - Z_COSTA - 30) / 80)), suave(t));
    }
    this.ultY = y;
    return y;
  }

  colorTerreno(c, x, z, y) {
    if (y > 0.8) { c.setRGB(0.84, 0.74, 0.52).lerp(new THREE.Color(0x8a9a58), limitar01((y - 6) / 12) * (x < 150 ? 0.8 : 0.25)); return; }
    if (y > -1) { c.setRGB(0.88, 0.8, 0.6); return; }
    c.setRGB(0.78, 0.72, 0.55).lerp(new THREE.Color(0x3f5f6a), limitar01(-y / 45));
  }

  construir() {
    reiniciarAzar(77);
    this.malla = this.terreno({ x0: -LADO / 2, x1: LADO / 2, z0: -LADO / 2, z1: 260, nx: 180, nz: 190, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.scene.add(this.malla);
    const sc = this.luzSol.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.far = 900;
    this.luzSol.position.set(150, 260, 120);
    sc.updateProjectionMatrix();
    this.planoCorte = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

    // Superficie del mar con olas y color por temperatura
    this.grupoMar = this.grupo('olas');
    const g = new THREE.PlaneGeometry(LADO, LADO + 20, 150, 156);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -10 - 0);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    this.base = Float32Array.from(g.attributes.position.array);
    this.matMar = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88, flatShading: true });
    this.mar = new THREE.Mesh(g, this.matMar);
    this.mar.renderOrder = -1;
    this.grupoMar.add(this.mar);
    this.indexar(this.grupoMar);

    this.armarViento();
    this.armarCosta();
    this.armarArrecife();
    this.armarPluma();
    this.armarCorte();
    this.nubes = [];
    for (let k = 0; k < 8; k++) {
      const n = nube(6 + (k % 3) * 2, 0xffffff, 0.92);
      n.position.set(-220 + k * 60, 80 + (k % 2) * 20, -200 + ((k * 83) % 300));
      this.scene.add(n);
      this.nubes.push(n);
    }
  }

  armarViento() {
    this.grupoViento = this.grupo('viento');
    this.flechas = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, flatShading: true });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const f = new THREE.Group();
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 14, 6), mat);
      cuerpo.rotation.z = Math.PI / 2;
      const punta = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 6), mat);
      punta.rotation.z = Math.PI / 2;
      punta.position.x = -9.5;
      f.add(cuerpo, punta);
      f.position.set(-150 + i * 100, 28, -150 + j * 100);
      this.grupoViento.add(f);
      this.flechas.push(f);
    }
    // Transporte de Ekman (flecha azul mar afuera) cerca de la costa
    this.flechaEkman = new THREE.Group();
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x2e86c1, flatShading: true });
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 6), mat2);
    c2.rotation.x = Math.PI / 2;
    const p2 = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 6), mat2);
    p2.rotation.x = -Math.PI / 2;
    p2.position.z = -19;
    this.flechaEkman.add(c2, p2);
    this.flechaEkman.position.set(60, 3, Z_COSTA - 45);
    this.grupoViento.add(this.flechaEkman);
    this.indexar(this.grupoViento);
  }

  armarCosta() {
    this.grupoCosta = this.grupo('nivel');
    // Muelle con el mareógrafo
    const muelle = caja(4, 1, 30, 0x8a7a66);
    muelle.position.set(120, 2.5, Z_COSTA - 14);
    const regla = caja(0.6, 14, 0.6, 0xf2f2f2);
    regla.position.set(122.5, 0, Z_COSTA - 27);
    this.grupoCosta.add(muelle, regla);
    for (let k = -6; k <= 6; k += 1) {
      const m = caja(1.4, 0.18, 0.7, k % 5 === 0 ? 0xd04a3a : 0x333333, { sombra: false });
      m.position.set(122.5, k, Z_COSTA - 27.3);
      this.grupoCosta.add(m);
    }
    this.marca = caja(2.2, 0.35, 1.2, 0x2e86c1, { sombra: false });
    this.grupoCosta.add(this.marca);
    // Un pueblo en la costa y molinos de viento en La Guajira
    reiniciarAzar(5);
    for (let k = 0; k < 14; k++) {
      const x = -100 + azar() * 180, z = Z_COSTA + 8 + azar() * 20;
      const b = caja(4, 3 + azar() * 6, 4, [0xf2efe8, 0xe8dcc8, 0xdfe7ea][k % 3]);
      b.position.set(x, this.altura(x, z) + 2, z);
      this.grupoCosta.add(b);
    }
    this.molinos = [];
    for (let k = 0; k < 6; k++) {
      const x = 195 + (k % 3) * 18, z = 20 + Math.floor(k / 3) * 40;
      const torre = cilindro(0.5, 0.8, 22, 0xf2f2f2, { lados: 8 });
      torre.position.set(x, this.altura(x, z) + 11, z);
      const rotor = new THREE.Group();
      for (let a = 0; a < 3; a++) { const aspa = caja(0.5, 10, 0.25, 0xf2f2f2); aspa.position.y = 5; const piv = new THREE.Group(); piv.rotation.x = (a * 2 * Math.PI) / 3; piv.add(aspa); rotor.add(piv); }
      rotor.position.set(x - 0.8, this.altura(x, z) + 22, z);
      this.grupoCosta.add(torre, rotor);
      this.molinos.push(rotor);
    }
    // Boya oceanográfica y buque
    this.boya = new THREE.Group();
    const casco = cilindro(1.6, 1.6, 1.4, 0xf1c40f, { lados: 10 });
    const mastil = cilindro(0.15, 0.15, 6, 0x777777, { lados: 6 });
    mastil.position.y = 3.5;
    this.boya.add(casco, mastil);
    this.boya.position.set(20, 0, -40);
    this.grupoCosta.add(this.boya);
    this.buque = new THREE.Group();
    const h = caja(5, 2.6, 26, 0x2b3a55);
    h.position.y = 0.8;
    const pu = caja(4.4, 3.4, 4.6, 0xf2f2f2);
    pu.position.set(0, 3.5, 9);
    this.buque.add(h, pu);
    for (let k = 0; k < 4; k++) { const cn = caja(4.2, 1.4, 3.6, [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22][k]); cn.position.set(0, 2.8, -8 + k * 4.2); this.buque.add(cn); }
    this.buque.rotation.y = Math.PI / 2;
    this.grupoCosta.add(this.buque);
    this.indexar(this.grupoCosta);
  }

  armarArrecife() {
    this.grupoArrecife = this.grupo('temperatura');
    reiniciarAzar(123);
    const pts = [];
    for (let k = 0; k < 220; k++) {
      const a = azar() * Math.PI * 2, r = Math.sqrt(azar());
      const x = -185 + Math.cos(a) * 40 * r, z = 70 + Math.sin(a) * 26 * r;
      pts.push({ x, z, y: this.altura(x, z), s: 0.8 + azar() * 1.6, c: [0xe67e22, 0x8e44ad, 0xf1c40f, 0x27ae60, 0xd35454][k % 5] });
    }
    this.corales = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach((p, k) => { m4.makeScale(p.s, p.s * 0.8, p.s).setPosition(p.x, p.y + p.s * 0.6, p.z); this.corales.setMatrixAt(k, m4); });
    this.ptsCoral = pts;
    this.grupoArrecife.add(this.corales);
    this.pintarCoral(0);
    this.indexar(this.grupoArrecife);
  }

  /** Blanqueamiento: 0 sano … 1 blanco. */
  pintarCoral(b) {
    const blanco = new THREE.Color(0xf4f4f0), c = new THREE.Color();
    this.ptsCoral.forEach((p, k) => { c.setHex(p.c).lerp(blanco, b * (0.6 + 0.4 * ((k * 7) % 10) / 10)); this.corales.setColorAt(k, c); });
    if (this.corales.instanceColor) this.corales.instanceColor.needsUpdate = true;
  }

  armarPluma() {
    this.grupoPluma = this.grupo('salinidad');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const gc = cv.getContext('2d');
    const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = gr;
    gc.fillRect(0, 0, 128, 128);
    this.pluma = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x9a7d4b, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.85, depthWrite: false }));
    this.pluma.rotation.x = -Math.PI / 2;
    this.pluma.renderOrder = 3;
    this.grupoPluma.add(this.pluma);
    // Boca del río
    const boca = caja(10, 0.6, 26, 0x9a8558);
    boca.position.set(-110, 0.8, Z_COSTA + 8);
    this.grupoPluma.add(boca);
  }

  /** Columna de agua en el plano x = 0: textura con la temperatura, flechas de Ekman y afloramiento. */
  armarCorte() {
    this.grupoCorte = this.grupo('viento');
    this.cvCorte = document.createElement('canvas');
    this.cvCorte.width = 4;
    this.cvCorte.height = 256;
    this.texCorte = new THREE.CanvasTexture(this.cvCorte);
    this.texCorte.colorSpace = THREE.SRGBColorSpace;
    const ancho = Z_COSTA + LADO / 2;                     // de la costa al borde norte
    this.columna = new THREE.Mesh(new THREE.PlaneGeometry(ancho, PROF * VZ), new THREE.MeshBasicMaterial({ map: this.texCorte, side: THREE.DoubleSide }));
    this.columna.rotation.y = Math.PI / 2;
    this.columna.position.set(0.15, (-PROF * VZ) / 2, (Z_COSTA - LADO / 2) / 2);
    this.grupoCorte.add(this.columna);
    // Línea de la termoclina
    this.lineaTermo = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 3, gapSize: 2 }));
    this.grupoCorte.add(this.lineaTermo);
    // Espiral de Ekman: flechas a varias profundidades
    this.flechasEk = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    for (let k = 0; k < 7; k++) {
      const f = new THREE.Group();
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 6), mat);
      cuerpo.position.y = 0.5;
      const punta = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 6), mat);
      punta.position.y = 1.3;
      f.add(cuerpo, punta);
      f.userData = { cuerpo, punta };
      this.grupoCorte.add(f);
      this.flechasEk.push(f);
    }
    // Celda del afloramiento: partículas que suben junto a la costa y se van mar afuera
    const n = 160;
    this.celda = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * n), 3)), new THREE.PointsMaterial({ color: 0xe8fbff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.celda.userData.fase = Array.from({ length: n }, (_, k) => k / n);
    this.celda.renderOrder = 4;
    this.grupoCorte.add(this.celda);
    this.rotCorte = [rotulo('capa de mezcla', 'rotulo3d claro'), rotulo('agua fría del fondo', 'rotulo3d claro')];
    for (const r of this.rotCorte) this.grupoCorte.add(r);
    this.grupoCorte.visible = false;
  }

  pintarCorte(p, r) {
    const g = this.cvCorte.getContext('2d');
    for (let j = 0; j < 256; j++) {
      const z = (j / 255) * PROF;
      const [R, G, B] = colorT(M.perfilTemperatura(z, r.T, p.Tfondo, p.zMezcla, p.delta));
      g.fillStyle = `rgb(${R},${G},${B})`;
      g.fillRect(0, j, 4, 1);
    }
    this.texCorte.needsUpdate = true;
    const yT = -p.zMezcla * VZ;
    this.lineaTermo.geometry.dispose();
    this.lineaTermo.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.3, yT, Z_COSTA), new THREE.Vector3(0.3, yT, -LADO / 2)]);
    this.lineaTermo.computeLineDistances();
    this.rotCorte[0].position.set(0.4, yT / 2, -60);
    this.rotCorte[1].position.set(0.4, -PROF * VZ * 0.75, -60);
  }

  aplicar(p, r) {
    const q = r.q;
    // Olas: altura, longitud y período del momento (dibujo exagerado)
    this.amp = 0.6 + 0.9 * q.Hs;
    this.longitud = Math.max(18, Math.min(90, q.L0 / 2));
    this.periodo = q.Tp;
    this.Ufac = q.U / 8;
    this.nivelMar = (r.fu.nivel / 1000) * 6;              // exagerado para que se vea en el mareógrafo
    this.marea = q.eta * 6;
    // Colores de la superficie: más fría junto a la costa con el afloramiento
    this.Tmar = r.T; this.Tguajira = r.Tg;
    const firmaC = `${r.T.toFixed(2)}|${r.Tg.toFixed(2)}`;
    if (firmaC !== this.firmaColor) {
      this.firmaColor = firmaC;
      const col = this.mar.geometry.attributes.color;
      const c = new THREE.Color();
      for (let k = 0; k < col.count; k++) {
        const x = this.base[3 * k], z = this.base[3 * k + 2];
        const cerca = Math.exp(-Math.max(0, Z_COSTA - z) / 45) * limitar01((x + 40) / 80);
        const T = mezclar(r.T, r.Tg, cerca);
        const t = limitar01((T - 24.5) / 4.5);
        if (t < 0.5) c.copy(FRIO).lerp(TIBIO, t / 0.5); else c.copy(TIBIO).lerp(CALIDO, (t - 0.5) / 0.5);
        col.setXYZ(k, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
    // Viento
    for (const f of this.flechas) f.scale.set(0.6 + 0.08 * q.U, 1, 1);
    this.flechaEkman.scale.set(1, 1, 0.4 + 0.12 * q.Mek);
    // Pluma
    const rad = Math.max(8, Math.min(120, 10 + 30 * r.pl.fRio * 4));
    this.pluma.scale.set(rad, rad * 0.7, 1);
    this.pluma.position.set(-110, 0.9, Z_COSTA - rad * 0.55);
    this.pluma.material.opacity = Math.min(0.9, 0.3 + r.pl.fRio * 2);
    // Coral
    const blanq = r.alerta.nivel >= 3 ? 1 : (r.alerta.nivel === 2 ? 0.45 : (r.alerta.nivel === 1 ? 0.15 : 0));
    const b2 = Math.max(blanq, limitar01((r.DHW - 2) / 8));
    if (Math.abs(b2 - (this.blanqueo ?? -1)) > 0.02) { this.blanqueo = b2; this.pintarCoral(b2); }
    // Corte
    const firma = `${r.T.toFixed(1)}|${p.Tfondo}|${p.zMezcla}|${p.delta}`;
    if (firma !== this.firmaCorte) { this.firmaCorte = firma; this.pintarCorte(p, r); }
    const V0 = q.tau / (M.RHO * Math.sqrt(Math.abs(q.f) * p.Az));
    this.flechasEk.forEach((f, k) => {
      const z = (k / 6) * q.DE;
      const e = M.espiralEkman(z, V0, q.DE);
      const ang = (e.giro * Math.PI) / 180;              // a la derecha del viento, que sopla hacia el oeste (−x)
      const dir = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang));
      const largo = 3 + 110 * e.rapidez;
      f.position.set(28, -z * VZ - 0.5, 10);
      f.userData.cuerpo.scale.y = largo;
      f.userData.punta.position.y = largo + 1.3;
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    });
    this.velCelda = 0.02 + 0.01 * q.wDia;
    // Etiquetas
    const NIV = ['ok', 'ok', 'aviso', 'alerta', 'alerta'];
    this.etiqueta('olas', `H_s ${fmt(q.Hs, 2)} m · T ${fmt(q.Tp, 1)} s · ${fmt(q.P / 1000, 1)} kW/m`, q.Hs <= 4 ? 'ok' : 'aviso', [-20, 14, -120]);
    this.etiqueta('viento', `${fmt(q.U, 1)} m/s hacia el oeste`, 'ok', [50, 36, -150]);
    this.etiqueta('afloramiento', `${fmt(q.wDia, 1)} m/día · ${fmt(r.Tg, 1)} °C junto a la costa`, 'ok', this.vista === 'columna' ? [0.4, 4, Z_COSTA - 20] : [90, 6, Z_COSTA - 30]);
    this.etiqueta('ekman', `${fmt(q.Mek, 2)} m²/s mar afuera · D = ${fmt(q.DE, 0)} m`, 'ok', [0.4, -q.DE * VZ, 0]);
    this.etiqueta('termoclina', `a ${fmt(p.zMezcla, 0)} m · ${fmt(r.T, 1)} °C arriba, ${fmt(p.Tfondo, 1)} °C abajo`, 'ok', [0.4, -p.zMezcla * VZ, -120]);
    this.etiqueta('arrecife', `${fmt(r.T, 2)} °C · DHW ${fmt(r.DHW, 1)} · ${r.alerta.nombre.split(':')[0]}`, NIV[r.alerta.nivel], [-185, 6, 70]);
    this.etiqueta('carbono', `pH ${fmt(r.fu.pH, 3)} · Ω ${fmt(r.fu.Om, 2)} en ${p.anoHorizonte}`, r.fu.Om >= 3 ? 'ok' : 'alerta', [-160, 4, 50]);
    this.etiqueta('pluma', `${miles(p.Qrio)} m³/s · ${fmt(r.pl.S, 1)} PSU frente a la boca`, r.pl.Sarrecife >= 34 ? 'ok' : 'aviso', [-110, 5, Z_COSTA - rad * 0.6]);
    this.etiqueta('nivel', `${conSigno(r.fu.nivel / 10, 1)} cm en ${p.anoHorizonte} · marea ${conSigno(q.eta, 2)} m`, r.fu.nivel <= 300 ? 'ok' : 'aviso', [122.5, 10, Z_COSTA - 27]);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    if (!this.malla) return;
    const cortar = nombre === 'columna';
    const planos = cortar ? [this.planoCorte] : [];
    const mats = new Set([this.malla.material, this.matMar, this.pluma.material]);
    for (const g of [this.grupoCosta, this.grupoArrecife, this.grupoViento]) g.traverse((o) => { if (o.material && !this.grupoCorte.children.includes(o)) mats.add(o.material); });
    for (const m of mats) { m.clippingPlanes = planos; m.needsUpdate = true; }
    this.grupoCorte.visible = cortar;
    if (this.p && this.r) this.aplicar(this.p, this.r, this.sim);
  }

  paso(dt, t) {
    if (!this.mar) return;
    // Tres trenes de olas que avanzan hacia el oeste (con los alisios), de distinta longitud
    const pos = this.mar.geometry.attributes.position;
    const A = this.amp ?? 1, L = this.longitud ?? 40, T = this.periodo ?? 6;
    const k1 = (2 * Math.PI) / L, k2 = (2 * Math.PI) / (L * 0.62), k3 = (2 * Math.PI) / (L * 1.7);
    const w1 = (2 * Math.PI) / T * 1.6, w2 = w1 * 1.27, w3 = w1 * 0.77;
    const nivel = (this.nivelMar ?? 0) + (this.marea ?? 0);
    for (let k = 0; k < pos.count; k++) {
      const x = this.base[3 * k], z = this.base[3 * k + 2];
      const y = A * (0.55 * Math.sin(k1 * (x * 0.96 + z * 0.28) + w1 * t) + 0.3 * Math.sin(k2 * (x * 0.8 - z * 0.6) + w2 * t + 1.3) + 0.25 * Math.sin(k3 * (x + z * 0.1) + w3 * t + 2.1));
      pos.setY(k, nivel + y * (z > Z_COSTA - 30 ? limitar01((Z_COSTA - z) / 30) : 1));
    }
    pos.needsUpdate = true;
    this.mar.geometry.computeVertexNormals();
    // Mareógrafo, boya, buque, molinos y nubes
    this.marca.position.set(122.5, nivel, Z_COSTA - 27.6);
    this.boya.position.y = nivel + A * 0.5 * Math.sin(t * 1.3);
    this.boya.rotation.z = 0.15 * Math.sin(t * 1.1);
    this.buque.position.set(((t * 6) % 520) - 260, nivel + 0.2, -90);
    for (const m of this.molinos) m.rotation.x += dt * 2 * (this.Ufac ?? 1);
    for (const n of this.nubes) { n.position.x -= dt * 4 * (this.Ufac ?? 1); if (n.position.x < -280) n.position.x = 280; }
    // Celda del afloramiento en el corte
    if (this.grupoCorte.visible) {
      const pts = this.celda.geometry.attributes.position;
      const f = this.celda.userData.fase;
      const v = this.velCelda ?? 0.1;
      for (let k = 0; k < f.length; k++) {
        f[k] = (f[k] + v * dt * 0.2) % 1;
        const s = f[k] * 4;                                  // recorrido: fondo → costa → arriba → mar afuera → abajo
        let z, y;
        if (s < 1) { z = mezclar(-100, Z_COSTA - 15, s); y = -70 * VZ * 1.6; }
        else if (s < 2) { z = Z_COSTA - 15; y = mezclar(-70 * VZ * 1.6, -2, s - 1); }
        else if (s < 3) { z = mezclar(Z_COSTA - 15, -100, s - 2); y = -2; }
        else { z = -100; y = mezclar(-2, -70 * VZ * 1.6, s - 3); }
        pts.setXYZ(k, 1, y, z + Math.sin(k * 3.7) * 3);
      }
      pts.needsUpdate = true;
    }
  }
}
