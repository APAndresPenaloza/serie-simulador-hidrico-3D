// Pruebas del modelo del océano con valores calculados a mano. Ejecutar con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/modelo.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a} (tol ${tol})`);

test('Lineal y cuadrática: olas en aguas profundas y mar de Pierson y Moskowitz', () => {
  // T = 10 s: C = 9.81 × 10/(2π) = 15.61 m/s y L = 156.1 m (L = C·T)
  cerca(M.celeridadProfunda(10), (9.81 * 10) / (2 * Math.PI), 1e-12);
  cerca(M.longitudProfunda(10), 10 * M.celeridadProfunda(10), 1e-9);
  // U = 10 m/s: H_s = 0.21 × 100/9.81 = 2.14 m y T_p = 7.30 s; con el doble de viento, 4 veces la altura
  cerca(M.alturaPM(10), 2.1406727, 1e-6);
  cerca(M.periodoPM(10), 7.2986748, 1e-6);
  cerca(M.alturaPM(20) / M.alturaPM(10), 4, 1e-12);
});

test('Cuadrática y potencia: energía y potencia del oleaje', () => {
  // E = 1025 × 9.81 × 2²/16 = 2 513.8 J/m²
  cerca(M.energiaOla(2), 2513.8125, 1e-9);
  // P = 1025 × 9.81² × 4 × 8/(64π) = 15.70 kW/m
  cerca(M.potenciaOla(2, 8), 15699.3623, 1e-3);
  cerca(M.potenciaOla(4, 8) / M.potenciaOla(2, 8), 4, 1e-12);
});

test('Exponencial y raíz con logaritmo: distribución de Rayleigh y ola máxima', () => {
  // La probabilidad de pasar la altura significativa es e⁻² ≈ 0.135
  cerca(M.probRayleigh(2, 2), Math.exp(-2), 1e-12);
  // Entre 1 000 olas: H_máx = 2 × √(ln 1000/2) = 3.72 m
  cerca(M.olaMaxima(2, 1000), 3.7169222, 1e-6);
});

test('Periódica y racional: marea y batidos', () => {
  cerca(M.marea(0, { M2: 1 }), 1, 1e-12);
  // M2 con S2: mareas vivas cada 354 h (14.75 días); K1 con O1: cada 327.8 h (13.66 días)
  cerca(M.periodoBatido(12.421, 12), 354.0428, 1e-3);
  cerca(M.periodoBatido(23.934, 25.819), 327.826, 1e-3);
  cerca(M.numeroForma({ K1: 0.09, O1: 0.07, M2: 0.06, S2: 0.02 }), 2, 1e-12);
});

test('Trigonométrica, cuadrática, racional y raíz: Coriolis y Ekman', () => {
  // A 30° de latitud f = 2Ω·sin 30° = Ω
  cerca(M.coriolis(30), 7.2921e-5, 1e-15);
  cerca(M.esfuerzoViento(10), 1.2 * 0.0013 * 100, 1e-12);
  // M = 0.1/(1025 × 10⁻⁴) = 0.976 m²/s; D = π·√(2 × 0.02/10⁻⁴) = 20π m
  cerca(M.transporteEkman(0.1, 1e-4), 0.1 / 0.1025, 1e-12);
  cerca(M.profundidadEkman(0.02, 1e-4), 20 * Math.PI, 1e-9);
  // En la superficie la corriente va 45° a la derecha; a la profundidad D va al revés y vale e^(−π)
  assert.deepEqual(M.espiralEkman(0, 1, 100), { rapidez: 1, giro: 45 });
  cerca(M.espiralEkman(100, 1, 100).rapidez, Math.exp(-Math.PI), 1e-12);
  cerca(M.espiralEkman(100, 1, 100).giro, 225, 1e-9);
});

test('Logística, lineal y racional: termoclina, densidad y pluma', () => {
  // En la profundidad de la termoclina la temperatura está a la mitad del salto
  cerca(M.perfilTemperatura(40, 28, 12, 40, 15), 20, 1e-12);
  // ρ(25 °C, 35 PSU) = ρ₀; un grado más: ρ₀(1 − α); un PSU más: ρ₀(1 + β)
  cerca(M.densidad(25, 35), 1023.6, 1e-9);
  cerca(M.densidad(26, 35), 1023.6 * (1 - 2.6e-4), 1e-9);
  cerca(M.densidad(25, 36), 1023.6 * (1 + 7.6e-4), 1e-9);
  // Tanta agua de río como de mar en la caja: la mitad de la salinidad
  cerca(M.salinidadPluma(36, 1e10, 100, 1e8), 18, 1e-12);
});

test('Por tramos: alertas de blanqueamiento del coral', () => {
  assert.equal(M.alertaCoral(-0.5, 0).nivel, 0);
  assert.equal(M.alertaCoral(0.5, 0).nivel, 1);
  assert.equal(M.alertaCoral(1.2, 2).nivel, 2);
  assert.equal(M.alertaCoral(1.2, 5).nivel, 3);
  assert.equal(M.alertaCoral(1.2, 9).nivel, 4);
});

test('Cuadrática, exponencial y logarítmica: nivel del mar y carbono', () => {
  // h(10) = 3 × 10 + 0.05 × 100 = 35 mm
  cerca(M.ascensoMar(10, 3, 0.05), 35, 1e-12);
  cerca(M.expansionTermica(1, 700), 0.182, 1e-12);
  cerca(M.co2(10, 400, 0.01), 400 * Math.exp(0.1), 1e-9);
  // Con el doble de CO₂: pH − 0.9·log₁₀ 2 = −0.271
  cerca(M.phMar(800, 400, 8.1), 8.1 - 0.9 * Math.log10(2), 1e-12);
  cerca(M.hidrogeniones(8), 1e-8, 1e-20);
  cerca(M.aragonito(7.9, 8.0, 4), 4 * 10 ** -0.07, 1e-12);
  assert.equal(M.calcificacion(3.6), 'adecuada');
  assert.equal(M.calcificacion(3.2), 'reducida');
  assert.equal(M.calcificacion(2.5), 'marginal');
  assert.equal(M.calcificacion(1.5), 'crítica');
});

test('Bosque de niebla: punto de rocío, base de las nubes, agua de la nube y niebla atrapada', () => {
  // Magnus con 27 °C y 78 %: γ = ln 0.78 + 17.625 × 27/270.04 = 1.513778; T_d = 243.04·γ/(17.625 − γ) = 22.836 °C
  cerca(M.puntoRocio(27, 78), 22.8355, 1e-3);
  // Con el aire saturado el punto de rocío es la temperatura
  cerca(M.puntoRocio(25, 100), 25, 1e-9);
  // Más seco, más bajo el punto de rocío
  assert.ok(M.puntoRocio(27, 60) < M.puntoRocio(27, 80));
  // Base de las nubes: 125 m por cada grado de diferencia
  cerca(M.baseNubes(27, 22), 625, 1e-9);
  assert.equal(M.baseNubes(20, 20), 0);
  // Por tramos: 9.8 °C/km bajo la base y 6 °C/km dentro de la nube: 27 − 4.9 − 3 = 19.1 °C a 1 000 m
  cerca(M.temperaturaAltura(1000, 27, 500), 19.1, 1e-12);
  cerca(M.temperaturaAltura(300, 27, 500), 27 - 0.0098 * 300, 1e-12);
  // Agua líquida: 0 bajo la base, 0.0004 g/m³ por metro, tope de 0.25 g/m³
  assert.equal(M.aguaLiquida(400, 500, 0.0004, 0.25), 0);
  cerca(M.aguaLiquida(700, 500, 0.0004, 0.25), 0.08, 1e-12);
  assert.equal(M.aguaLiquida(2000, 500, 0.0004, 0.25), 0.25);
  // F = η·LWC·U = 0.2 × 0.1 g/m³ × 8 m/s = 0.16 g/(m²·s) → 13.824 L por m² de malla en un día
  cerca(M.flujoNiebla(0.2, 0.1, 8), 0.16, 1e-12);
  cerca(M.litrosPorM2(0.16, 86400), 13.824, 1e-9);
});
