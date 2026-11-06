/**
 * escena3d.js — El lago andino en 3D (Three.js).
 * Un lago alargado en un valle de alta montaña: la cuenca con sus quebradas, la cebolla en
 * franjas en las laderas, el pueblo de la orilla con su vertimiento, las jaulas de trucha,
 * la boya con la cadena de termómetros y el desagüe que forma el río. En la vista Corte el
 * frente del valle se recorta como una maqueta y se ven las capas del lago (epilimnion,
 * termoclina e hipolimnion) coloreadas por la temperatura y el oxígeno, con la termoclina
 * inclinada por el viento. La escena solo dibuja: los números vienen de sistema.js.
 */
import { EscenaBase, THREE, materialAgua, caja, cilindro, casa, nube, FlujoCurva, azar, reiniciarAzar, suave, ruidoSuave, rotulo } from './nucleo/escena-base.js';
import * as M from './modelo.js';
import * as S from './sistema.js';
import { fmt, miles } from './nucleo/formato.js';

const ESC = 50;      // metros por unidad horizontal
const VS = 0.5;      // unidades por metro de profundidad (exageración vertical ×25)
const VN = 4;        // exageración del nivel del agua (unidades por metro)
const COLOR = {
  ladera: new THREE.Color(0x7f9a52), paramo: new THREE.Color(0xa3a26a), roca: new THREE.Color(0x857d70),
  fondo: new THREE.Color(0x4a4636), orilla: new THREE.Color(0x8c8463), cebolla: new THREE.Color(0x6aa04a),
};
const AGUA_CLARA = new THREE.Color(0x2b78a6);
const AGUA_VERDE = new THREE.Color(0x4f8a4a);

export class Escena extends EscenaBase {
  constructor(contenedor, opciones) {
    super(contenedor, opciones);
    this.cielo = 0xd0dfe6;
    this.niebla = [380, 900];
    this.pestanaVista = { cuenca: 'cuenca', morfometria: 'corte', temperatura: 'corte', viento: 'general', oxigeno: 'corte', nutrientes: 'jaulas' };
    this.a = 123; this.b = 57; this.zmax = 60; this.m = 0.8;
  }

  vistasDefs() {
    return {
      general: { pos: [60, 215, 270], mira: [10, -5, 0], etiquetas: ['lago', 'desague', 'cuenca', 'pueblo', 'jaulas', 'boya'] },
      corte: { pos: [30, 20, 210], mira: [0, -14, 0], etiquetas: ['epilimnion', 'termoclina', 'hipolimnion', 'boya'] },
      cuenca: { pos: [-60, 120, -260], mira: [0, 10, -40], etiquetas: ['cuenca', 'cebolla', 'pueblo', 'lago'] },
      jaulas: { pos: [-15, 58, 70], mira: [-55, 0, 25], etiquetas: ['jaulas', 'boya', 'pueblo', 'lago'] },
    };
  }

  etiquetasDefs() {
    return [
      ['lago', 'cuenca', 'Lago'],
      ['desague', 'cuenca', 'Desagüe al río'],
      ['cuenca', 'cuenca', 'Quebradas de la cuenca', 'secundaria'],
      ['cebolla', 'nutrientes', 'Cebolla con gallinaza'],
      ['pueblo', 'nutrientes', 'Pueblo de la orilla'],
      ['jaulas', 'nutrientes', 'Jaulas de trucha'],
      ['boya', 'temperatura', 'Boya con termómetros'],
      ['epilimnion', 'temperatura', 'Epilimnion'],
      ['termoclina', 'viento', 'Termoclina'],
      ['hipolimnion', 'oxigeno', 'Hipolimnion'],
    ];
  }

  centrosEtiquetas() { return { lago: [0.5, 1], cebolla: [0.5, 1], pueblo: [0.5, 1], epilimnion: [0, 0.5], termoclina: [0, 0.5], hipolimnion: [0, 0.5], desague: [0, 0.5] }; }

  /** Radio elíptico normalizado (1 en la orilla). */
  rho(x, z) { return Math.hypot(x / this.a, z / this.b); }

  altura(x, z) {
    const r = this.rho(x, z);
    const fondo = -this.zmax * VS * (1 - Math.min(1, r) ** (2 / this.m));
    // Islas del lago
    const isla1 = 9 * Math.exp(-((x + 35) ** 2 + (z - 8) ** 2) / 90);
    const isla2 = 6 * Math.exp(-((x - 30) ** 2 + (z + 14) ** 2) / 50);
    const relieve = 8 * (ruidoSuave(x + 500, z + 500, 30) - 0.5) + 3 * (ruidoSuave(x, z, 11) - 0.5);
    const montes = 6 + 55 * suave(Math.min(1, Math.max(0, (r - 1.15) / 1.6))) + relieve;
    // Valle del desagüe hacia el oriente
    const valle = x > this.a * 0.9 ? Math.exp(-(z ** 2) / 260) * Math.min(1, (x - this.a * 0.9) / 30) : 0;
    let y;
    if (r < 1) y = fondo + Math.max(isla1, isla2) * (isla1 > 1 || isla2 > 1 ? 1.4 : 0);
    else {
      const t = suave(Math.min(1, (r - 1) / 0.25));
      y = 0.6 * t + montes * t;
    }
    if (valle > 0) y = Math.min(y, -0.2 - (x - this.a) * 0.08 + (1 - valle) * 40);
    return y;
  }

  colorTerreno(c, x, z, y) {
    const r = this.rho(x, z);
    if (r < 1 && y < 0) c.copy(COLOR.fondo).lerp(COLOR.orilla, Math.min(1, (y + this.zmax * VS) / (this.zmax * VS)) ** 3);
    else if (y > 48) c.copy(COLOR.paramo).lerp(COLOR.roca, Math.min(1, (y - 48) / 20));
    else c.copy(COLOR.ladera).lerp(COLOR.paramo, Math.max(0, (y - 20) / 40));
  }

  construir() {
    reiniciarAzar(3015);
    this.malla = this.terreno({ x0: -300, x1: 330, z0: -260, z1: 260, nx: 210, nz: 180, altura: (x, z) => this.altura(x, z), color: (c, x, z, y) => this.colorTerreno(c, x, z, y) });
    this.scene.add(this.malla);
    this.planoCorte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.01);

    this.grupoLago = this.grupo('cuenca');
    this.matAgua = materialAgua(AGUA_CLARA, { opacidad: 0.84, repetir: 18 });
    const forma = new THREE.Shape();
    forma.absellipse(0, 0, this.a * 1.004, this.b * 1.004, 0, Math.PI * 2, false, 0);
    this.agua = new THREE.Mesh(new THREE.ShapeGeometry(forma, 96), this.matAgua);
    this.agua.rotation.x = -Math.PI / 2;
    this.grupoLago.add(this.agua);
    this.indexar(this.grupoLago);

    // Desagüe: río que sale al oriente
    const ptsD = [];
    for (let x = this.a - 2; x <= 320; x += 8) ptsD.push([x, this.altura(x, 0) + 0.3, 3 * Math.sin(x / 25)]);
    this.flujoDesague = new FlujoCurva(this.scene, 260, ptsD, { color: 0xe3f4fb, tamano: 0.9, ancho: 2.5, alto: 0.2 });
    // Quebradas de la cuenca (norte y sur)
    this.flujosCuenca = [];
    for (const [x0, z0, x1, z1] of [[-60, -230, -40, -this.b], [40, -230, 30, -this.b * 0.95], [-20, 230, -10, this.b], [-140, 150, -110, this.b * 0.6]]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const x = x0 + ((x1 - x0) * k) / 12, z = z0 + ((z1 - z0) * k) / 12;
        pts.push([x, this.altura(x, z) + 0.4, z]);
      }
      this.flujosCuenca.push(new FlujoCurva(this.scene, 90, pts, { color: 0xeaf6fb, tamano: 0.7, ancho: 1.2, alto: 0.3 }));
    }

    // Cebolla: franjas verdes en las laderas
    this.grupoCebolla = this.grupo('nutrientes');
    const tex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.fillStyle = '#6f5b3c'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#69a548'; for (let k = 0; k < 6; k++) g.fillRect(0, k * 11 + 2, 64, 6);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.parcelas = [];
    for (let k = 0; k < 24; k++) {
      const ang = -Math.PI * 0.95 + (k % 12) * 0.17 + (k >= 12 ? Math.PI : 0);
      const rr = 1.32 + 0.18 * ((k * 7) % 3);
      const x = Math.cos(ang) * this.a * rr, z = Math.sin(ang) * this.b * rr * 1.25;
      const pp = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      pp.rotation.x = -Math.PI / 2;
      pp.rotation.z = ang;
      pp.position.set(x, this.altura(x, z) + 0.6, z);
      pp.visible = false;
      this.grupoCebolla.add(pp);
      this.parcelas.push(pp);
    }
    this.indexar(this.grupoCebolla);

    // Pueblo de la orilla (al suroccidente) y su vertimiento
    this.grupoPueblo = this.grupo('nutrientes');
    reiniciarAzar(12);
    for (let k = 0; k < 16; k++) {
      const x = -95 + azar() * 40, z = 46 + azar() * 26;
      if (this.rho(x, z) < 1.08) continue;
      const c = casa({ ancho: 4, fondo: 5, alto: 3, techo: [0xb5533a, 0x9a4a32, 0xc96c48][k % 3] });
      c.position.set(x, this.altura(x, z), z);
      c.rotation.y = azar() * 0.5;
      this.grupoPueblo.add(c);
    }
    this.mancha = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x8b6b3a, transparent: true, opacity: 0.45, depthWrite: false }));
    this.mancha.rotation.x = -Math.PI / 2;
    this.mancha.position.set(-78, 0.12, 40);
    this.grupoPueblo.add(this.mancha);
    this.indexar(this.grupoPueblo);

    // Jaulas de trucha y boya
    this.grupoJaulas = this.grupo('nutrientes');
    this.jaulas = [];
    for (let k = 0; k < 16; k++) {
      const j = new THREE.Group();
      const aro = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.25, 6, 20), new THREE.MeshStandardMaterial({ color: 0xe0a33a }));
      aro.rotation.x = Math.PI / 2;
      const red = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x334, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      red.position.y = -1.5;
      j.add(aro, red);
      j.position.set(-62 + (k % 4) * 7, 0.15, 18 + Math.floor(k / 4) * 7);
      j.visible = false;
      this.grupoJaulas.add(j);
      this.jaulas.push(j);
    }
    this.indexar(this.grupoJaulas);
    this.grupoBoya = this.grupo('temperatura');
    const boya = cilindro(1.4, 1.1, 1.6, 0xf2c230, { lados: 14 });
    boya.position.set(5, 0.6, 4);
    const mastil = cilindro(0.12, 0.12, 4, 0x555555, { lados: 6 });
    mastil.position.set(5, 3.2, 4);
    this.grupoBoya.add(boya, mastil);
    this.cadena = [];
    for (let k = 0; k < 10; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      s.position.set(5, -2 - k * 2.6, 4);
      this.grupoBoya.add(s);
      this.cadena.push(s);
    }
    this.indexar(this.grupoBoya);

    // Flechas del viento
    this.flechas = [];
    for (let k = 0; k < 7; k++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
      f.rotation.z = -Math.PI / 2;
      f.position.set(-100 + k * 30, 10, -20 + (k % 3) * 18);
      this.scene.add(f);
      this.flechas.push(f);
    }
    for (let k = 0; k < 6; k++) {
      const n = nube(6 + (k % 3) * 2, 0xffffff, 0.92);
      n.position.set(-260 + k * 100, 120 + (k % 2) * 20, -150 + (k % 3) * 120);
      this.scene.add(n);
    }
    this.armarCorte();
  }

  /** Lámina del corte en z = 0: capas de agua (textura de temperatura y oxígeno). */
  armarCorte() {
    this.grupoCorte = this.grupo('temperatura');
    const forma = new THREE.Shape();
    const xs = [];
    for (let k = 0; k <= 120; k++) xs.push(-this.a * 1.3 + (2.6 * this.a * k) / 120);
    forma.moveTo(xs[0], -this.zmax * VS - 10);
    for (const x of xs) forma.lineTo(x, this.altura(x, 0.02));
    forma.lineTo(xs[xs.length - 1], -this.zmax * VS - 10);
    forma.closePath();
    const suelo = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: 0x5c4b36, side: THREE.DoubleSide }));
    suelo.position.z = 0.05;
    this.grupoCorte.add(suelo);
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = 64; this.lienzo.height = 128;
    this.texCapas = new THREE.CanvasTexture(this.lienzo);
    this.texCapas.colorSpace = THREE.SRGBColorSpace;
    // Malla del agua del corte: de la superficie al fondo, con uv = (x, profundidad)
    const n = 120;
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const x = -this.a + (2 * this.a * k) / n;
      const yb = Math.min(0, this.altura(x, 0.02));
      pos.push(x, 0, 0.1, x, yb, 0.1);
      uv.push(k / n, 1, k / n, 1 + yb / (this.zmax * VS));
      if (k < n) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.aguaCorte = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.texCapas, side: THREE.DoubleSide }));
    this.grupoCorte.add(this.aguaCorte);
    this.rotZ = [rotulo('0 m', 'rotulo3d claro'), rotulo('', 'rotulo3d claro'), rotulo('', 'rotulo3d claro')];
    for (const r of this.rotZ) this.grupoCorte.add(r);
    this.grupoCorte.visible = false;
  }

  /** Pinta las capas del corte: temperatura, oxígeno del hipolimnion, algas y termoclina inclinada. */
  pintarCorte(p, r) {
    const ctx = this.lienzo.getContext('2d');
    const W = this.lienzo.width, H = this.lienzo.height;
    const he = r.mo.he, zmax = this.zmax;
    const Dh = Math.min(he * 0.9, Number.isFinite(r.viento.Dh) ? r.viento.Dh : 0);
    const mezcla = r.tr.mezcla || r.oxigeno.ventarron;
    const verde = Math.min(1, Math.max(0, (r.nu.tsi - 35) / 30));
    const anox = Math.max(0, Math.min(1, (3 - r.oxigeno.ODh) / 3));
    const caliente = new THREE.Color(0xe8a24a), frio = new THREE.Color(0x1d4f8c), c = new THREE.Color();
    for (let i = 0; i < W; i++) {
      // la termoclina baja a sotavento (oriente) y sube a barlovento (occidente)
      const zt = mezcla ? zmax * 2 : he + Dh * (i / (W - 1) - 0.5);
      for (let j = 0; j < H; j++) {
        const z = (j / (H - 1)) * zmax;
        const T = mezcla ? r.tr.Th + 0.3 * Math.exp(-z / 20) : M.perfilTemperatura(z, r.tr.Te, r.tr.Th, zt, S.SITIO.espesorTermoclina);
        const f = Math.max(0, Math.min(1, (T - r.tr.Th) / Math.max(0.5, r.tr.Te - r.tr.Th)));
        c.copy(frio).lerp(caliente, f);
        if (z < zt && !mezcla) c.lerp(new THREE.Color(0x4f9a3a), verde * 0.45);
        if (z > zt + 1 && !mezcla) c.lerp(new THREE.Color(0x3a1f4f), anox * 0.75);
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(i, j, 1, 1);
      }
    }
    this.texCapas.needsUpdate = true;
    this.rotZ[1].element.textContent = mezcla ? 'lago mezclado' : `termoclina ${fmt(he, 0)} m`;
    this.rotZ[1].position.set(-this.a * 0.55, -he * VS, 0.4);
    this.rotZ[2].element.textContent = `${fmt(zmax, 0)} m`;
    this.rotZ[2].position.set(6, -zmax * VS + 1.5, 0.4);
    this.rotZ[0].position.set(-this.a * 0.85, 1.2, 0.4);
  }

  aplicar(p, r, sim) {
    const forma = `${p.area}|${p.profMax}|${p.exponente}|${p.largo}`;
    if (forma !== this.formaActual) {
      this.formaActual = forma;
      this.a = (p.largo * 1000) / 2 / ESC;
      this.b = (p.area * 1e6) / (Math.PI * this.a * ESC * ESC);
      this.zmax = p.profMax;
      this.m = p.exponente;
      this.repintarTerreno(this.malla);
      const f = new THREE.Shape();
      f.absellipse(0, 0, this.a * 1.004, this.b * 1.004, 0, Math.PI * 2, false, 0);
      this.agua.geometry.dispose();
      this.agua.geometry = new THREE.ShapeGeometry(f, 96);
      this.grupoCorte.parent?.remove(this.grupoCorte);
      this.armarCorte();
      this.grupoCorte.visible = this.vista === 'corte';
    }
    const yN = r.nivel.eta * VN * 0.05;
    this.nivelY = yN;
    this.matAgua.color.copy(AGUA_CLARA).lerp(AGUA_VERDE, Math.min(1, Math.max(0, (r.nu.tsi - 38) / 25)));
    this.flujoDesague.visible = r.q.Qdesague > 1e-3 && this.vista !== 'corte';
    this.flujoDesague.velocidad = 6 + 8 * Math.sqrt(r.q.Qdesague);
    for (const f of this.flujosCuenca) { f.visible = this.vista !== 'corte'; f.velocidad = 4 + 6 * Math.sqrt(r.q.Qcuenca); }
    const nP = Math.min(this.parcelas.length, Math.round(p.areaCebolla / 250));
    this.parcelas.forEach((pp, k) => { pp.visible = k < nP; });
    const nJ = Math.min(this.jaulas.length, Math.ceil(p.truchas / 40));
    this.jaulas.forEach((j, k) => { j.visible = k < nJ; });
    const carga = p.habitantes * (1 - p.remocion / 100);
    const rad = Math.min(30, 2 + Math.sqrt(carga) / 6);
    this.mancha.scale.set(rad, rad, 1);
    this.mancha.visible = carga > 200;
    // Cadena de termómetros: color de cada sensor según la temperatura a su profundidad
    const caliente = new THREE.Color(0xe8a24a), frio = new THREE.Color(0x1d4f8c);
    this.cadena.forEach((s, k) => {
      const z = (k + 1) * 2.6 / VS;
      const T = M.perfilTemperatura(z, r.tr.Te, r.tr.Th, r.mo.he, S.SITIO.espesorTermoclina);
      s.material.color.copy(frio).lerp(caliente, Math.max(0, Math.min(1, (T - r.tr.Th) / Math.max(0.5, r.tr.Te - r.tr.Th))));
      s.visible = z < p.profMax * 0.9;
    });
    // Viento
    const U = r.tr.U;
    this.flechas.forEach((f) => { f.scale.setScalar(0.4 + U / 6); f.visible = U > 0.5 && this.vista !== 'corte'; });
    this.vientoAhora = U;
    // Seiche: amplitud visual según el viento
    this.seiche = { T: r.viento.Ts, amp: Math.min(1.2, 0.05 + U * 0.08) };
    const firma = `${r.tr.Te.toFixed(2)}|${r.tr.Th.toFixed(2)}|${r.mo.he}|${(r.viento.Dh ?? 0).toFixed(2)}|${r.tr.mezcla}|${r.oxigeno.ventarron}|${r.oxigeno.ODh.toFixed(1)}|${r.nu.tsi.toFixed(0)}`;
    if (firma !== this.firmaCorte) { this.pintarCorte(p, r); this.firmaCorte = firma; }

    const des = r.q.Qdesague > 1e-4;
    this.etiqueta('lago', `${fmt(p.area, 0)} km² · ${miles(r.mo.V / 1e6)} hm³ · nivel ${r.nivel.eta >= 0 ? '+' : '−'}${fmt(Math.abs(r.nivel.eta), 2)} m`, des ? 'ok' : 'aviso', [-20, 6, -this.b * 0.4]);
    this.etiqueta('desague', des ? `${fmt(r.q.Qdesague, 2)} m³/s al río` : 'no desagua: río seco', des ? 'ok' : 'alerta', [this.a + 18, this.altura(this.a + 18, 0) + 4, 0]);
    this.etiqueta('cuenca', `${fmt(r.q.Qcuenca, 2)} m³/s · ${fmt(p.areaCuenca, 0)} km²`, 'ok', [-40, this.altura(-40, -150) + 6, -150]);
    this.etiqueta('cebolla', `${miles(p.areaCebolla)} ha · ${miles(r.nu.fuentes.cebolla)} kg P/año`, r.nu.carga <= r.nu.Lc ? 'ok' : 'aviso', [Math.cos(-2.3) * this.a * 1.5, 22, Math.sin(-2.3) * this.b * 1.9]);
    this.etiqueta('pueblo', `${miles(p.habitantes)} hab. · tratamiento ${fmt(p.remocion, 0)} %`, p.remocion >= 50 ? 'ok' : 'aviso', [-78, this.altura(-78, 62) + 8, 62]);
    this.etiqueta('jaulas', `${miles(p.truchas)} t/año · ${miles(r.nu.fuentes.truchas)} kg P/año`, r.nu.P <= 20 ? 'ok' : 'aviso', [-52, 4, 18]);
    this.etiqueta('boya', `superficie ${fmt(r.tr.Te, 1)} °C · fondo ${fmt(r.tr.Th, 1)} °C · W = ${fmt(Math.min(99, r.tr.W), 2)}`, r.tr.mezcla ? 'ok' : 'ok', [5, 7.5, 4]);
    this.etiqueta('epilimnion', `${fmt(r.tr.Te, 2)} °C · algas ${fmt(r.nu.Chl, 1)} µg/L`, 'ok', [this.a * 0.35, -r.mo.he * VS * 0.4, 0.5]);
    this.etiqueta('termoclina', r.tr.mezcla || r.oxigeno.ventarron ? 'mezclado por el viento' : `${fmt(r.mo.he, 0)} m · inclinada ${fmt(Math.min(r.mo.he, r.viento.Dh), 1)} m`, 'ok', [this.a * 0.35, -r.mo.he * VS - 1, 0.5]);
    this.etiqueta('hipolimnion', `${fmt(r.tr.Th, 2)} °C · oxígeno ${fmt(r.oxigeno.ODh, 2)} mg/L`, r.oxigeno.ODh >= 5 ? 'ok' : (r.oxigeno.ODh >= 2 ? 'aviso' : 'alerta'), [this.a * 0.2, -(r.mo.he + 12) * VS, 0.5]);
  }

  irAVista(nombre, inmediato) {
    super.irAVista(nombre, inmediato);
    const cortar = nombre === 'corte';
    const planos = cortar ? [this.planoCorte] : [];
    if (!this.malla) return;
    const mats = [this.malla.material, this.matAgua];
    this.grupoPueblo.traverse((o) => { if (o.material) mats.push(o.material); });
    this.grupoCebolla.traverse((o) => { if (o.material) mats.push(o.material); });
    for (const m of mats) { m.clippingPlanes = planos; m.needsUpdate = true; }
    this.grupoCorte.visible = cortar;
    this.grupoJaulas.visible = !cortar;
    if (this.flujoDesague) this.flujoDesague.visible = !cortar;
    for (const f of this.flujosCuenca ?? []) f.visible = !cortar;
    for (const f of this.flechas ?? []) f.visible = !cortar;
  }

  paso(dt, t) {
    if (!this.matAgua) return;
    const v = 0.004 + 0.002 * (this.vientoAhora ?? 4);
    this.matAgua.map.offset.x = (this.matAgua.map.offset.x + v * dt) % 1;
    // Seiche: el espejo se mece alrededor del centro (período real comprimido a unos segundos)
    if (this.seiche) {
      const ang = Math.cos((2 * Math.PI * t) / 6) * this.seiche.amp * 0.004;
      this.agua.rotation.set(-Math.PI / 2, ang, 0);
      this.agua.position.y = (this.nivelY ?? 0) + 0.05;
    }
    this.flujoDesague?.paso(dt);
    for (const f of this.flujosCuenca ?? []) f.paso(dt);
    for (const f of this.flechas ?? []) { f.position.x += dt * (this.vientoAhora ?? 4) * 2; if (f.position.x > 120) f.position.x = -120; }
    for (const j of this.jaulas ?? []) if (j.visible) j.position.y = 0.15 + Math.sin(t * 1.3 + j.position.x) * 0.05;
  }
}
