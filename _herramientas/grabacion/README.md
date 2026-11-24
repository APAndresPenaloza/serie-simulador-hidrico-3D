# Recorridos en video y GIF de la serie

Graba, para cada simulador, el recorrido «Cómo usar el simulador» (cerca de un minuto): una portada, nueve
pasos con subtítulos, el cursor, los clics y un marco sobre lo que se explica. El recorrido gira la escena,
cambia de vista, mueve controles, muestra la revisión del diseño, arma el informe con código QR (pestaña
Informe) y termina en Datos y Conexión.

Cada video se graba cuadro por cuadro con un reloj falso de Playwright: el simulador avanza exactamente
1/24 de segundo entre cuadros, así que el video sale igual aunque la máquina sea lenta o no tenga GPU.

## Requisitos

- Node.js 18+ con Playwright y su Chromium.
- ffmpeg (libx264 y el filtro de paleta para el GIF).

## Uso

1. Servir la carpeta de la serie (la que contiene todos los proyectos):

   ```
   python -m http.server 8765
   ```

2. Grabar uno o todos:

   ```
   node grabar.cjs lagunas                 # uno (ids: lagunas lagos rios cienagas deltas costas oceanos sistema)
   bash grabar_todos.sh http://localhost:8765/
   ```

   Opciones de `grabar.cjs`: `--base URL`, `--salida carpeta`, `--previa` (cuadros pequeños, uno de cada
   cuatro, para revisar el guion rápido) y `--verificar` (sin cuadros: corre las acciones e imprime el texto
   de cada paso para revisar las cifras). Sin GPU tarda de 7 a 16 minutos por simulador.

3. Cada grabación deja en `salida/<medio>/` el MP4 (1280 × 720, 24 cuadros/s), el GIF (960 × 540) y la
   portada (JPG). Se copian a la raíz de la serie:

   ```
   cp salida/01_Lagunas/01_Lagunas.mp4 ../../VIDEOS/
   cp salida/01_Lagunas/01_Lagunas.gif ../../GIF/
   cp salida/01_Lagunas/01_Lagunas.jpg ../../VIDEOS/portadas/
   ```

   y se actualiza la portada de la serie con `python3 _herramientas/portada/armar_portada.py` (desde la raíz).

## Archivos

| Archivo | Qué hace |
|---|---|
| `grabar.cjs` | Abre el simulador, pone la capa del recorrido, corre el guion cuadro por cuadro y arma MP4, GIF y portada |
| `guiones.cjs` | Los ocho guiones: pasos, subtítulos y acciones (girar, clic, mover un control, elegir una opción, marco, informe) |
| `grabar_todos.sh` | Graba los ocho uno tras otro (la variable `IDS` permite elegir cuáles) |

## Para tener en cuenta

- Los subtítulos dicen cifras del simulador (por ejemplo, «24 m³/s» o «más de 10 000 coliformes»): si cambia
  un modelo, conviene correr `--verificar` y ajustar el texto del guion.
- El GIF de Ríos y el de Costas usan menos colores y cuadros por segundo para no pasar de 25 MB.
- `salida/` no se sube al repositorio.
