# Simulador hídrico 3D · Costas

Aplicación web interactiva que simula una playa de bahía del Caribe colombiano, con valores de referencia inspirados en El Rodadero (Santa Marta): el mar de fondo de los alisios y el mar de viento de la brisa de la tarde, la llegada de las olas a la costa (dispersión, asomeramiento, refracción y rotura), la corriente a lo largo de la playa, la marea, la sobreelevación de las tormentas y el remonte frente al malecón, el perfil de equilibrio de Dean y la profundidad de cierre, el balance de arena con el transporte litoral, la regla de Bruun para el ascenso del mar y la calidad del agua de baño frente a un emisario submarino.

Es el sexto eslabón de la serie de simuladores hídricos 3D: recibe del delta la carga de sedimento del río grande (de ella depende la arena que llega a la playa) y del océano el oleaje de fondo, la marea, el nivel medio del mar y la rapidez con que sube.

La escena 3D muestra la bahía entre dos cabos rocosos, la playa con sus parasoles (tantos como la ocupación), el malecón con palmeras, los edificios y los cerros detrás; las crestas de las olas, que se tuercen al acercarse hasta llegar paralelas a la orilla y se vuelven espuma en la rompiente; la espuma que sube y baja por la arena con el remonte; la torre del salvavidas con su bandera (verde, amarilla, roja o morada si el agua está contaminada); el emisario submarino con su pluma, que se aclara camino a la playa; el espolón y la draga del relleno cuando están activos, y el agua sobre el malecón si el nivel total lo pasa. Tiene cuatro vistas (Playa, Rompiente, Perfil y Emisario). En la vista Perfil la mitad oriental se recorta y se ve el corte de la playa con la berma, el perfil de equilibrio, la rompiente y la profundidad de cierre.

El panel tiene nueve pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Oleaje, Rompiente, Marea y nivel, Perfil de playa, Arena de la playa, Ascenso del mar, Agua de baño, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Ingeniería de Costas y Calidad del Agua de Playas).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Oleaje, rotura, nivel, arena y agua de baño con el reloj (pasos de 1 h), año de régimen, escenarios y revisión
js/nodo.js             La playa como nodo de la serie (recibe del delta y del océano)
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
| Decimales | Período del mar combinado como promedio ponderado por la energía; ocupación de la playa | `combinar` |
| Ecuación lineal | Criterio de rotura H = 0.78·h; sobreelevación por la presión (1 cm por hPa); cambio del ancho con el balance de arena y ancho en el tiempo | `rotura`, `sobreelevacionPresion`, `cambioAncho` |
| Ecuación cuadrática | Longitud de onda en aguas profundas L₀ = g·T²/(2π); profundidad de cierre de Hallermeier; sobreelevación por el viento ∝ U² | `longitudProfunda`, `profundidadCierre`, `sobreelevacionViento` |
| Raíz cuadrada | Altura combinada √(H₁² + H₂²); corriente litoral V = 1.17·√(g·H_b)·sin θ·cos θ; remonte de Stockdon ∝ √(H₀·L₀) | `combinar`, `corrienteLitoral`, `remonte` |
| Función potencia | Perfil de Dean h = A·x^(2/3) y su inversa; A = 0.067·w^0.44; dilución inicial ∝ z^(5/3)/Q^(2/3); transporte CERC ∝ H_b^(5/2) | `perfilDean`, `distanciaDean`, `parametroDean`, `dilucionInicial`, `transporteLitoral` |
| Función racional | Velocidad de caída de Ferguson y Church; regla de Bruun R = S·x_c/(B + h_c); años hasta el ancho mínimo | `velocidadCaida`, `bruun`, `anosHastaMinimo` |
| Función hiperbólica | Crecimiento del oleaje con el fetch (tanh, método SMB); dispersión L = L₀·tanh((2πh/L₀)^(3/4))^(2/3) | `oleajeViento`, `longitudOnda`, `celeridades` |
| Exponencial y logarítmica | Muerte de las bacterias C = C₀·10^(−t/T90) | `decaimiento` |
| Trigonométrica | Refracción de Snell sin θ/C = constante; transporte ∝ sin(2θ) | `transformar`, `transporteLitoral` |
| Función periódica | Marea (K1, O1, M2 y S2); brisa del día; temporada de los alisios; T90 con la luz del día | `marea`, `t90Hora` |

## Escenario base

Año normal; mar de fondo de 1.10 m de altura significativa media (35 % más a comienzos de febrero), 7.5 s de período y 3° con la normal a la costa; brisa de 5 ± 3 m/s (máxima a las 15:00) sobre un fetch de 30 km; marea del Caribe (K1 = 0.09, O1 = 0.07, M2 = 0.06 y S2 = 0.02 m); malecón a 2.40 m; arena de 0.25 mm, frente de playa con pendiente 0.08, berma de 1.5 m y ola de 12 horas al año de 3 m con 9 s; playa de 3 km de largo y 40 m de ancho; 447 000 m³ de arena al año desde los ríos y la playa vecina y 15 % de retención en los cabos; mar que sube 3.3 mm/año; emisario de 0.6 m³/s a 40 m de profundidad y 3 km de la playa, con agua tratada (10⁵ NMP/100 mL), corriente de 0.15 m/s y T90 de 3 h al sol y 30 h de noche.

El 1 de enero a las 06:00 llegan olas de 1.42 m y 7.39 s (L₀ = 85.3 m), que rompen a 2.11 m de fondo con 1.64 m de altura y 1.3° de ángulo; la corriente litoral es de 0.11 m/s; la marea está a 0.08 m y el remonte llega a 0.87 m (nivel total de 0.94 m). La arena cae a 3.18 cm/s, el parámetro de Dean es A = 0.1115 m^(1/3), la profundidad de cierre es de 6.06 m y el perfil activo mide 401 m. En el año la altura significativa va de 0.84 m (agosto) a 1.56 m (febrero); salen 436 000 m³ de arena y llegan 447 000 (balance de +10 600 m³/año): la playa gana 0.29 m/año ya descontado el retroceso de Bruun (0.175 m/año), y tendrá 54.7 m en 50 años. El nivel total máximo del año es de 1.10 m. El emisario diluye 36.6 veces al subir y 476 al llegar a la playa, después de 5.56 h de viaje: en la playa hay 135 NMP/100 mL y como máximo 130 en las horas de baño. Los 10 criterios se cumplen.

## Pestañas

- **Oleaje**: mar de fondo de la temporada, mar de viento de la brisa (SMB), mar combinado y longitud de onda en aguas profundas.
- **Rompiente**: altura de la ola al acercarse (asomeramiento y refracción) hasta cortar la recta de rotura, longitud de onda con la profundidad y corriente litoral.
- **Marea y nivel**: marea, tormenta del año (con el botón «Tormenta ahora»), remonte y nivel total frente al malecón en los próximos quince días.
- **Perfil de playa**: velocidad de caída de la arena, perfil de equilibrio de Dean, profundidad de cierre, ancho activo y capacidad de la playa.
- **Arena de la playa**: transporte litoral CERC mes a mes frente a la arena que llega, balance y ancho de playa en 50 años.
- **Ascenso del mar**: regla de Bruun, retroceso en 50 años y línea de retiro sugerida.
- **Agua de baño**: dilución del emisario, muerte de las bacterias con la luz del día y coliformes en la playa a cada hora y según la distancia del emisario.

## Escenarios

Playa de referencia, mar de leva de tres días en marzo (H_s = 3.29 m: el nivel total llega a 2.27 m y la playa pierde 8 600 m³ en el año), tormenta tropical cercana (980 hPa: el nivel total sube a 2.22 m), El Niño (alisios más fuertes y menos arena: la playa pierde 9.7 m/año), menos arena de los ríos (−2.66 m/año: llega al ancho mínimo en 8 años), espolón al final de la playa (+3.69 m/año en esta celda, a costa de la playa vecina), menos arena con relleno de 80 000 m³/año (+0.87 m/año), ascenso del mar de 10 mm/año (retroceso de 26.5 m en 50 años), emisario sin tratamiento (13 020 NMP/100 mL en las horas de baño) y emisario corto y poco profundo (dilución de 30 veces y 2 832 NMP/100 mL).

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-costas_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Oleaje y remonte (con fórmulas), Perfil y Bruun (con fórmulas), Año mes a mes y Conexión. La pestaña Conexión recibe la frontera del delta (la carga de sedimento del río grande fija la arena que llega a la playa) y la del océano (oleaje de fondo, marea, nivel medio y rapidez del ascenso del mar, que mueve la regla de Bruun), y deja en la frontera de la playa la arena que sigue a lo largo de la costa y el agua del emisario.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 22 pruebas: 8 del modelo, 8 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en El Rodadero, y se pueden editar: el oleaje de fondo y su temporada, la brisa, la marea, la arena, la berma, el malecón, la arena que llega, la retención, el emisario y los tiempos de muerte de las bacterias. Antes de la sustentación conviene contrastarlos con los datos de oleaje y marea de la DIMAR y el CIOH, los estudios del INVEMAR sobre erosión costera y los monitoreos de la calidad del agua de las playas de Santa Marta.
