# Arma el index.html de la serie (la portada de GitHub Pages) a partir de plantilla.html: tarjetas de los
# simuladores con accesos a sus documentos, base de información (informes y manuales en PDF y Word) y
# galería de recorridos (videos con su portada y GIF). Los pesos de los archivos se leen del repositorio,
# así que conviene volver a correrlo después de regenerar documentos, videos o GIF.
# Uso (desde la raíz de la serie): python3 _herramientas/portada/armar_portada.py
# Portadas de los videos: VIDEOS/portadas/<nombre>.jpg (960×540, el cuadro 194 de cada grabación).
import os, sys
from urllib.parse import quote

AQUI = os.path.dirname(os.path.abspath(__file__))
R = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(AQUI, '..', '..'))

S = [  # n, corto, título, descripción, carpeta, archivo de documentos, nombre de medios
    (1, 'Lagunas', 'Laguna de alta montaña', 'Laguna glaciar del páramo: balance de agua, glaciar, regulación del páramo, calidad, sedimentos y amenazas.', 'Lagunas', 'Lagunas', '01_Lagunas'),
    (2, 'Lagos', 'Lago andino', 'Lago profundo de alta montaña: estratificación, viento, oxígeno, nutrientes (Vollenweider y Carlson), nivel y cultivo en jaulas de trucha o de peces nativos (capitán de la sabana y guapucha).', 'Lagos', 'Lagos', '02_Lagos'),
    (3, 'Ríos exorreicos', 'Río de la Sierra Nevada', 'El proyecto de referencia: lluvia, río, represa, captación, bombeo, tuberías, red, riego, huella, acuífero y arroyo.', 'Rios exorreicos', 'Rios_exorreicos', '03_Rios_exorreicos'),
    (4, 'Ciénagas', 'Ciénaga Grande', 'Laguna costera: caños con agua en los dos sentidos (el río la llena en la creciente y ella le devuelve agua en el estiaje), alisios, marea, salinidad, manglar, calidad del agua y sedimentos.', 'Cienagas', 'Cienagas', '04_Cienagas'),
    (5, 'Deltas', 'Delta del río grande', 'Desembocadura: canales, cuña salina, pluma, avance del delta, oleaje y dragado del canal de acceso.', 'Deltas', 'Deltas', '05_Deltas'),
    (6, 'Costas', 'Playa del Caribe', 'Playa de bahía: oleaje y rompiente, nivel del mar y remonte, perfil y regla de Bruun, arena y calidad del agua.', 'Costas', 'Costas', '06_Costas'),
    (7, 'Océanos', 'Mar Caribe', 'Mar abierto: olas, mareas, Ekman y afloramiento, bosque de niebla de la Serranía de Macuira, temperatura y coral, pluma, nivel del mar y acidificación.', 'Oceanos', 'Oceanos', '07_Oceanos'),
    (8, 'Sistema conectado', 'Del páramo al océano', 'Une los siete modelos: composición de funciones, matriz de la red, lazo de la costa, trazadores, clima y horizonte.', 'Sistema conectado', 'Sistema_Conectado', '08_Sistema_conectado'),
]

def ruta(carpeta, *partes):
    return '/'.join([f'simulador-hidrico-3D - {carpeta}', *partes])

def href(p):
    return quote(p, safe='/')

def peso(p):
    b = os.path.getsize(os.path.join(R, p))
    return f'{b / 1e6:.1f} MB' if b >= 1e5 else f'{b / 1e3:.0f} kB'

def docs(carpeta, archivo):
    inf_pdf = ruta(carpeta, 'documentos', f'Informe_Simulador_Hidrico_3D_{archivo}.pdf')
    inf_doc = ruta(carpeta, 'documentos', f'Informe_Simulador_Hidrico_3D_{archivo}.docx')
    man_pdf = ruta(carpeta, 'documentos', f'Manual_Simulador_Hidrico_3D_{archivo}.pdf')
    man_doc = ruta(carpeta, 'documentos', f'Manual_Simulador_Hidrico_3D_{archivo}.docx')
    if not os.path.exists(os.path.join(R, man_pdf)):           # Ríos: el manual está en la raíz del proyecto
        man_pdf = ruta(carpeta, f'Manual_Simulador_Hidrico_3D_{archivo}.pdf')
    for p in (inf_pdf, man_pdf):
        assert os.path.exists(os.path.join(R, p)), p
    tiene = lambda p: os.path.exists(os.path.join(R, p))
    return inf_pdf, (inf_doc if tiene(inf_doc) else None), man_pdf, (man_doc if tiene(man_doc) else None)

NUEVA = ' target="_blank" rel="noopener"'
tarjetas, filas, videos = [], [], []
for n, corto, titulo, desc, carpeta, archivo, medio in S:
    inf_pdf, inf_doc, man_pdf, man_doc = docs(carpeta, archivo)
    mp4, gif, poster = f'VIDEOS/{medio}.mp4', f'GIF/{medio}.gif', f'VIDEOS/portadas/{medio}.jpg'
    for p in (mp4, gif, poster):
        assert os.path.exists(os.path.join(R, p)), p
    clase = 'tarjeta sistema' if n == 8 else 'tarjeta'
    tarjetas.append(
        f'      <article class="{clase}">\n'
        f'        <a class="abrir" href="{href(ruta(carpeta))}/"><span class="n">{n} · {corto}</span><h3>{titulo}</h3><p>{desc}</p><span class="ir">Abrir el simulador →</span></a>\n'
        f'        <p class="accesos"><a href="{href(inf_pdf)}"{NUEVA}>Informe</a><a href="{href(man_pdf)}"{NUEVA}>Manual</a>'
        f'<a href="#recorrido-{n}">Video</a><a href="{href(gif)}"{NUEVA}>GIF</a></p>\n'
        f'      </article>')
    word = lambda p: f' · <a href="{href(p)}">Word</a> <span class="peso">{peso(p)}</span>' if p else ''
    filas.append(
        f'          <tr><th scope="row"><a href="{href(ruta(carpeta))}/">{n} · {corto}</a></th>'
        f'<td data-titulo="Informe técnico"><a href="{href(inf_pdf)}"{NUEVA}>PDF</a> <span class="peso">{peso(inf_pdf)}</span>{word(inf_doc)}</td>'
        f'<td data-titulo="Manual de uso"><a href="{href(man_pdf)}"{NUEVA}>PDF</a> <span class="peso">{peso(man_pdf)}</span>{word(man_doc)}</td>'
        f'<td data-titulo="Recorrido"><a href="#recorrido-{n}">Video</a> <span class="peso">{peso(mp4)}</span> · <a href="{href(gif)}"{NUEVA}>GIF</a> <span class="peso">{peso(gif)}</span></td></tr>')
    videos.append(
        f'      <figure id="recorrido-{n}">\n'
        f'        <video controls preload="none" playsinline width="960" height="540" poster="{href(poster)}"><source src="{href(mp4)}" type="video/mp4">Tu navegador no reproduce el video: <a href="{href(mp4)}">descárgalo</a>.</video>\n'
        f'        <figcaption><b>{n} · {corto}</b><a href="{href(mp4)}" download>Descargar el video</a> <span class="peso">{peso(mp4)}</span> <span class="sep">·</span> <a href="{href(gif)}"{NUEVA}>GIF</a> <span class="peso">{peso(gif)}</span></figcaption>\n'
        f'      </figure>')

html = open(os.path.join(AQUI, 'plantilla.html'), encoding='utf8').read()
html = html.replace('{{TARJETAS}}', '\n'.join(tarjetas)).replace('{{FILAS}}', '\n'.join(filas)).replace('{{VIDEOS}}', '\n'.join(videos))
assert '{{' not in html
open(os.path.join(R, 'index.html'), 'w', encoding='utf8').write(html)
print('index.html:', len(html), 'caracteres')
