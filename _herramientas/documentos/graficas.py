"""graficas.py — Vuelve a dibujar con matplotlib (letra con serifas, paneles (a), (b), (c)) las
gráficas del simulador, con las mismas series que extrajo extraer.cjs."""
import re

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

plt.rcParams.update({
    # Lista de familias: matplotlib busca en la siguiente los signos que no tenga la primera
    # (por ejemplo, los superíndices ⁺ y ⁻ que Liberation Serif no trae)
    'font.family': ['Liberation Serif', 'DejaVu Serif'],
    'font.size': 8.5,
    'axes.titlesize': 9,
    'axes.labelsize': 8.5,
    'legend.fontsize': 7,
    'xtick.labelsize': 7.5,
    'ytick.labelsize': 7.5,
    'axes.linewidth': 0.6,
    'lines.linewidth': 1.3,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'mathtext.fontset': 'dejavuserif',
})


def _color(c):
    if not c:
        return '#333333'
    c = c.strip()
    m = re.match(r'rgba?\(([^)]+)\)', c)
    if m:
        v = [float(x) for x in m.group(1).split(',')]
        return tuple(x / 255 for x in v[:3])
    if re.match(r'^#[0-9a-fA-F]{8}$', c):
        return c[:7]
    return c


def _mt(s):
    """'k_d' → k con subíndice d (mathtext) en títulos de ejes y leyendas."""
    if not s or '$' in s:
        return s
    s = s.replace('∝', r'$\propto$')
    return re.sub(r'(?<![A-Za-z])([A-Za-z])_([A-Za-z0-9]{1,4})(?![A-Za-z0-9])', r'$\1_{\2}$', s)


def _es_texto(etiquetas):
    return any(re.search(r'[A-Za-zÁÉÍÓÚáéíóúñÑ]', e or '') for e in etiquetas)


def dibujar(graficas, ruta, ancho_cm=16.0, alto_cm=6.2):
    n = len(graficas)
    fig, axs = plt.subplots(1, n, figsize=(ancho_cm / 2.54, alto_cm / 2.54))
    if n == 1:
        axs = [axs]
    for k, (ax, g) in enumerate(zip(axs, graficas)):
        for s in g['series']:
            pts = [(x, y) for x, y in s['datos'] if x is not None and y is not None]
            if not pts:
                continue
            xs, ys = zip(*pts)
            if g.get('logY'):
                xs, ys = zip(*[(x, y) for x, y in zip(xs, ys) if y > 0]) if any(y > 0 for y in ys) else ((), ())
                if not xs:
                    continue
            col = _color(s['color'])
            etiqueta = None if s.get('sinLeyenda') or not s.get('etiqueta') else _mt(s['etiqueta'])
            if s.get('linea', True) and len(xs) == 2 and xs[0] == xs[1] and not g.get('logY'):
                # Segmento vertical (una barra de la gráfica del simulador): se dibuja como barra
                ax.bar(xs[0], ys[1] - ys[0], bottom=ys[0], width=0.45, color=col, label=etiqueta, zorder=2)
                continue
            if s.get('linea', True):
                ancho = min(6.0, max(0.8, 0.65 * (s.get('ancho') or 2)))
                ax.plot(xs, ys, color=col, lw=ancho, ls='--' if s.get('punteada') else '-',
                        drawstyle='steps-pre' if s.get('escalon') else 'default', label=etiqueta,
                        solid_capstyle='butt')
                if (s.get('radio') or 0) > 0:
                    ax.plot(xs, ys, 'o', color=col, ms=0.7 * s['radio'])
            else:
                ax.plot(xs, ys, 'o', color=col, ms=max(2.5, 0.75 * (s.get('radio') or 4)), label=etiqueta)
        if g.get('logY'):
            ax.set_yscale('log')
        if g.get('xMin') is not None or g.get('xMax') is not None:
            ax.set_xlim(g.get('xMin'), g.get('xMax'))
        if g.get('yMin') is not None or g.get('yMax') is not None:
            ax.set_ylim(g.get('yMin'), g.get('yMax'))
        marcas = g.get('marcasX') or []
        if marcas and _es_texto([m['l'] for m in marcas]):
            ax.set_xticks([m['v'] for m in marcas])
            ax.set_xticklabels([m['l'] for m in marcas], rotation=0)
            if len(marcas) > 8:
                for lab in ax.get_xticklabels():
                    lab.set_fontsize(6.5)
        ax.set_xlabel(_mt(g.get('xTitulo') or ''))
        ax.set_ylabel(_mt(g.get('yTitulo') or ''))
        ax.grid(True, lw=0.3, color='#cccccc')
        if n > 1:
            ax.text(-0.02, 1.06, f'({chr(97 + k)})', transform=ax.transAxes, va='bottom', ha='left', fontsize=9, fontweight='bold')
        if ax.get_legend_handles_labels()[0]:
            ax.legend(frameon=False, loc='best', handlelength=1.8)
    fig.tight_layout(w_pad=1.6)
    fig.savefig(ruta, dpi=230)
    plt.close(fig)
    return ruta
