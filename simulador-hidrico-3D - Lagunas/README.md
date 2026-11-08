# Simulador hídrico 3D · Lagunas de alta montaña

Aplicación web interactiva que simula una laguna glaciar somera del páramo de la Sierra Nevada de Santa Marta, a 4 300 m de altitud: el clima de alta montaña, el glaciar que la alimenta y su retroceso, el páramo que guarda la lluvia como una esponja, el balance de agua y el nivel de la laguna, su calidad (fósforo, clorofila, transparencia, plantas sumergidas y oxígeno), el oleaje que levanta el viento, los sedimentos que la llenan poco a poco y la amenaza de que una laguna represada por una morrena se vacíe de golpe sobre el pueblo de la quebrada.

Es el primer eslabón de la serie de simuladores hídricos 3D que sigue el agua del páramo al océano: lo que rebosa de la laguna baja al lago, al río, a la ciénaga, al delta, a la costa y al mar. El simulador de ríos exorreicos de Santa Marta es el proyecto de referencia de la serie.

La escena 3D muestra un circo glaciar con el glaciar en el pico, las laderas con frailejones, potreros y papa, la laguna en su cubeta, el vertedero, la quebrada que baja hasta el pueblo y la toma del acueducto veredal. Tiene cinco vistas (Páramo, Laguna, Glaciar, Corte y Quebrada); al cambiar de pestaña, la cámara va sola a la vista que corresponde. En la vista Corte el frente del terreno se recorta como una maqueta y se ven la luz que entra en el agua, las plantas del fondo y el lodo.

El panel tiene nueve pestañas (en dos filas, o en más si los nombres no caben en el ancho del panel): Clima, Páramo, Laguna, Calidad, Viento, Sedimentos, Amenazas, Datos y Conexión. En la barra de arriba, el primer indicador es el nivel de alerta.

Proyecto de Álgebra y Geometría Analítica, 2026-II. Serie de simuladores hídricos 3D (línea de investigación: Limnología e Hidrología de Alta Montaña).

## Estructura

```
index.html             Página principal (se arma con proyecto.json)
proyecto.json          Título, descripción, ayuda y leyenda de la escena
css/styles.css         Estilos comunes de la serie (modo claro y oscuro, adaptable a celular)
js/modelo.js           Núcleo matemático: solo funciones puras, sin gráficos
js/sistema.js          Une el modelo en un solo cálculo con el reloj, los escenarios y la revisión de criterios
js/nodo.js             La laguna como nodo de la serie: frontera de salida y año mes a mes
js/hojas.js            Hojas propias del libro de Excel (con fórmulas)
js/app.js              Pestañas, controles, resultados, ecuaciones con valores sustituidos y gráficas
js/escena3d.js         Escena 3D con Three.js
js/excel.js            Escritor de archivos .xlsx sin librerías (el mismo del simulador de ríos)
js/nucleo/             Núcleo común de la serie: controlador (app-base), escena base, gráficas,
                       formatos, registro y Excel (datos) y contrato de conexión (conexion)
lib/                   Three.js 0.170 y Chart.js 4.4 (copias locales, licencia MIT)
tests/modelo.test.js   Pruebas del modelo con valores calculados a mano
tests/sistema.test.js  Pruebas del sistema: escenario base, clima, páramo, balance, histéresis, vaciado, año
tests/datos.test.js    Pruebas del libro de Excel, del registro y de la frontera de conexión
documentos/            Informe técnico científico y manual de usuario (.docx)
```

Las librerías van incluidas en `lib/` y el Excel se genera con código propio, así que el simulador no depende de ningún CDN. La carpeta `js/nucleo/` es igual en todos los proyectos de la serie.

## Objetos matemáticos del simulador

| Requisito | Dónde se aplica | Función en `modelo.js` |
|---|---|---|
| Decimales | Láminas de lluvia y evaporación sobre un área (mm → m³), hectáreas, L/s, punto de ebullición 100 − z/300 | `mmDiaAm3s`, `haAm2`, `puntoEbullicion` |
| Ecuación lineal | Temperatura con la altitud T(z) = T_mar − Γ·z y su raíz (isoterma de 0 °C) | `temperaturaAltitud`, `altitudCeroGrados` |
| Ecuación lineal | Derretimiento por grado-día M = DDF·(T − T₀) | `derretimiento` |
| Ecuación lineal | Embalse lineal del páramo Q = S/k; área del espejo A(h) = (A_u/h_u)·h; nivel con caudales fijos dh/dt = Q/A | `salidaParamo`, `areaEspejo`, `pendienteNivel` |
| Ecuación lineal | Colmatación V(t) = V₀ − ΔV·t | `volumenColmatado` |
| Ecuación cuadrática | Volumen de la cubeta en paraboloide V(h) = A_u·h²/(2h_u) y su despeje h = √(2h_u·V/A_u) | `volumenLaguna`, `nivelDeVolumen` |
| Ecuación cuadrática | Longitud de onda L = g·T²/(2π); ley de Stokes v = K·d² | `longitudOla`, `velocidadCaida` |
| Vértice | Pico del agua del glaciar: Q(t) = DDF·(T₀ + w·t)·A₀·e^(−λt) es máxima en t* = 1/λ − T₀/w | `picoDeshielo`, `deshieloFuturo` |
| Función exponencial | Recesión del páramo Q = Q₀·e^(−t/k); retroceso del glaciar A = A₀·e^(−λt); luz I/I₀ = e^(−k_d·z); atenuación de la crecida | `recesion`, `areaGlaciar`, `fraccionLuz`, `atenuacion` |
| Función logarítmica | Índice de Carlson TSI = 60 − 14.41·ln DS; años hasta el 1 % del glaciar t = ln(100)/λ; zona fótica ln(100)/k_d | `tsiSecchi`, `anosHastaFraccion`, `zonaFotica` |
| Función potencia | Vertedero Q = C·L·H^1.5; vaciado súbito Q = 75·V^0.67; clorofila Chl = 0.0731·P^1.449; olas H = 0.0016·U·√(F/g) | `vertedero`, `caudalVaciado`, `clorofila`, `alturaOla` |
| Función racional | Fósforo de Vollenweider P = P_in/(1 + √τ); turbidez con plantas y función de Hill de Scheffer; transparencia DS = 1.7/k_d | `fosforoLaguna`, `turbidezConPlantas`, `plantasEquilibrio`, `secchi` |
| Función periódica | Oxígeno del día OD(t) = ŌD − A·cos(2π(t − 5)/24); temperatura del agua | `oxigenoHora`, `temperaturaAgua` |
| Raíces de una ecuación | Estados estables de la laguna: raíces de V*(k_d(V)) − V = 0 (bisección) | `equilibriosScheffer` |

## Clima y glaciar (pestaña Clima)

- **Temperatura con la altitud** (recta): con 27.6 °C a nivel del mar y un gradiente de 5.5 °C por kilómetro, la laguna (4 300 m) está a 3.95 °C y el frente del glaciar (4 900 m), a 0.65 °C. La isoterma de 0 °C queda a 5 018 m.
- **Lluvia**: 1 300 mm en un año normal, repartidos con el régimen bimodal del Caribe (secas de diciembre a marzo; lluvias en mayo y de septiembre a noviembre). El Niño baja la lluvia al 60 % y sube la temperatura 0.8 °C; La Niña la sube al 150 % y la baja 0.5 °C.
- **Evaporación**: Hargreaves con la radiación extraterrestre de la FAO-56 para 10.85° N; el espejo de agua evapora 1.05·ET₀ (1.98 mm/día el 1 de enero).
- **Glaciar**: 0.25 km² con un factor de grado-día de 7 mm/(°C·día): se derriten 4.55 mm al día y llegan 13.2 L/s (el 12 % del agua que entra). Pierde el 4 % de su área al año (el IDEAM reporta entre el 3 y el 5 % en la Sierra Nevada): queda el 1 % en 115 años. Con la tendencia de calentamiento de 0.02 °C/año el pico del agua del glaciar ya pasó.

## Páramo (pestaña Páramo)

El suelo del páramo es un embalse lineal: suelta un caudal proporcional al agua que guarda, Q = S/k. Con lluvia constante la solución exacta es S(t) = R·k + (S₀ − R·k)·e^(−t/k), y sin lluvia el caudal baja como una exponencial. Conservado (frailejones y musgos), k = 60 días y llega a la laguna el 65 % de la lluvia más un 10 % de agua de niebla; intervenido, k = 30 días; degradado (suelo compactado y quemado), k = 12 días, sin niebla y con diez veces más sedimento. En el escenario base el páramo entrega 103.2 L/s en promedio y 46.0 L/s al final del verano (31 de marzo). Los potreros y la papa exportan fósforo y sedimento (coeficientes de referencia editables).

## Laguna (pestaña Laguna)

La cubeta es un paraboloide: A(h) = (A_u/h_u)·h y V(h) = A_u·h²/(2h_u). Con 12 ha y 6 m en el umbral guarda 360 000 m³. El nivel cambia con el reloj: dV/dt = páramo + glaciar + lluvia − evaporación − infiltración − toma − vertedero, con el vertedero Q = C·L·(h − h_u)^1.5 (C = 1.7, L = 3 m). En el escenario base (1 de enero, 06:00) la laguna está a 6.07 m, rebosa 103.4 L/s, el caudal ecológico es 28.2 L/s (25 % del medio) y, si dejara de entrar agua, la toma del acueducto veredal (4 L/s, unas 2 880 personas) tendría 295 días de autonomía. La tabla «Un año mes a mes» simula el año día a día.

## Calidad del agua (pestaña Calidad)

- **Fósforo**: carga de la cuenca y de las jaulas de trucha (10 kg de fósforo por tonelada de trucha), concentración de entrada y fósforo de la laguna con Vollenweider, P = P_in/(1 + √τ): 5.07 µg/L en el escenario base.
- **Algas y luz**: clorofila de Dillon y Rigler (0.77 µg/L), turbidez k_d = k_w + 0.02·Chl + 0.05·SS, transparencia DS = 1.7/k_d (5.16 m) e índice de Carlson (30.6: oligotrófica).
- **Estados alternativos (Scheffer, 1993)**: las plantas sumergidas reducen la turbidez, k_d = k_w + (E₀ − k_w)·h_v/(h_v + V), y crecen si llega luz al fondo, V* = h_e^8/(h_e^8 + k_d^8). Con pocos nutrientes la laguna solo puede estar clara; con 25 t/año de trucha puede estar clara o turbia según su historia (histéresis), y el botón «Arrancar las plantas» lo muestra; con más nutrientes solo puede estar turbia. El diagrama de la pestaña dibuja las dos curvas y sus cruces.
- **Oxígeno a 4 300 m**: la saturación del agua a 3.95 °C se corrige por la presión del aire (59.3 kPa): 7.58 mg/L. El ciclo diario tiene el mínimo a las 05:00 (7.04 mg/L) y el máximo a las 17:00. El agua hierve a 85.7 °C.

## Viento (pestaña Viento)

Olas limitadas por el fetch (el diámetro del espejo, 393 m): con 6 m/s, H = 6.1 cm, T = 0.83 s y L = g·T²/(2π) = 1.08 m. Las olas mueven el fondo hasta L/2; en el paraboloide la parte del fondo más llana que d es d/h, así que remueven el 8.9 % del fondo.

## Sedimentos (pestaña Sedimentos)

La cuenca suelta 53 t/año; cada clase de grano se queda si su velocidad de Stokes supera la carga superficial Q/A, y la laguna atrapa el 96.5 %. Con una densidad del lodo de 1.2 t/m³ pierde 42.6 m³ al año (0.012 %): se llenaría en unos 8 400 años. Con papa en ladera o el páramo degradado la vida de la laguna baja a unos cientos de años.

## Amenazas (pestaña Amenazas)

Si la laguna está represada por una morrena y el dique se rompe, el caudal pico es Q = 75·V^0.67 (Clague y Mathews, 1973) con el volumen que sale hasta la mitad de la profundidad: 31.9 m³/s. La onda se atenúa como Q(x) = Q_p·e^(−x/λ) y llega al pueblo, a 12 km, en 67 min con 21.4 m³/s, más de lo que cabe en su cauce (16.9 m³/s con Manning). «Simular la rotura del dique» vacía la laguna con el hidrograma Q(t) = Q_p·(t/t_p)·e^(1 − t/t_p). El nivel de alerta es verde sin amenazas, amarillo con El Niño, La Niña o meses sin rebose, naranja con una morrena cuya crecida no cabe en el cauce y rojo durante un vaciado o con la laguna bajo la toma.

## Escenarios

Laguna de referencia, sequía de El Niño, lluvias de La Niña, páramo degradado por ganadería y quemas, papa en la cuenca, jaulas de trucha, laguna turbia (truchas y plantas arrancadas), el glaciar en 2050, laguna represada por una morrena, más agua para el acueducto y El Niño en 2066 sin glaciar y con más toma (la quebrada se seca de marzo a mayo).

## Pestaña Datos: guardar la simulación en Excel

Mientras corre el reloj se guarda una fila cada 6 h de tiempo simulado (1 h, 6 h o 1 día). «Guardar escenario» copia todos los parámetros y resultados del momento. «Descargar Excel (.xlsx)» crea `simulacion-lagunas_AAAA-MM-DD_HH-MM.xlsx` con ocho hojas: Resumen, Parámetros y resultados, Serie de tiempo, Revisión del diseño, Fósforo y estado trófico (con fórmulas), Cubeta y vertedero (con fórmulas), Año mes a mes y Conexión.

## Pestaña Conexión: la laguna en la serie

La laguna es la cabecera de la serie: no recibe de ningún proyecto y entrega al lago el agua que rebosa con su sedimento, su temperatura, su oxígeno, su fósforo y su nivel. Esa «frontera de salida» se exporta a un archivo .json, se publica en vivo a los simuladores de la serie abiertos en el mismo navegador (BroadcastChannel) y la usa el proyecto Sistema conectado, que encadena todos los modelos del páramo al océano.

## Probar en el computador

Los módulos de JavaScript no funcionan abriendo `index.html` con doble clic. Hay que servir la carpeta (o la carpeta que contiene toda la serie):

```
python -m http.server 8000
```

y abrir `http://localhost:8000`. Para correr las pruebas (requiere Node.js 18 o superior):

```
npm test
```

Son 30 pruebas: 15 del modelo, 9 del sistema y 6 del libro de Excel, el registro y la conexión.

## Valores de referencia

La lluvia anual, el gradiente térmico, el factor de grado-día, la pérdida de área del glaciar, el tiempo de respuesta y los coeficientes del páramo, los coeficientes de exportación de fósforo y de sedimento, el fósforo por tonelada de trucha, la turbidez del agua, la luz que necesitan las plantas, la densidad del lodo, el coeficiente del vertedero, la velocidad de la onda de crecida y su atenuación son valores editables de referencia. Antes de la sustentación conviene contrastarlos con las mediciones del IDEAM y de la autoridad ambiental (estaciones de alta montaña, inventario de glaciares, monitoreo de lagunas) y con la literatura de páramos.
