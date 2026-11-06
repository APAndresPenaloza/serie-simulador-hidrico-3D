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

   Deja `salida/lagunas/datos.json` y `salida/lagunas/img/`. Tarda unos 4 minutos por proyecto.

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

## Revisión

- Convertir a PDF (`soffice --headless --convert-to pdf`) y mirar todas las páginas (`pdftoppm -r 40`).
- LibreOffice no dibuja las ecuaciones OMML en línea (tampoco las del documento original); Word sí. Para
  comprobarlas: `pandoc Informe.docx -t markdown | grep '\$'`.
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
| `contenido/<id>.py` | Texto propio de cada proyecto |
