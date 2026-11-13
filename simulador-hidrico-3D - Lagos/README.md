# Simulador hídrico 3D · Lagos andinos

Aplicación web interactiva que simula un lago andino profundo de alta montaña, con valores de referencia inspirados en el lago de Tota (Boyacá, 3 015 m.s.n.m., el lago natural más grande de Colombia): el balance de agua y el nivel con su desagüe al río, la forma de la cubeta (hipsometría), la estratificación térmica y la densidad del agua, el viento con el número de Wedderburn y las seiches, el oxígeno del hipolimnion y la anoxia, el fósforo que llega de la cebolla, las jaulas de peces y los pueblos, con el modelo de Vollenweider y el índice de Carlson, y el **cultivo de peces en jaulas** con tres opciones: la trucha arcoíris (exótica, la referencia) y dos peces nativos de los Andes colombianos, el capitán de la sabana (*Eremophilus mutisii*) y la guapucha (*Grundulus bogotensis*). Para cada especie el simulador calcula cuánto crece con la temperatura del lago, en cuántos días llega a la cosecha, cuánto fósforo deja en el lago por tonelada producida y cuánta producción aguanta el lago.

Es el segundo eslabón de la serie de simuladores hídricos 3D: recibe el agua que rebosa de la laguna del páramo y entrega al río el agua que desagua.

La escena 3D muestra el lago en su valle, con las quebradas de la cuenca, la cebolla en las laderas, el pueblo de la orilla y su vertimiento, las jaulas de peces (con peces que cambian de color y de tamaño con la especie), la boya con la cadena de termómetros y el desagüe. Tiene cuatro vistas (Lago, Corte, Cuenca y Jaulas). En la vista Corte el frente del valle se recorta como una maqueta y se ven las capas del lago coloreadas por la temperatura y el oxígeno, con la termoclina inclinada por el viento.

El panel tiene nueve pestañas: Cuenca, Morfometría, Temperatura, Viento, Oxígeno, Peces, Nutrientes, Datos y Conexión.

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
| Ecuación lineal | Nivel con caudales fijos dh/dt = Q/A; oxígeno del hipolimnion OD(t) = OD₀ − (AHOD/h_h)·t y su raíz (días hasta la anoxia); carga de fósforo como suma de fuentes; fósforo que deja cada tonelada de pescado L_P = 1000·(FCA·p_a − p_p) | `pendienteNivel`, `oxigenoHipolimnion`, `diasHastaOxigeno`, `fosforoPorTonelada` |
| Ecuación cuadrática | Densidad del agua ρ(T) = 1000 − 0.0068·(T − 4)² (vértice en 4 °C); esfuerzo del viento τ = ρ_a·C_D·U²; crecimiento del pez según la temperatura (parábola con el vértice en el óptimo de la especie) | `densidad`, `esfuerzoViento`, `factorTermico` |
| Raíz cuadrada | Seiche de Merian T = 2L/√(g·z̄) y seiche interna; velocidad de fricción u* = √(τ/ρ) | `seicheSuperficial`, `seicheInterna`, `velocidadFriccion` |
| Función potencia | Hipsometría A(z) = A₀·(1 − z/z_máx)^m, su integral V = A₀·z_máx/(m + 1); desagüe Q = C·b·η^1.5 | `areaProfundidad`, `volumenLago`, `desague` |
| Función racional | Vollenweider P = P_in/(1 + √τ) y carga admisible; tiempo de residencia τ = V/Q; número de Wedderburn W = g'·h_e²/(u*²·L); producción de peces que aguanta el lago T_máx = (L_c − L_otras)/L_P | `fosforoLago`, `cargaAdmisible`, `tiempoResidencia`, `wedderburn`, `produccionMaxima` |
| Función logarítmica | Índice de Carlson TSI = 14.42·ln P + 4.15; días a la cosecha t = ln(W_f/W₀)/G | `tsiFosforo`, `diasCosecha` |
| Función exponencial | Equivalencias de Carlson (clorofila y Secchi esperados); luz e^(−k·z); perfil logístico de la temperatura; embalse lineal de la cuenca; crecimiento del pez W(t) = W₀·e^(G·t) | `secchiDeTSI`, `clorofilaDeTSI`, `perfilTemperatura`, `pasoCuenca`, `pesoPez` |
| Función periódica | Temperatura de la superficie en el año T̄ + A·cos(2π(d − 30)/365); oscilación de la seiche a·cos(2πt/T) | `temperaturaSuperficie`, `oscilacion` |
| Por tramos | Factor térmico del pez: 1 − ((T_opt − T)/(T_opt − T_mín))² bajo el óptimo, 1 − ((T − T_opt)/(T_máx − T_opt))² sobre él y 0 fuera del rango | `factorTermico` |

## Escenario base

Año normal con 1 000 mm de lluvia; cuenca de 200 km² con coeficiente de escorrentía 0.40; extracción de 0.8 m³/s; lago de 55 km², 60 m de profundidad máxima y exponente hipsométrico 0.8 (1 833 hm³, profundidad media 33.3 m); superficie a 13.2 ± 1.3 °C y fondo a 11 °C con la termoclina a 12 m; viento medio de 5 ± 2 m/s (más fuerte en agosto); 1 200 ha de cebolla con gallinaza, 100 t/año de trucha en jaulas (conversión de 1.4 con alimento de 0.83 % de fósforo: 7.32 kg de fósforo por tonelada) y 8 000 habitantes con el 50 % del fósforo tratado. El 1 de enero el lago está 0.14 m sobre el umbral del desagüe y entrega 1.33 m³/s al río; la superficie está a 14.34 °C y el lago estratificado (W = 3.63); el fondo tiene 5.51 mg/L de oxígeno; el fósforo es de 14.2 µg/L (mesotrófico, Secchi esperado de 3.4 m). La trucha llega de 5 a 300 g en 212 días y el lago aguanta hasta 433 t/año de trucha antes de pasar la carga admisible. Los 15 criterios se cumplen.

## Las especies para las jaulas

| Especie | Origen | Óptimo y rango | OD mínimo | Conversión | Fósforo por tonelada | En este lago |
|---|---|---|---|---|---|---|
| Trucha arcoíris (*Oncorhynchus mykiss*) | Exótica, de Norteamérica; llegó a Tota en 1939 y se cría en jaulas desde 2005 | 15 °C (4–22 °C) | 5 mg/L | 1.4 | 7.32 kg/t | de 5 a 300 g en 212 días; aguanta 433 t/año |
| Capitán de la sabana (*Eremophilus mutisii*) | Nativo del altiplano Cundiboyacense; vulnerable | 18 °C (8–24 °C) | 6 mg/L | 2.4 | 15.42 kg/t | de 5 a 200 g en 440 días; aguanta 205 t/año |
| Guapucha (*Grundulus bogotensis*) | Nativa del altiplano Cundiboyacense; preocupación menor | 16 °C (6–23 °C) | 4 mg/L | 1.6 | 8.28 kg/t | de 0.2 a 6 g en 186 días; aguanta 382 t/año |

Fuentes de los valores: trucha en Tota, conversión de 1.4 y 7.3 kg de fósforo por tonelada (Torres Barrera y Grandas Rincón, 2017); capitán, conversión de 2.0 a 2.9 y crecimiento de 0.7 a 0.9 % al día de alevinos en jaulas y estanques, calculado con los pesos del informe (Rosado Puccini et al., 2019, convenio AUNAP–U.D.C.A), huevos incubados a unos 13 °C y larvas criadas a 15.7 °C (Moncaleano-Gómez y Prieto-Mojica, 2020), adultos de 200 a 500 g que viven donde el agua no pasa de 18–20 °C (Prieto-Mojica et al., 2017); su temperatura óptima y su oxígeno mínimo de 6 mg/L son **supuestos**; guapucha, pez de hasta 8 cm que come sobre todo larvas de insectos y microcrustáceos (Roa-Fuentes et al., 2013), con valores de cultivo **supuestos** porque no hay datos publicados. Los dos nativos son del altiplano Cundiboyacense (cuenca del Magdalena); a Tota, que desagua al Orinoco, llegaron en el siglo XX. El único pez propio de Tota, el pez graso (*Rhizosomichthys totae*), se considera extinto.

## Pestañas

- **Cuenca**: lluvia con el régimen bimodal de los Andes, embalse lineal de la cuenca, lluvia y evaporación del espejo (Hargreaves a 3 015 m), extracción y desagüe por un vertedero natural. El nivel cambia con el reloj; la tabla simula el año mes a mes. Con El Niño el lago deja de desaguar todo el año.
- **Morfometría**: curva hipsométrica, volumen, profundidad media, desarrollo del volumen y de la orilla, y el lago por capas.
- **Temperatura**: perfil logístico, densidad parabólica, gravedad reducida, frecuencia de flotabilidad y la superficie en el año. El lago es monomíctico cálido: se mezcla en julio y agosto, con el aire más frío y el viento más fuerte.
- **Viento**: esfuerzo del viento, número de Wedderburn (con W < 1 el viento mezcla el lago), inclinación de la termoclina y seiches superficial (22.7 min) e interna (1.6 días). El botón «Ventarrón de un día» mezcla el lago.
- **Oxígeno**: el hipolimnion pierde oxígeno en línea recta mientras está estratificado (la demanda crece con las algas), días hasta la anoxia y hábitat del pez de las jaulas (con el oxígeno mínimo de la especie).
- **Peces**: especie de las jaulas (trucha, capitán de la sabana o guapucha), producción y fósforo del alimento; crecimiento según la temperatura del epilimnion (parábola por tramos), crecimiento exponencial y días a la cosecha, alimento del año, fósforo por tonelada y producción que aguanta el lago. La tabla compara las tres especies en el lago del momento y las gráficas muestran sus curvas de temperatura y de crecimiento.
- **Nutrientes**: fuentes de fósforo (cuenca, cebolla, jaulas, aguas residuales y carga interna del fondo sin oxígeno), Vollenweider, carga admisible para 20 µg/L e índice de Carlson con sus equivalencias.

## Escenarios

Lago de referencia, sequía de El Niño, lluvias de La Niña, más cebolla con gallinaza, más jaulas de trucha (450 t/año: el fósforo pasa de 20 µg/L), jaulas de capitán de la sabana (100 t/año dejan 1 542 kg de fósforo, el doble que la trucha, y tardan 440 días en llegar a la cosecha), jaulas de guapucha (828 kg de fósforo y cosecha en 186 días), aguas residuales sin tratar, calentamiento de 3 °C con menos viento (el lago deja de mezclarse y el fondo pasa 144 días sin oxígeno) y más agua para las ciudades.

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-lagos_AAAA-MM-DD_HH-MM.xlsx` con nueve hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Fósforo y Carlson (con fórmulas), Densidad y seiches (con fórmulas), Año mes a mes, Cultivo de peces (con fórmulas) y Conexión. La pestaña Conexión aplica la frontera de la laguna del páramo (un tributario con su fósforo) y entrega al río el desagüe con la temperatura, el oxígeno y el fósforo del lago.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 25 pruebas: 9 del modelo, 10 del sistema (incluidas las especies de las jaulas y el factor térmico por tramos) y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en el lago de Tota, y se pueden editar: la lluvia, el coeficiente de escorrentía, la evaporación, la extracción, la forma de la cubeta, las temperaturas, el viento, la demanda de oxígeno del hipolimnion, los coeficientes de exportación de fósforo, la liberación de fósforo del fondo sin oxígeno, el fósforo del alimento y la producción de las jaulas (los valores de las especies están en `ESPECIES`, en `js/sistema.js`). Antes de la sustentación conviene contrastarlos con los estudios de la autoridad ambiental y con los datos de las estaciones del IDEAM.
