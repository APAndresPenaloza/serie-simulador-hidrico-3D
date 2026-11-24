"""rios_curso.py — Agrega al informe del simulador de ríos (que no se arma con generar.py) la sección
«4. Relación con el curso Introducción a las Ciencias del Agua y a la Tecnología» de icat.py, la mención
de la pestaña Informe y las referencias del curso, con los mismos estilos del documento (se copian sus
títulos, párrafos, viñetas y tablas). Al final actualiza el índice con las páginas de LibreOffice.

Uso (desde esta carpeta):  python3 -I rios_curso.py
"""
import copy
import os
import re
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from docx import Document  # noqa: E402
from docx.oxml import OxmlElement  # noqa: E402
from docx.oxml.ns import qn  # noqa: E402
import icat  # noqa: E402

SERIE = os.path.abspath(os.path.join(AQUI, '..', '..'))
RUTA = os.path.join(SERIE, 'simulador-hidrico-3D - Rios exorreicos', 'documentos', 'Informe_Simulador_Hidrico_3D_Rios_exorreicos.docx')
MARCAS = re.compile(r'(\*\*.+?\*\*|\*[^*]+?\*|\^\{[^}]+\}|_\{[^}]+\})')


def poner_texto(p_el, texto, rpr_base=None):
    """Cambia los runs del párrafo por el texto con marcas (**negrita**, *cursiva*, ^{sup}, _{sub})."""
    if rpr_base is None:
        r0 = p_el.find(qn('w:r'))
        rpr_base = r0.find(qn('w:rPr')) if r0 is not None else None
    for r in p_el.findall(qn('w:r')) + p_el.findall(qn('w:hyperlink')):
        p_el.remove(r)
    for pieza in MARCAS.split(texto):
        if not pieza:
            continue
        r = OxmlElement('w:r')
        rpr = copy.deepcopy(rpr_base) if rpr_base is not None else OxmlElement('w:rPr')
        estilo = None
        if pieza.startswith('**'):
            pieza, estilo = pieza[2:-2], 'b'
        elif pieza.startswith('*'):
            pieza, estilo = pieza[1:-1], 'i'
        elif pieza.startswith('^{'):
            pieza, estilo = pieza[2:-1], 'sup'
        elif pieza.startswith('_{'):
            pieza, estilo = pieza[2:-1], 'sub'
        if estilo in ('b', 'i'):
            for t in (estilo, estilo + 'Cs'):
                if rpr.find(qn(f'w:{t}')) is None:
                    rpr.insert(0, OxmlElement(f'w:{t}'))
        elif estilo:
            v = OxmlElement('w:vertAlign')
            v.set(qn('w:val'), 'superscript' if estilo == 'sup' else 'subscript')
            rpr.append(v)
        if len(rpr):
            r.append(rpr)
        t = OxmlElement('w:t')
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        t.text = pieza
        r.append(t)
        p_el.append(r)


def main():
    d = Document(RUTA)
    P = d.paragraphs
    if any('Relación con el curso' in p.text for p in P):
        print('El informe ya tiene la sección del curso: no se cambia.')
        return
    busca = lambda f: next(p for p in P if f(p))  # noqa: E731
    h1 = busca(lambda p: p.style.name == 'Heading 1' and p.text.startswith('3. Prototipo'))
    h2 = busca(lambda p: p.style.name == 'Heading 2' and p.text.startswith('1.1'))
    cuerpo = P[P.index(h1) + 1]
    vineta = busca(lambda p: p.style.name == 'List Paragraph')
    num_tabla = busca(lambda p: p.text.strip() == 'Tabla 2')
    tit_tabla = P[P.index(num_tabla) + 1]
    nota = busca(lambda p: p.text.startswith('Nota.') and P.index(p) > P.index(num_tabla))
    refs = busca(lambda p: p.style.name == 'Heading 1' and p.text.strip() == 'Referencias')
    tabla_mod = d.tables[1]._tbl

    # ── La pestaña Informe en «3. Prototipo terminado» ──────────────────────────
    panel = busca(lambda p: p.text.startswith('El panel tiene quince pestañas'))
    texto = panel.text.replace('El panel tiene quince pestañas', 'El panel tiene dieciséis pestañas').replace('Datos y Conexión)', 'Datos, Informe y Conexión)')
    texto += ' La pestaña Informe arma un informe de la simulación para imprimir o guardar en PDF, con un código QR que abre el simulador publicado con los mismos valores y la misma fecha del reloj.'
    poner_texto(panel._p, texto)

    # ── Sección del curso ─────────────────────────────────────────────────
    n_tabla = 3
    nuevos = []

    def tabla(cab, filas, anchos):
        t = copy.deepcopy(tabla_mod)
        trs = t.findall(qn('w:tr'))
        tr_cab, tr_cuerpo, tr_fin = trs[0], trs[1], trs[-1]
        for tr in trs:
            t.remove(tr)
        total = sum(int(g.get(qn('w:w'))) for g in t.find(qn('w:tblGrid')).findall(qn('w:gridCol')))
        ws = [round(total * a / sum(anchos)) for a in anchos]
        grid = t.find(qn('w:tblGrid'))
        for g in grid.findall(qn('w:gridCol')):
            grid.remove(g)
        for w in ws:
            g = OxmlElement('w:gridCol')
            g.set(qn('w:w'), str(w))
            grid.append(g)

        def fila(modelo, textos):
            tr = copy.deepcopy(modelo)
            tcs = tr.findall(qn('w:tc'))
            while len(tcs) > len(textos):
                tr.remove(tcs[-1])
                tcs = tr.findall(qn('w:tc'))
            while len(tcs) < len(textos):
                tr.append(copy.deepcopy(tcs[-1]))
                tcs = tr.findall(qn('w:tc'))
            for tc, w, txt in zip(tcs, ws, textos):
                tc.find(qn('w:tcPr')).find(qn('w:tcW')).set(qn('w:w'), str(w))
                ps = tc.findall(qn('w:p'))
                for extra in ps[1:]:
                    tc.remove(extra)
                jc = ps[0].find(qn('w:pPr')).find(qn('w:jc'))
                if jc is not None:
                    jc.set(qn('w:val'), 'left')
                poner_texto(ps[0], txt)
            return tr

        t.append(fila(tr_cab, cab))
        for k, f in enumerate(filas):
            t.append(fila(tr_fin if k == len(filas) - 1 else tr_cuerpo, f))
        return t

    for tipo, val in icat.bloques('rios', 4, n_tabla):
        if tipo in ('h1', 'h2'):
            el = copy.deepcopy((h1 if tipo == 'h1' else h2)._p)
            poner_texto(el, val)
            nuevos.append(el)
        elif tipo == 'p':
            el = copy.deepcopy(cuerpo._p)
            poner_texto(el, val)
            nuevos.append(el)
        elif tipo == 'li':
            for item in val:
                el = copy.deepcopy(vineta._p)
                poner_texto(el, item)
                nuevos.append(el)
        elif tipo == 'tabla':
            a = copy.deepcopy(num_tabla._p)
            poner_texto(a, f'Tabla {n_tabla}')
            b = copy.deepcopy(tit_tabla._p)
            poner_texto(b, val['titulo'])
            nuevos += [a, b, tabla(val['cabecera'], val['filas'], val['anchos'])]
            if val.get('nota'):
                c = copy.deepcopy(nota._p)
                r1 = c.findall(qn('w:r'))[1]
                rpr = r1.find(qn('w:rPr'))
                for r in c.findall(qn('w:r'))[1:]:
                    c.remove(r)
                tmp = OxmlElement('w:p')
                poner_texto(tmp, ' ' + val['nota'], rpr)
                for r in tmp.findall(qn('w:r')):
                    c.append(r)
                nuevos.append(c)
            n_tabla += 1
        else:
            raise ValueError(tipo)
    for el in nuevos:
        refs._p.addprevious(el)

    # ── Referencias del curso, en orden alfabético ────────────────────────────
    P = d.paragraphs
    i = P.index(next(p for p in P if p.style.name == 'Heading 1' and p.text.strip() == 'Referencias'))
    lista = [p for p in P[i + 1:] if p.text.strip()]
    clave = lambda s: re.sub(r'[*¿¡«]', '', s).lower()  # noqa: E731
    for ref in icat.REFERENCIAS:
        if any(clave(ref)[:40] == clave(p.text)[:40] for p in lista):
            continue
        sig = next((p for p in lista if clave(p.text) > clave(ref)), None)
        modelo = lista[0]
        el = copy.deepcopy(modelo._p)
        poner_texto(el, ref, copy.deepcopy(modelo._p.find(qn('w:r')).find(qn('w:rPr'))) if modelo._p.find(qn('w:r')).find(qn('w:rPr')) is not None else None)
        if sig is not None:
            sig._p.addprevious(el)
        else:
            lista[-1]._p.addnext(el)
        P = d.paragraphs
        lista = [p for p in P[i + 1:] if p.text.strip()]
    d.save(RUTA)
    actualizar_indice(RUTA)
    print('Listo:', RUTA)


def actualizar_indice(ruta):
    """Agrega al índice (campo TOC guardado) los títulos nuevos y pone las páginas de LibreOffice."""
    d = Document(ruta)
    body = d.element.body
    sdt = next(el for el in body.iterchildren() if el.tag == qn('w:sdt'))
    cont = sdt.find(qn('w:sdtContent'))
    entradas = [p for p in cont.findall(qn('w:p')) if ''.join(t.text or '' for t in p.iter(qn('w:t'))).strip()]
    texto = lambda p: ''.join(t.text or '' for t in p.iter(qn('w:t')))  # noqa: E731
    titulos = [(int(p.style.name[-1]), p.text.strip()) for p in d.paragraphs if p.style.name in ('Heading 1', 'Heading 2', 'Heading 3') and p.text.strip()]
    # Modelos de entrada por nivel (TOC1/TOC2/TOC3) a partir de las entradas que ya hay
    modelo = {}
    for p in entradas:
        ppr = p.find(qn('w:pPr'))
        st = ppr.find(qn('w:pStyle')).get(qn('w:val')) if ppr is not None and ppr.find(qn('w:pStyle')) is not None else ''
        nivel = int(re.sub(r'\D', '', st) or 1)
        modelo.setdefault(nivel, p)
    existentes = {re.sub(r'\d+$', '', texto(p)).strip(): p for p in entradas}
    anterior = None
    for nivel, t in titulos:
        if t in existentes:
            anterior = existentes[t]
            continue
        nuevo = copy.deepcopy(modelo.get(nivel, modelo[1]))
        # Sin el vínculo ni el campo PAGEREF del modelo (apuntarían a otro título): texto y página fijos;
        # «Actualizar toda la tabla» en Word vuelve a armar el índice con todos los títulos.
        for hl in nuevo.findall(qn('w:hyperlink')):
            for r in list(hl):
                hl.addprevious(r)
            nuevo.remove(hl)
        for r in list(nuevo.findall(qn('w:r'))):
            if r.find(qn('w:fldChar')) is not None or r.find(qn('w:instrText')) is not None:
                nuevo.remove(r)
        ts = list(nuevo.iter(qn('w:t')))
        ts[0].text = t
        for x in ts[1:-1]:
            x.text = ''
        anterior.addnext(nuevo)
        existentes[t] = nuevo
        anterior = nuevo
    d.save(ruta)
    # Páginas con LibreOffice
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, ruta], check=True, capture_output=True)
        pdf = os.path.join(tmp, os.path.splitext(os.path.basename(ruta))[0] + '.pdf')
        n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
        paginas = [re.sub(r'\s+', ' ', subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout) for i in range(1, n + 1)]
    d = Document(ruta)
    cont = next(el for el in d.element.body.iterchildren() if el.tag == qn('w:sdt')).find(qn('w:sdtContent'))
    inicio = max(i for i, t in enumerate(paginas[:6]) if 'Índice' in t) + 1
    k = inicio
    for p in cont.findall(qn('w:p')):
        ts = list(p.iter(qn('w:t')))
        if len(ts) < 2:
            continue
        t = ts[0].text.strip()
        j = k
        while j < n and t not in paginas[j]:
            j += 1
        if j < n:
            ts[-1].text = str(j + 1)
            k = j
    d.save(ruta)


if __name__ == '__main__':
    main()
