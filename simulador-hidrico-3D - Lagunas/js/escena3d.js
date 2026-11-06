/**
 * escena3d.js — La laguna de alta montaña en 3D (Three.js).
 * Un circo glaciar del páramo: el glaciar en el pico del sur, las laderas con frailejones,
 * potreros y papa, la laguna en su cubeta de paraboloide, el vertedero y la quebrada que
 * baja hacia el norte hasta el pueblo, la toma del acueducto veredal y, si las hay, las
 * jaulas de trucha. La vista Corte recorta el frente del terreno como una maqueta y muestra
 * la luz que entra en el agua, las plantas del fondo y el lodo.
 * La escena solo dibuja: todos los números vienen de sistema.js.
 */
import { EscenaBase, THREE, materialAgua, caja, cilindro, casa, nube, Lluvia, FlujoCurva, Particulas, azar, reiniciarAzar, suave, ruidoSuave, rotulo } from './nucleo/escena-base.js';
import * as M from './modelo.js';
import * as S from './sistema.js';
import { fmt } from './nucleo/formato.js';

const ESC = 4;          // metros por unidad horizontal
const VS = 1.2;         // unidades por metro de profundidad (exageración vertical de la cubeta)
const Z_PUEBLO = 215;   // la quebrada baja hacia el norte (distancias comprimidas)
const COLOR = {
  paramo: new THREE.Color(0x9a9d5c), paramoSeco: new THREE.Color(0x9c8a5a), roca: new THREE.Color(0x7d786f),
  nieve: new THREE.Color(0xf4f8fb), hielo: new THREE.Color(0xd9ecf5), orilla: new THREE.Color(0x6f6a4f), fondo: new THREE.Color(0x4f4a3a),
  valle: new THREE.Color(0x6f8f4a), quemado: new THREE.Color(0x5a4a36), potrero: new THREE.Color(0xa9b75f),
};
const AGUA_CLARA = new THREE.Color(0x2c86b0);
const AGUA_TURBIA = new THREE.Color(0x7d8a3c);
const AGUA_LODO = new THREE.Color(0x8a7a52);

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xd3e1e6;
    this.niebla = [260, 620];
    this.pestanaVista = { clima: 'general', paramo: 'general', laguna: 'laguna', calidad: 'corte', viento: 'laguna', sedimentos: 'corte', amenazas: 'pueblo' };
    this.Ru = 48;
    this.hu = 6;
    this.fGlaciar = 1;
  }

  vistasDefs() {
    return {
      general: { pos: [150, 120, 190], mira: [0, 10, -20], etiquetas: ['laguna', 'paramo', 'glaciar', 'vertedero', 'pueblo', 'calidad'] },
      laguna: { pos: [70, 45, 105], mira: [0, 0, 10], etiquetas: ['laguna', 'vertedero', 'toma', 'calidad', 'viento', 'cierre'] },
      glaciar: { pos: [-95, 120, 10], mira: [-10, 60, -150], etiquetas: ['glaciar', 'paramo', 'laguna'] },
      corte: { pos: [10, 22, 120], mira: [0, -2, 0], etiquetas: ['laguna', 'calidad', 'sedimento'] },
      pueblo: { pos: [110, 60, 300], mira: [0, -25, 150], etiquetas: ['vertedero', 'pueblo', 'cierre', 'laguna'] },
    };
  }

  etiquetasDefs() {
    return [
      ['laguna', 'laguna', 'Laguna'],
      ['vertedero', 'laguna', 'Vertedero y quebrada'],
      ['toma', 'laguna', 'Toma del acueducto', 'secundaria'],
      ['paramo', 'paramo', 'Páramo'],
      ['glaciar', 'clima', 'Glaciar'],
      ['calidad', 'calidad', 'Calidad del agua'],
      ['viento', 'viento', 'Viento y olas', 'secundaria'],
      ['sedimento', 'sedimentos', 'Lodo del fondo'],
      ['cierre', 'amenazas', 'Cierre de la laguna', 'secundaria'],
      ['pueblo', 'amenazas', 'Pueblo'],
    ];
  }

  centrosEtiquetas() {
    return { laguna: [0.5, 1], paramo: [0.5, 1], glaciar: [0.5, 1], pueblo: [0.5, 1], vertedero: [0, 0.5], calidad: [0.5, 0], sedimento: [0, 0.5] };
  }

  // ── Terreno: circo glaciar con la cubeta de la laguna ───────────────────
  altura(x, z) {
    const r = Math.hypot(x, z);
    const Ru = this.Ru;
    const hu = this.hu * VS;
    // Paraboloide de la cubeta (sigue un poco por encima del umbral como orilla)
    const cubeta = hu * ((r * r) / (Ru * Ru) - 1);
    // Montañas del circo: suben hacia el sur y a los lados, con el pico del glaciar
    const sur = 70 * suave(Math.min(1, Math.max(0, (-z - 45) / 140)));
    const pico = 48 * Math.exp(-((x + 10) ** 2 + (z + 175) ** 2) / (2 * 48 * 48));
    const lados = 26 * suave(Math.min(1, Math.max(0, (Math.abs(x) - 60) / 110)));
    const relieve = 6 * (ruidoSuave(x + 300, z + 300, 22) - 0.5) + 3 * (ruidoSuave(x, z, 9) - 0.5);
    // Todo el valle baja hacia el norte, hacia el pueblo
    const norte = z > Ru ? -0.2 * (z - Ru) : 0;
    const monte = Math.max(3, 3 + sur + pico + lados + relieve) + norte;
    let y;
    if (r < Ru) y = cubeta;
    else {
      const t = suave(Math.min(1, (r - Ru) / 26));
      y = Math.min(cubeta, 3.5) * (1 - t) + monte * t;
    }
    // Cauce de la quebrada: del vertedero (en el umbral) hacia el norte
    if (z > Ru - 4) {
      const d = Math.abs(x - this.xQuebrada(z));
      if (d < 7) {
        const lecho = -0.12 - 0.2 * Math.max(0, z - Ru);
        y = Math.min(y, lecho + 0.06 * d * d);
      }
    }
    return y;
  }

  /** Recorrido de la quebrada (x según z), del vertedero al pueblo. */
  xQuebrada(z) {
    return 6 * Math.sin((z - this.Ru) / 38) + (z > 150 ? (z - 150) * 0.15 : 0);
  }

  colorTerreno(c, x, z, y) {
    // El glaciar cubre el pico: su radio en la escena crece con la raíz del área
    const dPico = Math.hypot(x + 10, z + 175);
    const rGlaciar = 62 * Math.sqrt(Math.max(0, this.fGlaciar));
    if (dPico < rGlaciar && y > 40) c.copy(COLOR.nieve).lerp(COLOR.hielo, ruidoSuave(x, z, 6) * 0.5);
    else if (y > 52 || (dPico < rGlaciar + 14 && y > 36)) c.copy(COLOR.roca).lerp(COLOR.paramo, Math.max(0, Math.min(0.4, (60 - y) / 40)));
    else if (y < -0.3 && Math.hypot(x, z) < this.Ru * 1.05) c.copy(COLOR.fondo).lerp(COLOR.orilla, Math.min(1, (y + this.hu * VS) / (this.hu * VS)));
    else if (z > this.Ru + 8) c.copy(COLOR.valle).lerp(COLOR.paramo, Math.max(0, Math.min(1, (y + 20) / 30)));
    else {
      c.copy(this.degradado ? COLOR.paramoSeco : COLOR.paramo);
      if (y > 40) c.lerp(COLOR.roca, Math.min(1, (y - 40) / 25));
      if (this.degradado && ruidoSuave(x * 1.3, z * 1.3, 14) > 0.62) c.copy(COLOR.quemado);
    }
  }

  construir() {
    reiniciarAzar(2026);
    this.malla = this.terreno({ x0: -200, x1: 200, z0: -240, z1: 260, nx: 200, nz: 250, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.planoCorte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.01);
    this.scene.add(this.malla);

    // Agua de la laguna: un disco en el nivel h (radio R = R_u·√(h/h_u))
    this.grupoLaguna = this.grupo('laguna');
    this.matAgua = materialAgua(AGUA_CLARA, { opacidad: 0.82, repetir: 10 });
    this.agua = new THREE.Mesh(new THREE.CircleGeometry(1, 96), this.matAgua);
    this.agua.rotation.x = -Math.PI / 2;
    this.agua.receiveShadow = true;
    this.grupoLaguna.add(this.agua);
    this.indexar(this.grupoLaguna);

    // Plantas sumergidas en el fondo (instancias)
    this.nPlantas = 520;
    const geoPlanta = new THREE.ConeGeometry(0.55, 1.6, 5);
    geoPlanta.translate(0, 0.8, 0);
    this.plantas = new THREE.InstancedMesh(geoPlanta, new THREE.MeshStandardMaterial({ color: 0x3f7f3a, flatShading: true }), this.nPlantas);
    this.plantas.userData.tab = 'calidad';
    this.posPlantas = [];
    const m = new THREE.Matrix4();
    for (let k = 0; k < this.nPlantas; k++) {
      const ang = azar() * Math.PI * 2;
      const rr = Math.sqrt(0.08 + 0.9 * azar());
      this.posPlantas.push([ang, rr, 0.7 + azar() * 0.8]);
    }
    this.scene.add(this.plantas);

    // Vertedero, quebrada y flujo
    this.grupoVert = this.grupo('laguna');
    this.flujoQuebrada = null;
    // Toma del acueducto: tubería hacia un tanque en la ladera
    this.grupoToma = this.grupo('laguna');
    this.grupoParamo = this.grupo('paramo');
    this.grupoGlaciar = this.grupo('clima');
    this.grupoPueblo = this.grupo('amenazas');
    this.grupoTruchas = this.grupo('calidad');
    this.grupoCorte = this.grupo('sedimentos');
    this.grupoCierre = this.grupo('amenazas');

    this.construirFrailejones();
    this.construirPueblo();
    this.construirNubes();
    this.armarGeometriaDependiente();
  }

  /** Lo que depende del tamaño de la cubeta: vertedero, quebrada, toma, deshielo, cierre. */
  armarGeometriaDependiente() {
    for (const g of [this.grupoVert, this.grupoToma, this.grupoGlaciar, this.grupoCierre]) {
      while (g.children.length) g.remove(g.children[0]);
    }
    const Ru = this.Ru;
    // Quebrada: del vertedero (norte) al pueblo
    const pts = [];
    for (let z = Ru - 1; z <= Z_PUEBLO + 25; z += 6) pts.push([this.xQuebrada(z), this.altura(this.xQuebrada(z), z) + 0.25, z]);
    if (this.flujoQuebrada) this.scene.remove(this.flujoQuebrada.obj);
    this.flujoQuebrada = new FlujoCurva(this.scene, 520, pts, { color: 0xe3f4fb, tamano: 0.75, ancho: 2.2, alto: 0.15 });
    this.ptsQuebrada = pts;
    // Lecho de la quebrada (cinta de agua)
    const curva = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    this.cintaQuebrada = new THREE.Mesh(new THREE.TubeGeometry(curva, 120, 1.3, 6, false), new THREE.MeshStandardMaterial({ color: 0x3d93bd, roughness: 0.3, transparent: true, opacity: 0.85 }));
    this.cintaQuebrada.scale.y = 0.25;
    this.cintaQuebrada.position.y = 0.2;
    this.grupoVert.add(this.cintaQuebrada);
    // Umbral de roca o dique de morrena en la salida
    const xs = this.xQuebrada(Ru);
    const umbral = caja(9, 1.2, 3, 0x6d685f);
    umbral.position.set(xs, -0.55, Ru + 0.5);
    this.grupoCierre.add(umbral);
    this.dique = new THREE.Group();
    reiniciarAzar(55);
    for (let k = 0; k < 46; k++) {
      const piedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + azar() * 1.4, 0), new THREE.MeshStandardMaterial({ color: 0x8a8378, flatShading: true }));
      const ang = (azar() - 0.5) * 0.9;
      const rr = Ru + 1 + azar() * 6;
      piedra.position.set(Math.sin(ang) * rr, 0.2 + azar() * 2.2, Math.cos(ang) * rr);
      piedra.castShadow = true;
      this.dique.add(piedra);
    }
    this.grupoCierre.add(this.dique);
    this.indexar(this.grupoCierre);
    // Toma y tubería al tanque del acueducto (al oriente)
    const ang = 0.55;
    const rToma = Ru * 0.82;
    const pToma = [Math.sin(ang) * rToma, -this.hu * VS * 0.33, Math.cos(ang) * rToma];
    const pTanque = [Ru + 32, this.altura(Ru + 32, Ru + 20) + 0.6, Ru + 20];
    const tub = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(...pToma), new THREE.Vector3(Math.sin(ang) * Ru * 1.12, 0.6, Math.cos(ang) * Ru * 1.12), new THREE.Vector3(...pTanque)]), 40, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 }));
    this.grupoToma.add(tub);
    const tanque = cilindro(2.4, 2.4, 2.6, 0xcfd6d6, { lados: 16 });
    tanque.position.set(pTanque[0], pTanque[1] + 1.3, pTanque[2]);
    this.grupoToma.add(tanque);
    this.posToma = pToma;
    this.indexar(this.grupoToma);
    // Glaciar: arroyos de deshielo hasta la laguna
    const ptsG = [[-12, this.altura(-12, -128) + 0.6, -128], [-8, this.altura(-8, -105) + 0.5, -105], [-5, this.altura(-5, -80) + 0.4, -80], [-2, this.altura(-2, -Ru - 10) + 0.5, -Ru - 10], [0, 0.4, -Ru + 4]];
    if (this.flujoDeshielo) this.scene.remove(this.flujoDeshielo.obj);
    this.flujoDeshielo = new FlujoCurva(this.scene, 160, ptsG, { color: 0xf2fbff, tamano: 0.6, ancho: 1.2, alto: 0.4 });
    this.posGlaciar = [-10, this.altura(-10, -160) + 8, -160];
    this.indexar(this.grupoGlaciar);
    // Corte de la cubeta (vista Corte)
    this.armarCorte();
  }

  construirFrailejones() {
    // Frailejón: tallo con hojas secas y roseta plateada
    const tallo = new THREE.CylinderGeometry(0.28, 0.36, 2.6, 6);
    tallo.translate(0, 1.3, 0);
    const roseta = new THREE.IcosahedronGeometry(1.0, 0);
    roseta.scale(1, 0.6, 1);
    roseta.translate(0, 2.9, 0);
    this.nFrailejones = 900;
    this.frailejonTallo = new THREE.InstancedMesh(tallo, new THREE.MeshStandardMaterial({ color: 0x6b5a3e, flatShading: true }), this.nFrailejones);
    this.frailejonRoseta = new THREE.InstancedMesh(roseta, new THREE.MeshStandardMaterial({ color: 0xb7c29a, flatShading: true }), this.nFrailejones);
    this.frailejonTallo.castShadow = this.frailejonRoseta.castShadow = true;
    this.grupoParamo.add(this.frailejonTallo, this.frailejonRoseta);
    this.posFrailejones = [];
    reiniciarAzar(31);
    while (this.posFrailejones.length < this.nFrailejones) {
      const x = (azar() - 0.5) * 380;
      const z = -200 + azar() * 380;
      const r = Math.hypot(x, z);
      if (r < this.Ru * 1.25) continue;
      if (z > this.Ru && Math.abs(x - this.xQuebrada(z)) < 8) continue;
      this.posFrailejones.push([x, z, 0.7 + azar() * 0.7, azar()]);
    }
    // Potreros (con vacas) y cultivos de papa: parches en las laderas del oriente y del occidente
    this.vacas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x5b4636, flatShading: true }), 60);
    this.grupoParamo.add(this.vacas);
    this.papa = [];
    const texPapa = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.fillStyle = '#6d5a3a'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#5f8f3a'; for (let k = 0; k < 8; k++) g.fillRect(0, k * 8 + 2, 64, 4);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    for (let k = 0; k < 10; k++) {
      const parcela = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ map: texPapa, roughness: 1 }));
      parcela.rotation.x = -Math.PI / 2;
      const x = (k % 2 ? 1 : -1) * (85 + 22 * Math.floor(k / 2) * 0.6);
      const z = -20 - 26 * Math.floor(k / 2);
      parcela.position.set(x, this.altura(x, z) + 0.35, z);
      parcela.rotation.z = (k % 2 ? 0.3 : -0.3);
      parcela.visible = false;
      this.grupoParamo.add(parcela);
      this.papa.push(parcela);
    }
    this.indexar(this.grupoParamo);
  }

  construirPueblo() {
    reiniciarAzar(77);
    const zP = Z_PUEBLO;
    for (let k = 0; k < 9; k++) {
      const lado = k % 2 ? 1 : -1;
      const x = this.xQuebrada(zP) + lado * (9 + azar() * 16);
      const z = zP - 12 + azar() * 30;
      const c = casa({ ancho: 3.6, fondo: 4.2, alto: 2.6, pared: 0xece4d2, techo: [0xb5533a, 0x9a4a32, 0xc96c48][k % 3] });
      c.position.set(x, this.altura(x, z), z);
      c.rotation.y = azar() * 0.6 - 0.3;
      this.grupoPueblo.add(c);
    }
    // Inundación del pueblo (si la crecida no cabe en el cauce)
    this.inundacion = new THREE.Mesh(new THREE.PlaneGeometry(46, 40), new THREE.MeshStandardMaterial({ color: 0x6f6a4a, transparent: true, opacity: 0.7 }));
    this.inundacion.rotation.x = -Math.PI / 2;
    this.inundacion.position.set(this.xQuebrada(zP), this.altura(this.xQuebrada(zP), zP) + 0.9, zP);
    this.inundacion.visible = false;
    this.grupoPueblo.add(this.inundacion);
    this.indexar(this.grupoPueblo);
  }

  construirNubes() {
    this.nubes = [];
    reiniciarAzar(9);
    for (let k = 0; k < 9; k++) {
      const n = nube(4 + azar() * 4, 0xffffff, 0.9);
      n.position.set(-150 + azar() * 300, 95 + azar() * 25, -170 + azar() * 260);
      this.scene.add(n);
      this.nubes.push(n);
    }
    this.lluvia = new Lluvia(this.scene, 2600, { x0: -160, x1: 160, z0: -200, z1: 200, y0: -5, y1: 110 });
    this.lluvia.visible = false;
    // Niebla del páramo: velo blanco a media ladera
    this.velo = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false }));
    this.velo.rotation.x = -Math.PI / 2;
    this.velo.position.y = 26;
    this.scene.add(this.velo);
    // Jaulas de trucha
    this.jaulas = [];
    for (let k = 0; k < 12; k++) {
      const j = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 6, 18), new THREE.MeshStandardMaterial({ color: 0xe0a33a }));
      j.rotation.x = Math.PI / 2;
      j.visible = false;
      this.grupoTruchas.add(j);
      this.jaulas.push(j);
    }
    this.indexar(this.grupoTruchas);
  }

  /** Lámina del corte: perfil de la cubeta con el agua (luz) y el lodo, en el plano z = 0. */
  armarCorte() {
    while (this.grupoCorte.children.length) this.grupoCorte.remove(this.grupoCorte.children[0]);
    const Ru = this.Ru * 1.25;
    const forma = new THREE.Shape();
    forma.moveTo(-Ru, -this.hu * VS - 6);
    for (let k = 0; k <= 80; k++) {
      const x = -Ru + (2 * Ru * k) / 80;
      forma.lineTo(x, this.altura(x, 0.02));
    }
    forma.lineTo(Ru, -this.hu * VS - 6);
    forma.closePath();
    const suelo = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: 0x5c4b36, side: THREE.DoubleSide }));
    suelo.position.z = 0.05;
    this.grupoCorte.add(suelo);
    // Agua del corte: textura de luz que se apaga con la profundidad
    this.lienzoLuz = document.createElement('canvas');
    this.lienzoLuz.width = 4; this.lienzoLuz.height = 128;
    this.texLuz = new THREE.CanvasTexture(this.lienzoLuz);
    this.texLuz.colorSpace = THREE.SRGBColorSpace;
    this.aguaCorte = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: this.texLuz, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    this.aguaCorte.position.z = 0.1;
    this.grupoCorte.add(this.aguaCorte);
    // Lodo depositado (exagerado)
    this.lodo = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x3e3326, side: THREE.DoubleSide }));
    this.lodo.position.z = 0.12;
    this.grupoCorte.add(this.lodo);
    // Rótulos del corte
    this.rotLuz = [rotulo('100 % de luz', 'rotulo3d claro'), rotulo('10 %', 'rotulo3d claro'), rotulo('1 %', 'rotulo3d claro')];
    for (const r of this.rotLuz) this.grupoCorte.add(r);
    this.grupoCorte.visible = false;
    this.indexar(this.grupoCorte);
  }

  /** Redibuja el agua y el lodo del corte con el nivel y la turbidez de ahora. */
  pintarCorte(h, kd, mmAno) {
    const Ru = this.Ru;
    const yW = (h - this.hu) * VS;
    const R = Ru * Math.sqrt(Math.max(h, 0.01) / this.hu);
    const pts = [];
    const n = 60;
    for (let k = 0; k <= n; k++) {
      const x = -R + (2 * R * k) / n;
      pts.push([x, Math.min(yW, this.altura(x, 0.02))]);
    }
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const [x, yb] = pts[k];
      pos.push(x, yW, 0, x, yb, 0);
      uv.push(0, 1, 0, 1 - (yW - yb) / (Math.max(h, 0.01) * VS));
      if (k < n) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.aguaCorte.geometry.dispose();
    this.aguaCorte.geometry = g;
    // Degradado de luz: I/I₀ = e^(−k_d·z) en la profundidad real
    const ctx = this.lienzoLuz.getContext('2d');
    for (let j = 0; j < 128; j++) {
      const z = (j / 127) * h;
      const f = Math.exp(-kd * z);
      const c = new THREE.Color(0x0d2a3a).lerp(new THREE.Color(0x7fd0ef), f);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(0, j, 4, 1);
    }
    this.texLuz.needsUpdate = true;
    // Rótulos de 100 %, 10 % y 1 % de luz
    const prof = [0, Math.log(10) / kd, Math.log(100) / kd];
    this.rotLuz.forEach((r, k) => {
      const z = prof[k];
      r.visible = z <= h;
      r.position.set(-R * 0.35, yW - z * VS - (k === 0 ? -1 : 0), 0.3);
    });
    // Lodo: capa en el fondo con espesor exagerado según la tasa de colmatación
    const e = Math.min(2.5, 0.25 + mmAno * 0.6);
    const posL = [], idxL = [];
    for (let k = 0; k <= n; k++) {
      const x = -Ru + (2 * Ru * k) / n;
      const yb = this.altura(x, 0.02);
      posL.push(x, yb + e * (1 - (x / Ru) ** 2), 0, x, yb, 0);
      if (k < n) { const a = 2 * k; idxL.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const gl = new THREE.BufferGeometry();
    gl.setAttribute('position', new THREE.Float32BufferAttribute(posL, 3));
    gl.setIndex(idxL);
    this.lodo.geometry.dispose();
    this.lodo.geometry = gl;
  }

  // ── Actualización con el modelo ─────────────────────────────────────────
  aplicar(p, r, sim) {
    const { Au, hu } = S.geometria(p);
    const Ru = M.radioEspejo(Au) / ESC;
    const fG = Math.min(1.2, r.gl.A / 0.25);
    const degradado = p.estadoParamo === 'degradado';
    const cambioForma = Math.abs(Ru - this.Ru) > 1e-6 || Math.abs(hu - this.hu) > 1e-6;
    if (cambioForma || Math.abs(fG - this.fGlaciar) > 0.01 || degradado !== this.degradado) {
      this.Ru = Ru; this.hu = hu; this.fGlaciar = fG; this.degradado = degradado;
      this.repintarTerreno(this.malla);
      if (cambioForma) this.armarGeometriaDependiente();
    }
    const h = r.h;
    const yW = (h - hu) * VS;
    const R = Ru * Math.sqrt(Math.max(h, 0.01) / hu);
    this.agua.scale.set(R, R, 1);
    this.agua.position.y = yW;
    // Color del agua: clara, turbia por algas o por lodo
    const c = this.matAgua.color;
    const fTurbia = Math.min(1, Math.max(0, (r.ca.kd - 0.35) / 0.9));
    const fLodo = Math.min(1, r.ca.SS / 20);
    c.copy(AGUA_CLARA).lerp(r.ca.Chl > 8 ? AGUA_TURBIA : AGUA_LODO, Math.max(fTurbia, fLodo * 0.8));
    this.matAgua.opacity = 0.7 + 0.25 * fTurbia;
    this.vientoAhora = p.viento;
    const m = new THREE.Matrix4();
    const firmaVeg = `${R.toFixed(2)}|${yW.toFixed(2)}|${r.ca.V.toFixed(3)}|${p.estadoParamo}|${p.areaPapa}|${p.areaPotrero}|${this.fGlaciar.toFixed(2)}`;
    const rehacer = firmaVeg !== this.firmaVeg;
    this.firmaVeg = firmaVeg;
    // Plantas del fondo (las visibles según la cobertura)
    if (rehacer) {
    const q = new THREE.Quaternion();
    const nVis = Math.round(this.nPlantas * Math.min(1, r.ca.V));
    for (let k = 0; k < this.nPlantas; k++) {
      const [ang, rr, s] = this.posPlantas[k];
      const x = Math.sin(ang) * rr * R, z = Math.cos(ang) * rr * R;
      const yb = this.altura(x, z);
      const escala = k < nVis && yb < yW - 0.4 ? s : 0.0001;
      m.compose(new THREE.Vector3(x, yb, z), q, new THREE.Vector3(escala, escala, escala));
      this.plantas.setMatrixAt(k, m);
    }
    this.plantas.instanceMatrix.needsUpdate = true;
    // Frailejones según el estado del páramo y los usos
    const fr = { conservado: 1, intervenido: 0.55, degradado: 0.15 }[p.estadoParamo] ?? 1;
    const nF = Math.round(this.nFrailejones * fr);
    for (let k = 0; k < this.nFrailejones; k++) {
      const [x, z, s] = this.posFrailejones[k];
      const y = this.altura(x, z);
      const ver = k < nF && y < 44 && y > 0.4;
      const e = ver ? s : 0.0001;
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(e, e, e));
      this.frailejonTallo.setMatrixAt(k, m);
      this.frailejonRoseta.setMatrixAt(k, m);
    }
    this.frailejonTallo.instanceMatrix.needsUpdate = this.frailejonRoseta.instanceMatrix.needsUpdate = true;
    const nPapa = Math.min(this.papa.length, Math.ceil(p.areaPapa / 12));
    this.papa.forEach((pp, k) => { pp.visible = k < nPapa; });
    const nVacas = Math.min(60, Math.round(p.areaPotrero / 3));
    reiniciarAzar(404);
    for (let k = 0; k < 60; k++) {
      const x = 60 + azar() * 60, z = 20 + azar() * 70;
      const y = this.altura(x, z);
      const e = k < nVacas ? 1 : 0.0001;
      m.compose(new THREE.Vector3(x, y + 0.55, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, azar() * 3, 0)), new THREE.Vector3(e, e, e));
      this.vacas.setMatrixAt(k, m);
    }
    this.vacas.instanceMatrix.needsUpdate = true;
    }
    // Jaulas de trucha
    const nJ = Math.min(this.jaulas.length, Math.ceil(p.truchas / 5));
    this.jaulas.forEach((j, k) => {
      const ang = 2.4 + k * 0.42;
      j.visible = k < nJ;
      j.position.set(Math.sin(ang) * R * 0.6, yW + 0.15, Math.cos(ang) * R * 0.6);
    });
    // Quebrada: caudal del vertedero (o del vaciado)
    const Qsale = r.q.Qvert + r.q.Qglof;
    this.flujoQuebradaActivo = Qsale > 1e-4;
    this.flujoQuebrada.visible = this.flujoQuebradaActivo && this.vista !== 'corte';
    this.flujoQuebrada.velocidad = Math.min(60, 6 + 40 * Math.sqrt(Qsale));
    this.flujoQuebrada.mat.size = r.q.Qglof > 0 ? 1.6 : 0.75;
    this.flujoQuebrada.mat.color.set(r.q.Qglof > 0 ? 0x9b8a62 : 0xe3f4fb);
    this.cintaQuebrada.material.color.set(Qsale > 1e-4 ? (r.q.Qglof > 0 ? 0x7a6a48 : 0x3d93bd) : 0x8b8170);
    this.cintaQuebrada.scale.y = 0.15 + Math.min(1.2, 0.3 * Math.sqrt(Qsale * 10));
    this.flujoDeshielo.visible = r.q.Qg > 1e-4;
    this.flujoDeshielo.velocidad = 8 + 300 * r.q.Qg;
    this.dique.visible = p.cierre === 'morrena';
    this.inundacion.visible = Boolean(r.glof) && r.am.desborda && r.t - r.glof.t0 > r.am.tViaje;
    // Clima: nubes, lluvia y niebla
    const lluviaHoy = S.lluviaDia(p, r.d);
    this.lluvia.visible = lluviaHoy > 2.5;
    this.lluvia.mat.opacity = Math.min(0.85, 0.25 + lluviaHoy / 12);
    this.nubes.forEach((n, k) => { n.visible = k < 3 + Math.round(lluviaHoy * 1.2); });
    this.velo.material.opacity = p.estadoParamo === 'conservado' && lluviaHoy > 2 ? 0.14 : 0;
    // Corte (solo se rehace si cambió el nivel, la turbidez o el lodo)
    const firmaCorte = `${h.toFixed(2)}|${r.ca.kd.toFixed(3)}|${r.sed.mmAno.toFixed(2)}|${this.Ru}`;
    if (firmaCorte !== this.firmaCorte) { this.pintarCorte(h, r.ca.kd, r.sed.mmAno); this.firmaCorte = firmaCorte; }

    // Etiquetas
    const nivelLag = r.h < r.q.hToma ? 'alerta' : (r.q.Qvert > 1e-5 ? 'ok' : 'aviso');
    this.etiqueta('laguna', `${fmt(h, 2)} m · ${fmt(r.V / 1000, 1)} mil m³ · ${fmt(r.A / 10000, 2)} ha`, nivelLag, [0, yW + 3, -R * 0.45]);
    const xs = this.xQuebrada(Ru + 14);
    this.etiqueta('vertedero', r.glof ? `vaciado: ${fmt(r.q.Qglof, 1)} m³/s` : (r.q.Qvert > 1e-5 ? `rebosa ${fmt(r.q.Qvert * 1000, 1)} L/s` : 'no rebosa: quebrada seca'), r.glof ? 'alerta' : (r.q.Qvert >= r.laguna.Qeco ? 'ok' : 'aviso'), [xs + 3, this.altura(xs, Ru + 14) + 2, Ru + 14]);
    this.etiqueta('toma', r.q.Qext > 0 ? `${fmt(r.q.Qext * 1000, 1)} L/s al acueducto` : (p.extraccion > 0 ? 'fuera del agua: no capta' : 'cerrada'), r.q.Qext > 0 || p.extraccion === 0 ? 'ok' : 'alerta', [Ru + 32, this.altura(Ru + 32, Ru + 20) + 6, Ru + 20]);
    this.etiqueta('paramo', `${fmt(r.q.Qp * 1000, 1)} L/s · k = ${r.paramo.k} días`, r.paramo.k >= 30 ? 'ok' : 'alerta', [-95, this.altura(-95, -30) + 10, -30]);
    this.etiqueta('glaciar', r.gl.A > 0.005 ? `${fmt(r.gl.A, 2)} km² · deshielo ${fmt(r.q.Qg * 1000, 1)} L/s` : 'casi desaparecido', r.gl.A > 0.01 ? 'ok' : 'aviso', this.posGlaciar);
    this.etiqueta('calidad', r.ca.V >= 0.5 ? `clara · Secchi ${fmt(r.ca.DS, 1)} m · ${r.ca.clase}` : `turbia · Secchi ${fmt(r.ca.DS, 1)} m · ${r.ca.clase}`, r.ca.V >= 0.5 ? (r.oxigeno.ODmin >= 5 ? 'ok' : 'aviso') : 'alerta', [R * 0.35, yW + 0.8, R * 0.3]);
    this.etiqueta('viento', `${fmt(p.viento, 1)} m/s · olas de ${fmt(r.olas.H * 100, 1)} cm`, r.olas.fFondo <= 0.25 ? 'ok' : 'aviso', [-R * 0.6, yW + 2, R * 0.55]);
    this.etiqueta('sedimento', `${fmt(r.sed.mmAno, 2)} mm/año · se llena en ${fmt(r.sed.vidaUtil, 0)} años`, r.sed.fraccionAno <= 0.001 ? 'ok' : 'alerta', [Ru * 0.55, -hu * VS * 0.7, 0.4]);
    this.etiqueta('cierre', p.cierre === 'morrena' ? 'dique de morrena' : 'umbral de roca', p.cierre === 'morrena' ? 'aviso' : 'ok', [this.xQuebrada(Ru) - 8, 3, Ru + 2]);
    const zp = Z_PUEBLO;
    this.etiqueta('pueblo', p.cierre === 'morrena' ? `a ${fmt(p.distanciaPueblo, 1)} km · crecida ${fmt(r.am.Qpueblo, 1)} de ${fmt(r.am.capacidad, 1)} m³/s` : `a ${fmt(p.distanciaPueblo, 1)} km · sin amenaza`, r.glof ? 'alerta' : (p.cierre === 'morrena' && r.am.desborda ? 'aviso' : 'ok'), [this.xQuebrada(zp), this.altura(this.xQuebrada(zp), zp) + 10, zp]);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    // En el corte, el frente del terreno y del agua se recortan como una maqueta
    const cortar = nombre === 'corte';
    const planos = cortar ? [this.planoCorte] : [];
    if (this.malla) {
      for (const mat of [this.malla.material, this.matAgua, this.plantas.material, this.frailejonTallo.material, this.frailejonRoseta.material, this.vacas.material, ...this.papa.map((x) => x.material), ...this.jaulas.map((x) => x.material)]) {
        mat.clippingPlanes = planos;
        mat.needsUpdate = true;
      }
      this.grupoCorte.visible = cortar;
      this.grupoVert.visible = this.grupoToma.visible = this.grupoCierre.visible = !cortar;
      if (this.flujoQuebrada) this.flujoQuebrada.obj.visible = !cortar && this.flujoQuebradaActivo;
    }
  }

  paso(dt, t) {
    if (!this.matAgua) return;
    const v = 0.01 + 0.004 * (this.vientoAhora ?? 6);
    this.matAgua.map.offset.x = (this.matAgua.map.offset.x + v * dt) % 1;
    this.matAgua.map.offset.y = (this.matAgua.map.offset.y + v * 0.6 * dt) % 1;
    this.flujoQuebrada?.paso(dt);
    this.flujoDeshielo?.paso(dt);
    this.lluvia?.paso(dt);
    for (const n of this.nubes ?? []) { n.position.x += dt * 1.5; if (n.position.x > 170) n.position.x = -170; }
    for (const j of this.jaulas ?? []) if (j.visible) j.position.y += Math.sin(t * 1.4 + j.position.x) * 0.002;
  }
}
