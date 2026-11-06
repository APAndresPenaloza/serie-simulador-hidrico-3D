"""docx_serie.py — Piezas de Word con el formato de los documentos del simulador de ríos.

Texto con marcas sencillas: *cursiva*, **negrita**, _{subíndice} y ^{superíndice}.
Las ecuaciones se escriben en LaTeX y pandoc las convierte en ecuaciones de Word (OMML).
"""
import copy
import os
import re
import subprocess
import tempfile

import docx
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Emu

MARCAS = re.compile(r'(\*\*.+?\*\*|\*.+?\*|_\{.+?\}|\^\{.+?\})')
AZUL = '1C6E95'


def _el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn(k), str(v))
    return e


def _rpr(negrita=False, cursiva=False, tam=None, color=None, vert=None):
    r = _el('w:rPr')
    if negrita:
        r.append(_el('w:b')); r.append(_el('w:bCs'))
    if cursiva:
        r.append(_el('w:i')); r.append(_el('w:iCs'))
    if color:
        r.append(_el('w:color', **{'w:val': color}))
    if tam:
        r.append(_el('w:sz', **{'w:val': int(tam * 2)})); r.append(_el('w:szCs', **{'w:val': int(tam * 2)}))
    if vert:
        r.append(_el('w:vertAlign', **{'w:val': vert}))
    return r


def _run(texto, **fmt):
    r = _el('w:r')
    rp = _rpr(**fmt)
    if len(rp):
        r.append(rp)
    partes = texto.split('\t')
    for k, parte in enumerate(partes):
        if k:
            r.append(_el('w:tab'))
        if parte:
            t = _el('w:t')
            t.text = parte
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            r.append(t)
    return r


def runs_html(html_texto, negrita=False, cursiva=False, tam=None, color=None):
    """Lista de w:r a partir del HTML de las ecuaciones del simulador (<i>, <b>, <sub>, <sup> anidados)."""
    from html.parser import HTMLParser
    out = []

    class _P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.pila = []

        def handle_starttag(self, tag, attrs):
            if tag == 'br':
                out.append(_run(' ', negrita=negrita, cursiva=cursiva, tam=tam, color=color))
            elif tag in ('i', 'em', 'b', 'strong', 'sub', 'sup'):
                self.pila.append(tag)

        def handle_endtag(self, tag):
            if tag in self.pila:
                del self.pila[len(self.pila) - 1 - self.pila[::-1].index(tag)]

        def handle_data(self, data):
            if not data:
                return
            p = self.pila
            vert = None
            if 'sup' in p:
                vert = 'superscript'      # Word no anida subíndices dentro de exponentes
            elif 'sub' in p:
                vert = 'subscript'
            out.append(_run(data, negrita=negrita or 'b' in p or 'strong' in p, cursiva=cursiva or 'i' in p or 'em' in p,
                            tam=tam, color=color, vert=vert))

    _P().feed(html_texto)
    return out


def runs(texto, negrita=False, cursiva=False, tam=None, color=None):
    """Lista de w:r a partir del texto con marcas."""
    out = []
    for pieza in MARCAS.split(texto):
        if not pieza:
            continue
        if pieza.startswith('**') and pieza.endswith('**') and len(pieza) > 4:
            out += runs(pieza[2:-2], True, cursiva, tam, color)
        elif pieza.startswith('*') and pieza.endswith('*') and len(pieza) > 2:
            out += runs(pieza[1:-1], negrita, True, tam, color)
        elif pieza.startswith('_{'):
            out.append(_run(pieza[2:-1], negrita=negrita, cursiva=cursiva, tam=tam, color=color, vert='subscript'))
        elif pieza.startswith('^{'):
            out.append(_run(pieza[2:-1], negrita=negrita, cursiva=cursiva, tam=tam, color=color, vert='superscript'))
        else:
            out.append(_run(pieza, negrita=negrita, cursiva=cursiva, tam=tam, color=color))
    return out


def ppr(estilo=None, jc=None, antes=None, despues=None, linea=None, regla='auto', primera=None, izquierda=None,
        colgante=None, salto=False, mantener=False, num=None, tabs=None):
    p = _el('w:pPr')
    if estilo:
        p.append(_el('w:pStyle', **{'w:val': estilo}))
    if mantener:
        p.append(_el('w:keepNext'))
    if salto:
        p.append(_el('w:pageBreakBefore'))
    if num is not None:
        n = _el('w:numPr')
        n.append(_el('w:ilvl', **{'w:val': 0}))
        n.append(_el('w:numId', **{'w:val': num}))
        p.append(n)
    if tabs:
        t = _el('w:tabs')
        for tipo, pos in tabs:
            t.append(_el('w:tab', **{'w:val': tipo, 'w:pos': pos}))
        p.append(t)
    if any(v is not None for v in (antes, despues, linea)):
        s = _el('w:spacing')
        if antes is not None:
            s.set(qn('w:before'), str(antes))
        if despues is not None:
            s.set(qn('w:after'), str(despues))
        if linea is not None:
            s.set(qn('w:line'), str(linea)); s.set(qn('w:lineRule'), regla)
        p.append(s)
    if any(v is not None for v in (primera, izquierda, colgante)):
        i = _el('w:ind')
        if izquierda is not None:
            i.set(qn('w:left'), str(izquierda))
        if colgante is not None:
            i.set(qn('w:hanging'), str(colgante))
        if primera is not None:
            i.set(qn('w:firstLine'), str(primera))
        p.append(i)
    if jc:
        p.append(_el('w:jc', **{'w:val': jc}))
    return p


def latex_a_omml(lista):
    """Convierte una lista de ecuaciones LaTeX en elementos m:oMath (con pandoc)."""
    if not lista:
        return {}
    with tempfile.TemporaryDirectory() as tmp:
        md = os.path.join(tmp, 'ec.md')
        out = os.path.join(tmp, 'ec.docx')
        with open(md, 'w', encoding='utf-8') as f:
            f.write('\n\n'.join(f'$${x}$$' for x in lista))
        subprocess.run(['pandoc', md, '-f', 'markdown', '-t', 'docx', '-o', out], check=True)
        d = docx.Document(out)
        oms = []
        for p in d.paragraphs:
            om = p._p.find('.//' + qn('m:oMath'))
            if om is not None:
                oms.append(om)
    if len(oms) != len(lista):
        raise RuntimeError(f'pandoc devolvió {len(oms)} ecuaciones de {len(lista)}')
    return dict(zip(lista, oms))


class Documento:
    """Documento armado sobre una plantilla (informe o manual)."""

    def __init__(self, plantilla, tipo):
        self.d = docx.Document(plantilla)
        self.tipo = tipo
        self.body = self.d.element.body
        self.sect = self.body.find(qn('w:sectPr'))
        self.n_fig = 0
        self.n_tab = 0
        self.n_eq = 0
        self.titulos = []
        self.marca = 100
        self.omml = {}
        sec = self.d.sections[0]
        self.ancho = sec.page_width - sec.left_margin - sec.right_margin

    # ── Bloques básicos ───────────────────────────────────────────────────
    def _agregar(self, el):
        self.sect.addprevious(el)
        return el

    def parrafo(self, texto='', pp=None, **fmt):
        p = _el('w:p')
        p.append(pp if pp is not None else self.pp_normal())
        for r in runs(texto, **fmt):
            p.append(r)
        return self._agregar(p)

    def pp_normal(self):
        if self.tipo == 'informe':
            return ppr(despues=0, linea=260, regla='exact', primera=284)
        return ppr(despues=120, linea=276, jc='both')

    def texto(self, t):
        return self.parrafo(t)

    def vinetas(self, lista):
        for t in lista:
            if self.tipo == 'informe':
                pp = ppr('Prrafodelista', despues=0, linea=260, regla='exact', primera=284, num=2)
            else:
                pp = ppr('Prrafodelista', despues=60, linea=264, num=2)
            self.parrafo(t, pp)

    def titulo(self, nivel, texto):
        estilo = f'Ttulo{nivel}'
        salto = nivel == 1
        pp = ppr(estilo, salto=salto, primera=284 if self.tipo == 'informe' and nivel > 1 else None)
        p = _el('w:p')
        p.append(pp)
        self.marca += 1
        nombre = f'_Toc{self.marca:08d}'
        p.append(_el('w:bookmarkStart', **{'w:id': self.marca, 'w:name': nombre}))
        for r in runs(texto):
            p.append(r)
        p.append(_el('w:bookmarkEnd', **{'w:id': self.marca}))
        self.titulos.append((nivel, texto, nombre))
        return self._agregar(p)

    def salto_pagina(self):
        p = _el('w:p')
        r = _el('w:r')
        r.append(_el('w:br', **{'w:type': 'page'}))
        p.append(r)
        self._agregar(p)

    # ── Índice (campo TOC con las entradas ya escritas) ───────────────────
    def indice(self, paginas=None, niveles=3):
        """Inserta el campo TOC. paginas: {texto del título: página} de una pasada anterior."""
        self._indice_pos = _el('w:p')
        self._agregar(self._indice_pos)
        self._indice_cfg = (paginas or {}, niveles)

    def cerrar_indice(self):
        if not hasattr(self, '_indice_pos'):
            return
        paginas, niveles = self._indice_cfg
        ancla = self._indice_pos
        entradas = [(n, t, b) for n, t, b in self.titulos if n <= niveles]
        derecho = int(self.ancho / 635)   # EMU → twips
        for k, (n, t, b) in enumerate(entradas):
            p = _el('w:p')
            pp = ppr(f'TDC{n}', despues=40 if self.tipo == 'manual' else 0, izquierda=(n - 1) * 360,
                     primera=0, tabs=[('right', derecho)], jc='left')
            tab = pp.find(qn('w:tabs'))
            tab[0].set(qn('w:leader'), 'dot')
            p.append(pp)
            if k == 0:
                r = _el('w:r'); r.append(_el('w:fldChar', **{'w:fldCharType': 'begin'})); p.append(r)
                r = _el('w:r'); it = _el('w:instrText'); it.text = f' TOC \\o "1-{niveles}" \\h \\z \\u '
                it.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve'); r.append(it); p.append(r)
                r = _el('w:r'); r.append(_el('w:fldChar', **{'w:fldCharType': 'separate'})); p.append(r)
            h = _el('w:hyperlink', **{'w:anchor': b, 'w:history': 1})
            for rr in runs(t, negrita=(n == 1 and self.tipo == 'manual'), tam=11 if self.tipo == 'manual' else None):
                h.append(rr)
            h.append(_run('\t' + str(paginas.get(t, ''))))
            p.append(h)
            if k == len(entradas) - 1:
                r = _el('w:r'); r.append(_el('w:fldChar', **{'w:fldCharType': 'end'})); p.append(r)
            ancla.addprevious(p)
        ancla.getparent().remove(ancla)

    # ── Ecuaciones ────────────────────────────────────────────────────────
    def preparar_ecuaciones(self, lista):
        faltan = [x for x in dict.fromkeys(lista) if x not in self.omml]
        self.omml.update(latex_a_omml(faltan))

    def ecuacion(self, latex, numerada=True):
        if latex not in self.omml:
            self.preparar_ecuaciones([latex])
        p = _el('w:p')
        derecho = int(self.ancho / 635)
        p.append(ppr(tabs=[('center', derecho // 2), ('right', derecho)], antes=60, despues=60, primera=0 if self.tipo == 'manual' else 284, jc='left'))
        p.append(_run('\t'))
        p.append(copy.deepcopy(self.omml[latex]))
        if numerada:
            self.n_eq += 1
            p.append(_run(f'\t({self.n_eq})'))
        self._agregar(p)
        return self.n_eq

    # ── Figuras ───────────────────────────────────────────────────────────
    def _imagen_run(self, ruta, ancho_cm):
        # Las capturas grandes van en JPEG (el documento pesa mucho menos y se ven igual)
        if ruta.lower().endswith('.png') and os.path.getsize(ruta) > 450_000:
            from PIL import Image
            jpg = ruta[:-4] + '.jpg'
            if not os.path.exists(jpg) or os.path.getmtime(jpg) < os.path.getmtime(ruta):
                Image.open(ruta).convert('RGB').save(jpg, quality=88, optimize=True)
            ruta = jpg
        p = self.d.add_paragraph()   # se crea al final del cuerpo; se mueve después
        run = p.add_run()
        run.add_picture(ruta, width=Cm(ancho_cm))
        r = run._r
        p._p.getparent().remove(p._p)
        return r

    def _encabezado_figura(self, titulo):
        self.n_fig += 1
        if self.tipo == 'informe':
            self.parrafo(f'Figura {self.n_fig}', ppr(mantener=True, antes=160, despues=0, linea=260, regla='exact', primera=284, jc='left'), negrita=True)
            self.parrafo(titulo, ppr(mantener=True, despues=0, linea=260, regla='exact', primera=284, jc='left'), cursiva=True)
        else:
            self.parrafo(f'Figura {self.n_fig}', ppr(mantener=True, antes=160), negrita=True)
            self.parrafo(titulo, ppr(mantener=True, despues=80), cursiva=True)
        return self.n_fig

    def _nota(self, nota):
        if not nota:
            return
        if self.tipo == 'informe':
            p = self.parrafo('', ppr(despues=160, linea=260, regla='exact', primera=284))
            p.append(_run('Nota.', cursiva=True))
            for r in runs(' ' + nota):
                p.append(r)
        else:
            p = self.parrafo('', ppr(despues=200))
            p.append(_run('Nota. ', cursiva=True, tam=10))
            for r in runs(nota, tam=10):
                p.append(r)

    @staticmethod
    def _limitar_alto(ruta, ancho_cm, alto_max_cm):
        """Reduce el ancho si la imagen quedaría más alta que alto_max_cm (para que el título,
        la imagen y la nota quepan en la misma página)."""
        from PIL import Image
        with Image.open(ruta) as im:
            w, h = im.size
        return min(ancho_cm, alto_max_cm * w / h) if h else ancho_cm

    def figura(self, ruta, titulo, nota='', ancho_cm=15.5, alto_max_cm=17.5):
        n = self._encabezado_figura(titulo)
        p = _el('w:p')
        p.append(ppr(mantener=True, despues=60 if self.tipo == 'informe' else 80, jc='center'))
        p.append(self._imagen_run(ruta, self._limitar_alto(ruta, ancho_cm, alto_max_cm)))
        self._agregar(p)
        self._nota(nota)
        return n

    def figura_par(self, piezas, titulo, nota='', alto_max_cm=17.0):
        """piezas: [(ruta, '(a) texto'), (ruta, '(b) texto')] en una tabla 1 × 2."""
        n = self._encabezado_figura(titulo)
        tbl = self._tabla_base([9360 // len(piezas)] * len(piezas), bordes='none')
        tr = _el('w:tr')
        trp = _el('w:trPr'); trp.append(_el('w:cantSplit')); tr.append(trp)
        ancho0 = 16.2 / len(piezas) - 0.4
        for ruta, rotulo in piezas:
            ancho = self._limitar_alto(ruta, ancho0, alto_max_cm)
            tc = _el('w:tc')
            tcp = _el('w:tcPr'); tcp.append(_el('w:tcW', **{'w:w': 9360 // len(piezas), 'w:type': 'dxa'}))
            mar = _el('w:tcMar'); mar.append(_el('w:left', **{'w:w': 60, 'w:type': 'dxa'})); mar.append(_el('w:right', **{'w:w': 60, 'w:type': 'dxa'})); tcp.append(mar)
            tcp.append(_el('w:vAlign', **{'w:val': 'top'}))
            tc.append(tcp)
            p1 = _el('w:p'); p1.append(ppr(jc='center', despues=40, primera=0, mantener=True))
            for r in runs(rotulo, tam=9.5):
                p1.append(r)
            tc.append(p1)
            p2 = _el('w:p'); p2.append(ppr(jc='center', despues=0, primera=0, mantener=bool(nota)))
            p2.append(self._imagen_run(ruta, ancho))
            tc.append(p2)
            tr.append(tc)
        tbl.append(tr)
        self._agregar(tbl)
        self._nota(nota)
        return n

    # ── Tablas ────────────────────────────────────────────────────────────
    def _tabla_base(self, anchos, bordes='single'):
        tbl = _el('w:tbl')
        tp = _el('w:tblPr')
        tp.append(_el('w:tblW', **{'w:w': sum(anchos), 'w:type': 'dxa'}))
        tp.append(_el('w:jc', **{'w:val': 'center'}))
        b = _el('w:tblBorders')
        for lado in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            b.append(_el(f'w:{lado}', **{'w:val': 'none' if bordes == 'none' else 'single', 'w:sz': 4, 'w:space': 0, 'w:color': 'auto'}))
        tp.append(b)
        tp.append(_el('w:tblLayout', **{'w:type': 'fixed'}))
        tp.append(_el('w:tblLook', **{'w:val': '04A0', 'w:firstRow': 1, 'w:lastRow': 0, 'w:firstColumn': 1, 'w:lastColumn': 0, 'w:noHBand': 0, 'w:noVBand': 1}))
        tbl.append(tp)
        g = _el('w:tblGrid')
        for a in anchos:
            g.append(_el('w:gridCol', **{'w:w': a}))
        tbl.append(g)
        return tbl

    def tabla(self, cabecera, filas, anchos=None, titulo=None, nota=None, derecha=()):
        """Tabla con el estilo del documento. anchos en fracciones del ancho útil."""
        total = 9360 if self.tipo == 'manual' else 9406
        n = len(cabecera)
        anchos = anchos or [1 / n] * n
        tw = [int(total * a / sum(anchos)) for a in anchos]
        if titulo and self.tipo == 'informe':
            self.n_tab += 1
            self.parrafo(f'Tabla {self.n_tab}', ppr(mantener=True, antes=160, despues=0, linea=260, regla='exact', primera=284, jc='left'), negrita=True)
            self.parrafo(titulo, ppr(mantener=True, despues=60, linea=260, regla='exact', primera=284, jc='left'), cursiva=True)
        tbl = self._tabla_base(tw, bordes='none' if self.tipo == 'informe' else 'single')
        for k, fila in enumerate([cabecera] + list(filas)):
            tr = _el('w:tr')
            trp = _el('w:trPr')
            if k == 0:
                trp.append(_el('w:tblHeader'))
            trp.append(_el('w:cantSplit'))
            tr.append(trp)
            for j, celda in enumerate(fila):
                tc = _el('w:tc')
                tcp = _el('w:tcPr')
                tcp.append(_el('w:tcW', **{'w:w': tw[j], 'w:type': 'dxa'}))
                bd = _el('w:tcBorders')
                if self.tipo == 'manual':
                    for lado in ('top', 'left', 'bottom', 'right'):
                        bd.append(_el(f'w:{lado}', **{'w:val': 'single', 'w:sz': 4, 'w:space': 0, 'w:color': 'C9D3DA'}))
                else:
                    ultima = k == len(filas)
                    bd.append(_el('w:top', **{'w:val': 'single' if k <= 1 else 'none', 'w:sz': 6, 'w:space': 0, 'w:color': '000000'}))
                    bd.append(_el('w:left', **{'w:val': 'none', 'w:sz': 0, 'w:space': 0, 'w:color': 'FFFFFF'}))
                    bd.append(_el('w:bottom', **{'w:val': 'single' if (k == 0 or ultima) else 'none', 'w:sz': 6, 'w:space': 0, 'w:color': '000000'}))
                    bd.append(_el('w:right', **{'w:val': 'none', 'w:sz': 0, 'w:space': 0, 'w:color': 'FFFFFF'}))
                tcp.append(bd)
                if k == 0 and self.tipo == 'manual':
                    tcp.append(_el('w:shd', **{'w:val': 'clear', 'w:color': 'auto', 'w:fill': AZUL}))
                elif k % 2 == 0 and self.tipo == 'manual':
                    tcp.append(_el('w:shd', **{'w:val': 'clear', 'w:color': 'auto', 'w:fill': 'F3F7F9'}))
                mar = _el('w:tcMar')
                for lado, v in (('top', 50), ('left', 90), ('bottom', 50), ('right', 90)):
                    mar.append(_el(f'w:{lado}', **{'w:w': v, 'w:type': 'dxa'}))
                tcp.append(mar)
                tcp.append(_el('w:vAlign', **{'w:val': 'center'}))
                tc.append(tcp)
                p = _el('w:p')
                # La cabecera y las primeras filas no se separan (una tabla corta no se parte)
                p.append(ppr(mantener=(k < len(filas)) if len(filas) <= 6 else (k <= 2), despues=0, linea=252 if self.tipo == 'manual' else None, primera=0, jc='right' if j in derecha else 'left'))
                tam = 9.5 if self.tipo == 'manual' else 10
                for r in runs(str(celda), negrita=(k == 0), tam=tam, color='FFFFFF' if (k == 0 and self.tipo == 'manual') else None):
                    p.append(r)
                tc.append(p)
                tr.append(tc)
            tbl.append(tr)
        self._agregar(tbl)
        if nota:
            self._nota(nota)
        else:
            self.parrafo('', ppr(despues=80 if self.tipo == 'manual' else 0))

    def caja(self, titulo, texto):
        """Recuadro azul claro con borde izquierdo (solo manual)."""
        tbl = self._tabla_base([9360])
        tr = _el('w:tr'); trp = _el('w:trPr'); trp.append(_el('w:cantSplit')); tr.append(trp)
        tc = _el('w:tc'); tcp = _el('w:tcPr')
        tcp.append(_el('w:tcW', **{'w:w': 9360, 'w:type': 'dxa'}))
        bd = _el('w:tcBorders')
        for lado in ('top', 'bottom', 'right'):
            bd.append(_el(f'w:{lado}', **{'w:val': 'none', 'w:sz': 0, 'w:space': 0, 'w:color': 'auto'}))
        bd.append(_el('w:left', **{'w:val': 'single', 'w:sz': 24, 'w:space': 0, 'w:color': AZUL}))
        tcp.append(bd)
        tcp.append(_el('w:shd', **{'w:val': 'clear', 'w:color': 'auto', 'w:fill': 'EAF4F8'}))
        mar = _el('w:tcMar')
        for lado, v in (('top', 100), ('left', 180), ('bottom', 100), ('right', 180)):
            mar.append(_el(f'w:{lado}', **{'w:w': v, 'w:type': 'dxa'}))
        tcp.append(mar)
        tc.append(tcp)
        p = _el('w:p'); p.append(ppr(linea=264, despues=0, jc='both'))
        p.append(_run(titulo + ' ', negrita=True, color=AZUL))
        for r in runs(texto):
            p.append(r)
        tc.append(p)
        tr.append(tc)
        tbl.append(tr)
        self._agregar(tbl)
        self.parrafo('', ppr(despues=80))

    def guardar(self, ruta):
        self.cerrar_indice()
        self.d.core_properties.author = 'Andrés Mauricio Peñaloza Fernández; Eliana Carolina María Wong Lubo'
        self.d.save(ruta)
