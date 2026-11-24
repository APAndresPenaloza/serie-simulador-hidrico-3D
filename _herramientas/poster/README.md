# Póster de la serie (70 × 100 cm, vertical)

Póster para imprimir en litografía, en PowerPoint editable y en PDF. Presenta la serie del páramo al
océano, los ocho simuladores con su escena 3D y su código QR, cómo se usan, las matemáticas, el informe con
código QR, la relación con los cursos y los créditos.

Sale en `POSTER/` (raíz de la serie):

| Archivo | Para qué |
|---|---|
| `Poster_Simulador_Hidrico_3D_70x100.pptx` | Editable en PowerPoint; también se puede abrir en Canva (Crear diseño → Importar archivo) |
| `Poster_Simulador_Hidrico_3D_70x100_imprenta.pdf` | Para la imprenta: 70 × 100 cm de tamaño final, 3 mm de sangrado por lado, marcas de corte, TrimBox y BleedBox |
| `Poster_Simulador_Hidrico_3D_70x100.pdf` | 70 × 100 cm exactos, para verlo en pantalla o imprimirlo sin cortar |
| `poster_vista.jpg` | Vista previa para la página de la serie |

## Para la imprenta

- Entregar `…_imprenta.pdf`. Tamaño final 70 × 100 cm (vertical); el fondo y las fotos llegan hasta el
  sangrado; los textos quedan a más de 2.5 cm del corte.
- Las fuentes (Calibri y Cambria, o sus equivalentes métricas Carlito y Caladea) van incrustadas en el PDF.
- Las imágenes de las escenas están a 1 500 × 1 000 px y la portada a 3 600 × 1 800 px: unos 140 ppp a
  tamaño final, suficiente para un póster que se mira a un metro. Los códigos QR se dibujan grandes y con
  corrección de errores Q; conviene probarlos con el celular en la prueba de color.
- Color: el PDF va en RGB; la litografía lo convierte a CMYK con su perfil. Si piden CMYK, hay que pedir
  la prueba de color antes del tiraje (los azules del agua son los que más cambian).

## Cómo se arma

Con la serie servida (`python -m http.server 8765` desde la raíz):

```
node capturas.cjs http://localhost:8765/     # escenas 3D sin panel (imagenes/<id>_<vista>.jpg y la portada)
python3 qr.py                                # códigos QR de los simuladores y de la serie
python3 -I imprenta.py                       # PowerPoint, PDF exacto, PDF de imprenta y vista previa
```

`imprenta.py` corre `poster.cjs` dos veces (sin y con `--sangrado`) y exporta con LibreOffice. Si `soffice`
se queda colgado en la máquina, la variable `SOFFICE_PY` puede apuntar a un script que lo envuelva.
`imagenes/logo_usm.png` es el logo de la portada del informe de Ríos e `imagenes/informe_hoja.jpg`, la
primera hoja de un informe de ejemplo (pestaña Informe).

## Requisitos

- Node.js 18+ con `pptxgenjs`, `react`, `react-dom`, `react-icons` y `sharp`; Playwright con Chromium.
- Python 3 con `segno`, `pypdf`, `reportlab` y `Pillow`; LibreOffice y `poppler-utils`.
