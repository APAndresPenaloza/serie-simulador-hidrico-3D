# Documentos de la serie: informe técnico científico y manual de usuario

Genera, para cada simulador, el **Informe técnico científico** y el **Manual de usuario** (.docx) con la
estructura, los estilos y el nivel de detalle de los documentos del proyecto de referencia (ríos exorreicos).
Todo número de las tablas sale del simulador; el texto propio de cada proyecto está en `contenido/<id>.py`.

## Requisitos

- Node.js 18+ con Playwright y su Chromium (para `extraer.cjs`).
- Python 3 con `python-docx`, `matplotlib`, `Pillow` y `lxml`; `pandoc` (ecuaciones OMML).
- LibreOffice (`soffice`) y `poppler-utils` (`pdfinfo`, `pdftotext`, `pdftoppm`) para la segunda pasada y la revisión.

## Pasos

1. Servir la carpeta de la serie (la que contiene todos los proyectos):

   ```
   python -m http.server 8800
   ```

2. Extraer los datos y las capturas del simulador (escenario base, todas las pestañas, vistas, escenarios):

   ```
   node extraer.cjs "http://localhost:8800/simulador-hidrico-3D%20-%20Lagunas/index.html" salida/lagunas
   ```

   Deja `salida/lagunas/datos.json` y `salida/lagunas/img/`. Tarda unos 4 minutos por proyecto. Al final arma un
   caso de ejemplo para la pestaña Informe (cambia un control de la segunda pestaña y corre el reloj tres días) y
   guarda la pestaña, la vista previa, la primera hoja del informe, el simulador abierto desde el código QR e
   `informe.json` (enlace, parámetros que cambiaron, páginas).

3. Escribir (o revisar) `contenido/<id>.py` con dos diccionarios:
   - `INFORME`: título, línea de investigación, resumen y abstract, palabras clave, `secciones` (bloques
     `h1`, `h2`, `h3`, `p`, `li`, `eq`, `eqs` en LaTeX, `fig` con gráficas `[pestaña, índice]`, `img`, `tabla`,
     `tabla_parametros`, `tabla_criterios`, `tabla_escenarios`) y `referencias` en APA 7.
   - `MANUAL`: portada, qué es, para qué sirve, `componentes` (claves = ids de las etiquetas de la escena),
     escenario base, qué se mueve, glosario, `guias` (ids de escenarios) y `notas_guias`; opcionales `tabs`
     (texto extra por pestaña) y `conexion`.
   - Marcadores: `{m:pestaña:etiqueta del resultado}`, `{c:pestaña:id del control}` y `{e:escenario}` se
     reemplazan por los valores del simulador. Marcas de texto: `*cursiva*`, `**negrita**`, `x_{sub}`, `x^{sup}`.

4. Generar (primera pasada) y, al final, con el índice paginado:

   ```
   python3 -I generar.py lagunas salida/lagunas salida/docs
   python3 -I generar.py lagunas salida/lagunas salida/docs --paginas
   ```

   Salen `Informe_Simulador_Hidrico_3D_Lagunas.docx` y `Manual_Simulador_Hidrico_3D_Lagunas.docx`.

5. PDF para la página de la serie (se publican junto al .docx, en la carpeta `documentos/` de cada proyecto):

   ```
   npm install mathjax@3        # una vez
   python3 -I pdf.py            # todos los documentos de la serie (o: python3 -I pdf.py archivo.docx)
   ```

   `pdf.py` exporta con LibreOffice una copia del .docx en la que cada ecuación OMML se cambia por su
   imagen (pandoc → LaTeX → MathJax), porque LibreOffice sin el módulo de fórmulas las deja en blanco, y
   aclara las imágenes con transparencia (marca de agua de la portada del informe de Ríos). Después,
   `python3 _herramientas/portada/armar_portada.py` (desde la raíz) actualiza los enlaces y pesos de la portada.

6. Relación con el curso Introducción a las Ciencias del Agua y a la Tecnología: `icat.py` tiene, por proyecto,
   las ciencias, la tabla de temas del curso (unidad 1 y bloques 2 a 6) con la pestaña donde se ven, las cuatro
   dimensiones y lo que el simulador no cubre. `generar.py` la pone como última sección del informe, antes de las
   referencias, y la portada de la serie arma con ella su tabla «Relación con el curso».

## Ríos exorreicos (proyecto de referencia)

Su informe es el .docx original del proyecto y su manual se publica solo en PDF (en la raíz de su carpeta), así
que no se generan con `generar.py`:

```
python3 -I rios_curso.py                                   # agrega al informe la sección del curso (una vez)
node rios_informe.cjs http://localhost:8800/ salida/rios   # capturas de la pestaña Informe del río
python3 -I rios_anexo.py salida/rios                       # Anexo D del manual (PDF), con su línea en el índice
```

`rios_anexo.py` arma el anexo con el mismo capítulo de los otros manuales y la plantilla del manual, lo agrega
al final del PDF numerado a continuación y escribe su línea y su enlace en el índice; si se corre otra vez,
reemplaza el anexo anterior.

## Revisión

- Convertir a PDF (`soffice --headless --convert-to pdf`) y mirar todas las páginas (`pdftoppm -r 40`).
- LibreOffice sin el módulo de fórmulas no dibuja las ecuaciones OMML (tampoco las del documento original);
  Word sí, y los PDF de `pdf.py` también. Para comprobarlas en el .docx: `pandoc Informe.docx -t markdown | grep '\$'`.
- Que cada referencia esté citada y cada cita tenga referencia; DOIs verificados.
- Que no queden `_` ni `*` sueltos en el texto (usar `x_{sub}` y `∗`).

## Archivos

| Archivo | Qué hace |
|---|---|
| `extraer.cjs` | Abre el simulador con Playwright, lee `window.__sim` y guarda datos y capturas |
| `generar.py` | Arma el informe y el manual a partir de `datos.json`, las capturas y `contenido/<id>.py` |
| `docx_serie.py` | Escritura de párrafos, títulos, tablas, figuras, cajas, índice y ecuaciones OMML (pandoc) |
| `graficas.py` | Vuelve a dibujar las gráficas del simulador con matplotlib (serifas, paneles (a), (b)) |
| `plantillas.py` | Crea `plantillas/informe.docx` y `plantillas/manual.docx` a partir de los documentos originales |
| `pdf.py` | Exporta los .docx a PDF con las ecuaciones como imágenes (para la página de la serie) |
| `icat.py` | Relación de cada simulador con el curso Introducción a las Ciencias del Agua y a la Tecnología |
| `rios_curso.py` | Agrega esa sección al informe de Ríos (.docx original), con su entrada en el índice |
| `rios_informe.cjs` | Capturas de la pestaña Informe del simulador de ríos |
| `rios_anexo.py` | Anexo D del manual de Ríos (PDF): la pestaña Informe y su código QR |
| `contenido/<id>.py` | Texto propio de cada proyecto |
