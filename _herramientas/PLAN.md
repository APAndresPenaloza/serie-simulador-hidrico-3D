# Serie de simuladores hídricos 3D — plan de trabajo (memoria del proyecto)

Referencia: `simulador-hidrico-3D - Rios exorreicos` (Santa Marta; Álgebra y Geometría Analítica 2026-II).
Autores: Andrés Mauricio Peñaloza Fernández, Eliana Carolina María Wong Lubo. Docente: Luis Duarte.
USM · Programa de Ingeniería del Agua y Desarrollo Sostenible · Facultad de Ingeniería.

## Proyectos nuevos (carpetas hermanas dentro de /home/claude/serie)
| id | carpeta | caso de referencia | reloj |
|---|---|---|---|
| lagunas | simulador-hidrico-3D - Lagunas | laguna somera de alta montaña (Sierra Nevada de Santa Marta, 4 300 m) | días (horas) |
| lagos | simulador-hidrico-3D - Lagos | lago andino profundo (referencia: lago de Tota, 3 015 m) | días |
| cienagas | simulador-hidrico-3D - Cienagas | Ciénaga Grande de Santa Marta (costera) y ciénaga de planicie (interior) | días (horas) |
| deltas | simulador-hidrico-3D - Deltas | delta del Magdalena; Atrato, Sinú, Patía | años |
| costas | simulador-hidrico-3D - Costas | playa del Caribe (Santa Marta / El Rodadero) | horas |
| oceanos | simulador-hidrico-3D - Oceanos | mar Caribe y océano Pacífico colombianos | horas |
| sistema | simulador-hidrico-3D - Sistema conectado | del páramo al océano: une los 8 proyectos | días del año |

## Arquitectura común (cada proyecto es autónomo; el núcleo se copia con _herramientas/sincronizar.mjs)
- lib/ (Three.js 0.170, Chart.js 4.4, addons) · css/styles.css · js/excel.js (del proyecto de ríos)
- js/nucleo/: formato.js, graficas.js, datos.js, conexion.js, escena-base.js, app-base.js
- js/modelo.js (funciones puras), js/sistema.js (PARAMETROS, estadoInicial, avanzar, calcular, ESCENARIOS,
  anoMensual), js/nodo.js (contrato de frontera), js/app.js (pestañas, controles, pintores), js/escena3d.js
- tests/*.test.js (node --test, valores a mano) · README.md con tabla «Objetos matemáticos del simulador»
- window.__sim (API para documentar: setParam, escenario, datosTab, controles)

## Contrato de conexión («frontera», versión 1)
{ serie:'simulador-hidrico-3D', version:1, origen, nodo, fecha, tiempo, salida:{Q, sedimento, Qs, salinidad,
  temperatura, OD, DBO, coliformes, nitrogeno, fosforo, nivel}, clima:{anio, factorLluvia}, mar:{nivelMedio,
  ascenso, marea, Hs, Tp, direccion, salinidad, temperatura} }
Red: Laguna→Lago→Río→Ciénaga↔Delta; Delta→Costa; Océano→(Ciénaga, Delta, Costa). En vivo: BroadcastChannel.

## Documentos (por proyecto): Informe técnico científico (.docx, Times 12, APA 7, ecuaciones OMML numeradas,
figuras matplotlib (a)(b)(c) serif) y Manual de usuario (.docx, Arial 11, títulos #1C6E95, tablas con encabezado
#1C6E95, cajas #EAF4F8, encabezado «Simulador hídrico 3D · Manual de usuario» #7A8A96 9 pt).
Pipeline (ver _herramientas/documentos/README.md): extraer.cjs (Playwright: capturas + datos reales) →
contenido/<id>.py (texto propio, marcadores {m:pestaña:etiqueta}) → generar.py (python-docx + pandoc para OMML)
→ generar.py --paginas (índice con números). Revisión: PDF con LibreOffice + hojas de contacto, citas ↔ referencias.

## Convenciones
Español; punto decimal y espacio fino de miles; SI interno; en el escenario base se cumplen todos los criterios;
valores de referencia editables; cada pestaña: intro, controles, Resultados, Revisión del diseño, Tablas, Modelo
matemático (forma general + sustitución), 1–2 gráficas con el punto actual. Pestañas Datos (Excel) y Conexión.

## Estado (actualizar al avanzar)
- Lagunas ✓ 30 · Lagos ✓ 25 · Ciénagas ✓ 27 · Deltas ✓ 21 · Costas ✓ 22 · Océanos ✓ 25 · Sistema conectado ✓ 26 pruebas (2026-11-13).
- 2026-11-13 · Ciénaga: caños en los dos sentidos (el río la llena en la creciente; la ciénaga le devuelve agua en el
  estiaje). Magdalena frente a los caños con piso en el nivel del mar (máx) y κ = 0.5 de la marea; alisios que inclinan
  el agua (Δη = C_D·(ρa/ρ)·U²·L/(g·h): +Δη/2 en los caños, −Δη/2 en la boca). Base: 43 días de retorno (abril neto < 0),
  Smax 32.5 PSU; criterio del mangle rojo cambiado a «estrés ≤ 25 %». Escenario «estiaje» (15 de abril, 08:00).
  Contrato v1 + Qtoma y Qretorno (núcleo y copia del río); el delta resta Qcanos = Qtoma − Qretorno en Bocas de Ceniza;
  Sistema conectado: m_DC = QcOut/QD, det = 1 − m35·m53 − m35·m54·m43, lazo en 5 iteraciones, 81 criterios.
- 2026-11-13 · Océanos: pestaña «Bosque de niebla» (Serranía de Macuira): Magnus, z_b = 125(T − T_d), LWC por tramos,
  F = η·LWC·U; calibrado con Cavelier y Goldstein (1989): 804 mm de niebla vs 850 de lluvia; atrapanieblas wayuu; vista
  Macuira. 8 criterios. Lagos: pestaña «Peces» con trucha (exótica), capitán de la sabana y guapucha (nativos; valores
  de la guapucha supuestos); trucha 7.32 kg P/t (Torres-Barrera y Grandas-Rincón, 2017); 15 criterios.
- Los index.html tienen el pie que el usuario editó a mano: los «pie» de proyecto.json se igualaron para que
  sincronizar.mjs no lo pise.
- 2026-11-13 · Documentos regenerados (informe y manual) de Ciénagas, Océanos, Lagos, Deltas y Sistema conectado.
  extraer.cjs dibuja la escena 3D a pedido (sin ciclo continuo): con SwiftShader y 2 núcleos el ciclo dejaba sin tiempo
  a las capturas. graficas.py usa una lista de familias (Liberation Serif → DejaVu Serif) para los superíndices ⁺ ⁻.
  Manual de ríos (PDF): imágenes JPEG recomprimidas (calidad 72, máx. 1 700 px de ancho): 25.5 MB → 16.6 MB.
- 2026-11-13 · Portal con base de información: index.html lo arma _herramientas/portada/armar_portada.py (tarjetas con
  accesos, tabla de informes y manuales en PDF y Word con su peso, galería de recorridos con video y GIF). PDF de los
  documentos con _herramientas/documentos/pdf.py (ecuaciones como imágenes; LibreOffice sin módulo de fórmulas las
  deja en blanco). Cada simulador tiene en el encabezado «Serie · Informe · Manual · Video · GIF» (proyecto.json →
  "documentos"; en Ríos, a mano en su index.html). GIF/ y VIDEOS/ completos (8 y 8); VIDEOS/portadas/ para el portal.
- Contrato v1 ampliado: MAGNITUDES_MAR.ascenso (mm/año, derivada del ascenso del océano) → deltas/costas ascensoMar.
- RED: deltas también entrega a cienagas (caños). Prueba común revisa la red en los dos sentidos (salvo «sistema»).
- Entradas que ya traen el clima se dividen por el factor climático del que recibe (ciénaga fRios/dH, costas fOla/fAporte).
- Ciénaga: el río de la Sierra reemplaza a uno de los ríos (6.35 m³/s); SS y P se mezclan con los demás ríos.
- Costas: ABRIGO 0.75 y REFRACCION 0.15 (20° → 3°): el escenario base conectado cumple los 78 criterios.
- Sistema conectado: js/proyectos.js (import dinámico de carpetas hermanas), js/nodos/rios.js (adaptador del río),
  js/cadena.js (composición, lazo de punto fijo, trazadores (I − M)F = B, horizontes, intervenciones), js/algebra.js,
  js/referencia.js (generado: node _herramientas/referencia-sistema.mjs). Vistas red/sierra/costa/mar.
- Portal de la serie: /index.html (tarjetas y red).
- Documentos ✓ (en cada proyecto, carpeta documentos/): informes de 16 a 18 páginas y manuales de 48 a 65 páginas;
  índices verificados contra las páginas (LibreOffice); citas ↔ referencias revisadas; DOIs dudosos verificados.
- _nucleo/tests/datos.test.js es una plantilla: se copia a cada proyecto (allí sí corre); en _nucleo no tiene sistema.js.
- Skill «simulador-hidrico-3d-serie» propuesta (crear, documentar, revisar y conectar simuladores de la serie).
- Entrega: un .zip por proyecto y el .zip de la serie completa.
- Ríos exorreicos conectado (2026-11-08): pestaña Conexión propia en js/app.js (no usa el núcleo), js/nodo.js
  (salida a la ciénaga; entrada del lago: Qlago, Plago, SSlago entran por la cabecera como el dQ de la represa) y
  js/conexion.js (COPIA del núcleo: si cambia el contrato, copiarla a mano). 104 pruebas (6 de conexión).
- Pestañas: dos filas o más si los nombres no caben (ajustarPestanas en app-base.js y en el app.js del río); el punto
  de alerta va en posición absoluta y no cambia el ancho. Antes, en Océanos y en el Sistema conectado la pestaña
  Conexión quedaba escondida detrás de un desplazamiento horizontal sin barra.
