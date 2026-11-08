# Simulador hídrico 3D · Sistema conectado

Aplicación web interactiva que conecta los siete proyectos de la serie de simuladores hídricos 3D y sigue el agua del páramo al océano: la laguna glaciar del páramo rebosa al lago andino, el lago desagua al río de la Sierra Nevada, el río llega a la Ciénaga Grande, la ciénaga se comunica con el delta del río grande y con el mar, el delta lleva su agua y su sedimento al mar y a la playa, y el océano fija la marea, el oleaje, el nivel del mar y la salinidad de la ciénaga, del delta y de la playa.

No repite los modelos: importa los de cada proyecto desde su carpeta y los compone en el orden de la red. Lo que sale de un simulador (su «frontera») es lo que le entra al siguiente. La laguna, el lago y el río forman una cadena simple (composición de funciones); la ciénaga, el delta y el océano se reciben datos unos a otros, y ese lazo se resuelve con una iteración de punto fijo. Al final se resuelve un sistema de ecuaciones lineales para saber de dónde viene el agua de cada cuerpo (trazadores).

El simulador de ríos (el proyecto de referencia de la serie) conserva su propio modelo: un adaptador (`js/nodos/rios.js`) usa sus funciones puras (`lluvia.js` y `rio.js`) para armar su frontera con el año mes a mes. El río también tiene su pestaña Conexión: si está abierto en el mismo navegador y publica su frontera, al marcar aquí «Aplicar en vivo» el sistema usa la del simulador abierto.

La escena 3D es una maqueta esquemática de la región con el norte hacia el mar: la Sierra Nevada con su glaciar, la laguna del páramo y el lago; el río que baja a la ciénaga con su manglar y su barra de arena; el río grande con sus caños, su delta y su pluma de lodo; la playa de la bahía con la ciudad; y el mar Caribe con el oleaje, un buque y una boya. Cada día del reloj cambian los caudales, la sal de la ciénaga, las plumas, el oleaje y el nivel del mar. Tiene cuatro vistas (Red, Sierra, Costa y Mar).

El panel tiene ocho pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Red del agua, Caudal y tiempo, Calidad y trazadores, Sedimento, El mar y la costa, Clima y horizonte, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D.

## Requisito: las carpetas de la serie juntas

El sistema conectado importa los modelos de las carpetas hermanas (`../simulador-hidrico-3D - Lagunas/js/…`). Funciona cuando todas las carpetas de la serie están en la misma carpeta (como vienen en el .zip de la serie) y se sirve esa carpeta común:

```
serie/
  index.html                                   portal de la serie
  simulador-hidrico-3D - Lagunas/
  simulador-hidrico-3D - Lagos/
  simulador-hidrico-3D - Rios exorreicos/
  simulador-hidrico-3D - Cienagas/
  simulador-hidrico-3D - Deltas/
  simulador-hidrico-3D - Costas/
  simulador-hidrico-3D - Oceanos/
  simulador-hidrico-3D - Sistema conectado/
```

Si falta alguna carpeta, el sistema sigue funcionando con la frontera de referencia de ese proyecto (`js/referencia.js`, generada con `_herramientas/referencia-sistema.mjs`) y la revisión lo advierte.

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/proyectos.js        Carga los modelos de los demás proyectos (import dinámico)
js/nodos/rios.js       Adaptador del simulador de ríos (sin modificarlo)
js/cadena.js           Composición de los modelos, lazo de la costa, trazadores, horizontes e intervenciones
js/algebra.js          Matrices: adyacencia, producto, potencias, alcanzabilidad y Gauss-Jordan
js/sistema.js          Parámetros, reloj del año, indicadores, comparaciones, escenarios y revisión
js/referencia.js       Fronteras de referencia de cada eslabón (si falta una carpeta)
js/nodo.js             El sistema como nodo de la serie (recibe las fronteras de todos)
js/hojas.js            Hojas propias del Excel (con fórmulas)
js/app.js              Pestañas, controles, resultados, ecuaciones y gráficas
js/escena3d.js         Escena 3D con Three.js
js/excel.js, js/nucleo/, lib/   Núcleo común de la serie y librerías locales
tests/                 Pruebas del álgebra, de la cadena, del sistema y de los datos (npm test)
documentos/            Informe técnico científico y manual de usuario (.docx)
```

## Objetos matemáticos del simulador

| Requisito | Dónde se aplica | Función |
|---|---|---|
| Decimales y notación científica | Fracciones del agua de la laguna en el mar (1.0·10⁻⁶) | `pctFrac`, `cientifico` (app.js) |
| Ecuación lineal | Suma de caudales en las confluencias; mezcla como promedio ponderado C = ΣQ·C/ΣQ; carga Q·C; arena de la playa proporcional a la carga del río grande; ancho de la playa W(t) = W₀ + v·t | `mensual` (nodos/rios.js), `trazadores` (cadena.js) |
| Composición de funciones | Q_río = f_río(f_lago(f_laguna(clima))): la salida de un simulador es la entrada del siguiente | `calcularCadena`, `evaluarNodo` |
| Matrices | Matriz de adyacencia A de la red, A² (caminos de dos pasos) y alcanzabilidad R = A + A² + … + A⁶ | `adyacencia`, `multiplicar`, `potencia`, `alcanzabilidad` |
| Sistema de ecuaciones lineales | Trazadores (I − M)·F = B resueltos con Gauss-Jordan; determinante det(I − M) = 1 − m_CX·m_XC | `trazadores`, `gaussJordan` |
| Sucesión convergente | Iteración de punto fijo del lazo ciénaga ⇄ delta ⇄ océano con su error relativo | `calcularCadena`, `errorRelativo` |
| Función racional | Tiempo de residencia τ = V/Q; regla de Bruun R = S·x_c/(B + h_c) | `edadAgua`, pestaña El mar y la costa |
| Suma de una serie | Edad del agua: τ_laguna + τ_lago + t_río + τ_ciénaga | `edadAgua` |
| Función cuadrática y su derivada | Ascenso del mar h(t) = a·t + b·t² y su rapidez h′(t) = a + 2b·t, que el océano entrega a la costa | `HORIZONTES`, nodo del océano |
| Función logarítmica | Órdenes de magnitud log₁₀(Q_delta/Q_laguna); escalas logarítmicas de caudal, sedimento y fracciones | pestañas Caudal y Calidad |
| Porcentajes y razones de cambio | Cambio porcentual con El Niño y La Niña y elasticidad ε = (ΔQ/Q)/(ΔP/P) | pestaña Clima y horizonte |
| Interpolación lineal y función periódica | Valor de cada día entre las medias de los meses; el año se repite | `valorDia` |

## Escenario base

Año normal, horizonte 2026 y ningún eslabón intervenido. La laguna rebosa 106.9 L/s al lago (tiempo de residencia de 38.3 días); el lago, con su cuenca, su lluvia, su evaporación y su toma, desagua 1.40 m³/s al río (8.4 % más que sin la laguna) y retiene el agua 26.0 años; el río lleva 7.79 m³/s a la ciénaga (6.37 de su cuenca y 1.40 del lago), con 823 mg/L de sedimento y 43.0 µg/L de fósforo, y tarda 16.6 horas en recorrer sus tres zonas. La ciénaga saca 254.7 m³/s por la Boca de la Barra, con una salinidad media de 21.38 PSU (máxima de 27.6) y se rellena 4.28 mm al año; el río grande llega al mar con 6 814 m³/s, 615 mg/L y 139.8 Mt de sedimento al año; el mar tiene olas de H_s = 1.47 m y T_p = 5.84 s; la bahía deja entrar 1.10 m de oleaje y la playa gana 0.50 m al año. Al mar llegan 7 069 m³/s de agua dulce (222.9 km³ al año) y el agua de la laguna tarda en promedio 26.1 años en llegar.

El lazo de la costa converge en 2 iteraciones (errores de 3.7·10⁻³ y 0). Con los trazadores, el agua de la ciénaga es 39.9 % del río grande, 40.4 % del mar, 19.7 % de lluvia y ríos locales y 0.012 % de la laguna del páramo; frente a las bocas, el agua de la laguna es 1.0·10⁻⁴ %, y la salinidad que dan los trazadores (27.85 PSU) coincide con la del océano (27.97 PSU). det(I − M) = 0.99558. Los 78 criterios de los siete simuladores se cumplen.

## Pestañas

- **Red del agua**: mapa de la red, intervenciones de cada eslabón, lo que pasa por cada uno de los 10 enlaces, la matriz de adyacencia y su cuadrado, la iteración del lazo de la costa y lo que cambia al conectar.
- **Caudal y tiempo**: caudal de cada eslabón mes a mes (escala logarítmica), órdenes de magnitud, tiempos de residencia y edad del agua.
- **Calidad y trazadores**: temperatura, oxígeno y fósforo de cada eslabón; sistema lineal de los trazadores con su matriz aumentada y su solución; salinidad por mezcla y por evaporación.
- **Sedimento**: sedimento de cada eslabón, carga del río grande, arena de la playa y su ancho en 50 años.
- **El mar y la costa**: lo que entrega el océano (nivel, rapidez del ascenso, marea, oleaje, salinidad y temperatura) y lo que pasa en la ciénaga, el delta y la playa en cada horizonte.
- **Clima y horizonte**: la red completa con los tres climas, el cambio porcentual de cada eslabón y si amplifica o amortigua la sequía y la creciente.

## Escenarios

| Escenario | Criterios que se cumplen | Lo que se ve |
|---|---|---|
| Del páramo al mar hoy | 78 de 78 | Escenario base |
| El Niño en toda la cadena | 57 de 78 | El lago deja de desaguar (−100 %), el río baja 46.3 % y la bocatoma se queda sin agua dos meses; la ciénaga sube a 32.1 PSU; el arrecife llega a 5.3 °C·semana; la playa pierde arena |
| La Niña en toda la cadena | 74 de 78 | El lago desagua 3.20 m³/s; la ciénaga se rellena 6.92 mm/año; la pluma del río grande llega al arrecife |
| Cuencas intervenidas | 68 de 78 | Páramo degradado, cebolla en la cuenca del lago, aguas residuales en el río y cuenca del río grande deforestada |
| Más agua para las ciudades | 73 de 78 | El lago casi no desagua (0.01 m³/s): el agua de la laguna en el mar baja a 4.6·10⁻⁷ % |
| Represas en la cuenca del río grande | 73 de 78 | El río grande trae 35.0 Mt/año: a la playa llega una cuarta parte de la arena y se erosiona |
| Restauración | 77 de 78 | Con los caños dragados la ciénaga baja a 15.25 PSU pero recibe más lodo del río grande (8.12 mm/año) |
| Horizonte 2050 | 76 de 78 | El mar sube 10.2 cm (5.2 mm/año) |
| Horizonte 2100 con muchas emisiones | 70 de 78 | El mar sube 68.2 cm (15.1 mm/año): los palafitos se inundan, la llanura del delta queda a 41 años del mar y la playa retrocede 40.1 m en 50 años |
| El Niño en 2100 con muchas emisiones | 53 de 78 | Las dos presiones juntas |
| Proyectos sin conectar | 78 de 78 | Cada simulador con sus propios valores de referencia |

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-sistema_AAAA-MM-DD_HH-MM.xlsx` con nueve hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Red y matrices (la matriz de adyacencia y su cuadrado con fórmulas), Trazadores (la solución y la comprobación de que cada fila suma 1), Año conectado (los caudales de cada mes con su promedio pesado por los días), Edad del agua (la suma acumulada) y Conexión.

La pestaña Conexión recibe fronteras de los siete proyectos: una frontera importada (archivo .json) o recibida en vivo de un simulador abierto en otra pestaña del mismo navegador reemplaza al modelo de ese eslabón en la cadena, y todo lo que está aguas abajo se recalcula con ella. «Quitar las fronteras importadas» (pestaña Red del agua) vuelve a los modelos. Su frontera de salida es lo que la red lleva al mar.

## Probar en el computador

Desde la carpeta que contiene todos los proyectos de la serie:

```
python -m http.server 8000
```

y abrir `http://localhost:8000/simulador-hidrico-3D%20-%20Sistema%20conectado/`. Las pruebas se corren desde la carpeta del proyecto:

```
npm test
```

Son 26 pruebas: 4 del álgebra, 10 de la cadena, 6 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia y límites

Cada eslabón usa los valores de referencia de su propio simulador; el sistema conectado solo cambia lo que llega por las fronteras, el clima, el horizonte y las intervenciones. Las fronteras se intercambian con los promedios del año; cada simulador arma su año mes a mes con su propio modelo (el río recibe el lago mes a mes). Para no contar el clima dos veces, cuando un simulador recibe un caudal, un oleaje o una carga que ya traen el clima del año, divide por su propio factor climático. El adaptador del río usa concentraciones de fósforo de referencia para los vertimientos (el simulador de ríos no modela el fósforo). La playa es el eslabón más sensible: su balance es la pequeña diferencia entre la arena que entra y la que sale, y el ancho en 50 años supone que el mismo año se repite. Antes de la sustentación conviene contrastar los valores de cada simulador con las fuentes que cita su propio README.
