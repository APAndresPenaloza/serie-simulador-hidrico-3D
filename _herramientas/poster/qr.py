# qr.py — Códigos QR del póster (los simuladores y la página de la serie), en PNG grandes y nítidos.
import os
from urllib.parse import quote
import segno
AQUI = os.path.dirname(os.path.abspath(__file__))
SITIO = 'https://apandrespenaloza.github.io/serie-simulador-hidrico-3D/'
SIMS = {'lagunas': 'Lagunas', 'lagos': 'Lagos', 'rios': 'Rios exorreicos', 'cienagas': 'Cienagas', 'deltas': 'Deltas',
        'costas': 'Costas', 'oceanos': 'Oceanos', 'sistema': 'Sistema conectado'}
os.makedirs(os.path.join(AQUI, 'imagenes'), exist_ok=True)
urls = {'serie': SITIO, **{k: SITIO + quote(f'simulador-hidrico-3D - {v}') + '/' for k, v in SIMS.items()}}
for k, url in urls.items():
    q = segno.make(url, error='q')
    n = q.symbol_size(scale=1, border=2)[0]
    q.save(os.path.join(AQUI, 'imagenes', f'qr_{k}.png'), scale=max(8, 1200 // n), border=2, dark='#0E2D40', light='#FFFFFF')
    print(k, q.designator, url)
