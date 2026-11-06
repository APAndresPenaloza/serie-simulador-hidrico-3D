// Pruebas del sistema de la playa: escenario base, balance de arena, nivel, perfil, agua de
// baño y escenarios. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';
import * as S from '../js/sistema.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);
const base = (c = {}) => ({ ...structuredClone(S.PARAMETROS), ...c });
const arrancar = (p) => ({ ...S.estadoInicial(p), t: 6 * 3600 });
const calcular = (c = {}) => { const p = base(c); return S.calcular(p, arrancar(p)); };
const fallas = (r) => Object.values(r.revision).flat().filter((c) => c.nivel !== 'ok');
const falla = (r, inicio) => fallas(r).some((c) => c.texto.startsWith(inicio));

test('Escenario base: todos los criterios cumplen', () => {
  const r = calcular();
  assert.equal(fallas(r).length, 0, fallas(r).map((c) => c.texto).join('; '));
  assert.equal(Object.values(r.revision).flat().length, 10);
  assert.ok(r.a.balance > 0 && r.v > 0 && r.v < 1, 'la playa está casi en equilibrio');
  assert.ok(r.a.TWLmax < S.PARAMETROS.malecon - 0.3);
});

test('El nivel total es la marea más la sobreelevación más el remonte', () => {
  const p = base({ tormenta: true });
  const t = (p.diaTormenta - 1) * 86400 + 12 * 3600;
  const f = S.forzantes(p, t);
  assert.ok(f.torm);
  cerca(f.TWL, f.eta + f.surge + f.R2, 1e-12);
  cerca(f.surge, M.sobreelevacionPresion(p.presionTormenta) + M.sobreelevacionViento(p.vientoTormenta, p.plataforma * 1000, p.profPlataforma), 1e-12);
  // La altura combinada usa el mar de fondo de la tormenta
  cerca(f.H0, Math.hypot(p.HsTormenta, f.local.H), 1e-12);
});

test('Balance de arena: el ancho cambia con lo que entra, lo que sale y la regla de Bruun', () => {
  const p = base();
  const sim = arrancar(p);
  const f = S.forzantes(p, sim.t, sim);
  const pr = S.perfil(p);
  const W0 = sim.W;
  S.avanzar(p, sim, 3600);
  const esperado = (M.cambioAncho(p.aporte / M.SEG_ANO, f.Qls * (1 - p.retencion), p.largo, p.berma, pr.hc) - M.bruun(p.ascensoMar / 1000 / M.SEG_ANO, pr.xc, p.berma, pr.hc)) * 3600;
  cerca(sim.W - W0, esperado, 1e-12);
});

test('Perfil: el ancho activo llega a la profundidad de cierre', () => {
  const pr = S.perfil(base());
  cerca(M.perfilDean(pr.xc, pr.A), pr.hc, 1e-9);
  assert.ok(pr.hc > 5 && pr.hc < 7);
});

test('Mar de leva y tormenta: el agua se acerca al malecón y la playa pierde arena', () => {
  const rl = calcular(S.ESCENARIOS.leva.cambios);
  assert.ok(falla(rl, 'Nivel total máximo') && falla(rl, 'Altura significativa máxima'));
  assert.ok(rl.a.balance < 0);
  const rt = calcular(S.ESCENARIOS.tormenta.cambios);
  assert.ok(rt.a.TWLmax > calcular().a.TWLmax + 0.8);
});

test('Arena: menos aporte erosiona; el espolón y el relleno la recuperan', () => {
  const rb = calcular();
  const rr = calcular(S.ESCENARIOS.represa.cambios);
  assert.ok(rr.a.balance < 0 && falla(rr, 'Balance de arena'));
  assert.ok(Number.isFinite(rr.anosMin) && rr.anosMin < 50);
  const re = calcular(S.ESCENARIOS.espolon.cambios);
  assert.ok(re.a.balance > rb.a.balance);
  const rf = calcular(S.ESCENARIOS.relleno.cambios);
  assert.ok(rf.a.balance > 0 && fallas(rf).length === 0);
  const rm = calcular(S.ESCENARIOS.mar.cambios);
  cerca(rm.bruun50, (10 / 3.3) * rb.bruun50, 1e-9);
});

test('Agua de baño: sin tratamiento o con un emisario corto no se puede bañar', () => {
  const rb = calcular();
  assert.ok(rb.Cmax <= 200);
  const rs = calcular(S.ESCENARIOS.sinTratamiento.cambios);
  cerca(rs.Cmax / rb.Cmax, 100, 1e-6);
  assert.ok(falla(rs, 'Coliformes'));
  const rc = calcular(S.ESCENARIOS.emisarioCorto.cambios);
  assert.ok(rc.col.S < 100 && falla(rc, 'Dilución total'));
});

test('Todos los escenarios se calculan sin valores inválidos', () => {
  for (const [id, e] of Object.entries(S.ESCENARIOS)) {
    const r = calcular(e.cambios);
    for (const v of [r.q.H0, r.q.Hb, r.q.hb, r.q.V, r.q.TWL, r.a.balance, r.v, r.W50, r.col.C, r.Cmax, r.pr.xc]) assert.ok(Number.isFinite(v), `${id}: ${v}`);
  }
});
