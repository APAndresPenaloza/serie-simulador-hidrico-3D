"""rios_anexo.py — Anexo D del manual del simulador de ríos: la pestaña Informe y su código QR.

El manual de ríos (proyecto de referencia) se publica solo en PDF, en la raíz de su carpeta. Este
script arma el anexo con el mismo texto del capítulo de los otros manuales (generar.capitulo_informe)
sobre la plantilla del manual, lo convierte a PDF con LibreOffice, lo agrega al final del manual
(numerado desde la página siguiente) y escribe su línea en el índice, con su enlace. En la página del
índice quita la nota «haz clic derecho sobre él en Word», que no sirve en el PDF. Se puede correr
otra vez: reemplaza el anexo anterior.

Uso:  python3 -I rios_anexo.py <carpeta de rios_informe.cjs>
"""
import io
import json
import os
import re
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import generar  # noqa: E402
from docx.oxml.ns import qn  # noqa: E402
from docx_serie import Documento  # noqa: E402
from pypdf import PdfReader, PdfWriter  # noqa: E402
from pypdf.generic import (ArrayObject, ContentStream, DictionaryObject, FloatObject, NameObject,  # noqa: E402
                           NumberObject)
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.pdfgen import canvas  # noqa: E402

MANUAL = os.path.join(generar.SERIE, 'simulador-hidrico-3D - Rios exorreicos', 'Manual_Simulador_Hidrico_3D_Rios_exorreicos.pdf')
TITULO = 'Anexo D. Pestaña Informe: informe con código QR'
EXTRA = ('Este anexo describe la pestaña Informe, que el simulador recibió en noviembre de 2026 entre Datos y '
         'Conexión; con ella, el panel tiene dieciséis pestañas. La pestaña es la misma en los ocho simuladores de la serie.')
INDICE = 5                       # página 6: la última del índice, con los anexos
FIGURAS_ANTES = 98               # el manual llega hasta la figura 98
FUENTE = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'   # métricas de Arial


def anexo_docx(ext, ruta, primera):
    img = lambda n: os.path.join(ext, 'img', n)  # noqa: E731
    existe = lambda n: os.path.exists(img(n))  # noqa: E731
    inf = json.load(open(os.path.join(ext, 'informe.json'), encoding='utf-8'))
    inf['reloj'] = inf['reloj'][:1].lower() + inf['reloj'][1:]      # «Día 1, 06:19» dentro de la frase
    doc = Documento(os.path.join(AQUI, 'plantillas', 'manual.docx'), 'manual')
    doc.n_fig = FIGURAS_ANTES
    generar.capitulo_informe(doc, TITULO, 'D', img, existe, inf, parte='anexo', extra=EXTRA, altos=(13, 12))
    # Sin portada: encabezado y pie desde la primera hoja, numerada a continuación del manual
    sect = doc.sect
    for el in sect.findall(qn('w:titlePg')):
        sect.remove(el)
    num = sect.makeelement(qn('w:pgNumType'), {qn('w:start'): str(primera)})
    sect.find(qn('w:cols')).addprevious(num)
    doc.guardar(ruta)


def a_pdf(docx_ruta, tmp):
    perfil = 'file://' + os.path.join(tmp, 'perfil')
    subprocess.run(['soffice', f'-env:UserInstallation={perfil}', '--headless', '--convert-to', 'pdf', '--outdir', tmp, docx_ruta],
                   check=True, capture_output=True, timeout=600)
    return os.path.join(tmp, os.path.splitext(os.path.basename(docx_ruta))[0] + '.pdf')


def paginas_base(lector):
    """Páginas del manual sin el anexo (si ya se había agregado, empieza en la hoja con su título)."""
    n = len(lector.pages)
    for i in range(n - 1, max(10, n - 16), -1):
        if TITULO in re.sub(r'\s+', ' ', lector.pages[i].extract_text() or ''):
            return i
    return n


def linea_indice(pagina):
    """Una hoja carta transparente con la línea «Anexo D ……… página», como las del índice."""
    pdfmetrics.registerFont(TTFont('Arial', FUENTE))
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792))
    c.setFont('Arial', 11)
    y = 497.8952 - 17.6458                    # línea base de «Anexo C» menos el paso de las líneas
    c.drawString(72.0007, y, TITULO)
    x = 72.0007 + pdfmetrics.stringWidth(TITULO, 'Arial', 11) + 1.2
    while x + 3.047 <= 519.45:
        c.drawString(x, y, '.')
        x += 3.047
    c.drawRightString(538.63, y, str(pagina))
    c.save()
    return PdfReader(io.BytesIO(buf.getvalue())).pages[0]


def quitar_nota(escritor, pagina):
    """Quita el texto en cursiva de la página del índice: la nota para actualizarlo en Word."""
    fuentes = pagina['/Resources']['/Font']
    cursiva = {k for k, v in fuentes.items() if 'Italic' in str(v.get_object()['/BaseFont'])}
    cs = pagina.get_contents()
    if not isinstance(cs, ContentStream):
        cs = ContentStream(cs, escritor)
    actual, nuevas = None, []
    for operandos, op in cs.operations:
        if op == b'Tf':
            actual = operandos[0]
        if op in (b'Tj', b'TJ', b"'", b'"') and actual in cursiva:
            continue
        nuevas.append((operandos, op))
    cs.operations = nuevas
    pagina.replace_contents(cs)


def main(ext):
    lector = PdfReader(MANUAL)
    base = paginas_base(lector)
    primera = base + 1
    with tempfile.TemporaryDirectory() as tmp:
        docx_ruta = os.path.join(tmp, 'Anexo_D_Informe.docx')
        anexo_docx(ext, docx_ruta, primera)
        anexo = PdfReader(a_pdf(docx_ruta, tmp))
        escritor = PdfWriter(clone_from=lector)
        while len(escritor.pages) > base:
            escritor.remove_page(len(escritor.pages) - 1)
        for pg in anexo.pages:
            escritor.add_page(pg)
        indice = escritor.pages[INDICE]
        destino = ArrayObject([escritor.pages[base].indirect_reference, NameObject('/XYZ'), NumberObject(72), NumberObject(720), NumberObject(0)])
        rect = [72, 495.564 - 17.6458, 539.5, 508.21293 - 17.6458]
        anotaciones = indice['/Annots'].get_object()
        previo = next((a.get_object() for a in anotaciones if abs(float(a.get_object()['/Rect'][1]) - rect[1]) < 0.5), None)
        if previo is not None:           # el índice ya tiene la línea: solo se apunta el enlace al anexo nuevo
            previo[NameObject('/Dest')] = destino
        else:
            quitar_nota(escritor, indice)
            indice.merge_page(linea_indice(primera))
            enlace = DictionaryObject({
                NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Link'), NameObject('/F'): NumberObject(4),
                NameObject('/BS'): DictionaryObject({NameObject('/S'): NameObject('/S'), NameObject('/Type'): NameObject('/Border'), NameObject('/W'): NumberObject(0)}),
                NameObject('/Rect'): ArrayObject([FloatObject(v) for v in rect]),
                NameObject('/Dest'): destino,
            })
            anotaciones.append(escritor._add_object(enlace))
        escritor.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
        temporal = MANUAL + '.tmp'
        with open(temporal, 'wb') as f:
            escritor.write(f)
        os.replace(temporal, MANUAL)
    total = len(PdfReader(MANUAL).pages)
    print(f'anexo D: páginas {primera}–{total} · {os.path.getsize(MANUAL) / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
