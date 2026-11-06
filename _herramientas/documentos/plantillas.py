"""plantillas.py — Arma las plantillas vacías del informe y del manual a partir de los documentos
del simulador de ríos (conserva estilos, numeración, márgenes, encabezados y pies de página; quita
el contenido y las imágenes). Uso: python3 -I plantillas.py Informe.docx Manual.docx carpeta_salida"""
import sys
import docx
from docx.oxml.ns import qn


def despojar(origen, destino):
    d = docx.Document(origen)
    body = d.element.body
    for el in list(body.iterchildren()):
        if el.tag != qn('w:sectPr'):
            body.remove(el)
    xml = d.element.xml
    for rId, rel in list(d.part.rels.items()):
        if rel.reltype.endswith('/image') and f'"{rId}"' not in xml:
            d.part.drop_rel(rId)
    # Pedir a Word que actualice los campos (índice) al abrir
    s = d.settings.element
    if s.find(qn('w:updateFields')) is None:
        u = s.makeelement(qn('w:updateFields'), {qn('w:val'): 'true'})
        s.append(u)
    d.save(destino)


if __name__ == '__main__':
    inf, man, salida = sys.argv[1:4]
    despojar(inf, f'{salida}/informe.docx')
    despojar(man, f'{salida}/manual.docx')
    print('plantillas listas')
