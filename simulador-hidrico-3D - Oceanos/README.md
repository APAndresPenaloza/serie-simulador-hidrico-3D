# Simulador hídrico 3D · Océanos

Aplicación web interactiva que simula el mar abierto, con valores de referencia inspirados en el mar Caribe frente a Colombia: las olas que levantan los vientos alisios (con su energía, su potencia y la distribución de sus alturas), las mareas y sus batidos, la fuerza de Coriolis, el transporte y la espiral de Ekman, el afloramiento de agua fría frente a La Guajira, la termoclina, el calor acumulado que blanquea los corales, la pluma de agua dulce del río grande y la densidad del agua de mar, el ascenso del nivel del mar y la acidificación.

Es el séptimo eslabón de la serie de simuladores hídricos 3D: recibe del delta el caudal del río grande y entrega a la ciénaga, al delta y a la costa las condiciones del mar (nivel medio en el año del horizonte y rapidez de su ascenso, marea, oleaje, salinidad y temperatura).

La escena 3D es esquemática: la superficie del mar se mueve con tres trenes de olas que empujan los alisios y su color sigue a la temperatura (más clara y fría junto a la costa cuando aflora el agua del fondo); hay flechas del viento y del transporte de Ekman, la costa con el mareógrafo (que marca la marea y el ascenso del mar), los molinos de La Guajira, la boya oceanográfica, un buque, la boca del río con su pluma y el arrecife de coral, que se blanquea con el calor acumulado. Tiene cuatro vistas (Mar, Columna, La Guajira y Arrecife). En la vista Columna la mitad oriental se recorta y se ve la columna de agua coloreada por la temperatura, con la termoclina, las flechas de la espiral de Ekman a varias profundidades y la celda del afloramiento.

El panel tiene nueve pestañas, en dos filas: Olas, Mareas, Viento y corrientes, Temperatura y coral, Salinidad y densidad, Nivel del mar, Carbono y acidez, Datos y Conexión.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Oceanografía Física y Cambio Climático en el Caribe).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie
js/modelo.js           Núcleo matemático: solo funciones puras
js/sistema.js          Viento, olas, Ekman, temperatura y calor acumulado con el reloj (pasos de 6 h), año de régimen, proyecciones, escenarios y revisión
js/nodo.js             El océano como nodo de la serie (recibe del delta; entrega a la ciénaga, al delta y a la costa)
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
| Decimales | Parte de agua de río en la pluma | `salinidadPluma` |
| Ecuación lineal | Celeridad en aguas profundas C = g·T/(2π); período de Pierson y Moskowitz T = 7.16·U/g; ecuación de estado ρ = ρ₀[1 − α(T − T₀) + β(S − S₀)]; expansión térmica Δh = α·ΔT·H; enfriamiento por el afloramiento | `celeridadProfunda`, `periodoPM`, `densidad`, `expansionTermica` |
| Ecuación cuadrática | Longitud de onda L₀ = g·T²/(2π); H_s = 0.21·U²/g; energía E = ρ·g·H²/16; esfuerzo del viento τ = ρ_a·C_D·U²; ascenso del mar h = a·t + b·t² | `longitudProfunda`, `alturaPM`, `energiaOla`, `esfuerzoViento`, `ascensoMar` |
| Raíz cuadrada | Profundidad de Ekman D = π·√(2A_z/f); ola máxima H_máx = H_s·√(ln N/2) | `profundidadEkman`, `olaMaxima` |
| Función potencia | Potencia del oleaje P = ρ·g²·H²·T/(64π) | `potenciaOla` |
| Función racional | Transporte de Ekman M = τ/(ρ·f); período del batido 1/(1/T₁ − 1/T₂); salinidad de la pluma S = S_mar·V/(V + Q·τ) | `transporteEkman`, `periodoBatido`, `salinidadPluma` |
| Función exponencial | Rayleigh P(H > x) = e^(−2(x/H_s)²); espiral de Ekman e^(−πz/D); CO₂ C₀·e^(r·t); aragonito Ω₀·10^(0.7(pH − pH₀)); la temperatura se acerca a su equilibrio | `probRayleigh`, `espiralEkman`, `co2`, `aragonito`, `relajar` |
| Función logarítmica | pH = −log₁₀[H⁺] y su caída pH₀ − 0.9·log₁₀(C/C₀) | `phMar`, `hidrogeniones` |
| Función logística | Perfil de la temperatura con la profundidad (termoclina) | `perfilTemperatura` |
| Trigonométrica y periódica | Coriolis f = 2Ω·sin φ; marea (K1, O1, M2 y S2); alisios y temperatura del año | `coriolis`, `marea` |
| Por tramos | Alerta de blanqueamiento de NOAA Coral Reef Watch; estado de la calcificación con el aragonito | `alertaCoral`, `calcificacion` |

## Escenario base

Año neutro a 11.5° N; alisios de 8 m/s de media (11 m/s a comienzos de febrero y 5 m/s en agosto), C_D = 0.0013, A_z = 0.02 m²/s y franja de afloramiento de 30 km que enfría 0.15 °C por cada m/día; marea del Caribe (K1 = 0.09, O1 = 0.07, M2 = 0.06 y S2 = 0.02 m); superficie a 28 ± 1 °C (máxima en octubre), 12 °C bajo la termoclina a 40 m (espesor de 15 m) y respuesta de 20 días; arrecife con MMM de 29 °C; mar a 36.2 PSU y río grande con 6 800 m³/s en una caja de 2 000 km² × 10 m renovada en 10 días; año 2026 con el mar subiendo 3.3 mm/año (aceleración de 0.04 mm/año²), CO₂ de 425 ppm creciendo 0.55 % al año, pH de 8.05 y aragonito de 3.9.

El 1 de enero a las 06:00 sopla a 10.4 m/s: el esfuerzo es de 0.167 Pa, f = 2.908·10⁻⁵ 1/s, el transporte de Ekman es de 5.61 m²/s mar afuera (profundidad de Ekman de 116.5 m) y el agua aflora a 16.1 m/día; el mar tiene olas de H_s = 2.29 m y T_p = 7.55 s (17.5 kW/m; la ola más alta de 3 horas, 4.47 m); el arrecife está a 28.39 °C y La Guajira a 26.33 °C. En el año la altura significativa media es de 1.47 m (máxima de 2.59 m) con 8.4 kW/m de potencia media; el arrecife va de 27.08 a 28.95 °C sin estrés térmico y La Guajira baja a 24.67 °C; las mareas vivas se repiten cada 14.75 días y las diurnas cada 13.66 días (F = 2.00). Frente a la boca la salinidad es de 27.98 PSU y en el arrecife de 34.37 PSU. Los 6 criterios se cumplen.

## Pestañas

- **Olas**: mar de Pierson y Moskowitz, celeridad, longitud de onda, energía, potencia, ola máxima y distribución de Rayleigh.
- **Mareas**: suma de las cuatro ondas, número de forma y batidos de las mareas vivas y de la marea diurna.
- **Viento y corrientes**: esfuerzo del viento, Coriolis, transporte y profundidad de Ekman, espiral de Ekman y afloramiento con su enfriamiento.
- **Temperatura y coral**: temperatura del año, termoclina logística, HotSpots, grados-semana de calor (DHW) y alertas de blanqueamiento mes a mes.
- **Salinidad y densidad**: pluma del río frente a la boca y en el arrecife, ecuación de estado y perfil de densidad.
- **Nivel del mar**: ascenso cuadrático hasta el año del horizonte, su rapidez (la derivada) y la expansión térmica. Este nivel es el que reciben la ciénaga, el delta y la costa.
- **Carbono y acidez**: CO₂ exponencial, pH logarítmico, iones H⁺ y aragonito con el estado de la calcificación.

## Escenarios

Mar Caribe de hoy, El Niño fuerte (+1.1 °C: DHW de 5.3 °C·semana, alerta 1), La Niña (mar más fresco), alisios más fuertes (H_s máxima de 3.62 m y La Guajira a 23.61 °C), gran creciente del río (16 000 m³/s: el arrecife baja a 32.9 PSU), año 2050 (10.2 cm más de mar, pH de 7.998), año 2100 con pocas emisiones (35.4 cm) y año 2100 con muchas emisiones (68.2 cm, 827 ppm, pH de 7.79, aragonito de 2.56 y alerta 2 de blanqueamiento todos los años).

## Datos y conexión

«Descargar Excel (.xlsx)» crea `simulacion-oceanos_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Viento, Ekman y olas (con fórmulas), Nivel y carbono (con fórmulas), Año mes a mes y Conexión. La pestaña Conexión recibe la frontera del delta (el caudal del río grande) y entrega en la sección «mar» de su frontera el nivel medio del año del horizonte, la rapidez con que sube en ese año (la derivada de su ascenso), la amplitud de la marea, el oleaje medio del año (altura, período y dirección), la salinidad y la temperatura del mar.

## Probar en el computador

```
python -m http.server 8000
npm test
```

Son 21 pruebas: 8 del modelo, 7 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

Los valores del escenario base son de referencia, inspirados en el Caribe colombiano, y se pueden editar: los alisios, el coeficiente de arrastre, la viscosidad turbulenta, el ancho del afloramiento, las temperaturas, la termoclina, la MMM del arrecife, la pluma, el ascenso del mar, el calentamiento y el carbono. Antes de la sustentación conviene contrastarlos con los datos del CIOH y la DIMAR, los productos de NOAA Coral Reef Watch para el Caribe, los reportes del INVEMAR sobre los arrecifes y los informes del IPCC sobre el nivel del mar y la acidificación.
