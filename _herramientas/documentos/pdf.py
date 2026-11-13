# PDF de los documentos (informes y manuales) para la página de la serie.
# LibreOffice sin el módulo de fórmulas deja en blanco las ecuaciones de Word (OMML) al exportar a PDF, e
# ignora la transparencia de las imágenes (el logo de marca de agua de la portada del informe de Ríos sale
# opaco encima del texto). Por eso cada .docx se copia a una carpeta temporal, en la copia cada ecuación se
# cambia por su imagen (LaTeX que extrae pandoc → MathJax → PNG a 4×, en la línea base del texto) y las
# imágenes con transparencia se aclaran, y esa copia se exporta a PDF. El .docx original no se toca.
#
# Uso (desde _herramientas/documentos):
#   npm install mathjax@3          # una vez; o MATHJAX=/ruta/a/tex-svg-full.js
#   python3 -I pdf.py              # todos los .docx de las carpetas documentos/ de la serie
#   python3 -I pdf.py archivo.docx […]
# Requisitos: pandoc, soffice (LibreOffice), Pillow y Playwright para Python con su Chromium.
import glob, html, io, json, os, re, shutil, subprocess, sys, tempfile, zipfile
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
MATHJAX = os.environ.get('MATHJAX') or os.path.join(AQUI, 'node_modules', 'mathjax', 'es5', 'tex-svg-full.js')
EMU_PX = 9525           # 1 px CSS (a 96 ppp) en EMU; el texto de los documentos es de 12 pt = 16 px

def tex_de(docx):
    d = json.loads(subprocess.run(['pandoc', '-f', 'docx', '-t', 'json', docx], capture_output=True, text=True, check=True).stdout)
    out = []
    def walk(x):
        if isinstance(x, dict):
            if x.get('t') == 'Math':
                out.append(x['c'][1])
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(d['blocks'])
    return out

def sola_en_su_linea(doc):
    """Para cada ecuación de Word: ¿está sola en su párrafo (con tabulaciones y su número)? → estilo de display."""
    res = []
    for m in re.finditer(r'<m:oMath>.*?</m:oMath>', doc, re.S):
        ini = max(doc.rfind('<w:p>', 0, m.start()), doc.rfind('<w:p ', 0, m.start()))
        fin = doc.find('</w:p>', m.end())
        parrafo = re.sub(r'<m:oMath>.*?</m:oMath>', '', doc[ini:fin], flags=re.S)
        texto = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', parrafo))
        res.append(bool(re.fullmatch(r'\s*(\(\s*\d+\s*\))?\s*', texto)))
    return res

def dibujar(page, lista, display, carpeta):
    """Dibuja cada ecuación y devuelve [(png, ancho_px, alto_px, profundidad_px)]."""
    res = []
    for k, tex in enumerate(lista):
        info = page.evaluate("""([tex, display]) => {
            const caja = document.getElementById('caja');
            caja.innerHTML = '<div id="eq"></div>';
            const nodo = MathJax.tex2svg(tex, { display });
            document.getElementById('eq').appendChild(nodo);
            const svg = nodo.querySelector('svg');
            const err = nodo.querySelector('[data-mjx-error], mjx-merror, merror');
            const r = svg.getBoundingClientRect();
            const ex = r.width / parseFloat(svg.getAttribute('width'));          // px por ex
            const va = parseFloat((svg.style.verticalAlign || '0').replace('ex', '')) || 0;
            return { w: r.width, h: r.height, prof: -va * ex, error: err ? (err.getAttribute('data-mjx-error') || err.textContent) : null };
        }""", [tex, display[k]])
        if info['error']:
            raise RuntimeError(f'MathJax no pudo con la ecuación {k + 1}: {tex!r} → {info["error"]}')
        png = os.path.join(carpeta, f'ecuacion{k + 1}.png')
        page.locator('#eq mjx-container > svg').screenshot(path=png, omit_background=True)
        res.append((png, info['w'], info['h'], max(0.0, info['prof'])))
    return res

def con_imagenes(docx, imgs, lista, destino):
    z = zipfile.ZipFile(docx)
    doc = z.read('word/document.xml').decode('utf8')
    rels = z.read('word/_rels/document.xml.rels').decode('utf8')
    tipos = z.read('[Content_Types].xml').decode('utf8')
    patron = re.compile(r'<m:oMath>.*?</m:oMath>', re.S)
    encontradas = patron.findall(doc)
    assert len(encontradas) == len(imgs), f'{docx}: {len(encontradas)} ecuaciones en Word y {len(imgs)} en pandoc'
    it = iter(range(len(imgs)))
    def cambio(_m):
        k = next(it)
        png, w, h, prof = imgs[k]
        cx, cy = round(w * EMU_PX), round(h * EMU_PX)
        baja = round(prof * 0.75 * 2)          # media-puntos para bajar la imagen hasta la línea base
        rid, n = f'rIdEcuacion{k + 1}', 9000 + k
        alt = html.escape(lista[k], quote=True)
        return (f'<w:r><w:rPr><w:position w:val="{-baja}"/></w:rPr><w:drawing>'
                f'<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
                f'<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{n}" name="Ecuación {k + 1}" descr="{alt}"/>'
                '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
                '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
                f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{n}" name="ecuacion{k + 1}.png"/><pic:cNvPicPr/></pic:nvPicPr>'
                f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
                f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
                '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')
    doc = patron.sub(cambio, doc)
    # Imágenes con transparencia de Word (a:alphaModFix, p. ej. el logo de marca de agua de una portada):
    # este LibreOffice la ignora y las pinta opacas encima del texto. Se aclara la imagen misma.
    destinos = dict(re.findall(r'<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"', rels))
    destinos.update({i: t for t, i in re.findall(r'<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"', rels)})
    aclarar = {}
    for rid, amt in re.findall(r'<a:blip r:embed="([^"]+)"[^>]*>(?:(?!</a:blip>).)*?<a:alphaModFix amt="(\d+)"/>', doc, re.S):
        aclarar['word/' + destinos[rid].lstrip('/').removeprefix('word/')] = int(amt) / 100000
    doc = re.sub(r'<a:alphaModFix amt="\d+"/>', '', doc)
    nuevas = ''.join(f'<Relationship Id="rIdEcuacion{k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/ecuacion{k + 1}.png"/>' for k in range(len(imgs)))
    rels = rels.replace('</Relationships>', nuevas + '</Relationships>')
    if 'Extension="png"' not in tipos:
        tipos = tipos.replace('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
                              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/>')
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as w:
        for item in z.infolist():
            if item.filename == 'word/document.xml':
                w.writestr(item, doc)
            elif item.filename == 'word/_rels/document.xml.rels':
                w.writestr(item, rels)
            elif item.filename == '[Content_Types].xml':
                w.writestr(item, tipos)
            elif item.filename in aclarar:
                a = aclarar[item.filename]
                im = Image.open(io.BytesIO(z.read(item.filename)))
                buf = io.BytesIO()
                if im.mode in ('RGBA', 'LA', 'P'):
                    im = im.convert('RGBA')
                    im.putalpha(im.getchannel('A').point(lambda v: round(v * a)))
                    im.save(buf, 'PNG')
                else:                                    # sin canal alfa: se mezcla con el blanco del papel
                    im = Image.blend(Image.new('RGB', im.size, 'white'), im.convert('RGB'), a)
                    im.save(buf, im.format or 'JPEG', quality=92)
                w.writestr(item, buf.getvalue())
            else:
                w.writestr(item, z.read(item.filename))
        for k, (png, *_r) in enumerate(imgs):
            w.write(png, f'word/media/ecuacion{k + 1}.png')

def convertir(docx, page):
    nombre = os.path.splitext(os.path.basename(docx))[0]
    salida = os.path.dirname(os.path.abspath(docx))
    doc = zipfile.ZipFile(docx).read('word/document.xml').decode('utf8')
    lista = tex_de(docx) if '<m:oMath>' in doc else []
    display = sola_en_su_linea(doc)
    assert len(display) == len(lista), f'{docx}: {len(display)} ecuaciones en Word y {len(lista)} en pandoc'
    with tempfile.TemporaryDirectory() as tmp:
        imgs = dibujar(page, lista, display, tmp) if lista else []
        copia = os.path.join(tmp, nombre + '.docx')
        con_imagenes(docx, imgs, lista, copia)
        r = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, copia], capture_output=True, text=True, timeout=600)
        hecho = os.path.join(tmp, nombre + '.pdf')
        assert os.path.exists(hecho), r.stderr
        pdf = os.path.join(salida, nombre + '.pdf')
        shutil.copyfile(hecho, pdf)
    print(f'{os.path.relpath(pdf, RAIZ)}: {len(lista)} ecuaciones → {os.path.getsize(pdf) / 1e6:.2f} MB')

if __name__ == '__main__':
    archivos = sys.argv[1:] or sorted(glob.glob(os.path.join(RAIZ, 'simulador-hidrico-3D - *', 'documentos', '*.docx')))
    con_ecuaciones = [a for a in archivos if '<m:oMath>' in zipfile.ZipFile(a).read('word/document.xml').decode('utf8')]
    if not con_ecuaciones:
        for a in archivos:
            convertir(a, None)
        sys.exit()
    if not os.path.exists(MATHJAX):
        sys.exit(f'Falta MathJax ({MATHJAX}): en _herramientas/documentos, npm install mathjax@3')
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(device_scale_factor=4)
        page.set_content('<!doctype html><html><head><style>body{margin:20px;font-size:16px;color:#000;background:#fff}</style>'
                         '<script>window.MathJax={tex:{packages:{"[+]":["ams"]}},svg:{fontCache:"local"},startup:{typeset:false}};</script>'
                         '</head><body><div id="caja"></div></body></html>')
        page.add_script_tag(path=MATHJAX)
        page.wait_for_function('() => !!(window.MathJax && window.MathJax.tex2svg && window.MathJax.startup)')
        page.evaluate('() => MathJax.startup.promise')
        for a in archivos:
            convertir(a, page)
        nav.close()
