# Simulador hídrico 3D · Lagos andinos

Aplicación web interactiva que simula un lago andino profundo de alta montaña, con valores de referencia inspirados en el lago de Tota (Boyacá, 3 015 m.s.n.m., el lago natural más grande de Colombia): el balance de agua y el nivel con su desagüe al río, la forma de la cubeta (hipsometría), la estratificación térmica y la densidad del agua, el viento con el número de Wedderburn y las seiches, el oxígeno del hipolimnion y la anoxia, y el fósforo que llega de la cebolla, las jaulas de trucha y los pueblos, con el modelo de Vollenweider y el índice de Carlson.

Es el segundo eslabón de la serie de simuladores hídricos 3D: recibe el agua que rebosa de la laguna del páramo y entrega al río el agua que desagua.

La escena 3D muestra el lago en su valle, con las quebradas de la cuenca, la cebolla en las laderas, el pueblo de la orilla y su vertimiento, las jaulas de trucha, la boya con la cadena de termómetros y el desagüe. Tiene cuatro vistas (Lago, Corte, Cuenca y Jaulas). En la vista Corte el frente del valle se recorta como una maqueta y se ven las capas del lago coloreadas por la temperatura y el oxígeno, con la termoclina inclinada por el viento.

El panel tiene ocho pestañas: Cuenca, Morfometría, Temperatura, Viento, Oxígeno, Nutrientes, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Limnología Física y Calidad del Agua de Lagos).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Balance, estratificación, oxígeno y nutrientes con el reloj; escenarios y revisión
js/nodo.js             El lago como nodo de la serie (recibe de la laguna, entrega al río)
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
| Decimales | hm³, km², desarrollo de la orilla D_L = P/(2√(πA)) | `desarrolloOrilla` |
| Ecuación lineal | Nivel con caudales fijos dh/dt = Q/A; oxígeno del hipolimnion OD(t) = OD₀ − (AHOD/h_h)·t y su raíz (días hasta la anoxia); carga de fósforo como suma de fuentes | `pendienteNivel`, `oxigenoHipolimnion`, `diasHastaOxigeno` |
| Ecuación cuadrática | Densidad del agua ρ(T) = 1000 − 0.0068·(T − 4)² (vértice en 4 °C); esfuerzo del viento τ = ρ_a·C_D·U² | `densidad`, `esfuerzoViento` |
| Raíz cuadrada | Seiche de Merian T = 2L/√(g·z̄) y seiche interna; velocidad de fricción u* = √(τ/ρ) | `seicheSuperficial`, `seicheInterna`, `velocidadFriccion` |
| Función potencia | Hipsometría A(z) = A₀·(1 − z/z_máx)^m, su integral V = A₀·z_máx/(m + 1); desagüe Q = C·b·η^1.5 | `areaProfundidad`, `volumenLago`, `desague` |
| Función racional | Vollenweider P = P_in/(1 + √τ) y carga admisible; tiempo de residencia τ = V/Q; número de Wedderburn W = g'·h_e²/(u*²·L) | `fosforoLago`, `cargaAdmisible`, `tiempoResidencia`, `wedderburn` |
| Función logarítmica | Índice de Carlson TSI = 14.42·ln P + 4.15 | `tsiFosforo` |
| Función exponencial | Equivalencias de Carlson (clorofila y Secchi esperados); luz e^(−k·z); perfil logístico de la temperatura; embalse lineal de la cuenca | `secchiDeTSI`, `clorofilaDeTSI`, `perfilTemperatura`, `pasoCuenca` |
| Función periódica | Temperatura de la superficie en el año T̄ + A·cos(2π(d − 30)/365); oscilación de la seiche a·cos(2πt/T) | `temperaturaSuperficie`, `oscilacion` |

## Escenario base

Año normal con 1 000 mm de lluvia; cuenca de 200 km² con coeficiente de escorrentía 0.40; extracción de 0.8 m³/s; lago de 55 km², 60 m de profundidad máxima y exponente hipsométrico 0.8 (1 833 hm³, profundidad media 33.3 m); superficie a 13.2 ± 1.3 °C y fondo a 11 °C con la termoclina a 12 m; viento medio de 5 ± 2 m/s (más fuerte en agosto); 1 200 ha de cebolla con gallinaza, 100 t/año de trucha y 8 000 habitantes con el 50 % del fósforo tratado. El 1 de enero el lago está 0.14 m sobre el umbral del desagüe y entrega 1.32 m³/s al río; la superficie está a 14.35 °C y el lago estratificado (W = 3.68); el fondo tiene 5.42 mg/L de oxígeno; el fósforo es de 14.8 µg/L (mesotrófico, Secchi esperado de 3.2 m). Los 14 criterios se cumplen.

## Pestañas

- **Cuenca**: lluvia con el régimen bimodal de los Andes, embalse lineal de la cuenca, lluvia y evaporación del espejo (Hargreaves a 3 015 m), extracción y desagüe por un vertedero natural. El nivel cambia con el reloj; la tabla simula el año mes a mes. Con El Niño el lago deja de desaguar todo el año.
- **Morfometría**: curva hipsométrica, volumen, profundidad media, desarrollo del volumen y de la orilla, y el lago por capas.
- **Temperatura**: perfil logístico, densidad parabólica, gravedad reducida, frecuencia de flotabilidad y la superficie en el año. El lago es monomíctico cálido: se mezcla en julio y agosto, con el aire más frío y el viento más fuerte.
- **Viento**: esfuerzo del viento, número de Wedderburn (con W < 1 el viento mezcla el lago), inclinación de la termoclina y seiches superficial (22.7 min) e interna (1.6 días). El botón «Ventarrón de un día» mezcla el lago.
- **Oxígeno**: el hipolimnion pierde oxígeno en línea recta mientras está estratificado (la demanda crece con las algas), días hasta la anoxia y hábitat de la trucha.
- **Nutrientes**: fuentes de fósforo (cuenca, cebolla, jaulas, aguas residuales y carga interna del fondo sin oxígeno), Vollenweider, carga admisible para 20 µg/L e índice de Carlson con sus equivalencias.

## Escenarios

Lago de referencia, sequía de El Niño, lluvias de La Niña, más cebolla con gallinaza, más jaulas de trucha, aguas residuales sin tratar, calentamiento de 3 °C con menos viento (el lago deja de mezclarse y el fondo pasa 157 días sin oxígeno) y más agua para las ciudades.

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-lagos_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Fósforo y Carlson (con fórmulas), Densidad y seiches (con fórmulas), Año mes a mes y Conexión. La pestaña Conexión aplica la frontera de la laguna del páramo (un tributario con su fósforo) y entrega al río el desagüe con la temperatura, el oxígeno y el fósforo del lago.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 23 pruebas: 9 del modelo, 8 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en el lago de Tota, y se pueden editar: la lluvia, el coeficiente de escorrentía, la evaporación, la extracción, la forma de la cubeta, las temperaturas, el viento, la demanda de oxígeno del hipolimnion, los coeficientes de exportación de fósforo y la liberación de fósforo del fondo sin oxígeno. Antes de la sustentación conviene contrastarlos con los estudios de la autoridad ambiental y con los datos de las estaciones del IDEAM.
