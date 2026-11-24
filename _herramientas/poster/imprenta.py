"""imprenta.py — PDF del póster para la litografía y su vista previa.

1. node poster.cjs y node poster.cjs --sangrado (lienzo de 70.6 × 100.6 cm: 3 mm de sangrado por lado).
2. LibreOffice exporta los dos a PDF.
3. El PDF de imprenta pone la página con sangrado en una hoja de 72.6 × 102.6 cm con marcas de corte en
   las esquinas y una línea de datos, y fija TrimBox (70 × 100 cm) y BleedBox para el RIP de la imprenta.
4. Vista previa JPG para la página de la serie.

Uso (desde esta carpeta): python3 -I imprenta.py
"""
import io
import os
import subprocess
import sys
import tempfile

from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

AQUI = os.path.dirname(os.path.abspath(__file__))
POSTER = os.path.abspath(os.path.join(AQUI, '..', '..', 'POSTER'))
SOFFICE = os.environ.get('SOFFICE_PY', '')     # opcional: un script que envuelve a soffice (si soffice solo se cuelga)
NOMBRE = 'Poster_Simulador_Hidrico_3D_70x100'


def correr(*args, **kw):
    subprocess.run(args, check=True, **kw)


def a_pdf(pptx, carpeta):
    orden = [sys.executable, SOFFICE] if SOFFICE and os.path.exists(SOFFICE) else ['soffice']
    correr(*orden, '--headless', '--convert-to', 'pdf', '--outdir', carpeta, pptx, capture_output=True)
    return os.path.join(carpeta, os.path.splitext(os.path.basename(pptx))[0] + '.pdf')


def main():
    correr('node', os.path.join(AQUI, 'poster.cjs'))
    correr('node', os.path.join(AQUI, 'poster.cjs'), '--sangrado')
    with tempfile.TemporaryDirectory() as tmp:
        exacto = a_pdf(os.path.join(POSTER, NOMBRE + '.pptx'), tmp)
        sangrado = a_pdf(os.path.join(AQUI, 'salida', NOMBRE + '_sangrado.pptx'), tmp)
        # Tamaño final (para ver en pantalla o imprimir sin cortar)
        w = PdfWriter(clone_from=exacto)
        w.add_metadata({'/Title': 'Simulador hídrico 3D · Póster 70 × 100 cm', '/Author': 'Andrés Mauricio Peñaloza Fernández y Eliana Carolina María Wong Lubo'})
        with open(os.path.join(POSTER, NOMBRE + '.pdf'), 'wb') as f:
            w.write(f)
        # Imprenta: sangrado de 3 mm, marcas de corte a 1 cm y cajas de corte
        san, marg = 0.3 * cm, 1.0 * cm
        tw, th = 70 * cm, 100 * cm
        W, H = tw + 2 * (san + marg), th + 2 * (san + marg)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(W, H))
        c.setLineWidth(0.5)
        x0, y0, x1, y1 = marg + san, marg + san, marg + san + tw, marg + san + th
        largo = 0.8 * cm
        for x in (x0, x1):
            for y in (y0, y1):
                dx = -1 if x == x0 else 1
                dy = -1 if y == y0 else 1
                c.line(x + dx * (san + 0.1 * cm), y, x + dx * (san + 0.1 * cm + largo), y)     # horizontal
                c.line(x, y + dy * (san + 0.1 * cm), x, y + dy * (san + 0.1 * cm + largo))     # vertical
        c.setFont('Helvetica', 9)
        c.drawString(marg + san, 0.35 * cm, 'Simulador hídrico 3D · Póster de la serie · tamaño final 70 × 100 cm · sangrado 3 mm · marcas de corte en las esquinas')
        c.save()
        marcas = PdfReader(io.BytesIO(buf.getvalue())).pages[0]
        pag = PdfReader(sangrado).pages[0]
        pag.add_transformation(Transformation().translate(marg, marg))
        marcas.merge_page(pag)
        marcas.mediabox = RectangleObject([0, 0, W, H])
        marcas.bleedbox = RectangleObject([marg, marg, W - marg, H - marg])
        marcas.trimbox = RectangleObject([x0, y0, x1, y1])
        marcas.cropbox = RectangleObject([0, 0, W, H])
        out = PdfWriter()
        out.add_page(marcas)
        out.add_metadata({'/Title': 'Simulador hídrico 3D · Póster 70 × 100 cm (imprenta)', '/Author': 'Andrés Mauricio Peñaloza Fernández y Eliana Carolina María Wong Lubo'})
        with open(os.path.join(POSTER, NOMBRE + '_imprenta.pdf'), 'wb') as f:
            out.write(f)
        # Vista previa
        correr('pdftoppm', '-r', '26', '-jpeg', '-jpegopt', 'quality=88', '-singlefile', exacto, os.path.join(POSTER, 'poster_vista'))
    for n in (NOMBRE + '.pptx', NOMBRE + '.pdf', NOMBRE + '_imprenta.pdf', 'poster_vista.jpg'):
        print(f'{n}: {os.path.getsize(os.path.join(POSTER, n)) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
