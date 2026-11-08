# Simulador hídrico 3D · Ciénagas costeras

Aplicación web interactiva que simula una ciénaga costera del Caribe colombiano, con valores de referencia inspirados en la Ciénaga Grande de Santa Marta (la laguna costera más grande de Colombia, en el delta del río Magdalena): el agua dulce que llega por los caños del Magdalena y por los ríos de la Sierra Nevada, el nivel y el volumen de una laguna muy somera, la marea del Caribe y el intercambio con el mar por la Boca de la Barra y las alcantarillas de la carretera, la salinidad de equilibrio y la hipersalinidad, el estrés del manglar por especie, la pesca, el oxígeno de la madrugada y la sedimentación.

Es el cuarto eslabón de la serie de simuladores hídricos 3D: recibe uno de los ríos de la Sierra (el del simulador de ríos), el nivel del río grande (el del delta) y las condiciones del mar (el del océano), y entrega al delta y al mar el agua que sale por la boca.

La escena 3D muestra la ciénaga con su anillo de manglar, la barra de arena con la carretera, sus puentes y sus alcantarillas, el mar, la Boca de la Barra con el pueblo de Ciénaga, el río Magdalena entre sus diques naturales con los caños que lo comunican con la ciénaga, los ríos de la Sierra y el pueblo de palafitos con sus canoas. El color del agua sigue a la salinidad (dulce, salobre, marina o hipersalina) y a las algas; cada mangle se colorea con el estrés de su especie; con la mortandad aparecen peces muertos. Tiene cuatro vistas (Ciénaga, Caños, Boca y Palafitos).

El panel tiene nueve pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Ríos y caños, Ciénaga, Mar y boca, Salinidad, Manglar y pesca, Calidad, Sedimentos, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Hidrodinámica y Calidad del Agua de Lagunas Costeras).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Balance de agua y de sal con el reloj (pasos de 30 min), año de régimen, calidad, escenarios y revisión
js/nodo.js             La ciénaga como nodo de la serie (recibe del río, del delta y del mar; entrega al delta y al mar)
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
| Decimales | Mezcla de aguas como promedio ponderado S = Σ(Qᵢ·Sᵢ)/ΣQᵢ; lámina de lluvia y de evaporación a caudal | `mezcla`, `mmDiaAm3s` |
| Ecuación lineal | Área del espejo A(h) = A_c + s·h; salinidad del suelo S_suelo = 1.25·S + 5; espesor depositado Δz = M·TE/(ρ_b·A) | `areaCienaga`, `salinidadSuelo`, `tasaDeposito` |
| Ecuación cuadrática | Volumen V(h) = A_c·h + s·h²/2 y su despeje h = (−A_c + √(A_c² + 2sV))/s; ley de Stokes v_s = K·d² | `volumenCienaga`, `profundidadDeVolumen`, `velocidadCaida` |
| Raíz cuadrada | Caudal por los caños y por la boca Q = C·A·√(2g·Δh) (con suavizado cerca de Δh = 0); velocidad v = C·√(2g·Δh) | `caudalAbertura`, `velocidadAbertura` |
| Función potencia | Clorofila de Dillon y Rigler Chl = 0.0731·P^1.449 | `clorofila` |
| Función racional | Salinidad de equilibrio S = S_mar·Q_m/(Q_m + Q_d − E·A) con asíntota vertical; número de forma de la marea F = (K1 + O1)/(M2 + S2); tiempo de residencia τ = V/Q; Vollenweider P = P_in/(1 + √τ) | `salinidadEquilibrio`, `numeroForma`, `tiempoResidencia`, `fosforoCienaga` |
| Función exponencial | La salinidad se acerca al equilibrio S(t) = S_eq + (S₀ − S_eq)·e^(−t/τ); viscosidad del agua en la ley de Stokes | `salinidadTiempo`, `constanteStokes` |
| Función periódica | Marea como suma de cuatro cosenos (K1, O1, M2, S2); creciente del Magdalena como serie de Fourier de dos términos; oxígeno del día | `marea`, `nivelRio`, `oxigenoHora` |
| Por tramos | Estrés de cada especie de mangle (0, recta, 1); índice de pesca según la salinidad; retención de cada grano mín(1, v_s·A/Q) | `estres`, `indicePesca`, `fraccionRetenida` |

## Escenario base

Año normal; ríos de la Sierra con 40 m³/s de media (20 m³/s en enero); Magdalena a 1.00 m.s.n.m. de media frente a los caños, con la creciente principal de 0.70 m en noviembre y la de mitad de año de 0.25 m; tres caños abiertos de 25 m² con coeficiente 0.25; ciénaga con 400 km² de fondo, 60 km² más por cada metro de nivel y el fondo a −1.40 m.s.n.m.; 900 mm de lluvia y 28 °C; Boca de la Barra de 200 m × 3 m y 20 alcantarillas de 3 m² (660 m² en total); marea del Caribe con K1 = 0.09, O1 = 0.07, M2 = 0.06 y S2 = 0.02 m (F = 2.00, mixta, principalmente diurna); mar a 36 PSU; fósforo de 120 µg/L en el Magdalena y 40 µg/L en los ríos; sedimento de 600 y 150 mg/L.

El 1 de enero a las 06:00 la ciénaga está a +0.018 m.s.n.m., con 1.42 m de agua, 485.1 km² de espejo y 628 hm³; el Magdalena está a 1.59 m y los caños llevan 103.6 m³/s; la salinidad es de 16.8 PSU. En el año entran 132.3 m³/s de agua dulce y 148.2 m³/s de mar, se evaporan 26.9 m³/s y salen 253.6 m³/s por la boca (tiempo de residencia de 29 días); la salinidad va de 15.0 PSU en noviembre a 27.6 PSU en abril, y el suelo del manglar llega a 39.5 PSU en el peor mes (manglar sano). El fósforo es de 36.4 µg/L, la clorofila de 13.3 µg/L y el oxígeno de la madrugada de 5.33 mg/L; se depositan 3.80 mm de lodo al año. Los 14 criterios se cumplen.

## Pestañas

- **Ríos y caños**: régimen de los ríos de la Sierra, nivel del Magdalena como serie de Fourier y caudal por los caños con la raíz del desnivel. La tabla compara el agua dulce de cada mes con la evaporación.
- **Ciénaga**: área y volumen (recta y parábola), despeje de la cuadrática, tiempo de residencia y nivel del año frente al piso de los palafitos.
- **Mar y boca**: marea como suma de cuatro cosenos, número de forma, caudal por la boca y una simulación de tres días del mar, la ciénaga y el caudal por la boca.
- **Salinidad**: salinidad de equilibrio como función racional con su asíntota vertical, acercamiento exponencial y la salinidad del año mes a mes.
- **Manglar y pesca**: estrés por tramos de los mangles rojo, blanco y negro según la salinidad del suelo, salud del manglar e índice de pesca.
- **Calidad**: fósforo de Vollenweider, clorofila (función potencia) y oxígeno del día con la saturación corregida por la sal.
- **Sedimentos**: ley de Stokes, retención por tramos y espesor que se deposita cada año.

## Escenarios

Ciénaga de referencia, sequía de El Niño (el mangle rojo empieza a sufrir), lluvias de La Niña, años noventa (caños sedimentados y carretera sin alcantarillas), crisis del manglar (años noventa con El Niño: el suelo llega a 52.6 PSU y el manglar queda al 78 %), restauración (cuatro caños dragados y 40 alcantarillas: la salinidad máxima baja a 21.7 PSU, pero entra más sedimento), Boca de la Barra sedimentada (casi no entra mar y la ciénaga se vuelve dulce), Magdalena y ríos cargados de nutrientes (mortandad de peces) y ascenso del mar de 0.5 m (el agua llega a los pisos de los palafitos y en la sequía el agua sale por los caños hacia el río).

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-cienagas_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Salinidad de equilibrio (con fórmulas), Cubeta y caños (con fórmulas), Año mes a mes y Conexión. La pestaña Conexión recibe la frontera del simulador de ríos (uno de los ríos de la Sierra, con su sedimento y su fósforo), la del delta (el caudal del río grande fija el nivel frente a los caños) y la del océano (nivel medio, marea y salinidad), y entrega el agua que sale por la boca con su salinidad, su temperatura, su oxígeno y su fósforo.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 22 pruebas: 8 del modelo, 8 del sistema (incluidos los balances de agua y de sal en cada paso y el régimen periódico del año) y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en la Ciénaga Grande de Santa Marta, y se pueden editar: el régimen de los ríos, la creciente del Magdalena, la sección y el coeficiente de los caños, la forma de la cubeta, la boca y las alcantarillas, las amplitudes de la marea, los umbrales de salinidad de los mangles y las concentraciones de fósforo y de sedimento. Antes de la sustentación conviene contrastarlos con los informes de monitoreo del INVEMAR, con los datos del IDEAM y con la literatura del sistema lagunar.
