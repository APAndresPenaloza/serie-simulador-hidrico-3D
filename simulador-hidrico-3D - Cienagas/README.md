# Simulador hídrico 3D · Ciénagas costeras

Aplicación web interactiva que simula una ciénaga costera del Caribe colombiano, con valores de referencia inspirados en la Ciénaga Grande de Santa Marta (la laguna costera más grande de Colombia, en el delta del río Magdalena): el intercambio de agua con el Magdalena por los caños **en los dos sentidos** (el río llena la ciénaga en la creciente y la ciénaga le devuelve agua salobre en el estiaje), los ríos de la Sierra Nevada, el nivel y el volumen de una laguna muy somera, los alisios que inclinan el agua, la marea del Caribe y el intercambio con el mar por la Boca de la Barra y las alcantarillas de la carretera, la salinidad de equilibrio y la hipersalinidad, el estrés del manglar por especie, la pesca, el oxígeno de la madrugada y la sedimentación.

Como en las ciénagas reales, el flujo por los caños lo controla el régimen del río: en aguas altas corre del río a la ciénaga y en aguas bajas la ciénaga drena hacia el río (MAVDT et al., plan de manejo del sitio Ramsar; Viloria De la Hoz, 2008, para la ciénaga de Zapatosa). En el modelo, el agua de los caños cambia de sentido cuando el Magdalena frente a los caños (que en su delta baja casi hasta el nivel del mar y sube y baja con la marea) queda por debajo del agua de la ciénaga en la orilla de los caños, que los alisios del noreste levantan unos centímetros en el estiaje.

Es el cuarto eslabón de la serie de simuladores hídricos 3D: recibe uno de los ríos de la Sierra (el del simulador de ríos), el nivel del río grande (el del delta) y las condiciones del mar (el del océano), y entrega al delta y al mar el agua que sale por la boca, y al delta lo que los caños le toman al río y lo que la ciénaga le devuelve.

La escena 3D muestra la ciénaga con su anillo de manglar, la barra de arena con la carretera, sus puentes y sus alcantarillas, el mar, la Boca de la Barra con el pueblo de Ciénaga, el río Magdalena entre sus diques naturales con los caños que lo comunican con la ciénaga (las partículas del agua cambian de sentido y, cuando la ciénaga le devuelve agua al río, aparece en el río una mancha del color del agua de la ciénaga), los ríos de la Sierra y el pueblo de palafitos con sus canoas. El color del agua sigue a la salinidad (dulce, salobre, marina o hipersalina) y a las algas; cada mangle se colorea con el estrés de su especie; con la mortandad aparecen peces muertos. Tiene cuatro vistas (Ciénaga, Caños, Boca y Palafitos).

El panel tiene nueve pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Ríos y caños, Ciénaga, Mar y boca, Salinidad, Manglar y pesca, Calidad, Sedimentos, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Hidrodinámica y Calidad del Agua de Lagunas Costeras).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Balance de agua y de sal con el reloj (pasos de 30 min), caños en los dos sentidos, viento, año de régimen, calidad, escenarios y revisión
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
| Ecuación cuadrática | Volumen V(h) = A_c·h + s·h²/2 y su despeje h = (−A_c + √(A_c² + 2sV))/s; ley de Stokes v_s = K·d²; esfuerzo del viento τ = ρ_a·C_D·U² | `volumenCienaga`, `profundidadDeVolumen`, `velocidadCaida`, `esfuerzoViento` |
| Raíz cuadrada | Caudal por los caños en los dos sentidos y por la boca Q = C·A·√(2g·|Δh|)·signo(Δh) (con suavizado cerca de Δh = 0); velocidad v = C·√(2g·Δh) | `caudalAbertura`, `velocidadAbertura` |
| Función potencia | Clorofila de Dillon y Rigler Chl = 0.0731·P^1.449 | `clorofila` |
| Función racional | Salinidad de equilibrio S = S_mar·Q_m/(Q_m + Q_d − E·A) con asíntota vertical; inclinación del agua por el viento Δη = C_D·(ρ_a/ρ)·U²·L/(g·h); número de forma de la marea F = (K1 + O1)/(M2 + S2); tiempo de residencia τ = V/Q; Vollenweider P = P_in/(1 + √τ) | `salinidadEquilibrio`, `setupViento`, `numeroForma`, `tiempoResidencia`, `fosforoCienaga` |
| Función exponencial | La salinidad se acerca al equilibrio S(t) = S_eq + (S₀ − S_eq)·e^(−t/τ); viscosidad del agua en la ley de Stokes | `salinidadTiempo`, `constanteStokes` |
| Función periódica | Marea como suma de cuatro cosenos (K1, O1, M2, S2); creciente del Magdalena como serie de Fourier de dos términos más la marea que sube por el río H(t) = H(d) + κ·marea(t); oxígeno del día | `marea`, `nivelRio`, `oxigenoHora` |
| Por tramos | Nivel del Magdalena con piso en el nivel del mar H(d) = máx(H_F(d), η̄ + 0.03); caudal de los caños partido en lo que entra y lo que vuelve al río Q⁺ = máx(0, Q), Q⁻ = máx(0, −Q); estrés de cada especie de mangle (0, recta, 1); índice de pesca según la salinidad; retención de cada grano mín(1, v_s·A/Q) | `forzantes` (sistema), `partes`, `estres`, `indicePesca`, `fraccionRetenida` |

## Escenario base

Año normal; ríos de la Sierra con 40 m³/s de media (20 m³/s en enero); Magdalena frente a los caños (en su delta) a 0.55 m.s.n.m. de media, con la creciente principal de 0.60 m en noviembre y la de mitad de año de 0.12 m, sin bajar del nivel del mar + 3 cm y con la mitad de la marea del mar (κ = 0.5); tres caños abiertos de 25 m² con coeficiente 0.40; alisios de 6 m/s en febrero sobre una ciénaga de 25 km de largo (en octubre, la mitad); ciénaga con 400 km² de fondo, 60 km² más por cada metro de nivel y el fondo a −1.40 m.s.n.m.; 900 mm de lluvia y 28 °C; Boca de la Barra de 200 m × 3 m y 20 alcantarillas de 3 m² (660 m² en total); marea del Caribe con K1 = 0.09, O1 = 0.07, M2 = 0.06 y S2 = 0.02 m (F = 2.00, mixta, principalmente diurna); mar a 36 PSU; fósforo de 120 µg/L en el Magdalena y 40 µg/L en los ríos; sedimento de 600 y 150 mg/L.

El 1 de enero a las 06:00 la ciénaga está a +0.055 m.s.n.m., con 1.45 m de agua, 487.3 km² de espejo y 645 hm³; el Magdalena está a 1.06 m (1.02 m de régimen más la marea) y entran por los caños 129.1 m³/s; la salinidad es de 14.8 PSU. En el año entran del Magdalena 75.8 m³/s y la ciénaga le devuelve 2.2 m³/s (neto 73.6 m³/s): la ciénaga le entrega agua al río durante 43 días, en el estiaje de marzo a mayo, cuando el río frente a los caños baja a unos 5 cm sobre el mar y la marea baja; en abril sale más de lo que entra (−8.8 m³/s en promedio y hasta −41 m³/s con la marea baja). Entran 129.6 m³/s de agua dulce y 150.8 m³/s de mar, se evaporan 27.0 m³/s y salen 251.2 m³/s por la boca (tiempo de residencia de 29 días); la salinidad media va de 13.1 PSU en noviembre a 31.3 PSU en mayo (máxima de 32.5 PSU), y el suelo del manglar llega a 45.6 PSU en el peor mes (manglar sano al 91 %, el mangle rojo con 22 % de estrés que se recupera con las aguas altas). El fósforo es de 35.5 µg/L, la clorofila de 12.9 µg/L y el oxígeno de la madrugada de 5.45 mg/L; se depositan 3.68 mm de lodo al año. Los 14 criterios se cumplen.

## Pestañas

- **Ríos y caños**: régimen de los ríos de la Sierra, nivel del Magdalena como serie de Fourier con piso en el nivel del mar y con la marea que sube por el río, inclinación del agua por los alisios y caudal por los caños en los dos sentidos con la raíz del desnivel. Las gráficas muestran dónde el río pasa por debajo de la ciénaga y, mes a mes, lo que entra del río y lo que vuelve al río. La tabla da, para cada mes, lo que entra, lo que vuelve, el neto y los días con el agua saliendo hacia el río.
- **Ciénaga**: área y volumen (recta y parábola), despeje de la cuadrática, inclinación por el viento, tiempo de residencia y nivel del año frente al piso de los palafitos.
- **Mar y boca**: marea como suma de cuatro cosenos, número de forma, caudal por la boca y una simulación de tres días del mar, la ciénaga, el caudal por la boca y el caudal por los caños (que en el estiaje cambia de sentido dos veces al día).
- **Salinidad**: salinidad de equilibrio como función racional con su asíntota vertical, acercamiento exponencial y la salinidad del año mes a mes.
- **Manglar y pesca**: estrés por tramos de los mangles rojo, blanco y negro según la salinidad del suelo, salud del manglar e índice de pesca.
- **Calidad**: fósforo de Vollenweider, clorofila (función potencia) y oxígeno del día con la saturación corregida por la sal.
- **Sedimentos**: ley de Stokes, retención por tramos y espesor que se deposita cada año.

## Escenarios

Ciénaga de referencia; estiaje de abril (pone el reloj el 15 de abril a las 08:00, con la ciénaga entregándole 41 m³/s al río); sequía de El Niño (la ciénaga le devuelve agua al río de febrero a julio, 150 días, y el manglar baja al 79 %); lluvias de La Niña (el río entra todo el año); años noventa (caños sedimentados y carretera sin alcantarillas: el mangle rojo pasa del 25 % de estrés); crisis del manglar (años noventa con El Niño: el suelo llega a 53.5 PSU y el manglar queda al 76 %); restauración (cuatro caños dragados y 40 alcantarillas: entran 158.6 m³/s del río, la salinidad máxima baja a 30.6 PSU, pero entra más sedimento); Boca de la Barra sedimentada (casi no entra mar y la ciénaga se vuelve dulce); Magdalena y ríos cargados de nutrientes (mortandad de peces) y ascenso del mar de 0.5 m (el agua llega a los pisos de los palafitos y la ciénaga le devuelve agua al río de marzo a julio).

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-cienagas_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Salinidad de equilibrio (con fórmulas), Cubeta y caños (con fórmulas: inclinación por el viento y caudal con signo), Año mes a mes (con lo que entra del río, lo que vuelve al río y los días de retorno) y Conexión. La pestaña Conexión recibe la frontera del simulador de ríos (uno de los ríos de la Sierra, con su sedimento y su fósforo), la del delta (el caudal del río grande fija el nivel frente a los caños) y la del océano (nivel medio, marea y salinidad), y entrega el agua que sale por la boca con su salinidad, su temperatura, su oxígeno y su fósforo, más lo que los caños le toman al río (`Qtoma`) y lo que la ciénaga le devuelve (`Qretorno`), que el delta descuenta y suma al caudal del río.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 27 pruebas: 10 del modelo, 11 del sistema (incluidos los balances de agua y de sal en cada paso, el régimen periódico del año, el intercambio con el río en los dos sentidos, la marea en el río, el piso del nivel del mar, la inclinación por el viento y el escenario de estiaje) y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en la Ciénaga Grande de Santa Marta, y se pueden editar: el régimen de los ríos, la creciente del Magdalena, la parte de la marea que llega a los caños, la sección y el coeficiente de los caños, la fuerza de los alisios y el largo de la ciénaga, la forma de la cubeta, la boca y las alcantarillas, las amplitudes de la marea, los umbrales de salinidad de los mangles y las concentraciones de fósforo y de sedimento. Antes de la sustentación conviene contrastarlos con los informes de monitoreo del INVEMAR, con los datos del IDEAM y con la literatura del sistema lagunar.
