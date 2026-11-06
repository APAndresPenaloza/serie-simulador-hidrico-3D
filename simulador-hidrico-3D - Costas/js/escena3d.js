/**
 * escena3d.js — La playa en 3D (Three.js).
 * Una playa de bahía entre dos cabos rocosos: la arena con sus parasoles, el malecón con sus
 * palmeras, los edificios y los cerros detrás; bajo el agua, el perfil de equilibrio de Dean.
 * Las crestas de las olas se tuercen al acercarse para llegar casi paralelas a la orilla y se
 * vuelven espuma donde rompen; el agua sube y baja por la arena con el remonte. Mar afuera
 * sale el emisario submarino con su pluma, que se aclara al acercarse a la costa. En la vista
 * Perfil la mitad oriental se recorta y se ve el perfil de la playa hasta la profundidad de
 * cierre. La escena solo dibuja: los números vienen de sistema.js.
 */
import { EscenaBase, THREE, materialAgua, caja, cilindro, palmera, nube, FlujoCurva, azar, reiniciarAzar, suave, mezclar, ruidoSuave, rotulo } from './nucleo/escena-base.js';
import * as M from './modelo.js';
import * as S from './sistema.js';
import { fmt, miles } from './nucleo/formato.js';

const ESC = 10;                       // metros por unidad horizontal
const BAHIA = 150;                    // medio ancho de la bahía (1.5 km)
const X_EMISARIO = -110;
const limitar01 = (v) => Math.min(1, Math.max(0, v));
/** Línea del malecón: la bahía es una parábola cóncava hacia el mar. */
const zMalecon = (x) => 6 - 60 * (x / BAHIA) ** 2;

const COLOR = {
  arena: new THREE.Color(0xe6d3a3), arenaMojada: new THREE.Color(0xc9b383), fondo: new THREE.Color(0xd7c592),
  hondo: new THREE.Color(0x5f7a80), roca: new THREE.Color(0x7d7468), cerro: new THREE.Color(0xa99a62),
  monte: new THREE.Color(0x7f9150), anden: new THREE.Color(0xbdb6a8), ciudad: new THREE.Color(0xc8c2b4),
};

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xcfe5ee;
    this.niebla = [420, 1200];
    this.pestanaVista = { oleaje: 'playa', rompiente: 'rompiente', nivel: 'playa', perfil: 'perfil', arena: 'playa', mar: 'playa', calidad: 'emisario' };
    this.W = 40;
    this.A = 0.1115;
    this.berma = 1.5;
    this.malecon = 2.4;
    this.ult = {};
  }

  vistasDefs() {
    return {
      playa: { pos: [70, 62, -175], mira: [0, 4, -5], etiquetas: ['oleaje', 'nivel', 'playa', 'arena', 'mar', 'bandera', 'calidad'] },
      rompiente: { pos: [38, 16, -62], mira: [5, 0, -18], etiquetas: ['rompiente', 'bandera', 'playa', 'nivel'] },
      perfil: { pos: [112, 9, -32], mira: [0, -5, -32], etiquetas: ['perfil'] },
      emisario: { pos: [10, 105, 75], mira: [-100, 0, -170], etiquetas: ['emisario', 'calidad', 'playa'] },
    };
  }

  etiquetasDefs() {
    return [
      ['oleaje', 'oleaje', 'Oleaje'],
      ['rompiente', 'rompiente', 'Rompiente'],
      ['bandera', 'rompiente', 'Bandera del salvavidas', 'secundaria'],
      ['nivel', 'nivel', 'Nivel del mar en el malecón'],
      ['playa', 'perfil', 'Playa seca'],
      ['perfil', 'perfil', 'Perfil de equilibrio'],
      ['arena', 'arena', 'Arena de la playa'],
      ['mar', 'mar', 'Ascenso del mar', 'secundaria'],
      ['emisario', 'calidad', 'Emisario submarino'],
      ['calidad', 'calidad', 'Agua de baño'],
    ];
  }

  centrosEtiquetas() { return { bandera: [0.5, 1], nivel: [0.5, 1], emisario: [0.5, 1] }; }

  /** Cotas de la playa a lo largo de x: berma, orilla (nivel medio) y malecón. */
  lineas(x) {
    const zm = zMalecon(x);
    const zb = zm - this.W / ESC;                          // cresta de la berma
    const zs = zb - this.berma / 0.08 / ESC;               // orilla con la pendiente del frente de playa
    return { zm, zb, zs };
  }

  altura(x, z) {
    const n1 = ruidoSuave(x + 500, z + 500, 30), n2 = ruidoSuave(x, z, 7);
    const { zm, zb, zs } = this.lineas(x);
    const u = this.ult;
    let y;
    u.zona = 'mar';
    if (z < zs) {
      const d = (zs - z) * ESC;                            // m mar adentro
      y = -Math.min(60, M.perfilDean(d, this.A)) + 0.15 * (n2 - 0.5);
    } else if (z < zb) {
      y = this.berma * (z - zs) / (zb - zs); u.zona = 'frente';
    } else if (z < zm) {
      y = this.berma + 0.08 * (n2 - 0.5); u.zona = 'seca';
    } else if (z < zm + 2.5) {
      y = this.malecon; u.zona = 'anden';
    } else {
      y = this.malecon + 0.4 + 30 * suave(limitar01((z - zm - 30) / 120)) * (0.6 + 0.8 * n1); u.zona = z < zm + 30 ? 'ciudad' : 'cerro';
    }
    // Cabos rocosos a los dos lados de la bahía
    const ax = Math.abs(x);
    if (ax > BAHIA - 25) {
      const t = suave(limitar01((ax - (BAHIA - 25)) / 40));
      const cabo = (8 + 26 * n1) * t * suave(limitar01((z + 95) / 40));
      if (cabo > y) { y = cabo; u.zona = 'roca'; }
    }
    return y;
  }

  colorTerreno(c, x, z, y) {
    const zona = this.ult.zona;
    if (zona === 'mar') { c.copy(COLOR.fondo).lerp(COLOR.hondo, limitar01(-y / 14)); return; }
    if (zona === 'frente') { c.copy(COLOR.arenaMojada).lerp(COLOR.arena, limitar01(y / this.berma)); return; }
    if (zona === 'seca') { c.copy(COLOR.arena); return; }
    if (zona === 'anden') { c.copy(COLOR.anden); return; }
    if (zona === 'ciudad') { c.copy(COLOR.ciudad); return; }
    if (zona === 'roca') { c.copy(COLOR.roca).lerp(COLOR.monte, limitar01((y - 6) / 20) * 0.6); return; }
    c.copy(COLOR.cerro).lerp(COLOR.monte, limitar01(ruidoSuave(x, z, 20)));
  }

  construir() {
    reiniciarAzar(2026);
    this.malla = this.terreno({ x0: -230, x1: 230, z0: -380, z1: 150, nx: 300, nz: 340, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.scene.add(this.malla);
    const sc = this.luzSol.shadow.camera;
    sc.left = -230; sc.right = 230; sc.top = 260; sc.bottom = -260; sc.far = 800;
    this.luzSol.position.set(120, 220, 60);
    sc.updateProjectionMatrix();
    this.planoCorte = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

    // Mar
    this.grupoMar = this.grupo('oleaje');
    this.matMar = materialAgua(0x1f7fb0, { opacidad: 0.8, repetir: 40 });
    this.mar = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900), this.matMar);
    this.mar.rotation.x = -Math.PI / 2;
    this.mar.position.set(0, 0, -400);
    this.mar.renderOrder = -1;          // el agua se dibuja antes que la espuma y las crestas
    this.grupoMar.add(this.mar);
    this.indexar(this.grupoMar);

    this.armarOlas();
    this.armarMalecon();
    this.armarPlaya();
    this.armarEmisario();
    this.armarObras();
    this.armarCorte();
    for (const [x, y, z, e] of [[-180, 70, -300, 6], [60, 85, -330, 5], [190, 75, -230, 6], [-120, 90, 140, 5], [150, 95, 130, 6]]) {
      const n = nube(e, 0xffffff, 0.92);
      n.position.set(x, y, z);
      this.scene.add(n);
    }
  }

  /** Crestas: tramos que se acercan y se tuercen para llegar paralelas a la orilla. */
  armarOlas() {
    this.grupoOlas = this.grupo('rompiente');
    this.nCrestas = 12;
    this.nTramos = 60;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.olas = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), this.nCrestas * this.nTramos);
    this.olas.frustumCulled = false;
    this.olas.renderOrder = 2;
    this.grupoOlas.add(this.olas);
    // Espuma del remonte, a lo largo de la orilla
    this.espuma = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    this.espuma.renderOrder = 2;
    this.grupoOlas.add(this.espuma);
    // Zona de rompientes: franja blanca que se desvanece mar adentro
    this.zonaRompiente = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.zonaRompiente.renderOrder = 2;
    this.grupoOlas.add(this.zonaRompiente);
    this.fase = 0;
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() };
    this.colMar = new THREE.Color(0x2f8dbd);
    this.colEspuma = new THREE.Color(0xffffff);
    this.indexar(this.grupoOlas);
  }

  armarMalecon() {
    this.grupoMalecon = this.grupo('nivel');
    reiniciarAzar(31);
    // Muro del malecón, palmeras y faroles
    const pts = [];
    for (let x = -BAHIA + 18; x <= BAHIA - 18; x += 3) pts.push(new THREE.Vector3(x, 0, zMalecon(x)));
    const curva = new THREE.CatmullRomCurve3(pts);
    const muro = new THREE.Mesh(new THREE.TubeGeometry(curva, 120, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0xa79f90, flatShading: true }));
    muro.position.y = 2.6;
    this.grupoMalecon.add(muro);
    this.muro = muro;
    for (let x = -BAHIA + 22; x <= BAHIA - 22; x += 9) {
      const pm = palmera(5 + azar() * 2.5);
      pm.position.set(x, this.malecon, zMalecon(x) + 1.4);
      pm.rotation.y = azar() * 6;
      this.grupoMalecon.add(pm);
    }
    // Inundación del malecón: una franja de agua sobre el andén
    const vs = [], ix = [];
    for (let x = -BAHIA + 20, k = 0; x <= BAHIA - 20; x += 4, k++) {
      vs.push(x, 0, zMalecon(x) - 0.3, x, 0, zMalecon(x) + 2.8);
      if (x + 4 <= BAHIA - 20) { const a = 2 * k; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    g.setIndex(ix);
    this.inundacion = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3f9fd0, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }));
    this.inundacion.visible = false;
    this.grupoMalecon.add(this.inundacion);
    this.indexar(this.grupoMalecon);
    // Edificios
    this.grupoCiudad = this.grupo('mar');
    for (let k = 0; k < 70; k++) {
      const x = -BAHIA + 25 + azar() * (2 * BAHIA - 50);
      const z = zMalecon(x) + 6 + azar() * 26;
      const alto = 4 + azar() * azar() * 30;
      const b = caja(6 + azar() * 4, alto, 6 + azar() * 4, [0xf2efe8, 0xe8dcc8, 0xdfe7ea, 0xf0e2c8][k % 4]);
      b.position.set(x, this.altura(x, z) + alto / 2 - 0.2, z);
      this.grupoCiudad.add(b);
    }
    this.indexar(this.grupoCiudad);
  }

  armarPlaya() {
    this.grupoPlaya = this.grupo('perfil');
    reiniciarAzar(7);
    this.parasoles = [];
    const colores = [0xd64541, 0x2e86c1, 0xf1c40f, 0x27ae60, 0xe67e22, 0x8e44ad];
    for (let k = 0; k < 90; k++) {
      const g = new THREE.Group();
      const palo = cilindro(0.06, 0.06, 2.2, 0xeeeeee, { lados: 5 });
      palo.position.y = 1.1;
      const tela = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 8), new THREE.MeshStandardMaterial({ color: colores[k % colores.length], flatShading: true }));
      tela.position.y = 2.2;
      g.add(palo, tela);
      g.userData = { u: -BAHIA + 22 + azar() * (2 * BAHIA - 44), f: 0.2 + azar() * 0.65 };
      this.grupoPlaya.add(g);
      this.parasoles.push(g);
    }
    // Torre del salvavidas y bandera
    this.torre = new THREE.Group();
    const base = caja(1.6, 3, 1.6, 0xf2f2f2);
    base.position.y = 1.5;
    const mastil = cilindro(0.05, 0.05, 3, 0x888888, { lados: 5 });
    mastil.position.set(0.6, 4.5, 0);
    this.bandera = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x27ae60, side: THREE.DoubleSide }));
    this.bandera.position.set(1.3, 5.5, 0);
    this.torre.add(base, mastil, this.bandera);
    this.grupoPlaya.add(this.torre);
    this.indexar(this.grupoPlaya);
  }

  armarEmisario() {
    this.grupoEmisario = this.grupo('calidad');
    this.matTubo = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.6 });
    this.tuboEmisario = new THREE.Mesh(new THREE.BufferGeometry(), this.matTubo);
    this.difusor = new THREE.Group();
    for (let k = 0; k < 6; k++) { const r = cilindro(0.25, 0.25, 2.2, 0x555555, { lados: 6 }); r.position.set(0, 1.1, -k * 3); this.difusor.add(r); }
    this.grupoEmisario.add(this.tuboEmisario, this.difusor);
    // Pluma de agua residual que viaja hacia la playa (transparencia por vértice)
    const n = 50;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 5 * (n + 1)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(4 * 5 * (n + 1)), 4));
    const idx = [];
    for (let k = 0; k < n; k++) for (let j = 0; j < 4; j++) { const a = 5 * k + j; idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
    g.setIndex(idx);
    this.pluma = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.pluma.frustumCulled = false;
    this.pluma.renderOrder = 3;
    this.nPluma = n;
    this.grupoEmisario.add(this.pluma);
    this.burbujas = new FlujoCurva(this.scene, 60, [[X_EMISARIO, -20, -300], [X_EMISARIO, -1, -300]], { color: 0xd8e8c8, tamano: 0.9, ancho: 6, alto: 0.1 });
    this.indexar(this.grupoEmisario);
  }

  armarObras() {
    // Espolón al oriente y draga del relleno
    this.grupoObras = this.grupo('arena');
    this.espolon = new THREE.Group();
    for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + azar() * 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x8b8378, flatShading: true })); r.position.set((azar() - 0.5) * 1.6, 0, -k * 2.4); this.espolon.add(r); }
    this.grupoObras.add(this.espolon);
    this.draga = new THREE.Group();
    const casco = caja(5, 1.6, 12, 0xd8a13a);
    casco.position.y = 0.6;
    const cab = caja(3.4, 2.2, 3, 0xf2f2f2);
    cab.position.set(0, 2.4, 3.5);
    this.draga.add(casco, cab);
    this.tuberia = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    this.grupoObras.add(this.draga, this.tuberia);
    this.indexar(this.grupoObras);
  }

  /** Corte de la playa en x = 0: arena bajo el perfil y agua encima. */
  armarCorte() {
    this.grupoCorte = this.grupo('perfil');
    this.rotCorte = [rotulo('berma', 'rotulo3d claro'), rotulo('profundidad de cierre', 'rotulo3d claro'), rotulo('rompiente', 'rotulo3d claro')];
    for (const r of this.rotCorte) this.grupoCorte.add(r);
    this.lineaCierre = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.5, gapSize: 1 }));
    this.grupoCorte.add(this.lineaCierre);
    this.grupoCorte.visible = false;
  }

  plano(puntos, color, x = 0.08) {
    const f = new THREE.Shape();
    f.moveTo(puntos[0][0], puntos[0][1]);
    for (const [a, b] of puntos.slice(1)) f.lineTo(a, b);
    f.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(f), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.rotation.y = Math.PI / 2;
    m.position.x = x;
    return m;
  }

  pintarCorte(p, r, yMar) {
    for (const m of [this.corteArena, this.corteAgua]) if (m) { this.grupoCorte.remove(m); m.geometry.dispose(); }
    const { zm, zb, zs } = this.lineas(0);
    const arena = [[-(zm + 4), this.malecon], [-zm, this.malecon], [-zm, this.berma], [-zb, this.berma], [-zs, 0]];
    for (let d = 1; d <= 70; d += 1.5) arena.push([-(zs - d), -M.perfilDean(d * ESC, this.A)]);
    arena.push([-(zs - 70), -14], [-(zm + 4), -14]);
    this.corteArena = this.plano(arena, 0xd9c48f, 0.06);
    const agua = [];
    let d0 = 1.5;
    if (yMar >= 0) {
      const zw = zs + (yMar / this.berma) * (zb - zs);
      agua.push([-zw, yMar], [-zs, 0]);
    } else {
      const dw = M.distanciaDean(-yMar, this.A) / ESC;
      agua.push([-(zs - dw), yMar]);
      d0 = dw + 1.5;
    }
    for (let d = d0; d <= 70; d += 1.5) agua.push([-(zs - d), -M.perfilDean(d * ESC, this.A)]);
    agua.push([-(zs - 70), yMar]);
    this.corteAgua = this.plano(agua, 0x2a7fb0, 0.1);
    this.grupoCorte.add(this.corteArena, this.corteAgua);
    const dc = r.pr.xc / ESC;
    this.lineaCierre.geometry.dispose();
    this.lineaCierre.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.15, -r.pr.hc, zs - dc), new THREE.Vector3(0.15, -r.pr.hc, zs - 70), new THREE.Vector3(0.15, -r.pr.hc, zs - dc), new THREE.Vector3(0.15, 0.5, zs - dc)]);
    this.lineaCierre.computeLineDistances();
    this.rotCorte[0].position.set(0.3, this.berma + 1.2, (zb + zm) / 2);
    this.rotCorte[1].position.set(0.3, -r.pr.hc - 1.2, zs - dc - 6);
    const db = M.distanciaDean(r.q.hb, this.A) / ESC;
    this.rotCorte[2].position.set(0.3, 1.4, zs - db);
  }

  aplicar(p, r) {
    const pr = r.pr;
    // Forma de la playa: se rehace si cambian el ancho, la arena, la berma o el malecón
    const W = Math.round(r.W);
    const forma = `${W}|${pr.A.toFixed(4)}|${p.berma}|${p.malecon}`;
    if (forma !== this.forma) {
      const primera = this.forma === undefined;
      this.forma = forma;
      this.W = W; this.A = pr.A; this.berma = p.berma; this.malecon = p.malecon;
      if (!primera || forma !== '40|0.1115|1.5|2.4') this.repintarTerreno(this.malla);
      this.colocarPlaya(p, r);
      this.firmaCorte = null;
    }
    const q = r.q;
    const yMar = q.eta + q.surge;
    this.yMar = yMar;
    this.mar.position.y = yMar;
    this.matMar.color.setHex(r.torm ? 0x3f7f9a : 0x1f7fb0);
    // Rompiente, olas y remonte
    this.olaH = q.H0;
    this.dRompe = M.distanciaDean(q.hb, pr.A) / ESC;
    this.remonteU = q.R2 / p.pendiente / ESC;
    this.theta0 = q.theta0;
    this.periodoOla = q.T;
    // Franja de la rompiente (se rehace si cambia su ancho o la orilla)
    const firmaZ = `${this.dRompe.toFixed(1)}|${this.forma}|${yMar.toFixed(2)}`;
    if (firmaZ !== this.firmaZona) {
      this.firmaZona = firmaZ;
      const vs = [], cs = [], ix = [];
      let k = 0;
      for (let x = -BAHIA + 12; x <= BAHIA - 12; x += 3, k++) {
        const zs = this.lineas(x).zs;
        vs.push(x, yMar + 0.1, zs + 0.5, x, yMar + 0.1, zs - this.dRompe * 0.5, x, yMar + 0.1, zs - this.dRompe * 1.15);
        cs.push(1, 1, 1, 0.7, 1, 1, 1, 0.45, 1, 1, 1, 0);
        if (x + 3 <= BAHIA - 12) { const a = 3 * k; ix.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      }
      const g = this.zonaRompiente.geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 4));
      g.setIndex(ix);
      g.computeBoundingSphere();
    }
    // Inundación del malecón
    this.inundacion.visible = q.TWL > p.malecon;
    this.inundacion.position.y = p.malecon + 0.05;
    // Bandera: verde, amarilla, roja o morada (agua contaminada)
    const V = Math.abs(q.V);
    let color = 0x27ae60, texto = 'verde: baño permitido';
    if (r.col.C > 200) { color = 0x8e44ad; texto = 'morada: agua contaminada'; }
    else if (q.H0 > 2.5 || V > 0.6 || r.torm) { color = 0xd64541; texto = 'roja: prohibido bañarse'; }
    else if (q.H0 > 1.5 || V > 0.3) { color = 0xf1c40f; texto = 'amarilla: precaución'; }
    this.bandera.material.color.setHex(color);
    this.textoBandera = texto;
    // Obras
    this.espolon.visible = p.retencion >= 0.25;
    this.draga.visible = p.relleno > 0;
    this.tuberia.visible = p.relleno > 0;
    // Emisario y su pluma
    const xE = p.xEmisario * 1000 / ESC;
    const { zs } = this.lineas(X_EMISARIO);
    const zD = zs - xE;
    const firmaE = `${xE.toFixed(1)}|${p.zEmisario}`;
    if (firmaE !== this.firmaEmisario) {
      this.firmaEmisario = firmaE;
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const z = mezclar(zs + 3, zD, k / 40);
        pts.push(new THREE.Vector3(X_EMISARIO, Math.max(-p.zEmisario, this.altura(X_EMISARIO, z)) + 0.4, z));
      }
      this.tuboEmisario.geometry.dispose();
      this.tuboEmisario.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.55, 6);
      this.difusor.position.set(X_EMISARIO, pts[pts.length - 1].y, zD + 8);
      this.burbujas.obj.position.set(0, 0, zD + 300);
    }
    // Pluma: de la descarga hacia la playa, con la transparencia que sigue a log₁₀(C)
    const pos = this.pluma.geometry.attributes.position, col = this.pluma.geometry.attributes.color;
    const C0p = p.C0 / r.col.S1;
    for (let k = 0; k <= this.nPluma; k++) {
      const t = k / this.nPluma;
      const z = mezclar(zD, zs - 4, t);
      const x = X_EMISARIO + 18 * Math.sin(t * 2.2);
      const w = 4 + 26 * t;
      const Cx = (C0p / (1 + (t * xE * ESC) / p.Ld)) * 10 ** (-r.col.exponente * t);
      const alfa = limitar01(Math.log10(Math.max(1, Cx)) / 5) * 0.75;
      for (let j = 0; j < 5; j++) {
        const u = (j - 2) / 2;
        pos.setXYZ(5 * k + j, x + w * u, yMar + 0.12, z);
        col.setXYZW(5 * k + j, 0.45, 0.52, 0.28, alfa * (1 - 0.85 * u * u));
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.burbujas.visible = true;
    // Corte
    const firmaC = `${yMar.toFixed(2)}|${q.hb.toFixed(2)}|${pr.hc.toFixed(2)}`;
    if (firmaC !== this.firmaCorte) { this.firmaCorte = firmaC; this.pintarCorte(p, r, yMar); }

    // Etiquetas
    const lin0 = this.lineas(0);
    const ok = (b) => (b ? 'ok' : 'alerta');
    this.etiqueta('oleaje', `H_s ${fmt(q.H0, 2)} m · T ${fmt(q.T, 1)} s`, q.H0 <= 2.5 ? 'ok' : 'aviso', [45, 5, lin0.zs - 110]);
    this.etiqueta('rompiente', `rompe a ${fmt(q.hb, 2)} m de fondo · H_b ${fmt(q.Hb, 2)} m`, V <= 0.6 ? 'ok' : 'aviso', [15, 3, lin0.zs - this.dRompe]);
    this.etiqueta('bandera', texto, color === 0x27ae60 ? 'ok' : (color === 0xf1c40f ? 'aviso' : 'alerta'), [this.torre.position.x, 7.5, this.torre.position.z]);
    this.etiqueta('nivel', `nivel total ${fmt(q.TWL, 2)} m · malecón ${fmt(p.malecon, 2)} m`, q.TWL <= p.malecon - 0.3 ? 'ok' : 'alerta', [-30, p.malecon + 4, zMalecon(-30) + 1]);
    this.etiqueta('playa', `${fmt(r.W, 1)} m de ancho · ${fmt(100 * r.ocupacion, 0)} % ocupada`, ok(r.W >= p.anchoMin), [40, this.berma + 3, (this.lineas(40).zb + zMalecon(40)) / 2]);
    this.etiqueta('perfil', `h = ${fmt(pr.A, 3)}·x^(2/3) · cierre a ${fmt(pr.hc, 2)} m`, 'ok', [0.3, 6, lin0.zs - 30]);
    this.etiqueta('arena', `${r.a.balance >= 0 ? '+' : '−'}${miles(Math.abs(r.a.balance))} m³/año · ${r.v >= 0 ? '+' : '−'}${fmt(Math.abs(r.v), 2)} m/año`, ok(r.a.balance >= 0), [BAHIA - 30, 4, this.lineas(BAHIA - 30).zs - 6]);
    this.etiqueta('mar', `retroceso de ${fmt(r.bruun50, 1)} m en 50 años`, r.bruun50 <= 0.25 * p.ancho0 ? 'ok' : 'aviso', [-70, 22, zMalecon(-70) + 18]);
    this.etiqueta('emisario', `${fmt(p.xEmisario, 1)} km · ${fmt(p.zEmisario, 0)} m de fondo · dilución ${miles(r.col.S)}`, r.col.S >= 100 ? 'ok' : 'aviso', [X_EMISARIO, 5, zD]);
    this.etiqueta('calidad', `${miles(r.col.C)} NMP/100 mL en la playa`, r.Cmax <= 200 ? 'ok' : 'alerta', [X_EMISARIO + 20, 4, this.lineas(X_EMISARIO + 20).zs - 10]);
  }

  /** Parasoles, torre y obras sobre la playa de ahora. */
  colocarPlaya(p, r) {
    const visibles = Math.round(Math.min(1, r.ocupacion) * this.parasoles.length);
    this.parasoles.forEach((g, k) => {
      const x = g.userData.u;
      const { zb, zm } = this.lineas(x);
      g.visible = k < visibles && zm - zb > 1;
      g.position.set(x, this.berma, mezclar(zb + 0.6, zm - 0.6, g.userData.f));
    });
    const xt = 25;
    const lt = this.lineas(xt);
    this.torre.position.set(xt, this.berma, Math.max(lt.zb + 0.5, (lt.zb + lt.zm) / 2));
    const xe = BAHIA - 22;
    this.espolon.position.set(xe, 0.2, this.lineas(xe).zb);
    const xd = 30;
    const ld = this.lineas(xd);
    this.draga.position.set(xd, 0, ld.zs - 45);
    const pts = [new THREE.Vector3(xd, 0.6, ld.zs - 39), new THREE.Vector3(xd, 0.2, ld.zs - 10), new THREE.Vector3(xd, this.berma + 0.3, ld.zb)];
    this.tuberia.geometry.dispose();
    this.tuberia.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.35, 6);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    if (!this.malla) return;
    const cortar = nombre === 'perfil';
    const planos = cortar ? [this.planoCorte] : [];
    const mats = new Set([this.malla.material, this.matMar, this.olas.material, this.espuma.material, this.pluma.material, this.zonaRompiente.material]);
    for (const g of [this.grupoMalecon, this.grupoCiudad, this.grupoPlaya, this.grupoObras, this.grupoEmisario]) g.traverse((o) => { if (o.material) mats.add(o.material); });
    for (const m of mats) { m.clippingPlanes = planos; m.needsUpdate = true; }
    this.grupoCorte.visible = cortar;
    if (this.p && this.r) this.aplicar(this.p, this.r, this.sim);
  }

  paso(dt, t) {
    if (!this.matMar) return;
    this.matMar.map.offset.y = (this.matMar.map.offset.y + 0.008 * dt) % 1;
    this.burbujas.paso(dt);
    // Crestas que avanzan; se tuercen cerca de la orilla y se vuelven espuma al romper
    const T = this.periodoOla ?? 7;
    const sep = 6;
    this.fase = (this.fase + (sep / T) * dt * 2.2) % sep;
    const { m, q, e, v, s } = this.tmp;
    const th = Math.tan(((this.theta0 ?? 5) * Math.PI) / 180);
    const zs0 = this.lineas(0).zs;
    const yMar = this.yMar ?? 0;
    const dR = this.dRompe ?? 12;
    let k = 0;
    for (let c = 0; c < this.nCrestas; c++) {
      const d = this.nCrestas * sep - (this.fase + c * sep);       // distancia a la orilla (unidades)
      const rompe = d < dR;
      for (let j = 0; j < this.nTramos; j++) {
        const x = -BAHIA + 12 + ((2 * BAHIA - 24) * (j + 0.5)) / this.nTramos;
        const { zs } = this.lineas(x);
        const f = Math.exp(-d / 25);                                 // cerca de la orilla, paralela a ella
        const z = f * (zs - d) + (1 - f) * (zs0 - d - x * th);
        const x2 = x + (2 * BAHIA - 24) / this.nTramos;
        const z2 = f * (this.lineas(x2).zs - d) + (1 - f) * (zs0 - d - x2 * th);
        const ang = Math.atan2(-(z2 - z), x2 - x);
        e.set(0, ang, 0);
        q.setFromEuler(e);
        const largo = Math.hypot(x2 - x, z2 - z) * 1.04;
        const ancho = rompe ? 1.6 + 2.4 * (1 - d / dR) : 0.45 + 0.25 * Math.min(3, this.olaH ?? 1);
        s.set(d > 0.3 && d < this.nCrestas * sep - 2 ? largo : 0, 1, ancho);
        v.set((x + x2) / 2, yMar + 0.12, (z + z2) / 2);
        m.compose(v, q, s);
        this.tmp.c.copy(this.colMar).lerp(this.colEspuma, rompe ? 1 : 0.25 + 0.35 * Math.exp(-(d - dR) / 20));
        this.olas.setColorAt(k, this.tmp.c);
        this.olas.setMatrixAt(k++, m);
      }
    }
    this.olas.instanceMatrix.needsUpdate = true;
    if (this.olas.instanceColor) this.olas.instanceColor.needsUpdate = true;
    this.olas.material.opacity = 0.8;
    // Remonte: la espuma sube y baja por el frente de playa
    const sube = (this.remonteU ?? 1) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / T));
    const ptsE = [];
    for (let x = -BAHIA + 14; x <= BAHIA - 14; x += 4) {
      const { zs, zb } = this.lineas(x);
      const zN = Math.min(zb, zs + yMar / this.berma * (zb - zs));
      ptsE.push([x, zN + sube]);
    }
    const g = this.espuma.geometry;
    const arr = new Float32Array(ptsE.length * 6);
    ptsE.forEach(([x, z], i) => {
      const yy = Math.min(this.berma, (z - this.lineas(x).zs) / (this.lineas(x).zb - this.lineas(x).zs) * this.berma) + 0.06;
      arr.set([x, yy, z - 0.6, x, yy, z + 0.4], 6 * i);
    });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const idx = [];
    for (let i = 0; i < ptsE.length - 1; i++) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx);
    g.computeBoundingSphere();
    // Draga del relleno que se mece
    if (this.draga.visible) this.draga.position.y = 0.1 * Math.sin(t * 1.3) + yMar;
  }
}
