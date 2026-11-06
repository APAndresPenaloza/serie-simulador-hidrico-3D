"""generar.py — Informe técnico científico y manual de usuario (.docx) de un simulador de la serie.

Uso:  python3 -I generar.py <id> <carpeta_extraccion> <carpeta_salida> [--paginas]
  <id>: lagunas, lagos, cienagas, deltas, costas, oceanos o sistema.
  <carpeta_extraccion>: la de extraer.cjs (datos.json e img/).
  --paginas: segunda pasada; convierte a PDF con LibreOffice, busca la página de cada título y
             escribe el índice con sus números.
El texto propio de cada proyecto está en contenido/<id>.py (INFORME y MANUAL); todo número de
las tablas sale del simulador (datos.json).
"""
import html
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from docx_serie import Documento, ppr, runs, runs_html, _run  # noqa: E402
from graficas import dibujar  # noqa: E402

SERIE = os.path.abspath(os.path.join(AQUI, '..', '..'))
CARPETAS = {
    'lagunas': 'simulador-hidrico-3D - Lagunas', 'lagos': 'simulador-hidrico-3D - Lagos', 'cienagas': 'simulador-hidrico-3D - Cienagas',
    'deltas': 'simulador-hidrico-3D - Deltas', 'costas': 'simulador-hidrico-3D - Costas', 'oceanos': 'simulador-hidrico-3D - Oceanos',
    'sistema': 'simulador-hidrico-3D - Sistema conectado',
}
AUTORES = ['Andrés Mauricio Peñaloza Fernández', 'Eliana Carolina María Wong Lubo']
MAGNITUDES = {
    'Q': ('Caudal', 'm³/s'), 'sedimento': ('Sedimento en suspensión', 'mg/L'), 'Qs': ('Carga de sedimento', 'kg/s'),
    'salinidad': ('Salinidad', 'PSU'), 'temperatura': ('Temperatura del agua', '°C'), 'OD': ('Oxígeno disuelto', 'mg/L'),
    'DBO': ('DBO', 'mg/L'), 'coliformes': ('Coliformes fecales', 'NMP/100 mL'), 'nitrogeno': ('Nitrógeno', 'mg/L'),
    'fosforo': ('Fósforo total', 'µg/L'), 'nivel': ('Nivel del agua', 'm'),
    'nivelMedio': ('Nivel medio del mar', 'm'), 'ascenso': ('Rapidez del ascenso del mar', 'mm/año'), 'marea': ('Amplitud de la marea', 'm'),
    'Hs': ('Altura significativa del oleaje', 'm'), 'Tp': ('Período pico del oleaje', 's'), 'direccion': ('Dirección del oleaje', '°'),
}
NOMBRE_PROYECTO = {'lagunas': 'Lagunas', 'lagos': 'Lagos', 'rios': 'Ríos exorreicos', 'cienagas': 'Ciénagas', 'deltas': 'Deltas',
                   'costas': 'Costas', 'oceanos': 'Océanos', 'sistema': 'Sistema conectado'}


def num(x, d=2):
    if not isinstance(x, (int, float)) or x != x:
        return '—'
    s = f'{abs(x):,.{d}f}'.replace(',', ' ')
    return ('−' if x < 0 and round(x, d) != 0 else '') + s


def html_a_marcas(h):
    """HTML de las ecuaciones del simulador → texto con marcas (*cursiva*, _{sub}, ^{sup})."""
    h = re.sub(r'<i>(.*?)</i>', r'*\1*', h)
    h = re.sub(r'<b>(.*?)</b>', r'**\1**', h)
    h = re.sub(r'<sub>(.*?)</sub>', lambda m: '_{' + m.group(1) + '}' if m.group(1) else '', h)
    h = re.sub(r'<sup>(.*?)</sup>', r'^{\1}', h)
    h = re.sub(r'<br\s*/?>', ' ', h)
    h = re.sub(r'<(?!/?p)[^>]+>', '', h)
    h = h.replace('**', '\u0000').replace('\u0000', '**')
    return html.unescape(h)


def bloques_ecuacion(h):
    """[(clase, html)] de los párrafos del bloque «Modelo matemático» (el HTML se pasa a runs con runs_html)."""
    out = []
    for m in re.finditer(r'<p class="([^"]+)">(.*?)</p>', h, flags=re.S):
        out.append((m.group(1).split()[0], m.group(2).strip()))
    return out


def parrafo_html(doc, contenido, pp, **fmt):
    """Párrafo con el HTML de una ecuación del simulador (cursivas, subíndices y exponentes anidados)."""
    p = doc.parrafo('', pp)
    for r in runs_html(contenido, **fmt):
        p.append(r)
    return p


class Relleno:
    """Reemplaza {m:pestaña:resultado}, {c:pestaña:control} y {e:escenario} por los valores del simulador."""

    def __init__(self, D):
        self.m, self.c, self.e = {}, {}, {}
        for t in D['tabs']:
            for x in t['datos']['metricas']:
                if not x.get('titulo'):
                    self.m[(t['id'], x['etiqueta'])] = f"{x['texto']} {x['unidad']}".strip()
            for x in t['datos']['controles']:
                if x['tipo'] != 'accion':
                    u = '' if x['unidad'] in ('lista', 'casilla') else x['unidad']
                    self.c[(t['id'], x['id'])] = f"{x['texto']} {u}".strip()
        for x in D['escenarios']:
            self.e[x['id']] = f"{x['total'] - len(x['fallas'])} de {x['total']}"

    def __call__(self, texto):
        if not isinstance(texto, str):
            return texto

        def rep(mo):
            tipo, resto = mo.group(1), mo.group(2)
            if tipo == 'e':
                return self.e[resto]
            tab, clave = resto.split(':', 1)
            tabla = self.m if tipo == 'm' else self.c
            if (tab, clave) not in tabla:
                raise KeyError(f'No existe {{{tipo}:{tab}:{clave}}}')
            return tabla[(tab, clave)]
        return re.sub(r'\{([mce]):([^{}]+)\}', rep, texto)


CLAVES_TEXTO = {'etiqueta', 'texto', 'doc', 'detalle', 'corregir', 'nombre', 'titulo', 'unidad', 'opciones', 'fallas', 'intro', 'pie', 'figuraPie', 'descripcion'}


def marcar_subindices(s):
    """Textos del simulador (z_máx, h_e², C_D, u*) → marcas del documento (z_{máx}, h_{e}², C_{D}, u∗)."""
    s = s.replace('*', '∗')
    return re.sub(r'(?<![A-Za-z0-9\.\-])([A-Za-zρτΔΩθλμσ])_([A-Za-z0-9áéíóúñ]{1,6})(?![A-Za-z0-9áéíóúñ])', r'\1_{\2}', s)


def limpiar_textos(x, clave=None):
    """Aplica marcar_subindices a los textos del simulador que van a tablas y notas (no a las series)."""
    if isinstance(x, dict):
        return {k: (v if k in ('series', 'ecuacionHTML') else limpiar_textos(v, k)) for k, v in x.items()}
    if isinstance(x, list):
        return [limpiar_textos(v, clave) for v in x]
    if isinstance(x, str) and clave in CLAVES_TEXTO:
        return marcar_subindices(x)
    return x


def rellenar_todo(obj, R):
    if isinstance(obj, str):
        return R(obj)
    if isinstance(obj, list):
        return [rellenar_todo(x, R) for x in obj]
    if isinstance(obj, tuple):
        return tuple(rellenar_todo(x, R) for x in obj)
    if isinstance(obj, dict):
        return {k: rellenar_todo(v, R) for k, v in obj.items()}
    return obj


def cargar_contenido(pid):
    ruta = os.path.join(AQUI, 'contenido', f'{pid}.py')
    spec = importlib.util.spec_from_file_location(f'contenido_{pid}', ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def leer_readme(pid):
    with open(os.path.join(SERIE, CARPETAS[pid], 'README.md'), encoding='utf-8') as f:
        return f.read()


def estructura_readme(pid):
    t = leer_readme(pid)
    m = re.search(r'## Estructura\s+```\n(.*?)```', t, flags=re.S)
    filas = []
    for linea in (m.group(1) if m else '').splitlines():
        partes = re.split(r'\s{2,}', linea.strip(), maxsplit=1)
        if len(partes) == 2:
            filas.append(partes)
    return filas


def ancho_px(ruta):
    from PIL import Image
    with Image.open(ruta) as im:
        return im.size[0]


def partir_alta(ruta, max_ratio=2.0):
    """Si la captura es muy alta (alto/ancho > max_ratio), la corta en k partes por franjas de
    color uniforme cerca de cada k-ésimo de su altura y devuelve las rutas; si no, devuelve [ruta]."""
    import math
    from PIL import Image
    im = Image.open(ruta).convert('RGB')
    w, h = im.size
    if h / w <= max_ratio:
        return [ruta]
    k = math.ceil((h / w) / max_ratio)
    px = im.convert('L').load()

    def corte_cerca(y0):
        mejor, corte = None, int(y0)
        for y in range(max(1, int(y0 - 0.12 * h / k)), min(h - 1, int(y0 + 0.12 * h / k))):
            fila = [px[x, y] for x in range(0, w, 2)]
            puntaje = (max(fila) - min(fila)) + 40 * abs(y - y0) / (h / k)
            if mejor is None or puntaje < mejor:
                mejor, corte = puntaje, y
        return corte

    cortes = [0] + [corte_cerca(i * h / k) for i in range(1, k)] + [h]
    base = ruta[:-4]
    rutas = []
    for i in range(k):
        r = f'{base}_{i + 1}.png'
        im.crop((0, cortes[i], w, cortes[i + 1])).save(r)
        rutas.append(r)
    return rutas


def pruebas(pid):
    carpeta = os.path.join(SERIE, CARPETAS[pid], 'tests')
    out = []
    for f in sorted(os.listdir(carpeta)):
        if f.endswith('.test.js'):
            with open(os.path.join(carpeta, f), encoding='utf-8') as fh:
                for m in re.finditer(r"test\('((?:[^'\\]|\\.)+)'", fh.read()):
                    out.append((f, m.group(1)))
    return out


# ═══════════════════════════════════════════════════════════════════════════
# INFORME TÉCNICO CIENTÍFICO
# ═══════════════════════════════════════════════════════════════════════════
def informe(pid, ext, salida, paginas=None):
    D = json.load(open(os.path.join(ext, 'datos.json'), encoding='utf-8'))
    C = rellenar_todo(cargar_contenido(pid).INFORME, Relleno(D))
    D = limpiar_textos(D)
    img = lambda n: os.path.join(ext, 'img', n)  # noqa: E731
    doc = Documento(os.path.join(AQUI, 'plantillas', 'informe.docx'), 'informe')
    # Ecuaciones (todas de una vez con pandoc)
    eqs = [x[1] for x in C['secciones'] if x[0] == 'eq'] + [e for x in C['secciones'] if x[0] == 'eqs' for e in x[1]]
    doc.preparar_ecuaciones(eqs)

    centro = lambda: ppr(despues=0, primera=284, jc='center')  # noqa: E731
    for t in ['INFORME TÉCNICO CIENTÍFICO', '', C['titulo'], '', 'PROYECTO FINAL DE MODELACIÓN Y SIMULACIÓN HIDRÁULICA',
              'FASE 1: ESTRUCTURA Y MARCO CONCEPTUAL', 'FASE 2: DESARROLLO DEL SIMULADOR CON APOYO DE IA', C['linea'], '']:
        doc.parrafo(t, centro())
    p = doc.parrafo('', ppr(despues=0, jc='center'))
    p.append(doc._imagen_run(img(C.get('portada', 'pantalla.png')), doc._limitar_alto(img(C.get('portada', 'pantalla.png')), 13.5, 8.5)))
    for t in ['', 'PRESENTADO POR:', *[a.upper() for a in AUTORES], '', 'DOCENTE A CARGO:', 'LUIS DUARTE', '', '',
              'INSTITUCIÓN UNIVERSITARIA DE SANTA MARTA (USM)', 'PROGRAMA DE INGENIERÍA DEL AGUA Y DESARROLLO SOSTENIBLE',
              'FACULTAD DE INGENIERÍA', 'SANTA MARTA D.T.C.H.,', C.get('fecha', '6 DE NOVIEMBRE DE 2026')]:
        doc.parrafo(t, centro())
    doc.parrafo('Índice', ppr(salto=True, despues=240, primera=284, jc='center'), negrita=True)
    doc.indice(paginas)
    doc.titulo(1, 'Resumen')
    doc.texto(C['resumen'])
    p = doc.texto('')
    for r in runs('**Palabras clave:** ' + C['palabras']):
        p.append(r)
    doc.titulo(1, 'Abstract')
    doc.texto(C['abstract'])
    p = doc.texto('')
    for r in runs('**Keywords:** ' + C['keywords']):
        p.append(r)

    tabs = {t['id']: t for t in D['tabs']}
    for item in C['secciones']:
        tipo, val = item[0], item[1]
        if tipo in ('h1', 'h2', 'h3'):
            doc.titulo(int(tipo[1]), val)
        elif tipo == 'p':
            doc.texto(val)
        elif tipo == 'li':
            doc.vinetas(val)
        elif tipo == 'eq':
            doc.ecuacion(val)
        elif tipo == 'eqs':
            for e in val:
                doc.ecuacion(e)
        elif tipo == 'fig':
            grafs = [tabs[t]['graficas'][k] for t, k in val['graficas']]
            ruta = os.path.join(ext, f'inf_fig{doc.n_fig + 1}.png')
            dibujar(grafs, ruta, alto_cm=val.get('alto', 6.2))
            doc.figura(ruta, val['titulo'], val.get('nota', ''), ancho_cm=15.8)
        elif tipo == 'img':
            doc.figura(img(val['archivo']), val['titulo'], val.get('nota', ''), ancho_cm=val.get('ancho', 15.8))
        elif tipo == 'tabla':
            doc.tabla(val['cabecera'], val['filas'], val.get('anchos'), val.get('titulo'), val.get('nota'), derecha=val.get('derecha', ()))
        elif tipo == 'tabla_parametros':
            filas = []
            for t in D['tabs']:
                for c in t['datos']['controles']:
                    if c['id'] in val.get('ids', []) or (not val.get('ids') and c['tipo'] == 'rango'):
                        filas.append([c['etiqueta'], f"{c['texto']} {c['unidad']}".strip()])
            mitad = (len(filas) + 1) // 2
            izq, der = filas[:mitad], filas[mitad:] + [['', '']] * (mitad - len(filas[mitad:]))
            doc.tabla(['Parámetro', 'Valor', 'Parámetro', 'Valor'], [a + b for a, b in zip(izq, der)], [3, 1.3, 3, 1.3],
                      val.get('titulo', 'Parámetros del escenario base'), val.get('nota'), derecha=(1, 3))
        elif tipo == 'tabla_criterios':
            filas = [[c['pestana'], c['texto'], c['detalle']] for c in D['revision']]
            doc.tabla(['Pestaña', 'Criterio', 'Escenario base'], filas, [1.2, 4, 2], val.get('titulo', 'Criterios de diseño y su valor en el escenario base'), val.get('nota'))
        elif tipo == 'tabla_escenarios':
            filas = [[e['nombre'], f"{e['total'] - len(e['fallas'])} de {e['total']}", '; '.join(e['fallas']) or 'Todos se cumplen'] for e in D['escenarios']]
            doc.tabla(['Escenario', 'Criterios que se cumplen', 'Criterios que no se cumplen'], filas, [2.2, 1.1, 4], val.get('titulo', 'Escenarios del simulador'), val.get('nota'))
        else:
            raise ValueError(f'bloque desconocido: {tipo}')

    doc.titulo(1, 'Referencias')
    for ref in sorted(C['referencias'], key=lambda r: re.sub(r'[*¿¡«]', '', r).lower()):
        p = doc.parrafo('', ppr(despues=0, linea=260, regla='exact', izquierda=720, colgante=720, jc='left'))
        for r in runs(ref, tam=11):
            p.append(r)
    doc.guardar(salida)
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# MANUAL DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════
def manual(pid, ext, salida, paginas=None):
    D = json.load(open(os.path.join(ext, 'datos.json'), encoding='utf-8'))
    M = rellenar_todo(cargar_contenido(pid).MANUAL, Relleno(D))
    D = limpiar_textos(D)
    img = lambda n: os.path.join(ext, 'img', n)  # noqa: E731
    existe = lambda n: os.path.exists(img(n))  # noqa: E731
    doc = Documento(os.path.join(AQUI, 'plantillas', 'manual.docx'), 'manual')
    tabs = D['tabs']
    nombre_tab = {t['id']: t['nombre'] for t in tabs}
    nombre_tab.update({'datos': 'Datos', 'conexion': 'Conexión'})
    carpeta = CARPETAS[pid]

    # ── Portada ───────────────────────────────────────────────────────────
    doc.parrafo('MANUAL DE USUARIO', ppr(antes=1100, jc='center'), negrita=True, tam=20, color='1C6E95')
    doc.parrafo('Simulador hídrico 3D', ppr(antes=240, despues=120, jc='center'), negrita=True, tam=28)
    doc.parrafo(M['portada'], ppr(despues=500, jc='center'), tam=14, color='555555')
    p = doc.parrafo('', ppr(jc='center'))
    p.append(doc._imagen_run(img('pantalla.png'), doc._limitar_alto(img('pantalla.png'), 15, 9.0)))
    doc.parrafo('Guía de uso, escenarios de práctica, pruebas y conexión con la serie de simuladores hídricos 3D', ppr(antes=500, jc='center'), tam=12)
    doc.parrafo(AUTORES[0], ppr(antes=500, despues=0, jc='center'), tam=12)
    doc.parrafo(AUTORES[1], ppr(despues=240, jc='center'), tam=12)
    doc.parrafo('Institución Universitaria de Santa Marta (USM)', ppr(despues=0, jc='center'), tam=11)
    doc.parrafo('Programa de Ingeniería del Agua y Desarrollo Sostenible · Facultad de Ingeniería', ppr(despues=0, jc='center'), tam=11)
    doc.parrafo('Santa Marta, 2026', ppr(antes=240, jc='center'), tam=11)
    doc.parrafo('Contenido', ppr(salto=True, despues=200), negrita=True, tam=16, color='1C6E95')
    doc.parrafo('Si el índice aparece vacío o con números desactualizados, haz clic derecho sobre él en Word y elige «Actualizar campos» → «Actualizar toda la tabla».', cursiva=True)
    doc.indice(paginas, niveles=2)

    n_tabs = len(tabs)
    cap_tab0 = 6
    cap_datos = cap_tab0 + n_tabs
    caps = {'datos': cap_datos, 'conexion': cap_datos + 1, 'revision': cap_datos + 2, 'escenarios': cap_datos + 3,
            'pruebas': cap_datos + 4, 'problemas': cap_datos + 5, 'glosario': cap_datos + 6}

    # ── 1. Qué es ─────────────────────────────────────────────────────────
    doc.titulo(1, '1. Qué es el simulador')
    for t in M['que_es']:
        doc.texto(t)
    doc.titulo(2, '1.1 Para qué sirve')
    doc.vinetas(M['para_que'])
    doc.titulo(2, '1.2 Qué representa la escena')
    filas = [[e['titulo'], M['componentes'].get(e['id'], ''), nombre_tab.get(e['tab'], '—') if e['tab'] else '—'] for e in D['etiquetas']]
    doc.tabla(['Componente', 'Qué es', 'Pestaña'], filas, [2.4, 5.2, 1.7])
    doc.titulo(2, '1.3 Cómo está organizado este manual')
    doc.texto(f'Los capítulos 2 a 5 explican cómo abrir el simulador, moverse por la pantalla y por la escena y usar los controles. Los capítulos {cap_tab0} a {cap_datos - 1} recorren las pestañas una por una: qué representa cada una, sus controles con su rango y su valor de base, sus resultados, la revisión del diseño, las ecuaciones y las gráficas. El capítulo {caps["datos"]} explica cómo guardar la simulación en Excel y el {caps["conexion"]}, cómo se conecta con los demás simuladores de la serie. Después vienen la revisión de todos los criterios de diseño, los escenarios guiados, las pruebas automáticas, la solución de problemas, un glosario y dos anexos con los valores del escenario base y las ecuaciones de cada pestaña.')
    doc.caja('Importante.', M['base'])

    # ── 2. Requisitos y acceso ────────────────────────────────────────────
    doc.titulo(1, '2. Requisitos y acceso')
    doc.titulo(2, '2.1 Qué se necesita')
    doc.tabla(['Elemento', 'Requisito'], [
        ['Navegador', 'Chrome, Edge, Firefox o Safari recientes, con WebGL activo (la escena 3D). Sin WebGL los cálculos, las tablas y las gráficas siguen funcionando.'],
        ['Equipo', 'Computador o celular. En el celular el panel queda debajo de la escena.'],
        ['Servidor local', 'Python 3 (python -m http.server) o cualquier servidor de archivos estáticos.'],
        ['Conexión a internet', 'Solo para las fuentes tipográficas; Three.js y Chart.js vienen en la carpeta lib.'],
        ['Pruebas (opcional)', 'Node.js 18 o más reciente (npm test).'],
    ], [1.5, 6])
    doc.titulo(2, '2.2 Abrir el simulador')
    doc.texto('Los módulos de JavaScript no funcionan si se abre index.html con doble clic: hay que servir la carpeta con un servidor local. Desde la carpeta que contiene los proyectos de la serie se ejecuta:')
    doc.parrafo('python -m http.server 8000', ppr(izquierda=567, despues=120), tam=10)
    doc.texto(f'y se abre http://localhost:8000 en el navegador: aparece el portal de la serie, con una tarjeta por simulador. La tarjeta «{NOMBRE_PROYECTO[pid]}» abre este simulador (carpeta «{carpeta}»). También se puede servir solo la carpeta del proyecto' + (', pero entonces el sistema conectado no encuentra a los demás proyectos y usa sus fronteras de referencia.' if pid == 'sistema' else '; en ese caso la conexión en vivo con los demás simuladores no está disponible y se usan los archivos de frontera.'))
    doc.texto('Mientras prepara la escena, la barra superior dice «Calculando…»; al terminar aparecen los indicadores y el reloj empieza a correr.')
    doc.titulo(2, '2.3 Estructura de carpetas')
    doc.tabla(['Archivo o carpeta', 'Contenido'], estructura_readme(pid), [2.6, 5])

    # ── 3. Pantalla principal ─────────────────────────────────────────────
    doc.titulo(1, '3. La pantalla principal')
    doc.texto('La pantalla tiene tres partes: arriba la barra con los indicadores de estado y el reloj simulado; a la izquierda la escena 3D con sus etiquetas, los botones de vista y la leyenda; a la derecha el panel con las pestañas.')
    doc.figura(img('pantalla.png'), 'Pantalla principal del simulador en el escenario base',
               f'Arriba, la barra con los {len(D["estados"])} indicadores y el reloj ({D["reloj0"]}). A la izquierda, la escena 3D con las vistas {", ".join(v["nombre"] for v in D["vistas"])}. A la derecha, el panel con la pestaña {tabs[0]["nombre"]} abierta.')
    doc.titulo(2, '3.1 Barra superior')
    if existe('barra.png'):
        doc.figura(img('barra.png'), 'Barra superior en el escenario base', 'Cada indicador tiene un punto de color con su estado.')
    doc.tabla(['Indicador', 'En el escenario base'], [[e['nombre'], e['texto']] for e in D['estados']], [1.6, 6])
    doc.tabla(['Color', 'Significado'], [['Verde', 'Se cumple el criterio o el valor está en el rango normal.'], ['Amarillo', 'Aviso: conviene revisar, pero no es una falla grave.'],
                                         ['Rojo', 'Alerta: un criterio de diseño no se cumple.']], [1.2, 6])
    doc.titulo(2, '3.2 El reloj simulado')
    vel = ', '.join(v['nombre'] for v in D['reloj']['velocidades'])
    doc.texto(f'El reloj avanza el tiempo del modelo. Las velocidades disponibles son: {vel}. «Pausar» detiene el tiempo y «Reiniciar» vuelve al escenario base. Mientras el reloj corre, los resultados de la pestaña abierta y la escena cambian con el tiempo.')
    doc.titulo(2, '3.3 El panel de controles')
    doc.texto(f'El panel tiene {n_tabs + 2} pestañas, en dos filas: {", ".join(t["nombre"] for t in tabs)}, Datos y Conexión. Cada pestaña de cálculo tiene la misma estructura: una introducción, los controles, los resultados, la revisión del diseño (con ✓, ! o ✗), las tablas, el modelo matemático con los valores sustituidos y una o dos gráficas con el punto del momento. Una pestaña con un criterio que no se cumple muestra un punto rojo junto a su nombre.')
    doc.titulo(2, '3.4 Vista en celular')
    doc.figura(img('movil.png'), 'El simulador en un celular', 'La escena queda arriba y el panel debajo; los botones de vista y las pestañas se adaptan al ancho de la pantalla.', ancho_cm=6.5)

    # ── 4. Escena 3D ──────────────────────────────────────────────────────
    doc.titulo(1, '4. Moverse por la escena 3D')
    doc.titulo(2, '4.1 Controles de la cámara')
    doc.tabla(['Acción', 'Con ratón', 'En pantalla táctil'], [
        ['Girar la vista', 'Arrastrar con el botón izquierdo', 'Arrastrar con un dedo'], ['Acercar o alejar', 'Rueda', 'Pellizcar con dos dedos'],
        ['Desplazar', 'Arrastrar con el botón derecho', 'Arrastrar con dos dedos'], ['Abrir la pestaña de un componente', 'Clic sobre el componente o su etiqueta', 'Tocar el componente o su etiqueta'],
        ['Ir a una vista', 'Botones de arriba de la escena', 'Botones de arriba de la escena'],
    ], [2.2, 2.6, 2.6])
    doc.titulo(2, '4.2 Etiquetas y leyenda')
    doc.texto('Las etiquetas muestran el valor del momento de cada componente; su borde se pone amarillo o rojo cuando algo no cumple. Al tocar una etiqueta se abre la pestaña de ese componente. La leyenda de abajo explica los colores de los flujos.')
    doc.caja('Escala.', 'La escena es esquemática: distancias, alturas, profundidades y anchos están fuera de escala para que todo se vea. Los números del panel son los del modelo.')
    doc.titulo(2, f'4.3 Las {len(D["vistas"])} vistas')
    inv = {}
    for t, v in D['pestanaVista'].items():
        inv.setdefault(v, []).append(nombre_tab.get(t, t))
    doc.tabla(['Vista', 'Qué muestra', 'Se abre también con'], [[v['nombre'], v['titulo'], ', '.join(inv.get(v['id'], [])) or '—'] for v in D['vistas']], [1.4, 4, 2.6])
    vs = [v for v in D['vistas'] if existe(f'vista_{v["id"]}.png')]
    for k in range(0, len(vs), 2):
        par = vs[k:k + 2]
        letras = 'ab'
        doc.figura_par([(img(f'vista_{v["id"]}.png'), f'({letras[j]}) {v["nombre"]}') for j, v in enumerate(par)],
                       'Vistas de la escena: ' + ' y '.join(v['nombre'] for v in par), ' '.join(f'({letras[j]}) {v["titulo"]}.' for j, v in enumerate(par)))
    doc.titulo(2, '4.4 Qué se mueve en la escena')
    doc.vinetas(M['se_mueve'])

    # ── 5. Controles ──────────────────────────────────────────────────────
    doc.titulo(1, '5. Cómo se usan los controles')
    doc.titulo(2, '5.1 Deslizadores')
    doc.texto('Cada deslizador tiene a su derecha una caja con el valor y la unidad. Se puede arrastrar el deslizador o escribir el valor en la caja (con punto o coma decimal) y pulsar Enter; si el valor está fuera del rango, se lleva al límite más cercano. Algunos controles muestran debajo un texto con lo que significa el valor elegido.')
    doc.titulo(2, '5.2 Listas, casillas y escenarios')
    doc.texto('Las listas eligen una opción (el clima del año, un tipo de obra, un escenario); las casillas encienden o apagan algo. La lista «Escenario» de la primera pestaña pone a la vez todos los valores de un caso de estudio; después se puede seguir moviendo cualquier control.')
    doc.titulo(2, '5.3 Cómo leer el bloque «Modelo matemático»')
    doc.texto('Cada pestaña termina con su modelo matemático: en color, el tipo de función (lineal, cuadrática, raíz, potencia, racional, exponencial, logarítmica, periódica o por tramos); debajo, la forma general de la ecuación y la misma ecuación con los valores del momento sustituidos, de modo que se puede repetir la cuenta con una calculadora. Las notas en gris explican qué significa el resultado.')

    # ── Pestañas ──────────────────────────────────────────────────────────
    for k, t in enumerate(tabs):
        cap = cap_tab0 + k
        dt = t['datos']
        doc.titulo(1, f'{cap}. Pestaña {t["nombre"]}')
        doc.texto(t['intro'])
        for extra in M.get('tabs', {}).get(t['id'], []):
            doc.texto(extra)
        sec = 1
        if existe(f'{t["id"]}_figura.png'):
            doc.figura(img(f'{t["id"]}_figura.png'), f'Esquema de la pestaña {t["nombre"]}', dt.get('figuraPie', ''), ancho_cm=13)
        ctrls = [c for c in dt['controles'] if c['tipo'] != 'accion']
        if ctrls:
            doc.titulo(2, f'{cap}.{sec} Controles'); sec += 1
            filas = []
            for c in ctrls:
                rango = f"{num(c['min'], c['dec'])} a {num(c['max'], c['dec'])}" if c['tipo'] == 'rango' and c['min'] is not None else (f"{c['nOpciones']} opciones" if c['tipo'] == 'opciones' else ('sí / no' if c['tipo'] == 'casilla' else '—'))
                unidad = '' if c['unidad'] in ('lista', 'casilla') else c['unidad']
                filas.append([c['etiqueta'], unidad, rango, c['texto'], c['doc'] or (', '.join(c['opciones'][:6]) + ('…' if c['opciones'] and len(c['opciones']) > 6 else '') if c['opciones'] else '')])
            doc.tabla(['Control', 'Unidad', 'Rango', 'Base', 'Qué cambia'], filas, [2.6, 0.9, 1.4, 1.3, 3.4])
            if existe(f'{t["id"]}_controles.png') and existe(f'{t["id"]}_metricas.png'):
                doc.figura_par([(img(f'{t["id"]}_controles.png'), '(a) Controles'), (img(f'{t["id"]}_metricas.png'), '(b) Resultados')],
                               f'Controles y resultados de la pestaña {t["nombre"]}', 'Escenario base.')
        doc.titulo(2, f'{cap}.{sec} Resultados'); sec += 1
        filas = []
        grupo = ''
        for m in dt['metricas']:
            if m.get('titulo'):
                grupo = m['grupo']
                continue
            filas.append([m['etiqueta'] + (f' ({grupo})' if grupo and False else ''), f"{m['texto']} {m['unidad']}".strip(), m['doc'] or ''])
        doc.tabla(['Resultado', 'Escenario base', 'Nota'], filas, [3.6, 1.6, 3.3])
        if dt['revision']:
            ok = sum(1 for c in dt['revision'] if c['nivel'] == 'ok')
            doc.texto(f'La revisión del diseño tiene {len(dt["revision"])} criterio{"s" if len(dt["revision"]) != 1 else ""}; en el escenario base se cumple{"n" if ok != 1 else ""} {ok}:')
            doc.tabla(['Criterio', 'Escenario base', 'Si no se cumple'], [[c['texto'], c['detalle'], c['corregir'] or '—'] for c in dt['revision']], [3.4, 1.8, 3.3])
        piezas = [(img(f'{t["id"]}_{n}.png'), r) for n, r in (('revision', '(b) Revisión del diseño'), ('tablas', '(b) Tablas')) if existe(f'{t["id"]}_{n}.png')]
        partes = partir_alta(img(f'{t["id"]}_tablas.png'), 1.35) if existe(f'{t["id"]}_tablas.png') else []
        if len(partes) > 1:
            # Tablas muy largas: la revisión sola y las tablas en partes, de dos en dos
            if existe(f'{t["id"]}_revision.png'):
                doc.figura(img(f'{t["id"]}_revision.png'), f'Revisión del diseño de la pestaña {t["nombre"]}', 'Escenario base.', ancho_cm=8.5)
            for j in range(0, len(partes), 2):
                par = partes[j:j + 2]
                titulo_t = f'Tablas de la pestaña {t["nombre"]}' + (' (continuación)' if j else '')
                nota_t = 'Escenario base. Las tablas siguen de una parte a la siguiente.' if j + 2 < len(partes) else 'Escenario base.'
                if len(par) == 1:
                    doc.figura(par[0], titulo_t + f' (parte {j + 1} de {len(partes)})', nota_t, ancho_cm=8.5)
                else:
                    doc.figura_par([(r, f'({"ab"[q]}) Parte {j + q + 1} de {len(partes)}') for q, r in enumerate(par)], titulo_t, nota_t)
            piezas = []
        ancha = len(piezas) == 2 and ancho_px(piezas[1][0]) > 640
        if len(piezas) == 1 or ancha:
            for ruta, rot in piezas:
                es_tabla = ruta.endswith('_tablas.png')
                doc.figura(ruta, f'{rot[4:]} de la pestaña {t["nombre"]}', 'Escenario base.',
                           ancho_cm=min(15.5, 8.5 * ancho_px(ruta) / 584) if es_tabla else 8.5)
        elif piezas:
            pz = [(r, f'({"ab"[j]}) {x[1][4:]}') for j, (r, x) in enumerate(zip([q[0] for q in piezas[:2]], piezas[:2]))]
            doc.figura_par(pz, f'Revisión del diseño y tablas de la pestaña {t["nombre"]}', 'Escenario base.')
        doc.titulo(2, f'{cap}.{sec} Ecuaciones y gráficas')
        for clase, texto in bloques_ecuacion(dt['ecuacionHTML']):
            if clase == 'tipo':
                parrafo_html(doc, texto, ppr(antes=120, despues=40, mantener=True), negrita=True, color='1C6E95')
            elif clase in ('formula', 'sustitucion'):
                parrafo_html(doc, texto, ppr(izquierda=360, despues=40, jc='left'), tam=10.5)
            else:
                parrafo_html(doc, texto, ppr(izquierda=360, despues=80, jc='both'), cursiva=True, tam=10)
        gs = [g for g in range(len(t['graficas'])) if existe(f'{t["id"]}_g{g}.png')]
        if len(gs) >= 2:
            doc.figura_par([(img(f'{t["id"]}_g{g}.png'), f'({"ab"[j]}) {t["graficas"][g]["yTitulo"]}') for j, g in enumerate(gs[:2])],
                           f'Gráficas de la pestaña {t["nombre"]}', ' '.join(f'({"ab"[j]}) {t["graficas"][g]["pie"]}' for j, g in enumerate(gs[:2])))
        elif gs:
            g = gs[0]
            doc.figura(img(f'{t["id"]}_g{g}.png'), f'Gráfica de la pestaña {t["nombre"]}', t['graficas'][g]['pie'], ancho_cm=11)

    # ── Datos ─────────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["datos"]}. Pestaña Datos: guardar la simulación en Excel')
    doc.texto('«Descargar Excel (.xlsx)» crea un libro con los parámetros y resultados de todas las pestañas, la serie de tiempo que se registra mientras corre el reloj, la revisión del diseño, las hojas propias del simulador (con fórmulas de Excel que se recalculan) y la frontera de conexión. «Guardar escenario» copia el momento actual; cada escenario guardado es una columna de la hoja «Parámetros y resultados».')
    hojas = [['Resumen', 'Proyecto, fecha, reloj e indicadores de estado.'], ['Parámetros y resultados', 'Todos los controles y resultados de todas las pestañas (y los escenarios guardados).'],
             ['Serie de tiempo', f'Una fila por intervalo ({", ".join(D["intervalos"])}): ' + ', '.join(c['nombre'] for c in D['serie']) + '.'],
             ['Revisión del diseño', f'Los {len(D["revision"])} criterios con su estado y su detalle.']]
    hojas += [[h['nombre'], h['descripcion']] for h in D['hojas']]
    hojas.append(['Conexión', 'La frontera de salida del simulador (lo que entrega a sus vecinos).'])
    doc.tabla(['Hoja', 'Contenido'], hojas, [2, 6])
    if existe('datos.png'):
        doc.figura(img('datos.png'), 'Pestaña Datos', 'El registro guarda una fila por intervalo mientras corre el reloj.', ancho_cm=8)

    # ── Conexión ──────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["conexion"]}. Pestaña Conexión: la serie de simuladores')
    doc.texto(M.get('conexion', 'Este simulador es un eslabón de la serie que sigue el agua del páramo al océano. Entrega a sus vecinos su frontera de salida y aplica lo que le llega de aguas arriba o del mar. Se conecta de tres formas: con un archivo de frontera (.json), en vivo con otro simulador abierto en el mismo navegador, o con el proyecto Sistema conectado, que une todos los modelos.'))
    fr = D['frontera'] or {}
    filas = [[MAGNITUDES.get(k, (k, ''))[0], f"{num(v, 3 if abs(v) < 10 else 1)} {MAGNITUDES.get(k, ('', ''))[1]}"] for k, v in (fr.get('salida') or {}).items()]
    filas += [[MAGNITUDES.get(k, (k, ''))[0] + ' (mar)', f"{num(v, 3 if abs(v) < 10 else 1)} {MAGNITUDES.get(k, ('', ''))[1]}"] for k, v in (fr.get('mar') or {}).items()]
    if filas:
        doc.texto('Lo que entrega en el escenario base (frontera de salida):')
        doc.tabla(['Magnitud', 'Valor'], filas, [4, 2])
    if D['entradas']:
        doc.texto('Lo que recibe: ' + D['textoEntrada'])
        doc.tabla(['Recibe de', 'Parámetros que cambia'], [[NOMBRE_PROYECTO.get(e['origen'], e['origen']), ', '.join(e['claves'])] for e in D['entradas']], [2, 5])
    doc.texto('Para conectar en vivo: se sirve la carpeta de la serie, se abren los dos simuladores en el mismo navegador, en el de aguas arriba se deja marcada «Publicar la frontera de salida» y en el de aguas abajo se marca «Aplicar en vivo». Sin servidor común se usa «Exportar frontera» en uno e «Importar frontera» en el otro; «Quitar la frontera recibida» vuelve a los valores de referencia.')
    if existe('conexion.png'):
        partes = partir_alta(img('conexion.png'))
        if len(partes) == 2:
            doc.figura_par([(partes[0], '(a) Parte de arriba'), (partes[1], '(b) Parte de abajo')], 'Pestaña Conexión',
                           '(a) La red de la serie y lo que entrega el simulador. (b) Lo que recibe y el enlace en vivo.')
        else:
            doc.figura(img('conexion.png'), 'Pestaña Conexión', 'La red de la serie, la frontera de salida, la de entrada y el enlace en vivo.', ancho_cm=8)

    # ── Revisión ──────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["revision"]}. Revisión de los criterios de diseño')
    ok = sum(1 for c in D['revision'] if c['nivel'] == 'ok')
    doc.texto(f'El simulador revisa {len(D["revision"])} criterios. Con ✓ se cumplen, con ! son avisos y con ✗ no se cumplen. En el escenario base se cumplen {ok}. Los valores de referencia de los criterios son editables en el código y deben contrastarse con las normas y las fuentes que cita el informe.')
    doc.tabla(['Pestaña', 'Criterio', 'Escenario base'], [[c['pestana'], c['texto'], c['detalle']] for c in D['revision']], [1.3, 4.2, 2.6])

    # ── Escenarios ────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["escenarios"]}. Escenarios guiados')
    doc.texto('La lista «Escenario» pone a la vez los valores de un caso de estudio. Cada fila de la tabla dice cuántos criterios se cumplen y cuáles fallan; las figuras muestran la escena con algunos de ellos.')
    doc.tabla(['Escenario', 'Criterios que se cumplen', 'Lo que no se cumple'], [[e['nombre'], f"{e['total'] - len(e['fallas'])} de {e['total']}", '; '.join(e['fallas']) or 'Todos se cumplen'] for e in D['escenarios']], [2.4, 1.2, 4.6])
    for e in D['escenarios']:
        if e['id'] in M.get('guias', {}):
            doc.titulo(2, e['nombre'])
            doc.texto(M['guias'][e['id']])
            doc.tabla(['Indicador', 'Valor'], [[x['nombre'], x['texto']] for x in e['estados']], [1.8, 5])
            if existe(f'esc_{e["id"]}.png'):
                doc.figura(img(f'esc_{e["id"]}.png'), f'Escenario «{e["nombre"]}»', M.get('notas_guias', {}).get(e['id'], ''))

    # ── Pruebas ───────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["pruebas"]}. Pruebas automáticas')
    lista = pruebas(pid)
    doc.texto(f'Las pruebas revisan el modelo con valores calculados a mano, el sistema completo y el libro de Excel. Se corren desde la carpeta del proyecto con npm test (Node.js 18 o más reciente); son {len(lista)}:')
    doc.tabla(['Archivo', 'Prueba'], [[a, b] for a, b in lista], [1.6, 6])

    # ── Problemas ─────────────────────────────────────────────────────────
    doc.titulo(1, f'{caps["problemas"]}. Solución de problemas')
    filas = [
        ['La página queda en blanco o dice «Calculando…»', 'Se abrió index.html con doble clic. Hay que servir la carpeta (python -m http.server 8000) y abrir http://localhost:8000.'],
        ['No se ve la escena 3D', 'El navegador no tiene WebGL activo. Los cálculos, las tablas y las gráficas siguen funcionando en el panel.'],
        ['Las gráficas no aparecen', 'Falta lib/chart.umd.js o el navegador lo bloqueó; volver a copiar la carpeta completa.'],
        ['El Excel no se descarga', 'El navegador bloqueó la descarga; permitir las descargas del sitio local.'],
        ['El enlace en vivo no encuentra a los demás simuladores', 'Los simuladores deben abrirse desde el mismo servidor (mismo origen) y en el mismo navegador.'],
        ['Un resultado se ve raro después de mover muchos controles', 'Pulsar Reiniciar para volver al escenario base.'],
    ]
    if pid == 'sistema':
        filas.insert(0, ['La revisión dice que faltan proyectos', 'Las carpetas de la serie deben estar juntas y servirse desde la carpeta que las contiene.'])
    doc.tabla(['Problema', 'Qué hacer'], filas, [3, 5])

    # ── Glosario y anexos ─────────────────────────────────────────────────
    doc.titulo(1, f'{caps["glosario"]}. Glosario')
    doc.tabla(['Término', 'Significado'], M['glosario'], [1.8, 6])
    doc.titulo(1, 'Anexo A. Valores del escenario base')
    filas = []
    for t in tabs:
        for c in t['datos']['controles']:
            if c['tipo'] != 'accion':
                filas.append([t['nombre'], c['etiqueta'], f"{c['texto']} {'' if c['unidad'] in ('lista', 'casilla') else c['unidad']}".strip()])
    doc.tabla(['Pestaña', 'Parámetro', 'Valor'], filas, [1.5, 4.5, 2])
    doc.titulo(1, 'Anexo B. Ecuaciones por pestaña')
    for t in tabs:
        doc.titulo(2, t['nombre'])
        for clase, texto in bloques_ecuacion(t['datos']['ecuacionHTML']):
            if clase == 'tipo':
                parrafo_html(doc, texto, ppr(antes=80, despues=20, mantener=True), negrita=True, tam=10, color='1C6E95')
            elif clase in ('formula', 'sustitucion'):
                parrafo_html(doc, texto, ppr(izquierda=360, despues=20, jc='left'), tam=10)
    doc.guardar(salida)
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# Índice con números de página (segunda pasada con LibreOffice)
# ═══════════════════════════════════════════════════════════════════════════
def paginas_de(docx_ruta, titulos):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, docx_ruta], check=True, capture_output=True)
        pdf = os.path.join(tmp, os.path.splitext(os.path.basename(docx_ruta))[0] + '.pdf')
        n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
        txt = []
        for i in range(1, n + 1):
            t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout
            txt.append(re.sub(r'\s+', ' ', t))
    norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[*_{}^]', '', s)).strip()  # noqa: E731
    # Las páginas del índice tienen muchas líneas con puntos guía: la búsqueda empieza después de ellas
    toc = [i for i, t in enumerate(txt[:10]) if len(re.findall(r'\.{6,}', t)) >= 5]
    if toc:
        inicio = max(toc) + 1
    else:
        ultimo = norm(titulos[-1][1])
        inicio = next((i for i, t in enumerate(txt) if norm(titulos[0][1]) in t and ultimo not in t), 0)
    paginas, k = {}, inicio
    for _, t, _ in titulos:
        nt = norm(t)
        j = k
        while j < len(txt) and nt not in txt[j]:
            j += 1
        if j < len(txt):
            paginas[t] = j + 1
            k = j
    return paginas, n


if __name__ == '__main__':
    pid, ext, salida = sys.argv[1:4]
    os.makedirs(salida, exist_ok=True)
    nombre = {'sistema': 'Sistema_Conectado'}.get(pid, NOMBRE_PROYECTO[pid].replace(' ', '_').replace('é', 'e').replace('á', 'a').replace('í', 'i').replace('ó', 'o'))
    rutas = {'informe': os.path.join(salida, f'Informe_Simulador_Hidrico_3D_{nombre}.docx'), 'manual': os.path.join(salida, f'Manual_Simulador_Hidrico_3D_{nombre}.docx')}
    for tipo, fn in (('informe', informe), ('manual', manual)):
        d = fn(pid, ext, rutas[tipo])
        if '--paginas' in sys.argv:
            pags, n = paginas_de(rutas[tipo], d.titulos)
            fn(pid, ext, rutas[tipo], pags)
            print(f'{tipo}: {n} páginas, {len(pags)}/{len(d.titulos)} títulos con página')
        else:
            print(f'{tipo}: listo')
