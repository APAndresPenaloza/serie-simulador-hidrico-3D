#!/usr/bin/env bash
# Graba los ocho recorridos uno tras otro (cada uno deja su MP4, su GIF y su portada en salida/<medio>/).
# Uso: bash grabar_todos.sh [base]   (con la serie servida en base, p. ej. http://localhost:8765/)
cd "$(dirname "$0")"
BASE="${1:-http://localhost:8765/}"
for id in ${IDS:-lagunas lagos rios cienagas deltas costas oceanos sistema}; do
  echo "=== $id · $(date +%H:%M:%S)"
  node grabar.cjs "$id" --base "$BASE" || echo "FALLÓ: $id"
done
echo "=== fin · $(date +%H:%M:%S)"
