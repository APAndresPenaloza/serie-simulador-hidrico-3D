# Simulador hídrico 3D · Deltas

Aplicación web interactiva que simula el delta de un gran río, con valores de referencia inspirados en el delta del río Magdalena en Bocas de Ceniza (Barranquilla): el caudal del año y la curva de sedimento, el reparto del agua entre el cauce principal y el Canal del Dique, la avulsión, la cuña salina que entra por el fondo del canal y puede llegar a la bocatoma del acueducto, la pluma turbia que se abre mar adentro, el avance del frente del delta frente al oleaje y al ascenso relativo del mar, el transporte litoral de arena, el tipo de delta y el dragado del canal de acceso al puerto.

Es el quinto eslabón de la serie de simuladores hídricos 3D: recibe de la ciénaga el agua que sale por la Boca de la Barra y el intercambio por los caños (lo que la ciénaga le toma al río en la creciente menos lo que le devuelve en el estiaje), y del océano el oleaje, la marea, el nivel medio, la rapidez con que sube el mar y la salinidad; entrega a la costa y al océano el caudal medio del río y su sedimento.

La escena 3D muestra el río que baja del sur y sale al mar entre dos tajamares con sus faros, la ciudad y el puerto con sus grúas y buques en la orilla occidental, la bocatoma del acueducto, la draga, el Canal del Dique con su compuerta, la llanura del delta con su manglar y la ciénaga al oriente, la pluma café que se aclara mar adentro con la misma exponencial del modelo, las crestas de las olas que llegan en ángulo a la costa y la línea del frente del delta dentro de 50 años (blanca si avanza, roja si retrocede). Tiene cuatro vistas (Delta, Boca, Corte y Brazos). En la vista Corte la mitad oriental se recorta como una maqueta y se ve, a lo largo del canal, la cuña salina metida por debajo del agua del río. Si el canal no alcanza el calado, el buque espera afuera.

El panel tiene nueve pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Río y sedimento, Brazos del delta, Cuña salina, Pluma, Avance del delta, Oleaje, Canal y dragado, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Hidráulica Fluvial y Morfodinámica de Deltas).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Río, reparto, cuña y canal con el reloj (pasos de 6 h), año de régimen, delta, escenarios y revisión
js/nodo.js             El delta como nodo de la serie (recibe de la ciénaga y del océano; entrega a la costa y al océano)
js/hojas.js            Hojas propias del Excel (con fórmulas)
js/app.js              Pestañas, controles, resultados, ecuaciones y gráficas
js/escena3d.js         Escena 3D con Three.js
js/excel.js, js/nucleo/, lib/   Núcleo común de la serie y librerías locales
tests/                 Pruebas del modelo, del sistema y de los datos (npm test)
documentos/            Informe técnico científico y manual de usuario (.docx)
```

## Objetos matemáticos del simulador

| Requisito | Dónde se aplica | Función en `modelo.js` |
|---|---|---|
| Decimales | Reparto del caudal entre los brazos como fracciones que suman 1 | `reparto` |
| Ecuación lineal | Avance del frente v = (V_s − V_olas)/(W·H); cota de la llanura z(t) = z₀ − a·t; sobreelevación del cauce s(t) = s₀ + a·t | `avanceFrente`, `anosHastaMar`, `anosAvulsion` |
| Ecuación cuadrática | Área del lóbulo A = π·r²/2 (con r = r₀ + v·t); esfuerzo en el fondo τ = ρ·u*² | `areaLobulo`, `esfuerzoFondo` |
| Raíz cuadrada | Froude densimétrico Fr = U/√(g'·h); velocidad de la onda en la interfaz | `froudeDensimetrico` |
| Función potencia | Curva de sedimento C = C₀·(Q/Q̄)^(b−1); conductancia de Manning K = A·R^(2/3)/n; altura de rotura H_b = 0.39·g^(1/5)·(T·H₀²)^(2/5); transporte litoral CERC con H_b^(5/2) | `concentracion`, `conductancia`, `alturaRotura`, `transporteLitoral` |
| Polinomio | Longitud de la cuña salina de Schijf y Schönfeld L = h/(4C_i)·[Fr⁻²/5 − 2 + 3·Fr^(2/3) − (6/5)·Fr^(4/3)] | `cunaSalina` |
| Función racional | Profundidad de régimen h = Q/(B·U_c); dominancia R = V_s/V_olas; años hasta el mar t = z₀/a y hasta la avulsión; escala de la pluma L = U·h_p/w_s | `profundidadRegimen`, `anosHastaMar`, `anosAvulsion`, `escalaPluma` |
| Función exponencial | La pluma se aclara C(x) = C₀·e^(−x/L); la cuña y el fondo del canal se acercan a su equilibrio | `concentracionPluma`, `relajar` |
| Función logarítmica | Perfil de velocidad u(z) = (u*/κ)·ln(z/z₀) y u* = κ·U/(ln(h/z₀) − 1); alcance de la pluma x = L·ln(C₀/C_vis) | `perfilLog`, `velocidadFriccion`, `alcancePluma` |
| Función periódica | Caudal del año como serie de Fourier de dos términos; transporte litoral ∝ sin(2θ) | `caudalRio`, `transporteLitoral` |
| Por tramos | Tipo de delta (marea si el rango pasa de 4 m; río si R ≥ 1; oleaje si R < 1) y clase de marea | `tipoDelta`, `claseMarea` |

## Escenario base

Año normal; caudal medio de 7 200 m³/s con la creciente principal de 0.42·Q̄ en noviembre y la de mitad de año de 0.12·Q̄; 600 mg/L de sedimento con el caudal medio y exponente de carga 1.4; cauce principal de 900 m × 9 m (n = 0.025, S = 5·10⁻⁵) y Canal del Dique de 120 m × 5 m (n = 0.030, S = 10⁻⁴) sin compuertas; canal de acceso de 400 m entre los tajamares, con U_c = 1.2 m/s, fondo duro a 13 m, tiempo de ajuste de 60 días, calado de 10 m y dragado activo; mar a 36 PSU, C_i = 0.00025 y bocatoma a 4 km de la boca; pluma de 3 m de espesor con lodo que cae a 0.35 mm/s; el 25 % del sedimento se queda en un frente de 10 km de ancho y 40 m de profundidad; llanura a 1.5 m.s.n.m. con 5 mm/año de subsidencia y 3.3 mm/año de ascenso del mar; oleaje de H_s = 1.5 m, T = 7 s y 15° con la normal; marea de 0.4 m.

El 1 de enero a las 06:00 el río lleva 9 728 m³/s con 677 mg/L; el Dique toma el 5.36 % y por la boca salen 9 206 m³/s; el canal tiene 12.85 m de fondo y el río empuja la cuña fuera de la boca (Fr = 0.952); la pluma visible llega a 54.1 km. En el año pasan 7 193 m³/s en promedio (4 278 en abril y 10 762 en noviembre, medias de cada mes) y 139.8 millones de toneladas de sedimento; la cuña llega a 2.42 km en marzo; el canal baja a 10.00 m y se dragan 0.60 hm³; frente a las playas, a 15 km, el agua lleva 138 mg/L. El frente retiene 21.85 hm³/año y el oleaje (H_b = 1.85 m) se lleva 6.45 hm³/año: R = 3.39, el delta está dominado por el río y avanza 37.1 m/año (el lóbulo pasa de 56.5 a 96.9 km² en 50 años); la llanura sigue sobre el mar 181 años y la avulsión tardaría 467 años. Los 11 criterios se cumplen.

## Pestañas

- **Río y sedimento**: caudal del año como serie de Fourier y curva de sedimento como función potencia, con la tabla mes a mes.
- **Brazos del delta**: conductancia de Manning, reparto del caudal con el Canal del Dique y sus compuertas, y la sobreelevación del cauce hasta la avulsión.
- **Cuña salina**: Froude densimétrico, longitud de la cuña de Schijf y Schönfeld en función del caudal y la cuña del año frente a la bocatoma.
- **Pluma**: escala de la pluma, decaimiento exponencial del sedimento y alcance logarítmico de la pluma visible.
- **Avance del delta**: volumen que se queda en el frente, avance, área del lóbulo en el tiempo (parábola) y la llanura frente al ascenso relativo del mar.
- **Oleaje**: altura de rotura, transporte litoral CERC (potencia 5/2 y sin(2θ)), dominancia río–oleaje y tipo de delta.
- **Canal y dragado**: profundidad de régimen, ajuste exponencial del fondo, perfil logarítmico de velocidad, esfuerzo en el fondo y volumen dragado. El botón «Dragar ahora» devuelve el canal al calado.

## Escenarios

Delta de referencia, sequía de El Niño (la cuña llega a 4.79 km y pasa la bocatoma; se dragan 8.50 hm³), creciente de La Niña (la pluma lleva 153 mg/L a las playas), Canal del Dique ampliado (toma el 14.3 % del caudal), Canal del Dique con compuertas (1.7 %), represas en la cuenca (35 millones de toneladas: el oleaje gana, R = 0.85, y el delta retrocede), cuenca deforestada (más sedimento: 207 mg/L en las playas y avulsión en 233 años), sin dragado (35 días por debajo del calado), oleaje más fuerte (H_b = 3.57 m: el delta retrocede 27.3 m/año) y ascenso rápido del mar con subsidencia (la llanura queda bajo el mar en 75 años).

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-deltas_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Cuña salina (con fórmulas), Sedimento y delta (con fórmulas), Año mes a mes y Conexión. La pestaña Conexión recibe la frontera de la ciénaga (su caudal por la Boca de la Barra y, por los caños, lo que le toma al río y lo que le devuelve: el neto se descuenta del caudal que sale por Bocas de Ceniza) y la del océano (oleaje, marea, nivel medio, rapidez del ascenso del mar y salinidad), y entrega a la costa y al océano el caudal medio del año que llega al mar, con su concentración y su carga de sedimento.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 21 pruebas: 8 del modelo, 7 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en el delta del Magdalena, y se pueden editar: el régimen de caudal, la curva de sedimento, la geometría y la rugosidad de los brazos, la fricción en la interfaz de la cuña, la ubicación de la bocatoma, la velocidad de caída del lodo, la parte del sedimento que se queda en el frente, la subsidencia, el oleaje y el calado. Antes de la sustentación conviene contrastarlos con los datos del IDEAM en Calamar, los estudios de Cormagdalena y del canal de acceso al puerto de Barranquilla, y la literatura sobre el delta y el Canal del Dique.
